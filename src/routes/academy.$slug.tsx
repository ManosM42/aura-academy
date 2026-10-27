// src/routes/academy/$slug.tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, Clock, Layers, Users } from "lucide-react";
import { getCourseBySlug } from "@/lib/queries";
import { useAsync } from "@/lib/useAsync";
import { ErrorState, LoadingSkeleton } from "@/components/aura/States";
import { CHROME_FILL, ChromeText, EASE, Frame } from "@/components/aura/chrome";

export const Route = createFileRoute("/academy/$slug")({
  component: CoursePage,
});

function CoursePage() {
  const reduce = useReducedMotion();
  const { slug } = Route.useParams();
  const { data, error, loading } = useAsync(() => getCourseBySlug(slug), [slug]);

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#070707] px-4 pb-24 pt-28 text-white sm:px-6 sm:pt-36">
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 hidden aspect-square w-[min(900px,130%)] -translate-x-1/2 -translate-y-1/3 rounded-full md:block"
        style={{ background: "radial-gradient(circle, rgba(255,255,255,0.08) 0%, rgba(170,180,190,0.035) 40%, transparent 70%)" }}
        animate={reduce ? undefined : { opacity: [0.45, 1, 0.45] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative mx-auto max-w-4xl">
        <motion.div whileHover={{ x: -3 }} className="inline-block">
          <Link
            to="/academy"
            className="group inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-white/75 outline-none transition-all hover:border-white/60 hover:bg-white/[0.09] hover:text-white hover:shadow-[0_0_22px_rgba(255,255,255,0.14)] focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-1" />
            Πίσω στην Academy
          </Link>
        </motion.div>

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
            <motion.header
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: EASE }}
              className="mt-8"
            >
              <Frame inner="p-6 sm:p-10">
                <span
                  className="inline-block rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-950"
                  style={{ backgroundImage: CHROME_FILL, boxShadow: "0 0 18px rgba(255,255,255,0.3)" }}
                >
                  {data.level}
                </span>
                <h1 className="mt-5 text-3xl font-extrabold tracking-tight sm:text-5xl">
                  <ChromeText>{data.title}</ChromeText>
                </h1>
                {data.outcome && (
                  <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/65 sm:text-base">{data.outcome}</p>
                )}

                <dl className="mt-8 grid gap-4 sm:grid-cols-3">
                  {data.audience && (
                    <Meta icon={<Users className="size-4" />} label="Για ποιον" value={data.audience} />
                  )}
                  {data.estimated_hours != null && (
                    <Meta icon={<Clock className="size-4" />} label="Διάρκεια" value={`${data.estimated_hours} ώρες`} />
                  )}
                  <Meta icon={<Layers className="size-4" />} label="Modules" value={String(data.modules.length)} />
                </dl>
              </Frame>
            </motion.header>

            <section className="mt-10 space-y-5">
              {data.modules.length === 0 && (
                <p className="text-sm text-white/50">Δεν έχουν προστεθεί modules ακόμη.</p>
              )}

              {data.modules.map((m, i) => (
                <motion.div
                  key={m.id}
                  initial={i < 3 && !reduce ? { opacity: 0, y: 20 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease: EASE, delay: 0.15 + i * 0.07 }}
                  style={{ contentVisibility: "auto", containIntrinsicSize: "auto 260px" }}
                >
                  <Frame inner="p-5 sm:p-7">
                    <div className="flex items-start gap-4">
                      <span
                        className="font-extrabold leading-none text-white/25 sm:text-3xl text-2xl"
                        style={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0">
                        <h2 className="text-lg font-bold text-white sm:text-xl">{m.title}</h2>
                        {m.objective && <p className="mt-1 text-sm leading-relaxed text-white/55">{m.objective}</p>}
                      </div>
                    </div>

                    <ul className="mt-5 space-y-1.5">
                      {m.lessons.map((lesson) => (
                        <li key={lesson.id}>
                          <Link
                            to="/lesson/$lessonId"
                            params={{ lessonId: lesson.id }}
                            className="group flex items-center gap-3 rounded-xl border border-transparent px-3 py-3 text-sm text-white/80 outline-none transition-all duration-300 hover:border-white/25 hover:bg-white/[0.05] hover:text-white hover:shadow-[0_0_24px_rgba(255,255,255,0.06)] focus-visible:border-white/50 focus-visible:ring-2 focus-visible:ring-white/40"
                          >
                            <span className="shrink-0 rounded-full border border-white/15 bg-white/[0.04] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/45 transition-colors group-hover:border-white/40 group-hover:text-white/80">
                              {lesson.type}
                            </span>
                            <span className="min-w-0 flex-1 truncate">{lesson.title}</span>
                            <span
                              className="flex size-7 shrink-0 items-center justify-center rounded-full text-neutral-950 opacity-60 transition-all duration-300 group-hover:translate-x-0.5 group-hover:opacity-100 group-hover:shadow-[0_0_18px_rgba(255,255,255,0.5)]"
                              style={{ backgroundImage: CHROME_FILL }}
                            >
                              <ArrowRight className="size-3.5" />
                            </span>
                          </Link>
                        </li>
                      ))}
                      {m.lessons.length === 0 && (
                        <li className="px-3 py-3 text-sm text-white/40">Χωρίς μαθήματα ακόμη.</li>
                      )}
                    </ul>
                  </Frame>
                </motion.div>
              ))}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function Meta({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <dt className="flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-white/40">
        <span className="text-white/70">{icon}</span>
        {label}
      </dt>
      <dd className="mt-2 text-sm font-semibold text-white/90">{value}</dd>
    </div>
  );
}