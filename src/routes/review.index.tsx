import { createFileRoute, Link } from "@tanstack/react-router";
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

function ReviewQueue() {
  const profile = useAsync(getMyProfile, []);
  const staff = profile.data ? isStaffRole(profile.data.role) : false;
  const queue = useAsync(
    async () => (staff ? getReviewQueue() : []),
    [staff],
  );

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 sm:px-6 py-16 text-white relative">
      {/* Ambient background blur */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[500px] h-[250px] bg-orange-600/10 blur-[120px] pointer-events-none rounded-full" />

      {/* Header */}
      <header className="mb-12 relative z-10 border-b border-white/10 pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-orange-400 text-xs font-semibold tracking-widest uppercase mb-3 shadow-inner">
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            Educator Hub
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Review Queue
          </h1>
        </div>
        {queue.data && queue.data.length > 0 && (
          <div className="px-4 py-2 rounded-2xl bg-zinc-900/80 border border-white/10 text-xs text-zinc-400 backdrop-blur-md flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping" />
            <strong className="text-white font-bold">{queue.data.length}</strong> εκκρεμείς αξιολογήσεις
          </div>
        )}
      </header>

      <div className="relative z-10">
        {profile.loading && <LoadingSkeleton rows={3} />}
        {profile.error && <ErrorState message={profile.error} />}

        {profile.data && !staff && (
          <div className="p-8 rounded-3xl bg-zinc-950/80 border border-white/10 shadow-[0_0_30px_-5px_rgba(0,0,0,0.8)] backdrop-blur-xl text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-4">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <LockedState reason="Μόνο εκπαιδευτές έχουν πρόσβαση στην ουρά αξιολόγησης." />
          </div>
        )}

        {staff && (
          <>
            {queue.loading && <LoadingSkeleton rows={4} />}
            {queue.error && <ErrorState message={queue.error} />}
            {queue.data && queue.data.length === 0 && (
              <div className="p-12 rounded-3xl bg-zinc-950/80 border border-white/10 shadow-[0_0_30px_-5px_rgba(0,0,0,0.8)] backdrop-blur-xl text-center">
                <EmptyState
                  title="Καμία εκκρεμής υποβολή"
                  hint="Όταν ένας student υποβάλει εργασία, θα εμφανιστεί εδώ."
                />
              </div>
            )}
            {queue.data && queue.data.length > 0 && (
              <div className="rounded-3xl border border-white/10 bg-zinc-950/80 shadow-[0_0_40px_-10px_rgba(0,0,0,0.9)] backdrop-blur-xl overflow-hidden">
                <ul className="divide-y divide-white/5">
                  {queue.data.map((row) => (
                    <li key={row.id} className="group">
                      <Link
                        to="/review/$submissionId"
                        params={{ submissionId: row.id }}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 transition-all duration-300 hover:bg-gradient-to-r hover:from-white/[0.04] hover:to-white/[0.01] focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50"
                      >
                        <div className="flex items-start gap-4 min-w-0">
                          <div className="p-3 rounded-2xl bg-black/60 border border-white/10 text-orange-400 group-hover:border-orange-500/40 group-hover:scale-105 transition-all duration-300 shrink-0">
                            <Clock className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-base font-bold text-white group-hover:text-orange-400 transition-colors">
                              {row.assignment?.title ?? "—"}
                            </p>
                            <p className="flex items-center gap-2 truncate text-xs text-zinc-400 mt-1">
                              <span className="flex items-center gap-1 text-zinc-300">
                                <User className="w-3.5 h-3.5 text-zinc-500" />
                                {row.student?.full_name ?? "Άγνωστος μαθητής"}
                              </span>
                              <span>·</span>
                              <span className="text-orange-400/90 font-medium">attempt {row.attempt}</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 self-end sm:self-center shrink-0">
                          <span className="rounded-full bg-orange-500/10 border border-orange-500/20 px-3.5 py-1 text-xs font-semibold tracking-wide text-orange-400 uppercase">
                            {row.status}
                          </span>
                          <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 group-hover:bg-orange-500 group-hover:text-white group-hover:border-orange-500 transition-all duration-300">
                            <ChevronRight className="w-4 h-4" />
                          </div>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}