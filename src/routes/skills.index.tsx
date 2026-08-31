import { createFileRoute } from "@tanstack/react-router";
import { getMySkills } from "@/lib/queries";
import { useAsync } from "@/lib/useAsync";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "@/components/aura/States";
import type { SkillCategory, SkillState } from "@/lib/database.types";

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

function SkillsPage() {
  const { data, error, loading } = useAsync(getMySkills, []);

  const grouped = (data ?? []).reduce<Record<string, typeof data>>(
    (acc, s) => {
      (acc[s.category] ??= []).push(s);
      return acc;
    },
    {} as Record<string, typeof data>,
  );

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-12 text-white">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-[0.3em] text-white/40">
          Progress
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Τα Skills μου</h1>
        <p className="mt-2 text-sm text-white/60">
          Locked → Learning → Practicing → Verified → Mastered. Τα verified
          skills βασίζονται σε αξιολογημένες υποβολές.
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
        <div className="space-y-8">
          {(Object.keys(grouped) as SkillCategory[]).map((cat) => (
            <section key={cat}>
              <h2 className="mb-3 text-sm font-medium uppercase tracking-widest text-white/50">
                {CATEGORY_LABEL[cat] ?? cat}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {grouped[cat]!.map((s) => {
                  const state = s.userSkill?.state ?? "locked";
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