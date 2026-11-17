// src/routes/online-seminars.tsx
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from "motion/react";
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
import { DiscountedPrice, MemberBadge, SavingsLine } from "@/components/aura/DiscountPrice";
import SeminarMemberPopup from "@/components/aura/promo/SeminarMemberPopup";
import { applyPercent, usePlanDiscountTable, useMyDiscounts } from "@/lib/discounts";
import { useGuestPromo } from "@/lib/useGuestPromo";
import type { PlanId } from "@/lib/plans";
import {
  formatPrice,
  getPublicOnlineSeminars,
  startOnlineCheckout,
  waitForPaid,
  type OnlineCheckoutResult,
  type PublicOnlineSeminar,
} from "@/lib/onlineSeminars";

export const Route = createFileRoute("/online-seminars")({
  component: OnlineSeminarsRoute,
  // ?book=<seminarId> ανοίγει κατευθείαν την κράτηση (το χρησιμοποιεί το AURA AI)
  validateSearch: (s: Record<string, unknown>): { book?: string } => ({
    book: typeof s.book === "string" && s.book ? s.book : undefined,
  }),
});

const chromeText = "bg-gradient-to-b from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent";
const shimmerBtn =
  "group relative inline-flex items-center justify-center gap-3 overflow-hidden rounded-full bg-gradient-to-b from-zinc-100 via-zinc-300 to-zinc-400 px-7 py-3.5 text-sm font-semibold text-black shadow-[0_0_30px_rgba(255,255,255,0.25)] outline-none transition-shadow duration-300 before:absolute before:inset-y-0 before:-left-1/2 before:w-1/2 before:-skew-x-12 before:bg-white/70 before:blur-md before:transition-transform before:duration-700 enabled:hover:shadow-[0_0_60px_rgba(255,255,255,0.5)] enabled:hover:before:translate-x-[300%] focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:cursor-not-allowed disabled:opacity-40";

/* ------------------------------------------------------------------ */
/* Εκκρεμής κράτηση: θυμόμαστε το bookingId όσο ο χρήστης είναι στο Viva */
/* ------------------------------------------------------------------ */

const PENDING_KEY = "aura-pending-online-booking";
const PENDING_TTL_MS = 2 * 60 * 60 * 1000;
type Pending = { bookingId: string; title: string; email: string; at: number };

function readPending(): Pending | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Pending;
    if (!p?.bookingId || Date.now() - p.at > PENDING_TTL_MS) {
      localStorage.removeItem(PENDING_KEY);
      return null;
    }
    return p;
  } catch {
    return null;
  }
}
function writePending(p: Pending) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(p));
  } catch {
    /* ιδιωτική περιήγηση: η πληρωμή συνεχίζει κανονικά */
  }
}
function clearPending() {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function OnlineSeminarsRoute() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const glowY = useTransform(scrollYProgress, [0, 1], [-60, 140]);
  const ringRotate = useTransform(scrollYProgress, [0, 1], [0, 80]);

  const { book } = Route.useSearch();
  const navigate = Route.useNavigate();

  const [reload, setReload] = useState(0);
  const { data, error, loading } = useAsync(getPublicOnlineSeminars, [reload]);
  const [selected, setSelected] = useState<PublicOnlineSeminar | null>(null);
  const [returning, setReturning] = useState<{ pending: Pending; long: boolean } | null>(null);

  // Member discount (only plans that have one in public.plan_discounts, i.e. ELITE).
  const { plan: planId, seminarPercent } = useMyDiscounts();
  // Visitors who are not signed in get a "members save" pop-up (timer, or when they press Book).
  const discountTable = usePlanDiscountTable();
  const promo = useGuestPromo({
    storageKey: "aura-seminar-member-promo",
    delayMs: 9000,
    enabled: discountTable.high.online_seminar > 0 || discountTable.mid.online_seminar > 0,
    paused: selected !== null || returning !== null,
  });

  // Επιστροφή από το Viva: αν υπάρχει εκκρεμής κράτηση, έλεγξε αν πληρώθηκε.
  useEffect(() => {
    const pending = readPending();
    if (!pending) return;
    const q = new URLSearchParams(window.location.search);
    // Το Viva προσθέτει παραμέτρους στο URL επιστροφής. Αν υπάρχουν, περιμένουμε το webhook.
    const long = ["t", "s", "eventId", "eci", "paid", "return"].some((k) => q.has(k));
    setReturning({ pending, long });
  }, []);

  // Άνοιγμα κράτησης από σύνδεσμο (?book=...), μία φορά
  const autoOpened = useRef(false);
  useEffect(() => {
    if (autoOpened.current || !book || !data) return;
    const match = data.find((s) => s.id === book);
    autoOpened.current = true;
    if (match) setSelected(match);
    void navigate({ search: {}, replace: true });
  }, [book, data, navigate]);

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
                <SeminarCard
                  key={s.id}
                  s={s}
                  index={i}
                  reduce={!!reduce}
                  percent={seminarPercent}
                  planId={planId}
                  onBook={() => promo.guard(() => setSelected(s))}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <SeminarMemberPopup open={promo.open} onClose={promo.close} canContinue={promo.canContinue} />

      <AnimatePresence>
        {selected && (
          <BookingModal
            key="booking"
            seminar={selected}
            percent={seminarPercent}
            planId={planId}
            onClose={() => {
              setSelected(null);
              setReload((n) => n + 1);
            }}
          />
        )}
        {returning && (
          <PaymentReturnModal
            key="return"
            pending={returning.pending}
            long={returning.long}
            onClose={() => {
              setReturning(null);
              setReload((n) => n + 1);
            }}
          />
        )}
      </AnimatePresence>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

function SeminarCard({
  s,
  index,
  reduce,
  percent,
  planId,
  onBook,
}: {
  s: PublicOnlineSeminar;
  index: number;
  reduce: boolean;
  percent: number;
  planId: PlanId | null;
  onBook: () => void;
}) {
  const memberPrice = applyPercent(s.price_cents, percent);
  const discounted = percent > 0 && memberPrice < s.price_cents;
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
        {discounted ? (
          <div className="flex flex-col items-end gap-2.5">
            <MemberBadge planId={planId} percent={percent} />
            <DiscountedPrice
              listCents={s.price_cents}
              finalCents={memberPrice}
              format={(c) => formatPrice(c, s.currency)}
              size="md"
            />
          </div>
        ) : (
          <span className="bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-2xl font-extrabold text-transparent">
            {formatPrice(s.price_cents, s.currency)}
          </span>
        )}
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
/* Κοινό κέλυφος modal                                                  */
/* ------------------------------------------------------------------ */

function ModalShell({
  children,
  onClose,
  closable = true,
}: {
  children: ReactNode;
  onClose: () => void;
  closable?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/85 p-4 backdrop-blur-md"
      onClick={closable ? onClose : undefined}
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
        {closable && (
          <button type="button" onClick={onClose} aria-label="Κλείσιμο" className="absolute right-4 top-4 z-10 text-zinc-500 transition hover:text-white">
            <X className="size-5" />
          </button>
        )}
        <div className="relative">{children}</div>
      </motion.div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Booking modal: στοιχεία -> επιβεβαίωση τιμής -> μεταφορά στο Viva     */
/* ------------------------------------------------------------------ */

type Stage = "details" | "confirm";

function BookingModal({
  seminar,
  percent,
  planId,
  onClose,
}: {
  seminar: PublicOnlineSeminar;
  percent: number;
  planId: PlanId | null;
  onClose: () => void;
}) {
  const [stage, setStage] = useState<Stage>("details");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkout, setCheckout] = useState<OnlineCheckoutResult | null>(null);

  // Η τιμή που θα χρεώσει ΠΡΑΓΜΑΤΙΚΑ ο server (επιστρέφεται από το checkout).
  // Μέχρι να την έχουμε, δείχνουμε την τιμή με βάση την έκπτωση μέλους.
  const shownPercent = checkout ? checkout.discountPercent : percent;
  const shownList = checkout ? checkout.listPriceCents : seminar.price_cents;
  const shownFinal = checkout ? checkout.amountCents : applyPercent(seminar.price_cents, percent);
  const hasDiscount = shownPercent > 0 && shownFinal < shownList;
  const fmt = (c: number) => formatPrice(c, seminar.currency);

  const valid =
    fullName.trim().length >= 2 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) && phone.trim().length >= 6;

  async function toPayment() {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await startOnlineCheckout({ seminarId: seminar.id, fullName, email, phone });
      setCheckout(res);
      setStage("confirm");
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      setError(
        code === "sold_out"
          ? "Δυστυχώς οι θέσεις εξαντλήθηκαν."
          : code === "network_error"
            ? "Πρόβλημα σύνδεσης. Έλεγξε το internet σου και δοκίμασε ξανά."
            : "Κάτι πήγε στραβά. Δοκίμασε ξανά σε λίγο.",
      );
    } finally {
      setBusy(false);
    }
  }

  function goToViva() {
    if (!checkout || redirecting) return;
    setRedirecting(true);
    // Θυμόμαστε την κράτηση: όταν ο χρήστης γυρίσει από το Viva, θα την ελέγξουμε.
    writePending({ bookingId: checkout.bookingId, title: seminar.title, email: email.trim(), at: Date.now() });
    window.location.assign(checkout.redirectUrl);
  }

  const inputWrap =
    "flex items-center gap-2 rounded-xl border border-white/15 bg-black/60 px-3.5 py-2.5 transition-colors focus-within:border-white/40 focus-within:ring-2 focus-within:ring-white/10";

  return (
    <ModalShell onClose={onClose} closable={!redirecting}>
      <AnimatePresence mode="wait">
        {stage === "details" && (
          <motion.div key="d" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">Κράτηση θέσης</p>
            <h3 className={`mt-2 text-2xl font-bold ${chromeText}`}>{seminar.title}</h3>
            <p className="mt-1 text-sm text-zinc-400">
              {new Date(seminar.starts_at).toLocaleString("el-GR", { dateStyle: "long", timeStyle: "short" })}
              {!hasDiscount && ` · ${fmt(seminar.price_cents)}`}
            </p>

            {hasDiscount && (
              <div className="mt-5 rounded-2xl border border-white/20 bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-4 shadow-[0_0_40px_-18px_rgba(255,255,255,0.5)]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <MemberBadge planId={planId} percent={shownPercent} />
                  <DiscountedPrice listCents={shownList} finalCents={shownFinal} format={fmt} layout="inline" size="md" />
                </div>
                <SavingsLine className="mt-3" label="Κερδίζεις" amount={fmt(shownList - shownFinal)} />
              </div>
            )}

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
              <ShieldCheck className="size-3.5" /> Ασφαλής πληρωμή μέσω Viva
            </p>
          </motion.div>
        )}

        {stage === "confirm" && checkout && (
          <motion.div key="c" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <button
              type="button"
              disabled={redirecting}
              onClick={() => setStage("details")}
              className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition hover:text-white disabled:opacity-40"
            >
              <ArrowLeft className="size-3.5" /> Πίσω
            </button>

            <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">Σύνοψη κράτησης</p>
            <h3 className={`mt-2 text-2xl font-bold ${chromeText}`}>{seminar.title}</h3>
            <p className="mt-1 text-sm text-zinc-400">
              {new Date(seminar.starts_at).toLocaleString("el-GR", { dateStyle: "long", timeStyle: "short" })}
            </p>

            <div className="mt-5 flex items-center justify-between gap-4 rounded-2xl border border-white/15 bg-white/[0.03] px-4 py-3">
              <div className="min-w-0">
                {hasDiscount ? (
                  <div className="flex flex-col items-start gap-1.5">
                    <MemberBadge planId={planId} percent={shownPercent} />
                    <SavingsLine label="Κερδίζεις" amount={fmt(shownList - shownFinal)} />
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500">Σύνολο πληρωμής</p>
                )}
              </div>
              <DiscountedPrice listCents={shownList} finalCents={shownFinal} format={fmt} size="md" />
            </div>

            <p className="mt-4 text-xs leading-relaxed text-zinc-500">
              Θα μεταφερθείς στην ασφαλή σελίδα πληρωμής του Viva. Μετά την πληρωμή θα επιστρέψεις εδώ για την επιβεβαίωση.
            </p>

            <button type="button" disabled={redirecting} onClick={goToViva} className={`${shimmerBtn} mt-6 w-full`}>
              {redirecting ? (
                <Loader2 className="relative size-5 animate-spin" />
              ) : (
                <>
                  <span className="relative">Πληρωμή {fmt(shownFinal)}</span>
                  <ArrowRight className="relative size-4" />
                </>
              )}
            </button>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-zinc-600">
              <ShieldCheck className="size-3.5" /> Ασφαλής πληρωμή μέσω Viva
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </ModalShell>
  );
}

/* ------------------------------------------------------------------ */
/* Επιστροφή από το Viva: έλεγχος πληρωμής -> επιβεβαίωση               */
/* ------------------------------------------------------------------ */

type ReturnStage = "verifying" | "paid" | "unconfirmed";

function PaymentReturnModal({
  pending,
  long,
  onClose,
}: {
  pending: Pending;
  long: boolean;
  onClose: () => void;
}) {
  const [stage, setStage] = useState<ReturnStage>("verifying");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setStage("verifying");

    void (async () => {
      let paid = false;
      try {
        // Με παραμέτρους Viva περιμένουμε το webhook (έως ~40s). Αλλιώς ένας γρήγορος έλεγχος.
        paid = await waitForPaid(pending.bookingId, long || attempt > 0 ? 20 : 1, 2000);
      } catch {
        paid = false;
      }
      if (!alive) return;
      if (paid) {
        clearPending();
        setStage("paid");
      } else if (long || attempt > 0) {
        setStage("unconfirmed");
      } else {
        // Γύρισε χωρίς να πληρώσει (π.χ. πάτησε πίσω): δεν δείχνουμε τίποτα.
        onClose();
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  return (
    <ModalShell onClose={onClose} closable={stage !== "verifying"}>
      <AnimatePresence mode="wait">
        {stage === "verifying" && (
          <motion.div key="v" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center py-14 text-center">
            <Loader2 className="size-10 animate-spin text-zinc-300" />
            <p className="mt-5 text-zinc-300">Επιβεβαίωση πληρωμής…</p>
          </motion.div>
        )}

        {stage === "paid" && (
          <motion.div key="p" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-6 text-center">
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 18 }}
              className="flex size-20 items-center justify-center rounded-full border border-white/25 bg-black shadow-[0_0_40px_rgba(255,255,255,0.3)]"
            >
              <Check className="size-9 text-zinc-100" />
            </motion.div>
            <h3 className={`mt-6 text-2xl font-bold ${chromeText}`}>Η πληρωμή ολοκληρώθηκε!</h3>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-zinc-400">
              Η θέση σου για «{pending.title}» κρατήθηκε. Ο διαχειριστής θα επικοινωνήσει σύντομα μαζί σου στο{" "}
              <span className="text-zinc-200">{pending.email}</span> με όλες τις πληροφορίες για το σεμινάριο.
            </p>
            <button type="button" onClick={onClose} className={`${shimmerBtn} mt-7`}>
              <span className="relative">Τέλεια</span>
            </button>
          </motion.div>
        )}

        {stage === "unconfirmed" && (
          <motion.div key="u" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-6 text-center">
            <div className="flex size-20 items-center justify-center rounded-full border border-white/25 bg-black">
              <Clock className="size-9 text-zinc-300" />
            </div>
            <h3 className={`mt-6 text-2xl font-bold ${chromeText}`}>Δεν επιβεβαιώθηκε ακόμη</h3>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-zinc-400">
              Δεν λάβαμε ακόμη την επιβεβαίωση της πληρωμής για «{pending.title}». Αν η πληρωμή ολοκληρώθηκε, η
              επιβεβαίωση μπορεί να διαρκέσει λίγα λεπτά και θα επικοινωνήσουμε μαζί σου στο{" "}
              <span className="text-zinc-200">{pending.email}</span>. Αν δεν ολοκληρώθηκε, μπορείς να ξαναπροσπαθήσεις.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <button type="button" onClick={() => setAttempt((n) => n + 1)} className={shimmerBtn}>
                <span className="relative">Έλεγχος ξανά</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  clearPending();
                  onClose();
                }}
                className="text-sm text-zinc-500 transition hover:text-white"
              >
                Κλείσιμο
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </ModalShell>
  );
}