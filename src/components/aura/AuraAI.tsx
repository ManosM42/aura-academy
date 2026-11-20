import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client"; // ← προσαρμόσε στο δικό σου path
import AuraFace from "./AuraFace";
import AuraChatCards, { speakable, type AuraCard } from "@/components/aura/AuraChatCards";
import { useAuraSpeech } from "@/hooks/useAuraSpeech";
import "./aura-ai.css";

type Msg = { role: "user" | "assistant"; content: string; cards?: AuraCard[] };

const DEFAULT_LIMIT = 10; // μέχρι να απαντήσει ο server με το πραγματικό όριο
const MAX_PIPS = 12; // πάνω από αυτό δείχνουμε αριθμό αντί για κουκκίδες
const STORE_KEY = "aura_chat_v1";
const SUGGESTIONS = [
  "Δείξε μου βίντεο Graduation",
  "Τι online σεμινάρια υπάρχουν;",
  "Θέλω να κλείσω σεμινάριο",
  "Τι πλάνα έχετε;",
];
const PARTICLES = Array.from({ length: 14 }, (_, i) => ({
  left: (i * 37 + 11) % 100,
  size: 2 + (i % 3),
  delay: (i * 0.9) % 8,
  dur: 9 + (i % 5) * 2,
}));

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

function getDeviceId() {
  try {
    let id = localStorage.getItem("aura_device");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("aura_device", id);
    }
    return id;
  } catch {
    return "unknown";
  }
}

function loadMessages(): Msg[] {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Msg[]) : [];
    return Array.isArray(parsed) ? parsed.slice(-20) : [];
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/* Hooks: κινητό + «κλείδωμα» τύπου Instagram DM                        */
/* ------------------------------------------------------------------ */

function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setMatch(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [query]);
  return match;
}

/**
 * Στο κινητό η σελίδα «κλειδώνει» στο ορατό τμήμα της οθόνης (visualViewport). Όταν ανοίγει το
 * πληκτρολόγιο, όλο το UI μικραίνει ώστε να χωράει πάνω από αυτό, και ο χαρακτήρας μένει ορατός.
 * Η σελίδα πίσω δεν κινείται.
 */
function useLockedViewport(enabled: boolean) {
  const [vp, setVp] = useState({ height: 0, top: 0, keyboard: false });

  useEffect(() => {
    if (!enabled) return;
    const vv = window.visualViewport;
    let maxH = 0;
    let lastW = window.innerWidth;

    const update = () => {
      if (window.innerWidth !== lastW) {
        lastW = window.innerWidth; // περιστροφή οθόνης
        maxH = 0;
      }
      const height = Math.round(vv ? vv.height : window.innerHeight);
      const top = Math.round(vv ? vv.offsetTop : 0);
      maxH = Math.max(maxH, height); // το μεγαλύτερο ύψος που είδαμε = πληκτρολόγιο κλειστό
      const keyboard = maxH - height > 120;
      setVp((p) => (p.height === height && p.top === top && p.keyboard === keyboard ? p : { height, top, keyboard }));
      if (window.scrollY !== 0) window.scrollTo(0, 0); // το iOS σκρολάρει τη σελίδα όταν εστιάζεις input
    };
    update();

    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);

    // κλείδωσε τη σελίδα πίσω από το chat
    const html = document.documentElement;
    const body = document.body;
    const scrollY = window.scrollY;
    const prev = {
      hOverflow: html.style.overflow,
      hOverscroll: html.style.overscrollBehavior,
      bOverflow: body.style.overflow,
      bPosition: body.style.position,
      bTop: body.style.top,
      bWidth: body.style.width,
    };
    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";

    return () => {
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      html.style.overflow = prev.hOverflow;
      html.style.overscrollBehavior = prev.hOverscroll;
      body.style.overflow = prev.bOverflow;
      body.style.position = prev.bPosition;
      body.style.top = prev.bTop;
      body.style.width = prev.bWidth;
      window.scrollTo(0, scrollY);
    };
  }, [enabled]);

  return vp;
}

/* ------------------------------------------------------------------ */
/* Εικονίδια                                                            */
/* ------------------------------------------------------------------ */

const SpeakerIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 5 6 9H3v6h3l5 4V5z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" />
  </svg>
);
const MuteIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 5 6 9H3v6h3l5 4V5z" /><path d="m16 9 5 6M21 9l-5 6" />
  </svg>
);
const SendIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
const BackIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m15 5-7 7 7 7" />
  </svg>
);

/* ------------------------------------------------------------------ */
/* Σελίδα                                                               */
/* ------------------------------------------------------------------ */

export default function AuraAI() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [limitReached, setLimitReached] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [debug, setDebug] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isMobile = useMediaQuery("(max-width: 767px)");
  const vp = useLockedViewport(isMobile);
  const { speak, stop, speaking, voiceIssue, getViseme } = useAuraSpeech();

  useEffect(() => {
    setDebug(new URLSearchParams(window.location.search).has("debug"));
    setMessages(loadMessages()); // αν ο χρήστης πάτησε μια κάρτα και γύρισε πίσω, η συζήτηση συνεχίζεται
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify(messages.slice(-20)));
    } catch {
      /* ignore */
    }
  }, [messages]);

  // σκρολάρισμα στο τέλος: νέο μήνυμα, άνοιγμα/κλείσιμο πληκτρολογίου
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading, vp.keyboard, vp.height]);

  async function send(override?: string) {
    const text = (override ?? input).trim();
    if (!text || loading || limitReached) return;

    stop();
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      let reply: string | null = null;
      let cards: AuraCard[] | undefined;
      const payload = next.map(({ role, content }) => ({ role, content })); // στον server μόνο κείμενο

      for (let attempt = 0; attempt < 2 && !reply; attempt++) {
        try {
          const { data, error: invokeErr } = await supabase.functions.invoke("ai-chat", {
            body: { messages: payload, deviceId: getDeviceId() },
          });
          if (invokeErr) throw invokeErr;

          if (data?.error === "limit_reached") {
            setLimitReached(true);
            setRemaining(0);
            return;
          }
          if (typeof data?.reply === "string" && data.reply.trim()) {
            reply = data.reply;
            cards = Array.isArray(data.cards) && data.cards.length ? (data.cards as AuraCard[]) : undefined;
            if (typeof data.remaining === "number") setRemaining(data.remaining);
            if (typeof data.limit === "number") setLimit(data.limit);
          }
        } catch (e) {
          console.error(e);
        }
      }

      const finalReply = reply ?? "Συγγνώμη, είχα ένα μικρό πρόβλημα σύνδεσης. Στείλε μου ξανά το μήνυμά σου.";
      setMessages([...next, { role: "assistant", content: finalReply, cards }]);
      if (voiceOn) void speak(speakable(finalReply)); // η φωνή διαβάζει μόνο τις πρώτες προτάσεις
    } finally {
      setLoading(false);
    }
  }

  function newChat() {
    stop();
    setMessages([]);
  }

  function goBack() {
    if (window.history.length > 1) window.history.back();
    else window.location.href = "/";
  }

  const left = remaining ?? limit;
  const status = speaking ? "Μιλάει…" : loading ? "Σκέφτεται…" : "Online";
  const lastIndex = messages.length - 1;

  /* ── Κοινά κομμάτια (ίδια σε desktop και κινητό) ─────────────────────── */

  const messagesView = (
    <>
      <div className="aai-bubble-ai aai-rise max-w-[88%] px-4 py-3 text-sm">
        Γεια σου, είμαι η AURA. Ρώτησέ με για barbering και τεχνικές, ζήτα μου βίντεο από τα μαθήματα, ή δες μαζί μου σεμινάρια και πλάνα.
      </div>

      {messages.map((m, i) =>
        m.role === "user" ? (
          <div key={i} className="aai-rise flex justify-end">
            <div className="aai-bubble-user max-w-[85%] px-4 py-2.5 text-sm">{m.content}</div>
          </div>
        ) : (
          <div key={i} className="aai-rise">
            <div className="flex items-end gap-2">
              <div className="aai-bubble-ai max-w-[88%] whitespace-pre-line px-4 py-3 text-sm">{m.content}</div>
              {i === lastIndex && (
                <button className="aai-icon-btn shrink-0" onClick={() => void speak(speakable(m.content))} title="Άκουσέ το ξανά">
                  <SpeakerIcon />
                </button>
              )}
            </div>
            {m.cards && m.cards.length > 0 && (
              <div className="max-w-[94%]">
                <AuraChatCards cards={m.cards} />
              </div>
            )}
          </div>
        ),
      )}

      {loading && (
        <div className="aai-bubble-ai aai-rise inline-block px-4 py-3">
          <div className="aai-typing"><i /><i /><i /></div>
        </div>
      )}

      {messages.length === 0 && !limitReached && (
        <div className="flex flex-wrap gap-2 pt-1">
          {SUGGESTIONS.map((s) => (
            <button key={s} className="aai-chip" onClick={() => send(s)}>{s}</button>
          ))}
        </div>
      )}

      {voiceIssue && voiceOn && (
        <p className="rounded-lg border border-amber-200/30 bg-amber-200/10 p-2 text-[11px] leading-snug text-amber-100">
          {voiceIssue === "no-greek-voice"
            ? "Δεν βρέθηκε ελληνική φωνή στη συσκευή σου, οπότε η AURA μιλάει χωρίς ήχο."
            : "Ο browser δεν έπαιξε ήχο (σίγαση ή μπλοκάρισμα). Δοκίμασε το κουμπί με το ηχείο δίπλα στην απάντηση."}
        </p>
      )}
    </>
  );

  const meter = (
    <div className="flex items-center justify-between text-[11px] text-slate-400">
      <span className="uppercase tracking-widest">Διαθέσιμα μηνύματα</span>
      {limit <= MAX_PIPS ? (
        <span className="flex gap-1.5">
          {Array.from({ length: limit }).map((_, i) => (
            <span key={i} className={`aai-pip ${i < left ? "on" : ""}`} />
          ))}
        </span>
      ) : (
        <span className="tracking-widest">{left}</span>
      )}
    </div>
  );

  const composer = (
    <>
      {limitReached ? (
        <a href="/pricing" className="aai-btn block px-4 py-3 text-center">
          Τέλος διαθέσιμων μηνυμάτων — Δες τα πλάνα
        </a>
      ) : (
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            maxLength={500}
            placeholder="Γράψε το μήνυμά σου…"
            enterKeyHint="send"
            autoComplete="off"
            className="aai-input flex-1 px-4 py-3"
            style={{ fontSize: 16 }} /* 16px: το iOS δεν κάνει zoom όταν εστιάζεις */
          />
          <button
            onPointerDown={(e) => e.preventDefault()} /* το πληκτρολόγιο μένει ανοιχτό μετά την αποστολή */
            onClick={() => send()}
            disabled={loading}
            className="aai-btn flex items-center px-4"
            aria-label="Αποστολή"
          >
            <SendIcon />
          </button>
        </div>
      )}
    </>
  );

  const debugBtn = debug && (
    <button
      onClick={() => void speak("Γεια σου, είμαι η Άουρα. Πώς μπορώ να σε βοηθήσω σήμερα;")}
      className="mt-2 w-full rounded-lg border border-yellow-300/60 py-1 text-xs text-yellow-200"
    >
      DEBUG: δοκιμή φωνής (δεν χρεώνει χρήση) · πάτα B για βλεφάρισμα
    </button>
  );

  /* ── ΚΙΝΗΤΟ: κλειδωμένη οθόνη τύπου Instagram DM ─────────────────────── */

  if (isMobile) {
    const base = vp.height || (typeof window !== "undefined" ? window.innerHeight : 700);
    // ο χαρακτήρας μικραίνει όταν ανοίγει το πληκτρολόγιο, αλλά μένει πάντα ορατός
    const avatarH = vp.keyboard ? clamp(base * 0.3, 140, 200) : clamp(base * 0.42, 230, 440);

    return (
      <section
        className="fixed inset-x-0 z-[60] flex flex-col overflow-hidden bg-[#030304] text-white"
        style={{ top: vp.top, height: vp.height || "100dvh" }}
      >
        <div className="relative shrink-0 transition-[height] duration-300 ease-out" style={{ height: avatarH }}>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_35%,rgba(150,170,210,0.22),transparent_70%)]" />
          <AuraFace getViseme={getViseme} fit="cover" fadeBottom className="h-full w-full" debug={debug} />

          {/* επάνω μπάρα πάνω στον χαρακτήρα */}
          <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent px-3 pb-6 pt-[max(10px,env(safe-area-inset-top))]">
            <button className="aai-icon-btn" onClick={goBack} aria-label="Πίσω"><BackIcon /></button>
            <div className="flex items-center gap-2 text-[11px] tracking-widest text-slate-200">
              <span className="aai-live" />
              <span className="aai-chrome-text text-sm font-semibold">AURA</span>
              <span className="text-slate-400">{status}</span>
              <span className={`aai-eq ${speaking ? "on" : ""}`}><i /><i /><i /><i /><i /></span>
            </div>
            <div className="flex items-center gap-1.5">
              {messages.length > 0 && (
                <button className="aai-chip" onClick={newChat}>Νέα</button>
              )}
              <button
                className="aai-icon-btn"
                onClick={() => { if (voiceOn) stop(); setVoiceOn(!voiceOn); }}
                aria-label={voiceOn ? "Σίγαση" : "Ενεργοποίηση φωνής"}
              >
                {voiceOn ? <SpeakerIcon /> : <MuteIcon />}
              </button>
            </div>
          </div>
        </div>

        <div ref={listRef} className="aai-scroll min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-3">
          {messagesView}
        </div>

        <div
          className="shrink-0 border-t border-white/10 bg-black/60 px-3 pt-2 backdrop-blur"
          style={{ paddingBottom: vp.keyboard ? 8 : "max(10px, env(safe-area-inset-bottom))" }}
        >
          {composer}
          <div className="mt-2">{meter}</div>
          {debugBtn}
        </div>
      </section>
    );
  }

  /* ── DESKTOP: μεγάλος χαρακτήρας + chat στο ίδιο ύψος ─────────────────── */

  const boxH = "min(84vh, 920px)";

  return (
    <section className="aai-root pb-10 pt-20">
      <div className="aai-rays" />
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className="aai-dot"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.dur}s`,
          }}
        />
      ))}

      <div className="relative z-10 mx-auto grid w-full max-w-[1480px] items-center gap-6 px-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-10 lg:px-8">
        {/* ── Χαρακτήρας ── */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative w-full" style={{ height: boxH }}>
            <div
              className={`pointer-events-none absolute inset-0 transition-opacity duration-500 ${speaking ? "opacity-100" : "opacity-60"}`}
              style={{ background: "radial-gradient(55% 50% at 50% 38%, rgba(160,180,225,0.20), transparent 72%)" }}
            />
            <AuraFace getViseme={getViseme} fit="contain" className="h-full w-full" debug={debug} />
          </div>
          <div className="flex items-center gap-3 text-xs tracking-widest text-slate-300">
            <span className="aai-live" />
            <span>AURA AI · {status}</span>
            <span className={`aai-eq ${speaking ? "on" : ""}`}><i /><i /><i /><i /><i /></span>
          </div>
        </div>

        {/* ── Chat ── */}
        <div className="aai-frame flex flex-col" style={{ height: boxH }}>
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div>
              <div className="aai-chrome-text text-xl font-semibold">AURA</div>
              <div className="mt-0.5 text-[11px] uppercase tracking-[0.25em] text-slate-400">Barber Academy · AI Assistant</div>
            </div>
            <div className="flex items-center gap-2">
              {messages.length > 0 && (
                <button className="aai-chip" onClick={newChat} title="Νέα συζήτηση">Νέα συζήτηση</button>
              )}
              <button
                className="aai-icon-btn"
                onClick={() => { if (voiceOn) stop(); setVoiceOn(!voiceOn); }}
                title={voiceOn ? "Σίγαση" : "Ενεργοποίηση φωνής"}
              >
                {voiceOn ? <SpeakerIcon /> : <MuteIcon />}
              </button>
            </div>
          </div>

          <div ref={listRef} className="aai-scroll min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messagesView}
          </div>

          <div className="border-t border-white/10 px-4 pb-4 pt-3">
            {composer}
            <div className="mt-3">{meter}</div>
            {debugBtn}
          </div>
        </div>
      </div>
    </section>
  );
}