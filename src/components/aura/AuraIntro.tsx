// src/components/aura/AuraIntro.tsx
//
// First-visit intro for the AURA platform.
//   1. welcome.MOV loads and plays automatically, full screen
//   2. When it ends, it dips to black
//   3. The black fades out onto the landing page
//
// No buttons. Only plays once per browser (localStorage).
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

// If the video cannot start within this time, skip straight to the page.
const LOAD_TIMEOUT_MS = 8000;

interface AuraIntroProps {
  onComplete?: () => void;
}

export default function AuraIntro({ onComplete }: AuraIntroProps) {
  const [phase, setPhase] = useState<Phase>("playing");
  const [ready, setReady] = useState(false); // video has frames to show

  const videoRef = useRef<HTMLVideoElement>(null);
  const finishing = useRef(false);

  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Returning visitor: skip before the first paint (no flash, SSR-safe).
  useIsoLayoutEffect(() => {
    try {
      if (localStorage.getItem(AURA_INTRO_KEY)) {
        setPhase("done");
        onCompleteRef.current?.();
      }
    } catch {
      /* storage blocked: just play the intro */
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

  // Video -> black -> page.
  const finish = useCallback(() => {
    if (finishing.current) return;
    finishing.current = true;
    setPhase("outro"); // video dips to black (0.9s)
    window.setTimeout(() => setPhase("reveal"), 900); // black fades away (1.2s)
    window.setTimeout(() => {
      setPhase("done");
      onCompleteRef.current?.();
    }, 2100);
  }, []);

  // Start playing as soon as the component mounts.
  useEffect(() => {
    if (phase !== "playing") return;
    const v = videoRef.current;
    if (!v) return;

    // Autoplay is only allowed by browsers when the video is muted.
    v.muted = true;
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
          // object-contain shows the WHOLE frame (no crop, no zoom).
          className="h-full w-full bg-black object-contain"
          onPlaying={() => {
            setReady(true);
            try {
              localStorage.setItem(AURA_INTRO_KEY, "1");
            } catch {
              /* ignore */
            }
          }}
          // A video whose codec the browser can't decode reports a width of 0
          // (it "plays" as a black screen). Skip the intro in that case.
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