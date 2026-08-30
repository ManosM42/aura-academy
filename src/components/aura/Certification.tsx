import { motion, useReducedMotion } from "motion/react";
import ChromeButton from "./ChromeButton";

export default function Certification() {
  return (
    <section id="certification" className="relative mx-auto max-w-6xl px-6 py-32">
      <div className="grid items-center gap-12 md:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="font-aura text-xs uppercase tracking-[0.5em] text-aura-text-muted">
            Prestige, Verified
          </span>
          <h2 className="chrome-text font-aura mt-4 text-4xl font-extrabold tracking-tight md:text-5xl">
            CERTIFICATION.
          </h2>
          <p className="font-aura mt-6 max-w-md text-sm leading-relaxed text-aura-text-secondary">
            Every credential is issued with a unique, officially traceable
            verification ID — a mark of mastery built to the standard of luxury
            credentials, not participation certificates.
          </p>
          <div className="mt-8">
            <ChromeButton>Claim Your Credential</ChromeButton>
          </div>
        </motion.div>

        {/* certificate card */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          className="group relative overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-b from-aura-elevated to-aura-surface p-10 shadow-[0_0_60px_-30px_rgba(255,255,255,0.25)]"
        >
          <div className="chrome-line absolute left-8 right-8 top-0 h-px" />
          <span className="chrome-text font-aura text-lg font-extrabold uppercase tracking-[0.4em]">
            Aura
          </span>
          <p className="font-aura mt-8 text-xs uppercase tracking-[0.3em] text-aura-text-muted">
            Certificate of Mastery
          </p>
          <h3 className="font-aura mt-3 text-2xl font-bold text-aura-text">
            Advanced Fade Technique
          </h3>
          <p className="font-aura mt-2 text-sm text-aura-text-secondary">
            Awarded for demonstrated, verified precision.
          </p>

          <div className="mt-10 flex items-end justify-between">
            <div>
              <p className="font-aura text-[10px] uppercase tracking-widest text-aura-text-muted">
                Verification ID
              </p>
              <p className="font-aura mt-1 font-mono text-sm text-aura-text">
                AURA-7F3C-9K21-B084
              </p>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/40 shadow-[0_0_20px_-4px_rgba(255,255,255,0.4)]">
              <span className="chrome-text font-aura text-xl font-bold">A</span>
            </div>
          </div>

          <div className="chrome-line absolute bottom-0 left-8 right-8 h-px" />
        </motion.div>
      </div>
    </section>
  );
}