// src/lib/useVoiceRecorder.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState } from "react";

export const MAX_VOICE_MS = 120_000; // 2 minutes
export const MIN_VOICE_MS = 700;
export const LIVE_BARS = 34;
const SAVED_BARS = 48;
const TICK_MS = 80;

export interface VoiceClip {
  blob: Blob;
  /** Clean mime type without codec parameters, e.g. "audio/mp4". */
  mime: string;
  durationMs: number;
  /** SAVED_BARS integers 0..100, stored with the message and drawn when playing. */
  waveform: number[];
}

export type RecState = "idle" | "starting" | "recording" | "paused";

// mp4/aac plays everywhere (including iPhone), so try it first.
const MIME_CANDIDATES = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];

function pickMime(): string | undefined {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return undefined;
  return MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m));
}

export function baseMime(m: string): string {
  return (m.split(";")[0] || "audio/webm").trim().toLowerCase();
}

function toWaveform(samples: number[]): number[] {
  const n = samples.length;
  if (n === 0) return Array.from({ length: SAVED_BARS }, () => 12);
  const out: number[] = [];
  for (let i = 0; i < SAVED_BARS; i += 1) {
    const a = Math.floor((i * n) / SAVED_BARS);
    const b = Math.max(a + 1, Math.floor(((i + 1) * n) / SAVED_BARS));
    let peak = 0;
    for (let j = a; j < b && j < n; j += 1) peak = Math.max(peak, samples[j] ?? 0);
    out.push(peak);
  }
  const top = Math.max(0.25, ...out);
  return out.map((v) => Math.max(8, Math.min(100, Math.round((v / top) * 100))));
}

function micError(e: unknown): string {
  const name = (e as any)?.name as string | undefined;
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Microphone access is blocked. Allow it in your browser settings and try again.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No microphone was found.";
  return "Could not start the microphone.";
}

export function useVoiceRecorder() {
  const [state, setState] = useState<RecState>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [live, setLive] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  const stateRef = useRef<RecState>("idle");
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const chunksRef = useRef<Blob[]>([]);
  const samplesRef = useRef<number[]>([]);
  const elapsedRef = useRef(0);
  const mimeRef = useRef("audio/webm");
  const tokenRef = useRef(0);

  const setS = useCallback((s: RecState) => {
    stateRef.current = s;
    setState(s);
  }, []);

  const teardown = useCallback(() => {
    if (timerRef.current !== undefined) {
      window.clearInterval(timerRef.current);
      timerRef.current = undefined;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const ctx = ctxRef.current;
    ctxRef.current = null;
    if (ctx && ctx.state !== "closed") void ctx.close().catch(() => undefined);
    recRef.current = null;
  }, []);

  const reset = useCallback(() => {
    elapsedRef.current = 0;
    samplesRef.current = [];
    chunksRef.current = [];
    setElapsedMs(0);
    setLive([]);
  }, []);

  const start = useCallback(async (): Promise<boolean> => {
    if (stateRef.current !== "idle") return false;
    setError(null);

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Voice messages are not supported here. Use a modern browser over HTTPS.");
      return false;
    }

    const token = ++tokenRef.current;
    setS("starting");
    reset();

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (e) {
      if (token === tokenRef.current) {
        setS("idle");
        setError(micError(e));
      }
      return false;
    }

    // cancelled while the permission prompt / microphone was starting
    if (token !== tokenRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      return false;
    }

    const mime = pickMime();
    let recorder: MediaRecorder;
    try {
      recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 64000 })
        : new MediaRecorder(stream);
    } catch {
      try {
        recorder = new MediaRecorder(stream);
      } catch (e) {
        stream.getTracks().forEach((t) => t.stop());
        setS("idle");
        setError(micError(e));
        return false;
      }
    }

    mimeRef.current = baseMime(recorder.mimeType || mime || "audio/webm");
    chunksRef.current = [];
    recorder.ondataavailable = (ev: BlobEvent) => {
      if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
    };

    // live level meter (optional: falls back to a gentle fake level)
    let analyser: AnalyserNode | null = null;
    try {
      const AC: typeof AudioContext | undefined = window.AudioContext || (window as any).webkitAudioContext;
      if (AC) {
        const ctx = new AC();
        void ctx.resume?.().catch(() => undefined);
        const src = ctx.createMediaStreamSource(stream);
        analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);
        ctxRef.current = ctx;
      }
    } catch {
      analyser = null;
    }

    streamRef.current = stream;
    recRef.current = recorder;
    elapsedRef.current = 0;
    samplesRef.current = [];

    try {
      recorder.start(250);
    } catch (e) {
      teardown();
      setS("idle");
      setError(micError(e));
      return false;
    }
    setS("recording");

    const buf = analyser ? new Uint8Array(analyser.fftSize) : null;
    let last = performance.now();
    timerRef.current = window.setInterval(() => {
      const now = performance.now();
      const dt = now - last;
      last = now;
      if (stateRef.current !== "recording") return;

      elapsedRef.current += dt;
      let level = 0.2 + Math.random() * 0.25;
      if (analyser && buf) {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i += 1) {
          const x = ((buf[i] ?? 128) - 128) / 128;
          sum += x * x;
        }
        level = Math.min(1, Math.sqrt(sum / buf.length) * 3.4);
      }
      samplesRef.current.push(level);
      setElapsedMs(Math.round(elapsedRef.current));
      setLive((prev) => [...prev.slice(-(LIVE_BARS - 1)), level]);
    }, TICK_MS);

    return true;
  }, [reset, setS, teardown]);

  const stop = useCallback(
    (): Promise<VoiceClip | null> =>
      new Promise((resolve) => {
        const rec = recRef.current;
        if (!rec || (stateRef.current !== "recording" && stateRef.current !== "paused")) {
          resolve(null);
          return;
        }
        const durationMs = Math.round(elapsedRef.current);
        const samples = samplesRef.current.slice();

        rec.onstop = () => {
          const mime = baseMime(rec.mimeType || mimeRef.current);
          const blob = new Blob(chunksRef.current, { type: mime });
          teardown();
          reset();
          setS("idle");
          resolve(blob.size > 0 ? { blob, mime, durationMs, waveform: toWaveform(samples) } : null);
        };
        try {
          rec.stop();
        } catch {
          teardown();
          reset();
          setS("idle");
          resolve(null);
        }
      }),
    [reset, setS, teardown],
  );

  const cancel = useCallback(() => {
    tokenRef.current += 1; // invalidates a start() that is still waiting for the mic
    const rec = recRef.current;
    if (rec) {
      rec.ondataavailable = null;
      rec.onstop = null;
      try {
        if (rec.state !== "inactive") rec.stop();
      } catch {
        /* already stopped */
      }
    }
    teardown();
    reset();
    setS("idle");
  }, [reset, setS, teardown]);

  const togglePause = useCallback(() => {
    const rec = recRef.current;
    if (!rec) return;
    try {
      if (stateRef.current === "recording") {
        rec.pause();
        setS("paused");
      } else if (stateRef.current === "paused") {
        rec.resume();
        setS("recording");
      }
    } catch {
      /* pause is not supported everywhere */
    }
  }, [setS]);

  useEffect(
    () => () => {
      tokenRef.current += 1;
      const rec = recRef.current;
      if (rec) {
        rec.ondataavailable = null;
        rec.onstop = null;
        try {
          if (rec.state !== "inactive") rec.stop();
        } catch {
          /* ignore */
        }
      }
      teardown();
    },
    [teardown],
  );

  return { state, elapsedMs, live, error, setError, start, stop, cancel, togglePause };
}