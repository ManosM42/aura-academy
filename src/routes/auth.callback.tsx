// src/routes/auth.callback.tsx
import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import ChromeButton from "@/components/aura/ChromeButton";
import { useAuth } from "@/hooks/useAuth";
import { consumeCheckoutIntent } from "@/lib/checkout-intent";
import { useI18n } from "@/lib/i18n";

const TIMEOUT_MS = 12000;

export const Route = createFileRoute("/auth/callback")({
  head: () => ({ meta: [{ title: "AURA — Sign in" }] }),
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const [failure, setFailure] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);

  // Τα σφάλματα OAuth έρχονται είτε στο query string είτε στο hash fragment.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const search = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const description =
      search.get("error_description") ??
      hash.get("error_description") ??
      search.get("error") ??
      hash.get("error");
    if (description) setFailure(description.replace(/\+/g, " "));
  }, []);

  // Επιτυχία: τιμάμε το checkout intent, αλλιώς dashboard.
  useEffect(() => {
    if (failure || loading || !user) return;
    const intent = consumeCheckoutIntent();
    if (intent) {
      navigate({ to: "/checkout", search: { plan: intent }, replace: true });
    } else {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [failure, loading, user, navigate]);

  // Δικλείδα: αν το session δεν έρθει ποτέ, μην αφήνεις τον χρήστη σε loader.
  useEffect(() => {
    if (failure || user) return;
    const timer = window.setTimeout(() => setTimedOut(true), TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [failure, user]);

  const blocked = failure !== null || timedOut;

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-5 py-24 text-center">
      {blocked ? (
        <>
          <p className="text-[11px] uppercase tracking-[0.5em] text-neutral-600">
            {failure ? t("auth.errorKicker") : t("auth.timeoutKicker")}
          </p>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-neutral-100 sm:text-3xl">
            {failure ? t("auth.errorTitle") : t("auth.timeoutTitle")}
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-neutral-400">
            {failure ?? t("auth.timeoutBody")}
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
            <Link to="/login">
              <ChromeButton type="button">{t("auth.backToLogin")}</ChromeButton>
            </Link>
            <Link
              to="/"
              className="px-5 py-2 text-[11px] uppercase tracking-[0.2em] text-neutral-500 transition-colors hover:text-neutral-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            >
              {t("auth.goHome")}
            </Link>
          </div>
        </>
      ) : (
        <>
          <p className="text-[11px] uppercase tracking-[0.5em] text-neutral-600">
            {t("auth.finishingKicker")}
          </p>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-neutral-100 sm:text-3xl">
            {t("auth.finishingTitle")}
          </h1>
          <div
            className="mt-10 h-px w-56 overflow-hidden bg-white/10"
            role="progressbar"
            aria-label={t("auth.finishingTitle")}
          >
            <span className="block h-full w-1/3 animate-pulse bg-white/70" />
          </div>
        </>
      )}
    </main>
  );
}