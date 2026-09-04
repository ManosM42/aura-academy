import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AnimatePresence } from "motion/react";
import AuraLoader from "@/components/aura/AuraLoader";
import ChromeCursor from "@/components/aura/ChromeCursor";
import Hero from "@/components/aura/Hero";
import Method from "@/components/aura/Method";
import SkillTree from "@/components/aura/SkillTree";
import Certification from "@/components/aura/Certification";
import Footer from "@/components/aura/Footer";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const [loading, setLoading] = useState(true);

  return (
    <div className="relative min-h-screen w-full bg-aura-bg text-aura-text antialiased overflow-x-hidden">
      <AnimatePresence mode="wait">
        {loading && (
          <AuraLoader key="loader" onComplete={() => setLoading(false)} />
        )}
      </AnimatePresence>

      <div className="aura-grain" aria-hidden />
      <ChromeCursor />

      <main className="w-full overflow-x-hidden">
        <Hero />
        <Method />
        <SkillTree />
        <Certification />
      </main>
      <Footer />
    </div>
  );
}