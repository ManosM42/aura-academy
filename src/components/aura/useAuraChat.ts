import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client"; // ← προσαρμόσε στο δικό σου path
import { speakable, type AuraCard } from "@/components/aura/AuraChatCards";
import { useAuraSpeech } from "@/hooks/useAuraSpeech";

export type Msg = { role: "user" | "assistant"; content: string; cards?: AuraCard[] };

export const DEFAULT_LIMIT = 10; // μέχρι να απαντήσει ο server με το πραγματικό όριο
const STORE_KEY = "aura_chat_v2";

type Saved = { messages: Msg[]; remaining: number | null; limit: number; limitReached: boolean };

function loadSaved(): Saved | null {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Saved;
    if (!Array.isArray(s.messages)) return null;
    return {
      messages: s.messages.slice(-20),
      remaining: typeof s.remaining === "number" ? s.remaining : null,
      limit: typeof s.limit === "number" ? s.limit : DEFAULT_LIMIT,
      limitReached: !!s.limitReached,
    };
  } catch {
    return null;
  }
}

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

/**
 * Όλη η λογική του AURA AI σε ένα σημείο: η σελίδα /ai και το floating widget μοιράζονται
 * την ίδια συζήτηση, το ίδιο όριο μηνυμάτων, τις ίδιες κάρτες και την ίδια φωνή.
 *
 * `canSpeak`: το widget μιλά μόνο όταν είναι ανοιχτό.
 */
export function useAuraChat(opts: { canSpeak?: () => boolean } = {}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [limitReached, setLimitReached] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [ready, setReady] = useState(false);

  const canSpeakRef = useRef(opts.canSpeak);
  canSpeakRef.current = opts.canSpeak;

  const { speak, stop, speaking, voiceIssue, getViseme } = useAuraSpeech();

  // φόρτωση της αποθηκευμένης συζήτησης (μόνο στον browser, ώστε να μην χαλάει το SSR)
  useEffect(() => {
    const s = loadSaved();
    if (s) {
      setMessages(s.messages);
      setRemaining(s.remaining);
      setLimit(s.limit);
      setLimitReached(s.limitReached);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      sessionStorage.setItem(
        STORE_KEY,
        JSON.stringify({ messages: messages.slice(-20), remaining, limit, limitReached } satisfies Saved),
      );
    } catch {
      /* ignore */
    }
  }, [ready, messages, remaining, limit, limitReached]);

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
      // η φωνή διαβάζει μόνο τις πρώτες προτάσεις (λιγότερη κατανάλωση TTS)
      if (voiceOn && (canSpeakRef.current ? canSpeakRef.current() : true)) void speak(speakable(finalReply));
    } finally {
      setLoading(false);
    }
  }

  function newChat() {
    stop();
    setMessages([]);
  }

  function toggleVoice() {
    if (voiceOn) stop();
    setVoiceOn(!voiceOn);
  }

  function replay(text: string) {
    void speak(speakable(text));
  }

  return {
    ready,
    messages,
    input,
    setInput,
    loading,
    remaining,
    limit,
    limitReached,
    left: remaining ?? limit,
    voiceOn,
    toggleVoice,
    speaking,
    voiceIssue,
    getViseme,
    stopVoice: stop,
    send,
    newChat,
    replay,
  };
}

export type AuraChat = ReturnType<typeof useAuraChat>;