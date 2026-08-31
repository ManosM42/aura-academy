import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import ChromeButton from "@/components/aura/ChromeButton";
import { useAuth } from "@/lib/useAuth";
import { useSubscription } from "@/lib/useSubscription";
import { clearCheckoutIntent } from "@/lib/checkout-intent";

const MAX_ATTEMPTS = 12; // ~24 δευτ. με 2s βήμα

export const Route = createFileRoute("/checkout/return")({
  validateSearch: (search: Record<string, unknown>) => ({
    session_id: typeof search["session_id"] === "string" ? search["session_id"] : undefined,
  }),
  head: () => ({ meta: [{ title: "AURA — Επιβεβαίωση πληρωμής" }] }),
  component: CheckoutReturnPage,
});

function CheckoutReturnPage() {
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const { subscription, hasAccess, loading, refresh } = useSubscription(session?.user.id);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    clearCheckoutIntent();
  }, []);

  // Polling όσο το webhook δεν έχει προλάβει να γράψει τη συνδρομή.
  useEffect(() => {
    if (authLoading || loading || hasAccess || attempts >= MAX_ATTEMPTS) return;
    const timer = window.setTimeout(() => {
      setAttempts((n) => n + 1);
      refresh();
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [authLoading, loading, hasAccess, attempts, refresh]);

  // Επιτυχία → dashboard.
  useEffect(() => {
    if (!hasAccess) return;
    const timer = window.setTimeout(() => navigate({ to: "/dashboard", replace: true }), 1600);
    return () => window.clearTimeout(timer);
  }, [hasAccess, navigate]);

  const timedOut = !hasAccess && attempts >= MAX_ATTEMPTS;

  return (
    <main className="mx-auto max-w-lg px-5 pb-24 pt-32 text-center sm:pt-40">
      {hasAccess ? (
        <>
          <p className="text-[11px] uppercase tracking-[0.5em] text-neutral-500">ΕΝΕΡΓΟΠΟΙΗΘΗΚΕ</p>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-neutral-100">
            Καλώς όρισες στην AURA.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-neutral-400">
            Η συνδρομή σου είναι ενεργή
            {subscription?.plan_id ? ` (${subscription.plan_id})` : ""}. Σε μεταφέρουμε στο
            dashboard…
          </p>
        </>
      ) : timedOut ? (
        <>
          <p className="text-[11px] uppercase tracking-[0.5em] text-neutral-600">ΣΕ ΕΚΚΡΕΜΟΤΗΤΑ</p>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-neutral-100">
            Η επιβεβαίωση καθυστερεί
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-neutral-400">
            Η πληρωμή μπορεί να ολοκληρώθηκε αλλά η ενεργοποίηση δεν έχει καταγραφεί ακόμη. Δοκίμασε
            ανανέωση σε λίγο — αν συνεχίσει, στείλε μας μήνυμα και το ελέγχουμε άμεσα.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <ChromeButton
              type="button"
              onClick={() => {
                setAttempts(0);
                refresh();
              }}
            >
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