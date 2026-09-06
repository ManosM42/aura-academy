// src/components/aura/RankIcon.tsx
import { Flame } from "lucide-react";
import { motion } from "motion/react";
import type { RankKey } from "@/lib/ranks";

interface TierStyle {
  ring: string;
  iconBg: string;
  icon: string;
  glow: string;
}

const TIER_STYLE: Record<RankKey, TierStyle> = {
  unranked: {
    ring: "border-white/15",
    iconBg: "bg-white/5",
    icon: "text-white/35",
    glow: "",
  },
  bronze: {
    ring: "border-[#c98346]/60",
    iconBg: "bg-gradient-to-br from-[#4a2c14] to-[#c98346]",
    icon: "text-[#ffdcb3]",
    glow: "shadow-[0_0_14px_-3px_rgba(201,131,70,0.6)]",
  },
  silver: {
    ring: "border-[#d7dadd]/70",
    iconBg: "bg-gradient-to-br from-[#5c6064] to-[#eceeef]",
    icon: "text-white",
    glow: "shadow-[0_0_14px_-3px_rgba(215,218,221,0.6)]",
  },
  gold: {
    ring: "border-[#ffd76a]/80",
    iconBg: "bg-gradient-to-br from-[#7a5000] to-[#ffd76a]",
    icon: "text-[#fff4d6]",
    glow: "shadow-[0_0_16px_-2px_rgba(255,215,110,0.65)]",
  },
  platinum: {
    ring: "border-[#cdeeff]/80",
    iconBg: "bg-gradient-to-br from-[#356a86] to-[#eaf8ff]",
    icon: "text-white",
    glow: "shadow-[0_0_18px_-2px_rgba(200,235,255,0.65)]",
  },
  diamond: {
    ring: "border-[#9df0ff]/90",
    iconBg: "bg-gradient-to-br from-[#0b7fa8] to-[#e3fcff]",
    icon: "text-white",
    glow: "shadow-[0_0_22px_-2px_rgba(150,240,255,0.75)]",
  },
  aura_master: {
    ring: "border-[#ff6a2a]/90",
    iconBg: "bg-gradient-to-br from-[#7a0d00] via-[#ff4d1a] to-[#ffc93d]",
    icon: "text-white",
    glow: "shadow-[0_0_28px_-2px_rgba(255,90,20,0.9)]",
  },
};

export function RankIcon({
  rank,
  size = 32,
  className = "",
}: {
  rank: RankKey;
  size?: number;
  className?: string;
}) {
  const s = TIER_STYLE[rank];
  const isMaster = rank === "aura_master";

  if (!isMaster) {
    return (
      <span
        className={`relative inline-flex shrink-0 items-center justify-center rounded-full border ${s.ring} ${s.iconBg} ${s.glow} ${className}`}
        style={{ width: size, height: size }}
      >
        <Flame
          aria-hidden
          className={s.icon}
          style={{ width: size * 0.56, height: size * 0.56 }}
          strokeWidth={2.2}
        />
      </span>
    );
  }

  // Aura Master: animated red/orange fire — flicker + pulsing glow.
  return (
    <motion.span
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full border ${s.ring} ${s.iconBg} ${s.glow} ${className}`}
      style={{ width: size, height: size }}
      animate={{ scale: [1, 1.07, 0.98, 1.05, 1] }}
      transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
    >
      <motion.span
        aria-hidden
        className="absolute inset-0 rounded-full bg-[#ff5a1f]/50 blur-md"
        animate={{ opacity: [0.35, 0.9, 0.5, 0.85, 0.35], scale: [0.85, 1.3, 1, 1.2, 0.85] }}
        transition={{ duration: 1.3, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.span
        animate={{ rotate: [-4, 4, -3, 3, -4] }}
        transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
        className="relative"
      >
        <Flame
          aria-hidden
          className="text-white drop-shadow-[0_0_6px_rgba(255,120,40,0.9)]"
          style={{ width: size * 0.6, height: size * 0.6 }}
          strokeWidth={2.2}
          fill="currentColor"
        />
      </motion.span>
    </motion.span>
  );
}