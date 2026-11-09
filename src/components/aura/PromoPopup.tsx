import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, X } from "lucide-react";
import forza from "@/assets/forza.jpeg";

const DELAY_MS = 10_000;
const STORAGE_KEY = "aura-promo-seen";

export default function PromoPopup() {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  const close = useCallback(() => setOpen(false), []);

  // Show once, 10 seconds after the page loads (once per browser session).
  useEffect(() => {
    try {
      if (sessionStorage.getItem(STORAGE_KEY)) return;
    } catch {
      /* storage unavailable: just show it */
    }
    const timer = window.setTimeout(() => {
      setOpen(true);
      try {
        sessionStorage.setItem(STORAGE_KEY, "1");
      } catch {
        /* ignore */
      }
    }, DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  // While open: Esc closes, page scroll is locked, focus moves into the dialog.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, close]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="promo-backdrop"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.7, ease: [0.22, 1, 0.36, 1] }}
          onClick={close}
        >
          {/* Chrome gradient border */}
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="promo-title"
            aria-describedby="promo-desc"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            initial={reduce ? false : { opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: reduce ? 0 : 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-gradient-to-br from-white/70 via-white/10 to-white/50 p-px shadow-[0_0_90px_rgba(210,218,230,0.2),0_30px_80px_rgba(0,0,0,0.7)] outline-none"
          >
            <div className="relative grid overflow-hidden rounded-[calc(1.5rem-1px)] bg-aura-bg2 md:grid-cols-[1fr_1.1fr]">
              {/* Top chrome highlight + ambient glow */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(210,218,230,0.16),transparent_65%)] blur-2xl"
              />

              {/* Image */}
              <div className="relative min-h-[15rem] md:min-h-[28rem]">
                <img
                  src={forza}
                  alt="Forza Brava hair products"
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-aura-bg2 via-transparent to-black/20 md:bg-gradient-to-r md:from-transparent md:via-transparent md:to-aura-bg2"
                />
                <div className="font-aura absolute left-4 top-4 rounded-full border border-white/30 bg-black/50 px-3.5 py-1.5 text-xs font-bold tracking-[0.2em] text-aura-white shadow-[0_0_24px_rgba(220,226,235,0.35)] backdrop-blur-md">
                  10% OFF
                </div>
              </div>

              {/* Content */}
              <div className="font-aura relative flex flex-col justify-center gap-6 p-8 text-center md:p-10 md:text-left">
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close"
                  className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full border border-white/10 text-aura-text-secondary transition-all duration-300 hover:border-white/40 hover:text-aura-white hover:shadow-[0_0_22px_rgba(220,226,235,0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                >
                  <X className="size-4" />
                </button>

                <h2
                  id="promo-title"
                  className="chrome-text text-3xl font-extrabold leading-[1.1] tracking-tight drop-shadow-[0_0_24px_rgba(220,226,235,0.3)] md:text-4xl"
                >
                  Get 10% off Forza Brava hair products
                </h2>

                <p
                  id="promo-desc"
                  className="mx-auto max-w-sm text-sm leading-relaxed text-aura-text-secondary md:mx-0"
                >
                  Included with every AURA Pro and Elite plan. Choose your plan and the discount
                  is yours.
                </p>

                <div className="flex flex-col items-center gap-3 md:items-start">
                  <Link
                    to="/pricing"
                    onClick={close}
                    className="group relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-full border border-white/40 bg-gradient-to-b from-white/95 to-white/70 px-8 py-3.5 text-sm font-bold tracking-[0.25em] text-black shadow-[0_0_34px_rgba(220,226,235,0.35)] transition-all duration-300 hover:shadow-[0_0_52px_rgba(220,226,235,0.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:w-auto"
                  >
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-white/70 opacity-0 blur-md transition-all duration-700 group-hover:left-[130%] group-hover:opacity-100"
                    />
                    <span className="relative">GET NOW</span>
                    <ArrowUpRight className="relative size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </Link>

                  <button
                    type="button"
                    onClick={close}
                    className="rounded-full px-3 py-1.5 text-xs text-aura-text-muted transition-colors duration-300 hover:text-aura-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                  >
                    No thanks
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}