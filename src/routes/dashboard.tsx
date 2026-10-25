import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "motion/react";
import {
  getDashboard,
  getMySkills,
  getSkillAssignments,
  isStaffRole,
} from "@/lib/queries";
import { useAsync } from "@/lib/useAsync";
import { ErrorState, LoadingSkeleton } from "@/components/aura/States";
import SkillTreeGraph from "@/components/aura/SkillTreeGraph";
import type { SkillCategory, SkillState, SkillWithState } from "@/lib/database.types";
import {
  ArrowRight,
  BookOpen,
  CheckCircle,
  Crown,
  Gem,
  Lock,
  Shield,
  ShieldCheck,
  Sparkles,
  Star,
  UserCheck,
} from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

/* -------------------------------------------------------------------------- */
/*  Shared chrome helpers                                                     */
/* -------------------------------------------------------------------------- */

const EASE = [0.22, 1, 0.36, 1] as const;
const CHROME_TEXT =
  "linear-gradient(90deg, #595959 0%, #b3b3b3 25%, #ffffff 50%, #b3b3b3 75%, #595959 100%)";
const CHROME_FILL =
  "linear-gradient(180deg, #ffffff 0%, #e6e6ea 30%, #b4b4bc 48%, #8a8a92 52%, #bdbdc4 74%, #f4f4f6 100%)";
const FRAME_BORDER =
  "linear-gradient(135deg, rgba(255,255,255,0.45), rgba(255,255,255,0.06) 35%, rgba(255,255,255,0.06) 65%, rgba(255,255,255,0.4))";

function ChromeText({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
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
      className={`inline-block drop-shadow-[0_0_28px_rgba(255,255,255,0.45)] ${className}`}
    >
      {children}
    </motion.span>
  );
}

/** 1px chrome gradient border around a dark surface. */
function Frame({ children, className = "", inner = "p-5 sm:p-6" }: { children: React.ReactNode; className?: string; inner?: string }) {
  return (
    <div
      className={`relative rounded-2xl p-px ${className}`}
      style={{ background: FRAME_BORDER, boxShadow: "0 0 50px rgba(0,0,0,0.85)" }}
    >
      <div className={`relative h-full overflow-hidden rounded-[15px] bg-[#0a0a0b] ${inner}`}>
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-20" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.05), transparent)" }} />
        <div className="relative">{children}</div>
      </div>
    </div>
  );
}

function Sheen() {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <motion.span
      aria-hidden
      className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/70 to-transparent"
      animate={{ x: ["-160%", "420%"] }}
      transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 3.2, ease: "easeInOut" }}
      style={{ skewX: -18 }}
    />
  );
}

/** Animated chrome link-button. `solid` = filled chrome, otherwise glass outline. */
function ChromeLink({
  to,
  params,
  label,
  icon,
  solid = false,
}: {
  to: string;
  params?: Record<string, string>;
  label: string;
  icon?: React.ReactNode;
  solid?: boolean;
}) {
  return (
    <motion.div whileHover={{ y: -2, scale: 1.03 }} whileTap={{ scale: 0.97 }} className="inline-block">
      <Link
        to={to as never}
        params={params as never}
        className={`group relative inline-flex items-center gap-2.5 overflow-hidden rounded-full px-6 py-3 text-sm font-semibold outline-none transition-shadow duration-300 focus-visible:ring-2 focus-visible:ring-white/70 ${
          solid
            ? "text-neutral-950 shadow-[0_0_30px_rgba(255,255,255,0.18)] hover:shadow-[0_0_46px_rgba(255,255,255,0.4)]"
            : "border border-white/25 bg-white/[0.04] text-white hover:border-white/60 hover:bg-white/[0.09] hover:shadow-[0_0_30px_rgba(255,255,255,0.14)]"
        }`}
        style={solid ? { backgroundImage: CHROME_FILL, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.95), inset 0 -1px 0 rgba(0,0,0,0.4)" } : undefined}
      >
        {solid && <Sheen />}
        {icon}
        <span className="relative">{label}</span>
        <ArrowRight className="relative size-4 transition-transform duration-300 group-hover:translate-x-1" />
      </Link>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Rank + skill helpers                                                      */
/* -------------------------------------------------------------------------- */

const RANKS = [
  { key: "initiate", label: "Initiate", min: 0, Icon: Shield },
  { key: "apprentice", label: "Apprentice", min: 100, Icon: Star },
  { key: "artisan", label: "Artisan", min: 300, Icon: Gem },
  { key: "master", label: "Master", min: 700, Icon: Crown },
  { key: "legend", label: "Legend", min: 1500, Icon: Sparkles },
] as const;

function getRankForPoints(points: number) {
  let rank: (typeof RANKS)[number] = RANKS[0];
  for (const r of RANKS) if (points >= r.min) rank = r;
  return rank;
}

const CATEGORY_LABEL: Record<SkillCategory, string> = {
  foundation: "Foundation",
  technical: "Technical",
  analysis: "Analysis",
  design: "Design",
  business: "Business",
  educator: "Educator",
};

const STATE_CLASS: Record<SkillState, string> = {
  locked: "border-white/10 bg-white/[0.03] text-white/35",
  learning: "border-white/20 bg-white/[0.07] text-white/65",
  practicing: "border-white/35 bg-white/[0.12] text-white/85",
  verified: "border-white/70 bg-white/[0.18] text-white shadow-[0_0_16px_rgba(255,255,255,0.35)]",
  mastered: "border-white bg-white text-neutral-950 shadow-[0_0_22px_rgba(255,255,255,0.6)]",
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

/** Maps a review decision to the label students see (no numeric scores). */
function decisionLabel(decision: string | null | undefined): { text: string; ok: boolean } | null {
  if (!decision) return null;
  if (decision === "passed") return { text: "Verified", ok: true };
  if (decision === "needs_revision") return { text: "Needs revision", ok: false };
  return { text: "Not passed", ok: false };
}

function DecisionBadge({ decision }: { decision: string | null | undefined }) {
  const d = decisionLabel(decision);
  if (!d) return <span className="text-white/40">—</span>;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${
        d.ok
          ? "border-white bg-white text-neutral-950 shadow-[0_0_24px_rgba(255,255,255,0.55)]"
          : "border-white/25 bg-white/[0.06] text-white/75"
      }`}
    >
      {d.ok && <ShieldCheck className="size-3.5" />}
      {d.text}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

const container = { hidden: {}, show: { transition: { staggerChildren: 0.09 } } };
const item = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
};

function DashboardPage() {
  const reduce = useReducedMotion();
  const { data, error, loading } = useAsync(getDashboard, []);
  const staff = data ? isStaffRole(data.profile.role) : false;

  const skills = useAsync(getMySkills, []);
  const assignments = useAsync(getSkillAssignments, []);

  const rank = useMemo(() => getRankForPoints(data?.profile?.points ?? 0), [data?.profile]);

  const nextSkill = useMemo(() => {
    if (!skills.data) return null;
    return skills.data.find((s) => !isAchieved(s) && isUnlocked(s, skills.data!)) ?? null;
  }, [skills.data]);

  const nextAssignmentId = nextSkill ? assignments.data?.[nextSkill.id] : null;

  const groupedSkills = useMemo(() => {
    if (!skills.data) return {};
    return skills.data.reduce<Record<string, SkillWithState[]>>((acc, s) => {
      (acc[s.category] ??= []).push(s);
      return acc;
    }, {});
  }, [skills.data]);

  return (
    <main className="relative min-h-screen w-full overflow-x-hidden bg-[#070707] px-4 py-12 text-white selection:bg-white selection:text-black sm:px-6 md:px-10">
      {/* ambient chrome glow */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 aspect-square w-[min(900px,120%)] -translate-x-1/2 -translate-y-1/3 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(255,255,255,0.09) 0%, rgba(170,180,190,0.04) 40%, transparent 70%)" }}
        animate={reduce ? undefined : { opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />

      {loading && (
        <div className="relative mx-auto max-w-5xl">
          <LoadingSkeleton rows={3} />
        </div>
      )}
      {error && (
        <div className="relative mx-auto max-w-5xl">
          <ErrorState message={error} />
        </div>
      )}

      {data && (
        <motion.div variants={container} initial="hidden" animate="show" className="relative mx-auto max-w-6xl space-y-10">
          {/* header */}
          <motion.header variants={item} className="flex flex-col gap-5 border-b border-white/10 pb-8 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-3 text-xs uppercase tracking-[0.35em] text-white/50">
                <span className="h-px w-10 bg-gradient-to-r from-white/70 to-transparent" />
                AURA Command Center
              </div>
              <h1 className="text-3xl font-extrabold uppercase tracking-tight sm:text-5xl">
                <ChromeText>
                  Καλωσήρθες{data.profile.full_name ? `, ${data.profile.full_name}` : ""}.
                </ChromeText>
              </h1>
            </div>

            <motion.div
              whileHover={{ scale: 1.04 }}
              className="relative inline-flex items-center gap-3 self-start overflow-hidden rounded-full border border-white/25 bg-white/[0.04] py-2 pl-2 pr-5 backdrop-blur-md md:self-auto"
              style={{ boxShadow: "0 0 30px rgba(255,255,255,0.08)" }}
            >
              <Sheen />
              <span
                className="relative flex size-10 items-center justify-center rounded-full text-neutral-950"
                style={{ backgroundImage: CHROME_FILL, boxShadow: "0 0 18px rgba(255,255,255,0.5), inset 0 1px 0 rgba(255,255,255,0.9)" }}
              >
                <rank.Icon className="size-5" />
              </span>
              <span className="relative leading-tight">
                <span className="block text-[10px] uppercase tracking-[0.25em] text-white/50">Aura Rank</span>
                <span className="block text-sm font-bold text-white">{rank.label}</span>
              </span>
            </motion.div>
          </motion.header>

          {/* stats */}
          <motion.div variants={item} className="grid gap-5 sm:grid-cols-3">
            <StatCard
              label="Verified skills"
              icon={<ShieldCheck className="size-5" />}
              value={
                <span className="text-4xl font-extrabold tracking-tight text-white">
                  {data.verifiedSkills}
                  <span className="text-white/35"> / {data.totalSkills}</span>
                </span>
              }
            />
            <StatCard
              label="Ανοιχτές υποβολές"
              icon={<CheckCircle className="size-5" />}
              value={<span className="text-4xl font-extrabold tracking-tight text-white">{data.openSubmissions}</span>}
            />
            <StatCard
              label="Τελευταίο αποτέλεσμα"
              icon={<Sparkles className="size-5" />}
              value={
                data.latestReview ? (
                  <DecisionBadge decision={data.latestReview.decision} />
                ) : (
                  <span className="text-4xl font-extrabold text-white/40">—</span>
                )
              }
            />
          </motion.div>

          {/* skill tree */}
          {skills.data && skills.data.length > 0 && (
            <motion.div variants={item} className="space-y-4">
              <SectionTitle>Skill Progression Tree</SectionTitle>
              <p className="-mt-2 px-1 text-xs leading-relaxed text-white/50">
                Locked → Learning → Practicing → Verified → Mastered. Για να ξεκλειδώσεις ένα skill πρέπει πρώτα να έχεις verified όλα τα προαπαιτούμενά του.
              </p>
              <Frame className="w-full" inner="p-4 sm:p-6">
                <SkillTreeGraph skills={skills.data} />
              </Frame>
            </motion.div>
          )}

          {/* categorized skills */}
          {skills.data && skills.data.length > 0 && (
            <motion.div variants={item} className="space-y-6">
              <SectionTitle>Αναλυτική Λίστα Skills</SectionTitle>
              <div className="space-y-9">
                {(Object.keys(groupedSkills) as SkillCategory[]).map((cat) => (
                  <section key={cat} className="space-y-3">
                    <h3 className="flex items-center gap-3 px-1 text-xs font-medium uppercase tracking-[0.3em] text-white/45">
                      {CATEGORY_LABEL[cat] ?? cat}
                      <span className="h-px flex-1 bg-gradient-to-r from-white/15 to-transparent" />
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {groupedSkills[cat]!.map((s, i) => {
                        const state = s.userSkill?.state ?? "locked";
                        const achieved = isAchieved(s);
                        const unlocked = isUnlocked(s, skills.data!);
                        const assignmentId = assignments.data?.[s.id];
                        const missingPrereqs = (s.prerequisites ?? [])
                          .map((id) => skills.data!.find((sk) => sk.id === id))
                          .filter((sk) => sk && !isAchieved(sk));

                        return (
                          <motion.div
                            key={s.id}
                            initial={{ opacity: 0, y: 16 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: "-40px" }}
                            transition={{ duration: 0.6, ease: EASE, delay: (i % 4) * 0.06 }}
                            whileHover={{ y: -4 }}
                            className="group relative"
                          >
                            <Frame inner="p-5">
                              <div className="flex items-start justify-between gap-3">
                                <h4 className="text-sm font-semibold text-white">{s.name}</h4>
                                <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${STATE_CLASS[state]}`}>
                                  {state}
                                </span>
                              </div>
                              {s.definition && (
                                <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-white/50">{s.definition}</p>
                              )}
                              {s.userSkill?.verified_at && (
                                <p className="mt-3 text-xs text-white/40">
                                  Verified {new Date(s.userSkill.verified_at).toLocaleDateString("el-GR")}
                                </p>
                              )}

                              <div className="mt-4 border-t border-white/[0.07] pt-4">
                                {achieved ? (
                                  <span className="flex items-center gap-2 text-xs font-semibold text-white">
                                    <ShieldCheck className="size-4" /> Ολοκληρώθηκε
                                  </span>
                                ) : unlocked ? (
                                  assignmentId ? (
                                    <ChromeLink
                                      to="/practice/$assignmentId"
                                      params={{ assignmentId }}
                                      label="Ανέβασε φωτογραφία κουρέματος"
                                    />
                                  ) : (
                                    <span className="text-xs text-white/35">Δεν έχει οριστεί assignment ακόμη.</span>
                                  )
                                ) : (
                                  <span className="flex items-center gap-2 text-xs text-white/40">
                                    <Lock className="size-3.5 shrink-0" />
                                    Χρειάζεται πρώτα: {missingPrereqs.map((p) => p!.name).join(", ")}
                                  </span>
                                )}
                              </div>
                            </Frame>
                          </motion.div>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </motion.div>
          )}

          {/* continue + feedback */}
          <motion.div variants={item} className="grid gap-8 md:grid-cols-2">
            <Panel title="Continue learning">
              {data.continueLesson ? (
                <motion.div whileHover={{ y: -3 }} whileTap={{ scale: 0.99 }}>
                  <Link to="/lesson/$lessonId" params={{ lessonId: data.continueLesson.id }} className="group block outline-none focus-visible:ring-2 focus-visible:ring-white/60 rounded-2xl">
                    <Frame inner="p-5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-4">
                          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/[0.06] text-white transition-shadow duration-300 group-hover:shadow-[0_0_24px_rgba(255,255,255,0.35)]">
                            <BookOpen className="size-5" />
                          </span>
                          <span className="truncate text-sm font-semibold text-white">{data.continueLesson.title}</span>
                        </div>
                        <span
                          className="flex size-9 shrink-0 items-center justify-center rounded-full text-neutral-950 transition-transform duration-300 group-hover:translate-x-1"
                          style={{ backgroundImage: CHROME_FILL }}
                        >
                          <ArrowRight className="size-4" />
                        </span>
                      </div>
                    </Frame>
                  </Link>
                </motion.div>
              ) : (
                <Frame inner="p-5">
                  <p className="text-sm text-white/60">
                    Δεν υπάρχει μάθημα σε εξέλιξη.{" "}
                    <Link to="/academy" className="text-white underline underline-offset-4 hover:text-white/80">
                      Πήγαινε στην Academy
                    </Link>
                    .
                  </p>
                </Frame>
              )}
            </Panel>

            <Panel title="Recent feedback">
              <Frame inner="p-5">
                {data.latestReview ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs uppercase tracking-[0.25em] text-white/45">Evaluation</span>
                      <DecisionBadge decision={data.latestReview.decision} />
                    </div>
                    {data.latestReview.next_actions && (
                      <p className="border-t border-white/10 pt-3 text-sm leading-relaxed text-white/75">
                        {data.latestReview.next_actions}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-white/45">Δεν υπάρχει feedback ακόμη.</p>
                )}
              </Frame>
            </Panel>
          </motion.div>

          {/* next submission */}
          <motion.div variants={item}>
            <Panel title="Επόμενη υποβολή">
              {nextSkill ? (
                nextAssignmentId ? (
                  <Frame inner="p-5 sm:p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-sm text-white/85">
                        Ανέβασε φωτογραφία για:{" "}
                        <span className="font-semibold text-white underline decoration-white/40 underline-offset-4">{nextSkill.name}</span>
                      </span>
                      <ChromeLink to="/practice/$assignmentId" params={{ assignmentId: nextAssignmentId }} label="Υποβολή" solid />
                    </div>
                  </Frame>
                ) : (
                  <Frame inner="p-5">
                    <p className="text-sm text-white/60">
                      Το επόμενο skill (<span className="font-medium text-white">{nextSkill.name}</span>) δεν έχει ακόμη assignment.
                    </p>
                  </Frame>
                )
              ) : skills.data ? (
                <Frame inner="p-5">
                  <p className="flex items-center gap-3 text-sm text-white/85">
                    <ShieldCheck className="size-5 text-white" />
                    Έχεις ολοκληρώσει όλα τα διαθέσιμα skills προς το παρόν.
                  </p>
                </Frame>
              ) : (
                <Frame inner="p-5">
                  <p className="text-sm text-white/40">Φόρτωση…</p>
                </Frame>
              )}
            </Panel>
          </motion.div>

          {/* nav */}
          <motion.nav variants={item} className="flex flex-wrap gap-4 border-t border-white/10 pt-8">
            <ChromeLink to="/academy" label="Academy" />
            {staff && <ChromeLink to="/review" label="Review Queue" icon={<UserCheck className="size-4" />} solid />}
          </motion.nav>
        </motion.div>
      )}
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/*  Small components                                                          */
/* -------------------------------------------------------------------------- */

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-3 px-1 text-xs font-semibold uppercase tracking-[0.3em] text-white/65">
      <span className="size-1.5 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.9)]" />
      {children}
    </h2>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <SectionTitle>{title}</SectionTitle>
      {children}
    </section>
  );
}

function StatCard({ label, value, icon }: { label: string; value: React.ReactNode; icon: React.ReactNode }) {
  return (
    <motion.div whileHover={{ y: -5 }} transition={{ duration: 0.25 }} className="group relative">
      <Frame inner="p-6">
        <div className="absolute right-0 top-0 text-white/35 transition-all duration-300 group-hover:text-white group-hover:drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]">
          {icon}
        </div>
        <p className="text-xs uppercase tracking-[0.25em] text-white/50">{label}</p>
        <div className="mt-4 flex min-h-[2.5rem] items-center">{value}</div>
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      </Frame>
    </motion.div>
  );
}