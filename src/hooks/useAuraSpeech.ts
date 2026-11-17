import { useCallback, useEffect, useRef, useState } from "react";
import { CLOSED, visemesForText, type Viseme } from "@/lib/visemes";

const CHARS_PER_SEC = 14;

// ⚙️ Το edge function aura-tts (Gemini TTS). Προσαρμόσε αν τα env σου λέγονται αλλιώς.
const TTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/aura-tts`;
const TTS_KEY: string =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";
const TTS_TIMEOUT_MS = 15000;

export type VoiceIssue = null | "no-greek-voice" | "no-audio";

const hasGreek = (t: string) => /[\u0370-\u03FF\u1F00-\u1FFF]/.test(t);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Ήχος: ένα μόνιμο <audio> που «ξεκλειδώνει» με την πρώτη χειρονομία (iOS) ──
const SILENT_WAV = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
let audioEl: HTMLAudioElement | null = null;
const getAudio = () => {
  if (!audioEl) {
    audioEl = new Audio();
    audioEl.preload = "auto";
    (audioEl as any).playsInline = true;
  }
  return audioEl;
};
const unlockAudio = () => {
  const a = getAudio();
  if (a.src) return;
  a.src = SILENT_WAV;
  a.play()
    .then(() => {
      if (a.src.startsWith("data:")) a.pause();
    })
    .catch(() => {});
};

// ── Ανάλυση WAV: περιβάλλουσα έντασης (για να κλείνει το στόμα στις παύσεις) ──
const FRAME = 0.02; // 20ms
type Clip = { url: string; env: Float32Array; start: number; end: number };

function analyseWav(buf: ArrayBuffer): Omit<Clip, "url"> {
  const dv = new DataView(buf);
  const sr = dv.getUint32(24, true) || 24000;
  const n = Math.floor((buf.byteLength - 44) / 2);
  const per = Math.max(1, Math.round(sr * FRAME));
  const frames = Math.max(1, Math.ceil(n / per));
  const env = new Float32Array(frames);

  for (let f = 0; f < frames; f++) {
    let sum = 0;
    let cnt = 0;
    for (let i = f * per; i < Math.min(n, (f + 1) * per); i++, cnt++) {
      const x = dv.getInt16(44 + i * 2, true) / 32768;
      sum += x * x;
    }
    env[f] = cnt ? Math.sqrt(sum / cnt) : 0;
  }

  const sorted = Array.from(env).sort((a, b) => a - b);
  const ref = Math.max(1e-4, sorted[Math.floor(sorted.length * 0.95)]);
  for (let f = 0; f < frames; f++) env[f] = Math.min(1, env[f] / ref);
  // ελαφρύ εξομάλυνση 3 καρέ
  const sm = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    sm[f] = ((env[f - 1] ?? env[f]) + env[f] * 2 + (env[f + 1] ?? env[f])) / 4;
  }

  let a = 0;
  let b = frames - 1;
  while (a < frames - 1 && sm[a] < 0.12) a++;
  while (b > a && sm[b] < 0.12) b--;
  return { env: sm, start: a * FRAME, end: (b + 1) * FRAME };
}

const clipCache = new Map<string, Clip>();
async function fetchClip(text: string): Promise<Clip> {
  const hit = clipCache.get(text);
  if (hit) return hit;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TTS_TIMEOUT_MS);
  try {
    const res = await fetch(TTS_URL, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", apikey: TTS_KEY, Authorization: `Bearer ${TTS_KEY}` },
      body: JSON.stringify({ text }),
    });
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("audio")) throw new Error("tts-unavailable");
    const buf = await res.arrayBuffer();
    const clip: Clip = {
      ...analyseWav(buf),
      url: URL.createObjectURL(new Blob([buf], { type: "audio/wav" })),
    };
    if (clipCache.size >= 20) {
      const k = clipCache.keys().next().value!;
      URL.revokeObjectURL(clipCache.get(k)!.url);
      clipCache.delete(k);
    }
    clipCache.set(text, clip);
    return clip;
  } finally {
    clearTimeout(timer);
  }
}

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  const synth = window.speechSynthesis;
  const now = synth.getVoices();
  if (now.length) return Promise.resolve(now);
  return new Promise((resolve) => {
    const done = () => {
      synth.removeEventListener("voiceschanged", done);
      resolve(synth.getVoices());
    };
    synth.addEventListener("voiceschanged", done);
    setTimeout(done, 1000);
  });
}

export function useAuraSpeech() {
  const [speaking, setSpeaking] = useState(false);
  const [voiceIssue, setVoiceIssue] = useState<VoiceIssue>(null);
  const st = useRef({
    text: "",
    visemes: [] as Viseme[],
    pos: 0,
    lastTick: 0,
    rate: 1,
    active: false,
    hasBoundary: false,
    token: 0,
    clip: null as Clip | null,
  });
  const uttRef = useRef<SpeechSynthesisUtterance | null>(null); // κρατάμε αναφορά (το Chrome κάνει GC στα utterances)
  const timers = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current = [];
  }, []);

  const finish = useCallback(() => {
    st.current.active = false;
    st.current.clip = null;
    setSpeaking(false);
    clearTimers();
  }, [clearTimers]);

  const stop = useCallback(() => {
    st.current.token++;
    if (typeof window !== "undefined") {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      if (audioEl && !audioEl.src.startsWith("data:")) audioEl.pause();
    }
    finish();
  }, [finish]);

  useEffect(() => () => stop(), [stop]);

  // ξεκλείδωμα ήχου στην πρώτη χειρονομία του χρήστη (απαραίτητο σε iOS/Safari)
  useEffect(() => {
    const events = ["pointerdown", "touchend", "keydown", "click"] as const;
    const h = () => {
      unlockAudio();
      events.forEach((e) => window.removeEventListener(e, h));
    };
    events.forEach((e) => window.addEventListener(e, h, { passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, h));
  }, []);

  const speak = useCallback(
    async (text: string) => {
      if (typeof window === "undefined") return;
      const s = st.current;
      const token = ++s.token;
      clearTimers();
      s.text = text;
      s.visemes = visemesForText(text);
      s.pos = 0;
      s.hasBoundary = false;
      s.active = false;
      s.clip = null;
      s.rate = 1;
      setVoiceIssue(null);
      if (audioEl) audioEl.pause();
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();

      // Το avatar κινείται και χωρίς ήχο (όταν δεν υπάρχει φωνή)
      const startSilent = () => {
        if (s.token !== token) return;
        s.hasBoundary = false;
        s.clip = null;
        s.pos = 0;
        s.lastTick = performance.now();
        s.active = true;
        setSpeaking(true);
        const ms = (text.length / CHARS_PER_SEC) * 1000 + 300;
        timers.current.push(window.setTimeout(() => s.token === token && finish(), ms));
      };

      // ── Φωνή της συσκευής (εφεδρική) ─────────────────────────────────────
      const speakWithBrowser = async () => {
        if (!("speechSynthesis" in window)) {
          setVoiceIssue("no-audio");
          startSilent();
          return;
        }
        const synth = window.speechSynthesis;
        synth.cancel();

        const greek = hasGreek(text);
        const voices = await loadVoices();
        if (s.token !== token) return;
        const voice = voices.find((v) =>
          v.lang.toLowerCase().replace("_", "-").startsWith(greek ? "el" : "en"),
        );
        if (greek && !voice) {
          setVoiceIssue("no-greek-voice");
          startSilent();
          return;
        }

        await sleep(80); // Chrome: speak() αμέσως μετά το cancel() χάνεται
        if (s.token !== token) return;

        const u = new SpeechSynthesisUtterance(text);
        u.lang = greek ? "el-GR" : "en-US";
        if (voice) u.voice = voice;
        u.rate = s.rate;

        u.onstart = () => {
          if (s.token !== token) return;
          s.active = true;
          s.pos = 0;
          s.lastTick = performance.now();
          setSpeaking(true);
        };
        u.onboundary = (e) => {
          if (s.token !== token) return;
          s.hasBoundary = true;
          s.pos = e.charIndex; // ξανασυγχρονισμός στην αρχή της λέξης
        };
        u.onend = () => {
          if (s.token === token) finish();
        };
        u.onerror = (e) => {
          if (s.token !== token) return;
          if (e.error === "canceled" || e.error === "interrupted") return;
          setVoiceIssue("no-audio");
          if (!s.active) startSilent();
          else finish();
        };

        uttRef.current = u;
        synth.resume();
        synth.speak(u);

        // Αν σε 2s δεν ξεκίνησε ήχος, πέφτουμε σε σιωπηλό animation
        timers.current.push(
          window.setTimeout(() => {
            if (s.token === token && !s.active) {
              synth.cancel();
              setVoiceIssue("no-audio");
              startSilent();
            }
          }, 2000),
        );
      };

      // ── Κύρια φωνή: ρεαλιστική φωνή από το edge function ────────────────
      let clip: Clip | null = null;
      try {
        clip = await fetchClip(text);
      } catch (e) {
        console.warn("aura-tts:", String(e));
      }
      if (s.token !== token) return;
      if (!clip) return speakWithBrowser();

      const a = getAudio();
      a.onplaying = () => {
        if (s.token !== token) return;
        s.clip = clip;
        s.active = true;
        setSpeaking(true);
      };
      a.onended = () => {
        if (s.token === token) finish();
      };
      a.onerror = () => {
        if (s.token === token) {
          finish();
          void speakWithBrowser();
        }
      };
      a.src = clip.url;
      a.currentTime = 0;
      try {
        await a.play();
      } catch {
        // αυτόματη αναπαραγωγή μπλοκαρίστηκε από τον browser
        if (s.token === token) {
          setVoiceIssue("no-audio");
          startSilent();
        }
      }
    },
    [finish, clearTimers],
  );

  /** Καλείται σε κάθε frame από το avatar. */
  const getViseme = useCallback((now: number): Viseme => {
    const s = st.current;
    if (!s.active) return CLOSED;

    // Πραγματικός ήχος: χρόνος αναπαραγωγής → γράμμα, με ένταση που ανοίγει/κλείνει το στόμα
    if (s.clip) {
      const a = audioEl;
      if (!a || a.paused) return CLOSED;
      const t = a.currentTime;
      const c = s.clip;
      const level = c.env[Math.min(c.env.length - 1, Math.floor(t / FRAME))] ?? 0;
      const prog = Math.min(1, Math.max(0, (t - c.start) / Math.max(0.2, c.end - c.start)));
      const idx = Math.min(s.visemes.length - 1, Math.floor(prog * s.visemes.length));
      const v = s.visemes[idx] ?? CLOSED;
      const gate = Math.min(1, level * 1.5);
      return gate < 0.06 ? CLOSED : ({ ...v, open: v.open * (0.35 + 0.65 * gate) } as Viseme);
    }

    const dt = (now - s.lastTick) / 1000;
    s.lastTick = now;

    const ch = s.text[Math.floor(s.pos)] ?? "";
    const hold = s.hasBoundary && /[\s.,;:!?·…]/.test(ch);
    if (!hold) s.pos += dt * CHARS_PER_SEC * s.rate;

    const idx = Math.floor(s.pos);
    return idx >= s.visemes.length ? CLOSED : (s.visemes[idx] ?? CLOSED);
  }, []);

  return { speak, stop, speaking, voiceIssue, getViseme };
}