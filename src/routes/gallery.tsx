import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AnimatePresence,
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { ArrowRight, ChevronLeft, ChevronRight, Expand, Maximize, Minimize, Play, Scissors, X } from "lucide-react";
import { GALLERY, type GalleryItem } from "@/lib/gallery";

export const Route = createFileRoute("/gallery")({ component: GalleryRoute });

const chromeText = "bg-gradient-to-b from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent";
const shimmerBtn =
  "group relative inline-flex items-center justify-center gap-3 overflow-hidden rounded-full bg-gradient-to-b from-zinc-100 via-zinc-300 to-zinc-400 px-8 py-4 text-base font-semibold text-black shadow-[0_0_30px_rgba(255,255,255,0.25)] outline-none transition-shadow duration-300 before:absolute before:inset-y-0 before:-left-1/2 before:w-1/2 before:-skew-x-12 before:bg-white/70 before:blur-md before:transition-transform before:duration-700 hover:shadow-[0_0_60px_rgba(255,255,255,0.5)] hover:before:translate-x-[300%] focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black";

function GalleryRoute() {
  const reduce = !!useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const glowY = useTransform(scrollYProgress, [0, 1], [-80, 500]);
  const orbY = useTransform(scrollYProgress, [0, 1], [0, -300]);
  const ringRotate = useTransform(scrollYProgress, [0, 1], [0, 140]);

  const [open, setOpen] = useState<number | null>(null);

  return (
    <main ref={ref} className="relative min-h-screen overflow-hidden bg-black pb-28 pt-28 text-white selection:bg-white selection:text-black">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-60 [background-image:linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)] [-webkit-mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]"
      />
      <motion.div aria-hidden style={{ y: reduce ? 0 : glowY }} className="pointer-events-none absolute -right-40 top-10 -z-10 h-[560px] w-[560px] rounded-full bg-white/[0.06] blur-[150px]" />
      <motion.div aria-hidden style={{ y: reduce ? 0 : orbY }} className="pointer-events-none absolute -left-40 top-[900px] -z-10 h-[520px] w-[520px] rounded-full bg-white/[0.045] blur-[150px]" />
      <motion.div aria-hidden style={{ rotate: reduce ? 0 : ringRotate }} className="pointer-events-none absolute -left-48 top-72 -z-10 h-[520px] w-[520px] rounded-full border border-dashed border-white/10" />
      <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-10">
        {/* Header */}
        <motion.header initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}>
          <div className="mb-4 flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-white/50">
            <span className="h-px w-10 bg-gradient-to-r from-white/60 to-transparent" />
            Portfolio
          </div>
          <h1 className="text-5xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
            <motion.span
              className="inline-block bg-clip-text text-transparent"
              style={{
                backgroundImage: "linear-gradient(110deg,#52525b 0%,#fafafa 25%,#a1a1aa 45%,#fafafa 60%,#52525b 100%)",
                backgroundSize: "250% 100%",
              }}
              animate={reduce ? undefined : { backgroundPositionX: ["0%", "-250%"] }}
              transition={{ duration: 7, repeat: Infinity, ease: "linear" }}
            >
              Barbers' Gallery
            </motion.span>
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg">
            Fades, lines and finishes from the chairs of AURA. Tap any piece to view it full screen.
          </p>
        </motion.header>

        {/* Grid */}
        {GALLERY.length === 0 ? (
          <p className="mt-16 rounded-3xl border border-white/10 bg-zinc-950/70 p-12 text-center text-zinc-500">
            Add p1–p6 and p.mp4 to src/assets to fill the gallery.
          </p>
        ) : (
          <div className="mt-14 grid auto-rows-[150px] grid-flow-dense grid-cols-2 gap-3 sm:auto-rows-[190px] sm:gap-4 md:auto-rows-[210px] md:grid-cols-4">
            {GALLERY.map((item, i) => (
              <Tile key={item.id} item={item} index={i} reduce={reduce} onOpen={() => setOpen(i)} />
            ))}
          </div>
        )}

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="relative mt-24 overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-br from-zinc-900/90 via-black to-zinc-950 p-10 text-center shadow-[0_0_80px_-30px_rgba(255,255,255,0.25)] sm:p-14"
        >
          <div aria-hidden className="pointer-events-none absolute left-1/2 top-0 size-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.08] blur-[90px]" />
          <Scissors className="relative mx-auto size-7 text-zinc-300" />
          <h2 className={`relative mt-4 text-3xl font-bold sm:text-4xl ${chromeText}`}>Want to cut like this?</h2>
          <p className="relative mx-auto mt-3 max-w-md text-sm text-zinc-400">Train hands-on with Theopistos, in person or online.</p>
          <div className="relative mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link to="/seminars" className={shimmerBtn}>
              <span className="relative">Book a seminar</span>
              <ArrowRight className="relative size-5 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
            <Link
              to="/online-seminars"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-7 py-4 text-base font-medium text-zinc-200 transition hover:border-white/50 hover:bg-white hover:text-black hover:shadow-[0_0_30px_rgba(255,255,255,0.3)]"
            >
              Online seminars
            </Link>
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {open !== null && <Lightbox items={GALLERY} index={open} setIndex={setOpen} onClose={() => setOpen(null)} />}
      </AnimatePresence>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Tile                                                               */
/* ------------------------------------------------------------------ */

function Tile({ item, index, reduce, onOpen }: { item: GalleryItem; index: number; reduce: boolean; onOpen: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const py = useTransform(scrollYProgress, [0, 1], ["-6%", "6%"]);

  const x = useMotionValue(-300);
  const y = useMotionValue(-300);
  const rx = useSpring(0, { stiffness: 160, damping: 18 });
  const ry = useSpring(0, { stiffness: 160, damping: 18 });
  const spot = useMotionTemplate`radial-gradient(240px circle at ${x}px ${y}px, rgba(255,255,255,0.22), transparent 70%)`;

  function onMove(e: React.PointerEvent<HTMLButtonElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    const pz = e.clientY - r.top;
    x.set(px);
    y.set(pz);
    if (!reduce) {
      ry.set((px / r.width - 0.5) * 5);
      rx.set(-(pz / r.height - 0.5) * 5);
    }
  }
  function onLeave() {
    rx.set(0);
    ry.set(0);
  }

  const mediaCls = "absolute -top-[9%] left-0 h-[118%] w-full object-cover transition-transform duration-700 group-hover:scale-[1.07]";

  return (
    <div className={`${item.span} min-h-0`} style={{ perspective: 1200 }}>
      <motion.button
        ref={ref}
        type="button"
        onClick={onOpen}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        aria-label={`Open ${item.title} full screen`}
        initial={{ opacity: 0, y: 40, scale: 0.96 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.7, delay: (index % 4) * 0.07, ease: [0.16, 1, 0.3, 1] }}
        style={{ rotateX: rx, rotateY: ry }}
        whileTap={{ scale: 0.98 }}
        className="group relative h-full w-full cursor-zoom-in overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 text-left shadow-[0_24px_60px_-28px_rgba(0,0,0,0.95)] outline-none transition-[border-color,box-shadow] duration-300 hover:border-white/50 hover:shadow-[0_0_40px_-8px_rgba(255,255,255,0.28)] focus-visible:ring-2 focus-visible:ring-white/60"
      >
        {item.type === "image" ? (
          <motion.img src={item.src} alt={item.title} loading="lazy" style={{ y: reduce ? 0 : py }} className={mediaCls} />
        ) : (
          <motion.video src={item.src} autoPlay muted loop playsInline preload="metadata" style={{ y: reduce ? 0 : py }} className={mediaCls} />
        )}

        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
        <motion.div aria-hidden style={{ background: spot }} className="pointer-events-none absolute inset-0 opacity-0 mix-blend-overlay transition-opacity duration-300 group-hover:opacity-100" />
        {/* chrome sweep */}
        <div aria-hidden className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-0 blur-sm transition-all duration-1000 group-hover:left-[130%] group-hover:opacity-100" />

        {item.type === "video" && (
          <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full border border-white/25 bg-black/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-200 backdrop-blur">
            <Play className="size-3 fill-current" /> Video
          </span>
        )}

        <span className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full border border-white/20 bg-black/60 text-zinc-200 opacity-0 backdrop-blur transition-all duration-300 group-hover:scale-110 group-hover:opacity-100 group-hover:shadow-[0_0_20px_rgba(255,255,255,0.4)]">
          <Expand className="size-4" />
        </span>

        <div className="absolute inset-x-0 bottom-0 translate-y-1 p-4 transition-transform duration-300 group-hover:translate-y-0">
          <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-400">{item.tag}</p>
          <p className={`mt-1 text-base font-bold sm:text-lg ${chromeText}`}>{item.title}</p>
        </div>
      </motion.button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Full-screen lightbox                                               */
/* ------------------------------------------------------------------ */

const slide = {
  enter: (d: number) => ({ opacity: 0, x: d * 80, scale: 0.96 }),
  center: { opacity: 1, x: 0, scale: 1 },
  exit: (d: number) => ({ opacity: 0, x: d * -80, scale: 0.96 }),
};

function Lightbox({ items, index, setIndex, onClose }: { items: GalleryItem[]; index: number; setIndex: (n: number) => void; onClose: () => void }) {
  const item = items[index];
  const box = useRef<HTMLDivElement>(null);
  const [dir, setDir] = useState(1);
  const [fs, setFs] = useState(false);

  function go(d: number) {
    setDir(d);
    setIndex((index + d + items.length) % items.length);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onFs = () => setFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("fullscreenchange", onFs);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, []);

  function toggleFs() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else box.current?.requestFullscreen?.().catch(() => {});
  }

  const iconBtn =
    "flex size-11 items-center justify-center rounded-full border border-white/20 bg-black/60 text-zinc-200 backdrop-blur transition hover:border-white/60 hover:bg-white hover:text-black hover:shadow-[0_0_28px_rgba(255,255,255,0.4)]";

  return (
    <motion.div
      ref={box}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[100] flex flex-col bg-black/95 backdrop-blur-xl"
      role="dialog"
      aria-modal="true"
      aria-label="Gallery viewer"
    >
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/3 size-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.05] blur-[140px]" />

      {/* top bar */}
      <div className="relative z-10 flex items-center justify-between gap-4 p-4 sm:p-6">
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">{item.tag}</p>
          <p className={`text-lg font-bold ${chromeText}`}>{item.title}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-zinc-500">
            {String(index + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")}
          </span>
          <button type="button" onClick={toggleFs} aria-label={fs ? "Exit full screen" : "Full screen"} className={iconBtn}>
            {fs ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
          </button>
          <button type="button" onClick={onClose} aria-label="Close" className={iconBtn}>
            <X className="size-5" />
          </button>
        </div>
      </div>

      {/* stage */}
      <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-3 sm:px-20" onClick={onClose}>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); go(-1); }}
          aria-label="Previous"
          className={`${iconBtn} absolute left-3 top-1/2 z-20 -translate-y-1/2 sm:left-6`}
        >
          <ChevronLeft className="size-5" />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); go(1); }}
          aria-label="Next"
          className={`${iconBtn} absolute right-3 top-1/2 z-20 -translate-y-1/2 sm:right-6`}
        >
          <ChevronRight className="size-5" />
        </button>

        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={item.id}
            custom={dir}
            variants={slide}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.25}
            onDragEnd={(_, info) => {
              if (info.offset.x < -80) go(1);
              else if (info.offset.x > 80) go(-1);
            }}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-full max-w-full items-center justify-center"
          >
            {item.type === "image" ? (
              <img src={item.src} alt={item.title} draggable={false} className="max-h-[calc(100vh-12rem)] max-w-full rounded-xl object-contain shadow-[0_0_100px_-20px_rgba(255,255,255,0.25)]" />
            ) : (
              <video src={item.src} controls autoPlay loop playsInline className="max-h-[calc(100vh-12rem)] max-w-full rounded-xl shadow-[0_0_100px_-20px_rgba(255,255,255,0.25)]" />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* thumbnails */}
      <div className="relative z-10 flex justify-center gap-2 overflow-x-auto p-4 sm:p-6">
        {items.map((t, i) => (
          <button
            key={t.id}
            type="button"
            onClick={() => { setDir(i > index ? 1 : -1); setIndex(i); }}
            aria-label={`Show ${t.title}`}
            className={`relative size-14 shrink-0 overflow-hidden rounded-lg border transition-all duration-300 sm:size-16 ${
              i === index ? "scale-110 border-white shadow-[0_0_20px_rgba(255,255,255,0.4)]" : "border-white/15 opacity-50 hover:opacity-100"
            }`}
          >
            {t.type === "image" ? (
              <img src={t.src} alt="" className="size-full object-cover" />
            ) : (
              <>
                <video src={t.src} muted preload="metadata" className="size-full object-cover" />
                <Play className="absolute left-1/2 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 fill-white text-white" />
              </>
            )}
          </button>
        ))}
      </div>
    </motion.div>
  );
}