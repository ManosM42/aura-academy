// src/components/aura/UserProfileModal.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import {
  Instagram,
  Loader2,
  MapPin,
  MessageCircle,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  getOrCreateDirectConversation,
  getProfileById,
} from "@/lib/messagingQueries";
import { isAdminRole } from "@/lib/roles";
import type { Profile } from "@/lib/database.types";

export default function UserProfileModal({
  userId,
  onClose,
}: {
  userId: string;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getProfileById(userId)
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function handleMessage() {
    setSending(true);
    setError(null);
    try {
      const conversationId = await getOrCreateDirectConversation(userId);
      onClose();
      navigate({ to: "/messages", search: { with: conversationId } });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.97 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-b from-[#111] to-[#070707] shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
        >
          <button
            onClick={onClose}
            className="absolute right-3 top-3 z-10 rounded-full bg-black/50 p-1.5 text-white/70 transition hover:bg-white hover:text-black"
          >
            <X size={15} />
          </button>

          {loading && (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="animate-spin text-white/50" />
            </div>
          )}

          {error && !loading && !profile && (
            <p className="p-6 text-sm text-rose-400">{error}</p>
          )}

          {profile && !loading && (
            <div>
              <div className="h-20 bg-gradient-to-r from-white/10 via-white/5 to-transparent" />
              <div className="-mt-10 px-6 pb-6">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt=""
                    className="h-20 w-20 rounded-full object-cover ring-4 ring-[#0a0a0a]"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10 text-xl font-semibold text-white/80 ring-4 ring-[#0a0a0a]">
                    {profile.full_name?.[0]?.toUpperCase() ?? "?"}
                  </div>
                )}

                <div className="mt-3 flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-white">
                    {profile.full_name ?? "Χρήστης"}
                  </h2>
                  {isAdminRole(profile.role) && (
                    <ShieldCheck size={16} className="text-white/70" />
                  )}
                </div>

                {profile.headline && (
                  <p className="mt-0.5 text-sm text-white/50">
                    {profile.headline}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-3 text-xs text-white/40">
                  {profile.city && (
                    <span className="flex items-center gap-1">
                      <MapPin size={12} /> {profile.city}
                    </span>
                  )}
                  {profile.instagram && (
                    <span className="flex items-center gap-1">
                      <Instagram size={12} /> {profile.instagram}
                    </span>
                  )}
                </div>

                {profile.bio && (
                  <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-white/70">
                    {profile.bio}
                  </p>
                )}

                {error && (
                  <p className="mt-3 text-xs text-rose-400">{error}</p>
                )}

                <button
                  onClick={handleMessage}
                  disabled={sending}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-black transition hover:bg-white/90 disabled:opacity-50"
                >
                  {sending ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <MessageCircle size={14} />
                  )}
                  Στείλε μήνυμα
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}