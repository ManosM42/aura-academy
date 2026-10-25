import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

const STEPS = [
  { n: "01", title: "Observe", body: "I gather visual and technical information." },
  { n: "02", title: "Analyze", body: "I understand the face, head, hair and goal." },
  { n: "03", title: "Design", body: "I choose shapes, lengths and transitions." },
  { n: "04", title: "Execute", body: "I apply the technique with control." },
  { n: "05", title: "Evaluate", body: "I compare the result with the goal." },
  { n: "06", title: "Evolve", body: "I spot mistakes and refine the process." },
];

const CHROME =
  "linear-gradient(90deg, #595959 0%, #b3b3b3 25%, #ffffff 50%, #b3b3b3 75%, #595959 100%)";

const EASE = [0.22, 1, 0.36, 1] as const;

function nodePos(i: number) {
  const a = ((-90 + i * 60) * Math.PI) / 180;
  return { x: 50 + 40 * Math.cos(a), y: 50 + 40 * Math.sin(a) };
}

export default function Method() {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || reduce) return;
    const t = setInterval(() => setActive((a) => (a + 1) % STEPS.length), 3200);
    return () => clearInterval(t);
  }, [paused, reduce]);

  const step = STEPS[active];

  return (
    <section id="method" className="relative mx-auto max-w-6xl overflow-hidden px-6 py-32">
      {/* ambient chrome glow */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[720px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(255,255,255,0.10) 0%, rgba(180,190,200,0.05) 35%, transparent 70%)",
        }}
        animate={reduce ? undefined : { opacity: [0.5, 1, 0.5], scale: [0.95, 1.05, 0.95] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* heading */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.9, ease: EASE }}
        className="relative mb-20 text-center"
      >
        <p className="font-aura mb-4 text-xs font-semibold tracking-[0.4em] text-white/50">
          AURA CYCLE
        </p>
        <h2 className="font-aura text-4xl font-extrabold tracking-tight md:text-6xl">
          <motion.span
            initial={{ backgroundPosition: "0% 50%" }}
            animate={{ backgroundPosition: "100% 50%" }}
            transition={{ duration: 4, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
            style={{
              backgroundImage: CHROME,
              backgroundSize: "300% auto",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
            className="inline-block drop-shadow-[0_2px_4px_rgba(255,255,255,0.9)] drop-shadow-[0_10px_30px_rgba(0,0,0,0.95)] drop-shadow-[0_0_60px_rgba(255,255,255,0.7)]"
          >
            THE AURA METHOD
          </motion.span>
        </h2>
        <p className="font-aura mx-auto mt-6 max-w-md text-sm leading-relaxed text-white/55">
          The core thinking cycle of the professional.
        </p>
      </motion.div>

      <div className="relative grid items-center gap-16 lg:grid-cols-2">
        {/* ORBIT */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 1.1, ease: EASE }}
          className="relative mx-auto aspect-square w-full max-w-[460px]"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full overflow-visible">
            <defs>
              <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
                <stop offset="50%" stopColor="#8a8f96" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0.5" />
              </linearGradient>
              <linearGradient id="beam" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="1" />
              </linearGradient>
              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="1.4" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* outer hairline + base ring */}
            <circle cx="50" cy="50" r="47" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.2" strokeDasharray="0.6 1.6" />
            <circle cx="50" cy="50" r="40" fill="none" stroke="url(#ring)" strokeWidth="0.35" />
            <circle cx="50" cy="50" r="31" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.2" />

            {/* travelling light */}
            {!reduce && (
              <motion.circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="url(#beam)"
                strokeWidth="0.9"
                strokeLinecap="round"
                strokeDasharray="38 213.3"
                filter="url(#glow)"
                style={{ transformOrigin: "50px 50px" }}
                animate={{ rotate: 360 }}
                transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
              />
            )}
          </svg>

          {/* center readout */}
          <div className="absolute inset-0 flex items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={step.n}
                initial={{ opacity: 0, y: 10, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -10, filter: "blur(6px)" }}
                transition={{ duration: 0.5, ease: EASE }}
                className="text-center"
              >
                <span
                  className="font-aura block text-6xl font-extrabold md:text-7xl"
                  style={{
                    backgroundImage: CHROME,
                    backgroundSize: "200% auto",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    filter: "drop-shadow(0 0 24px rgba(255,255,255,0.45))",
                  }}
                >
                  {step.n}
                </span>
                <span className="font-aura mt-2 block text-sm font-semibold tracking-[0.3em] text-white/70">
                  {step.title.toUpperCase()}
                </span>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* nodes */}
          {STEPS.map((s, i) => {
            const { x, y } = nodePos(i);
            const on = i === active;
            return (
              <button
                key={s.n}
                type="button"
                aria-label={`${s.n} ${s.title}`}
                aria-current={on}
                onClick={() => setActive(i)}
                onFocus={() => setActive(i)}
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                style={{ left: `${x}%`, top: `${y}%` }}
              >
                <motion.span
                  animate={{
                    scale: on ? 1.25 : 1,
                    boxShadow: on
                      ? "0 0 0 1px rgba(255,255,255,0.9), 0 0 28px rgba(255,255,255,0.65), inset 0 1px 0 rgba(255,255,255,0.9)"
                      : "0 0 0 1px rgba(255,255,255,0.16), 0 0 0 rgba(255,255,255,0), inset 0 1px 0 rgba(255,255,255,0.25)",
                  }}
                  transition={{ duration: 0.5, ease: EASE }}
                  className="font-aura flex h-11 w-11 items-center justify-center rounded-full text-[11px] font-bold md:h-12 md:w-12"
                  style={{
                    background: on
                      ? "linear-gradient(145deg, #ffffff 0%, #c9ced4 45%, #7d838b 100%)"
                      : "linear-gradient(145deg, #1b1d20 0%, #0d0e10 100%)",
                    color: on ? "#0a0a0a" : "rgba(255,255,255,0.65)",
                  }}
                >
                  {s.n}
                </motion.span>
              </button>
            );
          })}
        </motion.div>

        {/* STEP LIST */}
        <div
          className="relative flex flex-col gap-3"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {STEPS.map((s, i) => {
            const on = i === active;
            return (
              <motion.button
                key={s.n}
                type="button"
                onClick={() => setActive(i)}
                initial={{ opacity: 0, x: 24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.7, ease: EASE, delay: i * 0.08 }}
                className="group relative overflow-hidden rounded-xl border p-5 text-left outline-none transition-colors duration-500 focus-visible:ring-2 focus-visible:ring-white/70"
                style={{
                  borderColor: on ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.07)",
                  background: on
                    ? "linear-gradient(120deg, rgba(255,255,255,0.10), rgba(255,255,255,0.02) 60%)"
                    : "rgba(255,255,255,0.02)",
                  boxShadow: on ? "0 0 40px rgba(255,255,255,0.08), inset 0 1px 0 rgba(255,255,255,0.25)" : "none",
                }}
              >
                {/* chrome sweep on active */}
                {on && !reduce && (
                  <motion.span
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0 w-1/3"
                    style={{
                      background:
                        "linear-gradient(100deg, transparent, rgba(255,255,255,0.18), transparent)",
                    }}
                    initial={{ left: "-35%" }}
                    animate={{ left: "110%" }}
                    transition={{ duration: 1.6, ease: "easeInOut" }}
                  />
                )}
                <div className="relative flex items-center gap-5">
                  <span
                    className="font-aura text-sm font-semibold tracking-widest transition-colors duration-500"
                    style={{ color: on ? "#ffffff" : "rgba(255,255,255,0.35)" }}
                  >
                    {s.n}
                  </span>
                  <div>
                    <h3
                      className="font-aura text-xl font-bold transition-colors duration-500"
                      style={{ color: on ? "#ffffff" : "rgba(255,255,255,0.75)" }}
                    >
                      {s.title}
                    </h3>
                    <p className="font-aura mt-1 text-sm leading-relaxed text-white/55">{s.body}</p>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* loop banner */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.9, ease: EASE }}
        className="relative mt-20 text-center"
      >
        <div
          aria-hidden
          className="mx-auto mb-8 h-px w-full max-w-md"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(255,255,255,0.7), transparent)",
            boxShadow: "0 0 20px rgba(255,255,255,0.5)",
          }}
        />
        <p
          className="font-aura text-2xl font-extrabold tracking-[0.25em] md:text-3xl"
          style={{
            backgroundImage: CHROME,
            backgroundSize: "300% auto",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            filter: "drop-shadow(0 0 18px rgba(255,255,255,0.35))",
          }}
        >
          REPEAT → IMPROVE
        </p>
        <p className="font-aura mx-auto mt-4 max-w-lg text-sm leading-relaxed text-white/55">
          Evaluation returns to observation, and the cycle continues.
        </p>
      </motion.div>
    </section>
  );
}