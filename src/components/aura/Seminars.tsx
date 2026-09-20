import { useRef, useState } from "react";
import type { PointerEvent, ReactNode } from "react";
import { Link } from "@tanstack/react-router";
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
import {
  ArrowRight,
  Compass,
  Crown,
  Eye,
  Hand,
  Layers,
  MessageCircle,
  Ruler,
  Scissors,
  User,
  Users,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Content (edit freely)                                              */
/* ------------------------------------------------------------------ */

const DAYS = [
  {
    day: "Day 1",
    icon: Eye,
    title: "Look & Learn",
    where: "On a mannequin",
    text: "Watch every technique broken down step by step, then practice it until it clicks.",
  },
  {
    day: "Day 2",
    icon: Hand,
    title: "Workshop",
    where: "On a real model",
    text: "Put everything to work on a live model, the way you will in your own chair.",
  },
];

const TOPICS = [
  {
    icon: Ruler,
    title: "Cutting geometry",
    text: "The shapes and structure behind every clean cut.",
  },
  {
    icon: Scissors,
    title: "Scissors, razor, clipper",
    text: "Control every tool, one technique at a time.",
  },
  {
    icon: Layers,
    title: "Fades and blending",
    text: "Fast fades, photo-ready fades and seamless blends.",
  },
  {
    icon: Compass,
    title: "Styling and face shapes",
    text: "Choose the right cut for every client.",
  },
  {
    icon: MessageCircle,
    title: "Client experience",
    text: "Communication and service that build loyalty.",
  },
  {
    icon: Crown,
    title: "Professional mindset",
    text: "The image and confidence of a working pro.",
  },
];

const FORMATS = [
  {
    key: "group",
    label: "Group",
    icon: Users,
    text: "Train alongside other barbers, swap ideas and push each other to improve.",
  },
  {
    key: "private",
    label: "Private",
    icon: User,
    text: "One-to-one attention, with the seminar shaped around your level and goals.",
  },
] as const;

type FormatKey = (typeof FORMATS)[number]["key"];

const chromeText =
  "bg-gradient-to-b from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent";

/* ------------------------------------------------------------------ */
/* Card with spotlight glow and optional 3D tilt                       */
/* ------------------------------------------------------------------ */

function ChromeCard({
  children,
  tilt = false,
}: {
  children: ReactNode;
  tilt?: boolean;
}) {
  const reduce = useReducedMotion();
  const x = useMotionValue(-300);
  const y = useMotionValue(-300);
  const rx = useSpring(0, { stiffness: 160, damping: 18 });
  const ry = useSpring(0, { stiffness: 160, damping: 18 });
  const spot = useMotionTemplate`radial-gradient(280px circle at ${x}px ${y}px, rgba(255,255,255,0.13), transparent 70%)`;

  function onMove(e: PointerEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    x.set(px);
    y.set(py);
    if (tilt && !reduce) {
      ry.set((px / r.width - 0.5) * 10);
      rx.set(-(py / r.height - 0.5) * 10);
    }
  }

  function onLeave() {
    rx.set(0);
    ry.set(0);
  }

  return (
    <div className="h-full" style={{ perspective: 1000 }}>
      <motion.div
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        style={{ rotateX: rx, rotateY: ry }}
        whileHover={{ y: -4 }}
        transition={{ type: "spring", stiffness: 300, damping: 22 }}
        className="group relative h-full overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-900/80 to-black/90 p-6 shadow-[0_24px_60px_-28px_rgba(0,0,0,0.95)] transition-colors duration-300 hover:border-white/30"
      >
        <motion.div
          aria-hidden
          style={{ background: spot }}
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        />
        <div className="relative h-full">{children}</div>
      </motion.div>
    </div>
  );
}

function IconRing({ icon: Icon }: { icon: typeof Scissors }) {
  return (
    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-black/60 text-zinc-200 transition-all duration-300 group-hover:-rotate-6 group-hover:scale-110 group-hover:border-white/50 group-hover:text-white group-hover:shadow-[0_0_24px_rgba(255,255,255,0.35)]">
      <Icon className="size-5" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Section                                                            */
/* ------------------------------------------------------------------ */

export default function Seminars() {
  const sectionRef = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const [format, setFormat] = useState<FormatKey>("group");
  const active = FORMATS.find((f) => f.key === format) ?? FORMATS[0];

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  const ringY = useTransform(scrollYProgress, [0, 1], [90, -90]);
  const orbY = useTransform(scrollYProgress, [0, 1], [-80, 80]);
  const ringRotate = useTransform(scrollYProgress, [0, 1], [0, 90]);

  return (
    <section
      ref={sectionRef}
      id="seminars"
      className="relative isolate overflow-hidden py-24 sm:py-32"
    >
      {/* Parallax background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-60 [background-image:linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)] [-webkit-mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]"
      />
      <motion.div
        aria-hidden
        style={{ y: ringY, rotate: ringRotate }}
        className="pointer-events-none absolute -left-40 top-24 -z-10 h-[520px] w-[520px] rounded-full border border-dashed border-white/10"
      />
      <motion.div
        aria-hidden
        style={{ y: orbY }}
        className="pointer-events-none absolute -right-32 top-1/2 -z-10 h-[480px] w-[480px] rounded-full bg-white/[0.05] blur-[130px]"
      />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-10">
        {/* ----------------------- Header ----------------------- */}
        <div className="grid items-end gap-10 lg:grid-cols-[1.4fr_1fr]">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="mb-4 flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-white/50">
              <span className="h-px w-10 bg-gradient-to-r from-white/60 to-transparent" />
              Seminars
            </div>
            <h2
              className={`text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl ${chromeText}`}
            >
              Train hands-on with Theopistos.
            </h2>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg">
              This seminar is for barbers and hairstylists who want to grow and
              stand out. Theopistos shares the techniques, secrets and
              experience behind his own work, along with the mindset that comes
              with it.
            </p>
          </motion.div>

          {/* Founder badge */}
          <div className="group relative flex items-center gap-4 rounded-2xl border border-white/10 bg-zinc-950/70 p-5 backdrop-blur transition-colors duration-300 hover:border-white/30 lg:justify-self-end">
            <div className="relative size-16 shrink-0">
              <motion.div
                aria-hidden
                className="absolute inset-0 rounded-full"
                style={{
                  background:
                    "conic-gradient(from 0deg, #fafafa, #52525b, #fafafa, #27272a, #fafafa)",
                }}
                animate={reduce ? undefined : { rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              />
              <div className="absolute inset-[2px] flex items-center justify-center rounded-full bg-black font-serif text-2xl text-zinc-100 transition-shadow duration-300 group-hover:shadow-[0_0_28px_rgba(255,255,255,0.35)]">
                T
              </div>
            </div>
            <div>
              <p className="text-lg font-semibold text-white">Theopistos</p>
              <p className="text-sm text-zinc-400">
                Founder and Head Educator, AURA
              </p>
            </div>
          </div>
        </div>

        {/* ----------------------- Two days ----------------------- */}
        <div className="mt-16 grid items-stretch gap-4 md:grid-cols-[1fr_auto_1fr] md:gap-2">
          <ChromeCard tilt>
            <DayContent {...DAYS[0]} />
          </ChromeCard>

          <div
            aria-hidden
            className="relative flex items-center justify-center py-1 md:py-0"
          >
            <span className="hidden h-px w-8 bg-gradient-to-r from-transparent to-white/30 md:block" />
            <div className="relative mx-2 flex size-11 items-center justify-center rounded-full border border-white/25 bg-black">
              {!reduce && (
                <motion.span
                  className="absolute inset-0 rounded-full border border-white/40"
                  animate={{ scale: [1, 1.7], opacity: [0.6, 0] }}
                  transition={{
                    duration: 2.4,
                    repeat: Infinity,
                    ease: "easeOut",
                  }}
                />
              )}
              <ArrowRight className="size-4 rotate-90 text-zinc-200 md:rotate-0" />
            </div>
            <span className="hidden h-px w-8 bg-gradient-to-l from-transparent to-white/30 md:block" />
          </div>

          <ChromeCard tilt>
            <DayContent {...DAYS[1]} />
          </ChromeCard>
        </div>

        {/* ----------------------- What you'll work on ----------------------- */}
        <div className="mt-20">
          <h3 className="text-xl font-semibold text-white sm:text-2xl">
            What you will work on
          </h3>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TOPICS.map((t) => (
              <ChromeCard key={t.title}>
                <div className="flex items-start gap-4">
                  <IconRing icon={t.icon} />
                  <div>
                    <h4 className="text-sm font-semibold text-white">
                      {t.title}
                    </h4>
                    <p className="mt-1 text-sm leading-relaxed text-zinc-400">
                      {t.text}
                    </p>
                  </div>
                </div>
              </ChromeCard>
            ))}
          </div>
        </div>

        {/* ----------------------- Format and booking ----------------------- */}
        <div className="relative mt-20 overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-br from-zinc-900/90 via-black to-zinc-950 p-8 shadow-[0_0_80px_-30px_rgba(255,255,255,0.25)] sm:p-12">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-white/[0.07] blur-[90px]"
          />
          <div className="relative grid items-center gap-10 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <h3 className="text-2xl font-semibold text-white sm:text-3xl">
                Private or group, your choice.
              </h3>

              <div
                role="tablist"
                aria-label="Seminar format"
                className="mt-6 inline-flex rounded-full border border-white/15 bg-black/60 p-1"
              >
                {FORMATS.map((f) => {
                  const selected = format === f.key;
                  return (
                    <button
                      key={f.key}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      onClick={() => setFormat(f.key)}
                      className={`relative z-10 flex cursor-pointer items-center gap-2 rounded-full px-5 py-2 text-sm font-medium outline-none transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-white/50 ${
                        selected
                          ? "text-black"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      {selected && (
                        <motion.span
                          layoutId="seminar-format-pill"
                          className="absolute inset-0 -z-10 rounded-full bg-gradient-to-b from-zinc-100 to-zinc-400"
                          transition={{
                            type: "spring",
                            stiffness: 380,
                            damping: 30,
                          }}
                        />
                      )}
                      <f.icon className="size-4" />
                      {f.label}
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 min-h-[3.5rem] max-w-md">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={active.key}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                    className="text-base leading-relaxed text-zinc-400"
                  >
                    {active.text}
                  </motion.p>
                </AnimatePresence>
              </div>
            </div>

            <div className="flex flex-col items-start gap-4 lg:items-end lg:text-right">
              <p className="max-w-xs text-sm leading-relaxed text-zinc-400">
                Tell us which format you want and we will help you pick the
                right dates.
              </p>
              <motion.div
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.98 }}
                className="inline-block"
              >
                <Link
                  to="/contact"
                  className="group relative inline-flex items-center gap-3 overflow-hidden rounded-full bg-gradient-to-b from-zinc-100 via-zinc-300 to-zinc-400 px-8 py-4 text-base font-semibold text-black shadow-[0_0_30px_rgba(255,255,255,0.25)] outline-none transition-shadow duration-300 before:absolute before:inset-y-0 before:-left-1/2 before:w-1/2 before:-skew-x-12 before:bg-white/70 before:blur-md before:transition-transform before:duration-700 hover:shadow-[0_0_60px_rgba(255,255,255,0.5)] hover:before:translate-x-[300%] focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                >
                  <span className="relative">Book your seminar</span>
                  <ArrowRight className="relative size-5 transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function DayContent({
  day,
  icon,
  title,
  where,
  text,
}: {
  day: string;
  icon: typeof Scissors;
  title: string;
  where: string;
  text: string;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between">
        <IconRing icon={icon} />
        <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-300">
          {day}
        </span>
      </div>
      <h3 className={`mt-6 text-2xl font-bold sm:text-3xl ${chromeText}`}>
        {title}
      </h3>
      <p className="mt-1 text-sm font-medium text-zinc-300">{where}</p>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">{text}</p>
    </div>
  );
}