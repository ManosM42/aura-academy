// src/components/aura/MessageNotifications.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { MessageCircle, ShieldCheck, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { isAdminRole } from "@/lib/roles";
import { getProfileById } from "@/lib/messagingQueries";
import type { Message } from "@/lib/messaging.types";

interface ToastItem {
  id: string; // message id — χρησιμοποιείται για dedupe/dismiss
  conversationId: string;
  senderName: string;
  senderAvatar: string | null;
  senderRole: string;
  content: string;
}

const AUTO_DISMISS_MS = 5000;
const MAX_STACK = 4;

/**
 * Mount ΜΙΑ φορά, κάπου global (π.χ. μέσα στο Navbar.tsx ή στο root
 * layout), ώστε να δουλεύει σε ΟΛΕΣ τις σελίδες, όχι μόνο στο /messages.
 */
export default function MessageNotifications() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const routerState = useRouterState();

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const profileCache = useRef(
    new Map<string, { full_name: string | null; avatar_url: string | null; role: string }>(),
  );

  // Κρατάμε το routerState σε ref ώστε το realtime callback (που δεν
  // ξανα-δημιουργείται σε κάθε render) να βλέπει πάντα την τρέχουσα σελίδα.
  const routerStateRef = useRef(routerState);
  useEffect(() => {
    routerStateRef.current = routerState;
  }, [routerState]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    if (!profile) return;

    const channel = supabase
      .channel(`global-notifications:${profile.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          const row = payload.new as Message;
          if (row.sender_id === profile.id) return;

          // Μην δείξεις toast αν είσαι ήδη ΜΕΣΑ σε αυτή την ακριβώς
          // συνομιλία στο /messages.
          const loc = routerStateRef.current.location;
          const activeWith = (loc.search as { with?: string } | undefined)?.with;
          if (loc.pathname === "/messages" && activeWith === row.conversation_id) {
            return;
          }

          let sender = profileCache.current.get(row.sender_id);
          if (!sender) {
            try {
              const p = await getProfileById(row.sender_id);
              sender = {
                full_name: p.full_name,
                avatar_url: p.avatar_url,
                role: p.role,
              };
              profileCache.current.set(row.sender_id, sender);
            } catch {
              sender = { full_name: "Χρήστης", avatar_url: null, role: "student" };
            }
          }

          const toast: ToastItem = {
            id: row.id,
            conversationId: row.conversation_id,
            senderName: sender.full_name ?? "Χρήστης",
            senderAvatar: sender.avatar_url,
            senderRole: sender.role,
            content: row.content,
          };

          setToasts((prev) => [...prev, toast].slice(-MAX_STACK));
          setTimeout(() => dismiss(toast.id), AUTO_DISMISS_MS);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, dismiss]);

  function handleOpen(toast: ToastItem) {
    dismiss(toast.id);
    navigate({ to: "/messages", search: { with: toast.conversationId } });
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 0.95 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-b from-[#141414] to-[#0a0a0a] shadow-[0_10px_40px_rgba(0,0,0,0.6)]"
          >
            <div
              onClick={() => handleOpen(t)}
              className="flex cursor-pointer items-center gap-3 px-4 py-3 pr-9 transition hover:bg-white/[0.04]"
            >
              {t.senderAvatar ? (
                <img
                  src={t.senderAvatar}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-white/15"
                />
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white/70">
                  {t.senderName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 truncate text-sm font-medium text-white">
                  {t.senderName}
                  {isAdminRole(t.senderRole) && (
                    <ShieldCheck size={12} className="text-white/60" />
                  )}
                </p>
                <p className="truncate text-xs text-white/50">{t.content}</p>
              </div>
              <MessageCircle size={16} className="shrink-0 text-white/40" />
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                dismiss(t.id);
              }}
              aria-label="Κλείσιμο"
              className="absolute right-2 top-2 rounded-full p-1 text-white/30 transition hover:bg-white/10 hover:text-white"
            >
              <X size={13} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}