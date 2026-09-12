// src/routes/courses.index.tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import CourseCard from "@/components/aura/CourseCard";
import ChromeButton from "@/components/aura/ChromeButton";
import { getCoursesPageData } from "@/lib/courses";
import { COURSE_CATEGORIES } from "@/lib/courses.types";
import { useAsync } from "@/lib/useAsync";
import { BookOpen, Sparkles, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/courses/")({
  head: () => ({ meta: [{ title: "AURA — Courses" }] }),
  component: CoursesPage,
});

function CoursesPage() {
  const { data, error, loading } = useAsync(getCoursesPageData, []);

  const items = data?.items ?? [];
  const unlocked = items.filter((item) => !item.locked).length;

  return (
    <main className="w-full min-h-screen overflow-x-hidden bg-[#070707] px-5 pb-28 pt-28 sm:pt-36 text-white selection:bg-white selection:text-black">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto max-w-6xl"
      >
        <header className="max-w-2xl">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-white/50 mb-3">
            <span className="h-px w-8 bg-gradient-to-r from-white/60 to-transparent" />
            AURA Curriculum
          </div>
          <h1 className="text-4xl font-extrabold uppercase tracking-tight sm:text-5xl text-white">
            Η μέθοδος, <span className="chrome-type font-semibold">βίντεο βίντεο.</span>
          </h1>
          <p className="mt-5 text-sm leading-relaxed text-white/60 sm:text-base">
            Τέσσερις κατηγορίες, ένα βίντεο τη φορά. Βρες την τεχνική που ψάχνεις και
            δες τη ολόκληρη, στην οθόνη σου.
          </p>
        </header>

        {data && !data.signedIn ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-10 flex flex-col items-start gap-4 rounded-2xl border border-white/20 bg-gradient-to-r from-white/[0.06] to-white/[0.02] p-6 sm:flex-row sm:items-center sm:justify-between backdrop-blur-xl shadow-[0_0_30px_rgba(255,255,255,0.03)]"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl border border-white/20 bg-white/5 text-white">
                <Sparkles className="size-5" />
              </div>
              <p className="text-sm text-white/90">
                Συνδέσου για να δεις τα βίντεο του πλάνου σου.
              </p>
            </div>
            <Link to="/login" className="w-full sm:w-auto">
              <ChromeButton type="button" className="w-full sm:w-auto justify-center">
                ΣΥΝΔΕΣΗ
              </ChromeButton>
            </Link>
          </motion.div>
        ) : null}

        {data?.signedIn && items.length > 0 && unlocked === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-10 flex flex-col items-start gap-4 rounded-2xl border border-white/20 bg-gradient-to-r from-white/[0.06] to-white/[0.02] p-6 sm:flex-row sm:items-center sm:justify-between backdrop-blur-xl shadow-[0_0_30px_rgba(255,255,255,0.03)]"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl border border-white/20 bg-white/5 text-white">
                <AlertCircle className="size-5" />
              </div>
              <p className="text-sm text-white/90">
                Δεν έχεις ενεργό πλάνο που ξεκλειδώνει αυτά τα βίντεο.
              </p>
            </div>
            <Link to="/pricing" className="w-full sm:w-auto">
              <ChromeButton type="button" className="w-full sm:w-auto justify-center">
                ΔΕΣ ΤΑ ΠΛΑΝΑ
              </ChromeButton>
            </Link>
          </motion.div>
        ) : null}

        {loading ? (
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-64 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md"
              />
            ))}
          </div>
        ) : null}

        {error ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-14 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-400"
            role="alert"
          >
            {error instanceof Error ? error.message : String(error)}
          </motion.div>
        ) : null}

        {data && items.length === 0 && !loading ? (
          <div className="mt-14 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-sm text-white/50">
            <BookOpen className="size-5 text-white/40" />
            <span>Δεν υπάρχουν δημοσιευμένα βίντεο ακόμη.</span>
          </div>
        ) : null}

        {items.length > 0 ? (
          <div className="mt-14 space-y-16">
            {COURSE_CATEGORIES.map((cat, catIndex) => {
              const catItems = items.filter((item) => item.course.category === cat.key);
              return (
                <motion.section
                  key={cat.key}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.5, delay: Math.min(catIndex * 0.05, 0.2) }}
                >
                  <div className="flex items-baseline gap-4 border-b border-white/10 pb-4">
                    <h2 className="text-2xl font-bold uppercase tracking-tight text-white">
                      {cat.label}
                    </h2>
                    <span className="text-xs uppercase tracking-[0.3em] text-white/40">
                      {catItems.length} {catItems.length === 1 ? "video" : "videos"}
                    </span>
                  </div>

                  {catItems.length === 0 ? (
                    <p className="mt-6 text-sm text-white/40">
                      Δεν υπάρχουν ακόμη βίντεο στην κατηγορία {cat.label}.
                    </p>
                  ) : (
                    <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                      {catItems.map((item, index) => (
                        <CourseCard key={item.course.id} item={item} index={index} />
                      ))}
                    </div>
                  )}
                </motion.section>
              );
            })}
          </div>
        ) : null}
      </motion.div>
    </main>
  );
}