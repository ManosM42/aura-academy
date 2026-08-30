import { motion, useReducedMotion } from "framer-motion";

/**
 * Cinematic AURA loading sequence:
 * black -> faint light -> chrome emblem emerges -> thin silver ring draws -> wordmark.
 * Swap the <span> emblem for your real chrome logo <img> when ready.
 */
export default function AuraLoader() {
  const reduced = useReducedMotion();

  return (
    <motion.div
      key="aura-loader"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-aura-bg"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, filter: "blur(6px)" }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* faint ambient light */}
      <motion.div
        aria-hidden
        className="absolute h-[420px] w-[420px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(255,255,255,0.06), transparent 65%)",
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: reduced ? 0.4 : [0, 0.9, 0.5] }}
        transition={{ duration: 2.2, ease: "easeInOut" }}
      />

      {/* thin silver ring drawing around emblem */}
      <svg
        className="absolute h-[220px] w-[220px] -rotate-90"
        viewBox="0 0 220 220"
        aria-hidden
      >
        <motion.circle
          cx="110"
          cy="110"
          r="104"
          fill="none"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="1"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: reduced ? 0.4 : 2, ease: "easeInOut", delay: 0.3 }}
        />
      </svg>

      {/* chrome emblem */}
      <motion.span
        className="chrome-text font-aura select-none text-6xl font-extrabold tracking-tight"
        style={{
          backgroundSize: "200% auto",
        }}
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.4, ease: "easeOut", delay: 0.5 }}
      >
        A
      </motion.span>

      {/* wordmark */}
      <motion.span
        className="chrome-text font-aura mt-6 text-sm font-semibold uppercase tracking-[0.55em]"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: "easeOut", delay: 1.4 }}
      >
        Aura
      </motion.span>
    </motion.div>
  );
}