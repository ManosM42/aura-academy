// src/components/aura/CourseCard.tsx
import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { getPlan } from "@/lib/plans";
import type { CourseListItem } from "@/lib/courses.types";

interface CourseCardProps {
  item: CourseListItem;
  index: number;
}

function formatDuration(seconds: number | null): string | null {
  if (!seconds) return null;
  const mins = Math.round(seconds / 60);
  return `${mins}′`;
}

export default function CourseCard({ item, index }: CourseCardProps) {
  const { course, locked } = item;
  const plan = getPlan(course.required_plan);
  const duration = formatDuration(course.video_duration_seconds);
  const hasVideo = course.video_status === "ready" || course.video_status === "uploaded";

  const cta = locked ? "ΚΛΕΙΔΩΜΕΝΟ" : "ΔΕΣ ΤΟ VIDEO";

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay: Math.min(index * 0.07, 0.35) }}
      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.07] via-white/[0.02] to-transparent p-6 transition-colors duration-500 hover:border-white/25"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-1/2 h-full translate-y-[-30%] bg-[radial-gradient(60%_80%_at_50%_100%,rgba(255,255,255,0.16),transparent_70%)] opacity-0 transition-opacity duration-700 group-hover:opacity-100"
      />

      <div className="relative flex items-center justify-between gap-3">
        <span className="text-[10px] uppercase tracking-[0.4em] text-neutral-500">
          {duration ?? "—"}
        </span>
        <span
          className={[
            "rounded-full border px-3 py-1 text-[9px] uppercase tracking-[0.3em]",
            locked ? "border-white/10 text-neutral-500" : "border-white/25 text-neutral-200",
          ].join(" ")}
        >
          {plan?.name ?? course.required_plan}
        </span>
      </div>

      <h3 className="relative mt-5 text-xl font-semibold tracking-tight text-neutral-100">
        {course.title}
      </h3>

      {course.summary ? (
        <p className="relative mt-3 line-clamp-3 text-sm leading-relaxed text-neutral-400">
          {course.summary}
        </p>
      ) : null}

      {!hasVideo && !locked ? (
        <p className="relative mt-4 text-[10px] uppercase tracking-[0.3em] text-neutral-600">
          Έρχεται σύντομα
        </p>
      ) : null}

      <div className="relative mt-7">
        {locked ? (
          <Link
            to="/pricing"
            className="inline-flex items-center gap-2 border-b border-white/20 pb-1 text-[11px] uppercase tracking-[0.35em] text-neutral-400 transition hover:border-white/60 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/60"
          >
            {cta} — ΔΕΣ ΠΛΑΝΑ →
          </Link>
        ) : (
          <Link
            to="/courses/$slug"
            params={{ slug: course.slug }}
            className="inline-flex items-center gap-2 border-b border-white/30 pb-1 text-[11px] uppercase tracking-[0.35em] text-neutral-100 transition hover:border-white hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/60"
          >
            {cta} →
          </Link>
        )}
      </div>
    </motion.article>
  );
}