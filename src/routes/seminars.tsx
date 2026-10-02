import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  ArrowLeft,
  ArrowRight,
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  User,
  Users,
} from "lucide-react";
import {
  GROUP_CAPACITY,
  MIN_GROUP,
  SLOTS,
  type AvailabilityIndex,
  type Experience,
  type SeminarFormat,
  createSeminarBooking,
  fromISO,
  getAvailability,
  getDayStatus,
  getSlotStatus,
  indexAvailability,
  startOfMonth,
  toISO,
} from "@/lib/seminars";

export const Route = createFileRoute("/seminars")({ component: SeminarsBookingRoute });

/* ------------------------------------------------------------------ */
/* Theme tokens                                                       */
/* ------------------------------------------------------------------ */

const chromeText =
  "bg-gradient-to-b from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent";

const MONTHS_EL = [
  "Ιανουάριος", "Φεβρουάριος", "Μάρτιος", "Απρίλιος", "Μάιος", "Ιούνιος",
  "Ιούλιος", "Αύγουστος", "Σεπτέμβριος", "Οκτώβριος", "Νοέμβριος", "Δεκέμβριος",
];
const WEEKDAYS_EL = ["Δ", "Τ", "Τ", "Π", "Π", "Σ", "Κ"];

const EXPERIENCE_OPTIONS: { value: Experience; label: string }[] = [
  { value: "beginner", label: "Αρχάριος" },
  { value: "intermediate", label: "Μέτριο επίπεδο" },
  { value: "professional", label: "Επαγγελματίας" },
];

type Step = "format" | "date" | "details" | "done";

/* ------------------------------------------------------------------ */
/* Root                                                                */
/* ------------------------------------------------------------------ */

function SeminarsBookingRoute() {
  const reduce = useReducedMotion();
  const sectionRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });
  const glowY = useTransform(scrollYProgress, [0, 1], [-60, 120]);
  const ringRotate = useTransform(scrollYProgress, [0, 1], [0, 60]);

  const [step, setStep] = useState<Step>("format");
  const [format, setFormat] = useState<SeminarFormat | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [participants, setParticipants] = useState(2);
  const [reference, setReference] = useState<string | null>(null);

  const [avail, setAvail] = useState<AvailabilityIndex>(new Map());
  const [loadingAvail, setLoadingAvail] = useState(false);
  const [month, setMonth] = useState(() => startOfMonth(new Date()));

  async function loadMonth(target: Date) {
    setLoadingAvail(true);
    try {
      const first = startOfMonth(target);
      const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
      const rows = await getAvailability(toISO(first), toISO(last));
      setAvail(indexAvailability(rows));
    } catch {
      setAvail(new Map());
    } finally {
      setLoadingAvail(false);
    }
  }

  useEffect(() => {
    loadMonth(month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  function pickFormat(f: SeminarFormat) {
    setFormat(f);
    setParticipants(f === "private" ? 1 : MIN_GROUP);
    setDate(null);
    setSlot(null);
    setStep("date");
  }

  function pickSlot(d: string, s: string) {
    setDate(d);
    setSlot(s);
    setStep("details");
  }

  function onBooked(ref: string) {
    setReference(ref);
    setStep("done");
    loadMonth(month);
  }

  function restart() {
    setStep("format");
    setFormat(null);
    setDate(null);
    setSlot(null);
    setReference(null);
  }

  return (
    <main
      ref={sectionRef}
      className="relative min-h-screen overflow-hidden bg-black pb-24 pt-28 text-white selection:bg-white selection:text-black"
    >
      {/* Ambient chrome background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-60 [background-image:linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)] [-webkit-mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]"
      />
      <motion.div
        aria-hidden
        style={{ y: glowY }}
        className="pointer-events-none absolute -right-40 top-20 -z-10 h-[520px] w-[520px] rounded-full bg-white/[0.06] blur-[140px]"
      />
      <motion.div
        aria-hidden
        style={{ rotate: ringRotate }}
        className="pointer-events-none absolute -left-44 top-64 -z-10 h-[480px] w-[480px] rounded-full border border-dashed border-white/10"
      />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
      />

      <div className="mx-auto max-w-5xl px-4 sm:px-6 md:px-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="mb-4 flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-white/50">
            <span className="h-px w-10 bg-gradient-to-r from-white/60 to-transparent" />
            Κράτηση σεμιναρίου
          </div>
          <h1
            className={`text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl ${chromeText}`}
          >
            Κλείσε τη θέση σου στο AURA.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg">
            Επίλεξε group ή private, μια διαθέσιμη ημερομηνία και ώρα, και άφησε
            τα στοιχεία σου. Θα επικοινωνήσουμε μαζί σου για επιβεβαίωση.
          </p>
        </motion.div>

        {/* Progress rail */}
        <StepRail step={step} format={format} />

        {/* Steps */}
        <div className="relative mt-10 overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-br from-zinc-900/80 via-black to-zinc-950 shadow-[0_0_90px_-30px_rgba(255,255,255,0.18)]">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-white/[0.06] blur-[90px]"
          />
          <AnimatePresence mode="wait">
            {step === "format" && (
              <StepWrap key="format">
                <FormatStep onPick={pickFormat} reduce={!!reduce} />
              </StepWrap>
            )}

            {step === "date" && format && (
              <StepWrap key="date">
                <DateStep
                  format={format}
                  participants={participants}
                  setParticipants={setParticipants}
                  month={month}
                  setMonth={setMonth}
                  avail={avail}
                  loading={loadingAvail}
                  onPickSlot={pickSlot}
                  onBack={() => setStep("format")}
                />
              </StepWrap>
            )}

            {step === "details" && format && date && slot && (
              <StepWrap key="details">
                <DetailsStep
                  format={format}
                  date={date}
                  slot={slot}
                  participants={participants}
                  onBack={() => setStep("date")}
                  onBooked={onBooked}
                />
              </StepWrap>
            )}

            {step === "done" && reference && format && date && slot && (
              <StepWrap key="done">
                <DoneStep
                  reference={reference}
                  format={format}
                  date={date}
                  slot={slot}
                  participants={participants}
                  onRestart={restart}
                />
              </StepWrap>
            )}
          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}

function StepWrap({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="relative p-6 sm:p-10"
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Progress rail                                                      */
/* ------------------------------------------------------------------ */

function StepRail({ step, format }: { step: Step; format: SeminarFormat | null }) {
  const steps: { key: Step; label: string }[] = [
    { key: "format", label: "Format" },
    { key: "date", label: "Ημερομηνία" },
    { key: "details", label: "Στοιχεία" },
    { key: "done", label: "Επιβεβαίωση" },
  ];
  const idx = steps.findIndex((s) => s.key === step);

  return (
    <div className="mt-10 flex items-center gap-2 sm:gap-3">
      {steps.map((s, i) => (
        <div key={s.key} className="flex flex-1 items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2">
            <div
              className={`flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors duration-300 ${
                i < idx
                  ? "border-white/60 bg-white text-black"
                  : i === idx
                    ? "border-white/70 bg-white/10 text-white shadow-[0_0_18px_rgba(255,255,255,0.3)]"
                    : "border-white/15 bg-black/60 text-zinc-500"
              }`}
            >
              {i < idx ? <Check className="size-3.5" /> : i + 1}
            </div>
            <span
              className={`hidden text-xs font-medium sm:block ${
                i <= idx ? "text-zinc-200" : "text-zinc-600"
              }`}
            >
              {s.label}
              {s.key === "format" && format && i < idx && (
                <span className="ml-1 text-zinc-500">
                  ({format === "group" ? "Group" : "Private"})
                </span>
              )}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className="h-px flex-1 bg-gradient-to-r from-white/20 to-white/5" />
          )}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 1: Format                                                     */
/* ------------------------------------------------------------------ */

function FormatStep({
  onPick,
  reduce,
}: {
  onPick: (f: SeminarFormat) => void;
  reduce: boolean;
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-white sm:text-2xl">
        Πώς θέλεις να παρακολουθήσεις;
      </h2>
      <p className="mt-2 text-sm text-zinc-400">
        Και τα δύο formats καλύπτουν τεχνική, cutting geometry, fades και
        client experience.
      </p>

      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        <FormatCard
          icon={Users}
          title="Group"
          desc="Εκπαίδευση μαζί με άλλους barbers, 2 έως 8 άτομα ανά σεμινάριο."
          bullets={["Ανταλλαγή τεχνικών με άλλους", "Οικονομικότερη επιλογή", "Ζωντανή ενέργεια ομάδας"]}
          reduce={reduce}
          onClick={() => onPick("group")}
        />
        <FormatCard
          icon={User}
          title="Private"
          desc="1-προς-1 εκπαίδευση, πλήρως προσαρμοσμένη στο επίπεδο και τους στόχους σου."
          bullets={["100% προσοχή στον educator", "Ευελιξία στο πρόγραμμα", "Βαθιά εξατομίκευση"]}
          reduce={reduce}
          onClick={() => onPick("private")}
        />
      </div>
    </div>
  );
}

function FormatCard({
  icon: Icon,
  title,
  desc,
  bullets,
  reduce,
  onClick,
}: {
  icon: typeof Users;
  title: string;
  desc: string;
  bullets: string[];
  reduce: boolean;
  onClick: () => void;
}) {
  const x = useMotionValue(-300);
  const y = useMotionValue(-300);
  const rx = useSpring(0, { stiffness: 160, damping: 18 });
  const ry = useSpring(0, { stiffness: 160, damping: 18 });
  const spot = useMotionTemplate`radial-gradient(260px circle at ${x}px ${y}px, rgba(255,255,255,0.14), transparent 70%)`;

  function onMove(e: React.PointerEvent<HTMLButtonElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    x.set(px);
    y.set(py);
    if (!reduce) {
      ry.set((px / r.width - 0.5) * 8);
      rx.set(-(py / r.height - 0.5) * 8);
    }
  }
  function onLeave() {
    rx.set(0);
    ry.set(0);
  }

  return (
    <div style={{ perspective: 1000 }}>
      <motion.button
        type="button"
        onClick={onClick}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        style={{ rotateX: rx, rotateY: ry }}
        whileHover={{ y: -4 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 300, damping: 22 }}
        className="group relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-900/80 to-black/90 p-6 text-left shadow-[0_24px_60px_-28px_rgba(0,0,0,0.95)] transition-colors duration-300 hover:border-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
      >
        <motion.div
          aria-hidden
          style={{ background: spot }}
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        />
        <div className="relative">
          <div className="flex size-12 items-center justify-center rounded-xl border border-white/15 bg-black/60 text-zinc-200 transition-all duration-300 group-hover:-rotate-6 group-hover:scale-110 group-hover:border-white/50 group-hover:text-white group-hover:shadow-[0_0_24px_rgba(255,255,255,0.35)]">
            <Icon className="size-6" />
          </div>
          <h3 className={`mt-5 text-2xl font-bold ${chromeText}`}>{title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">{desc}</p>
          <ul className="mt-5 space-y-2">
            {bullets.map((b) => (
              <li key={b} className="flex items-center gap-2 text-xs text-zinc-400">
                <Sparkles className="size-3.5 shrink-0 text-zinc-500" />
                {b}
              </li>
            ))}
          </ul>
          <div className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-zinc-200">
            Επιλογή {title}
            <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
          </div>
        </div>
      </motion.button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 2: Date + slot calendar                                       */
/* ------------------------------------------------------------------ */

function DateStep({
  format,
  participants,
  setParticipants,
  month,
  setMonth,
  avail,
  loading,
  onPickSlot,
  onBack,
}: {
  format: SeminarFormat;
  participants: number;
  setParticipants: (n: number) => void;
  month: Date;
  setMonth: (d: Date) => void;
  avail: AvailabilityIndex;
  loading: boolean;
  onPickSlot: (date: string, slot: string) => void;
  onBack: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const cells = useMemo(() => buildMonthGrid(month), [month]);
  const isPastMonth =
    month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth();

  const selectedDay = selected ? avail.get(selected) : undefined;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition hover:text-white"
          >
            <ArrowLeft className="size-3.5" /> Αλλαγή format
          </button>
          <h2 className="mt-2 text-xl font-semibold text-white sm:text-2xl">
            Επίλεξε ημερομηνία & ώρα
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            {format === "group" ? "Group seminar" : "Private seminar"} ·{" "}
            {format === "group" ? `${participants} άτομα` : "1-προς-1"}
          </p>
        </div>

        {format === "group" && (
          <div className="flex items-center gap-3 rounded-full border border-white/15 bg-black/60 px-4 py-2">
            <Users className="size-4 text-zinc-400" />
            <span className="text-xs text-zinc-400">Άτομα</span>
            <div className="flex items-center gap-2">
              <StepperBtn
                onClick={() => setParticipants(Math.max(MIN_GROUP, participants - 1))}
                label="−"
              />
              <span className="w-5 text-center text-sm font-semibold text-white">
                {participants}
              </span>
              <StepperBtn
                onClick={() => setParticipants(Math.min(GROUP_CAPACITY, participants + 1))}
                label="+"
              />
            </div>
          </div>
        )}
      </div>

      {/* Calendar */}
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="rounded-2xl border border-white/10 bg-black/50 p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <button
              type="button"
              disabled={isPastMonth}
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
              className="flex size-8 items-center justify-center rounded-full border border-white/15 text-zinc-300 transition hover:border-white/40 hover:text-white disabled:opacity-25"
            >
              <ChevronLeft className="size-4" />
            </button>
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-200">
              {MONTHS_EL[month.getMonth()]} {month.getFullYear()}
            </h3>
            <button
              type="button"
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
              className="flex size-8 items-center justify-center rounded-full border border-white/15 text-zinc-300 transition hover:border-white/40 hover:text-white"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          <div className="mt-5 grid grid-cols-7 gap-1.5 text-center text-[11px] uppercase tracking-wider text-zinc-600">
            {WEEKDAYS_EL.map((w, i) => (
              <div key={`${w}-${i}`}>{w}</div>
            ))}
          </div>

          <div className="relative mt-2 grid grid-cols-7 gap-1.5">
            {loading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-black/50 backdrop-blur-sm">
                <Loader2 className="size-5 animate-spin text-zinc-400" />
              </div>
            )}
            {cells.map((cell, i) => {
              if (!cell) return <div key={i} />;
              const iso = toISO(cell);
              const isPast = cell < today;
              const status = isPast
                ? "blocked"
                : getDayStatus(avail.get(iso), format, participants);
              const isSelected = selected === iso;

              return (
                <button
                  key={iso}
                  type="button"
                  disabled={isPast || status === "blocked" || status === "full"}
                  onClick={() => setSelected(iso)}
                  className={`relative flex aspect-square flex-col items-center justify-center rounded-lg border text-xs font-medium transition-all duration-200 ${
                    isSelected
                      ? "border-white bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.4)]"
                      : status === "blocked" || isPast
                        ? "border-transparent text-zinc-700 cursor-not-allowed"
                        : status === "full"
                          ? "border-transparent text-zinc-700 line-through cursor-not-allowed"
                          : status === "few"
                            ? "border-amber-400/25 bg-amber-400/[0.06] text-zinc-200 hover:border-amber-400/50"
                            : "border-white/10 bg-white/[0.02] text-zinc-200 hover:border-white/40 hover:bg-white/[0.06]"
                  }`}
                >
                  {cell.getDate()}
                  {!isPast && status !== "blocked" && (
                    <span
                      className={`mt-0.5 size-1 rounded-full ${
                        isSelected
                          ? "bg-black"
                          : status === "full"
                            ? "bg-transparent"
                            : status === "few"
                              ? "bg-amber-400"
                              : "bg-emerald-400"
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-4 text-[11px] text-zinc-500">
            <Legend color="bg-emerald-400" label="Διαθέσιμο" />
            <Legend color="bg-amber-400" label="Λίγες θέσεις" />
            <Legend color="bg-zinc-700" label="Γεμάτο / κλειστό" />
          </div>
        </div>

        {/* Time slots */}
        <div className="rounded-2xl border border-white/10 bg-black/50 p-5">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
            <Clock className="size-4 text-zinc-400" />
            Διαθέσιμες ώρες
          </h4>

          {!selected && (
            <p className="mt-4 text-sm text-zinc-500">
              Επίλεξε μια ημερομηνία στο ημερολόγιο για να δεις τις ώρες.
            </p>
          )}

          {selected && (
            <div className="mt-4 space-y-2.5">
              <p className="text-xs text-zinc-500">
                {fromISO(selected).toLocaleDateString("el-GR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </p>
              {SLOTS.map((s) => {
                const { status, remaining } = getSlotStatus(
                  selectedDay,
                  s,
                  format,
                  participants,
                );
                const disabled = status === "blocked" || status === "full";
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={disabled}
                    onClick={() => onPickSlot(selected, s)}
                    className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm transition-all duration-200 ${
                      disabled
                        ? "cursor-not-allowed border-white/5 text-zinc-700"
                        : "border-white/10 bg-white/[0.02] text-zinc-200 hover:border-white/40 hover:bg-white/[0.07] hover:shadow-[0_0_20px_-6px_rgba(255,255,255,0.3)]"
                    }`}
                  >
                    <span className="font-medium">{s}</span>
                    <span
                      className={`text-[11px] uppercase tracking-wider ${
                        disabled
                          ? "text-zinc-700"
                          : status === "few"
                            ? "text-amber-400"
                            : "text-emerald-400"
                      }`}
                    >
                      {status === "blocked"
                        ? "Μη διαθέσιμο"
                        : status === "full"
                          ? "Γεμάτο"
                          : format === "group"
                            ? `${remaining} θέσεις`
                            : "Διαθέσιμο"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StepperBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex size-6 items-center justify-center rounded-full border border-white/20 text-sm text-zinc-300 transition hover:border-white/50 hover:text-white"
    >
      {label}
    </button>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`size-1.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function buildMonthGrid(month: Date): (Date | null)[] {
  const first = startOfMonth(month);
  const firstWeekday = (first.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = Array(firstWeekday).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(month.getFullYear(), month.getMonth(), d));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/* ------------------------------------------------------------------ */
/* Step 3: Details form (dynamic per format) + terms                  */
/* ------------------------------------------------------------------ */

function DetailsStep({
  format,
  date,
  slot,
  participants,
  onBack,
  onBooked,
}: {
  format: SeminarFormat;
  date: string;
  slot: string;
  participants: number;
  onBack: () => void;
  onBooked: (ref: string) => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [experience, setExperience] = useState<Experience>("intermediate");
  const [groupName, setGroupName] = useState("");
  const [participantNames, setParticipantNames] = useState("");
  const [goals, setGoals] = useState("");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid =
    fullName.trim().length >= 2 &&
    /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) &&
    phone.trim().length >= 6 &&
    city.trim().length >= 2 &&
    terms;

  async function submit() {
    if (!valid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const ref = await createSeminarBooking({
        format,
        date,
        slot,
        participants,
        fullName,
        email,
        phone,
        city,
        experience,
        groupName,
        participantNames,
        goals,
        notes,
        terms,
      });
      onBooked(ref);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown";
      setError(
        msg.includes("slot_unavailable")
          ? "Δυστυχώς αυτή η ώρα μόλις έγινε μη διαθέσιμη. Διάλεξε άλλη ώρα."
          : "Κάτι πήγε στραβά. Δοκίμασε ξανά σε λίγο.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition hover:text-white"
      >
        <ArrowLeft className="size-3.5" /> Αλλαγή ημερομηνίας
      </button>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-white sm:text-2xl">Τα στοιχεία σου</h2>
        <SummaryPill format={format} date={date} slot={slot} participants={participants} />
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              icon={User}
              label={format === "group" ? "Υπεύθυνος επικοινωνίας" : "Ονοματεπώνυμο"}
              value={fullName}
              onChange={setFullName}
              placeholder="Ονοματεπώνυμο"
              autoComplete="name"
            />
            <Field
              icon={Mail}
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="you@example.com"
              autoComplete="email"
            />
            <Field
              icon={Phone}
              label="Τηλέφωνο"
              type="tel"
              value={phone}
              onChange={setPhone}
              placeholder="69xxxxxxxx"
              autoComplete="tel"
            />
            <Field
              icon={MapPin}
              label="Πόλη"
              value={city}
              onChange={setCity}
              placeholder="π.χ. Ηράκλειο"
              autoComplete="address-level2"
            />
          </div>

          <SelectField
            label="Επίπεδο εμπειρίας"
            value={experience}
            onChange={(v) => setExperience(v as Experience)}
            options={EXPERIENCE_OPTIONS}
          />

          {/* Dynamic section: group vs private */}
          <AnimatePresence mode="wait">
            {format === "group" ? (
              <motion.div
                key="group-fields"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-5"
              >
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
                  <Users className="size-3.5" /> Στοιχεία ομάδας · {participants} άτομα
                </p>
                <Field
                  label="Όνομα ομάδας / κομμωτηρίου (προαιρετικό)"
                  value={groupName}
                  onChange={setGroupName}
                  placeholder="π.χ. AURA Team"
                />
                <TextAreaField
                  label="Ονόματα συμμετεχόντων (προαιρετικό)"
                  value={participantNames}
                  onChange={setParticipantNames}
                  placeholder={"Ένα όνομα ανά γραμμή…"}
                  rows={3}
                />
              </motion.div>
            ) : (
              <motion.div
                key="private-fields"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-5"
              >
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
                  <User className="size-3.5" /> Private εκπαίδευση
                </p>
                <TextAreaField
                  label="Σε τι θέλεις να εστιάσουμε;"
                  value={goals}
                  onChange={setGoals}
                  placeholder="π.χ. fades, θεωρία γεωμετρίας, στυλ…"
                  rows={3}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <TextAreaField
            label="Σημειώσεις (προαιρετικό)"
            value={notes}
            onChange={setNotes}
            placeholder="Οτιδήποτε άλλο θέλεις να μας πεις…"
            rows={2}
          />

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <input
              type="checkbox"
              checked={terms}
              onChange={(e) => setTerms(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 rounded border-white/30 bg-black accent-white"
            />
            <span className="text-sm leading-relaxed text-zinc-400">
              Διάβασα και αποδέχομαι τους{" "}
              <Link
                to="/terms"
                target="_blank"
                className="font-medium text-zinc-200 underline underline-offset-2 hover:text-white"
              >
                όρους χρήσης
              </Link>{" "}
              και την πολιτική ακύρωσης του σεμιναρίου.
            </span>
          </label>

          {error && (
            <p className="rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-sm text-red-300">
              {error}
            </p>
          )}

          <motion.button
            type="button"
            disabled={!valid || submitting}
            onClick={submit}
            whileHover={valid ? { scale: 1.02 } : undefined}
            whileTap={valid ? { scale: 0.98 } : undefined}
            className="group relative inline-flex w-full items-center justify-center gap-3 overflow-hidden rounded-full bg-gradient-to-b from-zinc-100 via-zinc-300 to-zinc-400 px-8 py-4 text-base font-semibold text-black shadow-[0_0_30px_rgba(255,255,255,0.25)] outline-none transition-opacity duration-300 before:absolute before:inset-y-0 before:-left-1/2 before:w-1/2 before:-skew-x-12 before:bg-white/70 before:blur-md before:transition-transform before:duration-700 enabled:hover:shadow-[0_0_60px_rgba(255,255,255,0.5)] enabled:hover:before:translate-x-[300%] focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
          >
            {submitting ? (
              <Loader2 className="relative size-5 animate-spin" />
            ) : (
              <>
                <span className="relative">Επιβεβαίωση κράτησης</span>
                <ArrowRight className="relative size-5 transition-transform duration-300 group-enabled:group-hover:translate-x-1" />
              </>
            )}
          </motion.button>
        </div>

        {/* Live summary card */}
        <BookingSummaryCard
          format={format}
          date={date}
          slot={slot}
          participants={participants}
          fullName={fullName}
          city={city}
        />
      </div>
    </div>
  );
}

function SummaryPill({
  format,
  date,
  slot,
  participants,
}: {
  format: SeminarFormat;
  date: string;
  slot: string;
  participants: number;
}) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-white/15 bg-black/60 px-4 py-1.5 text-xs text-zinc-300">
      <CalendarIcon className="size-3.5 text-zinc-500" />
      {fromISO(date).toLocaleDateString("el-GR", { day: "numeric", month: "short" })} · {slot}
      <span className="h-3 w-px bg-white/15" />
      {format === "group" ? `Group · ${participants}` : "Private"}
    </div>
  );
}

function BookingSummaryCard({
  format,
  date,
  slot,
  participants,
  fullName,
  city,
}: {
  format: SeminarFormat;
  date: string;
  slot: string;
  participants: number;
  fullName: string;
  city: string;
}) {
  return (
    <div className="relative h-fit overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-b from-zinc-900/90 to-black p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-white/[0.08] blur-[70px]"
      />
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
        Σύνοψη
      </p>
      <h3 className={`mt-2 text-xl font-bold ${chromeText}`}>
        {format === "group" ? "Group seminar" : "Private seminar"}
      </h3>
      <ul className="mt-5 space-y-3 text-sm text-zinc-300">
        <SummaryRow
          icon={CalendarIcon}
          label="Ημερομηνία"
          value={fromISO(date).toLocaleDateString("el-GR", {
            weekday: "short",
            day: "numeric",
            month: "long",
          })}
        />
        <SummaryRow icon={Clock} label="Ώρα" value={slot} />
        <SummaryRow
          icon={format === "group" ? Users : User}
          label="Συμμετέχοντες"
          value={format === "group" ? `${participants} άτομα` : "1 άτομο"}
        />
        {fullName && <SummaryRow icon={User} label="Όνομα" value={fullName} />}
        {city && <SummaryRow icon={MapPin} label="Πόλη" value={city} />}
      </ul>
    </div>
  );
}

function SummaryRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarIcon;
  label: string;
  value: string;
}) {
  return (
    <li className="flex items-center justify-between gap-3 border-b border-white/5 pb-3 last:border-0 last:pb-0">
      <span className="flex items-center gap-2 text-zinc-500">
        <Icon className="size-3.5" /> {label}
      </span>
      <span className="text-right font-medium text-zinc-200">{value}</span>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Form primitives                                                    */
/* ------------------------------------------------------------------ */

function Field({
  icon: Icon,
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  autoComplete,
}: {
  icon?: typeof User;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-black/60 px-3.5 py-2.5 transition-colors duration-200 focus-within:border-white/40 focus-within:ring-2 focus-within:ring-white/10">
        {Icon && <Icon className="size-4 shrink-0 text-zinc-500" />}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="w-full bg-transparent text-sm text-white placeholder:text-zinc-600 focus:outline-none"
        />
      </div>
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full resize-none rounded-xl border border-white/15 bg-black/60 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 transition-colors duration-200 focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/10"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-white/15 bg-black/60 px-3.5 py-2.5 text-sm text-white transition-colors duration-200 focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/10"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-zinc-900">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Step 4: Done                                                       */
/* ------------------------------------------------------------------ */

function DoneStep({
  reference,
  format,
  date,
  slot,
  participants,
  onRestart,
}: {
  reference: string;
  format: SeminarFormat;
  date: string;
  slot: string;
  participants: number;
  onRestart: () => void;
}) {
  return (
    <div className="flex flex-col items-center py-6 text-center">
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 18 }}
        className="relative flex size-20 items-center justify-center rounded-full border border-white/25 bg-black shadow-[0_0_40px_rgba(255,255,255,0.3)]"
      >
        <Check className="size-9 text-zinc-100" />
      </motion.div>

      <h2 className={`mt-6 text-2xl font-bold sm:text-3xl ${chromeText}`}>
        Η κράτηση καταχωρήθηκε!
      </h2>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-zinc-400">
        Θα λάβεις email επιβεβαίωσης μόλις ελέγξουμε τη διαθεσιμότητα. Κράτησε
        τον κωδικό σου για αναφορά.
      </p>

      <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-5 py-2 font-mono text-sm text-zinc-200">
        <ShieldCheck className="size-4 text-zinc-400" />
        {reference}
      </div>

      <div className="mt-8 grid w-full max-w-sm gap-2 rounded-2xl border border-white/10 bg-black/50 p-5 text-left text-sm">
        <SummaryRow
          icon={CalendarIcon}
          label="Ημερομηνία"
          value={fromISO(date).toLocaleDateString("el-GR", {
            day: "numeric",
            month: "long",
          })}
        />
        <SummaryRow icon={Clock} label="Ώρα" value={slot} />
        <SummaryRow
          icon={format === "group" ? Users : User}
          label="Format"
          value={format === "group" ? `Group · ${participants} άτομα` : "Private"}
        />
      </div>

      <button
        type="button"
        onClick={onRestart}
        className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-zinc-400 transition hover:text-white"
      >
        Κλείσε άλλο σεμινάριο <ArrowRight className="size-4" />
      </button>
    </div>
  );
}