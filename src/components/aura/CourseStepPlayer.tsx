// src/components/aura/CourseStepPlayer.tsx
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import type { CourseStep } from "@/lib/courses.types";

interface CourseStepPlayerProps {
  step: CourseStep;
  index: number;
  total: number;
  videoUrl: string | null;
  videoError: string | null;
  /** Το βήμα έχει ήδη ολοκληρωθεί σε προηγούμενη προβολή. */
  alreadyCompleted: boolean;
  onWatched: () => void;
}

export default function CourseStepPlayer({
  step,
  index,
  total,
  videoUrl,
  videoError,
  alreadyCompleted,
  onWatched,
}: CourseStepPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const notifiedRef = useRef(false);
  const [watchedPct, setWatchedPct] = useState(0);

  // Νέο βήμα → μηδενίζουμε το gate.
  useEffect(() => {
    notifiedRef.current = false;
    setWatchedPct(0);
    const el = videoRef.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
  }, [step.id]);

  // Βήμα χωρίς βίντεο ή ήδη ολοκληρωμένο: ξεκλειδώνει αμέσως.
  useEffect(() => {
    if (notifiedRef.current) return;
    if (!step.video_path || alreadyCompleted) {
      notifiedRef.current = true;
      onWatched();
    }
  }, [step.id, step.video_path, alreadyCompleted, onWatched]);

  const notifyOnce = () => {
    if (notifiedRef.current) return;
    notifiedRef.current = true;
    onWatched();
  };

  return (
    <motion.section
      key={step.id}
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -28 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-8"
      aria-label={`Βήμα ${index + 1} από ${total}`}
    >
      <header className="space-y-3">
        <p className="text-[10px] uppercase tracking-[0.5em] text-neutral-500">
          ΒΗΜΑ {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </p>
        <h2 className="text-2xl font-semibold tracking-tight text-neutral-100 sm:text-3xl">
          {step.title || `Βήμα ${index + 1}`}
        </h2>
      </header>

      {step.video_path ? (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black shadow-[0_0_60px_-20px_rgba(255,255,255,0.25)]">
          {videoError ? (
            <div className="flex aspect-video w-full items-center justify-center px-6 text-center text-sm text-red-400">
              {videoError}
            </div>
          ) : videoUrl ? (
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              playsInline
              preload="metadata"
              controlsList="nodownload"
              onContextMenu={(event) => event.preventDefault()}
              onEnded={notifyOnce}
              onTimeUpdate={(event) => {
                const el = event.currentTarget;
                if (!Number.isFinite(el.duration) || el.duration <= 0) return;
                const pct = (el.currentTime / el.duration) * 100;
                setWatchedPct(pct);
                // Μερικά mp4 δεν πυροδοτούν 'ended' μετά από seek.
                if (pct >= 95) notifyOnce();
              }}
              className="aspect-video w-full bg-black"
            />
          ) : (
            <div className="flex aspect-video w-full items-center justify-center text-xs uppercase tracking-[0.4em] text-neutral-500">
              ΦΟΡΤΩΣΗ ΒΙΝΤΕΟ…
            </div>
          )}
        </div>
      ) : null}

      {step.description ? (
        <div className="space-y-4 border-l border-white/10 pl-5">
          {step.description
            .split(/\n{2,}/)
            .map((paragraph) => paragraph.trim())
            .filter(Boolean)
            .map((paragraph, i) => (
              <p
                key={`${step.id}-p-${i}`}
                className="whitespace-pre-line text-sm leading-relaxed text-neutral-300 sm:text-base"
              >
                {paragraph}
              </p>
            ))}
        </div>
      ) : null}

      {step.video_path && !alreadyCompleted ? (
        <p className="text-[11px] uppercase tracking-[0.3em] text-neutral-600">
          {watchedPct >= 95
            ? "ΤΟ ΒΙΝΤΕΟ ΟΛΟΚΛΗΡΩΘΗΚΕ"
            : `ΠΑΡΑΚΟΛΟΥΘΗΣΗ ${Math.floor(watchedPct)}% — ΤΕΛΕΙΩΣΕ ΤΟ ΒΙΝΤΕΟ ΓΙΑ ΤΟ ΕΠΟΜΕΝΟ ΒΗΜΑ`}
        </p>
      ) : null}
    </motion.section>
  );
}