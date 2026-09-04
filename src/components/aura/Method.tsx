import { motion } from "motion/react";

const STEPS = [
  {
    n: "01",
    title: "Learn",
    body: "Structured, cinematic lessons built around precision and craftsmanship — not generic classroom content.",
  },
  {
    n: "02",
    title: "Practice",
    body: "Guided repetition with measurable progress. Every technique refined until it becomes instinct.",
  },
  {
    n: "03",
    title: "Prove",
    body: "Verify each skill and unlock a prestigious, officially traceable AURA certification.",
  },
];

export default function Method() {
  return (
    <section id="method" className="relative mx-auto max-w-6xl px-6 py-32">
      <motion.h2
  initial={{ opacity: 0, y: 24 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, margin: "-100px" }}
  transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
  className="font-aura mb-16 text-4xl font-extrabold tracking-tight md:text-5xl"
>
  <motion.span
    initial={{ backgroundPosition: "0% 50%" }}
    animate={{ backgroundPosition: "100% 50%" }}
    transition={{
      duration: 4,
      repeat: Infinity,
      repeatType: "reverse",
      ease: "easeInOut",
    }}
    style={{
      backgroundImage:
        "linear-gradient(90deg, #595959 0%, #b3b3b3 25%, #ffffff 50%, #b3b3b3 75%, #595959 100%)",
      backgroundSize: "300% auto",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
    }}
    className="inline-block drop-shadow-[0_2px_4px_rgba(255,255,255,0.9)] drop-shadow-[0_10px_30px_rgba(0,0,0,0.95)] drop-shadow-[0_0_60px_rgba(255,255,255,0.7)]"
  >
    HAIR METHOD.
  </motion.span>
</motion.h2>

      <div className="grid gap-6 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <motion.article
            key={s.n}
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.8, ease: "easeOut", delay: i * 0.12 }}
            className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-aura-surface p-8 transition-all duration-500 hover:-translate-y-1 hover:border-white/20"
          >
            {/* radial spotlight on hover */}
            <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 aura-radial" />
            <span className="chrome-text font-aura relative text-sm font-semibold tracking-widest">
              {s.n}
            </span>
            <h3 className="font-aura relative mt-4 text-2xl font-bold text-aura-text">
              {s.title}
            </h3>
            <p className="font-aura relative mt-3 text-sm leading-relaxed text-aura-text-secondary">
              {s.body}
            </p>
          </motion.article>
        ))}
      </div>
    </section>
  );
}