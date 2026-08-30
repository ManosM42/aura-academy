import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import AuraLoader from "@/components/aura/AuraLoader";
import ChromeCursor from "@/components/aura/ChromeCursor";
import Navbar from "@/components/aura/Navbar";
import Hero from "@/components/aura/Hero";
import Method from "@/components/aura/Method";
import SkillTree from "@/components/aura/SkillTree";
import Certification from "@/components/aura/Certification";
import Footer from "@/components/aura/Footer";

const Index = () => {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduced ? 600 : 3200;
    const timer = window.setTimeout(() => setLoading(false), duration);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="relative min-h-screen bg-aura-bg text-aura-text antialiased">
      <AnimatePresence mode="wait">
        {loading && <AuraLoader key="loader" />}
      </AnimatePresence>

      <div className="aura-grain" aria-hidden />
      <ChromeCursor />

      <Navbar />
      <main>
        <Hero />
        <Method />
        <SkillTree />
        <Certification />
      </main>
      <Footer />
    </div>
  );
};

export default Index;