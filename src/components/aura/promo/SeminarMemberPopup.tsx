// src/components/aura/promo/SeminarMemberPopup.tsx
//
// /online-seminars pop-up for visitors who are not signed in (Greek).
// Look: "The Access Pass": a notched chrome ticket with a light sweep, stage
// light beams and a scanning line, plus three perk tiles.
import { motion, useReducedMotion } from "motion/react";
import { BookOpen, ClipboardCheck, Crown, Radio, Video } from "lucide-react";
import { CHROME_FILL, ChromeCTA, ChromeCTALink, ChromeText, EASE, Sheen } from "@/components/aura/chrome";
import PopupShell from "@/components/aura/promo/PopupShell";
import { usePlanDiscountTable } from "@/lib/discounts";
import { usePlans } from "@/lib/usePlans";
import { getPlan } from "@/lib/plans";

/** Punches a half-circle notch out of both sides of the ticket. */
const TICKET_MASK =
  "radial-gradient(circle 15px at 0 50%, #0000 97%, #000) left / 51% 100% no-repeat, radial-gradient(circle 15px at 100% 50%, #0000 97%, #000) right / 51% 100% no-repeat";

const BEAMS = [
  { left: "12%", delay: 0, rotate: -14 },
  { left: "46%", delay: 1.2, rotate: 0 },
  { left: "80%", delay: 2.4, rotate: 14 },
] as const;

export default function SeminarMemberPopup({
  open,
  onClose,
  canContinue,
}: {
  open: boolean;
  onClose: () => void;
  /** True when the visitor pressed "Κλείσε θέση": offer to carry on as a guest. */
  canContinue: boolean;
}) {
  const reduce = useReducedMotion();
  const table = usePlanDiscountTable();
  usePlans(); // loads the live plan names and prices

  const seminarPct = table.high.online_seminar;
  const bookPct = table.high.book;
  const elite = getPlan("high");
  const from = getPlan("low");

  const perks = [
    seminarPct > 0 && { Icon: Video, big: `−${seminarPct}%`, small: "σε κάθε online σεμινάριο" },
    bookPct > 0 && { Icon: BookOpen, big: `−${bookPct}%`, small: "στο φυσικό βιβλίο" },
    { Icon: ClipboardCheck, big: "×4", small: "προσωπικές αξιολογήσεις / μήνα" },
  ].filter((p): p is { Icon: typeof Video; big: string; small: string } => p !== false);

  return (
    <PopupShell
      open={open}
      onClose={onClose}
      titleId="seminar-promo-title"
      descId="seminar-promo-desc"
      closeLabel="Κλείσιμο"
      className="max-w-lg"
    >
      <div
        className="relative overflow-hidden rounded-3xl border border-white/25 bg-[#060608] px-5 pb-7 pt-10 shadow-[0_0_110px_rgba(210,218,230,0.16),0_40px_90px_rgba(0,0,0,0.85)] sm:px-8"
      >
        {/* stage beams */}
        {BEAMS.map((b, i) => (
          <motion.span
            key={i}
            aria-hidden
            className="pointer-events-none absolute -top-10 h-[130%] w-24 origin-top blur-xl"
            style={{
              left: b.left,
              rotate: b.rotate,
              background: "linear-gradient(180deg, rgba(255,255,255,0.22), transparent 72%)",
            }}
            {...(reduce
              ? {}
              : { animate: { opacity: [0.15, 0.7, 0.15] }, transition: { duration: 5, repeat: Infinity, delay: b.delay, ease: "easeInOut" } })}
          />
        ))}
        <div aria-hidden className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent" />
        {!reduce && (
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent"
            animate={{ top: ["0%", "100%"] }}
            transition={{ duration: 6.5, repeat: Infinity, ease: "linear" }}
          />
        )}

        {/* live pill */}
        <div className="relative flex justify-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/[0.05] px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.3em] text-white/80">
            <span className="relative flex size-2">
              {!reduce && <span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-70" />}
              <span className="relative inline-flex size-2 rounded-full bg-white" />
            </span>
            <Radio className="size-3.5" /> Live online
          </span>
        </div>

        {/* the pass */}
        <motion.div
          className="relative mx-auto mt-6 max-w-sm"
          {...(reduce ? {} : { animate: { y: [0, -6, 0] }, transition: { duration: 5, repeat: Infinity, ease: "easeInOut" } })}
        >
          <div
            className="relative overflow-hidden"
            style={{
              backgroundImage: CHROME_FILL,
              WebkitMask: TICKET_MASK,
              mask: TICKET_MASK,
              borderRadius: 20,
              boxShadow: "0 0 70px rgba(255,255,255,0.28)",
            }}
          >
            <Sheen />
            <div className="relative flex items-stretch text-neutral-950">
              <div className="flex flex-1 flex-col justify-center px-5 py-5">
                <span className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.3em]">
                  <Crown className="size-3.5" strokeWidth={2.6} /> Access pass
                </span>
                <span className="mt-1.5 text-xl font-black leading-none tracking-tight">{elite?.name ?? "AURA ELITE"}</span>
                <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.25em] text-neutral-700">Members only</span>
              </div>
              <span aria-hidden className="my-4 w-px border-l-2 border-dashed border-neutral-800/45" />
              <div className="flex w-36 flex-col items-center justify-center px-3 py-5 text-center">
                <span className="text-5xl font-black leading-none tracking-tighter">{seminarPct > 0 ? `−${seminarPct}%` : "VIP"}</span>
                <span className="mt-1.5 text-[10px] font-extrabold uppercase tracking-[0.3em]">online σεμινάρια</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* copy */}
        <div className="relative mt-7 text-center">
          <h2 id="seminar-promo-title" className="text-[1.65rem] font-extrabold leading-tight tracking-tight sm:text-3xl">
            <ChromeText>Μάθε live. Πλήρωσε λιγότερο.</ChromeText>
          </h2>
          <p id="seminar-promo-desc" className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-zinc-400">
            Τα μέλη {elite?.name ?? "AURA ELITE"} βλέπουν την τιμή με την έκπτωση αυτόματα στο checkout, μαζί με
            προσωπική καθοδήγηση και αποκλειστική κοινότητα.
          </p>
        </div>

        {/* perks */}
        <ul className={`relative mt-6 grid gap-2.5 ${perks.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
          {perks.map((p, i) => (
            <motion.li
              key={p.small}
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE, delay: 0.5 + i * 0.12 }}
              className="rounded-2xl border border-white/12 bg-white/[0.04] px-2.5 py-3.5 text-center"
            >
              <p.Icon className="mx-auto size-4 text-zinc-400" />
              <span
                className="mt-2 block text-xl font-black tracking-tight drop-shadow-[0_0_14px_rgba(255,255,255,0.45)]"
                style={{
                  backgroundImage: CHROME_FILL,
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                {p.big}
              </span>
              <span className="mt-1 block text-[10px] leading-snug text-zinc-500">{p.small}</span>
            </motion.li>
          ))}
        </ul>

        {from && (
          <p className="relative mt-4 text-center text-xs text-white/45">
            Πλάνα από <span className="font-semibold text-white/80">{from.priceLabel}</span> / μήνα · ακύρωση οποιαδήποτε στιγμή
          </p>
        )}

        <div className="relative mt-6 flex flex-col gap-3">
          <ChromeCTALink to="/pricing" className="w-full">
            Δες τα πλάνα
          </ChromeCTALink>
          <ChromeCTA type="button" solid={false} onClick={onClose}>
            {canContinue ? "Συνέχεια ως επισκέπτης" : "Όχι τώρα"}
          </ChromeCTA>
        </div>
      </div>
    </PopupShell>
  );
}
