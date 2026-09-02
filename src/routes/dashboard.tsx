import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  getDashboard,
  getMySkills,
  getSkillAssignments,
  isStaffRole,
} from "@/lib/queries";
import { useAsync } from "@/lib/useAsync";
import { ErrorState, LoadingSkeleton } from "@/components/aura/States";
import type { SkillWithState } from "@/lib/database.types";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { data, error, loading } = useAsync(getDashboard, []);
  const staff = data ? isStaffRole(data.profile.role) : false;

  const skills = useAsync(getMySkills, []);
  const assignments = useAsync(getSkillAssignments, []);

  function isAchieved(s: SkillWithState) {
    const st = s.userSkill?.state ?? "locked";
    return st === "verified" || st === "mastered";
  }

  function isUnlocked(s: SkillWithState, all: SkillWithState[]) {
    if (!s.prerequisites || s.prerequisites.length === 0) return true;
    return s.prerequisites.every((id) => {
      const p = all.find((x) => x.id === id);
      return p ? isAchieved(p) : false;
    });
  }

  const nextSkill = useMemo(() => {
    if (!skills.data) return null;
    return (
      skills.data.find((s) => !isAchieved(s) && isUnlocked(s, skills.data!)) ??
      null
    );
  }, [skills.data]);

  const nextAssignmentId = nextSkill ? assignments.data?.[nextSkill.id] : null;

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-12 text-white">
      {loading && <LoadingSkeleton rows={3} />}
      {error && <ErrorState message={error} />}

      {data && (
        <>
          <header className="mb-8">
            <h1 className="text-2xl font-semibold">
              Καλωσήρθες
              {data.profile.full_name ? `, ${data.profile.full_name}` : ""}.
            </h1>
            <p className="mt-1 text-sm text-white/50">
              AURA level:{" "}
              <span className="text-white/80">{data.profile.level}</span>
            </p>
          </header>

          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Verified skills"
              value={`${data.verifiedSkills} / ${data.totalSkills}`}
            />
            <StatCard
              label="Ανοιχτές υποβολές"
              value={String(data.openSubmissions)}
            />
            <StatCard
              label="Τελευταίο score"
              value={
                data.latestReview?.score != null
                  ? String(data.latestReview.score)
                  : "—"
              }
            />
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <Panel title="Continue learning">
              {data.continueLesson ? (
                <Link
                  to="/lesson/$lessonId"
                  params={{ lessonId: data.continueLesson.id }}
                  className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] p-4 transition hover:bg-white/[0.05]"
                >
                  <span className="text-sm">{data.continueLesson.title}</span>
                  <span className="text-white/40">→</span>
                </Link>
              ) : (
                <p className="text-sm text-white/50">
                  Δεν υπάρχει μάθημα σε εξέλιξη.{" "}
                  <Link to="/academy" className="underline">
                    Πήγαινε στην Academy
                  </Link>
                  .
                </p>
              )}
            </Panel>

            <Panel title="Recent feedback">
              {data.latestReview ? (
                <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4 text-sm">
                  <p className="text-white/80">
                    Απόφαση: {data.latestReview.decision}
                  </p>
                  {data.latestReview.next_actions && (
                    <p className="mt-1 text-white/50">
                      {data.latestReview.next_actions}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-white/50">
                  Δεν υπάρχει feedback ακόμη.
                </p>
              )}
            </Panel>
          </div>

          <div className="mt-4">
            <Panel title="Επόμενη υποβολή">
              {nextSkill ? (
                nextAssignmentId ? (
                  <Link
                    to="/practice/$assignmentId"
                    params={{ assignmentId: nextAssignmentId }}
                    className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] p-4 transition hover:bg-white/[0.05]"
                  >
                    <span className="text-sm">
                      Ανέβασε φωτογραφία για:{" "}
                      <span className="font-medium">{nextSkill.name}</span>
                    </span>
                    <span className="text-white/40">→</span>
                  </Link>
                ) : (
                  <p className="text-sm text-white/50">
                    Το επόμενο skill ({nextSkill.name}) δεν έχει ακόμη
                    assignment.
                  </p>
                )
              ) : skills.data ? (
                <p className="text-sm text-white/50">
                  Έχεις ολοκληρώσει όλα τα διαθέσιμα skills προς το παρόν. 🎉
                </p>
              ) : (
                <p className="text-sm text-white/40">Φόρτωση…</p>
              )}
            </Panel>
          </div>

          <nav className="mt-8 flex flex-wrap gap-3">
            <NavLink to="/academy" label="Academy" />
            <NavLink to="/skills" label="Τα Skills μου" />
            {staff && <NavLink to="/review" label="Review Queue" />}
          </nav>
        </>
      )}
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
      <p className="text-xs uppercase tracking-wide text-white/40">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-medium text-white/70">{title}</h2>
      {children}
    </section>
  );
}

function NavLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
    >
      {label}
    </Link>
  );
}