// src/routes/academy/index.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Ban,
  ChevronDown,
  ImagePlus,
  Loader2,
  Lock,
  Send,
  ShieldCheck,
  ShieldOff,
  Trash2,
  X,
} from "lucide-react";
import { createAcademyPost, getAcademyFeed, getMyProfile } from "@/lib/queries";
import { useAsync } from "@/lib/useAsync";
import { ErrorState, LoadingSkeleton, EmptyState } from "@/components/aura/States";
import PostCardPro from "@/components/aura/PostCardPro";
import OnlineUsersPanel from "@/components/aura/OnlineUsersPanel";
import StoriesBar from "@/components/aura/StoriesBar";
import { CHROME_FILL, ChromeText, EASE, FRAME_BORDER } from "@/components/aura/chrome";
import {
  deletePostAsModerator,
  friendlyError,
  getBannedUsers,
  getMyPostingStatus,
  getPostAuthorId,
  isModeratorRole,
  setPostingBan,
  type BannedUser,
  type PostingStatus,
} from "@/lib/academy-moderation";

export const Route = createFileRoute("/academy/")({ component: AcademyPage });

const PAGE_SIZE = 6;
const MAX_CHARS = 2000;
const MAX_IMAGE_MB = 10;

/* ------------------------------------------------------------------------ */
/*  Online users: docked on desktop, swipe-out drawer on mobile              */
/* ------------------------------------------------------------------------ */

function DraggableOnlineUsersPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 1024 : false,
  );

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <motion.div
      drag={isMobile ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.2}
      onDragEnd={(_, { offset, velocity }) => {
        if (!isMobile) return;
        if (offset.x < -40 || velocity.x < -400) setIsOpen(true);
        else if (offset.x > 40 || velocity.x > 400) setIsOpen(false);
      }}
      animate={isMobile ? { x: isOpen ? 0 : "calc(100% - 36px)" } : { x: 0 }}
      transition={{ type: "spring", bounce: 0.1, duration: 0.4 }}
      style={isMobile ? { willChange: "transform" } : undefined}
      className={
        isMobile
          ? "fixed bottom-0 right-0 top-28 z-50 flex w-[85vw] max-w-sm flex-row"
          : "sticky top-36 hidden w-80 shrink-0 lg:flex"
      }
    >
      {isMobile && (
        <button
          type="button"
          aria-label={isOpen ? "Close online users" : "Open online users"}
          onClick={() => setIsOpen((o) => !o)}
          className="flex w-9 shrink-0 cursor-grab items-center justify-center rounded-l-2xl border-y border-l border-white/20 bg-[#0a0a0b] shadow-[-8px_0_20px_rgba(0,0,0,0.6)] outline-none active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-white/60"
        >
          <span className="flex flex-col gap-1.5">
            <span className="h-6 w-1 rounded-full" style={{ backgroundImage: CHROME_FILL }} />
            <span className="h-6 w-1 rounded-full" style={{ backgroundImage: CHROME_FILL }} />
          </span>
        </button>
      )}
      <div
        className={
          isMobile
            ? "flex-1 overflow-y-auto border-y border-white/10 bg-[#070707] shadow-2xl"
            : "w-full"
        }
      >
        <OnlineUsersPanel />
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------------ */
/*  Page                                                                    */
/* ------------------------------------------------------------------------ */

function AcademyPage() {
  const reduce = useReducedMotion();
  const profile = useAsync(getMyProfile, []);
  const feed = useAsync(getAcademyFeed, []);

  const me = profile.data;
  const isMod = isModeratorRole(me?.role);

  const [status, setStatus] = useState<PostingStatus>({ banned: false, reason: null });
  const [banned, setBanned] = useState<BannedUser[]>([]);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // my own ban status
  useEffect(() => {
    if (!me?.id) return;
    let alive = true;
    getMyPostingStatus(me.id).then((s) => alive && setStatus(s));
    return () => {
      alive = false;
    };
  }, [me?.id]);

  // moderators: the list of banned people
  const loadBanned = useCallback(async () => {
    try {
      setBanned(await getBannedUsers());
    } catch {
      /* column missing until the SQL is applied */
    }
  }, []);
  useEffect(() => {
    if (isMod) void loadBanned();
  }, [isMod, loadBanned]);

  const bannedIds = useMemo(() => new Set(banned.map((b) => b.id)), [banned]);

  // reveal the feed in small batches: fast first paint, no lag on phones
  const total = feed.data?.length ?? 0;
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || visible >= total) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setVisible((v) => v + PAGE_SIZE);
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible, total]);

  const reloadFeed = useCallback(() => feed.reload?.(), [feed]);

  return (
    <main className="relative min-h-screen w-full overflow-x-hidden bg-[#070707] px-4 py-28 text-white selection:bg-white selection:text-black sm:px-6 sm:py-36 md:px-10">
      {/* ambient glow (desktop only: keeps phones smooth) */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 hidden aspect-square w-[min(1000px,130%)] -translate-x-1/2 -translate-y-1/3 rounded-full md:block"
        style={{ background: "radial-gradient(circle, rgba(255,255,255,0.08) 0%, rgba(170,180,190,0.035) 40%, transparent 70%)" }}
        animate={reduce ? undefined : { opacity: [0.45, 1, 0.45] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative mx-auto flex max-w-6xl items-start lg:gap-8">
        <div className="mx-auto w-full min-w-0 max-w-2xl flex-1 space-y-8">
          {/* header */}
          <motion.header
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <div className="mb-3 flex items-center gap-3 text-xs uppercase tracking-[0.35em] text-white/50">
              <span className="h-px w-10 bg-gradient-to-r from-white/70 to-transparent" />
              AURA Academy
            </div>
            <h1 className="text-3xl font-extrabold uppercase tracking-tight sm:text-5xl">
              <ChromeText>Community Feed</ChromeText>
            </h1>
          </motion.header>

          {me && (
            <StoriesBar
              currentUserId={me.id}
              currentUserAvatar={me.avatar_url}
              currentUserName={me.full_name}
            />
          )}

          {profile.error && <ErrorState message={profile.error} />}

          {/* composer: everyone, unless banned */}
          {me && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE, delay: 0.08 }}
            >
              {status.banned ? (
                <BannedNotice reason={status.reason} />
              ) : (
                <Composer
                  authorAvatar={me.avatar_url}
                  authorName={me.full_name}
                  onPosted={reloadFeed}
                  onBanned={() => setStatus({ banned: true, reason: null })}
                />
              )}
            </motion.div>
          )}

          {isMod && (
            <BannedPanel
              users={banned}
              onUnbanned={(id) => setBanned((list) => list.filter((u) => u.id !== id))}
            />
          )}

          {feed.loading && <LoadingSkeleton rows={4} />}
          {feed.error && <ErrorState message={feed.error} />}

          {feed.data && feed.data.length === 0 && (
            <Surface>
              <div className="p-8 text-center">
                <EmptyState
                  title="Δεν υπάρχουν αναρτήσεις ακόμη"
                  hint="Γίνε ο πρώτος που θα μοιραστεί κάτι με την κοινότητα."
                />
              </div>
            </Surface>
          )}

          {feed.data && feed.data.length > 0 && me && (
            <div className="space-y-6">
              {feed.data.slice(0, visible).map((post, i) => {
                const authorId = getPostAuthorId(post);
                const showBar = isMod && !!authorId && authorId !== me.id;
                return (
                  <motion.div
                    key={post.id}
                    // only the first few animate: the rest render instantly
                    initial={i < 4 && !reduce ? { opacity: 0, y: 18 } : false}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.55, ease: EASE, delay: i < 4 ? 0.12 + i * 0.07 : 0 }}
                    style={{ contentVisibility: "auto", containIntrinsicSize: "auto 420px" }}
                  >
                    <PostCardPro
                      post={post}
                      currentUserId={me.id}
                      currentUserRole={me.role}
                      onChanged={reloadFeed}
                    />
                    {showBar && (
                      <ModBar
                        postId={post.id}
                        authorId={authorId!}
                        authorBanned={bannedIds.has(authorId!)}
                        onDeleted={reloadFeed}
                        onBanChanged={loadBanned}
                      />
                    )}
                  </motion.div>
                );
              })}

              {visible < total && (
                <div ref={sentinelRef} className="flex justify-center py-6" aria-hidden>
                  <Loader2 className="size-5 animate-spin text-white/40" />
                </div>
              )}
              {visible >= total && total > PAGE_SIZE && (
                <p className="py-6 text-center text-xs uppercase tracking-[0.3em] text-white/25">
                  Τέλος του feed
                </p>
              )}
            </div>
          )}
        </div>

        <DraggableOnlineUsersPanel />
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------------ */
/*  Building blocks                                                         */
/* ------------------------------------------------------------------------ */

/** Light chrome-bordered surface (no heavy blur / shadow: smooth on phones). */
function Surface({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative rounded-2xl p-px ${className}`} style={{ background: FRAME_BORDER }}>
      <div className="relative overflow-hidden rounded-[15px] bg-[#0b0b0c]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-16"
          style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.05), transparent)" }}
        />
        <div className="relative">{children}</div>
      </div>
    </div>
  );
}

function Avatar({ src, name }: { src: string | null; name: string | null }) {
  return src ? (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      className="size-11 shrink-0 rounded-full object-cover ring-2 ring-white/30"
    />
  ) : (
    <span
      className="flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-neutral-950"
      style={{ backgroundImage: CHROME_FILL, boxShadow: "0 0 18px rgba(255,255,255,0.3)" }}
    >
      {name?.[0]?.toUpperCase() ?? "A"}
    </span>
  );
}

function BannedNotice({ reason }: { reason: string | null }) {
  return (
    <Surface>
      <div className="flex items-start gap-4 p-5">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/[0.05] text-white/80">
          <Lock className="size-5" />
        </span>
        <div>
          <p className="text-sm font-semibold text-white">Η δημοσίευση είναι απενεργοποιημένη</p>
          <p className="mt-1 text-sm leading-relaxed text-white/55">
            Οι διαχειριστές έχουν περιορίσει τη δυνατότητά σου να γράφεις στο feed. Μπορείς να συνεχίσεις να διαβάζεις
            την Academy κανονικά.
            {reason && <span className="mt-1 block text-white/40">Λόγος: {reason}</span>}
          </p>
        </div>
      </div>
    </Surface>
  );
}

/* ------------------------------ composer ------------------------------ */

function Composer({
  authorAvatar,
  authorName,
  onPosted,
  onBanned,
}: {
  authorAvatar: string | null;
  authorName: string | null;
  onPosted: () => void;
  onBanned: () => void;
}) {
  const [content, setContent] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  function pick(file: File | null) {
    setErr(null);
    if (file && file.size > MAX_IMAGE_MB * 1024 * 1024) {
      setErr(`Η εικόνα πρέπει να είναι έως ${MAX_IMAGE_MB}MB.`);
      return;
    }
    setImage(file);
    setPreview(file ? URL.createObjectURL(file) : null);
  }

  async function submit() {
    const text = content.trim();
    if (!text || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await createAcademyPost(text, image ?? undefined);
      setContent("");
      pick(null);
      onPosted();
    } catch (e) {
      const msg = (e as Error).message ?? "";
      if (msg.includes("POSTING_BANNED")) onBanned();
      setErr(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  const left = MAX_CHARS - content.length;

  return (
    <Surface>
      <div
        className="p-4 sm:p-5"
        style={focused ? { boxShadow: "inset 0 0 40px rgba(255,255,255,0.04)" } : undefined}
      >
        <div className="flex items-start gap-3 sm:gap-4">
          <Avatar src={authorAvatar} name={authorName} />
          <div className="min-w-0 flex-1">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value.slice(0, MAX_CHARS))}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void submit();
              }}
              placeholder="Μοιράσου κάτι με την κοινότητα…"
              rows={focused || content ? 4 : 2}
              aria-label="Νέα ανάρτηση"
              className="w-full resize-none rounded-xl border border-white/10 bg-black/50 p-3.5 text-sm text-white outline-none transition-all duration-300 placeholder:text-white/30 focus:border-white/45 focus:bg-black/70 focus:shadow-[0_0_24px_rgba(255,255,255,0.08)]"
            />

            <AnimatePresence initial={false}>
              {preview && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  className="overflow-hidden"
                >
                  <div className="relative mt-3 inline-block">
                    <img src={preview} alt="" className="max-h-56 max-w-full rounded-xl object-cover ring-1 ring-white/20" />
                    <button
                      type="button"
                      onClick={() => pick(null)}
                      aria-label="Αφαίρεση εικόνας"
                      className="absolute -right-2 -top-2 rounded-full bg-black p-1.5 text-white ring-1 ring-white/30 outline-none transition-all hover:bg-white hover:text-black focus-visible:ring-2 focus-visible:ring-white"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {err && (
              <p role="alert" className="mt-3 rounded-lg border border-white/20 bg-white/[0.05] px-3 py-2 text-xs text-white/85">
                {err}
              </p>
            )}

            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <label className="flex cursor-pointer items-center gap-2 rounded-full border border-white/20 bg-white/[0.04] px-3.5 py-2 text-xs font-medium text-white/80 transition-all hover:border-white/50 hover:bg-white/[0.09] hover:text-white hover:shadow-[0_0_18px_rgba(255,255,255,0.12)] focus-within:ring-2 focus-within:ring-white/60">
                  <ImagePlus size={14} />
                  <span>Εικόνα</span>
                  <input type="file" accept="image/*" className="sr-only" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
                </label>
                {content.length > MAX_CHARS * 0.8 && (
                  <span className={`text-xs ${left < 100 ? "text-white" : "text-white/40"}`}>{left}</span>
                )}
              </div>

              <motion.button
                type="button"
                whileHover={busy || !content.trim() ? undefined : { scale: 1.04, y: -1 }}
                whileTap={busy || !content.trim() ? undefined : { scale: 0.96 }}
                onClick={() => void submit()}
                disabled={busy || !content.trim()}
                className="group relative flex items-center gap-2 overflow-hidden rounded-full px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-neutral-950 outline-none transition-shadow duration-300 hover:shadow-[0_0_34px_rgba(255,255,255,0.4)] focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:opacity-40"
                style={{ backgroundImage: CHROME_FILL, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.95), 0 0 22px rgba(255,255,255,0.15)" }}
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                <span>Δημοσίευση</span>
              </motion.button>
            </div>
          </div>
        </div>
      </div>
    </Surface>
  );
}

/* ----------------------------- moderation ----------------------------- */

function ModBar({
  postId,
  authorId,
  authorBanned,
  onDeleted,
  onBanChanged,
}: {
  postId: string;
  authorId: string;
  authorBanned: boolean;
  onDeleted: () => void;
  onBanChanged: () => void;
}) {
  const [mode, setMode] = useState<null | "delete" | "ban">(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run(fn: () => Promise<void>, after: () => void) {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      setMode(null);
      setReason("");
      after();
    } catch (e) {
      setErr(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  const btn =
    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold outline-none transition-all focus-visible:ring-2 focus-visible:ring-white/60 disabled:opacity-40";
  const ghost = `${btn} border-white/20 bg-white/[0.04] text-white/75 hover:border-white/60 hover:bg-white/[0.1] hover:text-white hover:shadow-[0_0_18px_rgba(255,255,255,0.15)]`;
  const solid = `${btn} border-white bg-white text-neutral-950 hover:shadow-[0_0_24px_rgba(255,255,255,0.5)]`;

  return (
    <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 flex items-center gap-1.5 text-[11px] uppercase tracking-[0.2em] text-white/35">
          <ShieldCheck className="size-3.5" /> Moderation
        </span>

        {mode !== "delete" && (
          <button type="button" className={ghost} onClick={() => { setMode("delete"); setErr(null); }} disabled={busy}>
            <Trash2 className="size-3.5" /> Διαγραφή
          </button>
        )}

        {authorBanned ? (
          <button
            type="button"
            className={ghost}
            disabled={busy}
            onClick={() => void run(() => setPostingBan(authorId, false), onBanChanged)}
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldOff className="size-3.5" />} Unban
          </button>
        ) : (
          mode !== "ban" && (
            <button type="button" className={ghost} onClick={() => { setMode("ban"); setErr(null); }} disabled={busy}>
              <Ban className="size-3.5" /> Ban συγγραφέα
            </button>
          )
        )}

        {authorBanned && <span className="text-[11px] text-white/45">Ο συγγραφέας είναι αποκλεισμένος</span>}
      </div>

      <AnimatePresence initial={false}>
        {mode && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
              {mode === "ban" && (
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Λόγος (προαιρετικό)"
                  maxLength={200}
                  autoFocus
                  className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-xs text-white outline-none placeholder:text-white/30 focus:border-white/50"
                />
              )}
              {mode === "delete" && <span className="text-xs text-white/70">Να διαγραφεί οριστικά αυτή η ανάρτηση;</span>}
              <button
                type="button"
                className={solid}
                disabled={busy}
                onClick={() =>
                  void run(
                    mode === "delete" ? () => deletePostAsModerator(postId) : () => setPostingBan(authorId, true, reason),
                    mode === "delete" ? onDeleted : onBanChanged,
                  )
                }
              >
                {busy && <Loader2 className="size-3.5 animate-spin" />}
                {mode === "delete" ? "Ναι, διαγραφή" : "Επιβεβαίωση ban"}
              </button>
              <button type="button" className={ghost} onClick={() => setMode(null)} disabled={busy}>
                Άκυρο
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {err && (
        <p role="alert" className="mt-2 text-xs text-white/80">
          {err}
        </p>
      )}
    </div>
  );
}

function BannedPanel({ users, onUnbanned }: { users: BannedUser[]; onUnbanned: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function unban(id: string) {
    setBusyId(id);
    setErr(null);
    try {
      await setPostingBan(id, false);
      onUnbanned(id);
    } catch (e) {
      setErr(friendlyError(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Surface>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left outline-none transition-colors hover:bg-white/[0.03] focus-visible:bg-white/[0.05]"
      >
        <span className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.25em] text-white/70">
          <ShieldCheck className="size-4 text-white" />
          Αποκλεισμένοι χρήστες
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-bold text-neutral-950"
            style={{ backgroundImage: CHROME_FILL }}
          >
            {users.length}
          </span>
        </span>
        <ChevronDown className={`size-4 text-white/50 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/10 px-5 py-3">
              {users.length === 0 && <p className="py-3 text-sm text-white/45">Κανένας χρήστης δεν είναι αποκλεισμένος.</p>}
              <ul className="divide-y divide-white/[0.06]">
                {users.map((u) => (
                  <li key={u.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar src={u.avatar_url} name={u.full_name} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{u.full_name ?? "Χωρίς όνομα"}</p>
                        {u.reason && <p className="truncate text-xs text-white/45">{u.reason}</p>}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void unban(u.id)}
                      disabled={busyId === u.id}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/25 bg-white/[0.05] px-3.5 py-1.5 text-xs font-semibold text-white outline-none transition-all hover:border-white/60 hover:bg-white/[0.12] hover:shadow-[0_0_18px_rgba(255,255,255,0.18)] focus-visible:ring-2 focus-visible:ring-white/60 disabled:opacity-40"
                    >
                      {busyId === u.id ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldOff className="size-3.5" />}
                      Unban
                    </button>
                  </li>
                ))}
              </ul>
              {err && <p role="alert" className="pb-2 text-xs text-white/80">{err}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Surface>
  );
}