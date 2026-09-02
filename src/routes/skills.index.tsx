import { createFileRoute, Link } from "@tanstack/react-router";
import { getMySkills, getSkillAssignments } from "@/lib/queries";
import { useAsync } from "@/lib/useAsync";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "@/components/aura/States";
import type {
  SkillCategory,
  SkillState,
  SkillWithState,
} from "@/lib/database.types";
import SkillTreeGraph from "@/components/aura/SkillTreeGraph";

export const Route = createFileRoute("/skills/")({ component: SkillsPage });

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

// Ένα skill είναι "unlocked" (μπορεί να υποβληθεί) μόνο αν ΟΛΑ τα
// prerequisites του είναι ήδη verified/mastered — αυτό υλοποιεί τη
// λογική του skill tree: δεν παίρνεις το επόμενο αν δεν πήρες το πρώτο.
function isUnlocked(skill: SkillWithState, all: SkillWithState[]): boolean {
  if (!skill.prerequisites || skill.prerequisites.length === 0) return true;
  return skill.prerequisites.every((prereqId) => {
    const prereq = all.find((s) => s.id === prereqId);
    return prereq ? isAchieved(prereq) : false;
  });
}

function SkillsPage() {
  const { data, error, loading } = useAsync(getMySkills, []);
  const assignments = useAsync(getSkillAssignments, []);

  const grouped = (data ?? []).reduce<Record<string, SkillWithState[]>>(
    (acc, s) => {
      (acc[s.category] ??= []).push(s);
      return acc;
    },
    {},
  );

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-12 text-white">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-[0.3em] text-white/40">
          Progress
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Τα Skills μου</h1>
        <p className="mt-2 text-sm text-white/60">
          Locked → Learning → Practicing → Verified → Mastered. Για να
          ξεκλειδώσεις ένα skill πρέπει πρώτα να έχεις verified όλα τα
          προαπαιτούμενά του.
        </p>
      </header>

      {loading && <LoadingSkeleton rows={4} />}
      {error && <ErrorState message={error} />}
      {data && data.length === 0 && (
        <EmptyState
          title="Δεν υπάρχουν skills ακόμη"
          hint="Μόλις οριστούν skills στο σύστημα, θα εμφανιστούν εδώ."
        />
      )}

      {data && data.length > 0 && (
        <div className="mb-10">
          <SkillTreeGraph skills={data} />
        </div>
      )}

      {data && data.length > 0 && (
        <div className="space-y-8">
          {(Object.keys(grouped) as SkillCategory[]).map((cat) => (
            <section key={cat}>
              <h2 className="mb-3 text-sm font-medium uppercase tracking-widest text-white/50">
                {CATEGORY_LABEL[cat] ?? cat}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {grouped[cat]!.map((s) => {
                  const state = s.userSkill?.state ?? "locked";
                  const achieved = isAchieved(s);
                  const unlocked = isUnlocked(s, data);
                  const assignmentId = assignments.data?.[s.id];
                  const missingPrereqs = (s.prerequisites ?? [])
                    .map((id) => data.find((sk) => sk.id === id))
                    .filter((sk) => sk && !isAchieved(sk));

                  return (
                    <div
                      key={s.id}
                      className="rounded-xl border border-white/10 bg-white/[0.02] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-sm font-medium">{s.name}</h3>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${STATE_STYLE[state]}`}
                        >
                          {state}
                        </span>
                      </div>
                      {s.definition && (
                        <p className="mt-2 line-clamp-2 text-xs text-white/50">
                          {s.definition}
                        </p>
                      )}
                      <div className="mt-3 flex items-center gap-3 text-xs text-white/40">
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
                      <div className="mt-4">
                        {achieved ? (
                          <span className="text-xs text-emerald-300">
                            ✓ Ολοκληρώθηκε
                          </span>
                        ) : unlocked ? (
                          assignmentId ? (
                            <Link
                              to="/practice/$assignmentId"
                              params={{ assignmentId }}
                              className="inline-block rounded-lg border border-white/20 px-3 py-1.5 text-xs text-white transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                            >
                              Ανέβασε φωτογραφία κουρέματος
                            </Link>
                          ) : (
                            <span className="text-xs text-white/30">
                              Δεν έχει οριστεί assignment ακόμη.
                            </span>
                          )
                        ) : (
                          <span className="text-xs text-white/35">
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
      )}
    </main>
  );
}