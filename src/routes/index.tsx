import { createFileRoute } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import ChromeCursor from "@/components/aura/ChromeCursor";
import Hero from "@/components/aura/Hero";
import SkillTree from "@/components/aura/SkillTree";
import PhysicalBook from "@/components/aura/PhysicalBook";
import Seminars from "@/components/aura/Seminars";
import Certification from "@/components/aura/Certification";
import Footer from "@/components/aura/Footer";
import OurTeam from "@/components/aura/OurTeam";
import AuraIntro from "@/components/aura/AuraIntro";
import GalleryTeaser from "@/components/aura/GalleryTeaser";

export const Route = createFileRoute("/")({
  component: Index,
});

/**
 * Smooth scroll-triggered fade-in. It only changes opacity (and, optionally, a small
 * upward move) once per section and never touches layout, so it cannot affect scrolling.
 * y = 0 -> pure fade, used for sections that measure their own scroll position.
 */
function Reveal({ children, y = 0 }: { children: ReactNode; y?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

function Index() {
  const [loading, setLoading] = useState(true);

  return (
    // overflow-x-clip (not -hidden): hides sideways overflow WITHOUT turning these wrappers
    // into scroll containers, which is what makes scrolling "lock" on a section.
    <div className="relative min-h-screen w-full bg-aura-bg text-aura-text antialiased overflow-x-clip">
      <AnimatePresence mode="wait">
        {loading && <AuraIntro key="loader" onComplete={() => setLoading(false)} />}
      </AnimatePresence>

      <div className="aura-grain" aria-hidden />
      <ChromeCursor />

      <main className="w-full overflow-x-clip">
        <Hero />
        <Reveal>
          <SkillTree />
        </Reveal>
        <Reveal y={24}>
          <OurTeam />
        </Reveal>
        <Reveal>
          <PhysicalBook />
        </Reveal>
        <Reveal>
          <Seminars />
        </Reveal>
        <Reveal>
          <GalleryTeaser />
        </Reveal>
        <Reveal y={24}>
          <Certification />
        </Reveal>
      </main>
      <Reveal>
        <Footer />
      </Reveal>
    </div>
  );
}