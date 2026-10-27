// src/components/aura/Book3D.tsx
// The 3D hardcover book (same model as the landing section), self-contained.
import { useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent } from "react";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { BookOpen, Scissors } from "lucide-react";
import bookCover from "@/assets/book.png";

export const CHAPTERS = [
  "Foundations of the craft",
  "Cutting geometry and shapes",
  "Scissors, razor and clippers",
  "Fades and blending",
  "Face shapes and consultation",
  "Styling and finishing",
  "Clients, image and mindset",
];
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];

/* Book geometry (local CSS 3D coordinates, y points down) */
const W = 260;
const H = 360;
const T = 52;
const B = 3;
const PAGE_INSET_Y = 5;
const PAGE_INSET_R = 6;
const PAGE_DEPTH = T - B * 2;
const PAGE_W = W - PAGE_INSET_R;
const PAGE_H = H - PAGE_INSET_Y * 2;

const face: CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  backfaceVisibility: "hidden",
  WebkitBackfaceVisibility: "hidden",
};

const pagesV =
  "repeating-linear-gradient(90deg, #0a0a0b 0px, #0a0a0b 1px, #2b2b2f 1px, #1c1c1f 2px, #0a0a0b 3px)";
const pagesH =
  "repeating-linear-gradient(0deg, #0a0a0b 0px, #0a0a0b 1px, #2b2b2f 1px, #1c1c1f 2px, #0a0a0b 3px)";
const boardEdgeTop = "linear-gradient(180deg, #34343a 0%, #16161a 45%, #050506 100%)";
const boardEdgeSide = "linear-gradient(90deg, #34343a 0%, #16161a 45%, #050506 100%)";

export default function Book3D({ className = "" }: { className?: string }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hovered || pinned;

  const { scrollYProgress } = useScroll({
    target: stageRef,
    offset: ["start end", "end start"],
  });

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

  const gx = useTransform(sx, (v) => 50 + v * 90);
  const gy = useTransform(sy, (v) => 50 + v * 90);
  const glare = useMotionTemplate`radial-gradient(circle at ${gx}% ${gy}%, rgba(255,255,255,0.22), rgba(255,255,255,0.04) 35%, transparent 62%)`;

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
    <div
      ref={stageRef}
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
      className={`relative flex h-[390px] cursor-pointer items-center justify-center rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-white/40 sm:h-[580px] ${className}`}
    >
      {/* glow and rings */}
      <div aria-hidden className="absolute h-[420px] w-[420px] rounded-full bg-white/[0.08] blur-[90px]" />
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
      <motion.div
        aria-hidden
        animate={reduce ? undefined : { scaleX: [1, 0.86, 1], opacity: [0.55, 0.32, 0.55] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-[70px] h-8 w-[240px] rounded-[100%] bg-white/25 blur-2xl sm:bottom-[92px]"
      />

      <div className="origin-center scale-[0.58] min-[420px]:scale-[0.72] sm:scale-100" style={{ perspective: 1800 }}>
        <motion.div
          style={{ transformStyle: "preserve-3d", width: W, height: H }}
          animate={{
            rotateY: open ? -8 : -28,
            x: open ? 112 : 0,
            y: reduce ? 0 : [0, -14, 0],
          }}
          transition={{
            default: { type: "spring", stiffness: 55, damping: 16 },
            y: reduce ? { duration: 0 } : { duration: 6, repeat: Infinity, ease: "easeInOut" },
          }}
        >
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
            {/* BACK BOARD */}
            <div
              className="overflow-hidden rounded-sm bg-[linear-gradient(215deg,#1d1d21,#070708_55%,#0d0d0f)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
              style={{ ...face, width: W, height: H, transform: `translateZ(${-T / 2}px) rotateY(180deg)` }}
            >
              <div className="absolute inset-5 rounded-sm border border-zinc-500/25" />
              <div className="absolute inset-[26px] rounded-sm border border-zinc-600/15" />
            </div>
            <div style={{ ...face, width: W, height: B, top: -B / 2, background: boardEdgeTop, transform: `translateZ(${-T / 2 + B / 2}px) rotateX(90deg)` }} />
            <div style={{ ...face, width: W, height: B, top: H - B / 2, background: boardEdgeTop, transform: `translateZ(${-T / 2 + B / 2}px) rotateX(-90deg)` }} />
            <div style={{ ...face, width: B, height: H, left: W - B / 2, background: boardEdgeSide, transform: `translateZ(${-T / 2 + B / 2}px) rotateY(90deg)` }} />

            {/* SPINE */}
            <div
              className="flex items-center justify-center overflow-hidden border-y border-white/10 bg-gradient-to-r from-[#1b1b1f] via-[#0e0e10] to-[#050506]"
              style={{ ...face, width: T, height: H, left: -T / 2, transform: "rotateY(-90deg)" }}
            >
              <div
                aria-hidden
                className="absolute inset-0"
                style={{ background: "linear-gradient(90deg, rgba(255,255,255,0.10), transparent 30%, transparent 70%, rgba(255,255,255,0.05))" }}
              />
              <div className="absolute inset-x-0 top-6 h-px bg-gradient-to-r from-transparent via-zinc-400/70 to-transparent" />
              <div className="absolute inset-x-0 top-8 h-px bg-gradient-to-r from-transparent via-zinc-500/40 to-transparent" />
              <span
                className="bg-gradient-to-b from-zinc-100 to-zinc-500 bg-clip-text font-serif text-sm font-semibold tracking-[0.5em] text-transparent"
                style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
              >
                ΛURΛ THE BARBERING BOOK
              </span>
              <div className="absolute inset-x-0 bottom-8 h-px bg-gradient-to-r from-transparent via-zinc-500/40 to-transparent" />
              <div className="absolute inset-x-0 bottom-6 h-px bg-gradient-to-r from-transparent via-zinc-400/70 to-transparent" />
            </div>

            {/* PAGE BLOCK */}
            <div
              style={{
                ...face,
                width: PAGE_DEPTH,
                height: PAGE_H,
                top: PAGE_INSET_Y,
                left: PAGE_W - PAGE_DEPTH / 2,
                transform: "rotateY(90deg)",
                backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.55), transparent 16%, transparent 84%, rgba(0,0,0,.65)), ${pagesV}`,
              }}
            />
            <div
              style={{
                ...face,
                width: PAGE_W,
                height: PAGE_DEPTH,
                top: PAGE_INSET_Y - PAGE_DEPTH / 2,
                transform: "rotateX(90deg)",
                backgroundImage: `linear-gradient(90deg, rgba(0,0,0,.5), transparent 20%), ${pagesH}`,
              }}
            />
            <div
              style={{
                ...face,
                width: PAGE_W,
                height: PAGE_DEPTH,
                top: H - PAGE_INSET_Y - PAGE_DEPTH / 2,
                transform: "rotateX(-90deg)",
                backgroundImage: `linear-gradient(90deg, rgba(0,0,0,.5), transparent 20%), ${pagesH}`,
              }}
            />

            {/* first page */}
            <div
              className="overflow-hidden rounded-r-sm bg-[linear-gradient(90deg,#0c0c0e,#1a1a1d_10%,#111113)] p-7 pl-9"
              style={{ ...face, top: PAGE_INSET_Y, width: PAGE_W, height: PAGE_H, transform: `translateZ(${T / 2 - B - 0.5}px)` }}
            >
              <p className="font-serif text-lg text-zinc-100">Inside</p>
              <div className="mt-2 h-px bg-gradient-to-r from-zinc-400/60 to-transparent" />
              <ol className="mt-5 space-y-3">
                {CHAPTERS.map((c, i) => (
                  <li key={c} className="flex items-baseline gap-3 font-serif text-[11px] leading-snug text-zinc-300">
                    <span className="w-6 shrink-0 text-zinc-500">{ROMAN[i]}</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ol>
              <Scissors className="absolute bottom-6 right-6 size-4 text-zinc-600" />
            </div>

            {/* FRONT BOARD (hinged on the spine) */}
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
                transition: reduce ? "none" : "transform 1.2s cubic-bezier(0.22, 0.8, 0.24, 1)",
              }}
            >
              <div
                className="overflow-hidden rounded-l-sm rounded-r-md bg-black shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                style={{ ...face, width: W, height: H }}
              >
                <img
                  src={bookCover}
                  alt="AURA The Barbering Book cover"
                  draggable={false}
                  className="absolute inset-0 h-full w-full select-none object-cover"
                />
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0"
                  style={{ background: "radial-gradient(120% 100% at 50% 40%, transparent 60%, rgba(0,0,0,0.35) 100%)" }}
                />
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 left-3 w-[3px]"
                  style={{ background: "linear-gradient(90deg, rgba(0,0,0,0.75), rgba(0,0,0,0.25) 55%, rgba(255,255,255,0.14))" }}
                />
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 left-0 w-3"
                  style={{ background: "linear-gradient(90deg, rgba(0,0,0,0.5), transparent)" }}
                />
                {!reduce && (
                  <motion.div
                    aria-hidden
                    className="pointer-events-none absolute inset-0"
                    style={{ background: "linear-gradient(105deg, transparent 42%, rgba(255,255,255,0.14) 50%, transparent 58%)" }}
                    animate={{ x: ["-120%", "120%"] }}
                    transition={{ duration: 2.2, repeat: Infinity, repeatDelay: 4.5, ease: "easeInOut" }}
                  />
                )}
                <motion.div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: glare }} />
              </div>

              <div
                className="flex flex-col items-center justify-center gap-4 overflow-hidden rounded-l-md bg-[linear-gradient(200deg,#1c1c1f,#08080a)] px-9 text-center"
                style={{ ...face, width: W, height: H, transform: `translateZ(${-B}px) rotateY(180deg)` }}
              >
                <Scissors className="size-6 text-zinc-300" />
                <p className="font-serif text-sm italic leading-relaxed text-zinc-300">
                  For the barber who never stops learning.
                </p>
                <div className="h-px w-16 bg-gradient-to-r from-transparent via-zinc-400 to-transparent" />
                <p className="text-[9px] uppercase tracking-[0.35em] text-zinc-500">AURA</p>
              </div>

              <div style={{ ...face, width: W, height: B, top: -B / 2, background: boardEdgeTop, transform: `translateZ(${-B / 2}px) rotateX(90deg)` }} />
              <div style={{ ...face, width: W, height: B, top: H - B / 2, background: boardEdgeTop, transform: `translateZ(${-B / 2}px) rotateX(-90deg)` }} />
              <div style={{ ...face, width: B, height: H, left: W - B / 2, background: boardEdgeSide, transform: `translateZ(${-B / 2}px) rotateY(90deg)` }} />
            </div>
          </motion.div>
        </motion.div>
      </div>

      <p className="absolute bottom-1 flex items-center gap-2 text-xs text-zinc-500">
        <BookOpen className="size-3.5" />
        Hover to open the book. On touch screens, tap it.
      </p>
    </div>
  );
}