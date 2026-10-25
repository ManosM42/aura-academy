import { useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { loadStripe } from "@stripe/stripe-js";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import {
  ArrowLeft,
  ArrowRight,
  Calendar as CalendarIcon,
  Check,
  Clock,
  Globe,
  Loader2,
  Mail,
  Phone,
  ShieldCheck,
  User,
  Users,
  Video,
  X,
} from "lucide-react";
import { useAsync } from "@/lib/useAsync";
import { ErrorState, LoadingSkeleton } from "@/components/aura/States";
import {
  formatPrice,
  getPublicOnlineSeminars,
  startOnlineCheckout,
  waitForPaid,
  type PublicOnlineSeminar,
} from "@/lib/onlineSeminars";

export const Route = createFileRoute("/online-seminars")({ component: OnlineSeminarsRoute });

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string);

const chromeText = "bg-gradient-to-b from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent";
const shimmerBtn =
  "group relative inline-flex items-center justify-center gap-3 overflow-hidden rounded-full bg-gradient-to-b from-zinc-100 via-zinc-300 to-zinc-400 px-7 py-3.5 text-sm font-semibold text-black shadow-[0_0_30px_rgba(255,255,255,0.25)] outline-none transition-shadow duration-300 before:absolute before:inset-y-0 before:-left-1/2 before:w-1/2 before:-skew-x-12 before:bg-white/70 before:blur-md before:transition-transform before:duration-700 enabled:hover:shadow-[0_0_60px_rgba(255,255,255,0.5)] enabled:hover:before:translate-x-[300%] focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:cursor-not-allowed disabled:opacity-40";

function OnlineSeminarsRoute() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const glowY = useTransform(scrollYProgress, [0, 1], [-60, 140]);
  const ringRotate = useTransform(scrollYProgress, [0, 1], [0, 80]);

  const [reload, setReload] = useState(0);
  const { data, error, loading } = useAsync(getPublicOnlineSeminars, [reload]);
  const [selected, setSelected] = useState<PublicOnlineSeminar | null>(null);

  return (
    <main ref={ref} className="relative min-h-screen overflow-hidden bg-black pb-24 pt-28 text-white selection:bg-white selection:text-black">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-60 [background-image:linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)] [-webkit-mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]"
      />
      <motion.div aria-hidden style={{ y: glowY }} className="pointer-events-none absolute -right-40 top-20 -z-10 h-[520px] w-[520px] rounded-full bg-white/[0.06] blur-[140px]" />
      <motion.div aria-hidden style={{ rotate: ringRotate }} className="pointer-events-none absolute -left-44 top-64 -z-10 h-[480px] w-[480px] rounded-full border border-dashed border-white/10" />
      <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 md:px-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
          <Link to="/seminars" className="mb-6 inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition hover:text-white">
            <ArrowLeft className="size-3.5" /> Σεμινάρια επί τόπου
          </Link>
          <div className="mb-4 flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-white/50">
            <span className="h-px w-10 bg-gradient-to-r from-white/60 to-transparent" />
            Online σεμινάρια
          </div>
          <h1 className={`text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl ${chromeText}`}>
            Μάθε από οπουδήποτε.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg">
            Live online σεμινάρια με τον Theopistos. Κλείσε τη θέση σου, πλήρωσε με ασφάλεια και θα
            επικοινωνήσουμε μαζί σου με όλες τις λεπτομέρειες.
          </p>
        </motion.div>

        <div className="mt-12">
          {loading && <LoadingSkeleton rows={3} />}
          {error && <ErrorState message={error} />}

          {data && data.length === 0 && (
            <div className="rounded-3xl border border-white/10 bg-zinc-950/70 p-12 text-center">
              <Globe className="mx-auto size-8 text-zinc-500" />
              <p className="mt-4 text-zinc-400">Δεν υπάρχουν προγραμματισμένα online σεμινάρια αυτή τη στιγμή.</p>
              <p className="mt-1 text-sm text-zinc-600">Ξανάλεγξε σύντομα.</p>
            </div>
          )}

          {data && data.length > 0 && (
            <div className="grid gap-6 md:grid-cols-2">
              {data.map((s, i) => (
                <SeminarCard key={s.id} s={s} index={i} reduce={!!reduce} onBook={() => setSelected(s)} />
              ))}
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {selected && (
          <BookingModal
            seminar={selected}
            onClose={() => {
              setSelected(null);
              setReload((n) => n + 1);
            }}
          />
        )}
      </AnimatePresence>
    </main>
  );
}

function SeminarCard({ s, index, reduce, onBook }: { s: PublicOnlineSeminar; index: number; reduce: boolean; onBook: () => void }) {
  const left = s.capacity ? s.capacity - s.taken : null;
  const soldOut = left !== null && left <= 0;
  const date = new Date(s.starts_at);

  return (
    <motion.article
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
      whileHover={reduce ? undefined : { y: -6 }}
      className="group relative flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-zinc-900/80 to-black/90 p-7 shadow-[0_24px_60px_-28px_rgba(0,0,0,0.95)] transition-colors duration-300 hover:border-white/35"
    >
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-white/[0.07] blur-[70px] transition-opacity duration-500 group-hover:opacity-100" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

      <div className="relative flex items-start justify-between gap-4">
        <div className="flex size-12 items-center justify-center rounded-xl border border-white/15 bg-black/60 text-zinc-200 transition-all duration-300 group-hover:-rotate-6 group-hover:scale-110 group-hover:border-white/50 group-hover:text-white group-hover:shadow-[0_0_24px_rgba(255,255,255,0.35)]">
          <Video className="size-6" />
        </div>
        <span className={`bg-clip-text text-2xl font-extrabold text-transparent bg-gradient-to-b from-white to-zinc-400`}>
          {formatPrice(s.price_cents, s.currency)}
        </span>
      </div>

      <h2 className={`relative mt-5 text-2xl font-bold ${chromeText}`}>{s.title}</h2>
      {s.description && <p className="relative mt-3 line-clamp-4 text-sm leading-relaxed text-zinc-400">{s.description}</p>}

      <ul className="relative mt-5 space-y-2 text-sm text-zinc-300">
        <li className="flex items-center gap-2"><CalendarIcon className="size-4 text-zinc-500" />
          {date.toLocaleDateString("el-GR", { weekday: "long", day: "numeric", month: "long" })}
        </li>
        <li className="flex items-center gap-2"><Clock className="size-4 text-zinc-500" />
          {date.toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit" })} · {s.duration_minutes} λεπτά
        </li>
        {left !== null && (
          <li className={`flex items-center gap-2 ${left <= 3 && !soldOut ? "text-amber-400" : ""}`}>
            <Users className="size-4 text-zinc-500" />
            {soldOut ? "Sold out" : `${left} θέσεις διαθέσιμες`}
          </li>
        )}
      </ul>

      <div className="relative mt-7">
        <button type="button" disabled={soldOut} onClick={onBook} className={shimmerBtn}>
          <span className="relative">{soldOut ? "Γεμάτο" : "Κλείσε θέση"}</span>
          <ArrowRight className="relative size-4 transition-transform duration-300 group-enabled:group-hover:translate-x-1" />
        </button>
      </div>
    </motion.article>
  );
}

/* ------------------------------------------------------------------ */
/* Booking modal: details -> Stripe checkout -> confirmation          */
/* ------------------------------------------------------------------ */

type Stage = "details" | "pay" | "verifying" | "done";

function BookingModal({ seminar, onClose }: { seminar: PublicOnlineSeminar; onClose: () => void }) {
  const [stage, setStage] = useState<Stage>("details");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(true);

  const valid =
    fullName.trim().length >= 2 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) && phone.trim().length >= 6;

  async function toPayment() {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { clientSecret, sessionId } = await startOnlineCheckout({ seminarId: seminar.id, fullName, email, phone });
      setSecret(clientSecret);
      sessionRef.current = sessionId;
      setStage("pay");
    } catch (e) {
      setError(
        e instanceof Error && e.message === "sold_out"
          ? "Δυστυχώς οι θέσεις εξαντλήθηκαν."
          : "Κάτι πήγε στραβά. Δοκίμασε ξανά σε λίγο.",
      );
    } finally {
      setBusy(false);
    }
  }

  const sessionRef = useRef<string>("");

  async function onComplete() {
    setStage("verifying");
    setConfirmed(await waitForPaid(sessionRef.current));
    setStage("done");
  }

  const inputWrap =
    "flex items-center gap-2 rounded-xl border border-white/15 bg-black/60 px-3.5 py-2.5 transition-colors focus-within:border-white/40 focus-within:ring-2 focus-within:ring-white/10";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/85 p-4 backdrop-blur-md"
      onClick={stage === "details" || stage === "done" ? onClose : undefined}
    >
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30, scale: 0.97 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="relative my-auto w-full max-w-lg overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-br from-zinc-900 via-black to-zinc-950 p-6 shadow-[0_0_100px_-30px_rgba(255,255,255,0.3)] sm:p-8"
      >
        <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-white/[0.07] blur-[80px]" />
        {stage !== "verifying" && (
          <button type="button" onClick={onClose} aria-label="Κλείσιμο" className="absolute right-4 top-4 z-10 text-zinc-500 transition hover:text-white">
            <X className="size-5" />
          </button>
        )}

        <div className="relative">
          <AnimatePresence mode="wait">
            {stage === "details" && (
              <motion.div key="d" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">Κράτηση θέσης</p>
                <h3 className={`mt-2 text-2xl font-bold ${chromeText}`}>{seminar.title}</h3>
                <p className="mt-1 text-sm text-zinc-400">
                  {new Date(seminar.starts_at).toLocaleString("el-GR", { dateStyle: "long", timeStyle: "short" })} ·{" "}
                  {formatPrice(seminar.price_cents, seminar.currency)}
                </p>

                <div className="mt-6 space-y-4">
                  {[
                    { icon: User, label: "Ονοματεπώνυμο", v: fullName, set: setFullName, type: "text", ac: "name" },
                    { icon: Mail, label: "Email", v: email, set: setEmail, type: "email", ac: "email" },
                    { icon: Phone, label: "Τηλέφωνο", v: phone, set: setPhone, type: "tel", ac: "tel" },
                  ].map((f) => (
                    <label key={f.label} className="block">
                      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">{f.label}</span>
                      <div className={inputWrap}>
                        <f.icon className="size-4 shrink-0 text-zinc-500" />
                        <input
                          type={f.type}
                          value={f.v}
                          autoComplete={f.ac}
                          onChange={(e) => f.set(e.target.value)}
                          className="w-full bg-transparent text-sm text-white placeholder:text-zinc-600 focus:outline-none"
                        />
                      </div>
                    </label>
                  ))}
                </div>

                {error && <p className="mt-4 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-sm text-red-300">{error}</p>}

                <button type="button" disabled={!valid || busy} onClick={toPayment} className={`${shimmerBtn} mt-6 w-full`}>
                  {busy ? <Loader2 className="relative size-5 animate-spin" /> : (
                    <>
                      <span className="relative">Συνέχεια στην πληρωμή</span>
                      <ArrowRight className="relative size-4" />
                    </>
                  )}
                </button>
                <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-zinc-600">
                  <ShieldCheck className="size-3.5" /> Ασφαλής πληρωμή μέσω Stripe
                </p>
              </motion.div>
            )}

            {stage === "pay" && secret && (
              <motion.div key="p" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <button type="button" onClick={() => setStage("details")} className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition hover:text-white">
                  <ArrowLeft className="size-3.5" /> Πίσω
                </button>
                <div className="overflow-hidden rounded-2xl bg-white">
                  <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret: secret, onComplete }}>
                    <EmbeddedCheckout />
                  </EmbeddedCheckoutProvider>
                </div>
              </motion.div>
            )}

            {stage === "verifying" && (
              <motion.div key="v" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center py-14 text-center">
                <Loader2 className="size-10 animate-spin text-zinc-300" />
                <p className="mt-5 text-zinc-300">Επιβεβαίωση πληρωμής…</p>
              </motion.div>
            )}

            {stage === "done" && (
              <motion.div key="x" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-6 text-center">
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 18 }}
                  className="flex size-20 items-center justify-center rounded-full border border-white/25 bg-black shadow-[0_0_40px_rgba(255,255,255,0.3)]"
                >
                  <Check className="size-9 text-zinc-100" />
                </motion.div>
                <h3 className={`mt-6 text-2xl font-bold ${chromeText}`}>
                  {confirmed ? "Η πληρωμή ολοκληρώθηκε!" : "Λάβαμε την πληρωμή σου!"}
                </h3>
                <p className="mt-3 max-w-sm text-sm leading-relaxed text-zinc-400">
                  Ο διαχειριστής θα επικοινωνήσει σύντομα μαζί σου στο <span className="text-zinc-200">{email}</span> με
                  όλες τις πληροφορίες για το σεμινάριο.
                  {!confirmed && " Η επιβεβαίωση μπορεί να διαρκέσει λίγα λεπτά."}
                </p>
                <button type="button" onClick={onClose} className={`${shimmerBtn} mt-7`}>
                  <span className="relative">Τέλεια</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}