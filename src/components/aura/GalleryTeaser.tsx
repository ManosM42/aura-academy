import { useRef } from "react";
import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { ArrowRight, Images, Play } from "lucide-react";
import { GALLERY } from "@/lib/gallery";

const chromeText = "bg-gradient-to-b from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent";
const glow = "bg-[radial-gradient(circle,rgba(255,255,255,0.09),transparent_68%)]";

// Same collage on every screen: widths are percentages, so it scales instead of overflowing.
const FRAMES = [
  { w: "w-[34%]", ratio: "aspect-[3/4.4]", mt: "mt-0", rot: -4 },
  { w: "w-[31%]", ratio: "aspect-[3/4]", mt: "mt-[10%]", rot: 3 },
  { w: "w-[29%]", ratio: "aspect-[3/3.8]", mt: "mt-[4%]", rot: -2 },
];

export default function GalleryTeaser() {
  const ref = useRef<HTMLElement>(null);
  const reduce = !!useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });

  const yA = useTransform(scrollYProgress, [0, 1], [40, -40]);
  const yB = useTransform(scrollYProgress, [0, 1], [-20, 55]);
  const yC = useTransform(scrollYProgress, [0, 1], [60, -60]);
  const ringRotate = useTransform(scrollYProgress, [0, 1], [0, 90]);
  const ys = [yA, yB, yC];

  const photos = GALLERY.filter((g) => g.type === "image");
  const video = GALLERY.find((g) => g.type === "video");
  const items = [photos[0], video ?? photos[1], photos[2] ?? photos[1]].filter(Boolean);

  return (
    <section ref={ref} id="gallery" className="relative isolate overflow-hidden py-20 sm:py-32">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-50 [background-image:linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:48px_48px] sm:[background-size:64px_64px]"
      />
      <motion.div aria-hidden style={{ rotate: reduce ? 0 : ringRotate }} className="pointer-events-none absolute -right-48 top-10 -z-10 h-[420px] w-[420px] rounded-full border border-dashed border-white/10 sm:-right-40 sm:h-[520px] sm:w-[520px]" />
      <div aria-hidden className={`pointer-events-none absolute -left-40 top-1/4 -z-10 h-[600px] w-[600px] rounded-full ${glow}`} />
      <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-10">
        <div className="grid items-center gap-14 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="text-center lg:text-left"
          >
            <div className="mb-4 flex items-center justify-center gap-3 text-xs uppercase tracking-[0.3em] text-white/50 lg:justify-start">
              <span className="h-px w-10 bg-gradient-to-r from-white/60 to-transparent" />
              Portfolio
            </div>
            <h2 className={`text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl ${chromeText}`}>
              See the craft up close.
            </h2>
            <p className="mx-auto mt-6 max-w-lg text-base leading-relaxed text-zinc-400 sm:text-lg lg:mx-0">
              The people, the work and the moments behind AURA. Browse the Barbers' Gallery and open any piece
              full screen.
            </p>

            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.98 }} className="mt-9 inline-block">
              <Link
                to="/gallery"
                className="group relative inline-flex items-center gap-3 overflow-hidden rounded-full bg-gradient-to-b from-zinc-100 via-zinc-300 to-zinc-400 px-7 py-3.5 text-base font-semibold text-black shadow-[0_0_30px_rgba(255,255,255,0.25)] outline-none transition-shadow duration-300 before:absolute before:inset-y-0 before:-left-1/2 before:w-1/2 before:-skew-x-12 before:bg-white/70 before:blur-md before:transition-transform before:duration-700 hover:shadow-[0_0_60px_rgba(255,255,255,0.5)] hover:before:translate-x-[300%] focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black sm:px-8 sm:py-4"
              >
                <Images className="relative size-5" />
                <span className="relative">View our Gallery</span>
                <ArrowRight className="relative size-5 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </motion.div>
          </motion.div>

          <div className="relative mx-auto flex w-full max-w-[560px] items-start justify-center gap-2 pb-[6%] sm:gap-5">
            <div aria-hidden className={`pointer-events-none absolute left-1/2 top-1/2 size-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full ${glow}`} />
            {items.map((f, i) => {
              const fr = FRAMES[i];
              return (
                <motion.div key={f.id} style={{ y: reduce ? 0 : ys[i] }} className={`${fr.w} ${fr.mt}`}>
                  <Link to="/gallery" aria-label="Open the gallery" className="block">
                    <motion.div
                      initial={{ opacity: 0, scale: 0.92, rotate: 0 }}
                      whileInView={{ opacity: 1, scale: 1, rotate: fr.rot }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.8, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] }}
                      whileHover={{ rotate: 0, scale: 1.05, y: -8 }}
                      className={`group relative w-full overflow-hidden rounded-xl border border-white/15 bg-zinc-950 shadow-[0_30px_70px_-25px_rgba(0,0,0,0.95)] transition-[border-color,box-shadow] duration-300 hover:border-white/50 hover:shadow-[0_0_50px_-8px_rgba(255,255,255,0.3)] sm:rounded-2xl ${fr.ratio}`}
                    >
                      {f.type === "image" ? (
                        <img src={f.thumb} alt="AURA gallery" loading="lazy" decoding="async" className="size-full object-cover transition-transform duration-700 group-hover:scale-110" />
                      ) : (
                        <video
                          src={`${f.src}#t=0.1`}
                          muted
                          loop
                          playsInline
                          preload="metadata"
                          onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
                          onMouseLeave={(e) => e.currentTarget.pause()}
                          className="size-full object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                      )}
                      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-1/3 -translate-x-full -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-0 transition-all duration-1000 group-hover:translate-x-[450%] group-hover:opacity-100" />
                      {f.type === "video" && (
                        <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full border border-white/25 bg-black/70 p-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-200 sm:left-3 sm:top-3 sm:px-2.5 sm:py-1">
                          <Play className="size-2.5 fill-current sm:size-3" /> <span className="hidden sm:inline">Film</span>
                        </span>
                      )}
                    </motion.div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}