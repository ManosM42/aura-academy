// src/components/aura/CompletedCourses.tsx
import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { getMyCompletedCourses } from "@/lib/courses";
import { useAsync } from "@/lib/useAsync";

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("el-GR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default function CompletedCourses() {
  const { data, error, loading } = useAsync(getMyCompletedCourses, []);

  return (
    <section className="mt-16">
      <h2 className="text-[11px] uppercase tracking-[0.5em] text-neutral-500">
        ΟΛΟΚΛΗΡΩΜΕΝΑ COURSES
      </h2>

      {loading ? (
        <div className="mt-6 space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-white/[0.04]" />
          ))}
        </div>
      ) : null}

      {error ? (
        <p className="mt-6 text-sm text-red-400" role="alert">
          {error instanceof Error ? error.message : String(error)}
        </p>
      ) : null}

      {data && data.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-500">
          Δεν έχεις ολοκληρώσει course ακόμη.{" "}
          <Link to="/courses" className="text-neutral-300 underline-offset-4 hover:underline">
            Δες τα courses
          </Link>
          .
        </p>
      ) : null}

      {data && data.length > 0 ? (
        <ul className="mt-6 space-y-3">
          {data.map((entry, i) => (
            <motion.li
              key={entry.course.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: Math.min(i * 0.05, 0.3) }}
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 bg-gradient-to-r from-white/[0.06] to-transparent px-5 py-4"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-neutral-100">
                  {entry.course.title}
                </p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.3em] text-neutral-500">
                  {formatDate(entry.completedAt)} · {entry.course.step_count} ΒΗΜΑΤΑ
                  {entry.replays > 0 ? ` · ${entry.replays} REPLAY` : ""}
                </p>
              </div>
              <Link
                to="/courses/$slug"
                params={{ slug: entry.course.slug }}
                className="shrink-0 rounded-full border border-white/20 px-5 py-2 text-[10px] uppercase tracking-[0.3em] text-neutral-200 transition hover:border-white/60 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
              >
                REPLAY
              </Link>
            </motion.li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}