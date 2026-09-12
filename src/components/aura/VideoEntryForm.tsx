// src/components/aura/VideoEntryForm.tsx
import { useCallback, useState } from "react";
import { motion } from "motion/react";
import VideoDropzone, { type VideoUploadMeta } from "@/components/aura/VideoDropzone";
import ChromeButton from "@/components/aura/ChromeButton";
import { COURSE_CATEGORIES, type CourseCategory, type AuraCourse } from "@/lib/courses.types";
import type { AuraLevel } from "@/lib/database.types";
import type { CourseInput } from "@/lib/courses";
import type { PlanId } from "@/lib/plans";

interface VideoEntryFormProps {
  course: AuraCourse | null;
  saving: boolean;
  error: string | null;
  notice: string | null;
  onSave: (input: CourseInput) => void;
  onDelete?: () => void;
  /** Called right after a video finishes uploading, so the parent can
   *  persist it (setCourseVideo) — separate from the title/category Save
   *  button so a big upload never gets lost if the admin doesn't also
   *  click Save. */
  onVideoUploaded: (path: string, durationSeconds: number | null, meta: VideoUploadMeta) => void;
  onVideoCleared: () => void;
  videoPath: string | null;
  courseId: string | null;
}

// Matches the real `aura_level` Postgres enum exactly (verified via
// pg_enum — see check-aura-level.sql). Do not add/rename values here
// without also updating the enum in the database, or inserts will fail
// with "invalid input value for enum aura_level" (Postgres 22P02).
const LEVELS: { key: AuraLevel; label: string }[] = [
  { key: "foundation", label: "Foundation" },
  { key: "professional", label: "Professional" },
  { key: "advanced", label: "Advanced" },
  { key: "master", label: "Master" },
  { key: "educator", label: "Educator" },
];

// Simplified to 2 real-world choices instead of listing all 4 AURA_PLANS:
// "low" makes a course visible to every paying subscriber (low/mid/high/
// limited all rank >= low, per planUnlocks in courses.types.ts). "limited"
// gates a course exclusively to Limited Edition Physical Book buyers —
// who, thanks to the same hierarchy, still see every "ALL" course too.
const PLAN_CHOICES: { key: PlanId; label: string }[] = [
  { key: "low", label: "ALL" },
  { key: "limited", label: "LIMITED" },
];

export default function VideoEntryForm({
  course,
  saving,
  error,
  notice,
  onSave,
  onDelete,
  onVideoUploaded,
  onVideoCleared,
  videoPath,
  courseId,
}: VideoEntryFormProps) {
  const [title, setTitle] = useState(course?.title ?? "");
  const [summary, setSummary] = useState(course?.summary ?? "");
  const [category, setCategory] = useState<CourseCategory>(course?.category ?? "graduation");
  const [level, setLevel] = useState<AuraLevel>(course?.level ?? "foundation");
  const [requiredPlan, setRequiredPlan] = useState<PlanId>(course?.required_plan ?? "low");
  const [status, setStatus] = useState<"draft" | "published" | "archived">(
    (course?.status as "draft" | "published" | "archived") ?? "draft",
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      onSave({ title, summary, category, level, requiredPlan, status });
    },
    [title, summary, category, level, requiredPlan, status, onSave],
  );

  return (
    <motion.form
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      onSubmit={handleSubmit}
      className="space-y-8"
    >
      <div>
        <label className="block text-[10px] uppercase tracking-[0.35em] text-neutral-500">
          Τίτλος
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          placeholder="π.χ. Graduation Bob — Βασική Τεχνική"
          className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-neutral-100 outline-none transition focus:border-white/30"
        />
      </div>

      <div>
        <label className="block text-[10px] uppercase tracking-[0.35em] text-neutral-500">
          Κατηγορία
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          {COURSE_CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setCategory(c.key)}
              className={`rounded-full border px-4 py-2 text-[11px] uppercase tracking-[0.25em] transition ${
                category === c.key
                  ? "border-white/60 bg-white/10 text-white"
                  : "border-white/10 text-neutral-400 hover:border-white/30 hover:text-neutral-200"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-[10px] uppercase tracking-[0.35em] text-neutral-500">
          Επίπεδο
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          {LEVELS.map((l) => (
            <button
              key={l.key}
              type="button"
              onClick={() => setLevel(l.key)}
              className={`rounded-full border px-4 py-2 text-[11px] uppercase tracking-[0.25em] transition ${
                level === l.key
                  ? "border-white/60 bg-white/10 text-white"
                  : "border-white/10 text-neutral-400 hover:border-white/30 hover:text-neutral-200"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-[10px] uppercase tracking-[0.35em] text-neutral-500">
          Περιγραφή
        </label>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={4}
          placeholder="Σύντομη περιγραφή του βίντεο…"
          className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-relaxed text-neutral-100 outline-none transition focus:border-white/30"
        />
      </div>

      <div>
        <label className="block text-[10px] uppercase tracking-[0.35em] text-neutral-500">
          Πλάνο πρόσβασης
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          {PLAN_CHOICES.map((choice) => (
            <button
              key={choice.key}
              type="button"
              onClick={() => setRequiredPlan(choice.key)}
              className={`rounded-full border px-4 py-2 text-[11px] uppercase tracking-[0.25em] transition ${
                requiredPlan === choice.key
                  ? "border-white/60 bg-white/10 text-white"
                  : "border-white/10 text-neutral-400 hover:border-white/30 hover:text-neutral-200"
              }`}
            >
              {choice.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-[10px] uppercase tracking-[0.35em] text-neutral-500">
          Βίντεο
        </label>
        <div className="mt-2">
          {courseId ? (
            <VideoDropzone
              courseId={courseId}
              videoPath={videoPath}
              onUploaded={onVideoUploaded}
              onCleared={onVideoCleared}
              disabled={saving}
            />
          ) : (
            <p className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-6 text-center text-xs text-neutral-500">
              Αποθήκευσε πρώτα τον τίτλο για να ξεκλειδώσει το upload βίντεο.
            </p>
          )}
        </div>
      </div>

      <div>
        <label className="block text-[10px] uppercase tracking-[0.35em] text-neutral-500">
          Κατάσταση
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          {(
            [
              { key: "draft", label: "Πρόχειρο" },
              { key: "published", label: "Δημοσιευμένο" },
              { key: "archived", label: "Αρχειοθετημένο" },
            ] as const
          ).map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setStatus(s.key)}
              className={`rounded-full border px-4 py-2 text-[11px] uppercase tracking-[0.25em] transition ${
                status === s.key
                  ? "border-white/60 bg-white/10 text-white"
                  : "border-white/10 text-neutral-400 hover:border-white/30 hover:text-neutral-200"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="rounded-xl border border-white/15 bg-white/[0.03] px-4 py-3 text-sm text-neutral-300">
          {notice}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-4 pt-2">
        <ChromeButton type="submit" disabled={saving}>
          {saving ? "ΑΠΟΘΗΚΕΥΣΗ…" : "ΑΠΟΘΗΚΕΥΣΗ"}
        </ChromeButton>
        {onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            disabled={saving}
            className="text-[11px] uppercase tracking-[0.3em] text-red-400/80 transition hover:text-red-400"
          >
            Διαγραφή
          </button>
        ) : null}
      </div>
    </motion.form>
  );
}