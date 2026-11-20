import { useEffect, useRef } from "react";
import AuraFace from "./AuraFace";
import type { AuraChat } from "./useAuraChat";
import { useLockedViewport, useMediaQuery } from "./useLockedViewport";
import { ChatComposer, ChatMessages, ChatMeter, CloseIcon, MuteIcon, SpeakerIcon } from "./AuraChatParts";
import "./aura-ai.css";

const POP_CSS = `
@keyframes aura-pop { from { opacity: 0; transform: translateY(14px) scale(0.97); } to { opacity: 1; transform: none; } }
.aura-pop { animation: aura-pop 0.22s cubic-bezier(0.16, 1, 0.3, 1) both; }
@media (prefers-reduced-motion: reduce) { .aura-pop { animation: none; } }
`;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

type Props = { chat: AuraChat; onClose: () => void };

/**
 * Το «ελαφρύ» AURA AI: ίδιος χαρακτήρας με lip-sync, ίδια συζήτηση, όρια, κάρτες και φωνή με τη σελίδα /ai.
 * Desktop: κάρτα κάτω δεξιά. Κινητό: πλήρης οθόνη κλειδωμένη πάνω από το πληκτρολόγιο (τύπου Instagram DM).
 */
export default function AuraWidgetPanel({ chat, onClose }: Props) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const vp = useLockedViewport(isMobile);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [chat.messages, chat.loading, vp.keyboard, vp.height]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const { speaking, loading, voiceOn } = chat;
  const status = speaking ? "Μιλάει…" : loading ? "Σκέφτεται…" : "Online";

  const base = vp.height || (typeof window !== "undefined" ? window.innerHeight : 700);
  const avatarH = isMobile ? (vp.keyboard ? clamp(base * 0.3, 140, 200) : clamp(base * 0.38, 200, 380)) : 210;

  const body = (
    <>
      <style>{POP_CSS}</style>

      <div className="relative shrink-0 transition-[height] duration-300 ease-out" style={{ height: avatarH }}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_35%,rgba(150,170,210,0.22),transparent_70%)]" />
        <AuraFace getViseme={chat.getViseme} fit="cover" fadeBottom className="h-full w-full" />

        {/* επάνω μπάρα πάνω στον χαρακτήρα */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent px-3 pb-6 pt-[max(10px,env(safe-area-inset-top))] md:pt-3">
          <div className="flex items-center gap-2 text-[11px] tracking-widest text-slate-200">
            <span className="aai-live" />
            <span className="aai-chrome-text text-sm font-semibold">AURA</span>
            <span className="text-slate-400">{status}</span>
            <span className={`aai-eq ${speaking ? "on" : ""}`}><i /><i /><i /><i /><i /></span>
          </div>
          <div className="flex items-center gap-1.5">
            {chat.messages.length > 0 && (
              <button className="aai-chip" onClick={chat.newChat}>Νέα</button>
            )}
            <button
              className="aai-icon-btn"
              onClick={chat.toggleVoice}
              aria-label={voiceOn ? "Σίγαση" : "Ενεργοποίηση φωνής"}
            >
              {voiceOn ? <SpeakerIcon /> : <MuteIcon />}
            </button>
            <button className="aai-icon-btn" onClick={onClose} aria-label="Κλείσιμο">
              <CloseIcon />
            </button>
          </div>
        </div>
      </div>

      <div ref={listRef} className="aai-scroll min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-3">
        {/* στο κινητό, όταν ανοίγεις μια κάρτα η οθόνη κλείνει ώστε να δεις τη σελίδα */}
        <ChatMessages chat={chat} onNavigate={isMobile ? onClose : undefined} />
      </div>

      <div
        className="shrink-0 border-t border-white/10 bg-black/50 px-3 pt-2"
        style={{ paddingBottom: isMobile ? (vp.keyboard ? 8 : "max(10px, env(safe-area-inset-bottom))") : 12 }}
      >
        <ChatComposer chat={chat} />
        <div className="mt-2"><ChatMeter chat={chat} /></div>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <section
        role="dialog"
        aria-label="AURA AI"
        className="aura-pop fixed inset-x-0 z-[90] flex flex-col overflow-hidden bg-[#030304] text-white"
        style={{ top: vp.top, height: vp.height || "100dvh" }}
      >
        {body}
      </section>
    );
  }

  return (
    <section
      role="dialog"
      aria-label="AURA AI"
      className="aura-pop fixed bottom-24 right-5 z-[80] flex h-[min(680px,calc(100dvh-7.5rem))] w-[400px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-3xl border border-white/15 bg-[#05060a]/95 text-white shadow-[0_30px_90px_-20px_rgba(0,0,0,0.9),0_0_60px_-20px_rgba(160,185,230,0.35)] backdrop-blur-xl"
    >
      {body}
    </section>
  );
}