// src/routes/courses.$slug.tsx
import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { ArrowLeft, Lock } from "lucide-react";
import ChromeButton from "@/components/aura/ChromeButton";
import { getCourseForPlay, getStepVideoUrl } from "@/lib/courses";
import { COURSE_CATEGORIES } from "@/lib/courses.types";
import { getPlan } from "@/lib/plans";
import { useAsync } from "@/lib/useAsync";

export const Route = createFileRoute("/courses/$slug")({
  head: () => ({ meta: [{ title: "AURA — Video" }] }),
  component: CourseVideoPage,
});

function CourseVideoPage() {
  const { slug } = Route.useParams();
  const { data, error, loading } = useAsync(() => getCourseForPlay(slug), [slug]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);

  const course = data?.course ?? null;
  const locked = data?.locked ?? false;

  useEffect(() => {
    let cancelled = false;
    if (!course || locked || !course.video_path) {
      setVideoUrl(null);
      return;
    }
    void getStepVideoUrl(course.video_path, course.id)
      .then((url) => {
        if (!cancelled) setVideoUrl(url);
      })
      .catch((err) => {
        if (!cancelled) {
          setVideoUrl(null);
          setVideoError(err instanceof Error ? err.message : "Το preview απέτυχε.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [course, locked]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#070707]">
        <div className="h-8 w-56 animate-pulse rounded bg-white/10" />
      </main>
    );
  }

  if (error || !course) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#070707] px-5 text-center text-white">
        <h1 className="text-2xl font-semibold">Δεν βρέθηκε</h1>
        <p className="text-sm text-white/50">
          {error instanceof Error ? error.message : "Άγνωστο σφάλμα."}
        </p>
        <Link
          to="/courses"
          className="mt-4 text-[11px] uppercase tracking-[0.35em] text-white/50 hover:text-white"
        >
          ← ΟΛΑ ΤΑ VIDEOS
        </Link>
      </main>
    );
  }

  const categoryLabel = COURSE_CATEGORIES.find((c) => c.key === course.category)?.label;
  const plan = getPlan(course.required_plan);

  return (
    <main className="min-h-screen w-full bg-black text-white">
      <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-8">
        <Link
          to="/courses"
          className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-white/60 transition hover:text-white"
        >
          <ArrowLeft className="size-4" />
          ΟΛΑ ΤΑ VIDEOS
        </Link>
        {categoryLabel ? (
          <span className="rounded-full border border-white/15 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-white/50">
            {categoryLabel}
          </span>
        ) : null}
      </div>

      {locked ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto flex max-w-lg flex-col items-center gap-5 px-5 py-32 text-center"
        >
          <div className="flex size-14 items-center justify-center rounded-2xl border border-white/15 bg-white/5">
            <Lock className="size-6 text-white/60" />
          </div>
          <h1 className="text-2xl font-semibold">{course.title}</h1>
          <p className="text-sm text-white/50">
            Αυτό το video χρειάζεται πλάνο {plan?.name ?? course.required_plan} ή ανώτερο.
          </p>
          <Link to="/pricing">
            <ChromeButton type="button">ΔΕΣ ΤΑ ΠΛΑΝΑ</ChromeButton>
          </Link>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="mx-auto flex max-w-5xl flex-col gap-8 px-0 pb-24 pt-0 sm:px-8 sm:pt-8"
        >
          <div className="relative aspect-video w-full overflow-hidden bg-neutral-950 sm:rounded-2xl">
            {videoUrl ? (
              <video
                src={videoUrl}
                controls
                playsInline
                className="h-full w-full object-contain"
              />
            ) : videoError ? (
              <div className="flex h-full items-center justify-center px-6 text-center text-sm text-red-400">
                {videoError}
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-white/30">
                {course.video_path ? "Φόρτωση βίντεο…" : "Δεν έχει ανέβει ακόμη βίντεο."}
              </div>
            )}
          </div>

          <div className="px-5 sm:px-0">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{course.title}</h1>
            {course.summary ? (
              <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-white/70 sm:text-base">
                {course.summary}
              </p>
            ) : null}
          </div>
        </motion.div>
      )}
    </main>
  );
}