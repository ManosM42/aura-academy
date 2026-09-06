// src/components/aura/Hero.tsx
import { useRef } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "motion/react";
import { useNavigate } from "@tanstack/react-router";
import auraLogo from "@/assets/aura.jpg";

export default function Hero() {
  const navigate = useNavigate();
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

      {/* Background watermark image */}
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

      {/* Main content stack */}
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
        <motion.div
          variants={item}
          className="mt-6 sm:mt-8 flex flex-col items-center justify-center gap-2.5 w-full max-w-[220px] sm:max-w-[240px] mx-auto"
        >
          {/* Button 1: START LEARNING -> Redirects to /pricing */}
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate({ to: "/pricing" })}
            className="group relative w-full overflow-hidden rounded-full py-2.5 px-4 backdrop-blur-md bg-white/10 hover:bg-white/20 text-white font-aura text-[10px] sm:text-xs font-bold uppercase tracking-[0.25em] border border-white/40 hover:border-white/70 shadow-[0_4px_16px_rgba(0,0,0,0.3)] hover:shadow-[0_0_20px_rgba(255,255,255,0.3)] transition-all duration-300 cursor-pointer"
          >
            {/* Soft specular sheen animation */}
            <motion.span
              className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-[-25deg] pointer-events-none"
              animate={{ x: ["-150%", "300%"] }}
              transition={{
                duration: 2.8,
                repeat: Infinity,
                repeatDelay: 1.5,
                ease: "easeInOut",
              }}
            />
            <span className="relative z-10 flex items-center justify-center gap-2">
              START LEARNING
            </span>
          </motion.button>

          {/* Button 2: EXPLORE THE METHOD -> Redirects to /method */}
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate({ to: "/method" })}
            className="group relative w-full overflow-hidden rounded-full py-2.5 px-4 backdrop-blur-md bg-black/20 hover:bg-white/10 text-neutral-300 hover:text-white border border-white/20 hover:border-white/40 font-aura text-[10px] sm:text-xs font-semibold uppercase tracking-[0.25em] transition-all duration-300 cursor-pointer"
          >
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none" />
            <span className="relative z-10 flex items-center justify-center gap-2">
              Explore the Method
            </span>
          </motion.button>
        </motion.div>
      </motion.div>

      {/* Thin chrome divider line at bottom */}
      <div className="chrome-line absolute bottom-0 left-1/2 h-px w-[70%] max-w-3xl -translate-x-1/2 z-20" />
    </section>
  );
}