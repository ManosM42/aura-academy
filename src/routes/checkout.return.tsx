// src/routes/checkout.return.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import ChromeButton from "@/components/aura/ChromeButton";
import { useAuth } from "@/lib/useAuth";
import { useSubscription } from "@/lib/useSubscription";
import { clearCheckoutIntent } from "@/lib/checkout-intent";
import { verifyCheckoutSession } from "@/lib/verify-checkout";

const MAX_ATTEMPTS = 12; // ~18 δευτ. με 1.5s βήμα στον άμεσο έλεγχο
const VERIFY_DELAY_MS = 1500;
const POLL_DELAY_MS = 2000; // fallback χωρίς session_id

interface CheckoutReturnSearch {
  session_id?: string;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export const Route = createFileRoute("/checkout/return")({
  validateSearch: (search: Record<string, unknown>): CheckoutReturnSearch => ({
    session_id:
      typeof search["session_id"] === "string" && search["session_id"].length > 0
        ? search["session_id"]
        : undefined,
  }),
  head: () => ({ meta: [{ title: "AURA — Επιβεβαίωση πληρωμής" }] }),
  component: CheckoutReturnPage,
});

function CheckoutReturnPage() {
  const navigate = useNavigate();
  const { session_id: sessionId } = Route.useSearch();
  const { session, loading: authLoading } = useAuth();
  const { subscription, hasAccess, loading, refresh } = useSubscription(session?.user.id);

  const [attempts, setAttempts] = useState(0);
  const [verified, setVerified] = useState(false);
  const [verifiedPlan, setVerifiedPlan] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [exhausted, setExhausted] = useState(false);
  const [retryToken, setRetryToken] = useState(0);

  // Το refresh μπορεί να μην είναι memoized στο useSubscription. Το κρατάμε
  // σε ref ώστε μια νέα ταυτότητα συνάρτησης να μην ξεκινά ξανά τον βρόχο.
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  // Εγγύηση ότι ο άμεσος έλεγχος τρέχει μία φορά ανά session_id + retry.
  const startedRef = useRef<string | null>(null);

  useEffect(() => {
    clearCheckoutIntent();
  }, []);

  // ── 1. Άμεση επιβεβαίωση από το Stripe (η κύρια διαδρομή) ────────────
  useEffect(() => {
    if (authLoading || !session?.user.id || !sessionId || verified) return;

    const runKey = `${sessionId}:${retryToken}`;
    if (startedRef.current === runKey) return;
    startedRef.current = runKey;

    let cancelled = false;

    const run = async (): Promise<void> => {
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        if (cancelled) return;
        setAttempts(attempt);

        try {
          const result = await verifyCheckoutSession(sessionId);
          if (cancelled) return;

          if (result.hasAccess) {
            setVerifiedPlan(result.subscription?.planId ?? null);
            setVerifyError(null);
            setVerified(true);
            // Συγχρονίζουμε και το hook, ώστε dashboard/profile
            // να δουν αμέσως την ενεργή συνδρομή.
            void refreshRef.current();
            return;
          }

          // state === "pending": η πληρωμή δεν έχει κλείσει ακόμη
          // στο Stripe. Δεν είναι σφάλμα, ξαναδοκιμάζουμε.
          setVerifyError(null);
        } catch (err) {
          if (cancelled) return;
          setVerifyError(
            err instanceof Error && err.message
              ? err.message
              : "Η επιβεβαίωση της πληρωμής απέτυχε.",
          );
        }

        if (attempt < MAX_ATTEMPTS) await wait(VERIFY_DELAY_MS);
      }

      if (!cancelled) setExhausted(true);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [authLoading, session?.user.id, sessionId, verified, retryToken]);

  // ── 2. Fallback polling όταν λείπει το session_id από το URL ──────────
  useEffect(() => {
    if (sessionId) return;
    if (authLoading || loading || hasAccess || attempts >= MAX_ATTEMPTS) return;

    const timer = window.setTimeout(() => {
      setAttempts((n) => n + 1);
      void refreshRef.current();
    }, POLL_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [sessionId, authLoading, loading, hasAccess, attempts]);

  const activated = hasAccess || verified;

  // ── 3. Επιτυχία → dashboard ───────────────────────────────────────────
  useEffect(() => {
    if (!activated) return;
    const timer = window.setTimeout(
      () => navigate({ to: "/dashboard", replace: true }),
      1600,
    );
    return () => window.clearTimeout(timer);
  }, [activated, navigate]);

  const handleRetry = useCallback(() => {
    setAttempts(0);
    setExhausted(false);
    setVerifyError(null);
    setRetryToken((t) => t + 1); // ξεκινά νέο κύκλο επιβεβαίωσης
    void refreshRef.current();
  }, []);

  const planLabel = subscription?.plan_id ?? verifiedPlan;
  const noSession = !authLoading && !session?.user.id;
  const timedOut =
    !activated &&
    (noSession || exhausted || (!sessionId && attempts >= MAX_ATTEMPTS));

  return (
    <main className="mx-auto max-w-lg px-5 pb-24 pt-32 text-center sm:pt-40">
      {activated ? (
        <>
          <p className="text-[11px] uppercase tracking-[0.5em] text-neutral-500">ΕΝΕΡΓΟΠΟΙΗΘΗΚΕ</p>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-neutral-100">
            Καλώς όρισες στην AURA.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-neutral-400">
            Η συνδρομή σου είναι ενεργή
            {planLabel ? ` (${planLabel})` : ""}. Σε μεταφέρουμε στο dashboard…
          </p>
        </>
      ) : timedOut ? (
        <>
          <p className="text-[11px] uppercase tracking-[0.5em] text-neutral-600">ΣΕ ΕΚΚΡΕΜΟΤΗΤΑ</p>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-neutral-100">
            {noSession ? "Χρειάζεται σύνδεση" : "Η επιβεβαίωση καθυστερεί"}
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-neutral-400">
            {noSession
              ? "Για να ενεργοποιηθεί η συνδρομή πρέπει να είσαι συνδεδεμένος με τον λογαριασμό που έκανε την πληρωμή."
              : "Η πληρωμή μπορεί να ολοκληρώθηκε αλλά η ενεργοποίηση δεν έχει καταγραφεί ακόμη. Δοκίμασε ανανέωση σε λίγο — αν συνεχίσει, στείλε μας μήνυμα και το ελέγχουμε άμεσα."}
          </p>
          {verifyError ? (
            <p className="mt-4 text-sm leading-relaxed text-red-400" role="alert">
              {verifyError}
            </p>
          ) : null}
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            {noSession ? (
              <Link to="/login">
                <ChromeButton type="button">ΣΥΝΔΕΣΗ</ChromeButton>
              </Link>
            ) : (
              <ChromeButton type="button" onClick={handleRetry}>
                ΕΛΕΓΞΕ ΞΑΝΑ
              </ChromeButton>
            )}
            <Link to="/contact">
              <ChromeButton type="button" variant="secondary">
                ΕΠΙΚΟΙΝΩΝΙΑ
              </ChromeButton>
            </Link>
          </div>
        </>
      ) : (
        <>
          <p className="text-[11px] uppercase tracking-[0.5em] text-neutral-600">ΕΠΙΒΕΒΑΙΩΣΗ</p>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-neutral-100">
            Ενεργοποιούμε την πρόσβασή σου…
          </h1>
          <div
            className="mx-auto mt-10 h-px w-56 overflow-hidden bg-white/10"
            role="progressbar"
            aria-label="Επιβεβαίωση πληρωμής"
            aria-valuemin={0}
            aria-valuemax={MAX_ATTEMPTS}
            aria-valuenow={attempts}
          >
            <span
              className="block h-full bg-white/70 transition-all duration-500"
              style={{ width: `${Math.min(100, (attempts / MAX_ATTEMPTS) * 100)}%` }}
            />
          </div>
        </>
      )}
    </main>
  );
}