import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import ChromeCursor from "@/components/aura/ChromeCursor";
import Hero from "@/components/aura/Hero";
import SkillTree from "@/components/aura/SkillTree";
import PhysicalBook from "@/components/aura/PhysicalBook";
import Seminars from "@/components/aura/Seminars";
import Certification from "@/components/aura/Certification";
import Footer from "@/components/aura/Footer";
import OurTeam from "@/components/aura/OurTeam";
import GalleryTeaser from "@/components/aura/GalleryTeaser";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/")({
  head: () =>
    seo({
      path: "/",
      // Uses the default title: "AURA Academy | Professional Barber Education & Seminars"
      description:
        "Learn precision haircutting and clean fades at AURA Academy. Barber seminars led by founder Theopistos, professional education for barbers, and the AURA book.",
    }),
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
  return (
    // overflow-x-clip (not -hidden): hides sideways overflow WITHOUT turning these wrappers
    // into scroll containers, which is what makes scrolling "lock" on a section.
    // The <main> landmark lives in __root.tsx, so this is a plain div.
    <div className="relative min-h-screen w-full overflow-x-clip bg-aura-bg text-aura-text antialiased">
      <div className="aura-grain" aria-hidden />
      <ChromeCursor />

      <div className="w-full overflow-x-clip">
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
      </div>

      <Reveal>
        <Footer />
      </Reveal>
    </div>
  );
}