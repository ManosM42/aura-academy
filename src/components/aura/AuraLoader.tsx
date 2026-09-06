// src/components/aura/AuraLoader.tsx
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import auraLogo from "@/assets/aura.jpg";

interface AuraLoaderProps {
  onComplete?: () => void;
}

export default function AuraLoader({ onComplete }: AuraLoaderProps) {
  // Step sequence:
  // 1: "Welcome" (1 sec)
  // 2: "To" (1 sec)
  // 3: aura.jpg (2 sec)
  // 4: Solid black screen fades out to reveal the landing page
  // "done": Unmounts component completely
  const [step, setStep] = useState<1 | 2 | 3 | 4 | "done">(1);

  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    let timer: number;

    if (step === 1) {
      // Step 1 ("Welcome"): 1 second
      timer = window.setTimeout(() => setStep(2), 1000);
    } else if (step === 2) {
      // Step 2 ("To"): 1 second
      timer = window.setTimeout(() => setStep(3), 1000);
    } else if (step === 3) {
      // Step 3 (aura.jpg): 2 seconds
      timer = window.setTimeout(() => setStep(4), 2000);
    } else if (step === 4) {
      // Step 4 (Black screen fade out to main site): 1.2 seconds
      timer = window.setTimeout(() => {
        setStep("done");
        onCompleteRef.current?.();
      }, 1200);
    }

    return () => window.clearTimeout(timer);
  }, [step]);

  if (step === "done") return null;

  const chromeTextStyle: React.CSSProperties = {
    backgroundImage:
      "linear-gradient(to bottom, #ffffff 0%, #e0e0e0 30%, #7a7a7a 49%, #292929 51%, #a3a3a3 60%, #ffffff 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    filter:
      "drop-shadow(0px 4px 12px rgba(255,255,255,0.15)) drop-shadow(0px 1px 2px rgba(255,255,255,0.3))",
  };

  return (
    <motion.div
      key="aura-loader-black-screen"
      initial={{ opacity: 1 }}
      animate={{ opacity: step === 4 ? 0 : 1 }}
      transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black overflow-hidden pointer-events-none"
    >
      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.h1
            key="text-welcome"
            style={chromeTextStyle}
            initial={{ opacity: 0, scale: 0.92, filter: "blur(16px)" }}
            animate={{ opacity: 1, scale: 1.02, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 1.08, filter: "blur(16px)" }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="notranslate text-5xl sm:text-7xl md:text-8xl font-extrabold uppercase tracking-[0.35em] select-none"
          >
            Welcome
          </motion.h1>
        )}

        {step === 2 && (
          <motion.h1
            key="text-to"
            style={chromeTextStyle}
            initial={{ opacity: 0, scale: 0.92, filter: "blur(16px)" }}
            animate={{ opacity: 1, scale: 1.02, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 1.08, filter: "blur(16px)" }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="notranslate text-5xl sm:text-7xl md:text-8xl font-extrabold uppercase tracking-[0.35em] select-none"
          >
            To
          </motion.h1>
        )}

        {step === 3 && (
          <motion.img
            key="image-aura"
            src={auraLogo}
            alt="AURA"
            initial={{ opacity: 0, scale: 0.88, filter: "blur(24px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 1.06, filter: "blur(24px)" }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="w-[310px] sm:w-[440px] md:w-[580px] h-auto object-contain select-none"
            draggable={false}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}