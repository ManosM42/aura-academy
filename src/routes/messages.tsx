// src/routes/messages.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "motion/react";
import { ArrowLeft, Loader2, Send, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import { isAdminRole } from "@/lib/roles";
import {
  getConversationMessages,
  getMyConversations,
  markConversationRead,
  sendMessage,
} from "@/lib/messagingQueries";
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

function MessagesPage() {
  const { profile, loading: authLoading, session } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [convLoading, setConvLoading] = useState(true);
  const [convError, setConvError] = useState<string | null>(null);

  const [activeId, setActiveId] = useState<string | null>(search.with ?? null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(
    null,
  );
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadConversations = useCallback(async () => {
    setConvLoading(true);
    setConvError(null);
    try {
      const rows = await getMyConversations();
      setConversations(rows);
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

  // Φόρτωση μηνυμάτων + realtime subscribe στην ενεργή συνομιλία
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
          setMessages((prev) =>
            prev.some((m) => m.id === row.id) ? prev : [...prev, row],
          );
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

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, otherTyping]);

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
    try {
      await sendMessage(activeId, content);
    } catch (e) {
      setConvError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  const activeConversation = useMemo(
    () => conversations.find((c) => c.conversationId === activeId) ?? null,
    [conversations, activeId],
  );

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
    <main className="w-full min-h-screen overflow-hidden bg-[#070707] px-4 py-24 text-white sm:px-6 sm:py-28 md:px-10">
      <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-6xl gap-4">
        {/* Chat area: Στο mobile φαίνεται ΜΟΝΟ αν υπάρχει ενεργή συνομιλία (!activeId hides it, activeId shows it) */}
        <section
          className={`flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.03] to-transparent backdrop-blur-xl ${
            !activeId ? "hidden sm:flex" : "flex"
          }`}
        >
          {activeConversation ? (
            <>
              <header className="flex items-center gap-3 border-b border-white/10 px-4 sm:px-5 py-4">
                {/* Κουμπί επιστροφής (Back Arrow) μόνο για mobile */}
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
                    {activeConversation.otherUser?.full_name
                      ?.charAt(0)
                      .toUpperCase() ?? "?"}
                  </div>
                )}
                <div className="min-w-0">
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
              </header>

              <div
                ref={scrollRef}
                className="flex-1 space-y-2 overflow-y-auto px-5 py-4"
              >
                {msgLoading && <LoadingSkeleton rows={3} />}
                {!msgLoading && messages.length === 0 && (
                  <EmptyState
                    title="Καμία συνομιλία ακόμη"
                    hint="Στείλε το πρώτο μήνυμα!"
                  />
                )}
                {messages.map((m) => {
                  const mine = m.sender_id === profile.id;
                  return (
                    <div
                      key={m.id}
                      className={`flex ${mine ? "justify-end" : "justify-start"}`}
                    >
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
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

              <div className="flex items-center gap-2 border-t border-white/10 px-4 py-3">
                <input
                  value={text}
                  onChange={(e) => handleTextChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Γράψε μήνυμα…"
                  className="flex-1 rounded-full border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-white/30"
                />
                <button
                  onClick={handleSend}
                  disabled={sending || !text.trim()}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-black transition hover:bg-white/90 disabled:opacity-40"
                >
                  {sending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Send size={16} />
                  )}
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

        {/* Λίστα συνομιλιών: Στο mobile φαίνεται πλήρης ΟΤΑΝ ΔΕΝ υπάρχει ενεργή συνομιλία (activeId is null), και γίνεται hidden όταν ανοίγει το chat */}
        <aside
          className={`w-full shrink-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-xl sm:flex sm:w-80 ${
            activeId ? "hidden sm:flex" : "flex"
          }`}
        >
          <div className="border-b border-white/10 px-5 py-4">
            <p className="text-xs uppercase tracking-[0.25em] text-white/50">
              Μηνύματα
            </p>
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
                    navigate({
                      to: "/messages",
                      search: { with: c.conversationId },
                    });
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 sm:py-2.5 text-left transition ${
                    active ? "bg-white/10" : "hover:bg-white/[0.06]"
                  }`}
                >
                  {c.otherUser?.avatar_url ? (
                    <img
                      src={c.otherUser.avatar_url}
                      alt=""
                      className="h-11 w-11 sm:h-10 sm:w-10 shrink-0 rounded-full object-cover ring-1 ring-white/15"
                    />
                  ) : (
                    <div className="flex h-11 w-11 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white/70">
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
                    <p className="truncate text-xs text-white/40 mt-0.5">
                      {c.lastMessage?.content ?? "Νέα συνομιλία"}
                    </p>
                  </div>
                  {c.unread && (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-white" />
                  )}
                </button>
              );
            })}
          </div>
        </aside>
      </div>
    </main>
  );
}