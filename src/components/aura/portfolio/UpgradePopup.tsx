// src/components/aura/portfolio/UpgradePopup.tsx
import { useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { Crown, X } from "lucide-react";

/** Shown to everyone who is not Elite when they open someone's portfolio. */
export default function UpgradePopup({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="pf-modal-layer" onPointerDown={onClose}>
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pf-upgrade-title"
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="pf-modal"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Κλείσιμο"
          className="pf-iconbtn absolute right-4 top-4"
          style={{ width: 34, height: 34 }}
        >
          <X className="size-4" />
        </button>

        <span className="pf-crown">
          <Crown className="size-7" />
        </span>

        <p className="pf-kicker mt-6" style={{ letterSpacing: "0.4em" }}>
          Aura Elite
        </p>
        <h2 id="pf-upgrade-title" className="pf-title mt-3 text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
          Upgrade to Elite to create your own portfolio
        </h2>
        <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-white/55">
          Τα portfolios είναι αποκλειστικό προνόμιο των μελών AURA ELITE. Δημιούργησε το δικό σου, ανέβασε τις
          δουλειές σου και δείξε τες σε όλη την κοινότητα.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <Link to="/pricing" className="pf-btn pf-btn-solid w-full py-3.5 text-[13px] tracking-[0.18em]">
            UPGRADE TO ELITE
          </Link>
          <button type="button" onClick={onClose} className="pf-btn w-full">
            Ίσως αργότερα
          </button>
        </div>
      </motion.div>
    </div>
  );
}