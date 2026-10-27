// src/components/aura/CallProvider.tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import { formatDuration, type CallLog } from "@/lib/call-logs";

type Kind = "audio" | "video";
type Phase = "idle" | "ringing" | "connecting" | "connected";

export interface CallPeer {
  id: string;
  name: string;
  avatar: string | null;
}
interface CallInfo {
  id: string;
  conversationId: string;
  kind: Kind;
  peer: CallPeer;
  direction: "out" | "in";
}
interface CallCtx {
  busy: boolean;
  startCall: (peer: CallPeer, conversationId: string, kind: Kind) => Promise<void>;
}

const Ctx = createContext<CallCtx>({ busy: false, startCall: async () => {} });
export const useCall = () => useContext(Ctx);

const RING_TIMEOUT_MS = 45_000;
const FALLBACK_ICE: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

function makeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

async function getIceServers(): Promise<RTCIceServer[]> {
  try {
    const { data, error } = await supabase.functions.invoke("get-ice-servers");
    if (!error && data?.iceServers) return data.iceServers as RTCIceServer[];
  } catch {
    /* fall through */
  }
  return FALLBACK_ICE;
}

function subscribe(ch: RealtimeChannel, timeoutMs = 8000): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("subscribe timeout")), timeoutMs);
    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        clearTimeout(t);
        resolve();
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        clearTimeout(t);
        reject(new Error(status));
      }
    });
  });
}

/** Tries a private channel first, then falls back to a public one. */
async function openChannel(
  name: string,
  setup: (ch: RealtimeChannel) => void,
): Promise<RealtimeChannel> {
  let lastErr: unknown;
  for (const priv of [true, false]) {
    const ch = supabase.channel(name, { config: { private: priv } });
    setup(ch);
    try {
      await subscribe(ch);
      return ch;
    } catch (e) {
      lastErr = e;
      supabase.removeChannel(ch);
    }
  }
  throw lastErr;
}

export function CallProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const myId = profile?.id;

  const [call, setCall] = useState<CallInfo | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  const callRef = useRef<CallInfo | null>(null);
  const phaseRef = useRef<Phase>("idle");
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const roomRef = useRef<RealtimeChannel | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);
  const ringTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const setPhaseBoth = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const showNotice = useCallback((msg: string) => {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 6000);
  }, []);

  const cleanup = useCallback(() => {
    if (ringTimer.current) clearTimeout(ringTimer.current);
    ringTimer.current = null;
    localRef.current?.getTracks().forEach((t) => t.stop());
    localRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    if (roomRef.current) supabase.removeChannel(roomRef.current);
    roomRef.current = null;
    pendingIce.current = [];
    callRef.current = null;
    setCall(null);
    setLocalStream(null);
    setRemoteStream(null);
    setMuted(false);
    setCamOff(false);
    setSeconds(0);
    setPhaseBoth("idle");
  }, []);

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
  }, [localStream, phase]);
  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
  }, [remoteStream, phase]);

  useEffect(() => {
    if (phase !== "connected") return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  // simple ringtone (incoming = higher beep, outgoing = lower beep)
  const ringing = !!call && phase === "ringing";
  const incomingDir = call?.direction === "in";
  useEffect(() => {
    if (!ringing) return;
    let ctx: AudioContext | null = null;
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      ctx = new AC();
    } catch {
      return;
    }
    const beep = () => {
      if (!ctx) return;
      try {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.value = incomingDir ? 880 : 440;
        g.gain.value = 0.05;
        o.connect(g);
        g.connect(ctx.destination);
        o.start();
        o.stop(ctx.currentTime + 0.4);
      } catch {
        /* ignore */
      }
    };
    beep();
    const t = setInterval(() => {
      beep();
      if (incomingDir && navigator.vibrate) navigator.vibrate([300, 150, 300]);
    }, 1500);
    return () => {
      clearInterval(t);
      ctx?.close().catch(() => {});
    };
  }, [ringing, incomingDir]);

  // ---------- end / hang up ----------
  const endCall = useCallback(
    async (finalStatus: "ended" | "missed" = "ended") => {
      const info = callRef.current;
      if (!info) return;
      const answered = phaseRef.current === "connected" || phaseRef.current === "connecting";
      const status = answered
        ? "ended"
        : info.direction === "out"
          ? finalStatus === "missed"
            ? "missed"
            : "cancelled"
          : "ended";
      await supabase
        .from("call_logs")
        .update({ status, ended_at: new Date().toISOString() })
        .eq("id", info.id)
        .is("ended_at", null);
      roomRef.current?.send({ type: "broadcast", event: "hangup", payload: {} });
      setTimeout(cleanup, 80);
    },
    [cleanup],
  );

  // ---------- peer connection + signaling room ----------
  const joinRoom = useCallback(
    async (info: CallInfo, isCaller: boolean) => {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: info.kind === "video" ? { facingMode: "user" } : false,
      });
      localRef.current = stream;
      setLocalStream(stream);

      const pc = new RTCPeerConnection({ iceServers: await getIceServers() });
      pcRef.current = pc;
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      const remote = new MediaStream();
      pc.ontrack = (e) => {
        e.streams[0]?.getTracks().forEach((t) => {
          if (!remote.getTracks().includes(t)) remote.addTrack(t);
        });
        setRemoteStream(new MediaStream(remote.getTracks()));
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") setPhaseBoth("connected");
        if (pc.connectionState === "failed") {
          showNotice("Η σύνδεση απέτυχε.");
          void endCall("ended");
        }
      };

      const send = (event: string, payload: unknown = {}) =>
        roomRef.current?.send({ type: "broadcast", event, payload });

      pc.onicecandidate = (e) => {
        if (e.candidate) void send("ice", { c: e.candidate.toJSON() });
      };

      const flushIce = async () => {
        for (const c of pendingIce.current) await pc.addIceCandidate(c).catch(() => {});
        pendingIce.current = [];
      };

      roomRef.current = await openChannel(`call:${info.id}`, (room) => {
        room
          .on("broadcast", { event: "ready" }, async () => {
            if (!isCaller) return;
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            void send("offer", { sdp: offer });
          })
          .on("broadcast", { event: "offer" }, async ({ payload }) => {
            await pc.setRemoteDescription(payload.sdp);
            await flushIce();
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            void send("answer", { sdp: answer });
          })
          .on("broadcast", { event: "answer" }, async ({ payload }) => {
            await pc.setRemoteDescription(payload.sdp);
            await flushIce();
          })
          .on("broadcast", { event: "ice" }, async ({ payload }) => {
            if (pc.remoteDescription) await pc.addIceCandidate(payload.c).catch(() => {});
            else pendingIce.current.push(payload.c);
          })
          .on("broadcast", { event: "hangup" }, () => cleanup())
          .on("broadcast", { event: "decline" }, () => cleanup());
      });

      return send;
    },
    [cleanup, endCall, showNotice],
  );

  const mediaErrorText = (e: unknown) => {
    const name = (e as Error)?.name;
    if (name === "NotAllowedError") return "Επίτρεψε μικρόφωνο/κάμερα στον browser.";
    if (name === "NotFoundError") return "Δεν βρέθηκε μικρόφωνο/κάμερα.";
    if (!window.isSecureContext) return "Οι κλήσεις θέλουν HTTPS.";
    return "Η κλήση απέτυχε. Δοκίμασε ξανά.";
  };

  // ---------- outgoing ----------
  const startCall = useCallback(
    async (peer: CallPeer, conversationId: string, kind: Kind) => {
      if (!profile || callRef.current) return;
      const id = makeId();
      const info: CallInfo = { id, conversationId, kind, peer, direction: "out" };
      callRef.current = info;
      setCall(info);
      setPhaseBoth("ringing");

      try {
        // 1) camera/mic + signaling room first, so we're ready when they answer
        await joinRoom(info, true);

        // 2) the INSERT is what makes the other phone ring
        const { error } = await supabase.from("call_logs").insert({
          id,
          conversation_id: conversationId,
          caller_id: profile.id,
          callee_id: peer.id,
          kind,
        });
        if (error) throw error;

        ringTimer.current = setTimeout(() => {
          if (phaseRef.current === "ringing") void endCall("missed");
        }, RING_TIMEOUT_MS);
      } catch (e) {
        console.error("startCall failed", e);
        showNotice(mediaErrorText(e));
        await supabase
          .from("call_logs")
          .update({ status: "cancelled", ended_at: new Date().toISOString() })
          .eq("id", id);
        cleanup();
      }
    },
    [profile, joinRoom, endCall, cleanup, showNotice],
  );

  // ---------- incoming: listen for new call_logs rows addressed to me ----------
  useEffect(() => {
    if (!myId) return;

    const showIncoming = async (row: CallLog) => {
      if (callRef.current) return; // already busy or already showing this one
      if (row.status !== "ringing" || row.ended_at) return;
      if (Date.now() - new Date(row.created_at).getTime() > 60_000) return;

      let name = "Χρήστης";
      let avatar: string | null = null;
      try {
        const { data } = await supabase
          .from("profiles")
          .select("full_name, avatar_url")
          .eq("id", row.caller_id)
          .maybeSingle();
        if (data) {
          name = (data as any).full_name ?? name;
          avatar = (data as any).avatar_url ?? null;
        }
      } catch {
        /* keep defaults */
      }
      if (callRef.current) return;

      const info: CallInfo = {
        id: row.id,
        conversationId: row.conversation_id,
        kind: row.kind,
        peer: { id: row.caller_id, name, avatar },
        direction: "in",
      };
      callRef.current = info;
      setCall(info);
      setPhaseBoth("ringing");
      if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
    };

    const ch = supabase
      .channel(`incoming-calls:${myId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "call_logs", filter: `callee_id=eq.${myId}` },
        (payload) => void showIncoming(payload.new as CallLog),
      )
      .subscribe();

    // catch a call that started while this page was loading
    (async () => {
      const since = new Date(Date.now() - 45_000).toISOString();
      const { data } = await supabase
        .from("call_logs")
        .select("*")
        .eq("callee_id", myId)
        .eq("status", "ringing")
        .is("ended_at", null)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1);
      if (data?.[0]) void showIncoming(data[0] as CallLog);
    })();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [myId]);

  // ---------- watch the current call's row: ended / declined / cancelled ----------
  const callId = call?.id;
  useEffect(() => {
    if (!callId) return;
    const ch = supabase
      .channel(`call-status:${callId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "call_logs", filter: `id=eq.${callId}` },
        (payload) => {
          const row = payload.new as CallLog;
          if (row.ended_at && callRef.current?.id === callId) cleanup();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [callId, cleanup]);

  const accept = async () => {
    const info = callRef.current;
    if (!info) return;
    setPhaseBoth("connecting");
    try {
      const send = await joinRoom(info, false);
      await supabase
        .from("call_logs")
        .update({ status: "answered", answered_at: new Date().toISOString() })
        .eq("id", info.id);
      await send("ready");
    } catch (e) {
      console.error("accept failed", e);
      showNotice(mediaErrorText(e));
      await endCall("ended");
    }
  };

  const decline = async () => {
    const info = callRef.current;
    if (!info) return;
    await supabase
      .from("call_logs")
      .update({ status: "declined", ended_at: new Date().toISOString() })
      .eq("id", info.id);
    cleanup();
  };

  const toggleMute = () => {
    const next = !muted;
    localRef.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
    setMuted(next);
  };
  const toggleCam = () => {
    const next = !camOff;
    localRef.current?.getVideoTracks().forEach((t) => (t.enabled = !next));
    setCamOff(next);
  };

  const value = useMemo(() => ({ busy: !!call, startCall }), [call, startCall]);
  const incomingRinging = call?.direction === "in" && phase === "ringing";
  const isVideo = call?.kind === "video";

  return (
    <Ctx.Provider value={value}>
      {children}

      {notice && (
        <div className="fixed left-1/2 top-4 z-[120] -translate-x-1/2 rounded-full bg-red-500/90 px-4 py-2 text-sm text-white shadow-lg">
          {notice}
        </div>
      )}

      {call && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-[#070707] text-white">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className={`absolute inset-0 h-full w-full object-cover ${
              isVideo && phase === "connected" ? "" : "invisible"
            }`}
          />

          {(!isVideo || phase !== "connected") && (
            <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-4 px-6">
              {call.peer.avatar ? (
                <img src={call.peer.avatar} alt="" className="h-28 w-28 rounded-full object-cover ring-1 ring-white/20" />
              ) : (
                <div className="flex h-28 w-28 items-center justify-center rounded-full bg-white/10 text-3xl font-semibold">
                  {call.peer.name.charAt(0).toUpperCase()}
                </div>
              )}
              <p className="text-xl font-medium">{call.peer.name}</p>
              <p className="text-sm text-white/50">
                {phase === "connected"
                  ? formatDuration(seconds)
                  : phase === "connecting"
                    ? "Σύνδεση…"
                    : incomingRinging
                      ? isVideo ? "Εισερχόμενη βιντεοκλήση" : "Εισερχόμενη κλήση"
                      : "Καλεί…"}
              </p>
            </div>
          )}

          {isVideo && phase === "connected" && (
            <p className="absolute left-0 right-0 top-6 z-10 text-center text-sm text-white/80 [text-shadow:0_1px_4px_rgba(0,0,0,.6)]">
              {call.peer.name} · {formatDuration(seconds)}
            </p>
          )}

          {isVideo && localStream && (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="absolute right-4 top-4 z-20 h-36 w-24 -scale-x-100 rounded-xl bg-black object-cover ring-1 ring-white/20"
            />
          )}

          <div className="relative z-10 flex items-center justify-center gap-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-6">
            {incomingRinging ? (
              <>
                <button onClick={decline} aria-label="Απόρριψη" className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500">
                  <PhoneOff size={26} />
                </button>
                <button onClick={accept} aria-label="Απάντηση" className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500">
                  {isVideo ? <Video size={26} /> : <Phone size={26} />}
                </button>
              </>
            ) : (
              <>
                <button onClick={toggleMute} aria-label="Σίγαση" className={`flex h-14 w-14 items-center justify-center rounded-full ${muted ? "bg-white text-black" : "bg-white/15"}`}>
                  {muted ? <MicOff size={22} /> : <Mic size={22} />}
                </button>
                {isVideo && (
                  <button onClick={toggleCam} aria-label="Κάμερα" className={`flex h-14 w-14 items-center justify-center rounded-full ${camOff ? "bg-white text-black" : "bg-white/15"}`}>
                    {camOff ? <VideoOff size={22} /> : <Video size={22} />}
                  </button>
                )}
                <button onClick={() => endCall("ended")} aria-label="Τερματισμός" className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500">
                  <PhoneOff size={26} />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}