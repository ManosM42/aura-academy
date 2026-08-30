import { useEffect, useRef, useState, type MouseEvent } from "react";
import { ArrowDown, ArrowRight, Check, LockKeyhole, Menu, Scissors, X } from "lucide-react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";

import heroImage from "@/assets/aura-hero.jpg";
import toolsImage from "@/assets/aura-tools.jpg";
import { Button } from "@/components/ui/button";

function AuraMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-3" aria-label="AURA">
      <span className={compact ? "aura-mark aura-mark-sm" : "aura-mark"} aria-hidden="true">
        <span />
      </span>
      <span className={compact ? "chrome-type text-base font-semibold" : "chrome-type text-2xl font-semibold"}>
        AURA
      </span>
    </span>
  );
}

function Intro({ onComplete }: { onComplete: () => void }) {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const seen = window.sessionStorage.getItem("aura-intro-seen");
    if (seen || reduceMotion) {
      onComplete();
      return;
    }
    const timer = window.setTimeout(() => {
      window.sessionStorage.setItem("aura-intro-seen", "true");
      onComplete();
    }, 3100);
    return () => window.clearTimeout(timer);
  }, [onComplete, reduceMotion]);

  return (
    <motion.div
      className="intro fixed inset-0 z-[100] grid place-items-center bg-background"
      exit={{ opacity: 0, transition: { duration: 0.7, ease: "easeInOut" } }}
    >
      <div className="intro-glow" />
      <div className="relative flex flex-col items-center">
        <div className="intro-ring" />
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <AuraMark />
        </motion.div>
        <motion.p
          className="mt-12 text-[0.58rem] font-medium uppercase tracking-[0.42em] text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.65, duration: 0.8 }}
        >
          Precision in practice
        </motion.p>
      </div>
    </motion.div>
  );
}

function ChromeField({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const handleMove = (event: MouseEvent<HTMLDivElement>) => {
    const bounds = ref.current?.getBoundingClientRect();
    if (!bounds || !ref.current) return;
    ref.current.style.setProperty("--light-x", `${event.clientX - bounds.left}px`);
    ref.current.style.setProperty("--light-y", `${event.clientY - bounds.top}px`);
  };

  return (
    <div ref={ref} onMouseMove={handleMove} className={`chrome-field ${className}`}>
      {children}
    </div>
  );
}

const steps = [
  { n: "01", title: "LEARN.", text: "Technique distilled by working masters. Every movement, angle and decision made clear." },
  { n: "02", title: "PRACTICE.", text: "Purpose-built drills turn knowledge into repeatable, professional precision." },
  { n: "03", title: "PROVE.", text: "Submit your craft, receive expert assessment and earn credentials that carry weight." },
];

const skillNodes = [
  { label: "Foundation", state: "verified", x: "8%", y: "58%" },
  { label: "Control", state: "verified", x: "30%", y: "31%" },
  { label: "Shape", state: "active", x: "52%", y: "58%" },
  { label: "Texture", state: "locked", x: "74%", y: "29%" },
  { label: "Mastery", state: "locked", x: "91%", y: "58%" },
];

export function AuraHome() {
  const [intro, setIntro] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const imageY = useTransform(scrollYProgress, [0, 0.35], [0, reduceMotion ? 0 : 90]);
  const textY = useTransform(scrollYProgress, [0, 0.35], [0, reduceMotion ? 0 : 42]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <main className="overflow-clip bg-background text-foreground selection:bg-foreground selection:text-background">
      {intro && <Intro onComplete={() => setIntro(false)} />}

      <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${scrolled ? "nav-scrolled" : ""}`}>
        <nav className="mx-auto flex h-20 max-w-[1440px] items-center justify-between px-5 md:px-10" aria-label="Main navigation">
          <a href="#top" className="focus-ring"><AuraMark compact /></a>
          <div className="hidden items-center gap-9 md:flex">
            <a href="#method" className="nav-link">Method</a>
            <a href="#skill-tree" className="nav-link">Skill tree</a>
            <a href="#certification" className="nav-link">Certification</a>
          </div>
          <div className="hidden md:block">
            <Button variant="chrome" size="lg" asChild><a href="#start">Start learning <ArrowRight /></a></Button>
          </div>
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMenuOpen((v) => !v)} aria-label="Toggle navigation">
            {menuOpen ? <X /> : <Menu />}
          </Button>
        </nav>
        {menuOpen && (
          <div className="border-t border-border bg-background/95 px-5 py-6 backdrop-blur-xl md:hidden">
            <div className="flex flex-col gap-5 text-sm uppercase tracking-[0.16em]">
              <a href="#method" onClick={() => setMenuOpen(false)}>Method</a>
              <a href="#skill-tree" onClick={() => setMenuOpen(false)}>Skill tree</a>
              <a href="#certification" onClick={() => setMenuOpen(false)}>Certification</a>
            </div>
          </div>
        )}
      </header>

      <section id="top" className="hero relative min-h-[92svh] overflow-hidden border-b border-subtle">
        <motion.div className="absolute inset-0 md:left-[30%]" style={{ y: imageY }}>
          <img src={heroImage} alt="A master barber executing a precision scissor cut" width={1920} height={1280} className="h-full w-full object-cover object-[64%_center] opacity-70" />
          <div className="hero-image-fade absolute inset-0" />
        </motion.div>
        <div className="hero-atmosphere absolute inset-0" />
        <motion.div className="relative z-10 mx-auto flex min-h-[92svh] max-w-[1440px] flex-col justify-end px-5 pb-16 pt-32 md:px-10 md:pb-20" style={{ y: textY }}>
          <p className="mb-6 flex items-center gap-4 text-[0.63rem] font-semibold uppercase tracking-[0.3em] text-secondary-foreground">
            <span className="h-px w-10 bg-chrome-mid" /> The modern barber's academy
          </p>
          <h1 className="max-w-5xl text-[clamp(3.4rem,9vw,8.8rem)] font-semibold uppercase leading-[0.82]">
            Master<br /><span className="chrome-type">the craft.</span>
          </h1>
          <div className="mt-9 flex max-w-3xl flex-col gap-8 border-t border-border pt-7 md:flex-row md:items-center md:justify-between">
            <p className="max-w-md text-sm leading-7 text-secondary-foreground md:text-base">
              The operating system for barbers who refuse ordinary. Learn with intent. Practice with precision. Prove your standard.
            </p>
            <Button variant="chrome" size="xl" asChild><a href="#method">Enter the academy <ArrowDown /></a></Button>
          </div>
        </motion.div>
        <div className="absolute bottom-0 right-8 hidden text-[0.58rem] uppercase tracking-[0.28em] text-muted-foreground md:block">AURA / 001</div>
      </section>

      <section id="method" className="section-shell border-b border-subtle">
        <div className="section-heading">
          <p className="eyebrow">The AURA method</p>
          <h2>LEARN.<br />PRACTICE.<br /><span className="chrome-type">PROVE.</span></h2>
        </div>
        <div className="mt-20 grid border-t border-border md:grid-cols-3">
          {steps.map((step) => (
            <ChromeField key={step.n} className="method-step group">
              <span className="font-mono text-[0.62rem] text-muted-foreground">/{step.n}</span>
              <h3 className="mt-24 text-2xl font-semibold">{step.title}</h3>
              <p className="mt-4 max-w-xs text-sm leading-7 text-secondary-foreground">{step.text}</p>
              <ArrowRight className="mt-10 size-4 text-chrome-mid transition-transform duration-300 group-hover:translate-x-2" />
            </ChromeField>
          ))}
        </div>
      </section>

      <section id="skill-tree" className="section-shell grid items-center gap-16 border-b border-subtle lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="eyebrow">Measured progression</p>
          <h2 className="section-title">YOUR CRAFT.<br /><span className="chrome-type">MAPPED.</span></h2>
          <p className="mt-8 max-w-md text-base leading-8 text-secondary-foreground">
            A professional competency system that makes every strength visible and every next step deliberate.
          </p>
        </div>
        <ChromeField className="skill-map" aria-label="AURA professional skill progression">
          <div className="skill-line" />
          {skillNodes.map((node) => (
            <div key={node.label} className={`skill-node skill-node-${node.state}`} style={{ left: node.x, top: node.y }}>
              <span className="skill-dot">
                {node.state === "verified" ? <Check /> : node.state === "locked" ? <LockKeyhole /> : <Scissors />}
              </span>
              <span className="skill-label">{node.label}</span>
              {node.state === "verified" && <span className="skill-state">Verified</span>}
            </div>
          ))}
        </ChromeField>
      </section>

      <section id="certification" className="section-shell border-b border-subtle">
        <div className="grid items-center gap-14 lg:grid-cols-[1fr_1fr]">
          <div className="relative overflow-hidden">
            <img src={toolsImage} alt="Polished professional barber tools arranged on a black surface" width={1600} height={1072} loading="lazy" className="aspect-[4/3] w-full object-cover grayscale transition-transform duration-700 hover:scale-[1.025]" />
            <div className="image-vignette absolute inset-0" />
          </div>
          <div className="lg:pl-12">
            <p className="eyebrow">A standard recognized</p>
            <h2 className="section-title">PROOF HAS<br /><span className="chrome-type">A PRESENCE.</span></h2>
            <p className="mt-7 max-w-lg text-base leading-8 text-secondary-foreground">
              AURA certification is a precise record of demonstrated skill—not attendance. Built to be checked, trusted and carried forward.
            </p>
            <div className="certificate-strip mt-10">
              <AuraMark compact />
              <div className="h-10 w-px bg-border" />
              <div><p className="text-[0.58rem] uppercase tracking-[0.22em] text-muted-foreground">Credential ID</p><p className="mt-1 font-mono text-xs text-foreground">AURA—MASTER—0001</p></div>
              <div className="ml-auto hidden size-8 items-center justify-center rounded-full border border-chrome-mid text-chrome-light sm:flex"><Check className="size-3" /></div>
            </div>
          </div>
        </div>
      </section>

      <section id="start" className="relative px-5 py-28 text-center md:px-10 md:py-44">
        <div className="cta-light absolute inset-0" />
        <div className="relative mx-auto max-w-5xl">
          <p className="eyebrow justify-center">Begin with intent</p>
          <h2 className="mt-8 text-[clamp(3rem,7vw,7rem)] font-semibold uppercase leading-[0.88]">Set a higher<br /><span className="chrome-type">standard.</span></h2>
          <Button variant="chrome" size="xl" className="mt-12" asChild><a href="mailto:academy@aura.barber">Start learning <ArrowRight /></a></Button>
        </div>
      </section>

      <footer className="border-t border-border px-5 py-8 md:px-10">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-5 text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <AuraMark compact />
          <p>Precision. Practice. Proof.</p>
          <p>© 2026 AURA Academy</p>
        </div>
      </footer>
    </main>
  );
}