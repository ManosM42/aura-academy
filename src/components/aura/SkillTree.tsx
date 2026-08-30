import { motion } from "motion/react";

type State = "verified" | "active" | "locked";

interface Node {
  id: string;
  label: string;
  x: number;
  y: number;
  state: State;
}

const NODES: Node[] = [
  { id: "fundamentals", label: "Fundamentals", x: 120, y: 220, state: "verified" },
  { id: "clipper", label: "Clipper Work", x: 320, y: 120, state: "verified" },
  { id: "scissor", label: "Scissor Over Comb", x: 320, y: 320, state: "active" },
  { id: "fades", label: "Fades", x: 540, y: 120, state: "active" },
  { id: "beard", label: "Beard Sculpting", x: 540, y: 320, state: "locked" },
  { id: "signature", label: "Signature Cuts", x: 760, y: 220, state: "locked" },
];

const EDGES: [string, string][] = [
  ["fundamentals", "clipper"],
  ["fundamentals", "scissor"],
  ["clipper", "fades"],
  ["scissor", "beard"],
  ["fades", "signature"],
  ["beard", "signature"],
];

const byId = (id: string) => NODES.find((n) => n.id === id)!;

const nodeStyles: Record<State, string> = {
  verified: "fill-[#171717] stroke-white",
  active: "fill-[#171717] stroke-[#BFC0C2]",
  locked: "fill-[#0A0A0A] stroke-white/15",
};

export default function SkillTree() {
  return (
    <section id="skilltree" className="relative mx-auto max-w-6xl px-6 py-32">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className="mb-14"
      >
        <span className="font-aura text-xs uppercase tracking-[0.5em] text-aura-text-muted">
          Competency Map
        </span>
        <h2 className="chrome-text font-aura mt-4 text-4xl font-extrabold tracking-tight md:text-5xl">
          THE SKILL TREE.
        </h2>
      </motion.div>

      <div className="overflow-x-auto rounded-2xl border border-white/[0.06] bg-aura-bg2 p-4">
        <svg viewBox="0 0 880 440" className="h-auto w-full min-w-[720px]">
          {/* connections */}
          {EDGES.map(([a, b], i) => {
            const from = byId(a);
            const to = byId(b);
            const verified = from.state === "verified" && to.state !== "locked";
            return (
              <motion.line
                key={`${a}-${b}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={verified ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.12)"}
                strokeWidth="1.5"
                initial={{ pathLength: 0, opacity: 0 }}
                whileInView={{ pathLength: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1.1, ease: "easeInOut", delay: i * 0.12 }}
              />
            );
          })}

          {/* nodes */}
          {NODES.map((n, i) => (
            <motion.g
              key={n.id}
              initial={{ opacity: 0, scale: 0.6 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease: "backOut", delay: 0.3 + i * 0.1 }}
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
            >
              {n.state === "verified" && (
                <circle
                  cx={n.x}
                  cy={n.y}
                  r="30"
                  fill="none"
                  stroke="rgba(255,255,255,0.18)"
                  strokeWidth="6"
                />
              )}
              <circle
                cx={n.x}
                cy={n.y}
                r="22"
                strokeWidth="1.5"
                className={nodeStyles[n.state]}
              />
              <text
                x={n.x}
                y={n.y + 46}
                textAnchor="middle"
                className="font-aura"
                fill={n.state === "locked" ? "#6F6F6F" : "#F5F5F5"}
                fontSize="13"
              >
                {n.label}
              </text>
              {n.state === "verified" && (
                <text
                  x={n.x}
                  y={n.y + 5}
                  textAnchor="middle"
                  fill="#FFFFFF"
                  fontSize="14"
                >
                  ✓
                </text>
              )}
            </motion.g>
          ))}
        </svg>
      </div>

      <div className="mt-6 flex flex-wrap gap-6 text-xs text-aura-text-secondary font-aura">
        <span className="flex items-center gap-2">
          <i className="inline-block h-3 w-3 rounded-full border border-white bg-aura-elevated" />
          Verified
        </span>
        <span className="flex items-center gap-2">
          <i className="inline-block h-3 w-3 rounded-full border border-aura-chrome-mid bg-aura-elevated" />
          Active
        </span>
        <span className="flex items-center gap-2">
          <i className="inline-block h-3 w-3 rounded-full border border-white/15 bg-aura-bg2" />
          Locked
        </span>
      </div>
    </section>
  );
}