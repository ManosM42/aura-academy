// src/components/aura/UpgradeModal.tsx
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  ExternalLink,
  Loader2,
  Receipt,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { formatEuro, type AuraPlan } from "@/lib/plans";
import { usePlans } from "@/lib/usePlans";
import {
  previewUpgrade,
  upgradePlan,
  type CardInfo,
  type UpgradePreview,
  type UpgradeResult,
} from "@/lib/changePlan";

interface UpgradeModalProps {
  /** The plan the user wants to upgrade TO. */
  plan: AuraPlan;
  open: boolean;
  onClose: () => void;
  /** Called once after a successful upgrade (refresh the subscription here). */
  onUpgraded: () => void;
}

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

const BRANDS: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  discover: "Discover",
  diners: "Diners Club",
  jcb: "JCB",
  unionpay: "UnionPay",
};

function cardLabel(card: CardInfo | null): string {
  if (!card) return "your saved card";
  const brand = BRANDS[card.brand] ?? card.brand.charAt(0).toUpperCase() + card.brand.slice(1);
  return `${brand} •••• ${card.last4}`;
}

const normalize = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

/** "Όλα τα προνόμια του AURA PRO" style lines point to another plan's features. */
const INHERIT_RE = /^Όλα τα προνόμια του\s+(.+)$/i;

function effectiveFeatures(plan: AuraPlan, all: AuraPlan[], seen = new Set<string>()): string[] {
  if (seen.has(plan.id)) return [];
  seen.add(plan.id);
  const out: string[] = [];
  for (const feature of plan.features) {
    const baseName = INHERIT_RE.exec(feature.trim())?.[1];
    if (baseName) {
      const base = all.find((p) => normalize(p.name) === normalize(baseName));
      if (base) out.push(...effectiveFeatures(base, all, seen));
      continue;
    }
    out.push(feature);
  }
  return Array.from(new Set(out));
}

/* ------------------------------------------------------------------ */
/* Modal                                                               */
/* ------------------------------------------------------------------ */

export default function UpgradeModal({ plan, open, onClose, onUpgraded }: UpgradeModalProps) {
  const { plans } = usePlans();
  const navigate = useNavigate();
  const reduce = useReducedMotion();

  const [preview, setPreview] = useState<UpgradePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<UpgradeResult | null>(null);
  const [terms, setTerms] = useState(false);
  const [typed, setTyped] = useState("");
  const closeRef = useRef<HTMLButtonElement | null>(null);

  const phrase = `Upgrade to ${plan.name}`;
  const phraseOk = normalize(typed) === normalize(phrase);
  const canConfirm = !!preview && terms && phraseOk && !submitting && !done;

  // Load the exact numbers every time the modal opens.
  useEffect(() => {
    if (!open) return;
    let active = true;
    setPreview(null);
    setError(null);
    setDone(null);
    setSubmitting(false);
    setTerms(false);
    setTyped("");
    setLoading(true);

    previewUpgrade(plan.id)
      .then((p) => {
        if (active) setPreview(p);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Couldn’t load the upgrade details.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, plan.id]);

  // Escape + scroll lock + initial focus.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, submitting]);

  // What the user gains: the new plan's features minus the ones they already had.
  const newFeatures = useMemo(() => {
    const target = plans.find((p) => p.id === plan.id) ?? plan;
    const targetAll = effectiveFeatures(target, plans);
    const current = preview ? plans.find((p) => p.id === preview.currentPlanId) : undefined;
    if (!current) return targetAll;
    const had = new Set(effectiveFeatures(current, plans));
    const gained = targetAll.filter((f) => !had.has(f));
    return gained.length > 0 ? gained : targetAll;
  }, [plans, plan, preview]);

  async function confirm(event?: FormEvent) {
    event?.preventDefault();
    if (!canConfirm) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await upgradePlan(plan.id);
      setDone(result);
      onUpgraded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The upgrade failed. Nothing was charged.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  const money = (cents: number) => formatEuro(cents);

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-md sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="aura-upgrade-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduce ? 0 : 0.5, ease: EASE }}
    >
      <style>{css}</style>
      <button
        type="button"
        aria-label="Close"
        onClick={() => !submitting && onClose()}
        className="absolute inset-0 h-full w-full cursor-default"
        tabIndex={-1}
      />

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 28, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: reduce ? 0 : 0.8, ease: EASE }}
        className="relative z-10 my-auto w-full max-w-xl"
      >
        <div className="um-glow" aria-hidden />
        <div className="um-wrap">
          <span className="um-border" aria-hidden />
          <div className="um-card">
            <header className="flex items-center justify-between gap-4 border-b border-white/10 px-6 py-4 sm:px-8">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.45em] text-white/40">AURA UPGRADE</p>
                <h2 id="aura-upgrade-title" className="um-title mt-1 truncate text-xl font-bold tracking-wide">
                  {done ? "Upgrade complete" : `Upgrade to ${plan.name}`}
                </h2>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                disabled={submitting}
                aria-label="Close"
                className="um-icon-btn"
              >
                <X className="size-4" />
              </button>
            </header>

            <div className="px-6 py-7 sm:px-8">
              <AnimatePresence mode="wait" initial={false}>
                {done ? (
                  <motion.div
                    key="done"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: reduce ? 0 : 0.6, ease: EASE }}
                  >
                    <ThankYou
                      plan={plan}
                      result={done}
                      preview={preview}
                      features={newFeatures}
                      reduce={!!reduce}
                      money={money}
                      onAcademy={() => {
                        onClose();
                        navigate({ to: "/academy" });
                      }}
                      onClose={onClose}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="review"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: reduce ? 0 : 0.45, ease: EASE }}
                  >
                    {loading && <ReviewSkeleton />}

                    {!loading && error && !preview && (
                      <p role="alert" className="py-6 text-sm text-red-300">
                        {error}
                      </p>
                    )}

                    {preview && (
                      <form onSubmit={(e) => void confirm(e)} noValidate className="space-y-7">
                        {/* from -> to */}
                        <div className="flex items-center justify-center gap-3 sm:gap-5">
                          <span className="um-chip text-white/55">{preview.currentPlanName}</span>
                          <motion.span
                            animate={reduce ? undefined : { x: [0, 5, 0] }}
                            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                            className="text-white/70"
                            aria-hidden
                          >
                            <ArrowRight className="size-5" />
                          </motion.span>
                          <span className="um-chip um-chip-hi">{preview.targetPlanName}</span>
                        </div>

                        {/* payment summary */}
                        <section aria-label="Payment summary" className="um-panel p-5 sm:p-6">
                          <dl className="space-y-3 text-sm">
                            <div className="flex items-baseline justify-between gap-4 text-white/60">
                              <dt>{preview.targetPlanName} · monthly price</dt>
                              <dd className="tabular-nums">{money(preview.newAmountCents)}</dd>
                            </div>
                            <div className="flex items-baseline justify-between gap-4 text-white/60">
                              <dt>Credit for your current {preview.currentPlanName}</dt>
                              <dd className="tabular-nums text-emerald-300/90">−{money(preview.currentAmountCents)}</dd>
                            </div>
                            <div className="flex items-end justify-between gap-4 border-t border-white/10 pt-4">
                              <dt className="text-[11px] font-semibold uppercase tracking-[0.25em] text-white">
                                Due today
                              </dt>
                              <dd className="um-amount text-4xl font-bold leading-none tabular-nums">
                                {money(preview.differenceCents)}
                              </dd>
                            </div>
                          </dl>

                          <ul className="mt-6 space-y-3.5 border-t border-white/[0.07] pt-5 text-[13px] leading-relaxed text-white/60">
                            <Detail icon={<CreditCard className="size-4" />}>
                              Charged to <strong className="font-medium text-white/85">{cardLabel(preview.card)}</strong>,
                              the card you already use for your subscription.
                            </Detail>
                            <Detail icon={<CalendarClock className="size-4" />}>
                              Your billing day changes to <strong className="font-medium text-white/85">today</strong>.
                              Next renewal: <strong className="font-medium text-white/85">{fmtDate(preview.nextRenewal)}</strong>
                              {preview.currentPeriodEnd && <> (instead of {fmtDate(preview.currentPeriodEnd)})</>}.
                            </Detail>
                            <Detail icon={<Receipt className="size-4" />}>
                              From then on you pay{" "}
                              <strong className="font-medium text-white/85">{money(preview.newAmountCents)} / month</strong>,
                              VAT included. Cancel any time.
                            </Detail>
                            <Detail icon={<ShieldCheck className="size-4" />}>
                              Secure payment by Stripe. If the payment fails, nothing changes on your account.
                            </Detail>
                          </ul>
                        </section>

                        {/* verification */}
                        <section aria-label="Confirmation" className="space-y-4">
                          <label className="um-check-row">
                            <input
                              type="checkbox"
                              checked={terms}
                              onChange={(e) => setTerms(e.target.checked)}
                              disabled={submitting}
                              className="um-checkbox"
                            />
                            <span className="text-[13px] leading-relaxed text-white/65">
                              I accept the{" "}
                              <Link
                                to="/terms"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-white underline underline-offset-4 transition-colors hover:text-white/70"
                              >
                                Terms of Service
                              </Link>{" "}
                              and agree to be charged {money(preview.differenceCents)} now and{" "}
                              {money(preview.newAmountCents)} every month.
                            </span>
                          </label>

                          <div>
                            <label
                              htmlFor="upgrade-confirm"
                              className="mb-2 block text-[11px] uppercase tracking-[0.2em] text-white/45"
                            >
                              Type <span className="text-white">“{phrase}”</span> to confirm
                            </label>
                            <div className="relative">
                              <input
                                id="upgrade-confirm"
                                value={typed}
                                onChange={(e) => setTyped(e.target.value)}
                                disabled={submitting}
                                autoComplete="off"
                                autoCapitalize="none"
                                spellCheck={false}
                                placeholder={phrase}
                                aria-invalid={typed.length > 0 && !phraseOk}
                                className="um-input"
                              />
                              <AnimatePresence>
                                {phraseOk && (
                                  <motion.span
                                    initial={{ opacity: 0, scale: 0.5 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.5 }}
                                    className="absolute inset-y-0 right-3 flex items-center text-emerald-300"
                                    aria-hidden
                                  >
                                    <Check className="size-4" strokeWidth={3} />
                                  </motion.span>
                                )}
                              </AnimatePresence>
                            </div>
                          </div>
                        </section>

                        {error && (
                          <p role="alert" className="rounded-xl border border-red-400/25 bg-red-500/[0.07] px-4 py-3 text-sm text-red-300">
                            {error}
                          </p>
                        )}

                        <div className="flex flex-col gap-3 sm:flex-row-reverse">
                          <button type="submit" disabled={!canConfirm} className="um-primary flex-1">
                            {submitting ? (
                              <>
                                <Loader2 className="size-4 animate-spin" /> Processing payment…
                              </>
                            ) : (
                              <>Confirm &amp; pay {money(preview.differenceCents)}</>
                            )}
                          </button>
                          <button type="button" onClick={onClose} disabled={submitting} className="um-ghost">
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

function Detail({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="um-detail-icon" aria-hidden>
        {icon}
      </span>
      <span>{children}</span>
    </li>
  );
}

function ReviewSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" role="status" aria-label="Loading">
      <div className="mx-auto h-9 w-2/3 animate-pulse rounded-full bg-white/[0.06]" />
      <div className="h-48 animate-pulse rounded-2xl bg-white/[0.04]" />
      <div className="h-24 animate-pulse rounded-2xl bg-white/[0.04]" />
    </div>
  );
}

function ThankYou({
  plan,
  result,
  preview,
  features,
  reduce,
  money,
  onAcademy,
  onClose,
}: {
  plan: AuraPlan;
  result: UpgradeResult;
  preview: UpgradePreview | null;
  features: string[];
  reduce: boolean;
  money: (cents: number) => string;
  onAcademy: () => void;
  onClose: () => void;
}) {
  const charged = result.chargedCents ?? preview?.differenceCents ?? null;
  const card = result.card ?? preview?.card ?? null;
  const monthly = preview?.newAmountCents ?? plan.amountCents;

  return (
    <div className="text-center">
      {/* animated badge */}
      <div className="relative mx-auto grid size-24 place-items-center">
        <span className="um-ring" aria-hidden />
        <span className="um-sparkle um-s1" aria-hidden />
        <span className="um-sparkle um-s2" aria-hidden />
        <span className="um-sparkle um-s3" aria-hidden />
        <span className="um-sparkle um-s4" aria-hidden />
        <motion.span
          initial={reduce ? false : { scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.7, ease: EASE }}
          className="relative grid size-[4.5rem] place-items-center rounded-full border border-white/40 bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.28),rgba(255,255,255,0.04))] shadow-[0_0_60px_-6px_rgba(232,236,242,0.75)]"
        >
          <svg viewBox="0 0 24 24" className="size-9" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <motion.path
              d="M5 12.5l4.2 4.2L19 7"
              initial={reduce ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.7, ease: EASE, delay: 0.35 }}
            />
          </svg>
        </motion.span>
      </div>

      <motion.h3
        initial={reduce ? false : { opacity: 0, y: 12, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.8, ease: EASE, delay: 0.2 }}
        className="um-title mt-6 text-2xl font-extrabold uppercase tracking-[0.12em] sm:text-3xl"
      >
        Thank you for upgrading
      </motion.h3>
      <motion.p
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.4 }}
        className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-white/60"
      >
        Welcome to <strong className="font-semibold text-white">{plan.name}</strong>. Your new benefits are active
        right now.
      </motion.p>

      {/* receipt */}
      <div className="um-panel mt-7 p-5 text-left sm:p-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.4em] text-white/40">Payment receipt</p>
        <dl className="mt-4 space-y-2.5 text-sm">
          {charged !== null && (
            <ReceiptRow label="Charged today" value={money(charged)} strong />
          )}
          <ReceiptRow label="Paid with" value={cardLabel(card)} />
          {result.nextRenewal && <ReceiptRow label="Next renewal" value={fmtDate(result.nextRenewal)} />}
          <ReceiptRow label="Monthly price from then on" value={`${money(monthly)} / month`} />
          {result.invoiceNumber && <ReceiptRow label="Invoice" value={result.invoiceNumber} />}
        </dl>
        {result.invoiceUrl && (
          <a
            href={result.invoiceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/70 transition-colors hover:text-white"
          >
            View receipt <ExternalLink className="size-3.5" />
          </a>
        )}
      </div>

      {/* slider */}
      {features.length > 0 && (
        <div className="mt-8 text-left">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.4em] text-white/45">
              What’s new for you
            </p>
            <span className="um-count">{features.length} benefits</span>
          </div>
          <FeatureSlider features={features} planName={plan.name} reduce={reduce} />
        </div>
      )}

      <div className="mt-9 flex flex-col gap-3 sm:flex-row-reverse">
        <button type="button" onClick={onAcademy} className="um-primary flex-1">
          Go to the Academy <ArrowRight className="size-4" />
        </button>
        <button type="button" onClick={onClose} className="um-ghost">
          Close
        </button>
      </div>
    </div>
  );
}

function ReceiptRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-white/50">{label}</dt>
      <dd className={strong ? "text-lg font-semibold tabular-nums text-white" : "tabular-nums text-white/85"}>
        {value}
      </dd>
    </div>
  );
}

function FeatureSlider({
  features,
  planName,
  reduce,
}: {
  features: string[];
  planName: string;
  reduce: boolean;
}) {
  const count = features.length;
  const [[index, dir], setPage] = useState<[number, number]>([0, 1]);
  const [paused, setPaused] = useState(false);

  const go = useCallback(
    (delta: number) => setPage(([i]) => [(i + delta + count) % count, delta]),
    [count],
  );

  // Autoplay (restarts after every manual move; stops on hover/focus and for reduced motion).
  useEffect(() => {
    if (reduce || paused || count < 2) return;
    const id = window.setInterval(() => go(1), 4200);
    return () => window.clearInterval(id);
  }, [reduce, paused, count, go, index]);

  const variants = {
    enter: (d: number) => ({ opacity: 0, x: reduce ? 0 : d * 48, filter: reduce ? "blur(0px)" : "blur(6px)" }),
    center: { opacity: 1, x: 0, filter: "blur(0px)" },
    exit: (d: number) => ({ opacity: 0, x: reduce ? 0 : d * -48, filter: reduce ? "blur(0px)" : "blur(6px)" }),
  };

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label="New benefits"
      tabIndex={0}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(1);
        if (e.key === "ArrowLeft") go(-1);
      }}
      className="um-slider"
    >
      <div className="relative min-h-[10.5rem] overflow-hidden">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div
            key={index}
            custom={dir}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: reduce ? 0 : 0.45, ease: EASE }}
            drag={count > 1 ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={(_e, info: { offset: { x: number } }) => {
              if (info.offset.x < -60) go(1);
              else if (info.offset.x > 60) go(-1);
            }}
            aria-live={paused ? "polite" : "off"}
            className="flex min-h-[10.5rem] cursor-grab flex-col items-center justify-center gap-4 px-10 py-6 text-center active:cursor-grabbing"
          >
            <span className="um-slide-icon">
              <Sparkles className="size-5" />
            </span>
            <p className="max-w-sm text-base font-medium leading-snug text-white sm:text-lg">{features[index]}</p>
            <span className="um-new-tag">New with {planName}</span>
          </motion.div>
        </AnimatePresence>

        {count > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Previous benefit" className="um-arrow left-2">
              <ChevronLeft className="size-4" />
            </button>
            <button type="button" onClick={() => go(1)} aria-label="Next benefit" className="um-arrow right-2">
              <ChevronRight className="size-4" />
            </button>
          </>
        )}
      </div>

      {/* progress */}
      <div className="flex items-center justify-between gap-4 border-t border-white/[0.07] px-5 py-3">
        <span className="text-[11px] tabular-nums tracking-[0.2em] text-white/45">
          {String(index + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
        </span>
        {count <= 10 ? (
          <div className="flex items-center gap-1.5" role="tablist" aria-label="Choose benefit">
            {features.map((f, i) => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Benefit ${i + 1}`}
                onClick={() => setPage([i, i > index ? 1 : -1])}
                className={`um-dot ${i === index ? "um-dot-on" : ""}`}
              />
            ))}
          </div>
        ) : (
          <div className="h-[3px] w-32 overflow-hidden rounded-full bg-white/10" aria-hidden>
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-white/60 to-white"
              animate={{ width: `${((index + 1) / count) * 100}%` }}
              transition={{ duration: reduce ? 0 : 0.4, ease: EASE }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

const css = `
@keyframes um-spin { to { transform: rotate(360deg); } }
@keyframes um-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
@keyframes um-pulse { 0%,100% { opacity: .5; } 50% { opacity: .95; } }
@keyframes um-twinkle { 0%,100% { opacity: 0; transform: scale(.3); } 50% { opacity: 1; transform: scale(1); } }

.um-glow { position: absolute; inset: -44px; border-radius: 2rem; pointer-events: none; filter: blur(34px);
  background: radial-gradient(60% 55% at 50% 40%, rgba(220,226,236,.20), transparent 70%); animation: um-pulse 6s ease-in-out infinite; }
.um-wrap { position: relative; padding: 1px; border-radius: 1.25rem; overflow: hidden; isolation: isolate; background: rgba(255,255,255,.08); }
.um-border { position: absolute; inset: -60%; z-index: -1;
  background: conic-gradient(from 0deg, transparent 0 52%, rgba(255,255,255,0) 58%, rgba(232,236,242,.95) 74%, rgba(255,255,255,0) 90%, transparent 100%);
  animation: um-spin 7s linear infinite; }
.um-card { position: relative; border-radius: calc(1.25rem - 1px); background: linear-gradient(180deg, rgba(20,21,27,.97), rgba(8,9,12,.99)); }

.um-title, .um-amount {
  background: linear-gradient(110deg, #6b7280 0%, #f8fafc 25%, #9ca3af 45%, #ffffff 60%, #8b93a1 80%, #f1f5f9 100%);
  background-size: 250% 100%; -webkit-background-clip: text; background-clip: text; color: transparent; animation: um-shimmer 7s linear infinite;
}
.um-panel { border-radius: 1.1rem; border: 1px solid rgba(255,255,255,.1);
  background: linear-gradient(180deg, rgba(255,255,255,.045), rgba(255,255,255,.01)); box-shadow: inset 0 1px 0 rgba(255,255,255,.06); }
.um-chip { display: inline-flex; align-items: center; padding: .5rem 1rem; border-radius: 9999px; font-size: 12px; font-weight: 600; letter-spacing: .15em;
  border: 1px solid rgba(255,255,255,.14); background: rgba(255,255,255,.03); }
.um-chip-hi { color: #fff; border-color: rgba(232,236,242,.6); background: linear-gradient(180deg, rgba(255,255,255,.16), rgba(255,255,255,.03));
  box-shadow: 0 0 30px -6px rgba(232,236,242,.7); }
.um-detail-icon { display: grid; place-items: center; flex-shrink: 0; width: 28px; height: 28px; border-radius: 9999px; color: rgba(255,255,255,.8);
  border: 1px solid rgba(255,255,255,.14); background: rgba(255,255,255,.04); }

.um-icon-btn { display: flex; width: 36px; height: 36px; flex-shrink: 0; align-items: center; justify-content: center; border-radius: 9999px; color: rgba(255,255,255,.7);
  border: 1px solid rgba(255,255,255,.12); transition: color .25s, border-color .25s, box-shadow .25s; }
.um-icon-btn:hover:not(:disabled) { color: #fff; border-color: rgba(255,255,255,.4); box-shadow: 0 0 22px -4px rgba(232,236,242,.5); }
.um-icon-btn:disabled { opacity: .4; }

.um-check-row { display: flex; align-items: flex-start; gap: .75rem; padding: .9rem 1rem; border-radius: .9rem; cursor: pointer;
  border: 1px solid rgba(255,255,255,.1); background: rgba(0,0,0,.35); transition: border-color .25s; }
.um-check-row:hover { border-color: rgba(255,255,255,.25); }
.um-checkbox { margin-top: .2rem; width: 1rem; height: 1rem; flex-shrink: 0; accent-color: #fff; cursor: pointer; }
.um-input { width: 100%; padding: .8rem 2.4rem .8rem 1rem; border-radius: .8rem; font-size: 14px; color: #f3f4f6; outline: none;
  border: 1px solid rgba(255,255,255,.12); background: rgba(0,0,0,.45); transition: border-color .25s, box-shadow .25s; }
.um-input::placeholder { color: rgba(255,255,255,.25); }
.um-input:focus { border-color: rgba(232,236,242,.55); box-shadow: 0 0 0 1px rgba(232,236,242,.3), 0 0 28px -8px rgba(232,236,242,.45); }
.um-input[aria-invalid="true"] { border-color: rgba(248,113,113,.45); }

.um-primary { position: relative; overflow: hidden; display: inline-flex; align-items: center; justify-content: center; gap: .6rem;
  padding: .95rem 1.5rem; border-radius: 9999px; font-size: 12px; font-weight: 700; letter-spacing: .2em; text-transform: uppercase; color: #0b0b0c; cursor: pointer;
  border: 1px solid rgba(255,255,255,.55); background: linear-gradient(180deg, #ffffff, #aab0ba);
  box-shadow: 0 0 36px -8px rgba(232,236,242,.6), inset 0 1px 0 rgba(255,255,255,.9); transition: box-shadow .3s, transform .2s, opacity .2s; }
.um-primary:hover:not(:disabled) { box-shadow: 0 0 52px -6px rgba(232,236,242,.9), inset 0 1px 0 #fff; transform: translateY(-1px); }
.um-primary:disabled { opacity: .4; cursor: not-allowed; }
.um-ghost { padding: .95rem 1.5rem; border-radius: 9999px; font-size: 12px; letter-spacing: .2em; text-transform: uppercase; color: rgba(255,255,255,.7); cursor: pointer;
  border: 1px solid rgba(255,255,255,.18); transition: color .25s, border-color .25s; }
.um-ghost:hover:not(:disabled) { color: #fff; border-color: rgba(255,255,255,.45); }
.um-ghost:disabled { opacity: .4; }

.um-ring { position: absolute; inset: 0; border-radius: 9999px; pointer-events: none;
  background: conic-gradient(from 0deg, transparent 0 55%, rgba(232,236,242,.9) 80%, transparent 100%);
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 1px)); mask: radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 1px));
  animation: um-spin 4s linear infinite; }
.um-sparkle { position: absolute; width: 6px; height: 6px; border-radius: 9999px; background: #fff; box-shadow: 0 0 12px 2px rgba(255,255,255,.8); opacity: 0; animation: um-twinkle 2.6s ease-in-out infinite; }
.um-s1 { left: -6px; top: 14px; } .um-s2 { right: -8px; top: 6px; animation-delay: .6s; } .um-s3 { right: 2px; bottom: -6px; animation-delay: 1.2s; } .um-s4 { left: 4px; bottom: -2px; animation-delay: 1.8s; }

.um-count { font-size: 11px; letter-spacing: .15em; color: rgba(255,255,255,.7); padding: .25rem .7rem; border-radius: 9999px;
  border: 1px solid rgba(232,236,242,.3); background: rgba(255,255,255,.05); }
.um-slider { position: relative; border-radius: 1.1rem; border: 1px solid rgba(255,255,255,.12); outline: none;
  background: radial-gradient(80% 120% at 50% 0%, rgba(232,236,242,.09), transparent 70%), linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.01));
  box-shadow: 0 0 50px -24px rgba(232,236,242,.5), inset 0 1px 0 rgba(255,255,255,.06); }
.um-slider:focus-visible { border-color: rgba(232,236,242,.6); }
.um-slide-icon { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 9999px; color: #fff;
  border: 1px solid rgba(232,236,242,.45); background: radial-gradient(circle at 30% 25%, rgba(255,255,255,.2), rgba(255,255,255,.03)); box-shadow: 0 0 30px -4px rgba(232,236,242,.7); }
.um-new-tag { font-size: 10px; font-weight: 600; letter-spacing: .3em; text-transform: uppercase; color: rgba(255,255,255,.55); }
.um-arrow { position: absolute; top: 50%; transform: translateY(-50%); display: grid; place-items: center; width: 32px; height: 32px; border-radius: 9999px; color: rgba(255,255,255,.7);
  border: 1px solid rgba(255,255,255,.12); background: rgba(0,0,0,.4); cursor: pointer; transition: color .2s, border-color .2s, box-shadow .2s; }
.um-arrow:hover { color: #fff; border-color: rgba(255,255,255,.4); box-shadow: 0 0 20px -4px rgba(232,236,242,.5); }
.um-dot { width: 6px; height: 6px; border-radius: 9999px; background: rgba(255,255,255,.22); cursor: pointer; transition: width .3s, background .3s, box-shadow .3s; }
.um-dot:hover { background: rgba(255,255,255,.5); }
.um-dot-on { width: 20px; background: #fff; box-shadow: 0 0 12px rgba(255,255,255,.7); }

.um-wrap :focus-visible { outline: 2px solid rgba(232,236,242,.8); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
  .um-border, .um-title, .um-amount, .um-glow, .um-ring, .um-sparkle { animation: none !important; }
  .um-sparkle { opacity: .8; }
}
`;