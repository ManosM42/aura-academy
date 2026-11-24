// src/routes/checkout.return.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import ChromeButton from "@/components/aura/ChromeButton";
import { useAuth } from "@/lib/useAuth";
import { useSubscription } from "@/lib/useSubscription";
import { clearCheckoutIntent } from "@/lib/checkout-intent";
import { verifyCheckoutSession } from "@/lib/verify-checkout";
import { getPlan } from "@/lib/plans";
import {
  failureMessage,
  readVivaReturnParams,
  verifyVivaPayment,
  type VivaReturnParams,
  type VivaVerifyResult,
} from "@/lib/viva-return";

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

/**
 * One return address for every payment. Viva sends customers back with its own
 * parameters (t / s / eventId): those are confirmed with Viva by the server.
 * Anything else is the original Stripe flow.
 */
function CheckoutReturnPage() {
  // The URL is only readable in the browser. Render the same neutral page on the server and on
  // the first browser render (no hydration mismatch), then pick the right view.
  const [mode, setMode] = useState<{ viva: VivaReturnParams | null } | null>(null);
  useEffect(() => {
    setMode({ viva: readVivaReturnParams(window.location.search) });
  }, []);

  if (mode === null) {
    return (
      <main className="mx-auto max-w-lg px-5 pb-24 pt-32 text-center sm:pt-40" aria-busy="true">
        <p className="text-[11px] uppercase tracking-[0.5em] text-neutral-600">ΕΠΙΒΕΒΑΙΩΣΗ</p>
      </main>
    );
  }
  return mode.viva ? <VivaReturnView params={mode.viva} /> : <StripeReturnView />;
}

function StripeReturnView() {
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

  const planLabel = getPlan(subscription?.plan_id ?? verifiedPlan)?.name ?? null;
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
            Ενεργοποιούμε την πρόσβασή σου… Κάνε refresh για είσοδο στην ακαδημία.
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

/* ------------------------------------------------------------------ */
/* Return from Viva                                                    */
/* ------------------------------------------------------------------ */

const VIVA_MAX_ATTEMPTS = 30; // ~60 s while the payment is still being confirmed
const VIVA_POLL_MS = 2000;

type VivaView =
  | { phase: "verifying" }
  | { phase: "done"; result: VivaVerifyResult }
  | { phase: "unknown" }
  | { phase: "timeout"; error: string | null };

function kindLabel(kind: string): "subscription" | "upgrade" | "seminar" | "book" | "other" {
  if (kind === "subscription_initial" || kind === "subscription_renewal") return "subscription";
  if (kind === "subscription_upgrade") return "upgrade";
  if (kind === "seminar") return "seminar";
  if (kind === "book") return "book";
  return "other";
}

function VivaReturnView({ params }: { params: VivaReturnParams }) {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { refresh } = useSubscription(session?.user.id);
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  const [view, setView] = useState<VivaView>({ phase: "verifying" });
  const [attempt, setAttempt] = useState(0);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    clearCheckoutIntent();
  }, []);

  // Ask the server (which asks Viva) until the payment is paid, failed or unknown.
  useEffect(() => {
    let cancelled = false;
    setView({ phase: "verifying" });
    setAttempt(0);

    const run = async (): Promise<void> => {
      let lastError: string | null = null;
      for (let i = 1; i <= VIVA_MAX_ATTEMPTS; i += 1) {
        if (cancelled) return;
        setAttempt(i);
        try {
          const result = await verifyVivaPayment(params);
          if (cancelled) return;
          lastError = null;
          if (result.status === "paid" || result.status === "failed") {
            if (result.status === "paid") void refreshRef.current();
            setView({ phase: "done", result });
            return;
          }
          if (result.status === "unknown") {
            setView({ phase: "unknown" });
            return;
          }
          // "pending": the payment is not final yet. Not an error: ask again.
        } catch (err) {
          if (cancelled) return;
          lastError = err instanceof Error && err.message ? err.message : "Η επιβεβαίωση της πληρωμής απέτυχε.";
        }
        await wait(VIVA_POLL_MS);
      }
      if (!cancelled) setView({ phase: "timeout", error: lastError });
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [params, retryToken]);

  const done = view.phase === "done" ? view.result : null;
  const paid = done?.status === "paid";
  const kind = done ? kindLabel(done.kind) : "other";

  // A paid subscription or upgrade: on to the dashboard.
  useEffect(() => {
    if (!paid || (kind !== "subscription" && kind !== "upgrade") || !session?.user.id) return;
    const timer = window.setTimeout(() => navigate({ to: "/dashboard", replace: true }), 2200);
    return () => window.clearTimeout(timer);
  }, [paid, kind, session?.user.id, navigate]);

  const planName = done && (kind === "subscription" || kind === "upgrade") ? getPlan(done.label)?.name ?? null : null;

  return (
    <main className="mx-auto max-w-lg px-5 pb-24 pt-32 text-center sm:pt-40">
      {paid && done ? (
        <>
          <p className="text-[11px] uppercase tracking-[0.5em] text-neutral-500">
            {kind === "subscription" ? "ΕΝΕΡΓΟΠΟΙΗΘΗΚΕ" : kind === "upgrade" ? "ΑΝΑΒΑΘΜΙΣΗ" : "ΟΛΟΚΛΗΡΩΘΗΚΕ"}
          </p>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-neutral-100">
            {kind === "subscription"
              ? "Καλώς όρισες στην AURA."
              : kind === "upgrade"
                ? "Η αναβάθμιση ολοκληρώθηκε."
                : kind === "seminar"
                  ? "Η κράτησή σου ολοκληρώθηκε."
                  : kind === "book"
                    ? "Η παραγγελία σου ολοκληρώθηκε."
                    : "Η πληρωμή ολοκληρώθηκε."}
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-neutral-400">
            {kind === "subscription" || kind === "upgrade"
              ? `Η συνδρομή σου είναι ενεργή${planName ? ` (${planName})` : ""}. ${session?.user.id ? "Σε μεταφέρουμε στο dashboard…" : "Συνδέσου για να μπεις στην ακαδημία."}`
              : kind === "seminar"
                ? `Η πληρωμή σου για «${done.label ?? "το σεμινάριο"}» επιβεβαιώθηκε. Ο διαχειριστής θα επικοινωνήσει σύντομα μαζί σου με όλες τις πληροφορίες.`
                : kind === "book"
                  ? "Η πληρωμή σου επιβεβαιώθηκε. Θα επικοινωνήσουμε μαζί σου για την αποστολή του βιβλίου."
                  : "Η πληρωμή σου επιβεβαιώθηκε."}
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            {kind === "subscription" || kind === "upgrade" ? (
              <Link to={session?.user.id ? "/dashboard" : "/login"}>
                <ChromeButton type="button">{session?.user.id ? "ΣΤΟ DASHBOARD" : "ΣΥΝΔΕΣΗ"}</ChromeButton>
              </Link>
            ) : (
              <Link to={kind === "book" ? "/book" : "/online-seminars"}>
                <ChromeButton type="button">ΠΙΣΩ</ChromeButton>
              </Link>
            )}
          </div>
        </>
      ) : done ? (
        <>
          <p className="text-[11px] uppercase tracking-[0.5em] text-neutral-600">ΔΕΝ ΟΛΟΚΛΗΡΩΘΗΚΕ</p>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-neutral-100">Η πληρωμή δεν πέρασε</h1>
          <p className="mt-4 text-sm leading-relaxed text-neutral-400" role="alert">
            {failureMessage(done.eventId)}
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link to={kind === "book" ? "/book" : kind === "seminar" ? "/online-seminars" : "/pricing"}>
              <ChromeButton type="button">ΔΟΚΙΜΑΣΕ ΞΑΝΑ</ChromeButton>
            </Link>
            <Link to="/contact">
              <ChromeButton type="button" variant="secondary">
                ΕΠΙΚΟΙΝΩΝΙΑ
              </ChromeButton>
            </Link>
          </div>
        </>
      ) : view.phase === "unknown" ? (
        <>
          <p className="text-[11px] uppercase tracking-[0.5em] text-neutral-600">ΜΗ ΕΓΚΥΡΗ ΠΛΗΡΩΜΗ</p>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-neutral-100">Δεν βρήκαμε αυτή την πληρωμή</h1>
          <p className="mt-4 text-sm leading-relaxed text-neutral-400">
            Ο σύνδεσμος δεν αντιστοιχεί σε παραγγελία μας. Αν πλήρωσες, στείλε μας μήνυμα και θα το ελέγξουμε άμεσα.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link to="/contact">
              <ChromeButton type="button">ΕΠΙΚΟΙΝΩΝΙΑ</ChromeButton>
            </Link>
          </div>
        </>
      ) : view.phase === "timeout" ? (
        <>
          <p className="text-[11px] uppercase tracking-[0.5em] text-neutral-600">ΣΕ ΕΚΚΡΕΜΟΤΗΤΑ</p>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-neutral-100">Η επιβεβαίωση καθυστερεί</h1>
          <p className="mt-4 text-sm leading-relaxed text-neutral-400">
            Η πληρωμή σου δεν έχει επιβεβαιωθεί ακόμη. Αν χρεώθηκες, θα ολοκληρωθεί αυτόματα σε λίγα λεπτά. Δοκίμασε ξανά ή στείλε μας μήνυμα.
          </p>
          {view.error ? (
            <p className="mt-4 text-sm leading-relaxed text-red-400" role="alert">
              {view.error}
            </p>
          ) : null}
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <ChromeButton type="button" onClick={() => setRetryToken((n) => n + 1)}>
              ΕΛΕΓΞΕ ΞΑΝΑ
            </ChromeButton>
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
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-neutral-100">Επιβεβαιώνουμε την πληρωμή σου…</h1>
          <div
            className="mx-auto mt-10 h-px w-56 overflow-hidden bg-white/10"
            role="progressbar"
            aria-label="Επιβεβαίωση πληρωμής"
            aria-valuemin={0}
            aria-valuemax={VIVA_MAX_ATTEMPTS}
            aria-valuenow={attempt}
          >
            <span
              className="block h-full bg-white/70 transition-all duration-500"
              style={{ width: `${Math.min(100, (attempt / VIVA_MAX_ATTEMPTS) * 100)}%` }}
            />
          </div>
        </>
      )}
    </main>
  );
}
