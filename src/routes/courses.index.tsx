// src/routes/courses.index.tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import CourseCard from "@/components/aura/CourseCard";
import ChromeButton from "@/components/aura/ChromeButton";
import { getCoursesPageData } from "@/lib/courses";
import { useAsync } from "@/lib/useAsync";

export const Route = createFileRoute("/courses/")({
  head: () => ({ meta: [{ title: "AURA — Courses" }] }),
  component: CoursesPage,
});

function CoursesPage() {
  const { data, error, loading } = useAsync(getCoursesPageData, []);

  const items = data?.items ?? [];
  const unlocked = items.filter((item) => !item.locked).length;

  return (
    <main className="mx-auto max-w-6xl px-5 pb-28 pt-28 sm:pt-36">
      <motion.header
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-2xl"
      >
        <p className="text-[11px] uppercase tracking-[0.5em] text-neutral-500">COURSES</p>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight text-neutral-100 sm:text-5xl">
          Η μέθοδος, βήμα βήμα.
        </h1>
        <p className="mt-5 text-sm leading-relaxed text-neutral-400 sm:text-base">
          Κάθε course είναι μια σειρά βημάτων: βίντεο, περιγραφή, εκτέλεση. Προχωράς
          όταν είσαι έτοιμος — η πρόοδος αποθηκεύεται αυτόματα.
        </p>
      </motion.header>

      {data && !data.signedIn ? (
        <div className="mt-10 flex flex-col items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-neutral-300">
            Συνδέσου για να δεις τα courses του πλάνου σου.
          </p>
          <Link to="/login">
            <ChromeButton type="button">ΣΥΝΔΕΣΗ</ChromeButton>
          </Link>
        </div>
      ) : null}

      {data?.signedIn && items.length > 0 && unlocked === 0 ? (
        <div className="mt-10 flex flex-col items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-neutral-300">
            Δεν έχεις ενεργό πλάνο που ξεκλειδώνει αυτά τα courses.
          </p>
          <Link to="/pricing">
            <ChromeButton type="button">ΔΕΣ ΤΑ ΠΛΑΝΑ</ChromeButton>
          </Link>
        </div>
      ) : null}

      {loading ? (
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-64 animate-pulse rounded-2xl border border-white/5 bg-white/[0.03]"
            />
          ))}
        </div>
      ) : null}

      {error ? (
        <p className="mt-14 text-sm text-red-400" role="alert">
          {error instanceof Error ? error.message : String(error)}
        </p>
      ) : null}

      {data && items.length === 0 && !loading ? (
        <p className="mt-14 text-sm text-neutral-500">
          Δεν υπάρχουν δημοσιευμένα courses ακόμη.
        </p>
      ) : null}

      {items.length > 0 ? (
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, index) => (
            <CourseCard key={item.course.id} item={item} index={index} />
          ))}
        </div>
      ) : null}
    </main>
  );
}