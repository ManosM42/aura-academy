// src/components/aura/ProgressChrome.tsx
import { motion, useReducedMotion } from "motion/react";

interface ProgressChromeProps {
  value: number; // 0 - 100
  label?: string;
  verified?: boolean;
}

/**
 * Progress rail per the AURA brief:
 * gunmetal (0%) -> silver (50%) -> bright chrome/white (100%).
 * Verified state adds a refined silver-white glow (never green).
 */
export default function ProgressChrome({
  value,
  label,
  verified = false,
}: ProgressChromeProps) {
  const reduced = useReducedMotion();
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div className="w-full">
      {(label || true) && (
        <div className="mb-3 flex items-baseline justify-between">
          <span className="font-aura text-[0.7rem] uppercase tracking-[0.24em] text-aura-text-muted">
            {label ?? "Mastery"}
          </span>
          <span
            className={`font-aura text-sm tabular-nums ${
              verified ? "chrome-text font-semibold" : "text-aura-text-secondary"
            }`}
          >
            {verified ? "Verified" : `${Math.round(clamped)}%`}
          </span>
        </div>
      )}

      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-aura-gunmetal/60">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            background:
              "linear-gradient(90deg, #6e7073 0%, #bfc0c2 55%, #ffffff 100%)",
            boxShadow: verified
              ? "0 0 16px 1px rgba(255,255,255,0.45)"
              : "0 0 10px -2px rgba(255,255,255,0.25)",
          }}
          initial={{ width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={{ duration: reduced ? 0 : 1, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  );
}