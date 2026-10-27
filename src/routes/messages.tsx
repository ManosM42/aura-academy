// src/routes/messages.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Loader2,
  Phone,
  PhoneMissed,
  Send,
  ShieldCheck,
  Video as VideoIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import { isAdminRole } from "@/lib/roles";
import {
  getConversationMessages,
  getMyConversations,
  markConversationRead,
  sendMessage,
} from "@/lib/messagingQueries";
import { describeCall, getCallLogs, type CallLog } from "@/lib/call-logs";
import { useCall } from "@/components/aura/CallProvider";
import type { ConversationSummary, Message } from "@/lib/messaging.types";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/aura/States";

interface MessagesSearch {
  with?: string;
}

export const Route = createFileRoute("/messages")({
  component: MessagesPage,
  validateSearch: (search: Record<string, unknown>): MessagesSearch => ({
    with: typeof search.with === "string" ? search.with : undefined,
  }),
});

/* ---------- mobile helpers ---------- */

function useIsMobile() {
  const [mobile, setMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const h = () => setMobile(mq.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);
  return mobile;
}

/** Tracks the *visible* area (shrinks when the mobile keyboard opens). */
function useVisualViewport(enabled: boolean) {
  const [vp, setVp] = useState({ height: 0, top: 0 });
  useEffect(() => {
    if (!enabled) return;
    const vv = window.visualViewport;
    const update = () => {
      setVp({ height: vv?.height ?? window.innerHeight, top: vv?.offsetTop ?? 0 });
      window.scrollTo(0, 0); // iOS tries to scroll the page when the keyboard opens
    };
    update();
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    window.addEventListener("orientationchange", update);
    return () => {
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("orientationchange", update);
    };
  }, [enabled]);
  return vp;
}

/** Freezes the page behind the chat (no background scroll / rubber-banding). */
function useBodyLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const html = document.documentElement;
    const body = document.body;
    const prev = {
      htmlOverflow: html.style.overflow,
      overflow: body.style.overflow,
      position: body.style.position,
      width: body.style.width,
      top: body.style.top,
    };
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.width = "100%";
    body.style.top = "0";
    return () => {
      html.style.overflow = prev.htmlOverflow;
      body.style.overflow = prev.overflow;
      body.style.position = prev.position;
      body.style.width = prev.width;
      body.style.top = prev.top;
    };
  }, [locked]);
}

type TimelineItem =
  | { type: "message"; at: string; message: Message }
  | { type: "call"; at: string; call: CallLog };

function MessagesPage() {
  const { profile, loading: authLoading, session } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { startCall, busy: inCall } = useCall();

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [convLoading, setConvLoading] = useState(true);
  const [convError, setConvError] = useState<string | null>(null);

  const [activeId, setActiveId] = useState<string | null>(search.with ?? null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mobile + chat open = "locked" full-screen chat (like Instagram)
  const isMobile = useIsMobile();
  const locked = isMobile && !!activeId;
  useBodyLock(locked);
  const vp = useVisualViewport(locked);

  const loadConversations = useCallback(async () => {
    setConvLoading(true);
    setConvError(null);
    try {
      setConversations(await getMyConversations());
    } catch (e) {
      setConvError((e as Error).message);
    } finally {
      setConvLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!profile) return;
    loadConversations();
  }, [profile, loadConversations]);

  useEffect(() => {
    if (search.with) setActiveId(search.with);
  }, [search.with]);

  useEffect(() => {
    if (!activeId) return;
    if (!conversations.some((c) => c.conversationId === activeId)) {
      loadConversations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  // Messages + realtime
  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setMsgLoading(true);
    getConversationMessages(activeId)
      .then((rows) => {
        if (!cancelled) setMessages(rows);
      })
      .catch((e) => setConvError((e as Error).message))
      .finally(() => {
        if (!cancelled) setMsgLoading(false);
      });

    markConversationRead(activeId).catch(() => {});

    const channel = supabase
      .channel(`messages:${activeId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${activeId}`,
        },
        (payload) => {
          const row = payload.new as Message;
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
          if (row.sender_id !== profile?.id) {
            markConversationRead(activeId).catch(() => {});
          }
          loadConversations();
        },
      )
      .on("broadcast", { event: "typing" }, (payload) => {
        const p = payload.payload as { user_id: string; is_typing: boolean };
        if (p.user_id !== profile?.id) setOtherTyping(p.is_typing);
      })
      .subscribe();

    typingChannelRef.current = channel;

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      typingChannelRef.current = null;
      setOtherTyping(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, profile?.id]);

  // Call history inside the chat + realtime
  useEffect(() => {
    if (!activeId) {
      setCalls([]);
      return;
    }
    let cancelled = false;
    getCallLogs(activeId).then((rows) => {
      if (!cancelled) setCalls(rows);
    });
    const ch = supabase
      .channel(`call_logs:${activeId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "call_logs",
          filter: `conversation_id=eq.${activeId}`,
        },
        (payload) => {
          const row = payload.new as CallLog;
          if (!row?.id) return;
          setCalls((prev) =>
            prev.some((c) => c.id === row.id)
              ? prev.map((c) => (c.id === row.id ? row : c))
              : [...prev, row],
          );
        },
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [activeId]);

  const timeline = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = [
      ...messages.map((m) => ({ type: "message" as const, at: m.created_at, message: m })),
      ...calls.map((c) => ({ type: "call" as const, at: c.created_at, call: c })),
    ];
    return items.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  }, [messages, calls]);

  // Stay glued to the bottom (new messages, typing, keyboard open/close)
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [timeline.length, otherTyping]);
  useEffect(() => {
    if (!locked) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [vp.height, locked]);

  function broadcastTyping(isTyping: boolean) {
    typingChannelRef.current?.send({
      type: "broadcast",
      event: "typing",
      payload: { user_id: profile?.id, is_typing: isTyping },
    });
  }

  function handleTextChange(value: string) {
    setText(value);
    broadcastTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => broadcastTyping(false), 1800);
  }

  async function handleSend() {
    if (!activeId || !text.trim()) return;
    setSending(true);
    const content = text.trim();
    setText("");
    broadcastTyping(false);
    inputRef.current?.focus(); // keep the keyboard open after sending
    try {
      await sendMessage(activeId, content);
    } catch (e) {
      setConvError((e as Error).message);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  const activeConversation = useMemo(
    () => conversations.find((c) => c.conversationId === activeId) ?? null,
    [conversations, activeId],
  );

  function dial(kind: "audio" | "video") {
    const other = activeConversation?.otherUser;
    if (!other || !activeId || inCall) return;
    // NOTE: assumes otherUser has an `id` (the other person's user id)
    void startCall(
      { id: other.id, name: other.full_name ?? "Χρήστης", avatar: other.avatar_url ?? null },
      activeId,
      kind,
    );
  }

  if (authLoading) {
    return (
      <main className="mx-auto min-h-screen max-w-6xl px-4 py-28 text-white">
        <LoadingSkeleton rows={4} />
      </main>
    );
  }

  if (!session || !profile) {
    return (
      <main className="mx-auto min-h-screen max-w-2xl px-6 py-28 text-white">
        <ErrorState message="Πρέπει να συνδεθείς για να δεις τα μηνύματά σου." />
      </main>
    );
  }

  return (
    <main
      style={locked ? { height: vp.height || "100dvh", top: vp.top } : undefined}
      className={
        locked
          ? "fixed inset-x-0 z-[60] overflow-hidden bg-[#070707] text-white"
          : "w-full min-h-screen overflow-hidden bg-[#070707] px-4 py-24 text-white sm:px-6 sm:py-28 md:px-10"
      }
    >
      <div
        className={
          locked
            ? "flex h-full w-full"
            : "mx-auto flex h-[calc(100vh-8rem)] max-w-6xl gap-4"
        }
      >
        {/* Chat area */}
        <section
          className={`flex min-w-0 flex-1 flex-col overflow-hidden backdrop-blur-xl ${
            locked
              ? "bg-[#070707]"
              : "rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.03] to-transparent"
          } ${!activeId ? "hidden sm:flex" : "flex"}`}
        >
          {activeConversation ? (
            <>
              <header
                className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-3 sm:px-5 sm:py-4"
                style={locked ? { paddingTop: "max(0.75rem, env(safe-area-inset-top))" } : undefined}
              >
                <button
                  onClick={() => {
                    setActiveId(null);
                    navigate({ to: "/messages", search: {} });
                  }}
                  aria-label="Επιστροφή στις συνομιλίες"
                  className="mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:hidden"
                >
                  <ArrowLeft size={18} />
                </button>

                {activeConversation.otherUser?.avatar_url ? (
                  <img
                    src={activeConversation.otherUser.avatar_url}
                    alt=""
                    className="h-9 w-9 rounded-full object-cover ring-1 ring-white/15"
                  />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white/70">
                    {activeConversation.otherUser?.full_name?.charAt(0).toUpperCase() ?? "?"}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-medium text-white">
                    {activeConversation.otherUser?.full_name ?? "Χρήστης"}
                    {activeConversation.otherUser &&
                      isAdminRole(activeConversation.otherUser.role) && (
                        <ShieldCheck size={13} className="text-white/60" />
                      )}
                  </p>
                  <p className="text-xs text-white/40">
                    {otherTyping ? "πληκτρολογεί…" : "Active"}
                  </p>
                </div>

                <button
                  onClick={() => dial("audio")}
                  disabled={inCall}
                  aria-label="Ηχητική κλήση"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-40"
                >
                  <Phone size={16} />
                </button>
                <button
                  onClick={() => dial("video")}
                  disabled={inCall}
                  aria-label="Βιντεοκλήση"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-40"
                >
                  <VideoIcon size={16} />
                </button>
              </header>

              <div
                ref={scrollRef}
                className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5"
              >
                {msgLoading && <LoadingSkeleton rows={3} />}
                {!msgLoading && timeline.length === 0 && (
                  <EmptyState title="Καμία συνομιλία ακόμη" hint="Στείλε το πρώτο μήνυμα!" />
                )}
                {timeline.map((item) => {
                  if (item.type === "call") {
                    const { label, missed } = describeCall(item.call, profile.id);
                    const Icon = missed ? PhoneMissed : item.call.kind === "video" ? VideoIcon : Phone;
                    return (
                      <div key={`call-${item.call.id}`} className="flex justify-center py-1">
                        <div
                          className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs ${
                            missed
                              ? "border-red-400/30 bg-red-500/10 text-red-300"
                              : "border-white/10 bg-white/[0.04] text-white/60"
                          }`}
                        >
                          <Icon size={13} />
                          {label}
                        </div>
                      </div>
                    );
                  }
                  const m = item.message;
                  const mine = m.sender_id === profile.id;
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        className={`max-w-[78%] break-words rounded-2xl px-4 py-2.5 text-sm leading-relaxed sm:max-w-[70%] ${
                          mine
                            ? "rounded-br-sm bg-white text-black"
                            : "rounded-bl-sm bg-white/10 text-white"
                        }`}
                      >
                        {m.content}
                      </motion.div>
                    </div>
                  );
                })}
                {otherTyping && (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-white/10 px-4 py-3">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/60 [animation-delay:-0.2s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/60" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/60 [animation-delay:0.2s]" />
                    </div>
                  </div>
                )}
              </div>

              {/* Input bar: always the last flex child, so it rides on top of the keyboard */}
              <div
                className="flex shrink-0 items-center gap-2 border-t border-white/10 bg-[#070707]/80 px-4 py-3"
                style={locked ? { paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" } : undefined}
              >
                <input
                  ref={inputRef}
                  value={text}
                  onChange={(e) => handleTextChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  enterKeyHint="send"
                  autoComplete="off"
                  placeholder="Γράψε μήνυμα…"
                  // text-base (16px) stops iOS from zooming the page on focus
                  className="min-w-0 flex-1 rounded-full border border-white/10 bg-black/40 px-4 py-2.5 text-base text-white outline-none placeholder:text-white/30 focus:border-white/30 sm:text-sm"
                />
                <button
                  onPointerDown={(e) => e.preventDefault()} // don't steal focus -> keyboard stays open
                  onClick={handleSend}
                  disabled={sending || !text.trim()}
                  aria-label="Αποστολή"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-black transition hover:bg-white/90 disabled:opacity-40"
                >
                  {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <EmptyState
                title="Διάλεξε μια συνομιλία"
                hint="Επίλεξε χρήστη από τη λίστα για να ξεκινήσεις."
              />
            </div>
          )}
        </section>

        {/* Conversation list */}
        <aside
          className={`w-full shrink-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-xl sm:flex sm:w-80 ${
            activeId ? "hidden sm:flex" : "flex"
          }`}
        >
          <div className="border-b border-white/10 px-5 py-4">
            <p className="text-xs uppercase tracking-[0.25em] text-white/50">Μηνύματα</p>
          </div>
          <div className="flex-1 overflow-y-auto px-2 py-3">
            {convLoading && <LoadingSkeleton rows={4} />}
            {convError && <ErrorState message={convError} />}
            {!convLoading && conversations.length === 0 && (
              <p className="px-3 py-6 text-center text-xs text-white/30">
                Δεν έχεις ανοίξει συνομιλία ακόμη.
              </p>
            )}
            {conversations.map((c) => {
              const active = c.conversationId === activeId;
              return (
                <button
                  key={c.conversationId}
                  onClick={() => {
                    setActiveId(c.conversationId);
                    navigate({ to: "/messages", search: { with: c.conversationId } });
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition sm:py-2.5 ${
                    active ? "bg-white/10" : "hover:bg-white/[0.06]"
                  }`}
                >
                  {c.otherUser?.avatar_url ? (
                    <img
                      src={c.otherUser.avatar_url}
                      alt=""
                      className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-white/15 sm:h-10 sm:w-10"
                    />
                  ) : (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white/70 sm:h-10 sm:w-10">
                      {c.otherUser?.full_name?.charAt(0).toUpperCase() ?? "?"}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1 truncate text-sm font-medium text-white/90">
                      {c.otherUser?.full_name ?? "Χρήστης"}
                      {c.otherUser && isAdminRole(c.otherUser.role) && (
                        <ShieldCheck size={12} className="text-white/50" />
                      )}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-white/40">
                      {c.lastMessage?.content ?? "Νέα συνομιλία"}
                    </p>
                  </div>
                  {c.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-white" />}
                </button>
              );
            })}
          </div>
        </aside>
      </div>
    </main>
  );
}