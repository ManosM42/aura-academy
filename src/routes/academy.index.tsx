import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "motion/react";
import { ImagePlus, Loader2, Send, Sparkles, X } from "lucide-react";
import {
  createAcademyPost,
  getAcademyFeed,
  getMyProfile,
  isStaffRole,
} from "@/lib/queries";
import { useAsync } from "@/lib/useAsync";
import { ErrorState, LoadingSkeleton, EmptyState } from "@/components/aura/States";
import PostCardPro from "@/components/aura/PostCardPro";
import OnlineUsersPanel from "@/components/aura/OnlineUsersPanel";

export const Route = createFileRoute("/academy/")({ component: AcademyPage });

function AcademyPage() {
  const profile = useAsync(getMyProfile, []);
  const feed = useAsync(getAcademyFeed, []);
  const staff = profile.data ? isStaffRole(profile.data.role) : false;

  return (
        <main className="w-full min-h-screen overflow-x-hidden bg-[#070707] px-4 sm:px-6 md:px-10 py-28 sm:py-36 text-white selection:bg-white selection:text-black">
      <div className="mx-auto flex max-w-6xl items-start gap-8">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto max-w-2xl flex-1 space-y-10"
        >
        <header>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-white/50 mb-3">
            <span className="h-px w-8 bg-gradient-to-r from-white/60 to-transparent" />
            Academy Feed
          </div>
          <h1 className="text-4xl font-extrabold uppercase tracking-tight sm:text-5xl text-white">
            Ανακοινώσεις &amp; <span className="chrome-type font-semibold">Feed</span>
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-white/60 sm:text-base">
            Νέα, tips και ανακοινώσεις από την ομάδα της AURA. Κάνε like και
            σχολίασε.
          </p>
        </header>

        {profile.error && <ErrorState message={profile.error} />}

        {staff && profile.data && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Composer
              authorAvatar={profile.data.avatar_url}
              authorName={profile.data.full_name}
              onPosted={() => feed.reload?.()}
            />
          </motion.div>
        )}

        {feed.loading && <LoadingSkeleton rows={4} />}
        {feed.error && <ErrorState message={feed.error} />}
        
        {feed.data && feed.data.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center backdrop-blur-xl">
            <EmptyState
              title="Δεν υπάρχουν αναρτήσεις ακόμη"
              hint="Μόλις η ομάδα κάνει το πρώτο post, θα εμφανιστεί εδώ."
            />
          </div>
        )}

        {feed.data && feed.data.length > 0 && profile.data && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="space-y-6"
          >
            {feed.data.map((post) => (
              <PostCardPro
                key={post.id}
                post={post}
                currentUserId={profile.data!.id}
                currentUserRole={profile.data!.role}
                onChanged={() => feed.reload?.()}
              />
            ))}
          </motion.div>
        )}
           </motion.div>

        <OnlineUsersPanel />
      </div>
    </main>
  );
}


function Composer({
  authorAvatar,
  authorName,
  onPosted,
}: {
  authorAvatar: string | null;
  authorName: string | null;
  onPosted: () => void;
}) {
  const [content, setContent] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function handlePickImage(file: File | null) {
    setImage(file);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(file ? URL.createObjectURL(file) : null);
  }

  async function handleSubmit() {
    if (!content.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await createAcademyPost(content.trim(), image ?? undefined);
      setContent("");
      handlePickImage(null);
      onPosted();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div
      whileHover={{ border: "1px solid rgba(255,255,255,0.25)" }}
      transition={{ duration: 0.2 }}
      className="relative overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-b from-white/[0.06] to-white/[0.01] p-6 backdrop-blur-xl shadow-[0_4px_30px_rgba(0,0,0,0.5)]"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

      <div className="flex items-start gap-4">
        {authorAvatar ? (
          <img
            src={authorAvatar}
            alt=""
            className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-white/30 shadow-[0_0_15px_rgba(255,255,255,0.1)]"
          />
        ) : (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-white/20 to-white/5 text-xs font-semibold text-white ring-2 ring-white/30 shadow-[0_0_15px_rgba(255,255,255,0.1)]">
            {authorName?.[0]?.toUpperCase() ?? "A"}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Μοιράσου κάτι με τους μαθητές…"
            rows={3}
            className="w-full resize-none rounded-xl border border-white/10 bg-black/50 p-4 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-white/40 focus:bg-black/80 focus:shadow-[0_0_20px_rgba(255,255,255,0.05)]"
          />

          {imagePreview && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative mt-3 inline-block"
            >
              <img
                src={imagePreview}
                alt=""
                className="max-h-56 rounded-xl object-cover ring-1 ring-white/20 shadow-lg"
              />
              <button
                onClick={() => handlePickImage(null)}
                className="absolute -right-2 -top-2 rounded-full bg-black p-1.5 text-white ring-1 ring-white/30 hover:bg-white hover:text-black transition-all shadow-md"
              >
                <X size={13} />
              </button>
            </motion.div>
          )}

          {err && <p className="mt-2 text-xs text-rose-400">{err}</p>}

          <div className="mt-4 flex items-center justify-between">
            <label className="flex cursor-pointer items-center gap-2 rounded-full border border-white/20 bg-white/[0.03] px-4 py-2 text-xs font-medium text-white/80 transition-all hover:border-white/40 hover:bg-white/[0.08] hover:text-white shadow-[0_0_15px_rgba(255,255,255,0.02)]">
              <ImagePlus size={14} />
              <span>Εικόνα</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handlePickImage(e.target.files?.[0] ?? null)}
              />
            </label>

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleSubmit}
              disabled={busy || !content.trim()}
              className="flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-black shadow-[0_0_25px_rgba(255,255,255,0.2)] transition-all hover:bg-white/90 disabled:opacity-40 disabled:hover:scale-100"
            >
              {busy ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
              <span>Δημοσίευση</span>
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}