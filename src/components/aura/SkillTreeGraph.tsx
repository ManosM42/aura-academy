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

/* Layout: one row per category (top -> bottom = progression), skills centred
   across the row. A single SVG scales to any screen, so mobile and desktop
   show exactly the same graph. */
const COL_W = 150;
const PAD_X = 70;
const ROW_H = 168;
const PAD_TOP = 20;
const PAD_BOTTOM = 24;
const NODE_OFFSET_Y = 76; // node centre below the row top
const R = 25;
const MIN_WIDTH = 440;

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

  const rows = CATEGORY_ORDER.filter((c) => (byCategory.get(c) ?? []).length > 0);
  const maxCols = Math.max(1, ...rows.map((c) => byCategory.get(c)!.length));
  const width = Math.max(MIN_WIDTH, PAD_X * 2 + (maxCols - 1) * COL_W);
  const height = PAD_TOP + rows.length * ROW_H + PAD_BOTTOM;

  const nodes: LaidOutNode[] = [];
  const byId = new Map<string, LaidOutNode>();
  const rowTops: { cat: SkillCategory; top: number }[] = [];

  rows.forEach((cat, rowIndex) => {
    const list = byCategory.get(cat)!;
    const top = PAD_TOP + rowIndex * ROW_H;
    rowTops.push({ cat, top });
    const startX = width / 2 - ((list.length - 1) * COL_W) / 2;
    list.forEach((skill, i) => {
      const node: LaidOutNode = {
        skill,
        state: skill.userSkill?.state ?? "locked",
        x: startX + i * COL_W,
        y: top + NODE_OFFSET_Y,
      };
      nodes.push(node);
      byId.set(skill.id, node);
    });
  });

  const edges: [LaidOutNode, LaidOutNode][] = [];
  for (const node of nodes) {
    for (const prereqId of node.skill.prerequisites ?? []) {
      const from = byId.get(prereqId);
      if (from) edges.push([from, node]);
    }
  }

  return { nodes, edges, rowTops, width, height };
}

function wrap(name: string, max = 14): string[] {
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
  const { nodes, edges, rowTops, width, height } = useMemo(() => layout(skills), [skills]);

  const defaultId = useMemo(() => {
    const pick =
      nodes.find((n) => n.state === "practicing") ??
      nodes.find((n) => n.state === "learning") ??
      nodes.find((n) => n.state !== "locked") ??
      nodes[0];
    return pick?.skill.id ?? null;
  }, [nodes]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  if (skills.length === 0) return null;

  const sel = nodes.find((n) => n.skill.id === (selectedId ?? defaultId)) ?? nodes[0]!;
  const prereqNames = (sel.skill.prerequisites ?? [])
    .map((id) => skills.find((s) => s.id === id)?.name)
    .filter(Boolean) as string[];

  return (
    <section className="relative mx-auto w-full max-w-4xl">
      <div className="relative w-full overflow-hidden rounded-2xl">
        {/* dotted grid */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.12) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
            maskImage: "radial-gradient(ellipse at center, black 30%, transparent 78%)",
            WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 78%)",
          }}
        />

        <svg viewBox={`0 0 ${width} ${height}`} className="relative block h-auto w-full select-none" role="group" aria-label="Skill progression tree">
          <defs>
            <linearGradient id="stg-edge" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={width} y2={height}>
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="50%" stopColor="#9aa0a8" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.95" />
            </linearGradient>
            <linearGradient id="stg-rule" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.28" />
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
              <feGaussianBlur stdDeviation="4" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* category bands */}
          {rowTops.map(({ cat, top }, i) => (
            <motion.g
              key={cat}
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease: EASE, delay: i * 0.08 }}
            >
              <text x={22} y={top + 20} className="font-aura" fill="rgba(255,255,255,0.6)" fontSize="15" fontWeight="600" letterSpacing="3">
                {CATEGORY_LABEL[cat].toUpperCase()}
              </text>
              <line x1={22} y1={top + 32} x2={width - 22} y2={top + 32} stroke="url(#stg-rule)" strokeWidth="1" />
            </motion.g>
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
                  stroke={lit ? "url(#stg-edge)" : soft ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.1)"}
                  strokeWidth={lit ? 2.6 : 1.6}
                  strokeLinecap="round"
                  strokeDasharray={!lit && !soft ? "3 9" : undefined}
                  filter={lit ? "url(#stg-glow)" : undefined}
                  initial={{ pathLength: 0, opacity: 0 }}
                  whileInView={{ pathLength: 1, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.1, ease: "easeInOut", delay: 0.1 + i * 0.05 }}
                />
                {lit && !reduce && (
                  <motion.path
                    d={d}
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeDasharray="6 46"
                    animate={{ strokeDashoffset: [0, -52] }}
                    transition={{ duration: 1.9, repeat: Infinity, ease: "linear" }}
                    style={{ filter: "drop-shadow(0 0 6px #fff)" }}
                  />
                )}
              </g>
            );
          })}

          {/* nodes */}
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
                initial={{ opacity: 0, scale: 0.5 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                whileHover={{ scale: 1.08 }}
                transition={{ duration: 0.65, ease: "backOut", delay: 0.2 + i * 0.05 }}
                style={{ transformBox: "fill-box", transformOrigin: "center", cursor: "pointer", outline: "none" }}
              >
                {/* transparent hit area (bigger tap target on phones) */}
                <circle cx={n.x} cy={n.y} r={R + 16} fill="transparent" />

                {isSel && <circle cx={n.x} cy={n.y} r={R + 14} fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.3" strokeDasharray="2 6" />}

                {/* mastered: extra outer halo */}
                {n.state === "mastered" && (
                  <circle cx={n.x} cy={n.y} r={R + 8} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" style={{ filter: "drop-shadow(0 0 8px #fff)" }} />
                )}

                {/* pulse: verified / mastered / practicing */}
                {(achieved || n.state === "practicing") && !reduce && (
                  <motion.circle
                    cx={n.x} cy={n.y} r={R} fill="none" stroke="#ffffff" strokeWidth="1.6"
                    style={{ transformBox: "fill-box", transformOrigin: "center" }}
                    animate={{ scale: [1, 1.8], opacity: [achieved ? 0.4 : 0.7, 0] }}
                    transition={{ duration: achieved ? 3.2 : 2, repeat: Infinity, ease: "easeOut", delay: (i % 5) * 0.35 }}
                  />
                )}

                {/* orbiting ring: practicing (fast), learning (slow, dashed) */}
                {(n.state === "practicing" || n.state === "learning") && !reduce && (
                  <motion.circle
                    cx={n.x} cy={n.y} r={R + 7} fill="none"
                    stroke={n.state === "practicing" ? "#d4d8dd" : "rgba(212,216,221,0.6)"}
                    strokeWidth="2" strokeLinecap="round"
                    strokeDasharray={n.state === "practicing" ? "34 126" : "3 11"}
                    style={{ transformBox: "fill-box", transformOrigin: "center", filter: "drop-shadow(0 0 4px rgba(255,255,255,0.8))" }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: n.state === "practicing" ? 3.2 : 12, repeat: Infinity, ease: "linear" }}
                  />
                )}

                {/* disc */}
                <circle
                  cx={n.x} cy={n.y} r={R}
                  fill={achieved ? "url(#stg-chrome)" : "url(#stg-dark)"}
                  stroke={achieved ? "#ffffff" : locked ? "rgba(255,255,255,0.14)" : "#BFC0C2"}
                  strokeWidth="2"
                  style={achieved ? { filter: "drop-shadow(0 0 14px rgba(255,255,255,0.65))" } : undefined}
                />

                {/* glyphs */}
                {n.state === "verified" && (
                  <path d={`M${n.x - 8} ${n.y} L${n.x - 2} ${n.y + 6} L${n.x + 9} ${n.y - 7}`} fill="none" stroke="#0a0a0a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                )}
                {n.state === "mastered" && <polygon points={starPoints(n.x, n.y + 1, 12, 5)} fill="#0a0a0a" />}
                {n.state === "practicing" && (
                  <g stroke="#d4d8dd" strokeWidth="2" strokeLinecap="round" fill="none">
                    <circle cx={n.x} cy={n.y} r="9" />
                    <path d={`M${n.x} ${n.y - 5} V${n.y} L${n.x + 4} ${n.y + 3}`} />
                  </g>
                )}
                {n.state === "learning" && (
                  <path d={`M${n.x} ${n.y - 9} L${n.x + 7} ${n.y} L${n.x} ${n.y + 9} L${n.x - 7} ${n.y} Z`} fill="none" stroke="#d4d8dd" strokeWidth="2" strokeLinejoin="round" />
                )}
                {locked && (
                  <g stroke="rgba(255,255,255,0.35)" strokeWidth="2" fill="none" strokeLinecap="round">
                    <rect x={n.x - 7} y={n.y - 2} width="14" height="10" rx="2" />
                    <path d={`M${n.x - 4} ${n.y - 2} V${n.y - 6} a4 4 0 0 1 8 0 V${n.y - 2}`} />
                  </g>
                )}

                {/* label */}
                <text
                  x={n.x} y={n.y + R + 22} textAnchor="middle" className="font-aura"
                  fill={locked ? "#6F6F6F" : isSel ? "#ffffff" : "#E4E4E4"}
                  fontSize="15" fontWeight={isSel ? 700 : 500}
                  style={isSel ? { filter: "drop-shadow(0 0 8px rgba(255,255,255,0.6))" } : undefined}
                >
                  {lines.map((l, li) => (
                    <tspan key={li} x={n.x} dy={li === 0 ? 0 : 18}>
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
      <div className="mt-3 flex min-h-[72px] items-center rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 py-4 sm:px-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={sel.skill.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <h4 className="font-aura text-base font-bold text-white">{sel.skill.name}</h4>
              {sel.skill.definition && (
                <p className="font-aura mt-1 line-clamp-2 text-sm leading-relaxed text-white/55">{sel.skill.definition}</p>
              )}
              {sel.state === "locked" && prereqNames.length > 0 && (
                <p className="font-aura mt-1 text-xs text-white/40">Χρειάζεται πρώτα: {prereqNames.join(", ")}</p>
              )}
            </div>
            <span
              className="font-aura inline-flex shrink-0 items-center self-start rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider sm:self-auto"
              style={{
                borderColor: sel.state === "locked" ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.6)",
                color: sel.state === "mastered" ? "#0a0a0a" : sel.state === "locked" ? "rgba(255,255,255,0.4)" : "#fff",
                background: sel.state === "mastered" ? "#fff" : "transparent",
                boxShadow: sel.state === "locked" ? "none" : "0 0 18px rgba(255,255,255,0.25)",
              }}
            >
              {STATE_LABEL[sel.state]}
            </span>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* legend */}
      <div className="font-aura mt-5 flex flex-wrap gap-x-6 gap-y-3 text-xs text-white/60">
        <span className="flex items-center gap-2">
          <i className="inline-block size-3 rounded-full" style={{ background: "radial-gradient(circle at 35% 30%, #fff, #8a9098)", boxShadow: "0 0 8px rgba(255,255,255,0.7)" }} />
          Verified / Mastered
        </span>
        <span className="flex items-center gap-2">
          <i className="inline-block size-3 rounded-full border border-[#d4d8dd] bg-[#161718] shadow-[0_0_6px_rgba(255,255,255,0.5)]" />
          Practicing
        </span>
        <span className="flex items-center gap-2">
          <i className="inline-block size-3 rounded-full border border-dashed border-[#d4d8dd]/70 bg-[#161718]" />
          Learning
        </span>
        <span className="flex items-center gap-2">
          <i className="inline-block size-3 rounded-full border border-white/15 bg-[#0a0a0a]" />
          Locked
        </span>
      </div>
    </section>
  );
}