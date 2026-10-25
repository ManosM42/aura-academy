import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "motion/react";
import { getMyProfile, getReviewQueue, isStaffRole } from "@/lib/queries";
import { useAsync } from "@/lib/useAsync";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  LockedState,
} from "@/components/aura/States";
import { Sparkles, ShieldAlert, Clock, ChevronRight, User } from "lucide-react";

export const Route = createFileRoute("/review/")({ component: ReviewQueue });

const EASE = [0.22, 1, 0.36, 1] as const;
const CHROME_TEXT =
  "linear-gradient(90deg, #595959 0%, #b3b3b3 25%, #ffffff 50%, #b3b3b3 75%, #595959 100%)";
const FRAME_BORDER =
  "linear-gradient(135deg, rgba(255,255,255,0.45), rgba(255,255,255,0.06) 35%, rgba(255,255,255,0.06) 65%, rgba(255,255,255,0.4))";

function Frame({ children, className = "", inner = "p-6" }: { children: React.ReactNode; className?: string; inner?: string }) {
  return (
    <div className={`relative rounded-3xl p-px ${className}`} style={{ background: FRAME_BORDER, boxShadow: "0 0 60px rgba(0,0,0,0.9)" }}>
      <div className={`relative overflow-hidden rounded-[23px] bg-[#0a0a0b] ${inner}`}>
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-24" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.05), transparent)" }} />
        <div className="relative">{children}</div>
      </div>
    </div>
  );
}

function ReviewQueue() {
  const reduce = useReducedMotion();
  const profile = useAsync(getMyProfile, []);
  const staff = profile.data ? isStaffRole(profile.data.role) : false;
  const queue = useAsync(async () => (staff ? getReviewQueue() : []), [staff]);

  return (
    <main className="relative mx-auto min-h-screen max-w-5xl overflow-hidden px-4 py-16 text-white sm:px-6">
      {/* ambient glow */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 aspect-square w-[min(800px,120%)] -translate-x-1/2 -translate-y-1/3 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(255,255,255,0.09) 0%, rgba(170,180,190,0.04) 40%, transparent 70%)" }}
        animate={reduce ? undefined : { opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* header */}
      <motion.header
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: EASE }}
        className="relative mb-12 flex flex-col justify-between gap-5 border-b border-white/10 pb-8 sm:flex-row sm:items-end"
      >
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.05] px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.3em] text-white/80">
            <Sparkles className="size-3.5" />
            Educator Hub
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">
            <motion.span
              initial={{ backgroundPosition: "0% 50%" }}
              animate={reduce ? undefined : { backgroundPosition: "100% 50%" }}
              transition={{ duration: 4, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
              style={{
                backgroundImage: CHROME_TEXT,
                backgroundSize: "300% auto",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
              className="inline-block drop-shadow-[0_0_30px_rgba(255,255,255,0.5)]"
            >
              Review Queue
            </motion.span>
          </h1>
        </div>

        {queue.data && queue.data.length > 0 && (
          <div className="flex items-center gap-3 self-start rounded-full border border-white/20 bg-white/[0.04] px-4 py-2 text-xs text-white/60 backdrop-blur-md sm:self-auto">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-70" />
              <span className="relative inline-flex size-2 rounded-full bg-white" />
            </span>
            <span>
              <strong className="font-bold text-white">{queue.data.length}</strong> εκκρεμείς αξιολογήσεις
            </span>
          </div>
        )}
      </motion.header>

      <div className="relative">
        {profile.loading && <LoadingSkeleton rows={3} />}
        {profile.error && <ErrorState message={profile.error} />}

        {profile.data && !staff && (
          <Frame inner="p-8 text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl border border-white/20 bg-white/[0.05] text-white">
              <ShieldAlert className="size-6" />
            </div>
            <LockedState reason="Μόνο εκπαιδευτές έχουν πρόσβαση στην ουρά αξιολόγησης." />
          </Frame>
        )}

        {staff && (
          <>
            {queue.loading && <LoadingSkeleton rows={4} />}
            {queue.error && <ErrorState message={queue.error} />}

            {queue.data && queue.data.length === 0 && (
              <Frame inner="p-12 text-center">
                <EmptyState
                  title="Καμία εκκρεμής υποβολή"
                  hint="Όταν ένας student υποβάλει εργασία, θα εμφανιστεί εδώ."
                />
              </Frame>
            )}

            {queue.data && queue.data.length > 0 && (
              <ul className="space-y-4">
                {queue.data.map((row, i) => (
                  <motion.li
                    key={row.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.65, ease: EASE, delay: 0.15 + i * 0.07 }}
                    whileHover={{ y: -3 }}
                  >
                    <Link
                      to="/review/$submissionId"
                      params={{ submissionId: row.id }}
                      className="group block rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                    >
                      <Frame inner="p-5 sm:p-6">
                        {/* hover sweep */}
                        <span
                          aria-hidden
                          className="pointer-events-none absolute inset-y-0 left-0 w-1/3 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.08] to-transparent transition-transform duration-[1200ms] ease-out group-hover:translate-x-[320%]"
                        />
                        <div className="relative flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                          <div className="flex min-w-0 items-start gap-4">
                            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/[0.05] text-white transition-all duration-300 group-hover:scale-105 group-hover:border-white/60 group-hover:shadow-[0_0_26px_rgba(255,255,255,0.35)]">
                              <Clock className="size-5" />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-base font-bold text-white">
                                {row.assignment?.title ?? "—"}
                              </p>
                              <p className="mt-1 flex items-center gap-2 truncate text-xs text-white/50">
                                <User className="size-3.5 text-white/40" />
                                <span className="text-white/70">{row.student?.full_name ?? "Άγνωστος μαθητής"}</span>
                                <span>·</span>
                                <span>attempt {row.attempt}</span>
                              </p>
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-4 self-end sm:self-center">
                            <span className="rounded-full border border-white/25 bg-white/[0.06] px-3.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/80">
                              {row.status}
                            </span>
                            <span
                              className="flex size-9 items-center justify-center rounded-full text-neutral-950 transition-transform duration-300 group-hover:translate-x-1 group-hover:shadow-[0_0_22px_rgba(255,255,255,0.6)]"
                              style={{ backgroundImage: "linear-gradient(180deg,#ffffff,#b4b4bc 50%,#f4f4f6)" }}
                            >
                              <ChevronRight className="size-4" />
                            </span>
                          </div>
                        </div>
                      </Frame>
                    </Link>
                  </motion.li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </main>
  );
}