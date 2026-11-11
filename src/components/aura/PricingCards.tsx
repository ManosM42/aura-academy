// src/components/aura/PricingCards.tsx
import { useRef, useState, type MouseEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { motion } from "motion/react";
import { Check, ChevronDown } from "lucide-react";
import ChromeButton from "@/components/aura/ChromeButton";
import UpgradeModal from "@/components/aura/UpgradeModal";
import { useAuth } from "@/lib/useAuth";
import { useSubscription } from "@/lib/useSubscription";
import { setCheckoutIntent } from "@/lib/checkout-intent";
import { getPlanCardState, type PlanCardState } from "@/lib/changePlan";
import type { AuraPlan, PlanId } from "@/lib/plans";
import { usePlans } from "@/lib/usePlans";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const COLLAPSED = 7;

function PlanCard({
  plan,
  index,
  state,
  loading,
  onSelect,
}: {
  plan: AuraPlan;
  index: number;
  state: PlanCardState;
  loading: boolean;
  onSelect: (id: PlanId) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const list = open ? plan.features : plan.features.slice(0, COLLAPSED);
  const hidden = plan.features.length - COLLAPSED;
  const short = plan.name.replace("AURA ", "");

  const label =
    state === "current"
      ? "ΕΧΕΙΣ ΠΡΟΣΒΑΣΗ"
      : state === "upgrade"
        ? `ΑΝΑΒΑΘΜΙΣΗ ΣΕ ${short}`
        : state === "lower"
          ? "ΠΕΡΙΛΑΜΒΑΝΕΤΑΙ"
          : `ΞΕΚΙΝΑ ΜΕ ${short}`;

  const note =
    state === "upgrade"
      ? "Πληρώνεις μόνο τη διαφορά από το τρέχον πλάνο σου."
      : state === "lower"
        ? "Έχεις ήδη πρόσβαση μέσω του ανώτερου πλάνου σου."
        : null;

  function onMove(e: MouseEvent<HTMLElement>) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 56, filter: "blur(8px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={{ duration: 0.95, ease: EASE, delay: index * 0.12 }}
      className={plan.highlight ? "lg:-my-5" : ""}
    >
      <article
        ref={ref}
        onMouseMove={onMove}
        className={`pr-wrap ${plan.highlight ? "pr-wrap-hi" : ""} ${state === "lower" ? "pr-lower" : ""}`}
        aria-labelledby={`plan-${plan.id}`}
      >
        {plan.highlight && <span className="pr-border" aria-hidden />}
        <div className="pr-card">
          <div className="pr-spot" aria-hidden />

          <div className="relative flex flex-1 flex-col">
            <div className="flex min-h-7 items-center">
              {state === "current" ? (
                <span className="pr-badge">ΤΟ ΠΛΑΝΟ ΣΟΥ</span>
              ) : plan.badge ? (
                <span className="pr-badge">{plan.badge}</span>
              ) : null}
            </div>

            <h3 id={`plan-${plan.id}`} className="pr-name mt-3 text-2xl font-bold tracking-[0.12em]">
              {plan.name}
            </h3>
            <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-white/70">
              {plan.slogan}
            </p>
            <p className="mt-4 text-sm leading-relaxed text-white/55">{plan.tagline}</p>

            <div className="mt-7 border-y border-white/[0.07] py-6">
              <span className="text-[10px] uppercase tracking-[0.35em] text-white/35">
                Monthly subscription
              </span>
              <p className="mt-2 flex items-baseline gap-2">
                <span className="pr-price">{plan.priceLabel}</span>
                <span className="text-xs uppercase tracking-[0.25em] text-white/45">/ Μήνα</span>
              </p>
            </div>

            <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.4em] text-white/40">
              Περιλαμβάνει
            </p>
            <ul className="mt-4 space-y-3">
              {list.map((feature) => (
                <li key={feature} className="flex items-start gap-3 text-sm leading-snug text-white/75">
                  <span className="pr-check" aria-hidden>
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            {hidden > 0 && (
              <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                className="pr-more mt-4"
              >
                {open ? "Λιγότερα" : `+ ${hidden} ακόμη προνόμια`}
                <ChevronDown className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
              </button>
            )}

            <div className="mt-auto pt-8">
              <ChromeButton
                type="button"
                variant={plan.highlight || state === "upgrade" ? "primary" : "secondary"}
                className="w-full"
                disabled={loading || state === "lower"}
                onClick={() => onSelect(plan.id)}
              >
                {label}
              </ChromeButton>
              {note && <p className="mt-3 text-center text-[11px] leading-relaxed text-white/45">{note}</p>}
            </div>
          </div>
        </div>
      </article>
    </motion.div>
  );
}

function PlansSkeleton() {
  return (
    <div className="grid items-stretch gap-8 lg:grid-cols-3 lg:gap-6" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-[520px] animate-pulse rounded-[1.4rem] border border-white/10 bg-white/[0.03]" />
      ))}
    </div>
  );
}

export default function PricingCards() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { subscription, hasAccess, loading, refresh } = useSubscription(session?.user.id);
  const { plans, loading: plansLoading } = usePlans();
  const [upgradeTarget, setUpgradeTarget] = useState<AuraPlan | null>(null);

  // Only meaningful for a signed-in user with an active/trialing subscription.
  const currentPlanId: PlanId | null = session && hasAccess ? (subscription?.plan_id ?? null) : null;

  function handleSelect(planId: PlanId) {
    if (!session) {
      // Το intent μένει ως fallback (in-app browsers, ανανέωση σελίδας),
      // αλλά ο κύριος φορέας είναι πλέον το ?plan= στο URL.
      setCheckoutIntent(planId);
      navigate({ to: "/login", search: { plan: planId } });
      return;
    }

    const state = getPlanCardState(currentPlanId, planId);

    if (state === "lower") return;

    if (state === "current") {
      navigate({ to: "/academy" });
      return;
    }

    if (state === "upgrade") {
      const target = plans.find((p) => p.id === planId);
      if (target) setUpgradeTarget(target);
      return;
    }

    // No active subscription: normal checkout.
    navigate({ to: "/checkout", search: { plan: planId } });
  }

  return (
    <>
      <style>{css}</style>
      {plansLoading ? (
        <PlansSkeleton />
      ) : (
        <div className="grid items-stretch gap-8 lg:grid-cols-3 lg:gap-6">
          {plans.map((plan, i) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              index={i}
              state={getPlanCardState(currentPlanId, plan.id)}
              loading={loading}
              onSelect={handleSelect}
            />
          ))}
        </div>
      )}

      {upgradeTarget && (
        <UpgradeModal
          plan={upgradeTarget}
          open
          onClose={() => setUpgradeTarget(null)}
          onUpgraded={refresh}
        />
      )}
    </>
  );
}

const css = `
@keyframes pr-spin { to { transform: rotate(360deg); } }
@keyframes pr-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

.pr-wrap {
  position: relative; height: 100%; padding: 1px; border-radius: 1.4rem; overflow: hidden; isolation: isolate;
  background: rgba(255,255,255,.09);
  transition: transform .5s cubic-bezier(.22,1,.36,1), box-shadow .5s, background .5s, opacity .4s;
}
.pr-wrap:hover { transform: translateY(-6px); background: rgba(255,255,255,.22); box-shadow: 0 34px 90px -34px rgba(220,228,240,.3); }
.pr-wrap-hi { background: rgba(255,255,255,.1); box-shadow: 0 0 90px -30px rgba(232,236,242,.5); }
.pr-wrap-hi:hover { background: rgba(255,255,255,.1); }
.pr-lower { opacity: .6; }
.pr-lower:hover { transform: none; box-shadow: none; background: rgba(255,255,255,.09); }
.pr-border {
  position: absolute; inset: -60%; z-index: -1;
  background: conic-gradient(from 0deg, transparent 0 50%, rgba(255,255,255,0) 56%, rgba(232,236,242,.98) 74%, rgba(255,255,255,0) 90%, transparent 100%);
  animation: pr-spin 7s linear infinite;
}
.pr-card {
  position: relative; display: flex; flex-direction: column; height: 100%; padding: 2rem; overflow: hidden;
  border-radius: calc(1.4rem - 1px);
  background: linear-gradient(180deg, rgba(22,23,29,.96), rgba(8,9,12,.98));
}
.pr-wrap-hi .pr-card { background: linear-gradient(180deg, rgba(28,29,36,.97), rgba(9,10,13,.99)); }
.pr-spot {
  position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(420px circle at var(--mx, 50%) var(--my, 0%), rgba(255,255,255,.08), transparent 60%);
}
.pr-name, .pr-price {
  background: linear-gradient(110deg, #6b7280 0%, #f8fafc 25%, #9ca3af 45%, #ffffff 60%, #8b93a1 80%, #f1f5f9 100%);
  background-size: 250% 100%; -webkit-background-clip: text; background-clip: text; color: transparent;
  animation: pr-shimmer 7s linear infinite;
}
.pr-price { font-size: 3.2rem; line-height: 1; font-weight: 700; letter-spacing: -.02em; }
.pr-badge {
  border-radius: 9999px; padding: .3rem .8rem; font-size: 10px; letter-spacing: .3em; color: #f1f5f9;
  border: 1px solid rgba(232,236,242,.45); background: rgba(255,255,255,.07); box-shadow: 0 0 20px -4px rgba(232,236,242,.55);
}
.pr-check {
  display: grid; place-items: center; flex-shrink: 0; width: 1.15rem; height: 1.15rem; margin-top: .15rem; border-radius: 9999px;
  color: #f1f5f9; border: 1px solid rgba(232,236,242,.4); background: rgba(255,255,255,.06); box-shadow: 0 0 12px -2px rgba(232,236,242,.5);
}
.pr-more {
  display: inline-flex; width: fit-content; align-items: center; gap: .4rem; font-size: 11px; letter-spacing: .2em;
  text-transform: uppercase; color: rgba(255,255,255,.6); transition: color .2s, text-shadow .2s;
}
.pr-more:hover { color: #fff; text-shadow: 0 0 14px rgba(232,236,242,.7); }
@media (prefers-reduced-motion: reduce) { .pr-border, .pr-name, .pr-price { animation: none !important; } }
`;