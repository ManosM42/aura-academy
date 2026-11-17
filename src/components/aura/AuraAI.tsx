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

export default function AuraAI() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [limitReached, setLimitReached] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voiceOn, setVoiceOn] = useState(true);
  const [debug, setDebug] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const { speak, stop, speaking, voiceIssue, getViseme } = useAuraSpeech();

  useEffect(() => {
    setDebug(new URLSearchParams(window.location.search).has("debug"));
    // Αν ο χρήστης πάτησε μια κάρτα και γύρισε πίσω, η συζήτηση συνεχίζεται
    setMessages(loadMessages());
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify(messages.slice(-20)));
    } catch {
      /* ignore */
    }
  }, [messages]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send(override?: string) {
    const text = (override ?? input).trim();
    if (!text || loading || limitReached) return;

    stop();
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      let reply: string | null = null;
      let cards: AuraCard[] | undefined;

      // Στον server στέλνουμε μόνο κείμενο (οι κάρτες δεν χρειάζονται)
      const payload = next.map(({ role, content }) => ({ role, content }));

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

      const finalReply =
        reply ?? "Συγγνώμη, είχα ένα μικρό πρόβλημα σύνδεσης. Στείλε μου ξανά το μήνυμά σου.";
      setMessages([...next, { role: "assistant", content: finalReply, cards }]);
      // Η φωνή διαβάζει μόνο τις πρώτες προτάσεις: γρήγορη απάντηση και λιγότερη κατανάλωση TTS
      if (voiceOn) void speak(speakable(finalReply));
    } finally {
      setLoading(false);
    }
  }

  function newChat() {
    stop();
    setMessages([]);
    setError(null);
  }

  const left = remaining ?? limit;
  const status = speaking ? "Μιλάει…" : loading ? "Σκέφτεται…" : "Online";
  const lastIndex = messages.length - 1;

  return (
    <section className="aai-root pb-10 pt-24">
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

      <div className="relative z-10 mx-auto grid max-w-6xl gap-8 px-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] md:items-center">
        {/* ── Avatar ── */}
        <div className="flex flex-col items-center gap-4">
          <div className={`aai-frame ${speaking ? "aai-speaking" : ""}`}>
            <div className="relative">
              <AuraFace src="/aura-ai.png" getViseme={getViseme} debug={debug} />
              <div className="aai-sheen" />
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs tracking-widest text-slate-300">
            <span className="aai-live" />
            <span>AURA AI · {status}</span>
            <span className={`aai-eq ${speaking ? "on" : ""}`}><i /><i /><i /><i /><i /></span>
          </div>
        </div>

        {/* ── Chat ── */}
        <div className="aai-frame">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div>
              <div className="aai-chrome-text text-xl font-semibold">AURA</div>
              <div className="mt-0.5 text-[11px] uppercase tracking-[0.25em] text-slate-400">Barber Academy · AI Assistant</div>
            </div>
            <div className="flex items-center gap-2">
              {messages.length > 0 && (
                <button className="aai-chip" onClick={newChat} title="Νέα συζήτηση">
                  Νέα συζήτηση
                </button>
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

          <div ref={listRef} className="aai-scroll h-[40vh] space-y-3 overflow-y-auto px-4 py-4 md:h-[50vh]">
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
                      <button
                        className="aai-icon-btn shrink-0"
                        onClick={() => void speak(speakable(m.content))}
                        title="Άκουσέ το ξανά"
                      >
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
          </div>

          <div className="border-t border-white/10 px-4 pb-4 pt-3">
            {limitReached ? (
              <a href="/pricing" className="aai-btn block px-4 py-3 text-center">
                Τέλος διαθέσιμων μηνυμάτων — Δες τα πλάνα
              </a>
            ) : (
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  maxLength={500}
                  placeholder="Γράψε το μήνυμά σου…"
                  className="aai-input flex-1 px-4 py-3 text-sm"
                />
                <button onClick={() => send()} disabled={loading} className="aai-btn flex items-center px-4" aria-label="Αποστολή">
                  <SendIcon />
                </button>
              </div>
            )}

            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
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

            {voiceIssue && voiceOn && (
              <p className="mt-3 rounded-lg border border-amber-200/30 bg-amber-200/10 p-2 text-[11px] leading-snug text-amber-100">
                {voiceIssue === "no-greek-voice"
                  ? "Δεν βρέθηκε ελληνική φωνή στη συσκευή σου, οπότε η AURA μιλάει χωρίς ήχο. Στο Mac: Ρυθμίσεις Συστήματος → Προσβασιμότητα → Spoken Content → Διαχείριση φωνών → Ελληνικά."
                  : "Ο browser δεν έπαιξε ήχο (σίγαση ή μπλοκάρισμα). Δοκίμασε το κουμπί με το ηχείο δίπλα στην απάντηση."}
              </p>
            )}
            {debug && (
              <button
                onClick={() => void speak("Γεια σου, είμαι η Άουρα. Πώς μπορώ να σε βοηθήσω σήμερα;")}
                className="mt-3 w-full rounded-lg border border-yellow-300/60 py-1 text-xs text-yellow-200"
              >
                DEBUG: δοκιμή φωνής (δεν χρεώνει χρήση)
              </button>
            )}
            {error && <p className="mt-3 break-words text-center text-xs text-red-200">{error}</p>}
          </div>
        </div>
      </div>
    </section>
  );
}