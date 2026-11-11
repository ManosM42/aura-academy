// src/components/aura/UpgradeModal.tsx
import { useEffect, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { formatEuro, type AuraPlan } from "@/lib/plans";
import { previewUpgrade, upgradePlan, type UpgradePreview } from "@/lib/changePlan";

interface UpgradeModalProps {
  /** The plan the user wants to upgrade TO. */
  plan: AuraPlan;
  open: boolean;
  onClose: () => void;
  /** Called once after a successful upgrade (refresh the subscription here). */
  onUpgraded: () => void;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("el-GR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function UpgradeModal({ plan, open, onClose, onUpgraded }: UpgradeModalProps) {
  const [preview, setPreview] = useState<UpgradePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneInfo, setDoneInfo] = useState<{ chargedCents: number | null; nextRenewal: string | null } | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  // Load the exact numbers every time the modal opens.
  useEffect(() => {
    if (!open) return;
    let active = true;
    setPreview(null);
    setError(null);
    setDoneInfo(null);
    setSubmitting(false);
    setLoading(true);

    previewUpgrade(plan.id)
      .then((p) => {
        if (active) setPreview(p);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Δεν φορτώθηκαν τα στοιχεία αναβάθμισης.");
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

  async function confirm() {
    if (submitting || doneInfo) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await upgradePlan(plan.id);
      setDoneInfo({ chargedCents: result.chargedCents, nextRenewal: result.nextRenewal });
      onUpgraded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Η αναβάθμιση απέτυχε.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  const money = (cents: number) => formatEuro(cents);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="aura-upgrade-title"
    >
      <button
        type="button"
        aria-label="Κλείσιμο"
        onClick={() => !submitting && onClose()}
        className="absolute inset-0 h-full w-full cursor-default"
        tabIndex={-1}
      />

      <div className="relative z-10 my-auto w-full max-w-md overflow-hidden rounded-2xl border border-white/15 bg-[#050505] shadow-[0_0_120px_-40px_rgba(255,255,255,0.4)]">
        <header className="flex items-center justify-between gap-4 border-b border-white/10 px-6 py-4">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.4em] text-neutral-500">AURA UPGRADE</p>
            <h2 id="aura-upgrade-title" className="truncate text-lg font-semibold tracking-wide text-neutral-100">
              {doneInfo ? "Η αναβάθμιση ολοκληρώθηκε" : `Αναβάθμιση σε ${plan.name}`}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Κλείσιμο"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/15 text-neutral-300 transition-colors hover:border-white/40 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:opacity-40"
          >
            ✕
          </button>
        </header>

        <div className="px-6 py-6">
          {loading && (
            <div className="flex items-center gap-3 py-8 text-sm text-neutral-400" aria-busy="true">
              <Loader2 className="size-4 animate-spin" /> Υπολογισμός…
            </div>
          )}

          {!loading && error && !preview && (
            <p role="alert" className="py-4 text-sm text-red-300">
              {error}
            </p>
          )}

          {preview && !doneInfo && (
            <>
              <dl className="space-y-3 text-sm">
                <div className="flex items-baseline justify-between gap-4 text-neutral-400">
                  <dt>Νέο πλάνο ({preview.targetPlanName})</dt>
                  <dd className="tabular-nums">{money(preview.newAmountCents)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 text-neutral-400">
                  <dt>Πίστωση τρέχοντος ({preview.currentPlanName})</dt>
                  <dd className="tabular-nums">−{money(preview.currentAmountCents)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 border-t border-white/10 pt-4">
                  <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-white">Πληρώνεις σήμερα</dt>
                  <dd className="text-2xl font-semibold tabular-nums text-white">{money(preview.differenceCents)}</dd>
                </div>
              </dl>

              <p className="mt-6 text-xs leading-relaxed text-neutral-500">
                Η χρέωση γίνεται με την κάρτα που έχεις ήδη αποθηκευμένη. Από σήμερα η συνδρομή σου
                ανανεώνεται την ίδια μέρα κάθε μήνα (επόμενη ανανέωση: {fmtDate(preview.nextRenewal)}) με{" "}
                {money(preview.newAmountCents)} / μήνα. Μπορείς να ακυρώσεις ανά πάσα στιγμή.
              </p>

              {error && (
                <p role="alert" className="mt-4 text-sm text-red-300">
                  {error}
                </p>
              )}

              <div className="mt-6 flex flex-col gap-3 sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={() => void confirm()}
                  disabled={submitting}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-white/40 bg-gradient-to-b from-white/95 to-white/70 px-6 py-3 text-xs font-bold uppercase tracking-[0.25em] text-black shadow-[0_0_34px_rgba(220,226,235,0.3)] transition-all hover:shadow-[0_0_48px_rgba(220,226,235,0.55)] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting && <Loader2 className="size-4 animate-spin" />}
                  {submitting ? "Επεξεργασία…" : `Πληρωμή ${money(preview.differenceCents)}`}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="rounded-full border border-white/20 px-6 py-3 text-xs uppercase tracking-[0.2em] text-neutral-300 transition-colors hover:border-white/50 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:opacity-40"
                >
                  Άκυρο
                </button>
              </div>
            </>
          )}

          {doneInfo && (
            <div className="flex flex-col items-start gap-4">
              <span className="inline-grid size-10 place-items-center rounded-full border border-white/40 bg-white/10 text-white">
                <Check className="size-5" />
              </span>
              <p className="text-sm leading-relaxed text-neutral-300">
                Έχεις πλέον το <strong className="text-white">{plan.name}</strong>.
                {doneInfo.chargedCents !== null && <> Χρεώθηκες {money(doneInfo.chargedCents)}.</>}
                {doneInfo.nextRenewal && <> Η επόμενη ανανέωση είναι στις {fmtDate(doneInfo.nextRenewal)}.</>}
              </p>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-white/20 px-6 py-3 text-xs uppercase tracking-[0.2em] text-neutral-200 transition-colors hover:border-white/50 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
              >
                Τέλεια
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}