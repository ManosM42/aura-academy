// src/components/aura/SubscriptionCard.tsx
import { Link } from "@tanstack/react-router";
import { getPlan } from "@/lib/plans";
import { isActiveStatus, useSubscription } from "@/lib/useSubscription";

/** Stripe status -> ελληνική ετικέτα. */
const STATUS_LABELS: Record<string, string> = {
  active: "ΕΝΕΡΓΗ",
  trialing: "ΔΟΚΙΜΑΣΤΙΚΗ",
  past_due: "ΕΚΚΡΕΜΗΣ ΠΛΗΡΩΜΗ",
  unpaid: "ΑΠΛΗΡΩΤΗ",
  canceled: "ΑΚΥΡΩΜΕΝΗ",
  incomplete: "ΗΜΙΤΕΛΗΣ",
  incomplete_expired: "ΕΛΗΞΕ",
  paused: "ΣΕ ΠΑΥΣΗ",
};

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  // Renders μόνο μετά το client-side fetch, άρα δεν υπάρχει SSR mismatch.
  return new Intl.DateTimeFormat("el-GR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

interface SubscriptionCardProps {
  userId: string | undefined;
}

export default function SubscriptionCard({ userId }: SubscriptionCardProps) {
  const { subscription, loading, error } = useSubscription(userId, {
    includeInactive: true,
  });

  const shell = "mt-8 rounded-2xl border border-white/10 bg-black/40 p-5 sm:p-6";
  const cta =
    "mt-4 inline-flex rounded-lg border border-white/15 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40";

  if (loading) {
    return (
      <section className={shell} aria-busy="true" aria-label="Συνδρομή">
        <div className="animate-pulse space-y-3">
          <div className="h-3 w-24 rounded bg-white/10" />
          <div className="h-6 w-48 rounded bg-white/10" />
          <div className="h-3 w-32 rounded bg-white/5" />
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className={shell} aria-label="Συνδρομή">
        <p className="text-[11px] uppercase tracking-[0.4em] text-white/40">ΣΥΝΔΡΟΜΗ</p>
        <p className="mt-3 text-sm text-white/70" role="alert">
          Δεν μπορέσαμε να φορτώσουμε τη συνδρομή σου. {error}
        </p>
      </section>
    );
  }

  if (!subscription) {
    return (
      <section className={shell} aria-label="Συνδρομή">
        <p className="text-[11px] uppercase tracking-[0.4em] text-white/40">ΣΥΝΔΡΟΜΗ</p>
        <h2 className="mt-3 text-lg font-medium text-white/90">Δεν έχεις ενεργό πακέτο</h2>
        <p className="mt-2 text-sm text-white/60">
          Διάλεξε μέθοδο για να ξεκλειδώσεις την Academy.
        </p>
        <Link to="/pricing" className={cta}>
          ΔΕΣ ΤΑ ΠΑΚΕΤΑ
        </Link>
      </section>
    );
  }

  const plan = getPlan(subscription.plan_id);
  const active = isActiveStatus(subscription.status);
  const statusLabel = STATUS_LABELS[subscription.status] ?? subscription.status.toUpperCase();
  const periodEnd = formatDate(subscription.current_period_end);

  return (
    <section className={shell} aria-label="Συνδρομή">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.4em] text-white/40">ΤΟ ΠΑΚΕΤΟ ΜΟΥ</p>
          <h2 className="mt-2 truncate text-xl font-semibold tracking-tight text-white">
            {plan?.name ?? subscription.plan_id}
          </h2>
          {plan && (
            <p className="mt-1 text-sm text-white/60">
              {plan.priceLabel} / μήνα · {plan.haircuts} κουρέματα
            </p>
          )}
        </div>

        <span
          className={
            active
              ? "shrink-0 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-white"
              : "shrink-0 rounded-full border border-white/15 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-white/50"
          }
        >
          {statusLabel}
        </span>
      </div>

      <dl className="mt-5 grid gap-4 sm:grid-cols-2">
        {periodEnd && (
          <div>
            <dt className="text-xs uppercase tracking-[0.2em] text-white/40">
              {subscription.cancel_at_period_end ? "ΛΗΓΕΙ" : "ΑΝΑΝΕΩΝΕΤΑΙ"}
            </dt>
            <dd className="mt-1 text-sm text-white/80">{periodEnd}</dd>
          </div>
        )}
        <div>
          <dt className="text-xs uppercase tracking-[0.2em] text-white/40">ΕΝΑΡΞΗ</dt>
          <dd className="mt-1 text-sm text-white/80">
            {formatDate(subscription.created_at) ?? "—"}
          </dd>
        </div>
      </dl>

      {subscription.cancel_at_period_end && (
        <p className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/70">
          Η συνδρομή έχει προγραμματιστεί για ακύρωση. Διατηρείς πρόσβαση μέχρι τη λήξη της
          τρέχουσας περιόδου.
        </p>
      )}

      {plan && plan.features.length > 0 && (
        <ul className="mt-5 flex flex-wrap gap-2">
          {plan.features.map((feature) => (
            <li
              key={feature}
              className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.15em] text-white/55"
            >
              {feature}
            </li>
          ))}
        </ul>
      )}

      {!active && (
        <Link to="/pricing" className={cta}>
          ΕΠΑΝΕΝΕΡΓΟΠΟΙΗΣΗ
        </Link>
      )}
    </section>
  );
}