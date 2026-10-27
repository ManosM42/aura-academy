import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AnimatePresence,
  animate,
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react";
import { ArrowRight, ChevronLeft, ChevronRight, Expand, Maximize, Minimize, Play, Scissors, X } from "lucide-react";
import { GALLERY, GALLERY_BLOCKS, GALLERY_FINALE, PHOTO_COUNT, VIDEO_COUNT, type GalleryItem } from "@/lib/gallery";

export const Route = createFileRoute("/gallery")({ component: GalleryRoute });

const chromeText = "bg-gradient-to-b from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent";
const glow = "bg-[radial-gradient(circle,rgba(255,255,255,0.09),transparent_68%)]";
const shimmerBtn =
  "group relative inline-flex items-center justify-center gap-3 overflow-hidden rounded-full bg-gradient-to-b from-zinc-100 via-zinc-300 to-zinc-400 px-8 py-4 text-base font-semibold text-black shadow-[0_0_30px_rgba(255,255,255,0.25)] outline-none transition-shadow duration-300 before:absolute before:inset-y-0 before:-left-1/2 before:w-1/2 before:-skew-x-12 before:bg-white/70 before:blur-md before:transition-transform before:duration-700 hover:shadow-[0_0_60px_rgba(255,255,255,0.5)] hover:before:translate-x-[300%] focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black";

const indexOfItem = (id: string) => GALLERY.findIndex((g) => g.id === id);

/** One cheap IntersectionObserver per block (instead of one animation engine per tile). */
function useShown<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -6% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, shown] as const;
}

function GalleryRoute() {
  const reduce = !!useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const glowY = useTransform(scrollYProgress, [0, 1], [0, 1500]);
  const orbY = useTransform(scrollYProgress, [0, 1], [0, -900]);
  const ringRotate = useTransform(scrollYProgress, [0, 1], [0, 240]);

  const [open, setOpen] = useState<number | null>(null);
  const openItem = (item: GalleryItem) => setOpen(indexOfItem(item.id));

  return (
    <main ref={ref} className="relative min-h-screen overflow-hidden bg-black pb-28 pt-28 text-white selection:bg-white selection:text-black">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-50 [background-image:linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:64px_64px]"
      />
      <motion.div aria-hidden style={{ y: reduce ? 0 : glowY }} className={`pointer-events-none absolute -right-60 top-0 -z-10 h-[800px] w-[800px] rounded-full ${glow}`} />
      <motion.div aria-hidden style={{ y: reduce ? 0 : orbY }} className={`pointer-events-none absolute -left-60 top-[2200px] -z-10 h-[800px] w-[800px] rounded-full ${glow}`} />
      <motion.div aria-hidden style={{ rotate: reduce ? 0 : ringRotate }} className="pointer-events-none absolute -left-48 top-72 -z-10 h-[520px] w-[520px] rounded-full border border-dashed border-white/10" />
      <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-10">
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
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            >
              Barbers' Gallery
            </motion.span>
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg">
            AURA is a home for barbers who live for the craft. These are the people, the work and the moments
            behind our academy. Open any piece to view it full screen.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {[
              { n: PHOTO_COUNT, label: "Photos" },
              { n: VIDEO_COUNT, label: "Films" },
            ].map((s) => (
              <div key={s.label} className="flex items-baseline gap-2 rounded-full border border-white/15 bg-white/[0.04] px-5 py-2">
                <span className={`text-xl font-bold ${chromeText}`}>
                  <CountUp to={s.n} />
                </span>
                <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">{s.label}</span>
              </div>
            ))}
          </div>
        </motion.header>

        {GALLERY.length === 0 ? (
          <p className="mt-16 rounded-3xl border border-white/10 bg-zinc-950/70 p-12 text-center text-zinc-500">
            Add p1.jpg to p31.jpg and p.mp4, p2.mp4 to p8.mp4 in src/assets to fill the gallery.
          </p>
        ) : (
          <div className="mt-14">
            {GALLERY_BLOCKS.map((b, bi) => (
              <div key={b.feature.id}>
                <Block block={b} reduce={reduce} onOpen={openItem} />
                {bi === 1 && <Marquee reduce={reduce} />}
                {bi === 3 && <Statement reduce={reduce} />}
                {bi === 5 && <Marquee reduce={reduce} reverse />}
                {bi !== 1 && bi !== 3 && bi !== 5 && bi < GALLERY_BLOCKS.length - 1 && <div className="h-1.5 sm:h-3 md:h-4" />}
              </div>
            ))}
            {GALLERY_FINALE.length > 0 && <Finale items={GALLERY_FINALE} onOpen={openItem} />}
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="relative mt-24 overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-br from-zinc-900/90 via-black to-zinc-950 p-10 text-center shadow-[0_0_80px_-30px_rgba(255,255,255,0.25)] sm:p-14"
        >
          <div aria-hidden className={`pointer-events-none absolute left-1/2 top-0 size-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full ${glow}`} />
          <Scissors className="relative mx-auto size-7 text-zinc-300" />
          <h2 className={`relative mt-4 text-3xl font-bold sm:text-4xl ${chromeText}`}>Your chair is waiting.</h2>
          <p className="relative mx-auto mt-3 max-w-md text-sm text-zinc-400">
            Train hands-on with Theopistos and become part of the AURA story, in person or online.
          </p>
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
/* Blocks                                                             */
/* ------------------------------------------------------------------ */

function Block({ block, reduce, onOpen }: { block: { feature: GalleryItem; side: "left" | "right"; smalls: GalleryItem[] }; reduce: boolean; onOpen: (i: GalleryItem) => void }) {
  const [ref, shown] = useShown<HTMLDivElement>();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const py = useTransform(scrollYProgress, [0, 1], ["-4%", "4%"]);

  return (
    <div ref={ref} className="grid aspect-[8/5] grid-flow-dense grid-cols-4 grid-rows-2 gap-1.5 sm:gap-3 md:gap-4">
      <div className={`col-span-2 row-span-2 min-h-0 min-w-0 ${block.side === "right" ? "col-start-3" : "col-start-1"}`}>
        <Tile item={block.feature} feature i={0} shown={shown} py={reduce ? undefined : py} onOpen={() => onOpen(block.feature)} />
      </div>
      {block.smalls.map((s, si) => (
        <div key={s.id} className="min-h-0 min-w-0">
          <Tile item={s} i={si + 1} shown={shown} py={reduce ? undefined : py} onOpen={() => onOpen(s)} />
        </div>
      ))}
    </div>
  );
}

function Finale({ items, onOpen }: { items: GalleryItem[]; onOpen: (i: GalleryItem) => void }) {
  const [ref, shown] = useShown<HTMLDivElement>();
  return (
    <div ref={ref} className="mt-1.5 flex flex-wrap justify-center gap-1.5 sm:mt-3 sm:gap-3 md:mt-4 md:gap-4">
      {items.map((f, i) => (
        <div key={f.id} className="aspect-[4/5] basis-[calc(25%-0.28125rem)] sm:basis-[calc(25%-0.5625rem)] md:basis-[calc(25%-0.75rem)]">
          <Tile item={f} i={i} shown={shown} onOpen={() => onOpen(f)} />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tile (CSS-only hover, no per-tile animation engine)                */
/* ------------------------------------------------------------------ */

function Tile({ item, feature = false, i, shown, py, onOpen }: { item: GalleryItem; feature?: boolean; i: number; shown: boolean; py?: MotionValue<string>; onOpen: () => void }) {
  const vref = useRef<HTMLVideoElement>(null);
  const ease = "cubic-bezier(.16,1,.3,1)";
  const delay = `${Math.min(i, 5) * 70}ms`;

  const media = "size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]";

  return (
    <div
      className="h-full w-full"
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "none" : "translateY(28px) scale(0.97)",
        transition: `opacity 700ms ${ease} ${delay}, transform 700ms ${ease} ${delay}`,
      }}
    >
      <button
        type="button"
        onClick={onOpen}
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse") vref.current?.play().catch(() => {});
        }}
        onPointerLeave={() => vref.current?.pause()}
        aria-label={`Open item ${item.no} full screen`}
        className="group relative h-full w-full cursor-zoom-in overflow-hidden rounded-lg border border-white/10 bg-zinc-950 text-left sm:rounded-2xl outline-none transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-1 hover:border-white/50 hover:shadow-[0_0_36px_-8px_rgba(255,255,255,0.3)] focus-visible:ring-2 focus-visible:ring-white/60 active:scale-[0.98]"
      >
        <motion.div style={py ? { y: py } : undefined} className="absolute inset-x-0 -top-[6%] h-[112%]">
          {item.type === "image" ? (
            <img src={item.thumb} alt={`AURA gallery ${item.no}`} loading="lazy" decoding="async" className={media} />
          ) : (
            <video ref={vref} src={`${item.src}#t=0.1`} muted loop playsInline preload="metadata" className={media} />
          )}
        </motion.div>

        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent opacity-60 transition-opacity duration-300 group-hover:opacity-100" />
        <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-1/3 -translate-x-full -skew-x-12 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 transition-all duration-1000 group-hover:translate-x-[450%] group-hover:opacity-100" />

        {item.type === "video" && (
          <span className="absolute left-1.5 top-1.5 flex items-center gap-1.5 rounded-full border border-white/25 bg-black/70 p-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-200 sm:left-3 sm:top-3 sm:px-3 sm:py-1">
            <Play className="size-2.5 fill-current sm:size-3" /> <span className="hidden sm:inline">Film</span>
          </span>
        )}
        <span className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full border border-white/20 bg-black/70 text-zinc-200 opacity-0 transition-all duration-300 group-hover:scale-110 group-hover:opacity-100 group-hover:shadow-[0_0_20px_rgba(255,255,255,0.4)]">
          <Expand className="size-4" />
        </span>
        <div className={`absolute inset-x-0 bottom-0 p-2 transition-all duration-300 sm:p-4 ${feature ? "opacity-100 sm:translate-y-2 sm:opacity-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100" : "translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100"}`}>
          <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-zinc-400 sm:text-[10px] sm:tracking-[0.25em]">AURA · {item.no}</p>
          {feature && <p className={`mt-0.5 text-xs font-bold sm:mt-1 sm:text-2xl ${chromeText}`}>{item.title}</p>}
        </div>
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Small pieces                                                       */
/* ------------------------------------------------------------------ */

function CountUp({ to }: { to: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const c = animate(0, to, { duration: 1.4, ease: [0.16, 1, 0.3, 1], onUpdate: (l) => setV(Math.round(l)) });
    return () => c.stop();
  }, [inView, to]);
  return <span ref={ref}>{v}</span>;
}

function Marquee({ reduce, reverse }: { reduce: boolean; reverse?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const x = useTransform(scrollYProgress, [0, 1], reverse ? ["-40%", "0%"] : ["0%", "-40%"]);
  const text = "AURA · BARBER ACADEMY · CRAFT · PRECISION · PRIDE · ";
  return (
    <div ref={ref} aria-hidden className="my-10 overflow-hidden sm:my-14">
      <motion.div style={{ x: reduce ? 0 : x }} className="flex w-max whitespace-nowrap will-change-transform">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="select-none pr-6 text-6xl font-black uppercase tracking-tight text-transparent sm:text-8xl"
            style={{ WebkitTextStroke: "1px rgba(255,255,255,0.2)" }}
          >
            {text}
          </span>
        ))}
      </motion.div>
    </div>
  );
}

function Statement({ reduce }: { reduce: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [30, -30]);
  const rot = useTransform(scrollYProgress, [0, 1], [0, 50]);
  return (
    <div ref={ref} className="relative my-16 overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/70 px-6 py-16 text-center sm:my-24 sm:py-24">
      <motion.div aria-hidden style={{ rotate: reduce ? 0 : rot }} className="pointer-events-none absolute left-1/2 top-1/2 size-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-white/10" />
      <div aria-hidden className={`pointer-events-none absolute left-1/2 top-1/2 size-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full ${glow}`} />
      <motion.div style={{ y: reduce ? 0 : y }} className="relative mx-auto max-w-3xl">
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">The AURA way</p>
        <p className={`mt-5 text-2xl font-bold leading-snug sm:text-4xl ${chromeText}`}>
          Barbering is more than a haircut. It is confidence, trust and craft, delivered one client at a time.
        </p>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Full-screen lightbox                                               */
/* ------------------------------------------------------------------ */

const slide = {
  enter: (d: number) => ({ opacity: 0, x: d * 70 }),
  center: { opacity: 1, x: 0 },
  exit: (d: number) => ({ opacity: 0, x: d * -70 }),
};

function Lightbox({ items, index, setIndex, onClose }: { items: GalleryItem[]; index: number; setIndex: (n: number) => void; onClose: () => void }) {
  const item = items[index];
  const box = useRef<HTMLDivElement>(null);
  const thumbs = useRef<(HTMLButtonElement | null)[]>([]);
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
    thumbs.current[index]?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
    // preload neighbours so next/prev feels instant
    for (const d of [1, -1]) {
      const n = items[(index + d + items.length) % items.length];
      if (n.type === "image") new Image().src = n.src;
    }
  }, [index, items]);

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
    "flex size-10 items-center justify-center rounded-full border border-white/20 bg-black/70 sm:size-11 text-zinc-200 transition hover:border-white/60 hover:bg-white hover:text-black hover:shadow-[0_0_28px_rgba(255,255,255,0.4)]";

  return (
    <motion.div
      ref={box}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[100] flex flex-col bg-black"
      role="dialog"
      aria-modal="true"
      aria-label="Gallery viewer"
    >
      <div aria-hidden className={`pointer-events-none absolute left-1/2 top-1/3 size-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full ${glow}`} />

      <div className="relative z-10 flex items-center justify-between gap-4 p-4 sm:p-6">
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">AURA Barber Academy</p>
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

      <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-3 sm:px-20" onClick={onClose}>
        <button type="button" onClick={(e) => { e.stopPropagation(); go(-1); }} aria-label="Previous" className={`${iconBtn} absolute left-3 top-1/2 z-20 -translate-y-1/2 sm:left-6`}>
          <ChevronLeft className="size-5" />
        </button>
        <button type="button" onClick={(e) => { e.stopPropagation(); go(1); }} aria-label="Next" className={`${iconBtn} absolute right-3 top-1/2 z-20 -translate-y-1/2 sm:right-6`}>
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
            transition={{ duration: 0.22, ease: "easeOut" }}
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
              <img src={item.src} alt={`AURA gallery ${item.no}`} draggable={false} decoding="async" className="max-h-[calc(100dvh-12rem)] max-w-full rounded-xl object-contain" />
            ) : (
              <video src={item.src} controls autoPlay loop playsInline className="max-h-[calc(100dvh-12rem)] max-w-full rounded-xl" />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="relative z-10 flex gap-2 overflow-x-auto p-4 sm:justify-center sm:p-6">
        {items.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => { thumbs.current[i] = el; }}
            type="button"
            onClick={() => { setDir(i > index ? 1 : -1); setIndex(i); }}
            aria-label={`Show item ${t.no}`}
            className={`relative size-14 shrink-0 overflow-hidden rounded-lg border transition-all duration-300 sm:size-16 ${
              i === index ? "scale-110 border-white shadow-[0_0_20px_rgba(255,255,255,0.4)]" : "border-white/15 opacity-50 hover:opacity-100"
            }`}
          >
            {t.type === "image" ? (
              <img src={t.thumb} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
            ) : (
              <span className="flex size-full items-center justify-center bg-gradient-to-b from-zinc-700 to-zinc-900">
                <Play className="size-4 fill-white text-white" />
              </span>
            )}
          </button>
        ))}
      </div>
    </motion.div>
  );
}