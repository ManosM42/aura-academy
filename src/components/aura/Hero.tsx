// src/components/aura/Hero.tsx
import { useRef } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "motion/react";
import ChromeButton from "./ChromeButton";
import auraLogo from "@/assets/aura.JPG";

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
    show: { transition: { staggerChildren: 0.18, delayChildren: 0.1 } },
  };
  const item = {
    hidden: { opacity: 0, y: 24 },
    show: { opacity: 1, y: 0, transition: { duration: 1, ease: [0.22, 1, 0.36, 1] } },
  };

  return (
        <section
      id="top"
      ref={ref}
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-6"
    >
      {/* subtle atmospheric layers */}
      <motion.div
        aria-hidden
        style={{ y: atmoY }}
        className="aura-radial absolute inset-0"
      />

      {/* giant brand image behind text (was the chrome "A") */}
      <motion.img
        src={auraLogo}
        alt=""
        aria-hidden="true"
        draggable={false}
        style={{ y: emblemY, opacity: fade }}
        className="hero-watermark pointer-events-none absolute select-none"
      />

      <motion.div
        style={{ y: headlineY }}
        variants={container}
        initial="hidden"
        animate="show"
        className="relative z-10 flex flex-col items-center text-center"
      >
        <motion.span
  variants={item}
  className="font-aura mb-6 text-xs sm:text-sm uppercase tracking-[0.5em] font-light text-neutral-300 drop-shadow-[0_2px_8px_rgba(255,255,255,0.15)]"
>
  The Operating System for the Modern Barber
</motion.span>

        <motion.h1
          variants={item}
          className="font-aura max-w-4xl text-5xl font-extrabold leading-[0.95] tracking-tight text-aura-text sm:text-6xl md:text-7xl"
        >
          <span className="chrome-text"></span>{" "}
       <div className="flex h-full w-full items-center justify-center py-16">
  <motion.span
    initial={{ backgroundPosition: "0% 50%" }}
    animate={{ backgroundPosition: "100% 50%" }}
    transition={{
      duration: 3.5,
      repeat: Infinity,
      repeatType: "reverse",
      ease: "easeInOut",
    }}
    style={{
      backgroundImage:
        "linear-gradient(90deg, #737373 0%, #a3a3a3 30%, #ffffff 50%, #a3a3a3 70%, #737373 100%)",
      backgroundSize: "250% auto",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
    }}
    className="inline-block origin-center scale-x-125 text-6xl font-light tracking-[0.45em] drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)] drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)] drop-shadow-[0_0_40px_rgba(255,255,255,0.5)] leading-none"
  >
    ΛURΛ
  </motion.span>
</div>
          <span className="chrome-text"></span>
        </motion.h1>

        <motion.p
  variants={item}
  className="font-aura mt-7 max-w-xl text-lg md:text-xl font-extralight tracking-[0.35em] uppercase text-neutral-200 drop-shadow-[0_2px_10px_rgba(255,255,255,0.15)]"
>
  — Hair Method —
</motion.p>

        <motion.div variants={item} className="mt-10 flex flex-wrap items-center justify-center gap-4">
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

      {/* thin chrome divider line at bottom */}
      <div className="chrome-line absolute bottom-0 left-1/2 h-px w-[70%] max-w-3xl -translate-x-1/2" />
    </section>
  );
}