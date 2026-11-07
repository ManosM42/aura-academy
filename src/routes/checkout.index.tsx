// src/routes/checkout.index.tsx
import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import CheckoutModal from "@/components/aura/CheckoutModal";
import ChromeButton from "@/components/aura/ChromeButton";
import { useAuth } from "@/lib/useAuth";
import { useSubscription } from "@/lib/useSubscription";
import { usePlans } from "@/lib/usePlans";
import { clearCheckoutIntent, setCheckoutIntent } from "@/lib/checkout-intent";
import { isPlanId, type PlanId } from "@/lib/plans";

interface CheckoutSearch {
  plan?: PlanId;
}

export const Route = createFileRoute("/checkout/")({
  validateSearch: (search: Record<string, unknown>): CheckoutSearch => ({
    plan: isPlanId(search["plan"]) ? search["plan"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "AURA — Checkout" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const { plan: planId } = Route.useSearch();
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const userId = session?.user.id;
  const { hasAccess, loading: subLoading } = useSubscription(userId);
  // Τα πλάνα (και οι τιμές τους) έρχονται πλέον από τη βάση: ρυθμίζονται από το admin panel.
  const { plans, loading: plansLoading } = usePlans();

  // Ξεκινά ΚΛΕΙΣΤΟ. Ανοίγει μόνο όταν ξέρουμε ότι ο χρήστης είναι
  // συνδεδεμένος και δεν έχει ήδη ενεργή συνδρομή.
  const [modalOpen, setModalOpen] = useState(false);
  // Φρουρός ώστε το modal να ανοίξει αυτόματα μία φορά και να μην
  // ξανανοίγει μόνο του αφού ο χρήστης το κλείσει.
  const autoOpenedRef = useRef(false);

  const plan = plans.find((p) => p.id === planId);
  const signedIn = Boolean(session);
  // Το useSubscription δεν έχει τι να φορτώσει χωρίς userId, οπότε το
  // subLoading μετράει μόνο όταν υπάρχει session.
  const waiting = authLoading || plansLoading || (signedIn && subLoading);

  // Χωρίς έγκυρο (ή ενεργό) πακέτο δεν υπάρχει checkout.
  useEffect(() => {
    if (plansLoading) return;
    if (!plan) navigate({ to: "/pricing", replace: true });
  }, [plan, plansLoading, navigate]);

  // Ενεργή συνδρομή → καμία νέα χρέωση.
  useEffect(() => {
    if (waiting || !signedIn) return;
    if (hasAccess) {
      clearCheckoutIntent();
      navigate({ to: "/academy", replace: true });
    }
  }, [waiting, signedIn, hasAccess, navigate]);

  // Μη συνδεδεμένος επισκέπτης: fallback αν χαθεί το plan από το URL.
  // Σε effect, ΟΧΙ στο render body.
  useEffect(() => {
    if (!plan || authLoading || signedIn) return;
    setCheckoutIntent(plan.id);
  }, [plan, authLoading, signedIn]);

  // Έφτασε συνδεδεμένος: το intent έκανε τη δουλειά του.
  useEffect(() => {
    if (waiting || !signedIn || hasAccess) return;
    clearCheckoutIntent();
  }, [waiting, signedIn, hasAccess]);

  // Αυτόματο άνοιγμα του modal, μία και μόνη φορά.
  useEffect(() => {
    if (autoOpenedRef.current) return;
    if (!plan || waiting || !signedIn || hasAccess) return;
    autoOpenedRef.current = true;
    setModalOpen(true);
  }, [plan, waiting, signedIn, hasAccess]);

  if (waiting) {
    return (
      <div className="mx-auto max-w-md px-5 pt-40" aria-busy="true">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-1/3 rounded bg-white/5" />
          <div className="h-32 rounded-2xl bg-white/5" />
        </div>
      </div>
    );
  }

  if (!plan) return null;

  if (!session) {
    return (
      <div className="mx-auto max-w-lg px-5 pb-24 pt-32 text-center sm:pt-40">
        <p className="text-[11px] uppercase tracking-[0.5em] text-neutral-600">
          ΑΠΑΙΤΕΙΤΑΙ ΣΥΝΔΕΣΗ
        </p>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-neutral-100">
          Συνδέσου για να ολοκληρώσεις
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-neutral-400">
          Διάλεξες <span className="text-neutral-200">{plan.name}</span> ({plan.priceLabel}/μήνα).
          Μετά τη σύνδεση επιστρέφεις αυτόματα εδώ για την πληρωμή.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link to="/login" search={{ plan: plan.id }}>
            <ChromeButton type="button">ΣΥΝΔΕΣΗ / ΕΓΓΡΑΦΗ</ChromeButton>
          </Link>
          <Link to="/pricing">
            <ChromeButton type="button" variant="secondary">
              ΑΛΛΑΓΗ ΠΑΚΕΤΟΥ
            </ChromeButton>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-5 pb-24 pt-32 sm:pt-40">
      <p className="text-[11px] uppercase tracking-[0.5em] text-neutral-600">CHECKOUT</p>
      <h1 className="mt-5 text-3xl font-semibold tracking-tight text-neutral-100">{plan.name}</h1>
      <p className="mt-3 text-sm text-neutral-400">
        {plan.priceLabel} / μήνα — ακύρωση ανά πάσα στιγμή.
      </p>

      {!modalOpen && (
        <div className="mt-8 flex flex-wrap gap-3">
          <ChromeButton type="button" onClick={() => setModalOpen(true)}>
            ΣΥΝΕΧΕΙΑ ΣΤΗΝ ΠΛΗΡΩΜΗ
          </ChromeButton>
          <Link to="/pricing">
            <ChromeButton type="button" variant="secondary">
              ΑΛΛΑΓΗ ΠΑΚΕΤΟΥ
            </ChromeButton>
          </Link>
        </div>
      )}

      <CheckoutModal plan={plan} open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}