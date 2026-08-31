// src/routes/courses.$slug.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import ChromeButton from "@/components/aura/ChromeButton";
import CourseStepPlayer from "@/components/aura/CourseStepPlayer";
import {
  getCourseForPlay,
  getStepVideoUrl,
  markCourseStep,
  resetCourseProgress,
} from "@/lib/courses";
import { useAsync } from "@/lib/useAsync";
import { getPlan } from "@/lib/plans";
import type { CourseProgress } from "@/lib/courses.types";

const FINISH_REDIRECT_MS = 7000;

export const Route = createFileRoute("/courses/$slug")({
  head: () => ({ meta: [{ title: "AURA — Course" }] }),
  component: CoursePlayerPage,
});

function CoursePlayerPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();

  const load = useCallback(() => getCourseForPlay(slug), [slug]);
  const { data, error, loading } = useAsync(load, [slug]);

  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState<CourseProgress | null>(null);
  const [watched, setWatched] = useState(false);
  const [finished, setFinished] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);

  const urlCache = useRef<Map<string, string>>(new Map());
  const initialised = useRef(false);

  const steps = data?.steps ?? [];
  const course = data?.course ?? null;
  const total = steps.length;
  const step = steps[index] ?? null;

  const completedIds = useMemo(
    () => new Set(progress?.completed_step_ids ?? []),
    [progress],
  );

  // Ξεκινά από το πρώτο μη-ολοκληρωμένο βήμα.
  useEffect(() => {
    if (!data || initialised.current) return;
    initialised.current = true;
    setProgress(data.progress);

    const done = new Set(data.progress?.completed_step_ids ?? []);
    const next = data.steps.findIndex((s) => !done.has(s.id));
    setIndex(next === -1 ? 0 : next);
  }, [data]);

  // Signed URL για το τρέχον βήμα, με cache ώστε το back/forward να είναι στιγμιαίο.
  useEffect(() => {
    let cancelled = false;
    setVideoError(null);

    if (!step?.video_path) {
      setVideoUrl(null);
      return;
    }

    const cached = urlCache.current.get(step.video_path);
    if (cached) {
      setVideoUrl(cached);
      return;
    }

    setVideoUrl(null);
    void getStepVideoUrl(step.video_path)
      .then((url) => {
        if (cancelled || !step.video_path) return;
        urlCache.current.set(step.video_path, url);
        setVideoUrl(url);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setVideoError(
          err instanceof Error ? err.message : "Το βίντεο δεν φορτώθηκε.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [step?.id, step?.video_path]);

  useEffect(() => {
    setWatched(false);
  }, [index]);

  // Επιστροφή στη λίστα μετά το μήνυμα τέλους.
  useEffect(() => {
    if (!finished) return;
    const timer = window.setTimeout(
      () => navigate({ to: "/courses", replace: true }),
      FINISH_REDIRECT_MS,
    );
    return () => window.clearTimeout(timer);
  }, [finished, navigate]);

  const handleNext = useCallback(async () => {
    if (!course || !step) return;
    setBusy(true);
    setActionError(null);
    try {
      const updated = await markCourseStep(course.id, step.id);
      setProgress(updated);
      if (index + 1 >= total) {
        setFinished(true);
      } else {
        setIndex(index + 1);
      }
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Η καταγραφή του βήματος απέτυχε.",
      );
    } finally {
      setBusy(false);
    }
  }, [course, step, index, total]);

  const handleReplay = useCallback(async () => {
    if (!course) return;
    setBusy(true);
    setActionError(null);
    try {
      const updated = await resetCourseProgress(course.id);
      setProgress(updated);
      setFinished(false);
      setIndex(0);
      setWatched(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Το replay απέτυχε.");
    } finally {
      setBusy(false);
    }
  }, [course]);

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-5 pb-28 pt-32">
        <div className="h-6 w-40 animate-pulse rounded bg-white/10" />
        <div className="mt-8 aspect-video w-full animate-pulse rounded-2xl bg-white/[0.04]" />
      </main>
    );
  }

  if (error || !course) {
    return (
      <main className="mx-auto max-w-lg px-5 pb-28 pt-32 text-center">
        <h1 className="text-2xl font-semibold text-neutral-100">
          Το course δεν βρέθηκε
        </h1>
        <p className="mt-4 text-sm text-neutral-400">
          {error instanceof Error ? error.message : "Έλεγξε τον σύνδεσμο."}
        </p>
        <div className="mt-8 flex justify-center">
          <Link to="/courses">
            <ChromeButton type="button">ΠΙΣΩ ΣΤΑ COURSES</ChromeButton>
          </Link>
        </div>
      </main>
    );
  }

  if (data?.locked) {
    const plan = getPlan(course.required_plan);
    return (
      <main className="mx-auto max-w-lg px-5 pb-28 pt-32 text-center">
        <p className="text-[11px] uppercase tracking-[0.5em] text-neutral-600">
          ΚΛΕΙΔΩΜΕΝΟ
        </p>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-neutral-100">
          {course.title}
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-neutral-400">
          Αυτό το course ανοίγει με το πλάνο {plan?.name ?? course.required_plan}.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link to="/pricing">
            <ChromeButton type="button">ΔΕΣ ΤΑ ΠΛΑΝΑ</ChromeButton>
          </Link>
          <Link to="/courses">
            <ChromeButton type="button" variant="secondary">
              ΠΙΣΩ ΣΤΑ COURSES
            </ChromeButton>
          </Link>
        </div>
      </main>
    );
  }

  if (total === 0) {
    return (
      <main className="mx-auto max-w-lg px-5 pb-28 pt-32 text-center">
        <h1 className="text-2xl font-semibold text-neutral-100">{course.title}</h1>
        <p className="mt-4 text-sm text-neutral-400">
          Το course δεν έχει βήματα ακόμη.
        </p>
        <div className="mt-8 flex justify-center">
          <Link to="/courses">
            <ChromeButton type="button">ΠΙΣΩ ΣΤΑ COURSES</ChromeButton>
          </Link>
        </div>
      </main>
    );
  }

  const donePct = Math.round((completedIds.size / total) * 100);
  const isLast = index + 1 >= total;

  return (
    <main className="mx-auto max-w-3xl px-5 pb-28 pt-28 sm:pt-32">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <Link
            to="/courses"
            className="text-[10px] uppercase tracking-[0.4em] text-neutral-500 transition hover:text-neutral-200"
          >
            ← COURSES
          </Link>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-neutral-100">
            {course.title}
          </h1>
        </div>
        <span className="text-[10px] uppercase tracking-[0.4em] text-neutral-500">
          {completedIds.size}/{total} ΟΛΟΚΛΗΡΩΜΕΝΑ
        </span>
      </div>

      {/* Chrome rail προόδου */}
      <div className="mt-6 flex items-center gap-1.5" aria-hidden="true">
        {steps.map((s, i) => (
          <span
            key={s.id}
            className={[
              "h-px flex-1 transition-all duration-500",
              completedIds.has(s.id)
                ? "bg-gradient-to-r from-neutral-400 via-white to-neutral-400"
                : i === index
                  ? "bg-white/50"
                  : "bg-white/10",
            ].join(" ")}
          />
        ))}
      </div>
      <p className="mt-3 text-[10px] uppercase tracking-[0.4em] text-neutral-600">
        {donePct}% ΠΡΟΟΔΟΣ
      </p>

      <div className="mt-12">
        <AnimatePresence mode="wait">
          {finished ? (
            <motion.section
              key="finished"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-2xl border border-white/12 bg-gradient-to-b from-white/[0.08] to-transparent p-10 text-center"
            >
              <p className="text-[11px] uppercase tracking-[0.5em] text-neutral-400">
                ΟΛΟΚΛΗΡΩΘΗΚΕ
              </p>
              <h2 className="mt-5 text-3xl font-semibold tracking-tight text-neutral-100">
                Τελείωσες το «{course.title}».
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-neutral-400">
                Καταγράφηκε στο προφίλ σου. Μπορείς να το ξαναδείς από την αρχή
                όποτε θέλεις. Επιστρέφουμε στα courses…
              </p>
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <Link to="/courses">
                  <ChromeButton type="button">ΠΙΣΩ ΣΤΑ COURSES</ChromeButton>
                </Link>
                <ChromeButton
                  type="button"
                  variant="secondary"
                  onClick={() => void handleReplay()}
                  disabled={busy}
                >
                  ΞΑΝΑ ΑΠΟ ΤΗΝ ΑΡΧΗ
                </ChromeButton>
              </div>
            </motion.section>
          ) : step ? (
            <CourseStepPlayer
              step={step}
              index={index}
              total={total}
              videoUrl={videoUrl}
              videoError={videoError}
              alreadyCompleted={completedIds.has(step.id)}
              onWatched={() => setWatched(true)}
            />
          ) : null}
        </AnimatePresence>
      </div>

      {!finished ? (
        <div className="mt-12 space-y-4">
          {actionError ? (
            <p className="text-sm text-red-400" role="alert">
              {actionError}
            </p>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => setIndex((n) => Math.max(0, n - 1))}
              disabled={index === 0 || busy}
              className="text-[10px] uppercase tracking-[0.4em] text-neutral-500 transition hover:text-neutral-200 disabled:opacity-30"
            >
              ← ΠΡΟΗΓΟΥΜΕΝΟ
            </button>

            <ChromeButton
              type="button"
              onClick={() => void handleNext()}
              disabled={!watched || busy}
            >
              {busy
                ? "ΑΠΟΘΗΚΕΥΣΗ…"
                : isLast
                  ? "ΟΛΟΚΛΗΡΩΣΗ COURSE"
                  : "ΕΠΟΜΕΝΟ ΒΗΜΑ"}
            </ChromeButton>
          </div>
        </div>
      ) : null}
    </main>
  );
}