// src/routes/courses.$slug.tsx
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft, Lock, Play, Sparkles } from "lucide-react";
import ChromeButton from "@/components/aura/ChromeButton";
import ChromeCursor from "@/components/aura/ChromeCursor";
import { getCourseForPlay, getStepVideoUrl } from "@/lib/courses";
import { COURSE_CATEGORIES } from "@/lib/courses.types";
import { getPlan } from "@/lib/plans";
import { useAsync } from "@/lib/useAsync";

export const Route = createFileRoute("/courses/$slug")({
  head: () => ({ meta: [{ title: "AURA — Video" }] }),
  component: CourseVideoPage,
});

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } } };
const rise = {
  hidden: { opacity: 0, y: 22, filter: "blur(6px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.9, ease: EASE } },
};

/* ------------------------------------------------------------------ */
/* Shared background: grain, atmosphere, grid, floating chrome orbs    */
/* ------------------------------------------------------------------ */

function Backdrop() {
  const reduce = useReducedMotion();
  return (
    <>
      <div className="aura-grain" aria-hidden />
      <div className="hero-atmosphere absolute inset-0" aria-hidden />
      <div className="cv-grid absolute inset-0" aria-hidden />
      {!reduce && (
        <>
          <motion.div
            className="cv-orb left-[6%] top-[10%] h-80 w-80"
            animate={{ y: [0, -34, 0], x: [0, 18, 0] }}
            transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
            aria-hidden
          />
          <motion.div
            className="cv-orb bottom-[6%] right-[4%] h-[26rem] w-[26rem]"
            animate={{ y: [0, 28, 0], x: [0, -22, 0] }}
            transition={{ duration: 19, repeat: Infinity, ease: "easeInOut" }}
            aria-hidden
          />
        </>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function CourseVideoPage() {
  const { slug } = Route.useParams();
  const { data, error, loading } = useAsync(() => getCourseForPlay(slug), [slug]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const infoRef = useRef<HTMLDivElement>(null);

  const course = data?.course ?? null;
  const locked = data?.locked ?? false;

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

  function onInfoMove(e: MouseEvent<HTMLDivElement>) {
    const el = infoRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  }

  /* ---------- loading ---------- */

  if (loading) {
    return (
      <div className="cv-root relative flex min-h-screen items-center justify-center overflow-hidden bg-aura-bg px-5">
        <style>{css}</style>
        <Backdrop />
        <div className="relative z-10 flex w-full max-w-4xl flex-col gap-6">
          <div className="cv-skeleton h-6 w-40 rounded-full" />
          <div className="cv-skeleton aspect-video w-full rounded-2xl" />
          <div className="cv-skeleton h-10 w-2/3 rounded-lg" />
          <div className="cv-skeleton h-4 w-full rounded" />
          <div className="cv-skeleton h-4 w-4/5 rounded" />
        </div>
      </div>
    );
  }

  /* ---------- not found ---------- */

  if (error || !course) {
    return (
      <div className="cv-root relative flex min-h-screen flex-col items-center justify-center gap-4 overflow-hidden bg-aura-bg px-5 text-center text-white">
        <style>{css}</style>
        <Backdrop />
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="relative z-10 flex flex-col items-center gap-4"
        >
          <motion.h1 variants={rise} className="cv-title text-3xl font-bold tracking-tight">
            Δεν βρέθηκε
          </motion.h1>
          <motion.p variants={rise} className="text-sm text-white/50">
            {error instanceof Error ? error.message : "Άγνωστο σφάλμα."}
          </motion.p>
          <motion.div variants={rise}>
            <Link to="/courses" className="cv-back mt-4">
              <ArrowLeft className="size-4" />
              ΟΛΑ ΤΑ VIDEOS
            </Link>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  const categoryLabel = COURSE_CATEGORIES.find((c) => c.key === course.category)?.label;
  const plan = getPlan(course.required_plan);

  return (
    <div className="cv-root relative min-h-screen w-full overflow-x-clip bg-aura-bg text-white">
      <style>{css}</style>
      <ChromeCursor />
      <Backdrop />

      {/* ---------- top bar ---------- */}
      <motion.header
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: EASE }}
        className="cv-bar sticky top-0 z-30"
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link to="/courses" className="cv-back">
            <ArrowLeft className="size-4" />
            ΟΛΑ ΤΑ VIDEOS
          </Link>
          <div className="flex items-center gap-2">
            {plan ? <span className="cv-chip cv-chip-plan">{plan.name}</span> : null}
            {categoryLabel ? <span className="cv-chip">{categoryLabel}</span> : null}
          </div>
        </div>
        <div className="chrome-line h-px w-full" aria-hidden />
      </motion.header>

      {locked ? (
        /* ---------- locked ---------- */
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="relative z-10 mx-auto flex max-w-lg flex-col items-center gap-6 px-5 py-28 text-center sm:py-36"
        >
          <motion.div variants={rise} className="cv-lock">
            <span className="cv-lock-ring" aria-hidden />
            <Lock className="relative size-7 text-white/80" />
          </motion.div>

          <motion.h1 variants={rise} className="cv-title text-3xl font-bold tracking-tight sm:text-4xl">
            {course.title}
          </motion.h1>

          <motion.p variants={rise} className="max-w-sm text-sm leading-relaxed text-white/55">
            Αυτό το video χρειάζεται πλάνο{" "}
            <span className="text-white">{plan?.name ?? course.required_plan}</span> ή ανώτερο.
          </motion.p>

          <motion.div variants={rise}>
            <Link to="/pricing">
              <ChromeButton type="button">ΔΕΣ ΤΑ ΠΛΑΝΑ</ChromeButton>
            </Link>
          </motion.div>
        </motion.div>
      ) : (
        /* ---------- player ---------- */
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="relative z-10 mx-auto flex max-w-6xl flex-col gap-10 px-0 pb-28 pt-0 sm:px-8 sm:pt-10"
        >
          <motion.div variants={rise} className="relative">
            <div className="cv-glow" aria-hidden />

            <div className="cv-frame sm:rounded-[1.4rem]">
              <div className="cv-frame-border" aria-hidden />
              <div className="relative aspect-video w-full overflow-hidden bg-black sm:rounded-[calc(1.4rem-1px)]">
                {videoUrl ? (
                  <video
                    src={videoUrl}
                    controls
                    playsInline
                    className="h-full w-full object-contain"
                  />
                ) : videoError ? (
                  <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
                    <span className="text-sm text-red-300/90">{videoError}</span>
                  </div>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                    {course.video_path ? (
                      <>
                        <span className="cv-spinner" aria-hidden />
                        <span className="text-xs uppercase tracking-[0.3em] text-white/40">
                          Φόρτωση βίντεο
                        </span>
                      </>
                    ) : (
                      <>
                        <div className="cv-play" aria-hidden>
                          <Play className="size-6 text-white/60" />
                        </div>
                        <span className="text-sm text-white/35">Δεν έχει ανέβει ακόμη βίντεο.</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* ---------- info ---------- */}
          <motion.div variants={rise} className="px-5 sm:px-0">
            <div ref={infoRef} onMouseMove={onInfoMove} className="cv-info p-7 sm:p-10">
              <div className="cv-spot" aria-hidden />

              <div className="relative">
                <div className="mb-5 flex items-center gap-3">
                  <Sparkles className="size-4 text-white/60" />
                  <span className="chrome-text text-[11px] font-semibold uppercase tracking-[0.45em]">
                    Aura
                  </span>
                  <span className="h-px flex-1 bg-gradient-to-r from-white/25 to-transparent" aria-hidden />
                </div>

                <h1 className="cv-title text-3xl font-bold tracking-tight sm:text-5xl">
                  {course.title}
                </h1>

                {course.summary ? (
                  <p className="mt-6 max-w-3xl whitespace-pre-line text-sm leading-[1.85] text-white/65 sm:text-base">
                    {course.summary}
                  </p>
                ) : null}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

const css = `
@keyframes cv-spin { to { transform: rotate(360deg); } }
@keyframes cv-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
@keyframes cv-pulse { 0%,100% { opacity: .5; transform: scale(1); } 50% { opacity: .95; transform: scale(1.03); } }
@keyframes cv-skel { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
@keyframes cv-ring { 0% { transform: scale(.85); opacity: .7; } 100% { transform: scale(1.7); opacity: 0; } }

.cv-grid {
  background-image:
    linear-gradient(rgba(255,255,255,.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,.03) 1px, transparent 1px);
  background-size: 58px 58px;
  -webkit-mask-image: radial-gradient(ellipse 75% 55% at 50% 30%, #000 15%, transparent 75%);
          mask-image: radial-gradient(ellipse 75% 55% at 50% 30%, #000 15%, transparent 75%);
  pointer-events: none;
}
.cv-orb {
  position: absolute; border-radius: 9999px; pointer-events: none;
  background: radial-gradient(circle at 35% 30%, rgba(232,236,242,.15), rgba(160,168,180,.05) 45%, transparent 70%);
  filter: blur(44px);
}

/* top bar */
.cv-bar {
  background: linear-gradient(180deg, rgba(8,8,10,.82), rgba(8,8,10,.55));
  -webkit-backdrop-filter: blur(18px); backdrop-filter: blur(18px);
}
.cv-back {
  display: inline-flex; align-items: center; gap: .6rem;
  font-size: 11px; letter-spacing: .3em; text-transform: uppercase; color: rgba(255,255,255,.6);
  transition: color .25s, transform .25s, text-shadow .25s;
}
.cv-back:hover { color: #fff; transform: translateX(-3px); text-shadow: 0 0 18px rgba(232,236,242,.7); }
.cv-chip {
  border-radius: 9999px; padding: .35rem .85rem; font-size: 10px; letter-spacing: .3em; text-transform: uppercase;
  color: rgba(255,255,255,.6); border: 1px solid rgba(255,255,255,.14);
  background: linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,.015));
}
.cv-chip-plan {
  color: #f1f5f9; border-color: rgba(232,236,242,.4);
  box-shadow: 0 0 18px -4px rgba(232,236,242,.5);
}

/* chrome title */
.cv-title {
  background: linear-gradient(110deg, #6b7280 0%, #f8fafc 22%, #9ca3af 42%, #ffffff 58%, #8b93a1 78%, #f1f5f9 100%);
  background-size: 250% 100%;
  -webkit-background-clip: text; background-clip: text; color: transparent;
  animation: cv-shimmer 7s linear infinite;
}

/* player frame */
.cv-glow {
  position: absolute; inset: -6% -4%; pointer-events: none; z-index: 0;
  background: radial-gradient(60% 60% at 50% 50%, rgba(214,222,235,.22), transparent 72%);
  filter: blur(46px); animation: cv-pulse 6s ease-in-out infinite;
}
.cv-frame { position: relative; z-index: 1; overflow: hidden; isolation: isolate; padding: 1px; background: rgba(255,255,255,.07); }
.cv-frame-border {
  position: absolute; inset: -60%; z-index: -1;
  background: conic-gradient(from 0deg, transparent 0 50%, rgba(255,255,255,0) 56%, rgba(232,236,242,.95) 74%, rgba(255,255,255,0) 90%, transparent 100%);
  animation: cv-spin 8s linear infinite;
}

/* info card */
.cv-info {
  position: relative; overflow: hidden; border-radius: 1.4rem;
  border: 1px solid rgba(255,255,255,.1);
  background: linear-gradient(180deg, rgba(22,23,29,.92), rgba(9,10,13,.95));
  -webkit-backdrop-filter: blur(22px); backdrop-filter: blur(22px);
  box-shadow: 0 30px 80px -40px rgba(0,0,0,.9), inset 0 1px 0 rgba(255,255,255,.06);
}
.cv-spot {
  position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(460px circle at var(--mx, 30%) var(--my, 0%), rgba(255,255,255,.08), transparent 60%);
}

/* locked */
.cv-lock {
  position: relative; display: grid; place-items: center; width: 76px; height: 76px; border-radius: 1.2rem;
  border: 1px solid rgba(255,255,255,.18);
  background: radial-gradient(circle at 30% 25%, rgba(255,255,255,.16), rgba(255,255,255,.02));
  box-shadow: 0 0 46px -8px rgba(232,236,242,.5);
}
.cv-lock-ring {
  position: absolute; inset: 0; border-radius: 1.2rem; border: 1px solid rgba(232,236,242,.5);
  animation: cv-ring 2.8s ease-out infinite;
}

/* misc states */
.cv-spinner {
  width: 38px; height: 38px; border-radius: 9999px;
  border: 2px solid rgba(255,255,255,.12); border-top-color: #fff;
  animation: cv-spin .9s linear infinite; box-shadow: 0 0 22px rgba(255,255,255,.22);
}
.cv-play {
  display: grid; place-items: center; width: 64px; height: 64px; border-radius: 9999px;
  border: 1px solid rgba(255,255,255,.16); background: radial-gradient(circle at 30% 25%, rgba(255,255,255,.12), rgba(255,255,255,.02));
  box-shadow: 0 0 36px -8px rgba(232,236,242,.45); animation: cv-pulse 4s ease-in-out infinite;
}
.cv-skeleton {
  background: linear-gradient(100deg, rgba(255,255,255,.04) 30%, rgba(255,255,255,.1) 50%, rgba(255,255,255,.04) 70%);
  background-size: 200% 100%; animation: cv-skel 1.6s linear infinite;
}

@media (prefers-reduced-motion: reduce) {
  .cv-frame-border, .cv-title, .cv-glow, .cv-play, .cv-lock-ring, .cv-spinner, .cv-skeleton { animation: none !important; }
}
`;