import { createFileRoute, Link } from "@tanstack/react-router";
import { getCourseBySlug } from "@/lib/queries";
import { useAsync } from "@/lib/useAsync";
import { ErrorState, LoadingSkeleton } from "@/components/aura/States";

export const Route = createFileRoute("/academy/$slug")({
  component: CoursePage,
});

function CoursePage() {
  const { slug } = Route.useParams();
  const { data, error, loading } = useAsync(
    () => getCourseBySlug(slug),
    [slug],
  );

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-16 text-white">
      <Link
        to="/academy"
        className="text-xs text-white/50 transition hover:text-white/80"
      >
        ← Πίσω στην Academy
      </Link>

      {loading && (
        <div className="mt-8">
          <LoadingSkeleton rows={4} />
        </div>
      )}
      {error && (
        <div className="mt-8">
          <ErrorState message={error} />
        </div>
      )}

      {data && (
        <>
          <header className="mt-6 border-b border-white/10 pb-8">
            <p className="text-xs uppercase tracking-[0.3em] text-white/40">
              {data.level}
            </p>
            <h1 className="mt-2 text-3xl font-semibold">{data.title}</h1>
            {data.outcome && (
              <p className="mt-3 max-w-2xl text-sm text-white/70">
                {data.outcome}
              </p>
            )}
            <dl className="mt-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              {data.audience && (
                <div>
                  <dt className="text-white/40">Για ποιον</dt>
                  <dd className="mt-1 text-white/80">{data.audience}</dd>
                </div>
              )}
              {data.estimated_hours != null && (
                <div>
                  <dt className="text-white/40">Διάρκεια</dt>
                  <dd className="mt-1 text-white/80">
                    {data.estimated_hours} ώρες
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-white/40">Modules</dt>
                <dd className="mt-1 text-white/80">{data.modules.length}</dd>
              </div>
            </dl>
          </header>

          <section className="mt-8 space-y-6">
            {data.modules.length === 0 && (
              <p className="text-sm text-white/50">
                Δεν έχουν προστεθεί modules ακόμη.
              </p>
            )}
            {data.modules.map((m, i) => (
              <div
                key={m.id}
                className="rounded-xl border border-white/10 bg-white/[0.02] p-5"
              >
                <h2 className="text-base font-semibold">
                  <span className="text-white/40">
                    {String(i + 1).padStart(2, "0")}
                  </span>{" "}
                  {m.title}
                </h2>
                {m.objective && (
                  <p className="mt-1 text-sm text-white/60">{m.objective}</p>
                )}
                <ul className="mt-4 divide-y divide-white/5">
                  {m.lessons.map((lesson) => (
                    <li key={lesson.id}>
                      <Link
                        to="/lesson/$lessonId"
                        params={{ lessonId: lesson.id }}
                        className="flex items-center gap-3 py-3 text-sm text-white/80 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                      >
                        <span className="text-xs uppercase tracking-wide text-white/30">
                          {lesson.type}
                        </span>
                        <span>{lesson.title}</span>
                        <span className="ml-auto text-white/40">→</span>
                      </Link>
                    </li>
                  ))}
                  {m.lessons.length === 0 && (
                    <li className="py-3 text-sm text-white/40">
                      Χωρίς μαθήματα ακόμη.
                    </li>
                  )}
                </ul>
              </div>
            ))}
          </section>
        </>
      )}
    </main>
  );
}