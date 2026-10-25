import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { SkillCategory, SkillState, SkillWithState } from "@/lib/database.types";

const EASE = [0.22, 1, 0.36, 1] as const;

const CATEGORY_ORDER: SkillCategory[] = [
  "foundation",
  "technical",
  "analysis",
  "design",
  "business",
  "educator",
];

const CATEGORY_LABEL: Record<SkillCategory, string> = {
  foundation: "Foundation",
  technical: "Technical",
  analysis: "Analysis",
  design: "Design",
  business: "Business",
  educator: "Educator",
};

const STATE_LABEL: Record<SkillState, string> = {
  mastered: "Mastered",
  verified: "Verified",
  practicing: "Practicing",
  learning: "Learning",
  locked: "Locked",
};

/* Compact layout. One SVG scales to any screen, so mobile and desktop show
   exactly the same graph. Rows hold at most MAX_COLS skills so text stays
   readable on a phone. */
const MAX_COLS = 4;
const COL_W = 118;
const PAD_X = 56;
const PAD_TOP = 14;
const PAD_BOTTOM = 14;
const LABEL_BAND = 34; // category title above its first row
const ROW_H = 96;
const NODE_Y = 28; // node centre below the row top
const R = 20;
const MIN_WIDTH = 340;

interface LaidOutNode {
  skill: SkillWithState;
  state: SkillState;
  x: number;
  y: number;
}

const isAchieved = (s: SkillState) => s === "verified" || s === "mastered";

function layout(skills: SkillWithState[]) {
  const byCategory = new Map<SkillCategory, SkillWithState[]>();
  for (const s of skills) {
    const list = byCategory.get(s.category) ?? [];
    list.push(s);
    byCategory.set(s.category, list);
  }
  for (const list of byCategory.values()) list.sort((a, b) => a.sort_order - b.sort_order);

  const cats = CATEGORY_ORDER.filter((c) => (byCategory.get(c) ?? []).length > 0);
  const maxCols = Math.min(MAX_COLS, Math.max(1, ...cats.map((c) => byCategory.get(c)!.length)));
  const width = Math.max(MIN_WIDTH, PAD_X * 2 + (maxCols - 1) * COL_W);

  const nodes: LaidOutNode[] = [];
  const byId = new Map<string, LaidOutNode>();
  const titles: { cat: SkillCategory; y: number }[] = [];

  let cursor = PAD_TOP;
  for (const cat of cats) {
    titles.push({ cat, y: cursor });
    cursor += LABEL_BAND;
    const list = byCategory.get(cat)!;
    for (let start = 0; start < list.length; start += MAX_COLS) {
      const chunk = list.slice(start, start + MAX_COLS);
      const startX = width / 2 - ((chunk.length - 1) * COL_W) / 2;
      chunk.forEach((skill, i) => {
        const node: LaidOutNode = {
          skill,
          state: skill.userSkill?.state ?? "locked",
          x: startX + i * COL_W,
          y: cursor + NODE_Y,
        };
        nodes.push(node);
        byId.set(skill.id, node);
      });
      cursor += ROW_H;
    }
    cursor += 6;
  }
  const height = cursor + PAD_BOTTOM;

  const edges: [LaidOutNode, LaidOutNode][] = [];
  for (const node of nodes) {
    for (const prereqId of node.skill.prerequisites ?? []) {
      const from = byId.get(prereqId);
      if (from) edges.push([from, node]);
    }
  }
  return { nodes, edges, titles, width, height };
}

function wrap(name: string, max = 13): string[] {
  const words = name.split(/\s+/);
  let lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (cur && (cur + " " + w).length > max) {
      lines.push(cur);
      cur = w;
    } else cur = cur ? cur + " " + w : w;
  }
  if (cur) lines.push(cur);
  if (lines.length > 2) {
    const rest = lines.slice(1).join(" ");
    lines = [lines[0]!, rest.length > max ? rest.slice(0, max - 1) + "…" : rest];
  }
  return lines;
}

function starPoints(cx: number, cy: number, outer: number, inner: number) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (-90 + i * 36) * (Math.PI / 180);
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(" ");
}

function edgePath(a: LaidOutNode, b: LaidOutNode) {
  if (Math.abs(a.y - b.y) < 1) return `M${a.x} ${a.y} L${b.x} ${b.y}`;
  const my = (a.y + b.y) / 2;
  return `M${a.x} ${a.y} C${a.x} ${my}, ${b.x} ${my}, ${b.x} ${b.y}`;
}

export default function SkillTreeGraph({ skills }: { skills: SkillWithState[] }) {
  const reduce = useReducedMotion();
  const { nodes, edges, titles, width, height } = useMemo(() => layout(skills), [skills]);

  const defaultId = useMemo(() => {
    const pick =
      nodes.find((n) => n.state === "practicing") ??
      nodes.find((n) => n.state === "learning") ??
      nodes.find((n) => n.state !== "locked") ??
      nodes[0];
    return pick?.skill.id ?? null;
  }, [nodes]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  if (skills.length === 0 || nodes.length === 0) return null;

  const sel = nodes.find((n) => n.skill.id === (selectedId ?? defaultId)) ?? nodes[0]!;
  const prereqNames = (sel.skill.prerequisites ?? [])
    .map((id) => skills.find((s) => s.id === id)?.name)
    .filter(Boolean) as string[];

  return (
    <section className="relative mx-auto w-full max-w-md">
      <div className="relative w-full overflow-hidden rounded-xl">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.12) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
            maskImage: "radial-gradient(ellipse at center, black 30%, transparent 80%)",
            WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 80%)",
          }}
        />

        <svg viewBox={`0 0 ${width} ${height}`} className="relative block h-auto w-full select-none" role="group" aria-label="Skill progression tree">
          <defs>
            <linearGradient id="stg-edge" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={width} y2={height}>
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="50%" stopColor="#9aa0a8" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.95" />
            </linearGradient>
            <linearGradient id="stg-rule" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
            <radialGradient id="stg-chrome" cx="35%" cy="30%" r="80%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="45%" stopColor="#c9ced4" />
              <stop offset="100%" stopColor="#6c7279" />
            </radialGradient>
            <radialGradient id="stg-dark" cx="35%" cy="30%" r="90%">
              <stop offset="0%" stopColor="#2a2d31" />
              <stop offset="100%" stopColor="#0c0d0e" />
            </radialGradient>
            <filter id="stg-glow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="3" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* category titles */}
          {titles.map(({ cat, y }) => (
            <g key={cat}>
              <text x={16} y={y + 14} className="font-aura" fill="rgba(255,255,255,0.65)" fontSize="11" fontWeight="600" letterSpacing="2.5">
                {CATEGORY_LABEL[cat].toUpperCase()}
              </text>
              <line x1={16} y1={y + 22} x2={width - 16} y2={y + 22} stroke="url(#stg-rule)" strokeWidth="1" />
            </g>
          ))}

          {/* edges */}
          {edges.map(([from, to], i) => {
            const lit = isAchieved(from.state) && to.state !== "locked";
            const soft = !lit && from.state !== "locked" && to.state !== "locked";
            const d = edgePath(from, to);
            return (
              <g key={`${from.skill.id}-${to.skill.id}`}>
                <motion.path
                  d={d}
                  fill="none"
                  stroke={lit ? "url(#stg-edge)" : soft ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.12)"}
                  strokeWidth={lit ? 2 : 1.3}
                  strokeLinecap="round"
                  strokeDasharray={!lit && !soft ? "2 6" : undefined}
                  filter={lit ? "url(#stg-glow)" : undefined}
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 1, ease: "easeInOut", delay: 0.1 + i * 0.04 }}
                />
                {lit && !reduce && (
                  <motion.path
                    d={d}
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeDasharray="5 40"
                    animate={{ strokeDashoffset: [0, -45] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
                    style={{ filter: "drop-shadow(0 0 4px #fff)" }}
                  />
                )}
              </g>
            );
          })}

          {/* nodes (plain fade-in on mount, always visible) */}
          {nodes.map((n, i) => {
            const isSel = n.skill.id === sel.skill.id;
            const lines = wrap(n.skill.name);
            const achieved = isAchieved(n.state);
            const locked = n.state === "locked";
            return (
              <motion.g
                key={n.skill.id}
                role="button"
                tabIndex={0}
                aria-label={`${n.skill.name}, ${STATE_LABEL[n.state]}`}
                aria-pressed={isSel}
                onClick={() => setSelectedId(n.skill.id)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setSelectedId(n.skill.id)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, ease: EASE, delay: 0.25 + i * 0.05 }}
                style={{ cursor: "pointer", outline: "none" }}
              >
                {/* larger tap target */}
                <circle cx={n.x} cy={n.y} r={R + 14} fill="rgba(0,0,0,0.001)" />

                {isSel && <circle cx={n.x} cy={n.y} r={R + 10} fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1" strokeDasharray="2 5" />}

                {n.state === "mastered" && (
                  <circle cx={n.x} cy={n.y} r={R + 5} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.2" style={{ filter: "drop-shadow(0 0 6px #fff)" }} />
                )}

                {(achieved || n.state === "practicing") && !reduce && (
                  <motion.circle
                    cx={n.x} cy={n.y} r={R} fill="none" stroke="#ffffff" strokeWidth="1.3"
                    style={{ transformBox: "fill-box", transformOrigin: "center" }}
                    animate={{ scale: [1, 1.8], opacity: [achieved ? 0.4 : 0.7, 0] }}
                    transition={{ duration: achieved ? 3.2 : 2, repeat: Infinity, ease: "easeOut", delay: (i % 5) * 0.35 }}
                  />
                )}

                {(n.state === "practicing" || n.state === "learning") && !reduce && (
                  <motion.circle
                    cx={n.x} cy={n.y} r={R + 5} fill="none"
                    stroke={n.state === "practicing" ? "#d4d8dd" : "rgba(212,216,221,0.65)"}
                    strokeWidth="1.6" strokeLinecap="round"
                    strokeDasharray={n.state === "practicing" ? "26 98" : "2.5 8.5"}
                    style={{ transformBox: "fill-box", transformOrigin: "center", filter: "drop-shadow(0 0 3px rgba(255,255,255,0.8))" }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: n.state === "practicing" ? 3.2 : 12, repeat: Infinity, ease: "linear" }}
                  />
                )}

                <circle
                  cx={n.x} cy={n.y} r={R}
                  fill={achieved ? "url(#stg-chrome)" : "url(#stg-dark)"}
                  stroke={achieved ? "#ffffff" : locked ? "rgba(255,255,255,0.16)" : "#BFC0C2"}
                  strokeWidth="1.6"
                  style={achieved ? { filter: "drop-shadow(0 0 10px rgba(255,255,255,0.65))" } : undefined}
                />

                {n.state === "verified" && (
                  <path d={`M${n.x - 6.5} ${n.y} L${n.x - 1.5} ${n.y + 5} L${n.x + 7} ${n.y - 5.5}`} fill="none" stroke="#0a0a0a" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                )}
                {n.state === "mastered" && <polygon points={starPoints(n.x, n.y + 1, 10, 4)} fill="#0a0a0a" />}
                {n.state === "practicing" && (
                  <g stroke="#d4d8dd" strokeWidth="1.7" strokeLinecap="round" fill="none">
                    <circle cx={n.x} cy={n.y} r="7.5" />
                    <path d={`M${n.x} ${n.y - 4} V${n.y} L${n.x + 3} ${n.y + 2.5}`} />
                  </g>
                )}
                {n.state === "learning" && (
                  <path d={`M${n.x} ${n.y - 7.5} L${n.x + 6} ${n.y} L${n.x} ${n.y + 7.5} L${n.x - 6} ${n.y} Z`} fill="none" stroke="#d4d8dd" strokeWidth="1.7" strokeLinejoin="round" />
                )}
                {locked && (
                  <g stroke="rgba(255,255,255,0.38)" strokeWidth="1.7" fill="none" strokeLinecap="round">
                    <rect x={n.x - 6} y={n.y - 2} width="12" height="8.5" rx="1.8" />
                    <path d={`M${n.x - 3.5} ${n.y - 2} V${n.y - 5} a3.5 3.5 0 0 1 7 0 V${n.y - 2}`} />
                  </g>
                )}

                <text
                  x={n.x} y={n.y + R + 15} textAnchor="middle" className="font-aura"
                  fill={locked ? "#6F6F6F" : isSel ? "#ffffff" : "#E4E4E4"}
                  fontSize="12" fontWeight={isSel ? 700 : 500}
                  style={isSel ? { filter: "drop-shadow(0 0 6px rgba(255,255,255,0.6))" } : undefined}
                >
                  {lines.map((l, li) => (
                    <tspan key={li} x={n.x} dy={li === 0 ? 0 : 14}>
                      {l}
                    </tspan>
                  ))}
                </text>
              </motion.g>
            );
          })}
        </svg>
      </div>

      {/* detail bar */}
      <div className="mt-3 flex min-h-[64px] items-center rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 py-3">
        <AnimatePresence mode="wait">
          <motion.div
            key={sel.skill.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="flex w-full min-w-0 items-center justify-between gap-3"
          >
            <div className="min-w-0">
              <h4 className="font-aura truncate text-sm font-bold text-white">{sel.skill.name}</h4>
              {sel.skill.definition && (
                <p className="font-aura mt-0.5 line-clamp-2 text-xs leading-relaxed text-white/55">{sel.skill.definition}</p>
              )}
              {sel.state === "locked" && prereqNames.length > 0 && (
                <p className="font-aura mt-0.5 text-[11px] text-white/40">Χρειάζεται πρώτα: {prereqNames.join(", ")}</p>
              )}
            </div>
            <span
              className="font-aura shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
              style={{
                borderColor: sel.state === "locked" ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.6)",
                color: sel.state === "mastered" ? "#0a0a0a" : sel.state === "locked" ? "rgba(255,255,255,0.4)" : "#fff",
                background: sel.state === "mastered" ? "#fff" : "transparent",
                boxShadow: sel.state === "locked" ? "none" : "0 0 14px rgba(255,255,255,0.25)",
              }}
            >
              {STATE_LABEL[sel.state]}
            </span>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* legend */}
      <div className="font-aura mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2 text-[11px] text-white/55">
        <span className="flex items-center gap-1.5">
          <i className="inline-block size-2.5 rounded-full" style={{ background: "radial-gradient(circle at 35% 30%, #fff, #8a9098)", boxShadow: "0 0 6px rgba(255,255,255,0.7)" }} />
          Verified / Mastered
        </span>
        <span className="flex items-center gap-1.5">
          <i className="inline-block size-2.5 rounded-full border border-[#d4d8dd] bg-[#161718]" />
          Practicing
        </span>
        <span className="flex items-center gap-1.5">
          <i className="inline-block size-2.5 rounded-full border border-dashed border-[#d4d8dd]/70 bg-[#161718]" />
          Learning
        </span>
        <span className="flex items-center gap-1.5">
          <i className="inline-block size-2.5 rounded-full border border-white/15 bg-[#0a0a0a]" />
          Locked
        </span>
      </div>
    </section>
  );
}