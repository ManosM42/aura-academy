import { useState } from "react";
import { Crown, Heart, MessageCircle, Send, Trash2 } from "lucide-react";
import {
  addAcademyPostComment,
  deleteAcademyPost,
  toggleAcademyPostLike,
  isStaffRole,
  type AcademyPost,
} from "@/lib/queries";

const ROLE_LABEL: Record<string, string> = {
  student: "Student",
  educator: "Educator",
  senior_educator: "Senior Educator",
  content_manager: "Content Manager",
  operations: "Operations",
  admin: "Admin",
  super_admin: "Super Admin",
};

function initials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "τώρα";
  if (mins < 60) return `${mins}λ`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}ω`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}μ`;
  return new Date(iso).toLocaleDateString("el-GR");
}

function Avatar({
  url,
  name,
  size = 44,
  ring = "ring-white/15",
}: {
  url: string | null | undefined;
  name: string | null | undefined;
  size?: number;
  ring?: string;
}) {
  if (url) {
    return (
      <img
        src={url}
        alt={name ?? ""}
        style={{ width: size, height: size }}
        className={`shrink-0 rounded-full object-cover ring-2 ${ring}`}
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size }}
      className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-neutral-700 to-neutral-900 text-xs font-semibold text-neutral-200 ring-2 ${ring}`}
    >
      {initials(name ?? null)}
    </div>
  );
}

export default function PostCardPro({
  post,
  currentUserId,
  currentUserRole,
  onChanged,
}: {
  post: AcademyPost;
  currentUserId: string;
  currentUserRole: string;
  onChanged: () => void;
}) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [busy, setBusy] = useState(false);

  const liked = post.likes.some((l) => l.user_id === currentUserId);
  const authorIsStaff = post.author ? isStaffRole(post.author.role) : false;
  const canDelete =
    post.author?.id === currentUserId || isStaffRole(currentUserRole);

  async function handleLike() {
    setBusy(true);
    try {
      await toggleAcademyPostLike(post.id, liked);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function handleComment() {
    if (!commentText.trim()) return;
    setBusy(true);
    try {
      await addAcademyPostComment(post.id, commentText.trim());
      setCommentText("");
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Διαγραφή αυτής της ανάρτησης;")) return;
    setBusy(true);
    try {
      await deleteAcademyPost(post.id);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <article
      className="group relative overflow-hidden rounded-2xl border p-6 shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset]"
      style={{
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.035) 0%, rgba(255,255,255,0.01) 100%)",
        borderImage:
          "linear-gradient(135deg, rgba(220,220,225,0.35), rgba(255,255,255,0.04) 40%, rgba(180,180,190,0.18) 100%) 1",
        borderWidth: 1,
        borderStyle: "solid",
      }}
    >
      {/* πάνω chrome hairline */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

      <header className="flex items-start gap-3.5">
        <Avatar
          url={post.author?.avatar_url}
          name={post.author?.full_name}
          ring={authorIsStaff ? "ring-amber-400/40" : "ring-white/12"}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-semibold tracking-tight text-white">
              {post.author?.full_name ?? "Άγνωστος"}
            </span>
            {authorIsStaff && (
              <span
                title={ROLE_LABEL[post.author?.role ?? ""] ?? "Staff"}
                className="flex items-center gap-1 rounded-full border border-amber-400/40 bg-gradient-to-b from-amber-300/20 to-amber-500/10 px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-amber-300 shadow-[0_0_12px_-4px_rgba(251,191,36,0.6)]"
              >
                <Crown size={11} className="fill-amber-300 text-amber-300" />
                {ROLE_LABEL[post.author?.role ?? ""] ?? "Staff"}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-neutral-500">
            {timeAgo(post.created_at)}
          </p>
        </div>
        {canDelete && (
          <button
            onClick={handleDelete}
            disabled={busy}
            title="Διαγραφή"
            className="rounded-lg p-1.5 text-neutral-500 opacity-0 transition hover:bg-white/10 hover:text-rose-300 disabled:opacity-30 group-hover:opacity-100"
          >
            <Trash2 size={15} />
          </button>
        )}
      </header>

      <p className="mt-4 whitespace-pre-wrap text-[14.5px] leading-relaxed text-neutral-200">
        {post.content}
      </p>

      {post.image_url && (
        <div className="mt-4 overflow-hidden rounded-xl ring-1 ring-white/10">
          <img
            src={post.image_url}
            alt=""
            className="max-h-[520px] w-full object-cover"
          />
        </div>
      )}

      <div className="mt-5 flex items-center gap-2 border-t border-white/[0.06] pt-4">
        <button
          onClick={handleLike}
          disabled={busy}
          className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
            liked
              ? "border-rose-400/40 bg-rose-500/10 text-rose-300"
              : "border-white/10 bg-white/[0.02] text-neutral-400 hover:border-white/20 hover:text-white"
          }`}
        >
          <Heart size={14} className={liked ? "fill-rose-400" : ""} />
          {post.likes.length > 0 ? post.likes.length : "Like"}
        </button>
        <button
          onClick={() => setShowComments((s) => !s)}
          className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.02] px-3.5 py-1.5 text-xs font-medium text-neutral-400 transition hover:border-white/20 hover:text-white"
        >
          <MessageCircle size={14} />
          {post.comments.length > 0 ? post.comments.length : "Σχόλιο"}
        </button>
      </div>

      {showComments && (
        <div className="mt-4 space-y-3 border-t border-white/[0.06] pt-4">
          {post.comments
            .slice()
            .sort(
              (a, b) =>
                new Date(a.created_at).getTime() -
                new Date(b.created_at).getTime(),
            )
            .map((c) => (
              <div key={c.id} className="flex items-start gap-2.5">
                <Avatar
                  url={c.author?.avatar_url}
                  name={c.author?.full_name}
                  size={30}
                  ring={
                    c.author && isStaffRole(c.author.role)
                      ? "ring-amber-400/30"
                      : "ring-white/10"
                  }
                />
                <div className="min-w-0 flex-1 rounded-2xl bg-white/[0.04] px-3.5 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-semibold text-neutral-200">
                      {c.author?.full_name ?? "Άγνωστος"}
                    </p>
                    {c.author && isStaffRole(c.author.role) && (
                      <Crown size={10} className="fill-amber-300 text-amber-300" />
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-neutral-300">
                    {c.content}
                  </p>
                </div>
              </div>
            ))}

          <div className="flex items-center gap-2 pt-1">
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleComment()}
              placeholder="Γράψε ένα σχόλιο…"
              className="w-full rounded-full border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none transition focus:border-white/30"
            />
            <button
              onClick={handleComment}
              disabled={busy || !commentText.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-neutral-100 to-neutral-300 text-black shadow-[0_2px_8px_-2px_rgba(255,255,255,0.3)] transition hover:brightness-110 disabled:opacity-30"
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      )}
    </article>
  );
}