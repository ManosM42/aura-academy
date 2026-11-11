// src/components/aura/ForzaBravaPerk.tsx
//
// Profile page: "GET YOUR FORZA BRAVA 10% DISCOUNT".
//   - AURA PRO / ELITE click it -> a pop-up reveals their code, tap to copy.
//   - AURA BASIC (or no active plan) click it -> a pop-up asks them to upgrade.
// Nothing opens on its own: pop-ups only appear on click.
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  Copy,
  Crown,
  Loader2,
  Lock,
  RefreshCw,
  Scissors,
  Tag,
} from "lucide-react";
import { CHROME_FILL, ChromeCTA, ChromeCTALink, ChromeText, EASE, FRAME_BORDER } from "@/components/aura/chrome";
import PopupShell from "@/components/aura/promo/PopupShell";
import { useMyPerk } from "@/lib/perks";
import { getPlan } from "@/lib/plans";
import { usePlans } from "@/lib/usePlans";

const silverText = {
  backgroundImage: CHROME_FILL,
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  WebkitTextFillColor: "transparent",
} as const;

type Dialog = "code" | "upgrade" | "error" | null;

export default function ForzaBravaPerk({ userId }: { userId: string | undefined }) {
  const reduce = useReducedMotion();
  const perk = useMyPerk("forza_brava", userId);
  usePlans(); // live plan names / prices for the pop-ups
  const [dialog, setDialog] = useState<Dialog>(null);

  // The perk is switched off in the database: show nothing.
  if (!perk.loading && !perk.error && !perk.available) return null;

  const percent = perk.percent > 0 ? perk.percent : 10;

  function open() {
    if (perk.loading) return;
    if (perk.error) setDialog("error");
    else setDialog(perk.eligible ? "code" : "upgrade");
  }

  return (
    <>
      <motion.button
        type="button"
        onClick={open}
        aria-busy={perk.loading}
        aria-haspopup="dialog"
        {...(reduce || perk.loading ? {} : { whileHover: { y: -3 }, whileTap: { scale: 0.985 } })}
        className="group relative mt-8 block w-full rounded-2xl text-left outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
      >
        {/* breathing glow */}
        {!reduce && (
          <motion.span
            aria-hidden
            className="pointer-events-none absolute -inset-1.5 rounded-[22px] bg-white/15 blur-xl"
            animate={{ opacity: [0.25, 0.7, 0.25] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />
        )}

        {/* chrome frame */}
        <span
          className="relative block rounded-2xl p-px transition-shadow duration-300 group-hover:shadow-[0_0_60px_rgba(255,255,255,0.22)]"
          style={{ background: FRAME_BORDER, boxShadow: "0 0 40px rgba(0,0,0,0.9)" }}
        >
          <span className="relative flex items-center gap-4 overflow-hidden rounded-[15px] bg-[#09090b] px-4 py-4 sm:gap-5 sm:px-6 sm:py-5">
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute -left-10 top-1/2 size-40 -translate-y-1/2 rounded-full bg-white/[0.06] blur-3xl"
            />
            {/* light sweep */}
            {!reduce && (
              <motion.span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-0 w-1/4 -skew-x-12 bg-gradient-to-r from-transparent via-white/15 to-transparent"
                animate={{ x: ["-130%", "520%"] }}
                transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 3.4, ease: "easeInOut" }}
              />
            )}

            {/* icon tile */}
            <span
              className="relative flex size-12 shrink-0 items-center justify-center rounded-xl text-neutral-950 transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110 sm:size-14"
              style={{
                backgroundImage: CHROME_FILL,
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.95), 0 0 26px rgba(255,255,255,0.28)",
              }}
            >
              <Tag className="size-5 sm:size-6" strokeWidth={2.4} />
            </span>

            <span className="relative min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/45">
                Member perk
                <span
                  className={`rounded-full border px-2 py-px text-[9px] font-bold tracking-[0.2em] ${
                    perk.eligible
                      ? "border-white/40 bg-white/10 text-white/85"
                      : "border-white/15 text-white/45"
                  }`}
                >
                  {perk.loading ? "…" : perk.eligible ? "Unlocked" : "PRO · ELITE"}
                </span>
              </span>
              <span className="mt-1.5 block text-[15px] font-extrabold uppercase leading-snug tracking-wide sm:text-lg">
                <ChromeText>
                  Get your Forza Brava {percent}% discount
                </ChromeText>
              </span>
            </span>

            <span
              className="relative flex size-10 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/[0.05] text-white/80 transition-all duration-300 group-hover:border-white/60 group-hover:bg-white/10 group-hover:text-white group-hover:shadow-[0_0_24px_rgba(255,255,255,0.3)]"
              aria-hidden
            >
              {perk.loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
              )}
            </span>
          </span>
        </span>
      </motion.button>

      <CodeDialog
        open={dialog === "code"}
        onClose={() => setDialog(null)}
        code={perk.code}
        percent={percent}
        planName={getPlan(perk.plan)?.name ?? "AURA MEMBER"}
        isElite={perk.plan === "high"}
      />
      <UpgradeDialog open={dialog === "upgrade"} onClose={() => setDialog(null)} percent={percent} />
      <ErrorDialog
        open={dialog === "error"}
        onClose={() => setDialog(null)}
        onRetry={() => {
          perk.reload();
          setDialog(null);
        }}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Pop-up 1: the code (PRO / ELITE)                                    */
/* ------------------------------------------------------------------ */

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers / blocked clipboard API: fall back to a hidden textarea.
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

const BURST = Array.from({ length: 12 }, (_, i) => {
  const a = (i / 12) * Math.PI * 2;
  return { x: Math.cos(a) * 110, y: Math.sin(a) * 56 };
});

function CodeDialog({
  open,
  onClose,
  code,
  percent,
  planName,
  isElite,
}: {
  open: boolean;
  onClose: () => void;
  code: string | null;
  percent: number;
  planName: string;
  isElite: boolean;
}) {
  const reduce = useReducedMotion();
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [burst, setBurst] = useState(0);
  const timer = useRef<number | undefined>(undefined);

  // Fresh state every time it opens
  useEffect(() => {
    if (open) setStatus("idle");
    return () => window.clearTimeout(timer.current);
  }, [open]);

  async function copy() {
    if (!code) return;
    const ok = await copyText(code);
    setStatus(ok ? "copied" : "failed");
    if (ok) setBurst((n) => n + 1);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setStatus("idle"), 2600);
  }

  const copied = status === "copied";
  const TierIcon = isElite ? Crown : BadgeCheck;

  return (
    <PopupShell open={open} onClose={onClose} titleId="fb-code-title" descId="fb-code-desc" className="max-w-md">
      <div className="relative overflow-hidden rounded-[30px] border border-white/25 bg-[#060608] px-6 pb-7 pt-10 text-center shadow-[0_0_120px_rgba(210,218,230,0.18),0_40px_90px_rgba(0,0,0,0.85)] sm:px-9">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-64"
          style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.17), transparent 68%)" }}
        />
        <div aria-hidden className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent" />

        {/* crest */}
        <div className="relative mx-auto grid size-24 place-items-center">
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-full border border-dashed border-white/35"
            {...(reduce ? {} : { animate: { rotate: 360 }, transition: { duration: 22, repeat: Infinity, ease: "linear" } })}
          />
          <motion.span
            aria-hidden
            className="absolute inset-3 rounded-full bg-white/20 blur-xl"
            {...(reduce ? {} : { animate: { opacity: [0.3, 0.85, 0.3] }, transition: { duration: 3.4, repeat: Infinity, ease: "easeInOut" } })}
          />
          <span
            className="relative flex size-16 items-center justify-center rounded-full text-neutral-950"
            style={{
              backgroundImage: CHROME_FILL,
              boxShadow: "inset 0 2px 0 rgba(255,255,255,0.95), inset 0 -6px 14px rgba(0,0,0,0.35), 0 0 40px rgba(255,255,255,0.35)",
            }}
          >
            <Scissors className="size-7" strokeWidth={2.2} />
          </span>
        </div>

        <p className="relative mt-5 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.4em] text-white/50">
          <TierIcon className="size-3.5" /> {planName} perk
        </p>
        <h2 id="fb-code-title" className="relative mt-3 text-[11px] font-extrabold uppercase tracking-[0.5em] text-white/70">
          Forza Brava
        </h2>
        <p
          className="relative mt-1 text-7xl font-black leading-none tracking-tighter drop-shadow-[0_0_30px_rgba(255,255,255,0.4)]"
          style={silverText}
        >
          {percent}%
          <span className="ml-2 align-top text-xl font-extrabold tracking-[0.3em]">OFF</span>
        </p>
        <p id="fb-code-desc" className="relative mx-auto mt-4 max-w-xs text-sm leading-relaxed text-zinc-400">
          Your member code. Tap it to copy, then use it on your next FORZA BRAVA order.
        </p>

        {/* the code */}
        <div className="relative mx-auto mt-6 max-w-xs">
          {!reduce &&
            copied &&
            BURST.map((b, i) => (
              <motion.span
                key={`${burst}-${i}`}
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-1/2 z-20 size-1.5 rounded-full bg-white shadow-[0_0_12px_3px_rgba(255,255,255,0.8)]"
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{ x: b.x, y: b.y, opacity: 0, scale: 0.3 }}
                transition={{ duration: 0.85, ease: "easeOut" }}
              />
            ))}

          <div className="relative overflow-hidden rounded-2xl p-[1.5px] shadow-[0_0_44px_rgba(255,255,255,0.18)]">
            <motion.span
              aria-hidden
              className="absolute -inset-[90%]"
              style={{
                background: "conic-gradient(from 0deg, #2b2b31, #ffffff, #6b6b73, #e8e8ee, #2b2b31, #ffffff, #2b2b31)",
              }}
              {...(reduce ? {} : { animate: { rotate: 360 }, transition: { duration: 7, repeat: Infinity, ease: "linear" } })}
            />
            <button
              type="button"
              onClick={copy}
              disabled={!code}
              aria-label={code ? `Copy code ${code}` : "Code unavailable"}
              className="group relative flex w-full items-center justify-between gap-3 rounded-[14.5px] bg-[#0b0b0e] px-5 py-4 outline-none transition-colors hover:bg-[#101014] focus-visible:ring-2 focus-visible:ring-white/70"
            >
              <span
                className="flex-1 pl-[0.3em] font-mono text-3xl font-black tracking-[0.3em] drop-shadow-[0_0_18px_rgba(255,255,255,0.45)] sm:text-4xl"
                style={silverText}
              >
                {code ?? "——"}
              </span>
              <span
                className={`flex size-10 shrink-0 items-center justify-center rounded-full border transition-all duration-300 ${
                  copied
                    ? "border-white/70 bg-white text-black shadow-[0_0_26px_rgba(255,255,255,0.7)]"
                    : "border-white/25 bg-white/[0.06] text-white/80 group-hover:border-white/60 group-hover:text-white"
                }`}
              >
                {copied ? <Check className="size-4" strokeWidth={3} /> : <Copy className="size-4" />}
              </span>
            </button>
          </div>

          <p role="status" aria-live="polite" className="mt-3 h-5 text-xs font-semibold tracking-wide">
            {status === "copied" && <span style={silverText}>Copied to clipboard</span>}
            {status === "failed" && <span className="text-white/60">Couldn’t copy automatically. Select the code and copy it.</span>}
            {status === "idle" && <span className="text-white/35">Tap the code to copy</span>}
          </p>
        </div>

        <div className="relative mt-5">
          <ChromeCTA type="button" onClick={onClose} className="w-full">
            Done
          </ChromeCTA>
        </div>
      </div>
    </PopupShell>
  );
}

/* ------------------------------------------------------------------ */
/* Pop-up 2: upgrade (AURA BASIC / no active plan)                     */
/* ------------------------------------------------------------------ */

function UpgradeDialog({ open, onClose, percent }: { open: boolean; onClose: () => void; percent: number }) {
  const reduce = useReducedMotion();
  const pro = getPlan("mid");
  const elite = getPlan("high");

  const tiers = [
    { plan: pro, Icon: BadgeCheck, featured: false },
    { plan: elite, Icon: Crown, featured: true },
  ];

  return (
    <PopupShell open={open} onClose={onClose} titleId="fb-up-title" descId="fb-up-desc" className="max-w-md">
      <div className="relative overflow-hidden rounded-[30px] border border-white/25 bg-[#060608] px-6 pb-7 pt-10 text-center shadow-[0_0_120px_rgba(210,218,230,0.18),0_40px_90px_rgba(0,0,0,0.85)] sm:px-9">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-64"
          style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.15), transparent 68%)" }}
        />
        <div aria-hidden className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent" />

        {/* lock medallion with an orbiting spark */}
        <div className="relative mx-auto grid size-28 place-items-center">
          <motion.span
            aria-hidden
            className="absolute inset-0"
            {...(reduce ? {} : { animate: { rotate: 360 }, transition: { duration: 9, repeat: Infinity, ease: "linear" } })}
          >
            <span className="absolute left-1/2 top-0 size-2 -translate-x-1/2 rounded-full bg-white shadow-[0_0_16px_5px_rgba(255,255,255,0.85)]" />
          </motion.span>
          <span aria-hidden className="absolute inset-1 rounded-full border border-dashed border-white/25" />
          <motion.span
            aria-hidden
            className="absolute inset-5 rounded-full bg-white/25 blur-2xl"
            {...(reduce ? {} : { animate: { opacity: [0.3, 0.9, 0.3], scale: [0.9, 1.15, 0.9] }, transition: { duration: 3.2, repeat: Infinity, ease: "easeInOut" } })}
          />
          <span
            className="relative flex size-[4.5rem] items-center justify-center rounded-full text-neutral-950"
            style={{
              backgroundImage: CHROME_FILL,
              boxShadow: "inset 0 2px 0 rgba(255,255,255,0.95), inset 0 -8px 16px rgba(0,0,0,0.35), 0 0 46px rgba(255,255,255,0.35)",
            }}
          >
            <Lock className="size-8" strokeWidth={2.3} />
          </span>
        </div>

        <p className="relative mt-5 text-[10px] font-semibold uppercase tracking-[0.4em] text-white/50">Members only</p>
        <h2 id="fb-up-title" className="relative mt-3 text-[1.65rem] font-extrabold uppercase leading-tight tracking-tight sm:text-3xl">
          <ChromeText>Upgrade to PRO or ELITE</ChromeText>
        </h2>
        <p id="fb-up-desc" className="relative mx-auto mt-3 max-w-xs text-sm leading-relaxed text-zinc-400">
          Upgrade to PRO or ELITE to unlock your <span className="font-semibold text-white/85">FORZA BRAVA {percent}% discount</span> code.
        </p>

        <ul className="relative mt-6 space-y-2.5 text-left">
          {tiers.map(({ plan, Icon, featured }, i) =>
            plan ? (
              <motion.li
                key={plan.id}
                initial={reduce ? false : { opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.55, ease: EASE, delay: 0.3 + i * 0.14 }}
                className={`flex items-center gap-3.5 rounded-2xl border px-4 py-3 ${
                  featured
                    ? "border-white/40 bg-gradient-to-r from-white/[0.12] to-white/[0.03] shadow-[0_0_40px_-12px_rgba(255,255,255,0.55)]"
                    : "border-white/12 bg-white/[0.03]"
                }`}
              >
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-xl text-neutral-950"
                  style={{ backgroundImage: CHROME_FILL, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 0 20px rgba(255,255,255,0.2)" }}
                >
                  <Icon className="size-5" strokeWidth={2.4} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-sm font-bold text-white">
                    {plan.name}
                    {featured && (
                      <span className="rounded-full border border-white/40 px-2 py-px text-[9px] font-extrabold uppercase tracking-[0.2em] text-white/80">
                        Everything
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-xs text-zinc-400">{percent}% off FORZA BRAVA products</span>
                </span>
                <span className="text-sm font-bold text-white/80">
                  {plan.priceLabel}
                  <span className="text-[10px] font-medium text-white/40"> /mo</span>
                </span>
              </motion.li>
            ) : null,
          )}
        </ul>

        <div className="relative mt-6 flex flex-col gap-3">
          <ChromeCTALink to="/pricing" className="w-full">
            Upgrade now
          </ChromeCTALink>
          <ChromeCTA type="button" solid={false} onClick={onClose}>
            Not now
          </ChromeCTA>
        </div>
      </div>
    </PopupShell>
  );
}

/* ------------------------------------------------------------------ */
/* Pop-up 3: the request failed (so a PRO member is never told to      */
/* "upgrade" by mistake)                                               */
/* ------------------------------------------------------------------ */

function ErrorDialog({ open, onClose, onRetry }: { open: boolean; onClose: () => void; onRetry: () => void }) {
  return (
    <PopupShell open={open} onClose={onClose} titleId="fb-err-title" descId="fb-err-desc" className="max-w-sm">
      <div className="relative overflow-hidden rounded-3xl border border-white/20 bg-[#060608] px-6 pb-6 pt-9 text-center shadow-[0_0_80px_rgba(210,218,230,0.12),0_30px_80px_rgba(0,0,0,0.85)]">
        <div aria-hidden className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent" />
        <h2 id="fb-err-title" className="text-xl font-extrabold tracking-tight">
          <ChromeText>We couldn’t load your code</ChromeText>
        </h2>
        <p id="fb-err-desc" className="mt-3 text-sm leading-relaxed text-zinc-400">
          This is a connection problem, not a problem with your plan. Please try again in a moment.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <ChromeCTA type="button" onClick={onRetry}>
            <RefreshCw className="size-4" /> Try again
          </ChromeCTA>
          <ChromeCTA type="button" solid={false} onClick={onClose}>
            Close
          </ChromeCTA>
        </div>
      </div>
    </PopupShell>
  );
}
