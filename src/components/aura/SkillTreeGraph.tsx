import { motion } from "motion/react";
import { CheckCircle2, Lock, Clock, Sparkles, Award } from "lucide-react";
import type { SkillCategory, SkillState, SkillWithState } from "@/lib/database.types";

const CATEGORY_ORDER: SkillCategory[] = [
  "foundation",
  "technical",
  "analysis",
  "design",
  "business",
  "educator",
];

const nodeStyles: Record<SkillState, string> = {
  mastered: "fill-[#171717] stroke-violet-300",
  verified: "fill-[#171717] stroke-white",
  practicing: "fill-[#171717] stroke-amber-300",
  learning: "fill-[#171717] stroke-blue-300",
  locked: "fill-[#0A0A0A] stroke-white/15",
};

const textFill: Record<SkillState, string> = {
  mastered: "#F5F5F5",
  verified: "#F5F5F5",
  practicing: "#F5F5F5",
  learning: "#F5F5F5",
  locked: "#6F6F6F",
};

interface LaidOutNode {
  skill: SkillWithState;
  state: SkillState;
  x: number;
  y: number;
}

const COL_WIDTH = 220;
const ROW_HEIGHT = 110;
const PADDING_X = 120;
const PADDING_Y = 80;

function layout(skills: SkillWithState[]): {
  nodes: LaidOutNode[];
  edges: [LaidOutNode, LaidOutNode][];
  width: number;
  height: number;
} {
  const byCategory = new Map<SkillCategory, SkillWithState[]>();
  for (const s of skills) {
    const list = byCategory.get(s.category) ?? [];
    list.push(s);
    byCategory.set(s.category, list);
  }
  for (const list of byCategory.values()) {
    list.sort((a, b) => a.sort_order - b.sort_order);
  }

  const nodes: LaidOutNode[] = [];
  const byId = new Map<string, LaidOutNode>();

  CATEGORY_ORDER.forEach((cat, colIndex) => {
    const list = byCategory.get(cat) ?? [];
    list.forEach((skill, rowIndex) => {
      const node: LaidOutNode = {
        skill,
        state: skill.userSkill?.state ?? "locked",
        x: PADDING_X + colIndex * COL_WIDTH,
        y: PADDING_Y + rowIndex * ROW_HEIGHT,
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

  const maxRows = Math.max(
    1,
    ...CATEGORY_ORDER.map((cat) => (byCategory.get(cat) ?? []).length),
  );
  const width = PADDING_X * 2 + (CATEGORY_ORDER.length - 1) * COL_WIDTH;
  const height = PADDING_Y * 2 + (maxRows - 1) * ROW_HEIGHT;

  return { nodes, edges, width: Math.max(width, 640), height: Math.max(height, 320) };
}

export default function SkillTreeGraph({ skills }: { skills: SkillWithState[] }) {
  if (skills.length === 0) return null;

  const { nodes, edges, width, height } = layout(skills);

  return (
    <section className="relative mx-auto max-w-6xl px-4 sm:px-0">
      {/* MOBILE VIEW: Καθαρή ομαδοποιημένη λίστα για κινητά */}
      <div className="block md:hidden space-y-6">
        {CATEGORY_ORDER.map((cat) => {
          const catSkills = nodes.filter((n) => n.skill.category === cat);
          if (catSkills.length === 0) return null;

          return (
            <div key={cat} className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50 px-1">
                {cat}
              </h3>
              <div className="space-y-2">
                {catSkills.map((n) => (
                  <div
                    key={n.skill.id}
                    className={`flex items-center justify-between rounded-xl border p-3.5 backdrop-blur-xl ${
                      n.state === "verified" || n.state === "mastered"
                        ? "border-white/30 bg-white/[0.04]"
                        : n.state === "practicing"
                        ? "border-amber-300/30 bg-amber-300/[0.02]"
                        : n.state === "learning"
                        ? "border-blue-300/30 bg-blue-300/[0.02]"
                        : "border-white/10 bg-black/40 opacity-60"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/5 text-xs text-white">
                        {n.state === "mastered" || n.state === "verified" ? <CheckCircle2 size={14} className="text-white" /> :
                         n.state === "practicing" ? <Award size={14} className="text-amber-300" /> :
                         n.state === "learning" ? <Sparkles size={14} className="text-blue-300" /> : <Lock size={14} className="text-white/40" />}
                      </div>
                      <div>
                        <h4 className="font-aura text-xs font-medium text-white">{n.skill.name}</h4>
                        <span className="text-[10px] uppercase tracking-wider text-white/40">{n.state}</span>
                      </div>
                    </div>
                    {n.skill.userSkill?.score != null && (
                      <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-mono text-white">
                        {n.skill.userSkill.score}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* DESKTOP VIEW: Δυναμικό SVG Γράφημα */}
      <div className="hidden md:block relative w-full rounded-2xl border border-white/[0.08] bg-[#070707] p-4 shadow-[0_0_40px_rgba(0,0,0,0.8)] backdrop-blur-xl">
        <div className="overflow-x-auto scrollbar-none rounded-xl">
          <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full min-w-[720px] select-none">
            {edges.map(([from, to], i) => {
              const active = from.state !== "locked" && to.state !== "locked";
              return (
                <motion.line
                  key={`${from.skill.id}-${to.skill.id}`}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={active ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.15)"}
                  strokeWidth="2"
                  initial={{ pathLength: 0, opacity: 0 }}
                  whileInView={{ pathLength: 1, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.1, ease: "easeInOut", delay: i * 0.06 }}
                />
              );
            })}

            {nodes.map((n, i) => (
              <motion.g
                key={n.skill.id}
                initial={{ opacity: 0, scale: 0.6 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, ease: "backOut", delay: 0.15 + i * 0.05 }}
                style={{ transformBox: "fill-box", transformOrigin: "center" }}
              >
                {(n.state === "verified" || n.state === "mastered") && (
                  <circle cx={n.x} cy={n.y} r="30" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="4" />
                )}
                <circle cx={n.x} cy={n.y} r="22" strokeWidth="2" className={nodeStyles[n.state]} />
                <text x={n.x} y={n.y + 46} textAnchor="middle" className="font-aura" fill={textFill[n.state]} fontSize="12">
                  {n.skill.name}
                </text>
                {(n.state === "verified" || n.state === "mastered") && (
                  <text x={n.x} y={n.y + 5} textAnchor="middle" fill="#FFFFFF" fontSize="14" fontWeight="bold">✓</text>
                )}
                {n.skill.userSkill?.score != null && n.state !== "locked" && (
                  <text x={n.x} y={n.y - 32} textAnchor="middle" fill="#9CA3AF" fontSize="10">
                    {n.skill.userSkill.score}
                  </text>
                )}
              </motion.g>
            ))}
          </svg>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-4 sm:gap-6 text-xs text-aura-text-secondary font-aura">
        <span className="flex items-center gap-2">
          <i className="inline-block h-3 w-3 rounded-full border border-white bg-aura-elevated" />
          Verified / Mastered
        </span>
        <span className="flex items-center gap-2">
          <i className="inline-block h-3 w-3 rounded-full border border-amber-300 bg-aura-elevated" />
          Practicing
        </span>
        <span className="flex items-center gap-2">
          <i className="inline-block h-3 w-3 rounded-full border border-blue-300 bg-aura-elevated" />
          Learning
        </span>
        <span className="flex items-center gap-2">
          <i className="inline-block h-3 w-3 rounded-full border border-white/15 bg-aura-bg2" />
          Locked
        </span>
      </div>
    </section>
  );
}