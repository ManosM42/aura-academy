// src/components/aura/portfolio/PortfolioBoardPage.tsx
import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { Gem, Heart, Images, MapPin, Search, Sparkles } from "lucide-react";
import { fetchBoard, imageUrl, useIsElite, useMyPortfolio, type BoardEntry } from "@/lib/portfolio";
import { useAuthUser } from "@/lib/useAuthUser";
import { pfCss } from "./pfStyles";

const EASE = [0.22, 1, 0.36, 1] as const;

function Avatar({ entry, size }: { entry: BoardEntry; size: number }) {
  return (
    <span className="pf-ring" style={{ width: size, height: size }}>
      <span className="pf-ring-inner">
        {entry.avatar_url ? (
          <img src={entry.avatar_url} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span style={{ fontSize: size * 0.4 }}>{entry.display_name.slice(0, 1).toUpperCase()}</span>
        )}
      </span>
    </span>
  );
}

function BoardCard({ entry, index }: { entry: BoardEntry; index: number }) {
  function onMove(e: MouseEvent<HTMLAnchorElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.6, delay: Math.min(index % 6, 5) * 0.07, ease: EASE }}
    >
      <Link to="/portfolios/$slug" params={{ slug: entry.slug }} className="pf-bcard" onMouseMove={onMove}>
        <div className="pf-bcard-in">
          <div className="pf-bcard-cover">
            {entry.cover_path ? (
              <img src={imageUrl(entry.cover_path)} alt="" loading="lazy" />
            ) : (
              <div className="grid h-full w-full place-items-center text-white/25">
                <Images className="size-10" />
              </div>
            )}
          </div>
          <span className="pf-bcard-sheen" />

          <div className="relative z-[1] -mt-10 px-5 pb-5">
            <Avatar entry={entry} size={64} />
            <div className="mt-3 flex items-center gap-2">
              <h3 className="truncate text-lg font-semibold tracking-tight text-white">{entry.display_name}</h3>
              <Gem className="size-3.5 shrink-0 text-white/70" aria-label="Elite" />
            </div>
            {entry.username && <p className="truncate text-xs text-white/40">@{entry.username}</p>}
            {entry.headline && <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-white/60">{entry.headline}</p>}

            <div className="mt-4 flex items-center gap-4 text-xs text-white/50">
              <span className="inline-flex items-center gap-1.5">
                <Images className="size-3.5" /> {entry.posts_count}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Heart className="size-3.5" /> {entry.likes_count}
              </span>
              {entry.city && (
                <span className="ml-auto inline-flex min-w-0 items-center gap-1.5">
                  <MapPin className="size-3.5 shrink-0" />
                  <span className="truncate">{entry.city}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function SkeletonCard() {
  return (
    <div className="pf-panel overflow-hidden">
      <div className="pf-skel aspect-[16/10] w-full" />
      <div className="space-y-3 p-5">
        <div className="pf-skel h-4 w-2/3 rounded" />
        <div className="pf-skel h-3 w-1/3 rounded" />
        <div className="pf-skel h-3 w-full rounded" />
      </div>
    </div>
  );
}

export default function PortfolioBoardPage() {
  const { user } = useAuthUser();
  const { isElite } = useIsElite(user?.id);
  const { portfolio } = useMyPortfolio(user?.id);

  const [entries, setEntries] = useState<BoardEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    let active = true;
    fetchBoard()
      .then((d) => active && setEntries(d))
      .catch((e) => active && setError(e instanceof Error ? e.message : "Κάτι πήγε στραβά."));
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!entries) return null;
    const s = q.trim().toLowerCase();
    if (!s) return entries;
    return entries.filter((e) =>
      [e.display_name, e.username ?? "", e.city, e.headline].some((v) => v.toLowerCase().includes(s)),
    );
  }, [entries, q]);

  return (
    <main className="pf-root relative min-h-screen overflow-hidden bg-[#050506] px-4 pb-28 pt-28 text-white sm:px-6">
      <style>{pfCss}</style>

      {/* backdrop */}
      <div className="pf-grid-bg absolute inset-x-0 top-0 h-[620px]" />
      <div className="pf-orb -left-24 top-24 h-80 w-80" />
      <div className="pf-orb -right-16 top-64 h-96 w-96" />

      <div className="relative mx-auto max-w-6xl">
        <motion.header
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE }}
          className="text-center"
        >
          <span className="pf-kicker">Aura Elite</span>
          <h1 className="pf-title mt-4 text-4xl font-bold tracking-tight sm:text-6xl">Portfolios</h1>
          <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-white/55 sm:text-base">
            Οι δουλειές των μελών AURA ELITE. Εμπνεύσου, ανακάλυψε στυλ και στήριξε με ένα like.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {user && isElite && !portfolio && (
              <Link to="/portfolios/create" className="pf-btn pf-btn-solid px-6 py-3 tracking-[0.16em]">
                <Sparkles className="size-4" /> ΔΗΜΙΟΥΡΓΗΣΕ ΤΟ PORTFOLIO ΣΟΥ
              </Link>
            )}
            {user && isElite && portfolio && (
              <Link to="/portfolios/$slug" params={{ slug: portfolio.slug }} className="pf-btn pf-btn-solid px-6 py-3 tracking-[0.16em]">
                ΤΟ PORTFOLIO ΜΟΥ
              </Link>
            )}
            {!isElite && (
              <Link to="/pricing" className="pf-btn px-6 py-3 tracking-[0.16em]">
                <Gem className="size-4" /> ΓΙΝΕ ELITE
              </Link>
            )}
          </div>
        </motion.header>

        {/* search */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: EASE }}
          className="relative mx-auto mt-12 max-w-md"
        >
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-white/40" />
          <input
            className="pf-input"
            style={{ paddingLeft: "2.6rem" }}
            placeholder="Αναζήτηση ονόματος ή πόλης…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Αναζήτηση portfolio"
          />
        </motion.div>

        {/* grid */}
        <div className="mt-12">
          {error ? (
            <p className="pf-toast mx-auto max-w-md" role="alert">
              {error}
            </p>
          ) : !filtered ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="pf-panel mx-auto max-w-md p-10 text-center">
              <Images className="mx-auto size-9 text-white/40" />
              <p className="mt-4 text-sm text-white/60">
                {entries && entries.length === 0 ? "Δεν υπάρχουν ακόμα portfolios. Γίνε ο πρώτος!" : "Δεν βρέθηκε κανένα αποτέλεσμα."}
              </p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((e, i) => (
                <BoardCard key={e.slug} entry={e} index={i} />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}