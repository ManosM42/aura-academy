// src/components/aura/AuraChatCards.tsx
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, Clock, Loader2, Lock, LogIn, Play, Sparkles, Users, Video } from "lucide-react";
import { getCourseForPlay, getStepVideoUrl } from "@/lib/courses";
import { COURSE_CATEGORIES } from "@/lib/courses.types";
import { formatPrice } from "@/lib/onlineSeminars";
import { formatEuro } from "@/lib/plans";

/** Ίδιο σχήμα με αυτό που γυρίζει το edge function. */
export type AuraCard =
  | {
      type: "video";
      slug: string;
      title: string;
      summary: string | null;
      category: string | null;
      level: string | null;
      requiredPlanName: string;
      durationSeconds: number | null;
      hasVideo: boolean;
      locked: boolean;
    }
  | {
      type: "pricing";
      reason: "no_plan" | "upgrade" | "info";
      requiredPlanName?: string;
      plans: { id: string; name: string; priceCents: number; currency: string; badge: string | null; slogan: string }[];
    }
  | {
      type: "online_seminar";
      id: string;
      title: string;
      startsAt: string;
      durationMinutes: number;
      priceCents: number;
      finalPriceCents: number;
      discountPercent: number;
      currency: string;
      spotsLeft: number | null;
      soldOut: boolean;
    }
  | { type: "seminar_onsite"; nextDates: { date: string; groupSlots: string[]; privateSlots: string[] }[] }
  | { type: "link"; to: "/book" | "/find-job" | "/contact" | "/stop-plan"; label: string; description: string }
  | { type: "login" };

/** Τι να διαβάσει η φωνή: μόνο οι πρώτες προτάσεις (εξοικονομεί το όριο του TTS). */
export function speakable(text: string, maxSentences = 2, maxChars = 240): string {
  const clean = text.replace(/[*_#`>]+/g, " ").replace(/\s+/g, " ").trim();
  let out = "";
  for (const part of clean.split(/(?<=[.!?;…])\s+/).slice(0, maxSentences)) {
    if (out && (out + " " + part).length > maxChars) break;
    out = out ? `${out} ${part}` : part;
  }
  return out.slice(0, maxChars);
}

const shell =
  "rounded-2xl border border-white/15 bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-4 text-left text-white backdrop-blur";
const btn =
  "inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-b from-zinc-100 to-zinc-300 px-4 py-2 text-xs font-semibold text-black transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white";
const ghost =
  "inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs font-medium text-white/80 transition hover:border-white/50 hover:text-white";

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default function AuraChatCards({ cards, onNavigate }: { cards: AuraCard[]; onNavigate?: () => void }) {
  if (!cards?.length) return null;
  return (
    <div className="mt-3 flex flex-col gap-3">
      {cards.map((c, i) => {
        const key = `${c.type}-${i}`;
        switch (c.type) {
          case "video":
            return <VideoCard key={key} c={c} onNavigate={onNavigate} />;
          case "pricing":
            return <PricingCard key={key} c={c} onNavigate={onNavigate} />;
          case "online_seminar":
            return <OnlineSeminarCard key={key} c={c} onNavigate={onNavigate} />;
          case "seminar_onsite":
            return <OnsiteCard key={key} c={c} onNavigate={onNavigate} />;
          case "link":
            return <LinkCard key={key} c={c} onNavigate={onNavigate} />;
          case "login":
            return <LoginCard key={key} onNavigate={onNavigate} />;
          default:
            return null;
        }
      })}
    </div>
  );
}

/* ---------------- video ---------------- */

function VideoCard({ c, onNavigate }: { c: Extract<AuraCard, { type: "video" }>; onNavigate?: () => void }) {
  const [state, setState] = useState<{ status: "idle" | "loading" | "ready" | "error"; url?: string; msg?: string }>({
    status: "idle",
  });
  const label = COURSE_CATEGORIES.find((x) => x.key === c.category)?.label ?? c.category;

  async function play() {
    setState({ status: "loading" });
    try {
      // Ο έλεγχος πρόσβασης γίνεται ξανά από τις ίδιες συναρτήσεις που χρησιμοποιεί η σελίδα του βίντεο
      const { course, locked } = await getCourseForPlay(c.slug);
      if (locked) throw new Error("Χρειάζεσαι ανώτερο πλάνο για αυτό το βίντεο.");
      if (!course.video_path) throw new Error("Το βίντεο δεν έχει ανέβει ακόμη.");
      const url = await getStepVideoUrl(course.video_path, course.id);
      setState({ status: "ready", url });
    } catch (e) {
      setState({ status: "error", msg: e instanceof Error ? e.message : "Δεν φορτώθηκε το βίντεο." });
    }
  }

  return (
    <div className={shell}>
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-black/50">
          {c.locked ? <Lock className="size-4 text-white/70" /> : <Video className="size-4 text-white/80" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{c.title}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-white/50">
            {label ? <span>{label}</span> : null}
            {c.durationSeconds ? <span>{mmss(c.durationSeconds)}</span> : null}
            <span>{c.requiredPlanName}</span>
          </p>
        </div>
      </div>

      {c.summary ? <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-white/60">{c.summary}</p> : null}

      {c.locked ? (
        <p className="mt-3 flex items-center gap-2 text-xs text-white/70">
          <Lock className="size-3.5" /> Χρειάζεται πλάνο {c.requiredPlanName} ή ανώτερο.
        </p>
      ) : state.status === "ready" && state.url ? (
        <video src={state.url} controls autoPlay playsInline className="mt-3 aspect-video w-full rounded-xl bg-black" />
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={play} disabled={state.status === "loading" || !c.hasVideo} className={`${btn} disabled:opacity-40`}>
            {state.status === "loading" ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
            {c.hasVideo ? "Παρακολούθηση εδώ" : "Σύντομα"}
          </button>
          <Link to="/courses/$slug" params={{ slug: c.slug }} onClick={onNavigate} className={ghost}>
            Άνοιγμα σελίδας
          </Link>
        </div>
      )}
      {state.status === "error" ? <p className="mt-2 text-xs text-red-300">{state.msg}</p> : null}
    </div>
  );
}

/* ---------------- pricing ---------------- */

function PricingCard({ c, onNavigate }: { c: Extract<AuraCard, { type: "pricing" }>; onNavigate?: () => void }) {
  const title =
    c.reason === "no_plan"
      ? "Χρειάζεσαι ενεργό πλάνο"
      : c.reason === "upgrade"
        ? `Αναβάθμιση σε ${c.requiredPlanName ?? "ανώτερο πλάνο"}`
        : "Πλάνα AURA";
  return (
    <div className={shell}>
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Sparkles className="size-4 text-white/70" /> {title}
      </p>
      <ul className="mt-3 divide-y divide-white/10 text-xs">
        {c.plans.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 py-2">
            <span className="min-w-0">
              <span className="font-semibold">{p.name}</span>
              {p.badge ? <span className="ml-2 text-[10px] text-white/50">{p.badge}</span> : null}
            </span>
            <span className="shrink-0 text-white/80">{formatEuro(p.priceCents)}/μήνα</span>
          </li>
        ))}
      </ul>
      <Link to="/pricing" onClick={onNavigate} className={`${btn} mt-4`}>
        Δες τα πλάνα <ArrowRight className="size-3.5" />
      </Link>
    </div>
  );
}

/* ---------------- online seminar ---------------- */

function OnlineSeminarCard({ c, onNavigate }: { c: Extract<AuraCard, { type: "online_seminar" }>; onNavigate?: () => void }) {
  const d = new Date(c.startsAt);
  return (
    <div className={shell}>
      <p className="text-sm font-semibold">{c.title}</p>
      <ul className="mt-2 space-y-1 text-xs text-white/65">
        <li className="flex items-center gap-2">
          <CalendarDays className="size-3.5" />
          {d.toLocaleDateString("el-GR", { weekday: "long", day: "numeric", month: "long" })}
        </li>
        <li className="flex items-center gap-2">
          <Clock className="size-3.5" />
          {d.toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit" })} · {c.durationMinutes} λεπτά
        </li>
        {c.spotsLeft !== null ? (
          <li className="flex items-center gap-2">
            <Users className="size-3.5" />
            {c.soldOut ? "Εξαντλήθηκε" : `${c.spotsLeft} θέσεις`}
          </li>
        ) : null}
      </ul>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-sm">
          {c.discountPercent > 0 ? (
            <>
              <span className="mr-2 text-xs text-white/40 line-through">{formatPrice(c.priceCents, c.currency)}</span>
              <span className="font-semibold">{formatPrice(c.finalPriceCents, c.currency)}</span>
              <span className="ml-2 text-[10px] text-white/50">-{c.discountPercent}% μέλους</span>
            </>
          ) : (
            <span className="font-semibold">{formatPrice(c.priceCents, c.currency)}</span>
          )}
        </span>
        {c.soldOut ? null : (
          <Link to="/online-seminars" search={{ book: c.id }} onClick={onNavigate} className={btn}>
            Κλείσε θέση <ArrowRight className="size-3.5" />
          </Link>
        )}
      </div>
    </div>
  );
}

/* ---------------- on-site seminar ---------------- */

function OnsiteCard({ c, onNavigate }: { c: Extract<AuraCard, { type: "seminar_onsite" }>; onNavigate?: () => void }) {
  return (
    <div className={shell}>
      <p className="text-sm font-semibold">Σεμινάρια επί τόπου</p>
      <p className="mt-1 text-xs text-white/60">Ομαδικό (2 έως 8 άτομα) ή ιδιωτικό. Ώρες 10:00, 14:00, 18:00.</p>
      {c.nextDates.length ? (
        <ul className="mt-3 space-y-1.5 text-xs">
          {c.nextDates.map((n) => (
            <li key={n.date} className="flex items-baseline justify-between gap-3">
              <span className="text-white/80">
                {new Date(`${n.date}T12:00:00`).toLocaleDateString("el-GR", { weekday: "short", day: "numeric", month: "short" })}
              </span>
              <span className="text-right text-white/50">
                {n.groupSlots.length ? `ομαδικό ${n.groupSlots.join(" ")}` : ""}
                {n.groupSlots.length && n.privateSlots.length ? " · " : ""}
                {n.privateSlots.length ? `ιδιωτικό ${n.privateSlots.join(" ")}` : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <Link to="/seminars" onClick={onNavigate} className={`${btn} mt-4`}>
        Κράτηση σεμιναρίου <ArrowRight className="size-3.5" />
      </Link>
    </div>
  );
}

/* ---------------- links / login ---------------- */

function LinkCard({ c, onNavigate }: { c: Extract<AuraCard, { type: "link" }>; onNavigate?: () => void }) {
  return (
    <div className={shell}>
      <p className="text-sm font-semibold">{c.label}</p>
      <p className="mt-1 text-xs text-white/60">{c.description}</p>
      <Link to={c.to} onClick={onNavigate} className={`${btn} mt-3`}>
        Άνοιγμα <ArrowRight className="size-3.5" />
      </Link>
    </div>
  );
}

function LoginCard({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className={shell}>
      <p className="flex items-center gap-2 text-sm font-semibold">
        <LogIn className="size-4 text-white/70" /> Σύνδεση
      </p>
      <p className="mt-1 text-xs text-white/60">Συνδέσου για να δεις τα βίντεο του πλάνου σου.</p>
      <Link to="/login" onClick={onNavigate} className={`${btn} mt-3`}>
        Σύνδεση <ArrowRight className="size-3.5" />
      </Link>
    </div>
  );
}