// src/components/aura/Hero.tsx
import { useRef } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "motion/react";
import ChromeButton from "./ChromeButton";
import auraLogo from "@/assets/aura.jpg";

export default function Hero() {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  // Parallax: emblem, headline and atmosphere move at different speeds.
  const emblemY = useTransform(scrollYProgress, [0, 1], [0, reduced ? 0 : 140]);
  const headlineY = useTransform(scrollYProgress, [0, 1], [0, reduced ? 0 : 60]);
  const atmoY = useTransform(scrollYProgress, [0, 1], [0, reduced ? 0 : 40]);
  const fade = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  const container = {
    hidden: {},
    show: { transition: { staggerChildren: 0.15, delayChildren: 0.1 } },
  };
  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] } },
  };

  return (
    <section
      id="top"
      ref={ref}
      className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-black px-6"
    >
      {/* Subtle atmospheric gradient background */}
      <motion.div
        aria-hidden
        style={{ y: atmoY }}
        className="aura-radial absolute inset-0 z-0 pointer-events-none"
      />

      {/* Background watermark image with a tiny micro zoom-out step */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden px-4">
        <motion.img
          src={auraLogo}
          alt=""
          aria-hidden="true"
          draggable={false}
          style={{
            y: emblemY,
            opacity: fade,
            WebkitMaskImage: "radial-gradient(ellipse 61% 61% at 50% 50%, black 35.5%, transparent 100%)",
            maskImage: "radial-gradient(ellipse 61% 61% at 50% 50%, black 35.5%, transparent 100%)",
          }}
          className="select-none w-[650px] sm:w-[920px] md:w-[1250px] max-h-[96vh] max-w-none object-contain opacity-25"
        />
      </div>

      {/* Main content stack shifted higher up */}
      <motion.div
        style={{ y: headlineY }}
        variants={container}
        initial="hidden"
        animate="show"
        className="relative z-10 flex flex-col items-center justify-center text-center w-full max-w-4xl mx-auto -mt-14 sm:-mt-20"
      >
        {/* Liquid Glass Chrome Silver Board Badge */}
        <motion.div variants={item} className="mb-4 sm:mb-6">
          <div className="relative inline-flex items-center px-6 py-2.5 rounded-full overflow-hidden backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.4),inset_0_-1px_1px_rgba(0,0,0,0.5)] bg-gradient-to-b from-white/15 via-white/5 to-black/20 border border-white/30">
            {/* Top specular glass reflection */}
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/80 to-transparent pointer-events-none" />
            {/* Bottom inner highlight */}
            <div className="absolute inset-x-0 bottom-0 h-[1px] bg-white/10 pointer-events-none" />

            <span className="font-aura text-[11px] sm:text-xs uppercase tracking-[0.35em] font-medium text-neutral-100 drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
              The Operating System for the Modern Barber
            </span>
          </div>
        </motion.div>

        <div className="relative flex flex-col items-center justify-center w-full my-2 sm:my-4">
          <div className="absolute h-36 w-80 rounded-full bg-white/[0.07] blur-[60px] pointer-events-none" />
          
          <motion.h1 variants={item} className="w-full flex items-center justify-center">
            <motion.span
              initial={{ backgroundPosition: "0% 50%" }}
              animate={{ backgroundPosition: "100% 50%" }}
              transition={{
                duration: 4,
                repeat: Infinity,
                repeatType: "reverse",
                ease: "easeInOut",
              }}
              style={{
                backgroundImage:
                  "linear-gradient(90deg, #595959 0%, #b3b3b3 25%, #ffffff 50%, #b3b3b3 75%, #595959 100%)",
                backgroundSize: "300% auto",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
              className="inline-block text-center text-6xl sm:text-7xl md:text-8xl font-thin tracking-[0.35em] pl-[0.35em] drop-shadow-[0_2px_4px_rgba(255,255,255,0.9)] drop-shadow-[0_10px_30px_rgba(0,0,0,0.95)] drop-shadow-[0_0_50px_rgba(255,255,255,0.6)] leading-none"
            >
              Λ U R Λ
            </motion.span>
          </motion.h1>
        </div>

        {/* Hair Method */}
        <motion.p
          variants={item}
          className="font-aura mt-5 sm:mt-6 text-sm sm:text-base md:text-lg font-extralight tracking-[0.4em] pl-[0.4em] uppercase text-neutral-200 drop-shadow-[0_2px_10px_rgba(255,255,255,0.15)]"
        >
          — Hair Method —
        </motion.p>

        {/* Action Buttons */}
        <motion.div variants={item} className="mt-8 sm:mt-10 flex flex-wrap items-center justify-center gap-4">
          <ChromeButton
            onClick={() =>
              document.querySelector("#method")?.scrollIntoView({ behavior: "smooth" })
            }
          >
            START LEARNING
          </ChromeButton>
          <ChromeButton
            variant="secondary"
            onClick={() =>
              document.querySelector("#skilltree")?.scrollIntoView({ behavior: "smooth" })
            }
          >
            Explore the Method
          </ChromeButton>
        </motion.div>
      </motion.div>

      {/* Thin chrome divider line at bottom */}
      <div className="chrome-line absolute bottom-0 left-1/2 h-px w-[70%] max-w-3xl -translate-x-1/2 z-20" />
    </section>
  );
}