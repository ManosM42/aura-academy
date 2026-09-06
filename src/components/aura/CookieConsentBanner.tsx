// src/components/aura/CookieConsentBanner.tsx
import { AnimatePresence, motion } from "motion/react";
import { Link } from "@tanstack/react-router";
import { useCookieConsent } from "@/lib/cookieConsent";

export function CookieConsentBanner() {
  const { status, accept, reject } = useCookieConsent();
  const visible = status === null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "tween", duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          role="dialog"
          aria-live="polite"
          aria-label="Πολιτική Cookies"
          className="fixed inset-x-0 bottom-0 z-[60] px-4 pb-4 sm:px-6 sm:pb-6"
        >
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 rounded-2xl border border-white/15 bg-[#050505]/95 p-5 shadow-[0_0_40px_-10px_rgba(255,255,255,0.12)] backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="max-w-xl">
              <p className="text-[10px] font-extralight uppercase tracking-[0.35em] text-neutral-400">
                Cookies
              </p>
              <p className="mt-2 text-sm font-extralight leading-relaxed text-neutral-200">
                Χρησιμοποιούμε cookies για τη σωστή λειτουργία της πλατφόρμας (σύνδεση χρήστη,
                προτίμηση γλώσσας) και, εφόσον το επιτρέψετε, για στατιστικά χρήσης. Δείτε την{" "}
                <Link
                  to="/cookie-policy"
                  className="underline decoration-white/30 underline-offset-2 transition-colors hover:text-white"
                >
                  πολιτική cookies
                </Link>
                .
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              <button
                type="button"
                onClick={reject}
                className="rounded-full border border-white/20 px-5 py-2.5 text-[10px] font-extralight uppercase tracking-[0.3em] text-neutral-300 transition-all duration-300 hover:border-white/45 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
              >
                Απόρριψη
              </button>
              <button
                type="button"
                onClick={accept}
                className="rounded-full border border-white/20 bg-neutral-100 px-5 py-2.5 text-[10px] font-medium uppercase tracking-[0.3em] text-black transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_24px_-8px_rgba(255,255,255,0.5)] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
              >
                Αποδοχή
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}