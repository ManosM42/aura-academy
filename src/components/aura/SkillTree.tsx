import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

interface Step {
  n: string;
  label: string;
  desc: string;
  x: number;
  y: number;
}

const CX = 320;
const CY = 280;
const R = 185;

const RAW = [
  { n: "01", label: "Observe", desc: "I gather visual and technical information." },
  { n: "02", label: "Analyze", desc: "I understand the face, head, hair and goal." },
  { n: "03", label: "Design", desc: "I choose shapes, lengths and transitions." },
  { n: "04", label: "Execute", desc: "I apply the technique with control." },
  { n: "05", label: "Evaluate", desc: "I compare the result with the goal." },
  { n: "06", label: "Evolve", desc: "I spot mistakes and refine the process." },
];

const STEPS: Step[] = RAW.map((s, i) => {
  const a = ((-90 + i * 60) * Math.PI) / 180;
  return { ...s, x: CX + R * Math.cos(a), y: CY + R * Math.sin(a) };
});

const EASE = [0.22, 1, 0.36, 1] as const;

const CHROME_TEXT =
  "linear-gradient(90deg, #595959 0%, #b3b3b3 25%, #ffffff 50%, #b3b3b3 75%, #595959 100%)";

/** where the label sits relative to each node (hexagon: top, right x2, bottom, left x2) */
function labelProps(i: number, s: Step) {
  if (i === 0) return { x: s.x, y: s.y - 40, anchor: "middle" as const };
  if (i === 3) return { x: s.x, y: s.y + 54, anchor: "middle" as const };
  if (i === 1 || i === 2) return { x: s.x + 40, y: s.y + 7, anchor: "start" as const };
  return { x: s.x - 40, y: s.y + 7, anchor: "end" as const };
}

export default function SkillTree() {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || reduce) return;
    const t = setInterval(() => setActive((a) => (a + 1) % STEPS.length), 3200);
    return () => clearInterval(t);
  }, [paused, reduce]);

  const sel = STEPS[active];

  return (
    <section id="skilltree" className="relative mx-auto max-w-5xl overflow-hidden px-4 py-20 sm:px-6 sm:py-32">
      {/* ambient glow */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[min(760px,100%)] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(255,255,255,0.08) 0%, rgba(170,180,190,0.04) 40%, transparent 70%)" }}
        animate={reduce ? undefined : { opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* header */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.9, ease: EASE }}
        className="relative mb-10 text-center sm:mb-14"
      >
        <span className="font-aura text-xs uppercase tracking-[0.4em] text-white/50 sm:tracking-[0.5em]">
          Aura Cycle
        </span>
        <h2 className="font-aura mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl md:text-6xl">
          <motion.span
            initial={{ backgroundPosition: "0% 50%" }}
            animate={{ backgroundPosition: "100% 50%" }}
            transition={{ duration: 4, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
            style={{
              backgroundImage: CHROME_TEXT,
              backgroundSize: "300% auto",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
            className="inline-block drop-shadow-[0_2px_4px_rgba(255,255,255,0.9)] drop-shadow-[0_10px_30px_rgba(0,0,0,0.95)] drop-shadow-[0_0_60px_rgba(255,255,255,0.7)]"
          >
            THE AURA METHOD
          </motion.span>
        </h2>
        <p className="font-aura mx-auto mt-5 max-w-xs text-sm leading-relaxed text-white/55 sm:max-w-md">
          The core thinking cycle of the professional.
        </p>
      </motion.div>

      {/* chrome graph panel — same layout on every screen size */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 1, ease: EASE }}
        onPointerEnter={() => setPaused(true)}
        onPointerLeave={() => setPaused(false)}
        className="relative mx-auto w-full max-w-3xl rounded-3xl p-px"
        style={{
          background: "linear-gradient(135deg, rgba(255,255,255,0.45), rgba(255,255,255,0.05) 35%, rgba(255,255,255,0.05) 65%, rgba(255,255,255,0.4))",
          boxShadow: "0 0 80px rgba(0,0,0,0.9), 0 0 60px rgba(255,255,255,0.05)",
        }}
      >
        <div className="relative overflow-hidden rounded-[23px] bg-[#070707] p-2 sm:p-4">
          {/* top sheen */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-32" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.06), transparent)" }} />
          {/* dotted grid */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.35]"
            style={{
              backgroundImage: "radial-gradient(rgba(255,255,255,0.12) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
              maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
              WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
            }}
          />

          <div className="relative w-full">
            <svg viewBox="0 0 640 560" className="block h-auto w-full select-none" role="group" aria-label="AURA Cycle">
              <defs>
                <linearGradient id="edgeChrome" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="640" y2="560">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
                  <stop offset="50%" stopColor="#9aa0a8" stopOpacity="0.55" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="0.9" />
                </linearGradient>
                <radialGradient id="discChrome" cx="35%" cy="30%" r="80%">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="45%" stopColor="#c9ced4" />
                  <stop offset="100%" stopColor="#6c7279" />
                </radialGradient>
                <radialGradient id="discDark" cx="35%" cy="30%" r="90%">
                  <stop offset="0%" stopColor="#2a2d31" />
                  <stop offset="100%" stopColor="#0c0d0e" />
                </radialGradient>
                <filter id="softGlow" x="-100%" y="-100%" width="300%" height="300%">
                  <feGaussianBlur stdDeviation="5" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* inner & outer guide rings */}
              <circle cx={CX} cy={CY} r={R + 52} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="2 8" />
              <circle cx={CX} cy={CY} r={R - 52} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />

              {/* edges (closed loop) */}
              {STEPS.map((from, i) => {
                const to = STEPS[(i + 1) % STEPS.length];
                return (
                  <g key={`edge-${i}`}>
                    <motion.line
                      x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                      stroke="url(#edgeChrome)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      filter="url(#softGlow)"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 1 }}
                      transition={{ duration: 1.2, ease: "easeInOut", delay: i * 0.12 }}
                    />
                    {!reduce && (
                      <motion.line
                        x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                        stroke="#ffffff"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeDasharray="6 44"
                        animate={{ strokeDashoffset: [0, -50] }}
                        transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
                        style={{ filter: "drop-shadow(0 0 6px #fff)" }}
                      />
                    )}
                  </g>
                );
              })}

              {/* nodes */}
              {STEPS.map((s, i) => {
                const on = i === active;
                const lp = labelProps(i, s);
                return (
                  <motion.g
                    key={s.n}
                    role="button"
                    tabIndex={0}
                    aria-label={`${s.n} ${s.label}`}
                    aria-current={on}
                    onClick={() => setActive(i)}
                    onFocus={() => setActive(i)}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setActive(i)}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.7, ease: EASE, delay: 0.3 + i * 0.09 }}
                    style={{ cursor: "pointer", outline: "none" }}
                  >
                    {/* larger tap target */}
                    <circle cx={s.x} cy={s.y} r="44" fill="rgba(0,0,0,0.001)" />

                    {/* selection ring */}
                    {on && <circle cx={s.x} cy={s.y} r="40" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.2" strokeDasharray="2 6" />}

                    {/* pulse */}
                    {on && !reduce && (
                      <motion.circle
                        cx={s.x} cy={s.y} r="28" fill="none" stroke="#ffffff" strokeWidth="1.8"
                        style={{ transformBox: "fill-box", transformOrigin: "center" }}
                        animate={{ scale: [1, 1.9], opacity: [0.7, 0] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                      />
                    )}

                    {/* orbiting ring */}
                    {on && !reduce && (
                      <motion.circle
                        cx={s.x} cy={s.y} r="35" fill="none" stroke="#d4d8dd" strokeWidth="2" strokeLinecap="round" strokeDasharray="36 184"
                        style={{ transformBox: "fill-box", transformOrigin: "center", filter: "drop-shadow(0 0 5px #fff)" }}
                        animate={{ rotate: 360 }}
                        transition={{ duration: 3.5, repeat: Infinity, ease: "linear" }}
                      />
                    )}

                    {/* dark disc */}
                    <circle cx={s.x} cy={s.y} r="28" fill="url(#discDark)" stroke="rgba(255,255,255,0.35)" strokeWidth="2" />
                    {/* chrome disc fades in when active */}
                    <motion.circle
                      cx={s.x} cy={s.y} r="28" fill="url(#discChrome)" stroke="#ffffff" strokeWidth="2"
                      animate={{ opacity: on ? 1 : 0 }}
                      transition={{ duration: 0.5, ease: EASE }}
                      style={{ filter: "drop-shadow(0 0 14px rgba(255,255,255,0.65))" }}
                    />
                    <text
                      x={s.x} y={s.y + 6} textAnchor="middle" className="font-aura"
                      fontSize="17" fontWeight="800" fill={on ? "#0a0a0a" : "#d9dce0"}
                    >
                      {s.n}
                    </text>

                    <text
                      x={lp.x} y={lp.y} textAnchor={lp.anchor} className="font-aura"
                      fontSize="21" fontWeight={on ? 700 : 500}
                      fill={on ? "#ffffff" : "#B8BBBF"}
                      style={on ? { filter: "drop-shadow(0 0 8px rgba(255,255,255,0.6))" } : undefined}
                    >
                      {s.label}
                    </text>
                  </motion.g>
                );
              })}
            </svg>

            {/* center readout (sized as % of the graph so it scales with it) */}
            <div className="pointer-events-none absolute left-1/2 top-1/2 flex w-[34%] -translate-x-1/2 -translate-y-1/2 items-center justify-center text-center">
              <AnimatePresence mode="wait">
                <motion.div
                  key={sel.n}
                  initial={{ opacity: 0, y: 8, filter: "blur(6px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -8, filter: "blur(6px)" }}
                  transition={{ duration: 0.45, ease: EASE }}
                >
                  <span
                    className="font-aura block text-5xl font-extrabold leading-none sm:text-7xl"
                    style={{
                      backgroundImage: CHROME_TEXT,
                      backgroundSize: "200% auto",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      filter: "drop-shadow(0 0 20px rgba(255,255,255,0.45))",
                    }}
                  >
                    {sel.n}
                  </span>
                  <span className="font-aura mt-2 block text-[10px] tracking-[0.3em] text-white/50 sm:text-xs">
                    AURA CYCLE
                  </span>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* detail bar */}
          <div className="relative mt-2 flex min-h-[72px] items-center rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 py-4 sm:px-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={sel.n}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35, ease: EASE }}
                className="min-w-0"
              >
                <h4 className="font-aura text-base font-bold text-white">
                  {sel.n} {sel.label}
                </h4>
                <p className="font-aura mt-1 text-sm leading-relaxed text-white/60">{sel.desc}</p>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* loop banner */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.9, ease: EASE }}
        className="relative mt-14 text-center sm:mt-20"
      >
        <div
          aria-hidden
          className="mx-auto mb-8 h-px w-full max-w-xs sm:max-w-md"
          style={{
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.7), transparent)",
            boxShadow: "0 0 20px rgba(255,255,255,0.5)",
          }}
        />
        <p
          className="font-aura text-xl font-extrabold tracking-[0.18em] sm:text-3xl sm:tracking-[0.25em]"
          style={{
            backgroundImage: CHROME_TEXT,
            backgroundSize: "300% auto",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            filter: "drop-shadow(0 0 18px rgba(255,255,255,0.35))",
          }}
        >
          REPEAT → IMPROVE
        </p>
        <p className="font-aura mx-auto mt-4 max-w-xs text-sm leading-relaxed text-white/55 sm:max-w-lg">
          Evaluation returns to observation, and the cycle continues.
        </p>
      </motion.div>
    </section>
  );
}