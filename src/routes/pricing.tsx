// src/routes/pricing.tsx
import { useRef, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { Check, ShieldCheck, Undo2, X, Zap } from "lucide-react";
import ChromeButton from "@/components/aura/ChromeButton";
import ChromeCursor from "@/components/aura/ChromeCursor";
import PricingCards from "@/components/aura/PricingCards";
import { AURA_PLANS } from "@/lib/plans";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/pricing")({
  head: () =>
    seo({
      title: "Πλάνα & Τιμές",
      description:
        "AURA Basic, Pro και Elite: τρία επίπεδα εκπαίδευσης για barbers. Videos, Certification, αξιολογήσεις και κοινότητα. Ακύρωση ανά πάσα στιγμή.",
      path: "/pricing",
    }),
  component: PricingPage,
});

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 44, filter: "blur(8px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={{ duration: 0.95, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

/* ---------------- comparison data ---------------- */

type Cell = boolean | string;
interface Row { label: string; values: [Cell, Cell, Cell] }

const GROUPS: { title: string; rows: Row[] }[] = [
  {
    title: "Εκπαίδευση",
    rows: [
      { label: "Μηνιαία εκπαιδευτικά videos", values: [true, true, true] },
      { label: "Προχωρημένα videos κουρεμάτων", values: [false, true, true] },
      { label: "Αποκλειστικά ELITE μαθήματα", values: [false, false, true] },
      { label: "AURA Certification", values: [false, true, true] },
      { label: "AURA Elite Challenges", values: [false, false, true] },
      { label: "Early Access σε νέα videos", values: [false, false, true] },
    ],
  },
  {
    title: "Αξιολόγηση & εξέλιξη",
    rows: [
      { label: "Review System", values: [true, true, true] },
      { label: "Προσωπικό AURA Portfolio", values: [false, false, true] },
      { label: "Προσωπική αξιολόγηση από εκπαιδευτή", values: [false, false, "Έως 4 / μήνα"] },
      { label: "Αναλυτικό feedback & προτάσεις", values: [false, false, true] },
      { label: "Personal Progress Tracking", values: [false, false, true] },
    ],
  },
  {
    title: "Κοινότητα & καριέρα",
    rows: [
      { label: "AURA Social Access", values: [true, true, true] },
      { label: "AURA Find Job", values: [true, true, true] },
      { label: "Ιδιωτική κοινότητα ELITE", values: [false, false, true] },
      { label: "VIP Community Status", values: [false, false, true] },
      { label: "Δημοσίευση εργασιών στην Ακαδημία", values: [false, false, true] },
      { label: "Προτεραιότητα στο Support", values: [false, false, true] },
    ],
  },
  {
    title: "Εκπτώσεις",
    rows: [
      { label: "E-book AURA Professional Hair Method", values: [false, "50%", "50%"] },
      { label: "Φυσικό AURA Hair Method Book", values: [false, "25%", "50%"] },
      { label: "AURA Online Seminars", values: [false, false, "25%"] },
      { label: "Προϊόντα FORZA BRAVA", values: [false, "10%", "10%"] },
    ],
  },
  {
    title: "Ευελιξία",
    rows: [{ label: "Ακύρωση ανά πάσα στιγμή", values: [true, true, true] }],
  },
];

function CellView({ v }: { v: Cell }) {
  if (v === true)
    return (
      <span className="pp-tick" role="img" aria-label="Περιλαμβάνεται">
        <Check className="size-3.5" strokeWidth={3} />
      </span>
    );
  if (v === false)
    return (
      <span className="pp-cross" role="img" aria-label="Δεν περιλαμβάνεται">
        <X className="size-3.5" />
      </span>
    );
  return <span className="pp-val">{v}</span>;
}

const FAQ = [
  {
    q: "Μπορώ να ακυρώσω τη συνδρομή μου;",
    a: "Ναι. Όλα τα πλάνα έχουν δυνατότητα ακύρωσης ανά πάσα στιγμή, χωρίς δέσμευση.",
  },
  {
    q: "Πώς γίνεται η χρέωση;",
    a: "Η συνδρομή είναι μηνιαία και η πληρωμή γίνεται με ασφάλεια μέσω Stripe. Ξεκινάς από τη σελίδα checkout αφού συνδεθείς.",
  },
  {
    q: "Σε ποιες εκπτώσεις έχω πρόσβαση;",
    a: "Το PRO δίνει 50% στο E-book, 25% στο φυσικό βιβλίο και 10% στα FORZA BRAVA. Το ELITE προσθέτει 50% στο φυσικό βιβλίο και 25% στα Online Seminars.",
  },
  {
  q: "Μπορώ να αναβαθμίσω το πλάνο μου;",
  a: "Ναι. Πληρώνεις μόνο τη διαφορά από το τρέχον πλάνο σου και από εκείνη τη μέρα η συνδρομή ανανεώνεται κάθε μήνα με τη νέα τιμή.",
},
];

/* ---------------- hero ---------------- */

function Hero() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 140]);
  const opacity = useTransform(scrollYProgress, [0, 0.9], [1, 0]);

  return (
    <section ref={ref} className="relative px-5 pb-20 pt-10 text-center sm:pb-28">
      <div className="pp-ring" aria-hidden />
      <motion.div style={{ y, opacity }} className="relative mx-auto max-w-3xl">
        <motion.span
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE }}
          className="chrome-text text-[11px] font-semibold uppercase tracking-[0.5em]"
        >
          Aura Academy · Πλάνα
        </motion.span>
        <motion.h1
          initial={{ opacity: 0, y: 28, filter: "blur(10px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 1.1, ease: EASE, delay: 0.15 }}
          className="pp-title mt-6 text-4xl font-bold tracking-tight sm:text-6xl"
        >
          Διάλεξε το επίπεδό σου
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: EASE, delay: 0.35 }}
          className="mx-auto mt-6 max-w-xl text-sm leading-relaxed text-white/55 sm:text-base"
        >
          Τρία επίπεδα εκπαίδευσης για barbers που θέλουν να εξελιχθούν. Ξεκίνα από εκεί που
          σου ταιριάζει και ακύρωσε ανά πάσα στιγμή.
        </motion.p>
      </motion.div>
    </section>
  );
}

/* ---------------- page ---------------- */

function PricingPage() {
  const reduce = useReducedMotion();

  return (
    <div className="pp-root relative min-h-screen w-full overflow-x-clip bg-aura-bg pt-28 text-white sm:pt-32">
      <style>{css}</style>
      <div className="aura-grain" aria-hidden />
      <ChromeCursor />
      <div className="hero-atmosphere absolute inset-0" aria-hidden />
      <div className="pp-grid absolute inset-0" aria-hidden />
      {!reduce && (
        <>
          <motion.div className="pp-orb left-[4%] top-[8%] h-80 w-80" animate={{ y: [0, -34, 0], x: [0, 18, 0] }} transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }} aria-hidden />
          <motion.div className="pp-orb right-[3%] top-[48%] h-[26rem] w-[26rem]" animate={{ y: [0, 30, 0], x: [0, -22, 0] }} transition={{ duration: 19, repeat: Infinity, ease: "easeInOut" }} aria-hidden />
        </>
      )}

      <div className="relative z-10">
        <Hero />

        {/* plans */}
        <section id="plans" className="mx-auto max-w-6xl scroll-mt-28 px-5 pb-24 sm:px-8">
          <PricingCards />
        </section>

        {/* trust strip */}
        <section className="mx-auto max-w-5xl px-5 pb-28 sm:px-8">
          <Reveal>
            <div className="pp-trust grid gap-px overflow-hidden rounded-2xl sm:grid-cols-3">
              {[
                { icon: Undo2, t: "Ακύρωση ανά πάσα στιγμή", d: "Χωρίς δέσμευση και χωρίς κρυφές χρεώσεις." },
                { icon: ShieldCheck, t: "Ασφαλής πληρωμή", d: "Οι πληρωμές γίνονται μέσω Stripe." },
                { icon: Zap, t: "Γρήγορη έναρξη", d: "Πρόσβαση μόλις ολοκληρωθεί η πληρωμή." },
              ].map(({ icon: Icon, t, d }) => (
                <div key={t} className="pp-trust-item flex flex-col items-center gap-3 px-6 py-8 text-center">
                  <span className="pp-icon"><Icon className="size-5 text-white/85" /></span>
                  <h3 className="text-sm font-semibold tracking-wide">{t}</h3>
                  <p className="text-xs leading-relaxed text-white/50">{d}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </section>

        {/* comparison */}
        <section className="mx-auto max-w-5xl px-5 pb-28 sm:px-8" aria-labelledby="compare-title">
          <Reveal>
            <div className="mb-10 text-center">
              <span className="chrome-text text-[11px] font-semibold uppercase tracking-[0.5em]">Σύγκριση</span>
              <h2 id="compare-title" className="pp-title mt-4 text-3xl font-bold tracking-tight sm:text-5xl">
                Τι περιλαμβάνει το κάθε πλάνο
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-sm text-white/50">
                Δες με μια ματιά τι κερδίζεις σε κάθε επίπεδο.
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="pp-table-wrap">
              <table className="pp-table w-full min-w-[680px] border-collapse text-left">
                <caption className="sr-only">Σύγκριση των πλάνων AURA Basic, Pro και Elite</caption>
                <thead>
                  <tr>
                    <th scope="col" className="pp-th-label">Προνόμιο</th>
                    {AURA_PLANS.map((p) => (
                      <th key={p.id} scope="col" className={`pp-th ${p.highlight ? "pp-col-hi" : ""}`}>
                        <span className="block text-xs font-bold tracking-[0.2em]">{p.name}</span>
                        <span className="mt-1 block text-[11px] font-normal text-white/50">{p.priceLabel} / μήνα</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {GROUPS.map((g) => (
                    <GroupRows key={g.title} title={g.title} rows={g.rows} />
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
        </section>

        {/* faq */}
        <section className="mx-auto max-w-3xl px-5 pb-28 sm:px-8" aria-labelledby="faq-title">
          <Reveal>
            <h2 id="faq-title" className="pp-title mb-8 text-center text-3xl font-bold tracking-tight sm:text-4xl">
              Συχνές ερωτήσεις
            </h2>
          </Reveal>
          <div className="space-y-3">
            {FAQ.map((f, i) => (
              <Reveal key={f.q} delay={i * 0.08}>
                <details className="pp-faq group">
                  <summary>
                    <span>{f.q}</span>
                    <span className="pp-plus" aria-hidden />
                  </summary>
                  <p className="px-6 pb-6 text-sm leading-relaxed text-white/60">{f.a}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </section>

        {/* final cta */}
        <section className="mx-auto max-w-3xl px-5 pb-32 text-center sm:px-8">
          <Reveal>
            <div className="pp-cta px-6 py-14 sm:px-12">
              <h2 className="pp-title text-3xl font-bold tracking-tight sm:text-5xl">Ξεκίνα την εξέλιξή σου</h2>
              <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-white/55">
                Διάλεξε το πλάνο σου και μπες στο AURA system.
              </p>
              <div className="mt-8 flex justify-center">
                <ChromeButton
                  type="button"
                  onClick={() => document.getElementById("plans")?.scrollIntoView({ behavior: "smooth" })}
                >
                  ΔΕΣ ΤΑ ΠΛΑΝΑ
                </ChromeButton>
              </div>
            </div>
          </Reveal>
        </section>
      </div>
    </div>
  );
}

function GroupRows({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <>
      <tr>
        <th colSpan={4} scope="colgroup" className="pp-group">{title}</th>
      </tr>
      {rows.map((r) => (
        <tr key={r.label} className="pp-row">
          <th scope="row" className="pp-label">{r.label}</th>
          {r.values.map((v, i) => (
            <td key={i} className={`pp-cell ${AURA_PLANS[i]?.highlight ? "pp-col-hi" : ""}`}>
              <CellView v={v} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/* ---------------- styles ---------------- */

const css = `
@keyframes pp-spin { to { transform: rotate(360deg); } }
@keyframes pp-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
@keyframes pp-pulse { 0%,100% { opacity: .5; } 50% { opacity: .95; } }

.pp-grid {
  background-image: linear-gradient(rgba(255,255,255,.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.03) 1px, transparent 1px);
  background-size: 58px 58px;
  -webkit-mask-image: radial-gradient(ellipse 75% 50% at 50% 18%, #000 15%, transparent 75%);
          mask-image: radial-gradient(ellipse 75% 50% at 50% 18%, #000 15%, transparent 75%);
  pointer-events: none;
}
.pp-orb { position: absolute; border-radius: 9999px; pointer-events: none; filter: blur(46px);
  background: radial-gradient(circle at 35% 30%, rgba(232,236,242,.15), rgba(160,168,180,.05) 45%, transparent 70%); }
.pp-ring {
  position: absolute; left: 50%; top: 50%; width: min(640px, 90vw); aspect-ratio: 1; transform: translate(-50%, -52%);
  border-radius: 9999px; pointer-events: none; opacity: .55;
  background: conic-gradient(from 0deg, transparent 0 60%, rgba(232,236,242,.35) 80%, transparent 100%);
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 1.5px), #000 calc(100% - 1px));
          mask: radial-gradient(farthest-side, transparent calc(100% - 1.5px), #000 calc(100% - 1px));
  animation: pp-spin 20s linear infinite;
}
.pp-title {
  background: linear-gradient(110deg, #6b7280 0%, #f8fafc 22%, #9ca3af 42%, #ffffff 58%, #8b93a1 78%, #f1f5f9 100%);
  background-size: 250% 100%; -webkit-background-clip: text; background-clip: text; color: transparent;
  animation: pp-shimmer 7s linear infinite;
}

.pp-trust { background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.08); }
.pp-trust-item { background: linear-gradient(180deg, rgba(20,21,27,.95), rgba(9,10,13,.97)); }
.pp-icon { display: grid; place-items: center; width: 46px; height: 46px; border-radius: 9999px;
  border: 1px solid rgba(255,255,255,.16); background: radial-gradient(circle at 30% 25%, rgba(255,255,255,.14), rgba(255,255,255,.02));
  box-shadow: 0 0 28px -8px rgba(232,236,242,.5); }

.pp-table-wrap { overflow-x: auto; border-radius: 1.2rem; border: 1px solid rgba(255,255,255,.1);
  background: linear-gradient(180deg, rgba(20,21,27,.94), rgba(9,10,13,.97)); box-shadow: 0 30px 80px -40px rgba(0,0,0,.9); }
.pp-th-label, .pp-th { padding: 1.4rem 1rem; font-size: 11px; letter-spacing: .25em; text-transform: uppercase; color: rgba(255,255,255,.45); border-bottom: 1px solid rgba(255,255,255,.1); }
.pp-th { text-align: center; color: #f1f5f9; }
.pp-th-label { position: sticky; left: 0; z-index: 2; background: rgba(14,15,19,.98); }
.pp-col-hi { background: linear-gradient(180deg, rgba(232,236,242,.08), rgba(232,236,242,.03)); }
.pp-group { padding: 1.1rem 1rem .6rem; text-align: left; font-size: 10px; letter-spacing: .4em; text-transform: uppercase; color: rgba(255,255,255,.4);
  background: rgba(255,255,255,.025); }
.pp-label { position: sticky; left: 0; z-index: 1; padding: .95rem 1rem; text-align: left; font-size: 13px; font-weight: 400; color: rgba(255,255,255,.8);
  background: rgba(12,13,17,.98); border-top: 1px solid rgba(255,255,255,.05); }
.pp-cell { padding: .85rem 1rem; text-align: center; border-top: 1px solid rgba(255,255,255,.05); }
.pp-row { transition: background .25s; }
.pp-row:hover .pp-cell, .pp-row:hover .pp-label { background-color: rgba(255,255,255,.035); }
.pp-tick { display: inline-grid; place-items: center; width: 24px; height: 24px; border-radius: 9999px; color: #f8fafc;
  border: 1px solid rgba(232,236,242,.5); background: rgba(255,255,255,.08); box-shadow: 0 0 16px -2px rgba(232,236,242,.6); }
.pp-cross { display: inline-grid; place-items: center; width: 24px; height: 24px; color: rgba(255,255,255,.25); }
.pp-val { font-size: 12px; font-weight: 600; letter-spacing: .04em; color: #f1f5f9; text-shadow: 0 0 14px rgba(232,236,242,.5); }

.pp-faq { border-radius: 1rem; border: 1px solid rgba(255,255,255,.1); background: linear-gradient(180deg, rgba(20,21,27,.92), rgba(9,10,13,.95)); transition: border-color .3s; }
.pp-faq:hover, .pp-faq[open] { border-color: rgba(232,236,242,.3); }
.pp-faq summary { display: flex; cursor: pointer; list-style: none; align-items: center; justify-content: space-between; gap: 1rem; padding: 1.3rem 1.5rem; font-size: 14px; font-weight: 500; }
.pp-faq summary::-webkit-details-marker { display: none; }
.pp-plus { position: relative; width: 14px; height: 14px; flex-shrink: 0; }
.pp-plus::before, .pp-plus::after { content: ""; position: absolute; left: 0; right: 0; top: 50%; height: 1.5px; background: #e8ecf2; transition: transform .3s; }
.pp-plus::after { transform: rotate(90deg); }
.pp-faq[open] .pp-plus::after { transform: rotate(0deg); }

.pp-cta { position: relative; overflow: hidden; border-radius: 1.6rem; border: 1px solid rgba(255,255,255,.12);
  background: radial-gradient(70% 90% at 50% 0%, rgba(232,236,242,.12), transparent 70%), linear-gradient(180deg, rgba(22,23,29,.95), rgba(9,10,13,.97)); }

@media (prefers-reduced-motion: reduce) { .pp-ring, .pp-title { animation: none !important; } }
`;