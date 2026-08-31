import { createFileRoute, Link } from "@tanstack/react-router";
import { getPublishedCourses } from "@/lib/queries";
import { useAsync } from "@/lib/useAsync";
import type { AuraLevel, Course } from "@/lib/database.types";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "@/components/aura/States";

export const Route = createFileRoute("/academy/")({ component: AcademyPage });

const LEVELS: { key: AuraLevel; label: string }[] = [
  { key: "foundation", label: "Foundation" },
  { key: "professional", label: "Professional" },
  { key: "advanced", label: "Advanced" },
  { key: "master", label: "Master" },
  { key: "educator", label: "Educator" },
];

function AcademyPage() {
  const { data, error, loading } = useAsync(getPublishedCourses, []);

  const grouped = (data ?? []).reduce<Record<string, Course[]>>((acc, c) => {
    (acc[c.level] ??= []).push(c);
    return acc;
  }, {});

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-16 text-white">
      <header className="mb-10">
        <p className="text-xs uppercase tracking-[0.3em] text-white/40">
          Academy
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Επίλεξε τη διαδρομή σου</h1>
        <p className="mt-2 max-w-xl text-sm text-white/60">
          Foundation → Professional → Advanced → Master → Educator. Κάθε course
          δείχνει outcome, χρόνο και τα skills που ξεκλειδώνει.
        </p>
      </header>

      {loading && <LoadingSkeleton rows={4} />}
      {error && <ErrorState message={error} />}

      {data && data.length === 0 && (
        <EmptyState
          title="Δεν υπάρχουν δημοσιευμένα courses ακόμη"
          hint="Μόλις ο Content Manager δημοσιεύσει ένα course, θα εμφανιστεί εδώ."
        />
      )}

      {data && data.length > 0 && (
        <div className="space-y-12">
          {LEVELS.filter((l) => grouped[l.key]?.length).map((level) => (
            <section key={level.key}>
              <h2 className="mb-4 text-sm font-medium uppercase tracking-widest text-white/50">
                {level.label}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {grouped[level.key].map((course) => (
                  <Link
                    key={course.id}
                    to="/academy/$slug"
                    params={{ slug: course.slug }}
                    className="group flex flex-col rounded-xl border border-white/10 bg-white/[0.02] p-5 transition hover:border-white/25 hover:bg-white/[0.05] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                  >
                    <h3 className="text-base font-semibold">{course.title}</h3>
                    {course.outcome && (
                      <p className="mt-2 line-clamp-3 text-sm text-white/60">
                        {course.outcome}
                      </p>
                    )}
                    <div className="mt-4 flex items-center gap-3 text-xs text-white/40">
                      {course.estimated_hours != null && (
                        <span>{course.estimated_hours}h</span>
                      )}
                      <span className="ml-auto text-white/70 transition group-hover:translate-x-0.5">
                        Δες →
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}