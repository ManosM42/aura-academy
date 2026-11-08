// src/components/aura/portfolio/PostViewer.tsx
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, Gem, Heart, Loader2, MoreHorizontal, Trash2, X } from "lucide-react";
import { imageUrl, type PortfolioPost } from "@/lib/portfolio";

export interface ViewerAuthor {
  name: string;
  username: string | null;
  avatar: string | null;
}

interface Props {
  posts: PortfolioPost[];
  index: number;
  author: ViewerAuthor;
  isOwner: boolean;
  canLike: boolean; // false = visitor who is not signed in
  onClose: () => void;
  onIndex: (next: number) => void;
  onLike: (postId: string) => void;
  onDelete: (post: PortfolioPost) => Promise<void>;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("el-GR", { day: "numeric", month: "long", year: "numeric" });
}

function Avatar({ author, size }: { author: ViewerAuthor; size: number }) {
  return (
    <span className="pf-ring" style={{ width: size, height: size }}>
      <span className="pf-ring-inner">
        {author.avatar ? (
          <img src={author.avatar} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span style={{ fontSize: size * 0.4 }}>{author.name.slice(0, 1).toUpperCase()}</span>
        )}
      </span>
    </span>
  );
}

export default function PostViewer({
  posts,
  index,
  author,
  isOwner,
  canLike,
  onClose,
  onIndex,
  onLike,
  onDelete,
}: Props) {
  const post = posts[index];
  const [burst, setBurst] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [hint, setHint] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const hasPrev = index > 0;
  const hasNext = index < posts.length - 1;

  // Keyboard: Esc closes, arrows move between posts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (menuOpen || confirming) {
          setMenuOpen(false);
          setConfirming(false);
        } else onClose();
      } else if (e.key === "ArrowLeft" && hasPrev) onIndex(index - 1);
      else if (e.key === "ArrowRight" && hasNext) onIndex(index + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onIndex, index, hasPrev, hasNext, menuOpen, confirming]);

  // Lock the page scroll behind the dialog.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Reset the little states when the post changes.
  useEffect(() => {
    setMenuOpen(false);
    setConfirming(false);
    setHint(false);
    setDeleteError(null);
  }, [post?.id]);

  if (!post) return null;

  function like() {
    if (!canLike) {
      setHint(true);
      return;
    }
    onLike(post!.id);
  }

  function doubleLike() {
    if (!canLike) {
      setHint(true);
      return;
    }
    setBurst((n) => n + 1);
    if (!post!.liked_by_me) onLike(post!.id); // double-tap never removes a like
  }

  async function confirmDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await onDelete(post!);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Η διαγραφή απέτυχε.");
      setDeleting(false);
    }
  }

  const src = imageUrl(post.image_path);

  return (
    <div className="pf-layer" onPointerDown={onClose}>
      {/* gradient used to fill the "liked" heart with chrome */}
      <svg width="0" height="0" aria-hidden style={{ position: "absolute" }}>
        <defs>
          <linearGradient id="pf-chrome-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.5" stopColor="#b9bec7" />
            <stop offset="1" stopColor="#ffffff" />
          </linearGradient>
        </defs>
      </svg>

      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label="Κλείσιμο"
        className="pf-iconbtn fixed right-4 top-4 z-[75]"
      >
        <X className="size-5" />
      </button>

      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Post"
        initial={{ opacity: 0, scale: 0.97, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="pf-viewer"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* ---------- header on mobile (Instagram feed style) ---------- */}
        <header className="flex items-center gap-3 border-b border-white/[0.08] px-4 py-3 min-[900px]:hidden">
          <Avatar author={author} size={38} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{author.username ?? author.name}</p>
            <p className="truncate text-[11px] text-white/45">{author.name}</p>
          </div>
        </header>

        {/* ---------- photo ---------- */}
        <div className="pf-viewer-media" onDoubleClick={doubleLike}>
          <AnimatePresence mode="wait">
            <motion.img
              key={post.id}
              src={src}
              alt={post.caption ? post.caption.slice(0, 120) : `Post από ${author.name}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              draggable={false}
            />
          </AnimatePresence>

          {hasPrev && (
            <button type="button" className="pf-iconbtn pf-nav left-3" onClick={() => onIndex(index - 1)} aria-label="Προηγούμενο post">
              <ChevronLeft className="size-5" />
            </button>
          )}
          {hasNext && (
            <button type="button" className="pf-iconbtn pf-nav right-3" onClick={() => onIndex(index + 1)} aria-label="Επόμενο post">
              <ChevronRight className="size-5" />
            </button>
          )}

          <AnimatePresence>
            {burst > 0 && (
              <motion.span
                key={burst}
                className="pf-burst"
                initial={{ opacity: 0, scale: 0.3 }}
                animate={{ opacity: [0, 1, 1, 0], scale: [0.3, 1.2, 1, 1.1] }}
                transition={{ duration: 0.9, times: [0, 0.25, 0.7, 1] }}
                onAnimationComplete={() => setBurst(0)}
              >
                <Heart className="size-full" fill="url(#pf-chrome-grad)" stroke="#fff" strokeWidth={1.5} />
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* ---------- side panel ---------- */}
        <aside className="pf-viewer-side">
          <header className="relative hidden items-center gap-3 border-b border-white/[0.08] px-4 py-3.5 min-[900px]:flex">
            <Avatar author={author} size={40} />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 truncate text-sm font-semibold text-white">
                {author.username ?? author.name}
                <Gem className="size-3.5 shrink-0 text-white/70" aria-label="Elite" />
              </p>
              <p className="truncate text-[11px] text-white/45">{author.name}</p>
            </div>
            {isOwner && (
              <div className="relative">
                <button
                  type="button"
                  className="pf-iconbtn"
                  style={{ width: 34, height: 34 }}
                  aria-label="Επιλογές"
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen((o) => !o)}
                >
                  <MoreHorizontal className="size-4" />
                </button>
                {menuOpen && (
                  <div className="pf-menu" role="menu">
                    <button
                      type="button"
                      role="menuitem"
                      style={{ color: "#fca5a5" }}
                      onClick={() => {
                        setMenuOpen(false);
                        setConfirming(true);
                      }}
                    >
                      <Trash2 className="size-4" /> Διαγραφή post
                    </button>
                  </div>
                )}
              </div>
            )}
          </header>

          <div className="pf-viewer-scroll">
            {post.caption ? (
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-white/85">
                <strong className="mr-2 font-semibold text-white">{author.username ?? author.name}</strong>
                {post.caption}
              </p>
            ) : (
              <p className="text-sm italic text-white/30">Χωρίς περιγραφή.</p>
            )}
          </div>

          <footer className="border-t border-white/[0.08] px-3 pb-4 pt-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                className={`pf-heart-btn ${post.liked_by_me ? "pf-heart-on" : ""}`}
                onClick={like}
                aria-pressed={post.liked_by_me}
                aria-label={post.liked_by_me ? "Αφαίρεση like" : "Like"}
              >
                <Heart className="size-7" strokeWidth={1.6} />
              </button>
              {isOwner && (
                <button
                  type="button"
                  className="pf-heart-btn min-[900px]:hidden"
                  onClick={() => setConfirming(true)}
                  aria-label="Διαγραφή post"
                  style={{ marginLeft: "auto" }}
                >
                  <Trash2 className="size-5" />
                </button>
              )}
            </div>

            <p className="px-2 text-sm font-semibold text-white">
              {post.like_count} {post.like_count === 1 ? "like" : "likes"}
            </p>
            <p className="mt-1 px-2 text-[11px] uppercase tracking-[0.12em] text-white/35">{fmtDate(post.created_at)}</p>

            {hint && (
              <p className="mx-2 mt-3 rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-xs text-white/70" role="status">
                <Link to="/login" className="font-semibold text-white underline underline-offset-4">
                  Συνδέσου
                </Link>{" "}
                για να κάνεις like.
              </p>
            )}
          </footer>

          {confirming && (
            <div className="absolute inset-0 z-10 grid place-items-center bg-black/80 p-6 text-center backdrop-blur-sm">
              <div>
                <p className="text-sm text-white/85">Να διαγραφεί αυτό το post;</p>
                <p className="mt-1 text-xs text-white/45">Δεν μπορεί να αναιρεθεί.</p>
                {deleteError && <p className="mt-3 text-xs text-red-300">{deleteError}</p>}
                <div className="mt-5 flex justify-center gap-3">
                  <button type="button" className="pf-btn" onClick={() => setConfirming(false)} disabled={deleting}>
                    Άκυρο
                  </button>
                  <button type="button" className="pf-btn pf-btn-danger" onClick={() => void confirmDelete()} disabled={deleting}>
                    {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                    Διαγραφή
                  </button>
                </div>
              </div>
            </div>
          )}
        </aside>
      </motion.div>
    </div>
  );
}