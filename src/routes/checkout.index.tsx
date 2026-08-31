import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import CheckoutModal from "@/components/aura/CheckoutModal";
import ChromeButton from "@/components/aura/ChromeButton";
import { useAuth } from "@/lib/useAuth";
import { useSubscription } from "@/lib/useSubscription";
import { setCheckoutIntent } from "@/lib/checkout-intent";
import { getPlan, isPlanId, type PlanId } from "@/lib/plans";

interface CheckoutSearch {
  plan?: PlanId;
}

export const Route = createFileRoute("/checkout/")({
  validateSearch: (search: Record<string, unknown>): CheckoutSearch => ({
    plan: isPlanId(search["plan"]) ? search["plan"] : undefined,
  }),
  head: () => ({ meta: [{ title: "AURA — Checkout" }] }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const { plan: planId } = Route.useSearch();
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const { hasAccess, loading: subLoading } = useSubscription(session?.user.id);
  const [modalOpen, setModalOpen] = useState(true);

  const plan = getPlan(planId);

  // Χωρίς έγκυρο πακέτο δεν υπάρχει checkout.
  useEffect(() => {
    if (!plan) navigate({ to: "/pricing", replace: true });
  }, [plan, navigate]);

  // Αν υπάρχει ήδη ενεργή συνδρομή, μην ξαναχρεώνεις.
  useEffect(() => {
    if (!subLoading && hasAccess) navigate({ to: "/academy", replace: true });
  }, [hasAccess, subLoading, navigate]);

  if (!plan) return null;

  if (authLoading || subLoading) {
    return (
      <main className="mx-auto max-w-md px-5 pt-40" aria-busy="true">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-1/3 rounded bg-white/5" />
          <div className="h-32 rounded-2xl bg-white/5" />
        </div>
      </main>
    );
  }

  if (!session) {
    setCheckoutIntent(plan.id);
    return (
      <main className="mx-auto max-w-lg px-5 pb-24 pt-32 text-center sm:pt-40">
        <p className="text-[11px] uppercase tracking-[0.5em] text-neutral-600">ΑΠΑΙΤΕΙΤΑΙ ΣΥΝΔΕΣΗ</p>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-neutral-100">
          Συνδέσου για να ολοκληρώσεις
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-neutral-400">
          Διάλεξες <span className="text-neutral-200">{plan.name}</span> ({plan.priceLabel}/μήνα).
          Μετά τη σύνδεση επιστρέφεις αυτόματα εδώ για την πληρωμή.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link to="/login">
            <ChromeButton type="button">ΣΥΝΔΕΣΗ / ΕΓΓΡΑΦΗ</ChromeButton>
          </Link>
          <Link to="/pricing">
            <ChromeButton type="button" variant="secondary">
              ΑΛΛΑΓΗ ΠΑΚΕΤΟΥ
            </ChromeButton>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-5 pb-24 pt-32 sm:pt-40">
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
    </main>
  );
}