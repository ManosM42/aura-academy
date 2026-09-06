// src/routes/stop-plan.tsx
import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "motion/react";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { isCancellableStatus, useSubscription } from "@/lib/useSubscription";
import { getPlan } from "@/lib/plans";
import { cancelMySubscription } from "@/lib/cancel-subscription";
import ChromeButton from "@/components/aura/ChromeButton";

export const Route = createFileRoute("/stop-plan")({
  head: () => ({ meta: [{ title: "AURA — Stop my plan" }] }),
  component: StopPlanPage,
});

const CONFIRM_PHRASE = "Stop my plan";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("el-GR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d);
}

function StopPlanPage() {
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const userId = session?.user.id;
  const {
    subscription,
    loading: subLoading,
    error: subError,
    refresh,
  } = useSubscription(userId, { includeInactive: true });

  const [agreed, setAgreed] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<{ currentPeriodEnd: string | null } | null>(
    null,
  );

  // Χωρίς session δεν υπάρχει τι να σταματήσουμε — πίσω στο login.
  useEffect(() => {
    if (!authLoading && !session) {
      navigate({ to: "/login", replace: true });
    }
  }, [authLoading, session, navigate]);

  const waiting = authLoading || (Boolean(userId) && subLoading);
  const plan = getPlan(subscription?.plan_id);
  const eligible = subscription != null && isCancellableStatus(subscription.status);
  const alreadyScheduled = subscription?.cancel_at_period_end ?? false;

  const phraseMatches = phrase.trim() === CONFIRM_PHRASE;
  const canConfirm = agreed && phraseMatches && !submitting;

  async function handleConfirm() {
    if (!canConfirm) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await cancelMySubscription();
      setResult({ currentPeriodEnd: res.currentPeriodEnd });
      refresh();
    } catch (e) {
      setSubmitError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (waiting) {
    return (
      <main className="mx-auto max-w-lg px-5 pb-24 pt-32 sm:pt-40" aria-busy="true">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-1/3 rounded bg-white/5" />
          <div className="h-40 rounded-2xl bg-white/5" />
        </div>
      </main>
    );
  }

  if (!session) return null;

  if (!eligible) {
    return (
      <main className="mx-auto max-w-lg px-5 pb-24 pt-32 text-center sm:pt-40">
        <p className="text-[11px] uppercase tracking-[0.5em] text-neutral-600">ΤΟ ΠΑΚΕΤΟ ΜΟΥ</p>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-neutral-100">
          Δεν υπάρχει ενεργή συνδρομή προς ακύρωση
        </h1>
        <p className="mt-3 text-sm text-neutral-400">
          {subError ?? "Δεν βρέθηκε πακέτο συνδεδεμένο με τον λογαριασμό σου."}
        </p>
        <Link to="/profile" className="mt-8 inline-block">
          <ChromeButton type="button" variant="secondary">
            Πίσω στο προφίλ
          </ChromeButton>
        </Link>
      </main>
    );
  }

  const periodEndLabel = formatDate(subscription!.current_period_end);

  if (result || alreadyScheduled) {
    const untilLabel = result ? formatDate(result.currentPeriodEnd) : periodEndLabel;
    return (
      <main className="mx-auto max-w-lg px-5 pb-24 pt-32 sm:pt-40">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center"
        >
          <CheckCircle2 className="mx-auto size-10 text-emerald-400" />
          <h1 className="mt-4 text-2xl font-semibold text-white">
            Το πακέτο σου θα σταματήσει
          </h1>
          <p className="mt-3 text-sm text-white/70">
            Κρατάς πλήρη πρόσβαση μέχρι{" "}
            <span className="font-semibold text-white">{untilLabel}</span>. Μετά από
            αυτή την ημερομηνία δεν θα χρεωθείς ξανά και η συνδρομή δεν θα ανανεωθεί.
          </p>
          <Link to="/profile" className="mt-8 inline-block">
            <ChromeButton type="button">Πίσω στο προφίλ</ChromeButton>
          </Link>
        </motion.div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-5 pb-24 pt-32 sm:pt-40">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <p className="text-[11px] uppercase tracking-[0.5em] text-neutral-600">
          ΤΟ ΠΑΚΕΤΟ ΜΟΥ
        </p>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-neutral-100">
          Σταμάτησε το πακέτο σου
        </h1>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-sm text-white/60">Τρέχον πακέτο</p>
          <p className="mt-1 text-lg font-semibold text-white">
            {plan?.name ?? subscription!.plan_id}
          </p>
          {plan && <p className="mt-1 text-sm text-white/50">{plan.priceLabel} / μήνα</p>}
        </div>

        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-400" />
          <p className="text-sm leading-relaxed text-amber-100/90">
            Δεν χρεώνεσαι ξανά και δεν χάνεις τίποτα από ό,τι έχεις ήδη πληρώσει: κρατάς
            πρόσβαση μέχρι{" "}
            <span className="font-semibold text-white">{periodEndLabel}</span>. Από την
            επόμενη περίοδο χρέωσης η συνδρομή απλώς δεν θα ανανεωθεί.
          </p>
        </div>

        <div className="mt-6 space-y-5">
          <label className="flex items-start gap-3 text-sm text-white/80">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 rounded border-white/20 bg-transparent accent-white"
            />
            <span>
              Διάβασα και συμφωνώ με τους{" "}
              <Link
                to="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4 hover:text-white"
              >
                Όρους Χρήσης
              </Link>
              .
            </span>
          </label>

          <div>
            <label
              htmlFor="stop-phrase"
              className="mb-1.5 block text-xs uppercase tracking-[0.2em] text-white/40"
            >
              Γράψε «{CONFIRM_PHRASE}» για επιβεβαίωση
            </label>
            <input
              id="stop-phrase"
              type="text"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              placeholder={CONFIRM_PHRASE}
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-lg border border-white/15 bg-black/30 px-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-white/30"
            />
          </div>
        </div>

        {submitError && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-300"
          >
            {submitError}
          </p>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          <ChromeButton type="button" onClick={handleConfirm} disabled={!canConfirm}>
            {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
            Confirm
          </ChromeButton>
          <Link to="/profile">
            <ChromeButton type="button" variant="secondary">
              Άσε το πακέτο μου όπως είναι
            </ChromeButton>
          </Link>
        </div>
      </motion.div>
    </main>
  );
}