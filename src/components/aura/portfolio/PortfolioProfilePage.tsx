// src/components/aura/portfolio/PortfolioProfilePage.tsx
import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Gem, Heart, ImagePlus, Instagram, Lock, MapPin, Pencil, Plus } from "lucide-react";
import {
  deletePost,
  fetchPortfolio,
  fetchPosts,
  imageUrl,
  toggleLike,
  useIsElite,
  type PortfolioInfo,
  type PortfolioPost,
} from "@/lib/portfolio";
import { useAuthUser } from "@/lib/useAuthUser";
import { pfCss } from "./pfStyles";
import PostViewer from "./PostViewer";
import NewPostModal from "./NewPostModal";
import UpgradePopup from "./UpgradePopup";

const EASE = [0.22, 1, 0.36, 1] as const;

async function loadAllPosts(userId: string): Promise<PortfolioPost[]> {
  const all: PortfolioPost[] = [];
  for (let offset = 0; offset < 200; offset += 100) {
    const page = await fetchPosts(userId, offset, 100);
    all.push(...page);
    if (page.length < 100) break;
  }
  return all;
}

export default function PortfolioProfilePage({ slug }: { slug: string }) {
  const { user, loading: authLoading } = useAuthUser();
  const { isElite, loading: eliteLoading } = useIsElite(user?.id);

  const [info, setInfo] = useState<PortfolioInfo | null>(null);
  const [posts, setPosts] = useState<PortfolioPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewIndex, setViewIndex] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  // Load the portfolio + its posts. Re-runs when the user (auth) changes so "liked_by_me" is right.
  useEffect(() => {
    if (authLoading) return;
    let active = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const p = await fetchPortfolio(slug);
        if (!active) return;
        setInfo(p);
        if (p) setPosts(await loadAllPosts(p.user_id));
        else setPosts([]);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Κάτι πήγε στραβά.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [slug, authLoading, user?.id]);

  // "Upgrade to Elite" popup for everyone who is not Elite and opens someone else's portfolio.
  useEffect(() => {
    if (authLoading || eliteLoading || loading || !info || info.is_owner || isElite) return;
    const key = "aura_pf_upgrade_seen";
    try {
      if (sessionStorage.getItem(key) === slug) return;
    } catch {
      /* ignore */
    }
    const t = window.setTimeout(() => {
      setShowUpgrade(true);
      try {
        sessionStorage.setItem(key, slug);
      } catch {
        /* ignore */
      }
    }, 1200);
    return () => window.clearTimeout(t);
  }, [authLoading, eliteLoading, loading, info, isElite, slug]);

  const handleLike = useCallback(
    async (postId: string) => {
      if (!user) return;
      const flip = (list: PortfolioPost[]) =>
        list.map((p) =>
          p.id === postId
            ? { ...p, liked_by_me: !p.liked_by_me, like_count: Math.max(0, p.like_count + (p.liked_by_me ? -1 : 1)) }
            : p,
        );
      setPosts(flip); // optimistic
      try {
        const res = await toggleLike(postId);
        setPosts((list) => list.map((p) => (p.id === postId ? { ...p, liked_by_me: res.liked, like_count: res.like_count } : p)));
      } catch {
        setPosts(flip); // revert
      }
    },
    [user],
  );

  const handleDelete = useCallback(
    async (post: PortfolioPost) => {
      await deletePost(post);
      setPosts((list) => list.filter((p) => p.id !== post.id));
      setViewIndex((i) => {
        if (i === null) return null;
        const remaining = posts.length - 1;
        if (remaining <= 0) return null;
        return Math.min(i, remaining - 1);
      });
    },
    [posts.length],
  );

  const handlePublished = useCallback((post: PortfolioPost) => {
    setPosts((list) => [post, ...list]);
    setUploading(false);
  }, []);

  const totalLikes = posts.reduce((n, p) => n + p.like_count, 0);
  const canPost = Boolean(info?.is_owner && info.is_live && user);

  /* ------------------------------ states ------------------------------ */
  const shell = (children: React.ReactNode) => (
    <main className="pf-root relative min-h-screen overflow-hidden bg-[#050506] px-4 pb-28 pt-28 text-white sm:px-6">
      <style>{pfCss}</style>
      <div className="pf-grid-bg absolute inset-x-0 top-0 h-[560px]" />
      <div className="pf-orb -left-24 top-20 h-80 w-80" />
      <div className="pf-orb -right-16 top-72 h-96 w-96" />
      <div className="relative mx-auto max-w-4xl">{children}</div>
    </main>
  );

  if (loading || authLoading) {
    return shell(
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:gap-14">
        <div className="pf-skel size-32 rounded-full sm:size-40" />
        <div className="w-full flex-1 space-y-4">
          <div className="pf-skel h-6 w-1/2 rounded" />
          <div className="pf-skel h-4 w-2/3 rounded" />
          <div className="pf-skel h-4 w-1/3 rounded" />
        </div>
      </div>,
    );
  }

  if (error) {
    return shell(
      <p className="pf-toast mx-auto max-w-md" role="alert">
        {error}
      </p>,
    );
  }

  if (!info) {
    return shell(
      <div className="pf-panel mx-auto max-w-md p-10 text-center">
        <Lock className="mx-auto size-9 text-white/40" />
        <h1 className="pf-title mt-4 text-2xl font-bold">Το portfolio δεν βρέθηκε</h1>
        <p className="mt-2 text-sm text-white/55">Μπορεί να μην υπάρχει ή να μην είναι ενεργό αυτή τη στιγμή.</p>
        <Link to="/portfolios" className="pf-btn pf-btn-solid mt-6">
          <ArrowLeft className="size-4" /> Όλα τα portfolios
        </Link>
      </div>,
    );
  }

  const name = info.display_name;

  return (
    <>
      {shell(
        <>
          <Link to="/portfolios" className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/45 transition hover:text-white">
            <ArrowLeft className="size-3.5" /> Portfolios
          </Link>

          {info.is_owner && !info.is_live && (
            <div className="pf-toast mt-5" role="status">
              <Lock className="mt-0.5 size-4 shrink-0" />
              <span>
                Το portfolio σου είναι κρυφό γιατί η συνδρομή AURA ELITE δεν είναι ενεργή.{" "}
                <Link to="/pricing" className="font-semibold underline underline-offset-4">
                  Ανανέωσε
                </Link>{" "}
                για να εμφανιστεί ξανά.
              </span>
            </div>
          )}

          {/* ------------- profile header ------------- */}
          <motion.section
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE }}
            className="mt-8 flex flex-col items-center gap-7 text-center sm:flex-row sm:items-start sm:gap-14 sm:text-left"
          >
            <span className="pf-ring" style={{ width: 148, height: 148 }}>
              <span className="pf-ring-inner">
                {info.avatar_url ? (
                  <img src={info.avatar_url} alt={name} referrerPolicy="no-referrer" />
                ) : (
                  <span style={{ fontSize: 56 }}>{name.slice(0, 1).toUpperCase()}</span>
                )}
              </span>
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-start">
                <h1 className="pf-title truncate text-2xl font-bold tracking-tight sm:text-3xl">{info.username ?? name}</h1>
                <span className="pf-elite-badge">
                  <Gem className="size-3" /> Elite
                </span>
              </div>

              {info.is_owner && (
                <div className="mt-4 flex flex-wrap items-center justify-center gap-3 sm:justify-start">
                  <Link to="/portfolios/create" className="pf-btn">
                    <Pencil className="size-3.5" /> Επεξεργασία
                  </Link>
                  {canPost && (
                    <button type="button" className="pf-btn pf-btn-solid" onClick={() => setUploading(true)}>
                      <Plus className="size-4" /> Νέο post
                    </button>
                  )}
                </div>
              )}

              <ul className="mt-6 flex justify-center gap-8 text-sm sm:justify-start">
                <li>
                  <strong className="text-base font-semibold text-white">{posts.length}</strong>{" "}
                  <span className="text-white/50">posts</span>
                </li>
                <li>
                  <strong className="text-base font-semibold text-white">{totalLikes}</strong>{" "}
                  <span className="text-white/50">likes</span>
                </li>
              </ul>

              <div className="mt-5 space-y-1.5">
                <p className="text-sm font-semibold text-white">{name}</p>
                {info.headline && <p className="text-sm text-white/80">{info.headline}</p>}
                {info.bio && <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-white/60">{info.bio}</p>}
                <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 pt-2 text-xs text-white/55 sm:justify-start">
                  {info.city && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="size-3.5" /> {info.city}
                    </span>
                  )}
                  {info.instagram && (
                    <a
                      href={`https://instagram.com/${info.instagram}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 transition hover:text-white"
                    >
                      <Instagram className="size-3.5" /> @{info.instagram}
                    </a>
                  )}
                </div>
              </div>
            </div>
          </motion.section>

          <div className="mt-12 border-t border-white/10" />

          {/* ------------- grid ------------- */}
          {posts.length === 0 ? (
            <div className="mx-auto mt-14 max-w-sm text-center">
              <ImagePlus className="mx-auto size-10 text-white/35" />
              <p className="mt-4 text-sm text-white/55">
                {info.is_owner ? "Ανέβασε την πρώτη σου δουλειά." : "Δεν υπάρχουν posts ακόμα."}
              </p>
              {canPost && (
                <button type="button" className="pf-btn pf-btn-solid mt-6" onClick={() => setUploading(true)}>
                  <Plus className="size-4" /> Νέο post
                </button>
              )}
            </div>
          ) : (
            <div className="pf-tiles mt-6">
              {posts.map((p, i) => (
                <motion.button
                  key={p.id}
                  type="button"
                  className="pf-tile"
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: Math.min(i, 12) * 0.04, ease: EASE }}
                  onClick={() => setViewIndex(i)}
                  aria-label={`Άνοιγμα post ${i + 1}`}
                >
                  <img src={imageUrl(p.image_path)} alt={p.caption ? p.caption.slice(0, 80) : ""} loading="lazy" />
                  <span className="pf-tile-over">
                    <Heart className="size-5" fill="currentColor" /> {p.like_count}
                  </span>
                </motion.button>
              ))}
            </div>
          )}
        </>,
      )}

      {viewIndex !== null && posts[viewIndex] && (
        <PostViewer
          posts={posts}
          index={viewIndex}
          author={{ name, username: info.username, avatar: info.avatar_url }}
          isOwner={info.is_owner}
          canLike={Boolean(user)}
          onClose={() => setViewIndex(null)}
          onIndex={setViewIndex}
          onLike={(id) => void handleLike(id)}
          onDelete={handleDelete}
        />
      )}

      {uploading && user && <NewPostModal userId={user.id} onClose={() => setUploading(false)} onPublished={handlePublished} />}

      <AnimatePresence>{showUpgrade && <UpgradePopup onClose={() => setShowUpgrade(false)} />}</AnimatePresence>
    </>
  );
}