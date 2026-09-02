import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
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

export const Route = createFileRoute("/academy/")({ component: AcademyPage });

function AcademyPage() {
  const profile = useAsync(getMyProfile, []);
  const feed = useAsync(getAcademyFeed, []);
  const staff = profile.data ? isStaffRole(profile.data.role) : false;

  return (
    <main
      className="relative min-h-screen text-white"
      style={{
        background:
          "radial-gradient(1200px 600px at 50% -10%, rgba(255,255,255,0.05), transparent 60%), #050505",
      }}
    >
      <div className="mx-auto max-w-2xl px-6 py-16">
        <header className="mb-10">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.35em] text-neutral-500">
            <Sparkles size={12} className="text-neutral-400" />
            Academy
          </div>
          <h1
            className="mt-3 bg-gradient-to-b from-white to-neutral-400 bg-clip-text text-4xl font-semibold tracking-tight text-transparent"
          >
            Ανακοινώσεις &amp; Feed
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-neutral-500">
            Νέα, tips και ανακοινώσεις από την ομάδα της AURA. Κάνε like και
            σχολίασε.
          </p>
        </header>

        {profile.error && <ErrorState message={profile.error} />}

        {staff && profile.data && (
          <div className="mb-10">
            <Composer
              authorAvatar={profile.data.avatar_url}
              authorName={profile.data.full_name}
              onPosted={() => feed.reload?.()}
            />
          </div>
        )}

        {feed.loading && <LoadingSkeleton rows={4} />}
        {feed.error && <ErrorState message={feed.error} />}
         {feed.data && feed.data.length === 0 && (
          <EmptyState
            title="Δεν υπάρχουν αναρτήσεις ακόμη"
            hint="Μόλις η ομάδα κάνει το πρώτο post, θα εμφανιστεί εδώ."
          />
        )}

        {feed.data && feed.data.length > 0 && profile.data && (
          <div className="space-y-5">
            {feed.data.map((post) => (
              <PostCardPro
                key={post.id}
                post={post}
                currentUserId={profile.data!.id}
                currentUserRole={profile.data!.role}
                onChanged={() => feed.reload?.()}
              />
            ))}
          </div>
        )}
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
    <div
      className="relative overflow-hidden rounded-2xl border border-white/10 p-5"
      style={{
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.015) 100%)",
      }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

      <div className="flex items-start gap-3.5">
        {authorAvatar ? (
          <img
            src={authorAvatar}
            alt=""
            className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-amber-400/40"
          />
        ) : (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-neutral-700 to-neutral-900 text-xs font-semibold text-neutral-200 ring-2 ring-amber-400/40">
            {authorName?.[0]?.toUpperCase() ?? "A"}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Μοιράσου κάτι με τους μαθητές…"
            rows={3}
            className="w-full resize-none rounded-xl border border-white/10 bg-black/40 p-3.5 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-white/30"
          />

          {imagePreview && (
            <div className="relative mt-3 inline-block">
              <img
                src={imagePreview}
                alt=""
                className="max-h-56 rounded-xl object-cover ring-1 ring-white/10"
              />
              <button
                onClick={() => handlePickImage(null)}
                className="absolute -right-2 -top-2 rounded-full bg-black p-1 text-white/80 ring-1 ring-white/20 hover:text-white"
              >
                <X size={13} />
              </button>
            </div>
          )}

          {err && <p className="mt-2 text-xs text-rose-300">{err}</p>}

          <div className="mt-3.5 flex items-center justify-between">
            <label className="flex cursor-pointer items-center gap-1.5 rounded-full border border-white/12 px-3.5 py-1.5 text-xs text-neutral-400 transition hover:border-white/25 hover:text-white">
              <ImagePlus size={14} />
              Εικόνα
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handlePickImage(e.target.files?.[0] ?? null)}
              />
            </label>

            <button
              onClick={handleSubmit}
              disabled={busy || !content.trim()}
              className="flex items-center gap-1.5 rounded-full bg-gradient-to-b from-neutral-100 to-neutral-300 px-5 py-2 text-xs font-semibold text-black shadow-[0_2px_10px_-2px_rgba(255,255,255,0.35)] transition hover:brightness-110 disabled:opacity-40"
            >
              {busy ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
              Δημοσίευση
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}