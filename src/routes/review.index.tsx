import { createFileRoute, Link } from "@tanstack/react-router";
import { getMyProfile, getReviewQueue, isStaffRole } from "@/lib/queries";
import { useAsync } from "@/lib/useAsync";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  LockedState,
} from "@/components/aura/States";

export const Route = createFileRoute("/review/")({ component: ReviewQueue });

function ReviewQueue() {
  const profile = useAsync(getMyProfile, []);
  const staff = profile.data ? isStaffRole(profile.data.role) : false;
  const queue = useAsync(
    async () => (staff ? getReviewQueue() : []),
    [staff],
  );

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-12 text-white">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-[0.3em] text-white/40">
          Educator
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Review Queue</h1>
      </header>

      {profile.loading && <LoadingSkeleton rows={3} />}
      {profile.error && <ErrorState message={profile.error} />}

      {profile.data && !staff && (
        <LockedState reason="Μόνο εκπαιδευτές έχουν πρόσβαση στην ουρά αξιολόγησης." />
      )}

      {staff && (
        <>
          {queue.loading && <LoadingSkeleton rows={4} />}
          {queue.error && <ErrorState message={queue.error} />}
          {queue.data && queue.data.length === 0 && (
            <EmptyState
              title="Καμία εκκρεμής υποβολή"
              hint="Όταν ένας student υποβάλει εργασία, θα εμφανιστεί εδώ."
            />
          )}
          {queue.data && queue.data.length > 0 && (
            <ul className="divide-y divide-white/5 rounded-xl border border-white/10 bg-white/[0.02]">
              {queue.data.map((row) => (
                <li key={row.id}>
                  <Link
                    to="/review/$submissionId"
                    params={{ submissionId: row.id }}
                    className="flex items-center gap-4 p-4 transition hover:bg-white/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {row.assignment?.title ?? "—"}
                      </p>
                      <p className="truncate text-xs text-white/50">
                        {row.student?.full_name ?? "Άγνωστος μαθητής"} · attempt{" "}
                        {row.attempt}
                      </p>
                    </div>
                    <span className="ml-auto rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
                      {row.status}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}