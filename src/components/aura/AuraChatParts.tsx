import type { RefObject } from "react";
import AuraChatCards from "@/components/aura/AuraChatCards";
import type { AuraChat } from "./useAuraChat";

const MAX_PIPS = 12; // πάνω από αυτό δείχνουμε αριθμό αντί για κουκκίδες

export const SUGGESTIONS = [
  "Δείξε μου βίντεο Graduation",
  "Τι online σεμινάρια υπάρχουν;",
  "Θέλω να κλείσω σεμινάριο",
  "Τι πλάνα έχετε;",
];

/* ---------------- εικονίδια ---------------- */

export const SpeakerIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 5 6 9H3v6h3l5 4V5z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" />
  </svg>
);
export const MuteIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 5 6 9H3v6h3l5 4V5z" /><path d="m16 9 5 6M21 9l-5 6" />
  </svg>
);
export const SendIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
export const BackIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m15 5-7 7 7 7" />
  </svg>
);
export const CloseIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

/* ---------------- μηνύματα ---------------- */

export function ChatMessages({ chat, onNavigate }: { chat: AuraChat; onNavigate?: () => void }) {
  const { messages, loading, limitReached, voiceIssue, voiceOn, send, replay } = chat;
  const lastIndex = messages.length - 1;

  return (
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
                <button className="aai-icon-btn shrink-0" onClick={() => replay(m.content)} title="Άκουσέ το ξανά">
                  <SpeakerIcon />
                </button>
              )}
            </div>
            {m.cards && m.cards.length > 0 && (
              <div className="max-w-[94%]">
                <AuraChatCards cards={m.cards} onNavigate={onNavigate} />
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
            <button key={s} className="aai-chip" onClick={() => void send(s)}>{s}</button>
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
}

/* ---------------- μετρητής ---------------- */

export function ChatMeter({ chat }: { chat: AuraChat }) {
  const { limit, left } = chat;
  return (
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
}

/* ---------------- πεδίο μηνύματος ---------------- */

export function ChatComposer({ chat, inputRef }: { chat: AuraChat; inputRef?: RefObject<HTMLInputElement> }) {
  const { limitReached, input, setInput, send, loading } = chat;

  if (limitReached) {
    return (
      <a href="/pricing" className="aai-btn block px-4 py-3 text-center">
        Τέλος διαθέσιμων μηνυμάτων — Δες τα πλάνα
      </a>
    );
  }
  return (
    <div className="flex gap-2">
      <input
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && void send()}
        maxLength={500}
        placeholder="Γράψε το μήνυμά σου…"
        enterKeyHint="send"
        autoComplete="off"
        className="aai-input flex-1 px-4 py-3"
        style={{ fontSize: 16 }} /* 16px: το iOS δεν κάνει zoom όταν εστιάζεις */
      />
      <button
        onPointerDown={(e) => e.preventDefault()} /* το πληκτρολόγιο μένει ανοιχτό μετά την αποστολή */
        onClick={() => void send()}
        disabled={loading}
        className="aai-btn flex items-center px-4"
        aria-label="Αποστολή"
      >
        <SendIcon />
      </button>
    </div>
  );
}