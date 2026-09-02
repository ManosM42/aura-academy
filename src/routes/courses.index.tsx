import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import CourseCard from "@/components/aura/CourseCard";
import ChromeButton from "@/components/aura/ChromeButton";
import { getCoursesPageData } from "@/lib/courses";
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
            Η μέθοδος, <span className="chrome-type font-semibold">βήμα βήμα.</span>
          </h1>
          <p className="mt-5 text-sm leading-relaxed text-white/60 sm:text-base">
            Κάθε course είναι μια σειρά βημάτων: βίντεο, περιγραφή, εκτέλεση. Προχωράς
            όταν είσαι έτοιμος — η πρόοδος αποθηκεύεται αυτόματα.
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
                Συνδέσου για να δεις τα courses του πλάνου σου.
              </p>
            </div>
            <Link to="/login" className="w-full sm:w-auto">
              <ChromeButton type="button" className="w-full sm:w-auto justify-center">ΣΥΝΔΕΣΗ</ChromeButton>
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
                Δεν έχεις ενεργό πλάνο που ξεκλειδώνει αυτά τα courses.
              </p>
            </div>
            <Link to="/pricing" className="w-full sm:w-auto">
              <ChromeButton type="button" className="w-full sm:w-auto justify-center">ΔΕΣ ΤΑ ΠΛΑΝΑ</ChromeButton>
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
            <span>Δεν υπάρχουν δημοσιευμένα courses ακόμη.</span>
          </div>
        ) : null}

        {items.length > 0 ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            {items.map((item, index) => (
              <CourseCard key={item.course.id} item={item} index={index} />
            ))}
          </motion.div>
        ) : null}
      </motion.div>
    </main>
  );
}