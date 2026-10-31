// src/components/aura/AuraIntro.tsx
//
// First-visit intro for the AURA platform.
// Plays once per browser, the first time someone enters the site on any page.
// Clear AURA_INTRO_KEY to replay.

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { motion } from "motion/react";
import welcomeVideo from "@/assets/welcome.mp4";

export const AURA_INTRO_KEY = "aura:intro-seen";

type Phase = "playing" | "outro" | "reveal" | "done";

const EASE = [0.22, 1, 0.36, 1] as const;
const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

const LOAD_TIMEOUT_MS = 8000;

function hasSeenIntro(): boolean {
  try {
    return localStorage.getItem(AURA_INTRO_KEY) !== null;
  } catch {
    return false; // storage blocked: treat as first visit
  }
}

function markIntroSeen() {
  try {
    localStorage.setItem(AURA_INTRO_KEY, "1");
  } catch {
    /* ignore */
  }
}

interface AuraIntroProps {
  onComplete?: () => void;
}

export default function AuraIntro({ onComplete }: AuraIntroProps) {
  const [phase, setPhase] = useState<Phase>("playing");
  const [ready, setReady] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const finishing = useRef(false);

  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Returning visitor: skip before the first paint.
  useIsoLayoutEffect(() => {
    if (hasSeenIntro()) {
      setPhase("done");
      onCompleteRef.current?.();
    }
  }, []);

  // Lock page scroll while the intro is up.
  useEffect(() => {
    if (phase === "done") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [phase === "done"]); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = useCallback(() => {
    if (finishing.current) return;
    finishing.current = true;
    markIntroSeen(); // also mark here, so a finished intro never replays
    setPhase("outro");
    window.setTimeout(() => setPhase("reveal"), 900);
    window.setTimeout(() => {
      setPhase("done");
      onCompleteRef.current?.();
    }, 2100);
  }, []);

  // Start playing on mount, but never for returning visitors.
  useEffect(() => {
    if (phase !== "playing" || hasSeenIntro()) return;
    const v = videoRef.current;
    if (!v) return;

    v.muted = true; // autoplay is only allowed when muted
    v.play().catch(finish);

    const timeout = window.setTimeout(() => {
      if (!v || v.readyState < 3 || v.paused) finish();
    }, LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === "done") return null;

  return (
    <motion.div
      role="dialog"
      aria-label="Welcome to AURA"
      initial={{ opacity: 1 }}
      animate={{ opacity: phase === "reveal" ? 0 : 1 }}
      transition={{ duration: 1.2, ease: EASE }}
      style={{ pointerEvents: phase === "reveal" ? "none" : "auto" }}
      className="fixed inset-0 z-[100] overflow-hidden bg-black"
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: phase === "playing" && ready ? 1 : 0 }}
        transition={{
          duration: phase === "outro" ? 0.9 : 0.8,
          ease: "easeInOut",
        }}
        className="pointer-events-none absolute inset-0 bg-black"
      >
        <video
          ref={videoRef}
          src={welcomeVideo}
          autoPlay
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          className="h-full w-full bg-black object-contain"
          onPlaying={() => {
            setReady(true);
            markIntroSeen();
          }}
          onLoadedMetadata={(e) => {
            if (e.currentTarget.videoWidth === 0) finish();
          }}
          onEnded={finish}
          onError={finish}
        />
      </motion.div>
    </motion.div>
  );
}