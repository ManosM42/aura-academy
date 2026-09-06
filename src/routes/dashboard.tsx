import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import {
  getDashboard,
  getMySkills,
  getSkillAssignments,
  isStaffRole,
} from "@/lib/queries";
import { useAsync } from "@/lib/useAsync";
import { ErrorState, LoadingSkeleton } from "@/components/aura/States";
import SubscriptionCard from "@/components/aura/SubscriptionCard";
import SkillTreeGraph from "@/components/aura/SkillTreeGraph";
import { RankIcon } from "@/components/aura/RankIcon";
import { getRankForPoints } from "@/lib/ranks";
import type { SkillCategory, SkillState, SkillWithState } from "@/lib/database.types";
import { ArrowRight, BookOpen, CheckCircle, ShieldCheck, Trophy, UserCheck } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

const STATE_STYLE: Record<SkillState, string> = {
  locked: "bg-white/5 text-white/40",
  learning: "bg-blue-500/15 text-blue-300",
  practicing: "bg-amber-500/15 text-amber-300",
  verified: "bg-emerald-500/15 text-emerald-300",
  mastered: "bg-violet-500/15 text-violet-300",
};

const CATEGORY_LABEL: Record<SkillCategory, string> = {
  foundation: "Foundation",
  technical: "Technical",
  analysis: "Analysis",
  design: "Design",
  business: "Business",
  educator: "Educator",
};

const ACHIEVED_STATES: SkillState[] = ["verified", "mastered"];

function isAchieved(skill: SkillWithState): boolean {
  return ACHIEVED_STATES.includes(skill.userSkill?.state ?? "locked");
}

function isUnlocked(skill: SkillWithState, all: SkillWithState[]): boolean {
  if (!skill.prerequisites || skill.prerequisites.length === 0) return true;
  return skill.prerequisites.every((prereqId) => {
    const prereq = all.find((s) => s.id === prereqId);
    return prereq ? isAchieved(prereq) : false;
  });
}

function DashboardPage() {
  const { data, error, loading } = useAsync(getDashboard, []);
  const staff = data ? isStaffRole(data.profile.role) : false;

  const skills = useAsync(getMySkills, []);
  const assignments = useAsync(getSkillAssignments, []);

  const rank = useMemo(() => {
    if (!data?.profile) return getRankForPoints(0);
    return getRankForPoints(data.profile.points ?? 0);
  }, [data?.profile]);

  const nextSkill = useMemo(() => {
    if (!skills.data) return null;
    return (
      skills.data.find((s) => !isAchieved(s) && isUnlocked(s, skills.data!)) ??
      null
    );
  }, [skills.data]);

  const nextAssignmentId = nextSkill ? assignments.data?.[nextSkill.id] : null;

  const groupedSkills = useMemo(() => {
    if (!skills.data) return {};
    return skills.data.reduce<Record<string, SkillWithState[]>>(
      (acc, s) => {
        (acc[s.category] ??= []).push(s);
        return acc;
      },
      {},
    );
  }, [skills.data]);

  return (
    <main className="w-full min-h-screen overflow-x-hidden bg-[#070707] px-4 sm:px-6 md:px-10 py-12 text-white selection:bg-white selection:text-black">
      {loading && (
        <div className="mx-auto max-w-5xl">
          <LoadingSkeleton rows={3} />
        </div>
      )}
      {error && (
        <div className="mx-auto max-w-5xl">
          <ErrorState message={error} />
        </div>
      )}

      {data && (
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto max-w-6xl space-y-8"
        >
          <header className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-white/10 pb-6 gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-white/50 mb-2">
                <span className="h-px w-8 bg-gradient-to-r from-white/60 to-transparent" />
                AURA Command Center
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold uppercase tracking-tight">
                Καλωσήρθες
                {data.profile.full_name ? <span className="chrome-type font-semibold">, {data.profile.full_name}</span> : ""}.
              </h1>
            </div>
            <div className="inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/[0.03] px-4 py-2 backdrop-blur-md shadow-[0_0_20px_rgba(255,255,255,0.03)] self-start md:self-auto">
              <RankIcon rank={rank.key} size={24} />
              <div className="flex items-center gap-1.5">
                <span className="text-xs uppercase tracking-wider text-white/60">Aura Rank:</span>
                <span className="font-bold text-white">{rank.label}</span>
              </div>
            </div>
          </header>

          <div className="grid gap-5 sm:grid-cols-3">
            <StatCard
              label="Verified skills"
              value={`${data.verifiedSkills} / ${data.totalSkills}`}
              icon={<ShieldCheck className="size-5 text-white/70" />}
            />
            <StatCard
              label="Ανοιχτές υποβολές"
              value={String(data.openSubmissions)}
              icon={<CheckCircle className="size-5 text-white/70" />}
            />
            <StatCard
              label="Τελευταίο score"
              value={
                data.latestReview?.score != null
                  ? String(data.latestReview.score)
                  : "—"
              }
              icon={<Trophy className="size-5 text-white/70" />}
            />
          </div>

          {/* Active Subscription / Plan Section */}
          <div className="w-full">
            <SubscriptionCard userId={data.profile.id} />
          </div>

          {/* Skill Progression Tree Section */}
          {skills.data && skills.data.length > 0 && (
            <div className="w-full space-y-3">
              <div className="px-1">
                <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-white/60 flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-white/60" />
                  Skill Progression Tree
                </h2>
                <p className="mt-1 text-xs text-white/50">
                  Locked → Learning → Practicing → Verified → Mastered. Για να ξεκλειδώσεις ένα skill πρέπει πρώτα να έχεις verified όλα τα προαπαιτούμενά του.
                </p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-zinc-950/80 p-6 shadow-[0_0_40px_-10px_rgba(0,0,0,0.9)] backdrop-blur-xl">
                <SkillTreeGraph skills={skills.data} />
              </div>
            </div>
          )}

          {/* Detailed Categorized Skills Breakdown */}
          {skills.data && skills.data.length > 0 && (
            <div className="space-y-6 pt-4">
              <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-white/60 flex items-center gap-2 px-1">
                <span className="size-1.5 rounded-full bg-white/60" />
                Αναλυτική Λίστα Skills
              </h2>
              <div className="space-y-8">
                {(Object.keys(groupedSkills) as SkillCategory[]).map((cat) => (
                  <section key={cat} className="space-y-3">
                    <h3 className="text-xs font-medium uppercase tracking-widest text-white/50 px-1">
                      {CATEGORY_LABEL[cat] ?? cat}
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {groupedSkills[cat]!.map((s) => {
                        const state = s.userSkill?.state ?? "locked";
                        const achieved = isAchieved(s);
                        const unlocked = isUnlocked(s, skills.data!);
                        const assignmentId = assignments.data?.[s.id];
                        const missingPrereqs = (s.prerequisites ?? [])
                          .map((id) => skills.data!.find((sk) => sk.id === id))
                          .filter((sk) => sk && !isAchieved(sk));

                        return (
                          <div
                            key={s.id}
                            className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4 backdrop-blur-xl transition-all duration-300 hover:border-white/25 shadow-[0_0_20px_-5px_rgba(0,0,0,0.8)]"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <h4 className="text-sm font-medium text-white">{s.name}</h4>
                              <span
                                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium uppercase tracking-wider ${STATE_STYLE[state]}`}
                              >
                                {state}
                              </span>
                            </div>
                            {s.definition && (
                              <p className="mt-2 line-clamp-2 text-xs text-white/50 leading-relaxed">
                                {s.definition}
                              </p>
                            )}
                            <div className="mt-3 flex items-center gap-3 text-xs text-white/40 font-mono">
                              {s.userSkill?.score != null && (
                                <span>Score {s.userSkill.score}</span>
                              )}
                              {s.userSkill?.verified_at && (
                                <span>
                                  Verified{" "}
                                  {new Date(
                                    s.userSkill.verified_at,
                                  ).toLocaleDateString("el-GR")}
                                </span>
                              )}
                            </div>

                            {/* CTA: upload μόνο αν unlocked & όχι ήδη achieved */}
                            <div className="mt-4 pt-3 border-t border-white/5">
                              {achieved ? (
                                <span className="text-xs font-medium text-emerald-300 flex items-center gap-1.5">
                                  ✓ Ολοκληρώθηκε
                                </span>
                              ) : unlocked ? (
                                assignmentId ? (
                                  <Link
                                    to="/practice/$assignmentId"
                                    params={{ assignmentId }}
                                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-white/15 hover:border-white/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                                  >
                                    <span>Ανέβασε φωτογραφία κουρέματος</span>
                                    <ArrowRight className="size-3.5" />
                                  </Link>
                                ) : (
                                  <span className="text-xs text-white/30">
                                    Δεν έχει οριστεί assignment ακόμη.
                                  </span>
                                )
                              ) : (
                                <span className="text-xs text-white/35 flex items-center gap-1">
                                  🔒 Χρειάζεται πρώτα:{" "}
                                  {missingPrereqs
                                    .map((p) => p!.name)
                                    .join(", ")}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2 pt-4">
            <Panel title="Continue learning">
              {data.continueLesson ? (
                <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                  <Link
                    to="/lesson/$lessonId"
                    params={{ lessonId: data.continueLesson.id }}
                    className="group flex items-center justify-between rounded-xl border border-white/15 bg-gradient-to-r from-white/[0.04] to-white/[0.01] p-5 transition-all duration-300 hover:border-white/40 hover:bg-white/[0.07] hover:shadow-[0_0_25px_rgba(255,255,255,0.06)]"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="flex size-10 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-white">
                        <BookOpen className="size-4" />
                      </div>
                      <span className="text-sm font-medium text-white/90 group-hover:text-white">{data.continueLesson.title}</span>
                    </div>
                    <div className="flex size-8 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white/70 transition-transform duration-300 group-hover:translate-x-1 group-hover:bg-white group-hover:text-black">
                      <ArrowRight className="size-4" />
                    </div>
                  </Link>
                </motion.div>
              ) : (
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 text-sm text-white/60">
                  Δεν υπάρχει μάθημα σε εξέλιξη.{" "}
                  <Link to="/academy" className="text-white underline underline-offset-4 hover:text-white/80">
                    Πήγαινε στην Academy
                  </Link>
                  .
                </div>
              )}
            </Panel>

            <Panel title="Recent feedback">
              {data.latestReview ? (
                <div className="rounded-xl border border-white/15 bg-gradient-to-r from-white/[0.04] to-white/[0.01] p-5 text-sm space-y-2 backdrop-blur-md shadow-[0_0_20px_rgba(255,255,255,0.02)]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wider text-white/50 font-mono">Evaluation</span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-0.5 text-xs font-semibold text-white">
                      {data.latestReview.decision}
                    </span>
                  </div>
                  {data.latestReview.next_actions && (
                    <p className="text-sm text-white/80 pt-2 border-t border-white/10">
                      {data.latestReview.next_actions}
                    </p>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 text-sm text-white/50">
                  Δεν υπάρχει feedback ακόμη.
                </div>
              )}
            </Panel>
          </div>

          <div>
            <Panel title="Επόμενη υποβολή">
              {nextSkill ? (
                nextAssignmentId ? (
                  <motion.div whileHover={{ scale: 1.005 }} whileTap={{ scale: 0.995 }}>
                    <Link
                      to="/practice/$assignmentId"
                      params={{ assignmentId: nextAssignmentId }}
                      className="group flex items-center justify-between rounded-xl border border-white/20 bg-gradient-to-r from-white/[0.06] to-white/[0.02] p-5 transition-all duration-300 hover:border-white/50 hover:bg-white/[0.09] hover:shadow-[0_0_30px_rgba(255,255,255,0.08)]"
                    >
                      <span className="text-sm text-white/90">
                        Ανέβασε φωτογραφία για:{" "}
                        <span className="font-semibold text-white underline decoration-white/40 underline-offset-4">{nextSkill.name}</span>
                      </span>
                      <div className="flex items-center gap-2 rounded-full border border-white/30 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wider text-black transition-transform duration-300 group-hover:scale-105">
                        <span>Υποβολή</span>
                        <ArrowRight className="size-3.5" />
                      </div>
                    </Link>
                  </motion.div>
                ) : (
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 text-sm text-white/60">
                    Το επόμενο skill (<span className="text-white font-medium">{nextSkill.name}</span>) δεν έχει ακόμη
                    assignment.
                  </div>
                )
              ) : skills.data ? (
                <div className="rounded-xl border border-white/15 bg-white/[0.03] p-5 text-sm text-white/80 flex items-center gap-3">
                  <Trophy className="size-5 text-white" />
                  <span>Έχεις ολοκληρώσει όλα τα διαθέσιμα skills προς το παρόν. 🎉</span>
                </div>
              ) : (
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 text-sm text-white/40">
                  Φόρτωση…
                </div>
              )}
            </Panel>
          </div>

          <nav className="mt-12 flex flex-wrap gap-4 pt-6 border-t border-white/10">
            <NavLink to="/academy" label="Academy" />
            {staff && <NavLink to="/review" label="Review Queue" icon={<UserCheck className="size-4" />} />}
          </nav>
        </motion.div>
      )}
    </main>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <motion.div 
      whileHover={{ y: -3 }}
      transition={{ duration: 0.2 }}
      className="group relative overflow-hidden rounded-xl border border-white/15 bg-gradient-to-b from-white/[0.06] to-white/[0.01] p-6 backdrop-blur-xl shadow-[0_4px_20px_rgba(0,0,0,0.5)] transition-all hover:border-white/40 hover:shadow-[0_0_25px_rgba(255,255,255,0.06)]"
    >
      <div className="absolute top-0 right-0 p-6 opacity-40 transition-opacity group-hover:opacity-80">
        {icon}
      </div>
      <p className="text-xs uppercase tracking-[0.2em] text-white/50">{label}</p>
      <p className="mt-3 text-3xl font-bold tracking-tight text-white">{value}</p>
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
    </motion.div>
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
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-white/60 flex items-center gap-2">
        <span className="size-1.5 rounded-full bg-white/60" />
        {title}
      </h2>
      {children}
    </section>
  );
}

function NavLink({ to, label, icon }: { to: string; label: string; icon?: React.ReactNode }) {
  return (
    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
      <Link
        to={to}
        className="group flex items-center gap-2.5 rounded-xl border border-white/20 bg-white/[0.04] px-6 py-3 text-sm font-medium text-white transition-all duration-300 hover:border-white/60 hover:bg-white hover:text-black hover:shadow-[0_0_25px_rgba(255,255,255,0.15)] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      >
        {icon}
        <span>{label}</span>
        <ArrowRight className="size-4 opacity-50 transition-transform duration-300 group-hover:translate-x-1 group-hover:opacity-100" />
      </Link>
    </motion.div>
  );
}