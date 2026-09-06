// src/lib/ranks.ts
// Aura points -> rank tier mapping used by the Leaderboard.

export type RankKey =
  | "unranked"
  | "bronze"
  | "silver"
  | "gold"
  | "platinum"
  | "diamond"
  | "aura_master";

export interface RankTier {
  key: RankKey;
  label: string;
  /** Inclusive lower bound. */
  min: number;
  /** Exclusive upper bound, null = no upper bound (Aura Master). */
  max: number | null;
}

// Ordered highest -> lowest, since that's how the leaderboard renders sections.
export const RANK_TIERS: RankTier[] = [
  { key: "aura_master", label: "Aura Master", min: 1000, max: null },
  { key: "diamond", label: "Diamond Aura", min: 800, max: 1000 },
  { key: "platinum", label: "Platinum Aura", min: 600, max: 800 },
  { key: "gold", label: "Gold Aura", min: 400, max: 600 },
  { key: "silver", label: "Silver Aura", min: 200, max: 400 },
  { key: "bronze", label: "Bronze Aura", min: 100, max: 200 },
];

export const UNRANKED_TIER: RankTier = {
  key: "unranked",
  label: "Unranked",
  min: 0,
  max: 100,
};

/** Returns the matching tier for a points total, or the "unranked" tier for 1-99. */
export function getRankForPoints(points: number): RankTier {
  const tier = RANK_TIERS.find(
    (t) => points >= t.min && (t.max === null || points < t.max),
  );
  return tier ?? UNRANKED_TIER;
}

export function formatRankRange(tier: RankTier): string {
  if (tier.max === null) return `${tier.min}+ points`;
  return `${tier.min}–${tier.max} points`;
}