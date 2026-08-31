// src/routes/admin.courses.index.tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import ChromeButton from "@/components/aura/ChromeButton";
import { listAllCourses } from "@/lib/courses";
import { getMyProfile } from "@/lib/queries";
import { isContentRole } from "@/lib/roles";
import { useAsync } from "@/lib/useAsync";
import { getPlan } from "@/lib/plans";

export const Route = createFileRoute("/admin/courses/")({
  head: () => ({ meta: [{ title: "AURA — Διαχείριση Courses" }] }),
  component: AdminCoursesPage,
});

async function loadAdminCourses() {
  const profile = await getMyProfile();
  if (!isContentRole(profile.role)) {
    throw new Error("Δεν έχεις δικαίωμα διαχείρισης courses.");
  }
  return listAllCourses();
}

function AdminCoursesPage() {
  const { data, error, loading } = useAsync(loadAdminCourses, []);

  return (
    <main className="mx-auto max-w-5xl px-5 pb-28 pt-28 sm:pt-32">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <Link
            to="/admin"
            className="text-[10px] uppercase tracking-[0.4em] text-neutral-500 transition hover:text-neutral-200"
          >
            ← ADMIN
          </Link>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-100">
            Courses
          </h1>
        </div>
        <Link to="/admin/courses/new">
          <ChromeButton type="button">+ ΝΕΟ COURSE</ChromeButton>
        </Link>
      </div>

      {loading ? (
        <div className="mt-12 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-white/[0.04]" />
          ))}
        </div>
      ) : null}

      {error ? (
        <p className="mt-12 text-sm text-red-400" role="alert">
          {error instanceof Error ? error.message : String(error)}
        </p>
      ) : null}

      {data && data.length === 0 ? (
        <p className="mt-12 text-sm text-neutral-500">Δεν υπάρχει κανένα course ακόμη.</p>
      ) : null}

      {data && data.length > 0 ? (
        <ul className="mt-12 space-y-3">
          {data.map((course, i) => (
            <motion.li
              key={course.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: Math.min(i * 0.04, 0.3) }}
            >
              <Link
                to="/admin/courses/$courseId"
                params={{ courseId: course.id }}
                className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4 transition hover:border-white/30 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-neutral-100">
                    {course.title}
                  </p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.3em] text-neutral-500">
                    /{course.slug} · {course.step_count} ΒΗΜΑΤΑ ·{" "}
                    {getPlan(course.required_plan)?.name ?? course.required_plan}
                  </p>
                </div>
                <span
                  className={[
                    "shrink-0 rounded-full border px-3 py-1 text-[9px] uppercase tracking-[0.3em]",
                    course.status === "published"
                      ? "border-white/30 text-neutral-100"
                      : "border-white/10 text-neutral-500",
                  ].join(" ")}
                >
                  {course.status}
                </span>
              </Link>
            </motion.li>
          ))}
        </ul>
      ) : null}
    </main>
  );
}