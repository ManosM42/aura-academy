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
       

        {/* Hair Method */}
        <motion.p
          variants={item}
          className="font-aura mt-5 sm:mt-6 text-sm sm:text-base md:text-lg font-extralight tracking-[0.4em] pl-[0.4em] uppercase text-neutral-200 drop-shadow-[0_2px_10px_rgba(255,255,255,0.15)]"
        >
         
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