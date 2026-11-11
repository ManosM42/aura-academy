// src/components/aura/promo/PopupShell.tsx
// Backdrop, focus, Esc, scroll-lock and the close button. The card itself is
// drawn by each pop-up, so every page gets its own look.
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import { EASE } from "@/components/aura/chrome";

export default function PopupShell({
  open,
  onClose,
  titleId,
  descId,
  closeLabel = "Close",
  className = "max-w-lg",
  children,
}: {
  open: boolean;
  onClose: () => void;
  titleId: string;
  descId: string;
  closeLabel?: string;
  className?: string;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="guest-promo-backdrop"
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.5 }}
          onClick={onClose}
        >
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descId}
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 32, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.97 }}
            transition={{ duration: reduce ? 0 : 0.75, ease: EASE }}
            className={`relative my-auto w-full outline-none ${className}`}
          >
            {children}
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              className="absolute right-4 top-4 z-30 flex size-9 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white/70 outline-none backdrop-blur transition-all hover:border-white/60 hover:text-white hover:shadow-[0_0_22px_rgba(255,255,255,0.3)] focus-visible:ring-2 focus-visible:ring-white/70"
            >
              <X className="size-4" />
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
