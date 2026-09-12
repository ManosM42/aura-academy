import { motion } from "motion/react";
import type { RankKey } from "@/lib/ranks";
import logoImage from "@/assets/logo.jpg";
import { Flame } from "lucide-react";

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
    ring: "border-[#ff4500]/95",
    iconBg: "bg-gradient-to-br from-[#5a0000] via-[#cc2200] to-[#ff8800]",
    icon: "text-white",
    glow: "shadow-[0_0_40px_-2px_rgba(255,69,0,0.95)]",
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

  // Aura Master: Ultra-realistic organic fluid flame simulation with thermal distortion and rising embers
  return (
    <div className={`relative inline-flex shrink-0 items-center justify-center overflow-visible ${className}`} style={{ width: size, height: size }}>
      
      {/* 1. Organic Fluid Flame Backdrop (Natural flicker & licking simulation) */}
      <motion.div 
        className="absolute -top-4 inset-x-0 flex justify-center items-end pointer-events-none z-0 filter blur-[0.4px]"
        animate={{ 
          scaleY: [1.1, 1.35, 1.05, 1.3, 1.15],
          scaleX: [0.95, 1.1, 0.9, 1.05, 0.95],
          skewX: [-2, 3, -1, 2, -2],
          y: [0, -2, 1, -1, 0]
        }}
        transition={{ duration: 0.55, repeat: Infinity, ease: "easeInOut" }}
      >
        <svg viewBox="0 0 50 50" className="w-full h-full scale-[1.7] drop-shadow-[0_0_10px_rgba(255,80,0,0.95)]">
          <defs>
            <linearGradient id="realisticFlame" x1="50%" y1="100%" x2="50%" y2="0%">
              <stop offset="0%" stopColor="#1a0200" stopOpacity="0.9" />
              <stop offset="25%" stopColor="#cc1100" stopOpacity="0.95" />
              <stop offset="60%" stopColor="#ff5500" stopOpacity="0.9" />
              <stop offset="85%" stopColor="#ffaa00" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#ffee55" stopOpacity="0.95" />
            </linearGradient>
            <radialGradient id="heatGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ff4500" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#ff0000" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Background Heat Bloom */}
          <circle cx="25" cy="25" r="22" fill="url(#heatGlow)" className="animate-pulse" />

          {/* Organic Fluid Flame Tongues */}
          <path
            d="M25 4 C29 14, 38 18, 35 29 C33 37, 27 43, 25 46 C23 43, 17 37, 15 29 C12 18, 21 14, 25 4 Z"
            fill="url(#realisticFlame)"
          />
          {/* Inner High-Heat Plasma Core */}
          <path
            d="M25 12 C27 18, 32 22, 30 31 C29 36, 26 40, 25 42 C24 40, 21 36, 20 31 C18 22, 23 18, 25 12 Z"
            fill="#ffffff"
            className="opacity-60 mix-blend-overlay"
          />
        </svg>
      </motion.div>

      {/* 2. Central Logo Badge with Thermal Heat Distortion */}
      <motion.span
        className={`relative inline-flex shrink-0 items-center justify-center rounded-full border overflow-hidden ${s.ring} ${s.iconBg} ${s.glow} z-10`}
        style={{ width: size, height: size }}
        animate={{ 
          scale: [1, 1.05, 0.97, 1.03, 1],
          filter: [
            "drop-shadow(0 0 4px rgba(255,69,0,0.8))",
            "drop-shadow(0 0 10px rgba(255,120,0,0.95))",
            "drop-shadow(0 0 6px rgba(255,69,0,0.8))"
          ]
        }}
        transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Logo Image with Fire Color Grading & Shimmer */}
        <div className="relative z-10 w-full h-full flex items-center justify-center rounded-full overflow-hidden">
          <img
            src={logoImage}
            alt="Aura Master Logo"
            className="absolute inset-0 w-full h-full object-cover mix-blend-screen opacity-95 saturate-[2.2] contrast-[1.6]"
          />
          <motion.div 
            className="absolute inset-0 bg-gradient-to-t from-[#6a0000]/90 via-[#ff3300]/40 to-[#ffaa00]/30 mix-blend-color pointer-events-none"
            animate={{ opacity: [0.65, 0.9, 0.7, 0.95, 0.65] }}
            transition={{ duration: 0.45, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      </motion.span>

      {/* 3. Realistic Rising Embers & Sparks */}
      <motion.div 
        className="absolute -top-3 left-1/2 -translate-x-1/2 pointer-events-none z-20 flex flex-col items-center"
      >
        <motion.div 
          className="w-1 h-1 rounded-full bg-amber-200 shadow-[0_0_6px_#ffaa00]"
          animate={{ 
            y: [0, -7, -14], 
            x: [-2, 3, -1],
            opacity: [0, 1, 0],
            scale: [0.8, 1.4, 0.2]
          }}
          transition={{ duration: 0.65, repeat: Infinity, ease: "easeOut" }}
        />
        <motion.div 
          className="w-0.5 h-0.5 rounded-full bg-white shadow-[0_0_5px_#ff4500]"
          animate={{ 
            y: [0, -5, -11], 
            x: [2, -2, 1],
            opacity: [0, 0.9, 0],
            scale: [1, 1.2, 0.1]
          }}
          transition={{ duration: 0.5, repeat: Infinity, ease: "easeOut", delay: 0.25 }}
        />
      </motion.div>

    </div>
  );
}