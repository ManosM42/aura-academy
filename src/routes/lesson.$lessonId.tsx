import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  getLesson,
  getLessonProgress,
  saveLessonProgress,
} from "@/lib/queries";
import { useAsync } from "@/lib/useAsync";
import { ErrorState, LoadingSkeleton } from "@/components/aura/States";

export const Route = createFileRoute("/lesson/$lessonId")({
  component: LessonPage,
});

function LessonPage() {
  const { lessonId } = Route.useParams();
  const lesson = useAsync(() => getLesson(lessonId), [lessonId]);
  const progress = useAsync(() => getLessonProgress(lessonId), [lessonId]);

  const [notes, setNotes] = useState("");
  const [completed, setCompleted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    if (progress.data) {
      setNotes(progress.data.notes ?? "");
      setCompleted(progress.data.completed);
    }
  }, [progress.data]);

  async function handleSave(markComplete: boolean) {
    setSaving(true);
    try {
      await saveLessonProgress(lessonId, {
        notes,
        completed: markComplete || completed,
      });
      if (markComplete) setCompleted(true);
      setSavedAt(new Date().toLocaleTimeString("el-GR"));
    } catch (e) {
      alert("Αποτυχία αποθήκευσης: " + (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-12 text-white">
      {lesson.loading && <LoadingSkeleton rows={3} />}
      {lesson.error && <ErrorState message={lesson.error} />}

      {lesson.data && (
        <>
          <header className="mb-6">
            <p className="text-xs uppercase tracking-[0.3em] text-white/40">
              {lesson.data.type}
            </p>
            <h1 className="mt-2 text-2xl font-semibold">{lesson.data.title}</h1>
            {lesson.data.objective && (
              <p className="mt-2 text-sm text-white/60">
                {lesson.data.objective}
              </p>
            )}
          </header>

          {lesson.data.video_url ? (
            <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
              <video
                src={lesson.data.video_url}
                controls
                className="h-full w-full"
              />
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-white/50">
              Δεν υπάρχει βίντεο για αυτό το μάθημα.
            </div>
          )}

          {lesson.data.resources.length > 0 && (
            <section className="mt-6">
              <h2 className="mb-2 text-sm font-medium text-white/70">
                Resources
              </h2>
              <ul className="space-y-1">
                {lesson.data.resources.map((r, i) => (
                  <li key={i}>
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-white/80 underline decoration-white/30 underline-offset-4 hover:text-white"
                    >
                      {r.label}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {lesson.data.transcript && (
            <details className="mt-6 rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <summary className="cursor-pointer text-sm font-medium text-white/70">
                Transcript
              </summary>
              <p className="mt-3 whitespace-pre-wrap text-sm text-white/60">
                {lesson.data.transcript}
              </p>
            </details>
          )}

          <section className="mt-6">
            <h2 className="mb-2 text-sm font-medium text-white/70">
              Οι σημειώσεις μου
            </h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Κράτα σημειώσεις για αυτό το μάθημα…"
              className="w-full rounded-xl border border-white/10 bg-black/40 p-4 text-sm text-white/90 outline-none focus:border-white/30"
            />
          </section>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={() => handleSave(false)}
              disabled={saving}
              className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              {saving ? "Αποθήκευση…" : "Αποθήκευση σημειώσεων"}
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={saving || completed}
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-white/90 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              {completed ? "✓ Ολοκληρωμένο" : "Σήμανση ως ολοκληρωμένο"}
            </button>
            {savedAt && (
              <span className="text-xs text-white/40">
                Αποθηκεύτηκε {savedAt}
              </span>
            )}
          </div>

          <div className="mt-10">
            <Link
              to="/dashboard"
              className="text-xs text-white/50 transition hover:text-white/80"
            >
              ← Πίσω στο Dashboard
            </Link>
          </div>
        </>
      )}
    </main>
  );
}