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
import { formatDuration } from "@/lib/call-logs";

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

async function getIceServers(): Promise<RTCIceServer[]> {
  try {
    const { data, error } = await supabase.functions.invoke("get-ice-servers");
    if (!error && data?.iceServers) return data.iceServers as RTCIceServer[];
  } catch {
    /* fall through */
  }
  return FALLBACK_ICE;
}

function subscribe(ch: RealtimeChannel): Promise<void> {
  return new Promise((resolve, reject) => {
    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") resolve();
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") reject(new Error(status));
    });
  });
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

  const callRef = useRef<CallInfo | null>(null);
  const phaseRef = useRef<Phase>("idle");
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const roomRef = useRef<RealtimeChannel | null>(null);
  const inboxOutRef = useRef<RealtimeChannel | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);
  const ringTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const setPhaseBoth = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const cleanup = useCallback(() => {
    if (ringTimer.current) clearTimeout(ringTimer.current);
    ringTimer.current = null;
    localRef.current?.getTracks().forEach((t) => t.stop());
    localRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    if (roomRef.current) supabase.removeChannel(roomRef.current);
    roomRef.current = null;
    if (inboxOutRef.current) supabase.removeChannel(inboxOutRef.current);
    inboxOutRef.current = null;
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

  // attach streams to <video> elements
  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
  }, [localStream, phase]);
  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
  }, [remoteStream, phase]);

  // call timer
  useEffect(() => {
    if (phase !== "connected") return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  // ---------- peer connection + room ----------
  const joinRoom = useCallback(async (info: CallInfo, isCaller: boolean) => {
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
      e.streams[0]?.getTracks().forEach((t) => remote.addTrack(t));
      setRemoteStream(new MediaStream(remote.getTracks()));
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") setPhaseBoth("connected");
      if (pc.connectionState === "failed") void endCall("ended");
    };

    const room = supabase.channel(`call:${info.id}`, { config: { private: true } });
    roomRef.current = room;
    const send = (event: string, payload: unknown = {}) =>
      room.send({ type: "broadcast", event, payload });

    pc.onicecandidate = (e) => {
      if (e.candidate) void send("ice", { c: e.candidate.toJSON() });
    };

    const flushIce = async () => {
      for (const c of pendingIce.current) await pc.addIceCandidate(c).catch(() => {});
      pendingIce.current = [];
    };

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
      .on("broadcast", { event: "decline" }, () => cleanup())
      .on("broadcast", { event: "hangup" }, () => cleanup());

    await subscribe(room);
    return send;
  }, [cleanup]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- end / hang up ----------
  const endCall = useCallback(
    async (finalStatus: "ended" | "cancelled" | "missed") => {
      const info = callRef.current;
      if (!info) return;
      const answered = phaseRef.current === "connected" || phaseRef.current === "connecting";
      const patch =
        info.direction === "out" && !answered
          ? { status: finalStatus === "ended" ? "cancelled" : finalStatus, ended_at: new Date().toISOString() }
          : { status: "ended", ended_at: new Date().toISOString() };
      await supabase.from("call_logs").update(patch).eq("id", info.id).is("ended_at", null);

      roomRef.current?.send({ type: "broadcast", event: "hangup", payload: {} });
      if (info.direction === "out" && !answered && inboxOutRef.current) {
        await inboxOutRef.current.send({
          type: "broadcast",
          event: "cancel",
          payload: { callId: info.id },
        });
      }
      setTimeout(cleanup, 80); // let the hangup message leave first
    },
    [cleanup],
  );

  // ---------- outgoing ----------
  const startCall = useCallback(
    async (peer: CallPeer, conversationId: string, kind: Kind) => {
      if (!profile || callRef.current) return;
      const id = crypto.randomUUID();
      const info: CallInfo = { id, conversationId, kind, peer, direction: "out" };
      callRef.current = info;
      setCall(info);
      setPhaseBoth("ringing");

      try {
        const { error } = await supabase.from("call_logs").insert({
          id,
          conversation_id: conversationId,
          caller_id: profile.id,
          callee_id: peer.id,
          kind,
        });
        if (error) throw error;

        await joinRoom(info, true);

        const inbox = supabase.channel(`calls:${peer.id}`, { config: { private: true } });
        inboxOutRef.current = inbox;
        await subscribe(inbox);
        await inbox.send({
          type: "broadcast",
          event: "invite",
          payload: {
            callId: id,
            conversationId,
            kind,
            caller: {
              id: profile.id,
              name: profile.full_name ?? "Χρήστης",
              avatar: profile.avatar_url ?? null,
            },
          },
        });

        ringTimer.current = setTimeout(() => {
          if (phaseRef.current === "ringing") void endCall("missed");
        }, RING_TIMEOUT_MS);
      } catch (e) {
        console.error("startCall failed", e);
        await supabase.from("call_logs").update({ status: "cancelled", ended_at: new Date().toISOString() }).eq("id", id);
        cleanup();
      }
    },
    [profile, joinRoom, endCall, cleanup],
  );

  // ---------- incoming ----------
  useEffect(() => {
    if (!myId) return;
    supabase.realtime.setAuth();
    const inbox = supabase.channel(`calls:${myId}`, { config: { private: true } });
    inbox
      .on("broadcast", { event: "invite" }, ({ payload }) => {
        if (callRef.current) return; // already in a call
        const info: CallInfo = {
          id: payload.callId,
          conversationId: payload.conversationId,
          kind: payload.kind,
          peer: payload.caller,
          direction: "in",
        };
        callRef.current = info;
        setCall(info);
        setPhaseBoth("ringing");
        if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
      })
      .on("broadcast", { event: "cancel" }, ({ payload }) => {
        if (callRef.current?.id === payload.callId && phaseRef.current === "ringing") cleanup();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(inbox);
    };
  }, [myId, cleanup]);

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
    const room = supabase.channel(`call:${info.id}`, { config: { private: true } });
    try {
      await subscribe(room);
      await room.send({ type: "broadcast", event: "decline", payload: {} });
    } catch {
      /* caller will time out */
    }
    supabase.removeChannel(room);
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
      {call && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-[#070707] text-white">
          {/* remote media (also plays audio for audio-only calls) */}
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