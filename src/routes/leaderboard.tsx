// src/routes/leaderboard.tsx
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "motion/react";
import { getLeaderboard, type LeaderboardEntry } from "@/lib/queries";
import { useAsync } from "@/lib/useAsync";
import { ErrorState, LoadingSkeleton, EmptyState } from "@/components/aura/States";
import AuraAvatar from "@/components/aura/AuraAvatar";
import { RankIcon } from "@/components/aura/RankIcon";
import UserProfileModal from "@/components/aura/UserProfileModal";
import {
  RANK_TIERS,
  UNRANKED_TIER,
  formatRankRange,
  getRankForPoints,
  type RankTier,
} from "@/lib/ranks";

export const Route = createFileRoute("/leaderboard")({
  component: LeaderboardPage,
});

function LeaderboardPage() {
  const { data, error, loading } = useAsync(getLeaderboard, []);
  const [openUserId, setOpenUserId] = useState<string | null>(null);

  // Already ordered desc by the RPC, but sort defensively in case that
  // ever changes — overall position numbers (#1, #2, ...) depend on it.
  const ranked = [...(data ?? [])].sort((a, b) => b.totalPoints - a.totalPoints);

  const withPosition = ranked.map((entry, i) => ({ entry, position: i + 1 }));

  const groups = [...RANK_TIERS, UNRANKED_TIER].map((tier) => ({
    tier,
    rows: withPosition.filter(
      ({ entry }) => getRankForPoints(entry.totalPoints).key === tier.key,
    ),
  }));

  const top3 = withPosition.slice(0, 3);

  return (
    <main className="w-full min-h-screen overflow-x-hidden bg-[#070707] px-4 sm:px-6 md:px-10 py-12 text-white selection:bg-white selection:text-black">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <header className="border-b border-white/10 pb-6 mb-8">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-white/50 mb-2">
            <span className="h-px w-8 bg-gradient-to-r from-white/60 to-transparent" />
            AURA Rankings
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold uppercase tracking-tight chrome-type">
            Leaderboard
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-white/60">
            Οι πόντοι Aura συγκεντρώνονται κάθε φορά που ένα review σου
            περνάει (passed). Όσο περισσότερα skills ολοκληρώνεις, τόσο πιο
            ψηλά ανεβαίνεις στο rank.
          </p>
        </header>

        {/* Rank legend */}
        <div className="mb-10 flex flex-wrap gap-3">
          {RANK_TIERS.map((tier) => (
            <div
              key={tier.key}
              className="flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.03] py-1.5 pl-1.5 pr-4"
            >
              <RankIcon rank={tier.key} size={26} />
              <div className="leading-tight">
                <p className="text-xs font-medium text-white/90">{tier.label}</p>
                <p className="text-[10px] uppercase tracking-wide text-white/40">
                  {formatRankRange(tier)}
                </p>
              </div>
            </div>
          ))}
        </div>

        {loading && <LoadingSkeleton rows={4} />}
        {error && <ErrorState message={error} />}

        {data && ranked.length === 0 && (
          <EmptyState
            title="Δεν υπάρχει ακόμη κανένας στο leaderboard"
            hint="Μόλις κάποιος μαθητής περάσει το πρώτο του review, θα εμφανιστεί εδώ."
          />
        )}

        {data && ranked.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Podium for the top 3 */}
            <div className="mb-12 grid gap-4 sm:grid-cols-3">
              {top3.map(({ entry, position }) => (
                <PodiumCard
                  key={entry.userId}
                  entry={entry}
                  position={position}
                  onSelect={() => setOpenUserId(entry.userId)}
                />
              ))}
            </div>

            {/* Full ranking, grouped by tier, Aura Master first */}
            <div className="space-y-10">
              {groups.map(({ tier, rows }) => (
                <RankSection
                  key={tier.key}
                  tier={tier}
                  rows={rows}
                  onSelectUser={(userId) => setOpenUserId(userId)}
                />
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {openUserId && (
        <UserProfileModal
          userId={openUserId}
          onClose={() => setOpenUserId(null)}
        />
      )}
    </main>
  );
}

function PodiumCard({
  entry,
  position,
  onSelect,
}: {
  entry: LeaderboardEntry;
  position: number;
  onSelect: () => void;
}) {
  const tier = getRankForPoints(entry.totalPoints);
  const isFirst = position === 1;

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.2 }}
      className={`relative w-full overflow-hidden rounded-xl border p-5 text-left backdrop-blur-xl transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
        isFirst
          ? "border-white/30 bg-gradient-to-b from-white/[0.09] to-white/[0.01] shadow-[0_0_30px_-6px_rgba(255,255,255,0.15)] hover:border-white/50"
          : "border-white/15 bg-gradient-to-b from-white/[0.05] to-white/[0.01] hover:border-white/35"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs uppercase tracking-widest text-white/40">
          #{position}
        </span>
        <RankIcon rank={tier.key} size={30} />
      </div>
      <div className="mt-4 flex items-center gap-3">
        <AuraAvatar name={entry.fullName} src={entry.avatarUrl} size={44} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">
            {entry.fullName || "Μαθητής"}
          </p>
          <p className="text-[11px] uppercase tracking-wide text-white/40">
            {tier.label}
          </p>
        </div>
      </div>
      <p className="mt-4 text-2xl font-bold tracking-tight">
        {entry.totalPoints.toLocaleString("el-GR")}
        <span className="ml-1 text-xs font-normal text-white/40">pts</span>
      </p>
    </motion.button>
  );
}

function RankSection({
  tier,
  rows,
  onSelectUser,
}: {
  tier: RankTier;
  rows: { entry: LeaderboardEntry; position: number }[];
  onSelectUser: (userId: string) => void;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-3">
        <RankIcon rank={tier.key} size={30} />
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/80">
            {tier.label}
          </h2>
          <p className="text-[11px] text-white/40">{formatRankRange(tier)}</p>
        </div>
        {rows.length > 0 && (
          <span className="ml-auto rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-0.5 text-xs text-white/50">
            {rows.length}
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] px-5 py-4 text-sm text-white/35">
          No user has reached {tier.label} yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/10">
          {rows.map(({ entry, position }, i) => (
            <button
              key={entry.userId}
              type="button"
              onClick={() => onSelectUser(entry.userId)}
              className={`flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-white/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-inset ${
                i !== rows.length - 1 ? "border-b border-white/5" : ""
              }`}
            >
              <span className="w-8 shrink-0 font-mono text-xs text-white/40">
                #{position}
              </span>
              <AuraAvatar name={entry.fullName} src={entry.avatarUrl} size={36} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-white/90">
                {entry.fullName || "Μαθητής"}
              </span>
              <span className="shrink-0 font-mono text-sm font-semibold text-white">
                {entry.totalPoints.toLocaleString("el-GR")}
                <span className="ml-1 text-[10px] font-normal text-white/40">pts</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}