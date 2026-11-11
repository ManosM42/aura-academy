// src/components/aura/DiscountPrice.tsx
// Chrome-silver member pricing: badge, struck list price and the new price.
import { motion, useReducedMotion } from "motion/react";
import { BadgeCheck, Crown } from "lucide-react";
import { getPlan, type PlanId } from "@/lib/plans";
import { CHROME_FILL } from "@/components/aura/chrome";

/** Metallic silver text (vertical chrome, with a soft glow). */
const silverText = {
  backgroundImage: CHROME_FILL,
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  WebkitTextFillColor: "transparent",
} as const;

/** "AURA ELITE | -25%" pill with a slow light sweep. */
export function MemberBadge({
  planId,
  percent,
  className = "",
}: {
  planId: PlanId | null;
  percent: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (percent <= 0) return null;
  const Icon = planId === "high" ? Crown : BadgeCheck;
  const name = getPlan(planId)?.name ?? "AURA MEMBER";

  return (
    <span
      className={`relative inline-flex items-center gap-1.5 overflow-hidden rounded-full border border-white/60 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.18em] text-neutral-950 shadow-[0_0_26px_rgba(255,255,255,0.28),inset_0_1px_0_rgba(255,255,255,0.95)] ${className}`}
      style={{ backgroundImage: CHROME_FILL }}
    >
      <Icon className="relative size-3" strokeWidth={2.6} aria-hidden />
      <span className="relative">{name}</span>
      <span aria-hidden className="relative h-3 w-px bg-black/25" />
      <span className="relative">−{percent}%</span>
      {!reduce && (
        <motion.span
          aria-hidden
          className="absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-white/80 blur-md"
          animate={{ x: ["0%", "420%"] }}
          transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 3.4, ease: "easeInOut" }}
        />
      )}
    </span>
  );
}

const SIZES = {
  sm: { list: "text-[11px]", final: "text-base" },
  md: { list: "text-xs", final: "text-2xl" },
  lg: { list: "text-sm", final: "text-4xl" },
} as const;

/**
 * Shows the list price struck through and the member price in silver.
 * With no discount it renders just the price (no strike-through).
 */
export function DiscountedPrice({
  listCents,
  finalCents,
  format,
  size = "md",
  align = "end",
  layout = "stacked",
  className = "",
}: {
  listCents: number;
  finalCents: number;
  format: (cents: number) => string;
  size?: keyof typeof SIZES;
  align?: "start" | "end";
  layout?: "stacked" | "inline";
  className?: string;
}) {
  const s = SIZES[size];
  const discounted = finalCents < listCents;

  const final = (
    <span
      className={`${s.final} font-extrabold tracking-tight drop-shadow-[0_0_18px_rgba(255,255,255,0.45)]`}
      style={silverText}
    >
      {format(finalCents)}
    </span>
  );

  if (!discounted) {
    return <span className={`inline-block ${className}`}>{final}</span>;
  }

  const list = (
    <s className={`${s.list} font-medium text-zinc-500 decoration-zinc-500/80`} aria-label={`Initial price ${format(listCents)}`}>
      {format(listCents)}
    </s>
  );

  if (layout === "inline") {
    return (
      <span className={`inline-flex items-baseline gap-2 ${className}`}>
        {list}
        {final}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex flex-col leading-none ${align === "end" ? "items-end text-right" : "items-start text-left"} ${className}`}
    >
      {list}
      <span className="mt-1.5">{final}</span>
    </span>
  );
}

/** Small silver line: "You save 12,50 €". */
export function SavingsLine({ label, amount, className = "" }: { label: string; amount: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 text-xs font-semibold ${className}`}>
      <span aria-hidden className="h-px w-6 bg-gradient-to-r from-transparent to-white/60" />
      <span style={silverText}>
        {label} {amount}
      </span>
    </span>
  );
}
