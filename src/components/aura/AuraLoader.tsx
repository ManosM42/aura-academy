// src/components/aura/AuraLoader.tsx
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import auraLogo from "@/assets/aura.JPG";

interface AuraLoaderProps {
  /** Called once the intro finishes (after the fade-out). Optional. */
  onComplete?: () => void;
  /** How long the loader stays on screen before fading out, in ms. */
  duration?: number;
}

/**
 * The AURA intro loader: the brand image (aura.JPG) framed in a chrome disc,
 * a slow rotating chrome ring, a shimmering wordmark, and a progress line
 * that fills before handing off to the app. Monochrome / chrome only.
 */
export default function AuraLoader({
  onComplete,
  duration = 2400,
}: AuraLoaderProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const hide = window.setTimeout(() => setVisible(false), duration);
    // Fire onComplete slightly after the exit animation (0.6s) has run.
    const done = window.setTimeout(() => onComplete?.(), duration + 650);
    return () => {
      window.clearTimeout(hide);
      window.clearTimeout(done);
    };
  }, [duration, onComplete]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="aura-loader"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, filter: "blur(8px)" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-aura-bg"
        >
          <div className="aura-grain" aria-hidden />
          <div className="hero-atmosphere absolute inset-0" aria-hidden />

          <motion.div
            initial={{ opacity: 0, scale: 0.9, filter: "blur(6px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 flex flex-col items-center"
          >
            {/* Emblem: rotating chrome ring around the brand image */}
            <div className="aura-loader-emblem">
              <span className="aura-loader-ring" aria-hidden />
              <span className="aura-loader-disc">
                <img
                  src={auraLogo}
                  alt="AURA"
                  className="aura-loader-img"
                  draggable={false}
                />
                <span className="aura-mark-sweep" aria-hidden />
              </span>
            </div>

            {/* Wordmark */}
            <span className="chrome-text font-aura mt-8 text-sm font-extrabold uppercase tracking-[0.6em]">
              ΛURΛ
            </span>

            {/* Progress line */}
            <div className="aura-loader-track" aria-hidden>
              <motion.span
                className="aura-loader-fill"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{
                  duration: duration / 1000,
                  ease: [0.4, 0, 0.2, 1],
                }}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}