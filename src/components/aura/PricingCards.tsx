import { useNavigate } from "@tanstack/react-router";
import ChromeButton from "@/components/aura/ChromeButton";
import { useAuth } from "@/lib/useAuth";
import { useSubscription } from "@/lib/useSubscription";
import { setCheckoutIntent } from "@/lib/checkout-intent";
import { AURA_PLANS, type PlanId } from "@/lib/plans";

export default function PricingCards() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { hasAccess, loading } = useSubscription(session?.user.id);

  function handleSelect(planId: PlanId) {
    if (!session) {
      setCheckoutIntent(planId);
      navigate({ to: "/login" });
      return;
    }
    if (hasAccess) {
      navigate({ to: "/academy" });
      return;
    }
    navigate({ to: "/checkout", search: { plan: planId } });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {AURA_PLANS.map((plan) => (
        <article
          key={plan.id}
          className={[
            "group relative flex flex-col overflow-hidden rounded-2xl border bg-[#0A0A0A] p-7 transition-all duration-300 hover:-translate-y-1",
            plan.highlight
              ? "border-white/25 shadow-[0_0_60px_-24px_rgba(255,255,255,0.35)]"
              : "border-white/10 hover:border-white/25",
          ].join(" ")}
        >
          {plan.badge && (
            <span className="mb-4 inline-flex w-fit rounded-full border border-white/20 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-neutral-300">
              {plan.badge}
            </span>
          )}

          <h3 className="text-xl font-semibold tracking-wide text-neutral-100">{plan.name}</h3>
          <p className="mt-2 text-sm text-neutral-500">{plan.tagline}</p>

          <p className="mt-6 flex items-baseline gap-2">
            <span className="text-4xl font-semibold tracking-tight text-white">
              {plan.priceLabel}
            </span>
            <span className="text-xs uppercase tracking-[0.2em] text-neutral-500">/ ΜΗΝΑ</span>
          </p>

          <ul className="mt-7 space-y-3 border-t border-white/5 pt-6">
            {plan.features.map((feature) => (
              <li key={feature} className="flex items-start gap-3 text-sm text-neutral-300">
                <span aria-hidden className="mt-2 h-px w-4 shrink-0 bg-white/40" />
                <span className="uppercase tracking-wide">{feature}</span>
              </li>
            ))}
          </ul>

          <div className="mt-8 pt-2">
            <ChromeButton
              type="button"
              variant={plan.highlight ? "primary" : "secondary"}
              className="w-full"
              disabled={loading}
              onClick={() => handleSelect(plan.id)}
            >
              {hasAccess ? "ΕΧΕΙΣ ΠΡΟΣΒΑΣΗ" : "ΞΕΚΙΝΑ ΤΩΡΑ"}
            </ChromeButton>
          </div>
        </article>
      ))}
    </div>
  );
}