// src/components/aura/CourseBuilder.tsx
import { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import ChromeButton from "@/components/aura/ChromeButton";
import VideoDropzone from "@/components/aura/VideoDropzone";
import { AURA_PLANS, type PlanId } from "@/lib/plans";
import type { AuraLevel } from "@/lib/database.types";
import type { AuraCourse, CourseStep, StepDraft } from "@/lib/courses.types";
import type { CourseInput } from "@/lib/courses";

const LEVELS: { value: AuraLevel; label: string }[] = [
  { value: "foundation", label: "Foundation" },
  { value: "professional", label: "Professional" },
  { value: "advanced", label: "Advanced" },
  { value: "master", label: "Master" },
  { value: "educator", label: "Educator" },
];

const STATUSES: { value: CourseInput["status"]; label: string }[] = [
  { value: "draft", label: "ΠΡΟΧΕΙΡΟ" },
  { value: "published", label: "ΔΗΜΟΣΙΕΥΜΕΝΟ" },
  { value: "archived", label: "ΑΡΧΕΙΟ" },
];

const fieldClass =
  "w-full rounded-lg border border-white/12 bg-black/40 px-4 py-3 text-sm text-neutral-100 outline-none transition placeholder:text-neutral-600 focus:border-white/40 focus:ring-1 focus:ring-white/20";
const labelClass = "text-[10px] uppercase tracking-[0.4em] text-neutral-500";

function newKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyStep(): StepDraft {
  return {
    key: newKey(),
    id: null,
    title: "",
    description: "",
    videoPath: null,
    videoDurationSeconds: null,
  };
}

export interface CourseBuilderProps {
  /** Το course πρέπει να υπάρχει πριν ανέβει βίντεο (χρειάζεται id για path). */
  course: AuraCourse | null;
  initialSteps: CourseStep[];
  saving: boolean;
  error: string | null;
  notice: string | null;
  onSave: (input: CourseInput, steps: StepDraft[]) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
}

export default function CourseBuilder({
  course,
  initialSteps,
  saving,
  error,
  notice,
  onSave,
  onDelete,
}: CourseBuilderProps) {
  const [title, setTitle] = useState(course?.title ?? "");
  const [summary, setSummary] = useState(course?.summary ?? "");
  const [outcome, setOutcome] = useState(course?.outcome ?? "");
  const [level, setLevel] = useState<AuraLevel>(course?.level ?? "foundation");
  const [requiredPlan, setRequiredPlan] = useState<PlanId>(
    course?.required_plan ?? "starter",
  );
  const [status, setStatus] = useState<CourseInput["status"]>(() => {
    const current = course?.status;
    return current === "published" || current === "archived" ? current : "draft";
  });
  const [sortOrder, setSortOrder] = useState(String(course?.sort_order ?? 0));
  const [estimatedHours, setEstimatedHours] = useState(
    course?.estimated_hours != null ? String(course.estimated_hours) : "",
  );

  const [steps, setSteps] = useState<StepDraft[]>(() =>
    initialSteps.length > 0
      ? initialSteps.map((step) => ({
          key: step.id,
          id: step.id,
          title: step.title,
          description: step.description ?? "",
          videoPath: step.video_path,
          videoDurationSeconds: step.video_duration_seconds,
        }))
      : [emptyStep()],
  );

  const [localError, setLocalError] = useState<string | null>(null);

  const patchStep = useCallback((key: string, patch: Partial<StepDraft>) => {
    setSteps((prev) =>
      prev.map((step) => (step.key === key ? { ...step, ...patch } : step)),
    );
  }, []);

  const move = useCallback((index: number, direction: -1 | 1) => {
    setSteps((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  }, []);

  const remove = useCallback((key: string) => {
    setSteps((prev) => (prev.length <= 1 ? prev : prev.filter((s) => s.key !== key)));
  }, []);

  const invalidStepIndex = useMemo(
    () =>
      steps.findIndex(
        (step) => step.description.trim().length === 0 && step.videoPath === null,
      ),
    [steps],
  );

  const handleSubmit = async () => {
    setLocalError(null);

    if (title.trim().length < 3) {
      setLocalError("Ο τίτλος θέλει τουλάχιστον 3 χαρακτήρες.");
      return;
    }
    if (steps.length === 0) {
      setLocalError("Το course χρειάζεται τουλάχιστον ένα βήμα.");
      return;
    }
    if (invalidStepIndex >= 0) {
      setLocalError(
        `Το βήμα ${invalidStepIndex + 1} είναι κενό: βάλε περιγραφή ή βίντεο.`,
      );
      return;
    }

    const hours = estimatedHours.trim();
    const parsedHours = hours === "" ? null : Number(hours);
    if (parsedHours !== null && (!Number.isFinite(parsedHours) || parsedHours < 0)) {
      setLocalError("Οι ώρες πρέπει να είναι θετικός αριθμός.");
      return;
    }

    const parsedSort = Number(sortOrder.trim() || "0");

    await onSave(
      {
        title,
        summary,
        outcome,
        level,
        requiredPlan,
        status,
        sortOrder: Number.isFinite(parsedSort) ? Math.trunc(parsedSort) : 0,
        estimatedHours: parsedHours,
      },
      steps,
    );
  };

  return (
    <div className="space-y-12">
      {/* ── Στοιχεία course ─────────────────────────────────── */}
      <section className="space-y-6 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-transparent p-6 sm:p-8">
        <h2 className="text-[11px] uppercase tracking-[0.5em] text-neutral-500">
          ΣΤΟΙΧΕΙΑ COURSE
        </h2>

        <div className="space-y-2">
          <label className={labelClass} htmlFor="course-title">
            ΤΙΤΛΟΣ
          </label>
          <input
            id="course-title"
            className={fieldClass}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="π.χ. Fade Foundations"
            maxLength={140}
          />
        </div>

        <div className="space-y-2">
          <label className={labelClass} htmlFor="course-summary">
            ΠΕΡΙΓΡΑΦΗ
          </label>
          <textarea
            id="course-summary"
            className={`${fieldClass} min-h-32 resize-y`}
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            placeholder="Τι μαθαίνει ο μαθητής σε αυτό το course."
          />
        </div>

        <div className="space-y-2">
          <label className={labelClass} htmlFor="course-outcome">
            ΑΠΟΤΕΛΕΣΜΑ (ΠΡΟΑΙΡΕΤΙΚΟ)
          </label>
          <input
            id="course-outcome"
            className={fieldClass}
            value={outcome}
            onChange={(event) => setOutcome(event.target.value)}
            placeholder="π.χ. Καθαρό skin fade σε 25 λεπτά"
            maxLength={200}
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <label className={labelClass} htmlFor="course-plan">
              ΑΠΑΙΤΟΥΜΕΝΟ ΠΛΑΝΟ
            </label>
            <select
              id="course-plan"
              className={fieldClass}
              value={requiredPlan}
              onChange={(event) => setRequiredPlan(event.target.value as PlanId)}
            >
              {AURA_PLANS.map((plan) => (
                <option key={plan.id} value={plan.id} className="bg-black">
                  {plan.name} — {plan.priceLabel}
                </option>
              ))}
            </select>
                        <p className="text-[11px] leading-relaxed text-neutral-500">
              Ισχύει ιεραρχικά: starter &lt; core &lt; full. Ένα course «core»
              το βλέπουν core και full.
            </p>
          </div>

          <div className="space-y-2">
            <label className={labelClass} htmlFor="course-level">
              ΕΠΙΠΕΔΟ
            </label>
            <select
              id="course-level"
              className={fieldClass}
              value={level}
              onChange={(event) => setLevel(event.target.value as AuraLevel)}
            >
              {LEVELS.map((option) => (
                <option key={option.value} value={option.value} className="bg-black">
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className={labelClass} htmlFor="course-status">
              ΚΑΤΑΣΤΑΣΗ
            </label>
            <select
              id="course-status"
              className={fieldClass}
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as CourseInput["status"])
              }
            >
              {STATUSES.map((option) => (
                <option key={option.value} value={option.value} className="bg-black">
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className={labelClass} htmlFor="course-hours">
                ΩΡΕΣ
              </label>
              <input
                id="course-hours"
                className={fieldClass}
                value={estimatedHours}
                onChange={(event) => setEstimatedHours(event.target.value)}
                inputMode="decimal"
                placeholder="2.5"
              />
            </div>
            <div className="space-y-2">
              <label className={labelClass} htmlFor="course-sort">
                ΣΕΙΡΑ
              </label>
              <input
                id="course-sort"
                className={fieldClass}
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value)}
                inputMode="numeric"
                placeholder="0"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Βήματα ──────────────────────────────────────────── */}
      <section className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-[11px] uppercase tracking-[0.5em] text-neutral-500">
            ΒΗΜΑΤΑ — {steps.length}
          </h2>
          <button
            type="button"
            onClick={() => setSteps((prev) => [...prev, emptyStep()])}
            className="rounded-full border border-white/15 px-5 py-2 text-[10px] uppercase tracking-[0.3em] text-neutral-300 transition hover:border-white/40 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
          >
            + ΠΡΟΣΘΕΣΕ ΒΗΜΑ
          </button>
        </div>

        {!course ? (
          <p className="rounded-lg border border-white/10 bg-white/[0.03] px-5 py-4 text-xs leading-relaxed text-neutral-400">
            Αποθήκευσε πρώτα το course για να ενεργοποιηθεί το ανέβασμα βίντεο —
            τα αρχεία αποθηκεύονται κάτω από το id του course.
          </p>
        ) : null}

        <AnimatePresence initial={false}>
          {steps.map((step, index) => (
            <motion.article
              key={step.key}
              layout
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.28 }}
              className="space-y-6 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-transparent p-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-[10px] uppercase tracking-[0.5em] text-neutral-500">
                  ΒΗΜΑ {String(index + 1).padStart(2, "0")}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label={`Μετακίνηση βήματος ${index + 1} πάνω`}
                    className="rounded-full border border-white/12 px-3 py-1 text-xs text-neutral-300 transition hover:border-white/40 disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === steps.length - 1}
                    aria-label={`Μετακίνηση βήματος ${index + 1} κάτω`}
                    className="rounded-full border border-white/12 px-3 py-1 text-xs text-neutral-300 transition hover:border-white/40 disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(step.key)}
                    disabled={steps.length <= 1}
                    className="rounded-full border border-white/12 px-4 py-1 text-[10px] uppercase tracking-[0.3em] text-neutral-400 transition hover:border-red-400/50 hover:text-red-300 disabled:opacity-30"
                  >
                    ΔΙΑΓΡΑΦΗ
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className={labelClass} htmlFor={`step-title-${step.key}`}>
                  ΤΙΤΛΟΣ ΒΗΜΑΤΟΣ
                </label>
                <input
                  id={`step-title-${step.key}`}
                  className={fieldClass}
                  value={step.title}
                  onChange={(event) => patchStep(step.key, { title: event.target.value })}
                  placeholder={`Βήμα ${index + 1}`}
                  maxLength={140}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass} htmlFor={`step-desc-${step.key}`}>
                  ΠΕΡΙΓΡΑΦΗ
                </label>
                <textarea
                  id={`step-desc-${step.key}`}
                  className={`${fieldClass} min-h-36 resize-y`}
                  value={step.description}
                  onChange={(event) =>
                    patchStep(step.key, { description: event.target.value })
                  }
                  placeholder="Οδηγίες, σημεία προσοχής, εργαλεία…"
                />
              </div>

              {course ? (
                <VideoDropzone
                  courseId={course.id}
                  videoPath={step.videoPath}
                  onUploaded={(path, duration) =>
                    patchStep(step.key, {
                      videoPath: path,
                      videoDurationSeconds: duration,
                    })
                  }
                  onCleared={() =>
                    patchStep(step.key, { videoPath: null, videoDurationSeconds: null })
                  }
                  disabled={saving}
                />
              ) : null}
            </motion.article>
          ))}
        </AnimatePresence>
      </section>

      {/* ── Ενέργειες ───────────────────────────────────────── */}
      <div className="space-y-4">
        {localError || error ? (
          <p className="text-sm text-red-400" role="alert">
            {localError ?? error}
          </p>
        ) : null}
        {notice ? (
          <p className="text-sm text-neutral-300" role="status">
            {notice}
          </p>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <ChromeButton type="button" onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? "ΑΠΟΘΗΚΕΥΣΗ…" : "ΑΠΟΘΗΚΕΥΣΗ COURSE"}
          </ChromeButton>

          {onDelete ? (
            <button
              type="button"
              onClick={() => void onDelete()}
              disabled={saving}
              className="rounded-full border border-white/12 px-6 py-2.5 text-[10px] uppercase tracking-[0.35em] text-neutral-400 transition hover:border-red-400/50 hover:text-red-300 disabled:opacity-40"
            >
              ΔΙΑΓΡΑΦΗ COURSE
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}