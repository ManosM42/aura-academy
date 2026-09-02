import { motion } from "motion/react";
import type { SkillCategory, SkillState, SkillWithState } from "@/lib/database.types";

// Στήλες ανά category — σειρά "μαθησιακής προόδου"
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
    <section className="relative mx-auto max-w-6xl">
      <div className="overflow-x-auto rounded-2xl border border-white/[0.06] bg-aura-bg2 p-4">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full min-w-[720px]">
          {edges.map(([from, to], i) => {
            const active = from.state !== "locked" && to.state !== "locked";
            return (
              <motion.line
                key={`${from.skill.id}-${to.skill.id}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={active ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.12)"}
                strokeWidth="1.5"
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
                <circle cx={n.x} cy={n.y} r="30" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="6" />
              )}
              <circle cx={n.x} cy={n.y} r="22" strokeWidth="1.5" className={nodeStyles[n.state]} />
              <text
                x={n.x}
                y={n.y + 46}
                textAnchor="middle"
                className="font-aura"
                fill={textFill[n.state]}
                fontSize="12"
              >
                {n.skill.name}
              </text>
              {(n.state === "verified" || n.state === "mastered") && (
                <text x={n.x} y={n.y + 5} textAnchor="middle" fill="#FFFFFF" fontSize="14">
                  ✓
                </text>
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

      <div className="mt-6 flex flex-wrap gap-6 text-xs text-aura-text-secondary font-aura">
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