// src/routes/auth.callback.tsx
import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import ChromeButton from "@/components/aura/ChromeButton";
import { useAuth } from "@/hooks/useAuth";
import { clearCheckoutIntent, consumeCheckoutIntent } from "@/lib/checkout-intent";
import { isPlanId, type PlanId } from "@/lib/plans";
import { useI18n } from "@/lib/i18n";

const TIMEOUT_MS = 12000;

interface AuthCallbackSearch {
  plan?: PlanId;
  /** Το index signature είναι σκόπιμο: το validateSearch ΔΕΝ πρέπει να
   *  πετάξει τα ?code / ?error του Supabase, αλλιώς χάνεται το PKCE code. */
  [key: string]: unknown;
}

export const Route = createFileRoute("/auth/callback")({
  validateSearch: (search: Record<string, unknown>): AuthCallbackSearch => ({
    ...search,
    plan: isPlanId(search["plan"]) ? search["plan"] : undefined,
  }),
  head: () => ({ meta: [{ title: "AURA — Sign in" }] }),
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { plan: searchPlan } = Route.useSearch();
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

  // Επιτυχία: πρώτα το URL, μετά το αποθηκευμένο intent. Αυτό σταματά το
  // σιωπηλό fall-through στο /dashboard όταν το storage είναι άδειο.
  useEffect(() => {
    if (failure || loading || !user) return;
    const plan = searchPlan ?? consumeCheckoutIntent();
    if (searchPlan) clearCheckoutIntent(); // πέτα τυχόν παλιό leftover
    if (plan) {
      navigate({ to: "/checkout", search: { plan }, replace: true });
    } else {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [failure, loading, user, searchPlan, navigate]);

  // Δικλείδα: αν το session δεν έρθει ποτέ, μην αφήνεις τον χρήστη σε loader.
  useEffect(() => {
    if (failure || user) return;
    const timer = window.setTimeout(() => setTimedOut(true), TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [failure, user]);

  const blocked = failure !== null || timedOut;

  return (
    <main
      className="mx-auto max-w-lg px-5 pb-24 pt-32 text-center sm:pt-40"
      aria-busy={!blocked}
    >
      {blocked ? (
        <>
          <p className="text-[11px] uppercase tracking-[0.5em] text-neutral-600">
            {failure ? t("auth.errorKicker") : t("auth.timeoutKicker")}
          </p>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-neutral-100">
            {failure ? t("auth.errorTitle") : t("auth.timeoutTitle")}
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-neutral-400" role="alert">
            {failure ?? t("auth.timeoutBody")}
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link to="/login" search={searchPlan ? { plan: searchPlan } : {}}>
              <ChromeButton type="button">{t("auth.backToLogin")}</ChromeButton>
            </Link>
            <Link to="/">
              <ChromeButton type="button" variant="secondary">
                {t("auth.goHome")}
              </ChromeButton>
            </Link>
          </div>
        </>
      ) : (
        <>
          <p className="text-[11px] uppercase tracking-[0.5em] text-neutral-600">
            {t("auth.finishingKicker")}
          </p>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-neutral-100">
            {t("auth.finishingTitle")}
          </h1>
          <div
            className="mx-auto mt-8 h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-white/70 motion-reduce:animate-none"
            role="status"
            aria-label={t("auth.finishingTitle")}
          />
        </>
      )}
    </main>
  );
}