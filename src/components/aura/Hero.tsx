import { useRef } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "motion/react";
import ChromeButton from "./ChromeButton";

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
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-6"
    >
      {/* subtle atmospheric layers */}
      <motion.div
        aria-hidden
        style={{ y: atmoY }}
        className="aura-radial absolute inset-0"
      />

      {/* giant chrome emblem behind text */}
      <motion.span
        aria-hidden
        style={{ y: emblemY, opacity: fade }}
        className="chrome-text font-aura pointer-events-none absolute select-none text-[46vw] font-extrabold leading-none opacity-[0.06] md:text-[30vw]"
      >
        A
      </motion.span>

      <motion.div
        style={{ y: headlineY }}
        variants={container}
        initial="hidden"
        animate="show"
        className="relative z-10 flex flex-col items-center text-center"
      >
        <motion.span
          variants={item}
          className="font-aura mb-6 text-xs uppercase tracking-[0.5em] text-aura-text-muted"
        >
          The Operating System for the Modern Barber
        </motion.span>

        <motion.h1
          variants={item}
          className="font-aura max-w-4xl text-5xl font-extrabold leading-[0.95] tracking-tight text-aura-text sm:text-6xl md:text-7xl"
        >
          <span className="chrome-text">LEARN.</span>{" "}
          <span className="chrome-text">PRACTICE.</span>{" "}
          <span className="chrome-text">PROVE.</span>
        </motion.h1>

        <motion.p
          variants={item}
          className="font-aura mt-7 max-w-xl text-base leading-relaxed text-aura-text-secondary"
        >
          A luxury barber academy engineered as a futuristic professional
          platform. Master the craft, verify every skill, and earn credentials
          that mean something.
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