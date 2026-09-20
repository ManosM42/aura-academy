import { useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent, ReactNode } from "react";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import {
  BookOpen,
  Compass,
  Crown,
  Layers,
  MessageCircle,
  Ruler,
  Scissors,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Content (edit freely)                                              */
/* ------------------------------------------------------------------ */

const CHAPTERS = [
  "Foundations of the craft",
  "Cutting geometry and shapes",
  "Scissors, razor and clippers",
  "Fades and blending",
  "Face shapes and consultation",
  "Styling and finishing",
  "Clients, image and mindset",
];
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];

const TOPICS = [
  {
    icon: Ruler,
    title: "Cutting geometry",
    text: "The angles, sections and shapes behind every clean haircut.",
  },
  {
    icon: Scissors,
    title: "Every tool, mastered",
    text: "Scissors, razor and clipper technique, explained step by step.",
  },
  {
    icon: Layers,
    title: "Fades and blending",
    text: "From fast fades to photo-ready transitions.",
  },
  {
    icon: Compass,
    title: "Face shapes",
    text: "Read the client and choose the cut that suits them.",
  },
  {
    icon: MessageCircle,
    title: "Client experience",
    text: "Consultation and service that turn visitors into regulars.",
  },
  {
    icon: Crown,
    title: "Professional mindset",
    text: "The standards, image and confidence behind the chair.",
  },
];

/* ------------------------------------------------------------------ */
/* Book geometry                                                      */
/* ------------------------------------------------------------------ */

const W = 260; // width
const H = 360; // height
const T = 52; // thickness
const PAGE_INSET_Y = 5;
const PAGE_INSET_R = 6;
const PAGE_DEPTH = T - 6;

const face: CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  backfaceVisibility: "hidden",
  WebkitBackfaceVisibility: "hidden",
};

const chromeText =
  "bg-gradient-to-b from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent";

/* ------------------------------------------------------------------ */
/* Small spotlight card used for the topic grid                        */
/* ------------------------------------------------------------------ */

function SpotlightCard({ children }: { children: ReactNode }) {
  const x = useMotionValue(-300);
  const y = useMotionValue(-300);
  const spot = useMotionTemplate`radial-gradient(240px circle at ${x}px ${y}px, rgba(255,255,255,0.13), transparent 70%)`;

  function onMove(e: PointerEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    x.set(e.clientX - r.left);
    y.set(e.clientY - r.top);
  }

  return (
    <motion.div
      onPointerMove={onMove}
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      className="group relative h-full overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-900/80 to-black/90 p-5 shadow-[0_20px_50px_-24px_rgba(0,0,0,0.95)] transition-colors duration-300 hover:border-white/30"
    >
      <motion.div
        aria-hidden
        style={{ background: spot }}
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />
      <div className="relative">{children}</div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Section                                                            */
/* ------------------------------------------------------------------ */

export default function PhysicalBook() {
  const sectionRef = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();

  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hovered || pinned;

  // Section scroll parallax
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  const watermarkY = useTransform(scrollYProgress, [0, 1], [140, -140]);
  const glowY = useTransform(scrollYProgress, [0, 1], [-70, 70]);

  // Pointer parallax for the book
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 90, damping: 16 });
  const sy = useSpring(my, { stiffness: 90, damping: 16 });

  const rotY = useTransform([sx, scrollYProgress], (latest) => {
    if (reduce) return 0;
    const [x, s] = latest as number[];
    return x * 26 + (0.5 - s) * 30;
  });
  const rotX = useTransform(sy, (y) => (reduce ? 0 : -y * 18));

  // Light glare that follows the pointer across the cover
  const gx = useTransform(sx, (v) => 50 + v * 90);
  const gy = useTransform(sy, (v) => 50 + v * 90);
  const glare = useMotionTemplate`radial-gradient(circle at ${gx}% ${gy}%, rgba(255,255,255,0.3), rgba(255,255,255,0.05) 35%, transparent 62%)`;

  function handleMove(e: PointerEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  }

  function handleLeave(e: PointerEvent<HTMLDivElement>) {
    mx.set(0);
    my.set(0);
    if (e.pointerType === "mouse") setHovered(false);
  }

  function handleKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setPinned((p) => !p);
    }
  }

  return (
    <section
      ref={sectionRef}
      id="book"
      className="relative isolate overflow-hidden py-24 sm:py-32"
    >
      {/* Parallax background */}
      <motion.div
        aria-hidden
        style={{ y: watermarkY }}
        className="pointer-events-none absolute inset-x-0 top-8 -z-10 select-none text-center font-serif text-[24vw] font-bold leading-none tracking-[0.12em] text-white/[0.025]"
      >
        AURA
      </motion.div>
      <motion.div
        aria-hidden
        style={{ y: glowY }}
        className="pointer-events-none absolute right-[-10%] top-1/3 -z-10 h-[520px] w-[520px] rounded-full bg-white/[0.05] blur-[130px]"
      />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
      />

      <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-6 md:px-10 lg:grid-cols-[1.05fr_1fr]">
        {/* ------------------------- Copy ------------------------- */}
        <div>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="mb-4 flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-white/50">
              <span className="h-px w-10 bg-gradient-to-r from-white/60 to-transparent" />
              The AURA book
            </div>
            <h2
              className={`text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl ${chromeText}`}
            >
              Years of chair time, bound in one book.
            </h2>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-zinc-400 sm:text-lg">
              The AURA physical book is a barbering reference built to live at
              your station. Clear technique breakdowns, cutting geometry, fades
              from clean to photo-ready, and the client skills that keep your
              chair full.
            </p>
          </motion.div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {TOPICS.map((t) => (
              <SpotlightCard key={t.title}>
                <div className="flex items-start gap-4">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-black/60 text-zinc-200 transition-all duration-300 group-hover:-rotate-6 group-hover:scale-110 group-hover:border-white/50 group-hover:text-white group-hover:shadow-[0_0_24px_rgba(255,255,255,0.35)]">
                    <t.icon className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      {t.title}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-zinc-400">
                      {t.text}
                    </p>
                  </div>
                </div>
              </SpotlightCard>
            ))}
          </div>
        </div>

        {/* ------------------------- 3D book ------------------------- */}
        <div
          role="button"
          tabIndex={0}
          aria-pressed={open}
          aria-label="Open or close the AURA book"
          onPointerEnter={(e) => {
            if (e.pointerType === "mouse") setHovered(true);
          }}
          onPointerLeave={handleLeave}
          onPointerMove={handleMove}
          onClick={() => setPinned((p) => !p)}
          onKeyDown={handleKey}
          className="relative flex h-[390px] cursor-pointer items-center justify-center rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-white/40 sm:h-[580px]"
        >
          {/* Glow and rings */}
          <div
            aria-hidden
            className="absolute h-[420px] w-[420px] rounded-full bg-white/[0.08] blur-[90px]"
          />
          <motion.div
            aria-hidden
            animate={reduce ? undefined : { rotate: 360 }}
            transition={{ duration: 90, repeat: Infinity, ease: "linear" }}
            className="absolute h-[440px] w-[440px] rounded-full border border-dashed border-white/15"
          />
          <motion.div
            aria-hidden
            animate={reduce ? undefined : { rotate: -360 }}
            transition={{ duration: 140, repeat: Infinity, ease: "linear" }}
            className="absolute h-[540px] w-[540px] rounded-full border border-white/[0.07]"
          />

          {/* Floor glow */}
          <motion.div
            aria-hidden
            animate={
              reduce
                ? undefined
                : { scaleX: [1, 0.86, 1], opacity: [0.55, 0.32, 0.55] }
            }
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            className="absolute bottom-[70px] h-8 w-[240px] rounded-[100%] bg-white/25 blur-2xl sm:bottom-[92px]"
          />

          {/* Perspective wrapper (scaled down on small screens) */}
          <div
            className="origin-center scale-[0.58] min-[420px]:scale-[0.72] sm:scale-100"
            style={{ perspective: 1800 }}
          >
            {/* Pose + float */}
            <motion.div
              style={{ transformStyle: "preserve-3d", width: W, height: H }}
              animate={{
                rotateY: open ? -8 : -28,
                x: open ? 112 : 0,
                y: reduce ? 0 : [0, -14, 0],
              }}
              transition={{
                default: { type: "spring", stiffness: 55, damping: 16 },
                y: reduce
                  ? { duration: 0 }
                  : { duration: 6, repeat: Infinity, ease: "easeInOut" },
              }}
            >
              {/* Pointer / scroll parallax tilt */}
              <motion.div
                style={{
                  transformStyle: "preserve-3d",
                  position: "relative",
                  width: "100%",
                  height: "100%",
                  rotateX: rotX,
                  rotateY: rotY,
                }}
              >
                {/* Back cover */}
                <div
                  className="rounded-sm bg-zinc-950"
                  style={{
                    ...face,
                    width: W,
                    height: H,
                    transform: `translateZ(${-T / 2}px) rotateY(180deg)`,
                  }}
                />

                {/* Spine */}
                <div
                  className="flex items-center justify-center overflow-hidden border-y border-white/10 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-950"
                  style={{
                    ...face,
                    width: T,
                    height: H,
                    left: -T / 2,
                    transform: "rotateY(-90deg)",
                  }}
                >
                  <div className="absolute inset-x-0 top-6 h-px bg-gradient-to-r from-transparent via-zinc-300/70 to-transparent" />
                  <div className="absolute inset-x-0 top-8 h-px bg-gradient-to-r from-transparent via-zinc-400/40 to-transparent" />
                  <span
                    className="bg-gradient-to-b from-white to-zinc-500 bg-clip-text font-serif text-sm font-semibold tracking-[0.5em] text-transparent"
                    style={{
                      writingMode: "vertical-rl",
                      transform: "rotate(180deg)",
                    }}
                  >
                    AURA THE BARBERING BOOK
                  </span>
                  <div className="absolute inset-x-0 bottom-8 h-px bg-gradient-to-r from-transparent via-zinc-400/40 to-transparent" />
                  <div className="absolute inset-x-0 bottom-6 h-px bg-gradient-to-r from-transparent via-zinc-300/70 to-transparent" />
                </div>

                {/* Page edge, right (silver gilded) */}
                <div
                  style={{
                    ...face,
                    width: PAGE_DEPTH,
                    height: H - PAGE_INSET_Y * 2,
                    top: PAGE_INSET_Y,
                    left: W - PAGE_INSET_R - PAGE_DEPTH / 2,
                    transform: "rotateY(90deg)",
                    backgroundImage:
                      "linear-gradient(180deg, rgba(0,0,0,.4), transparent 18%, transparent 82%, rgba(0,0,0,.5)), repeating-linear-gradient(90deg, #e4e4e7 0px, #e4e4e7 1px, #71717a 1px, #52525b 3px)",
                  }}
                />

                {/* Page edge, top */}
                <div
                  style={{
                    ...face,
                    width: W - PAGE_INSET_R,
                    height: PAGE_DEPTH,
                    top: PAGE_INSET_Y - PAGE_DEPTH / 2,
                    transform: "rotateX(90deg)",
                    backgroundImage:
                      "linear-gradient(90deg, rgba(0,0,0,.35), transparent 20%), repeating-linear-gradient(0deg, #e4e4e7 0px, #e4e4e7 1px, #71717a 1px, #52525b 3px)",
                  }}
                />

                {/* Page edge, bottom */}
                <div
                  style={{
                    ...face,
                    width: W - PAGE_INSET_R,
                    height: PAGE_DEPTH,
                    top: H - PAGE_INSET_Y - PAGE_DEPTH / 2,
                    transform: "rotateX(-90deg)",
                    backgroundImage:
                      "linear-gradient(90deg, rgba(0,0,0,.35), transparent 20%), repeating-linear-gradient(0deg, #e4e4e7 0px, #e4e4e7 1px, #71717a 1px, #52525b 3px)",
                  }}
                />

                {/* First page, revealed when the cover opens */}
                <div
                  className="overflow-hidden rounded-r-sm bg-[linear-gradient(90deg,#0c0c0e,#1a1a1d_10%,#111113)] p-7 pl-9"
                  style={{
                    ...face,
                    top: PAGE_INSET_Y,
                    width: W - PAGE_INSET_R,
                    height: H - PAGE_INSET_Y * 2,
                    transform: `translateZ(${T / 2 - 3}px)`,
                  }}
                >
                  <p className="font-serif text-lg text-zinc-100">Inside</p>
                  <div className="mt-2 h-px bg-gradient-to-r from-zinc-400/60 to-transparent" />
                  <ol className="mt-5 space-y-3">
                    {CHAPTERS.map((c, i) => (
                      <li
                        key={c}
                        className="flex items-baseline gap-3 font-serif text-[11px] leading-snug text-zinc-300"
                      >
                        <span className="w-6 shrink-0 text-zinc-500">
                          {ROMAN[i]}
                        </span>
                        <span>{c}</span>
                      </li>
                    ))}
                  </ol>
                  <Scissors className="absolute bottom-6 right-6 size-4 text-zinc-600" />
                </div>

                {/* Front cover (hinged on the spine) */}
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: W,
                    height: H,
                    transformStyle: "preserve-3d",
                    transformOrigin: "left center",
                    transform: `translateZ(${T / 2}px) rotateY(${open ? -150 : 0}deg)`,
                    transition: reduce
                      ? "none"
                      : "transform 1.2s cubic-bezier(0.22, 0.8, 0.24, 1)",
                  }}
                >
                  {/* Outside */}
                  <div
                    className="overflow-hidden rounded-l-sm rounded-r-md bg-[linear-gradient(145deg,#26262a_0%,#0a0a0b_45%,#161618_100%)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                    style={{ ...face, width: W, height: H }}
                  >
                    {/* Leather grain */}
                    <div
                      aria-hidden
                      className="absolute inset-0 opacity-30 mix-blend-overlay"
                      style={{
                        backgroundImage:
                          "radial-gradient(rgba(255,255,255,0.55) 0.5px, transparent 0.7px)",
                        backgroundSize: "3px 3px",
                      }}
                    />
                    {/* Hinge groove */}
                    <div className="absolute inset-y-0 left-3 w-px bg-black/70 shadow-[1px_0_0_rgba(255,255,255,0.14)]" />
                    {/* Foil frame */}
                    <div className="absolute inset-5 rounded-sm border border-zinc-300/40" />
                    <div className="absolute inset-[26px] rounded-sm border border-zinc-500/20" />

                    <div className="relative flex h-full flex-col items-center justify-between px-9 py-11 text-center">
                      <div className="flex size-16 items-center justify-center rounded-full border border-zinc-300/60 bg-black/70 shadow-[0_0_34px_rgba(255,255,255,0.28)]">
                        <Scissors className="size-7 text-zinc-100" />
                      </div>

                      <div>
                        <h3
                          className={`font-serif text-5xl font-bold tracking-[0.28em] [filter:drop-shadow(0_0_14px_rgba(255,255,255,0.35))] ${chromeText}`}
                        >
                          AURA
                        </h3>
                        <div className="mx-auto mt-4 h-px w-24 bg-gradient-to-r from-transparent via-zinc-300/70 to-transparent" />
                        <p className="mt-4 font-serif text-sm italic text-zinc-300">
                          The Barbering Book
                        </p>
                      </div>

                      <p className="text-[9px] uppercase tracking-[0.35em] text-zinc-500">
                        Physical edition
                      </p>
                    </div>

                    {/* Idle sheen */}
                    {!reduce && (
                      <motion.div
                        aria-hidden
                        className="pointer-events-none absolute inset-0"
                        style={{
                          background:
                            "linear-gradient(105deg, transparent 42%, rgba(255,255,255,0.16) 50%, transparent 58%)",
                        }}
                        animate={{ x: ["-120%", "120%"] }}
                        transition={{
                          duration: 2.2,
                          repeat: Infinity,
                          repeatDelay: 4.5,
                          ease: "easeInOut",
                        }}
                      />
                    )}

                    {/* Pointer glare */}
                    <motion.div
                      aria-hidden
                      className="pointer-events-none absolute inset-0"
                      style={{ background: glare }}
                    />
                  </div>

                  {/* Inside of the cover */}
                  <div
                    className="flex flex-col items-center justify-center gap-4 overflow-hidden rounded-l-md bg-[linear-gradient(200deg,#1c1c1f,#08080a)] px-9 text-center"
                    style={{
                      ...face,
                      width: W,
                      height: H,
                      transform: "rotateY(180deg)",
                    }}
                  >
                    <Scissors className="size-6 text-zinc-300" />
                    <p className="font-serif text-sm italic leading-relaxed text-zinc-300">
                      For the barber who never stops learning.
                    </p>
                    <div className="h-px w-16 bg-gradient-to-r from-transparent via-zinc-400 to-transparent" />
                    <p className="text-[9px] uppercase tracking-[0.35em] text-zinc-500">
                      AURA
                    </p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>

          <p className="absolute bottom-1 flex items-center gap-2 text-xs text-zinc-500">
            <BookOpen className="size-3.5" />
            Hover to open the book. On touch screens, tap it.
          </p>
        </div>
      </div>
    </section>
  );
}