// src/routes/courses.$slug.tsx
import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { ArrowLeft, Lock, Maximize2, ShieldAlert } from "lucide-react";
import ChromeButton from "@/components/aura/ChromeButton";
import { useAuth } from "@/hooks/useAuth";
import { getCourseForPlay, getStepVideoUrl } from "@/lib/courses";
import { COURSE_CATEGORIES } from "@/lib/courses.types";
import { getPlan } from "@/lib/plans";
import { useAsync } from "@/lib/useAsync";
import { useContentProtection } from "@/lib/useContentProtection";

export const Route = createFileRoute("/courses/$slug")({
  head: () => ({
    meta: [
      { title: "AURA — Video" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CourseVideoPage,
});

/** Viewer-specific watermark: discourages leaks and makes them traceable. */
function Watermark({ label }: { label: string }) {
  const [pos, setPos] = useState({ x: 8, y: 12 });

  useEffect(() => {
    const id = window.setInterval(
      () => setPos({ x: 4 + Math.random() * 55, y: 6 + Math.random() * 80 }),
      6000,
    );
    return () => window.clearInterval(id);
  }, []);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-10 select-none overflow-hidden">
      <span
        style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
        className="absolute whitespace-nowrap text-[11px] font-medium tracking-wide text-white/30 transition-all duration-[2500ms] ease-in-out"
      >
        {label}
      </span>
      <span className="absolute bottom-3 right-4 whitespace-nowrap text-[10px] tracking-wider text-white/20">
        {label}
      </span>
    </div>
  );
}

function CourseVideoPage() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const { data, error, loading } = useAsync(() => getCourseForPlay(slug), [slug]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);

  const playerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const course = data?.course ?? null;
  const locked = data?.locked ?? false;

  const shielded = useContentProtection(Boolean(course) && !locked);
  const watermark = `${user?.email ?? "AURA"} · ${user?.id?.slice(0, 8) ?? ""}`;

  useEffect(() => {
    let cancelled = false;
    setVideoError(null);
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

  // Pause whenever the shield goes up.
  useEffect(() => {
    if (shielded) videoRef.current?.pause();
  }, [shielded]);

  function goFullscreen() {
    const el = playerRef.current;
    const v = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (el?.requestFullscreen) void el.requestFullscreen();
    else v?.webkitEnterFullscreen?.(); // iPhone fallback (no watermark possible there)
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070707]">
        <div className="h-8 w-56 animate-pulse rounded bg-white/10" />
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#070707] px-5 text-center text-white">
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
      </div>
    );
  }

  const categoryLabel = COURSE_CATEGORIES.find((c) => c.key === course.category)?.label;
  const plan = getPlan(course.required_plan);

  return (
    <div className="min-h-screen w-full bg-black text-white">
      {/* Block printing and text selection on this page only */}
      <style>{`
        @media print { html, body { display: none !important; } }
        .protected-page { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
      `}</style>

      <div className="protected-page">
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
            <div
              ref={playerRef}
              className="relative aspect-video w-full overflow-hidden bg-neutral-950 sm:rounded-2xl"
              onContextMenu={(e) => e.preventDefault()}
            >
              {videoUrl ? (
                <>
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    controls
                    controlsList="nodownload nofullscreen noremoteplayback"
                    disablePictureInPicture
                    disableRemotePlayback
                    playsInline
                    onContextMenu={(e) => e.preventDefault()}
                    className="h-full w-full object-contain"
                  />
                  <Watermark label={watermark} />
                  <button
                    type="button"
                    onClick={goFullscreen}
                    aria-label="Πλήρης οθόνη"
                    className="absolute right-3 top-3 z-20 rounded-md bg-black/50 p-2 text-white/80 backdrop-blur transition hover:bg-black/70 hover:text-white"
                  >
                    <Maximize2 className="size-4" />
                  </button>
                </>
              ) : videoError ? (
                <div className="flex h-full items-center justify-center px-6 text-center text-sm text-red-400">
                  {videoError}
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-white/30">
                  {course.video_path ? "Φόρτωση βίντεο…" : "Δεν έχει ανέβει ακόμη βίντεο."}
                </div>
              )}

              {shielded && videoUrl ? (
                <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black text-center">
                  <ShieldAlert className="size-8 text-white/50" />
                  <p className="px-6 text-sm text-white/60">
                    Το περιεχόμενο είναι προστατευμένο. Επέστρεψε σε αυτό το παράθυρο για να συνεχίσεις.
                  </p>
                </div>
              ) : null}
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
      </div>
    </div>
  );
}