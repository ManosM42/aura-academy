// src/components/aura/promo/BookMemberPopup.tsx
//
// /book pop-up for visitors who are not signed in.
// Look: "The Member Edition": a rotating silver edge, a spinning chrome medallion
// with the biggest book discount counting up, and one row per plan.
import { useEffect, useState } from "react";
import { animate, motion, useReducedMotion } from "motion/react";
import { BadgeCheck, BookOpen, Crown } from "lucide-react";
import { CHROME_FILL, ChromeCTA, ChromeCTALink, ChromeText, EASE } from "@/components/aura/chrome";
import PopupShell from "@/components/aura/promo/PopupShell";
import { usePlanDiscountTable } from "@/lib/discounts";
import { usePlans } from "@/lib/usePlans";
import { getPlan } from "@/lib/plans";

const SPARKS = [
  { left: "8%", top: "14%", delay: 0 },
  { left: "88%", top: "10%", delay: 0.8 },
  { left: "16%", top: "46%", delay: 1.6 },
  { left: "92%", top: "40%", delay: 0.4 },
  { left: "78%", top: "70%", delay: 1.2 },
  { left: "6%", top: "78%", delay: 2 },
] as const;

function CountUp({ to }: { to: number }) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(reduce ? to : 0);

  useEffect(() => {
    if (reduce) {
      setN(to);
      return;
    }
    const controls = animate(0, to, {
      duration: 1.5,
      delay: 0.35,
      ease: "easeOut",
      onUpdate: (v) => setN(Math.round(v)),
    });
    return () => controls.stop();
  }, [to, reduce]);

  return <>{n}</>;
}

export default function BookMemberPopup({
  open,
  onClose,
  canContinue,
}: {
  open: boolean;
  onClose: () => void;
  /** True when the visitor pressed "Order the book": offer to carry on without a plan. */
  canContinue: boolean;
}) {
  const reduce = useReducedMotion();
  const table = usePlanDiscountTable();
  usePlans(); // loads the live plan names and prices

  const proPct = table.mid.book;
  const elitePct = table.high.book;
  const best = Math.max(proPct, elitePct);
  const from = getPlan("low");

  const tiers = [
    { id: "mid" as const, pct: proPct, Icon: BadgeCheck, featured: false, extra: null },
    {
      id: "high" as const,
      pct: elitePct,
      Icon: Crown,
      featured: true,
      extra: table.high.online_seminar > 0 ? `+ −${table.high.online_seminar}% on online seminars` : null,
    },
  ].filter((t) => t.pct > 0);

  return (
    <PopupShell open={open} onClose={onClose} titleId="book-promo-title" descId="book-promo-desc" className="max-w-md">
      {/* rotating silver edge */}
      <div className="relative overflow-hidden rounded-[30px] p-[1.5px] shadow-[0_0_120px_rgba(210,218,230,0.18),0_40px_90px_rgba(0,0,0,0.85)]">
        <motion.div
          aria-hidden
          className="absolute -inset-[70%]"
          style={{
            background:
              "conic-gradient(from 0deg, #2b2b31, #ffffff, #6b6b73, #e8e8ee, #2b2b31, #ffffff, #6b6b73, #2b2b31)",
          }}
          {...(reduce ? {} : { animate: { rotate: 360 }, transition: { duration: 9, repeat: Infinity, ease: "linear" } })}
        />

        <div className="relative overflow-hidden rounded-[28.5px] bg-[#07070a] px-6 pb-7 pt-9 sm:px-9">
          {/* ambient light */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-72"
            style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.16), transparent 68%)" }}
          />
          <div aria-hidden className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent" />
          {!reduce &&
            SPARKS.map((s, i) => (
              <motion.span
                key={i}
                aria-hidden
                className="pointer-events-none absolute size-1 rounded-full bg-white shadow-[0_0_12px_3px_rgba(255,255,255,0.7)]"
                style={{ left: s.left, top: s.top }}
                animate={{ opacity: [0, 1, 0], y: [0, -14, -28], scale: [0.6, 1.2, 0.6] }}
                transition={{ duration: 3.6, repeat: Infinity, delay: s.delay, ease: "easeInOut" }}
              />
            ))}

          {/* medallion */}
          <div className="relative mx-auto grid size-48 place-items-center">
            <motion.span
              aria-hidden
              className="absolute inset-0 rounded-full border border-dashed border-white/35"
              {...(reduce ? {} : { animate: { rotate: 360 }, transition: { duration: 26, repeat: Infinity, ease: "linear" } })}
            />
            <motion.span
              aria-hidden
              className="absolute inset-3 rounded-full border border-white/15"
              {...(reduce ? {} : { animate: { rotate: -360 }, transition: { duration: 18, repeat: Infinity, ease: "linear" } })}
            >
              <span className="absolute -top-1 left-1/2 size-2 -translate-x-1/2 rounded-full bg-white shadow-[0_0_14px_4px_rgba(255,255,255,0.8)]" />
            </motion.span>
            <motion.span
              aria-hidden
              className="absolute inset-7 rounded-full bg-white/25 blur-2xl"
              {...(reduce ? {} : { animate: { opacity: [0.35, 0.9, 0.35], scale: [0.9, 1.12, 0.9] }, transition: { duration: 3.6, repeat: Infinity, ease: "easeInOut" } })}
            />
            <div
              className="relative grid size-36 place-items-center overflow-hidden rounded-full border border-white/50"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 30% 22%, #ffffff 0%, #d9d9df 28%, #8f8f97 62%, #3b3b42 100%)",
                boxShadow:
                  "inset 0 2px 0 rgba(255,255,255,0.95), inset 0 -10px 24px rgba(0,0,0,0.45), 0 0 60px rgba(255,255,255,0.35)",
              }}
            >
              <div className="text-center text-neutral-950">
                <span className="block text-[10px] font-extrabold uppercase tracking-[0.4em]">up to</span>
                <span className="block text-6xl font-black leading-none tracking-tighter">
                  <CountUp to={best} />
                  <span className="text-3xl">%</span>
                </span>
                <span className="mt-1 block text-[11px] font-extrabold uppercase tracking-[0.45em]">off</span>
              </div>
              {!reduce && (
                <motion.span
                  aria-hidden
                  className="absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-white/70 blur-md"
                  animate={{ x: ["0%", "400%"] }}
                  transition={{ duration: 2.2, repeat: Infinity, repeatDelay: 3.2, ease: "easeInOut" }}
                />
              )}
            </div>
          </div>

          {/* copy */}
          <div className="relative mt-6 text-center">
            <p className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.4em] text-white/50">
              <BookOpen className="size-3.5" /> The Member Edition
            </p>
            <h2 id="book-promo-title" className="mt-3 text-[1.7rem] font-extrabold leading-tight tracking-tight sm:text-3xl">
              <ChromeText>The AURA book costs less for members.</ChromeText>
            </h2>
            <p id="book-promo-desc" className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-zinc-400">
              Join an AURA plan and your discount is applied automatically at checkout. No codes, nothing to remember.
            </p>
          </div>

          {/* tiers */}
          <ul className="relative mt-6 space-y-2.5">
            {tiers.map((t, i) => {
              const plan = getPlan(t.id);
              return (
                <motion.li
                  key={t.id}
                  initial={reduce ? false : { opacity: 0, x: -18 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, ease: EASE, delay: 0.55 + i * 0.15 }}
                  className={`relative flex items-center gap-3.5 overflow-hidden rounded-2xl border px-4 py-3 ${
                    t.featured
                      ? "border-white/40 bg-gradient-to-r from-white/[0.12] to-white/[0.03] shadow-[0_0_40px_-12px_rgba(255,255,255,0.55)]"
                      : "border-white/12 bg-white/[0.03]"
                  }`}
                >
                  <span
                    className="flex size-10 shrink-0 items-center justify-center rounded-xl text-neutral-950"
                    style={{ backgroundImage: CHROME_FILL, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 0 20px rgba(255,255,255,0.2)" }}
                  >
                    <t.Icon className="size-5" strokeWidth={2.4} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm font-bold text-white">
                      {plan?.name ?? "AURA"}
                      {t.featured && (
                        <span className="rounded-full border border-white/40 px-2 py-px text-[9px] font-extrabold uppercase tracking-[0.2em] text-white/80">
                          Best value
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-xs text-zinc-400">
                      {t.extra ?? "on the hardcover edition"}
                    </span>
                  </span>
                  <span
                    className="text-2xl font-black tracking-tight drop-shadow-[0_0_16px_rgba(255,255,255,0.5)]"
                    style={{
                      backgroundImage: CHROME_FILL,
                      WebkitBackgroundClip: "text",
                      backgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
                    −{t.pct}%
                  </span>
                </motion.li>
              );
            })}
          </ul>

          {from && (
            <p className="relative mt-4 text-center text-xs text-white/45">
              Plans from <span className="font-semibold text-white/80">{from.priceLabel}</span> / month · cancel anytime
            </p>
          )}

          {/* actions */}
          <div className="relative mt-6 flex flex-col gap-3">
            <ChromeCTALink to="/pricing" className="w-full">
              See the plans
            </ChromeCTALink>
            <ChromeCTA type="button" solid={false} onClick={onClose}>
              {canContinue ? "Continue at full price" : "Maybe later"}
            </ChromeCTA>
          </div>
        </div>
      </div>
    </PopupShell>
  );
}
