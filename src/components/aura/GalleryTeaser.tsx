import { useRef } from "react";
import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { ArrowRight, Images, Play } from "lucide-react";
import { GALLERY } from "@/lib/gallery";

const chromeText = "bg-gradient-to-b from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent";

export default function GalleryTeaser() {
  const ref = useRef<HTMLElement>(null);
  const reduce = !!useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });

  const yA = useTransform(scrollYProgress, [0, 1], [70, -70]);
  const yB = useTransform(scrollYProgress, [0, 1], [-40, 90]);
  const yC = useTransform(scrollYProgress, [0, 1], [110, -110]);
  const ringRotate = useTransform(scrollYProgress, [0, 1], [0, 100]);
  const orbY = useTransform(scrollYProgress, [0, 1], [-80, 80]);

  // pick three showcase tiles: first photo, the video (if any), another photo
  const photos = GALLERY.filter((g) => g.type === "image");
  const video = GALLERY.find((g) => g.type === "video");
  const frames = [photos[0], video ?? photos[1], photos[2] ?? photos[1]].filter(Boolean);
  const ys = [yA, yB, yC];
  const rot = [-4, 3, -2];
  const sizes = ["h-72 w-52 sm:h-96 sm:w-64", "h-64 w-48 sm:h-80 sm:w-56", "h-60 w-44 sm:h-72 sm:w-52"];
  const offsets = ["", "mt-12 sm:mt-20", "mt-4 sm:mt-8"];

  return (
    <section ref={ref} id="gallery" className="relative isolate overflow-hidden py-24 sm:py-32">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-60 [background-image:linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)] [-webkit-mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]"
      />
      <motion.div aria-hidden style={{ rotate: reduce ? 0 : ringRotate }} className="pointer-events-none absolute -right-40 top-10 -z-10 h-[520px] w-[520px] rounded-full border border-dashed border-white/10" />
      <motion.div aria-hidden style={{ y: reduce ? 0 : orbY }} className="pointer-events-none absolute -left-32 top-1/3 -z-10 h-[460px] w-[460px] rounded-full bg-white/[0.05] blur-[130px]" />
      <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-10">
        <div className="grid items-center gap-16 lg:grid-cols-[1fr_1.1fr]">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="mb-4 flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-white/50">
              <span className="h-px w-10 bg-gradient-to-r from-white/60 to-transparent" />
              Portfolio
            </div>
            <h2 className={`text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl ${chromeText}`}>
              See the craft up close.
            </h2>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-zinc-400 sm:text-lg">
              Fades, lines and finishes straight from our chairs. Browse the Barbers' Gallery and open any piece
              full screen.
            </p>

            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.98 }} className="mt-9 inline-block">
              <Link
                to="/gallery"
                className="group relative inline-flex items-center gap-3 overflow-hidden rounded-full bg-gradient-to-b from-zinc-100 via-zinc-300 to-zinc-400 px-8 py-4 text-base font-semibold text-black shadow-[0_0_30px_rgba(255,255,255,0.25)] outline-none transition-shadow duration-300 before:absolute before:inset-y-0 before:-left-1/2 before:w-1/2 before:-skew-x-12 before:bg-white/70 before:blur-md before:transition-transform before:duration-700 hover:shadow-[0_0_60px_rgba(255,255,255,0.5)] hover:before:translate-x-[300%] focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              >
                <Images className="relative size-5" />
                <span className="relative">View our Gallery</span>
                <ArrowRight className="relative size-5 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </motion.div>
          </motion.div>

          {/* parallax collage */}
          <div className="relative flex items-start justify-center gap-3 sm:gap-5">
            <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 size-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.07] blur-[100px]" />
            {frames.map((f, i) => (
              <motion.div key={f.id} style={{ y: reduce ? 0 : ys[i] }} className={offsets[i]}>
                <Link to="/gallery" aria-label="Open the gallery">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, rotate: 0 }}
                    whileInView={{ opacity: 1, scale: 1, rotate: rot[i] }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] }}
                    whileHover={{ rotate: 0, scale: 1.05, y: -8 }}
                    className={`group relative overflow-hidden rounded-2xl border border-white/15 bg-zinc-950 shadow-[0_30px_70px_-25px_rgba(0,0,0,0.95)] transition-[border-color,box-shadow] duration-300 hover:border-white/50 hover:shadow-[0_0_50px_-8px_rgba(255,255,255,0.3)] ${sizes[i]}`}
                  >
                    {f.type === "image" ? (
                      <img src={f.src} alt={f.title} loading="lazy" className="size-full object-cover transition-transform duration-700 group-hover:scale-110" />
                    ) : (
                      <video src={f.src} autoPlay muted loop playsInline preload="metadata" className="size-full object-cover transition-transform duration-700 group-hover:scale-110" />
                    )}
                    <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <div aria-hidden className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-0 blur-sm transition-all duration-1000 group-hover:left-[130%] group-hover:opacity-100" />
                    {f.type === "video" && (
                      <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full border border-white/25 bg-black/60 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-200 backdrop-blur">
                        <Play className="size-3 fill-current" /> Video
                      </span>
                    )}
                  </motion.div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}