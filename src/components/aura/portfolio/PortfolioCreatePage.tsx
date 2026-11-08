// src/components/aura/portfolio/PortfolioCreatePage.tsx
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { motion } from "motion/react";
import { ArrowLeft, Camera, Gem, Loader2, Lock, UserRound, Share2 } from "lucide-react";
import { createPortfolio, updatePortfolio, useIsElite, useMyPortfolio, type PortfolioForm } from "@/lib/portfolio";
import { useAuthUser } from "@/lib/useAuthUser";
import { pfCss } from "./pfStyles";

const EASE = [0.22, 1, 0.36, 1] as const;

const STEPS = [
  {
    icon: UserRound,
    title: "Φτιάξε το προφίλ σου",
    text: "Γράψε έναν σύντομο τίτλο, λίγα λόγια για σένα, την πόλη σου και το Instagram σου.",
  },
  {
    icon: Camera,
    title: "Ανέβασε τις δουλειές σου",
    text: "Πρόσθεσε φωτογραφίες από κουρέματα και fades, με περιγραφή για την τεχνική που χρησιμοποίησες.",
  },
  {
    icon: Share2,
    title: "Δείξε τες σε όλους",
    text: "Το portfolio εμφανίζεται στη δημόσια λίστα και όλοι μπορούν να το δουν και να κάνουν like.",
  },
];

export default function PortfolioCreatePage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuthUser();
  const { isElite, loading: eliteLoading } = useIsElite(user?.id);
  const { portfolio, loading: pfLoading } = useMyPortfolio(user?.id);

  const [form, setForm] = useState<PortfolioForm>({ headline: "", bio: "", city: "", instagram: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editing = Boolean(portfolio);

  useEffect(() => {
    if (portfolio) {
      setForm({
        headline: portfolio.headline,
        bio: portfolio.bio,
        city: portfolio.city,
        instagram: portfolio.instagram,
      });
    }
  }, [portfolio]);

  function set<K extends keyof PortfolioForm>(key: K, value: PortfolioForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!user || busy) return;
    setBusy(true);
    setError(null);
    try {
      let slug: string;
      if (editing && portfolio) {
        await updatePortfolio(user.id, form);
        slug = portfolio.slug;
      } else {
        slug = await createPortfolio(form);
      }
      await navigate({ to: "/portfolios/$slug", params: { slug } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Κάτι πήγε στραβά.");
      setBusy(false);
    }
  }

  const shell = (children: React.ReactNode) => (
    <main className="pf-root relative min-h-screen overflow-hidden bg-[#050506] px-4 pb-28 pt-28 text-white sm:px-6">
      <style>{pfCss}</style>
      <div className="pf-grid-bg absolute inset-x-0 top-0 h-[560px]" />
      <div className="pf-orb -left-24 top-24 h-80 w-80" />
      <div className="pf-orb -right-16 top-72 h-96 w-96" />
      <div className="relative mx-auto max-w-3xl">{children}</div>
    </main>
  );

  if (authLoading || (user && (eliteLoading || pfLoading))) {
    return shell(
      <div className="space-y-5">
        <div className="pf-skel mx-auto h-10 w-2/3 rounded" />
        <div className="pf-skel h-40 w-full rounded-2xl" />
      </div>,
    );
  }

  if (!user) {
    return shell(
      <div className="pf-panel mx-auto max-w-md p-10 text-center">
        <Lock className="mx-auto size-9 text-white/40" />
        <h1 className="pf-title mt-4 text-2xl font-bold">Συνδέσου για να συνεχίσεις</h1>
        <Link to="/login" className="pf-btn pf-btn-solid mt-6 px-8">
          Σύνδεση
        </Link>
      </div>,
    );
  }

  if (!isElite) {
    return shell(
      <div className="pf-panel mx-auto max-w-md p-10 text-center">
        <Gem className="mx-auto size-9 text-white/60" />
        <h1 className="pf-title mt-4 text-2xl font-bold">Μόνο για μέλη AURA ELITE</h1>
        <p className="mt-3 text-sm text-white/55">Κάνε upgrade για να δημιουργήσεις το δικό σου portfolio.</p>
        <Link to="/pricing" className="pf-btn pf-btn-solid mt-6 px-8 tracking-[0.16em]">
          UPGRADE TO ELITE
        </Link>
      </div>,
    );
  }

  return shell(
    <>
      <Link
        to={editing && portfolio ? "/portfolios/$slug" : "/portfolios"}
        params={editing && portfolio ? { slug: portfolio.slug } : undefined}
        className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/45 transition hover:text-white"
      >
        <ArrowLeft className="size-3.5" /> Πίσω
      </Link>

      <motion.header
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: EASE }}
        className="mt-8 text-center"
      >
        <span className="pf-kicker">Aura Elite</span>
        <h1 className="pf-title mt-4 text-3xl font-bold tracking-tight sm:text-5xl">
          {editing ? "Επεξεργασία portfolio" : "Δημιούργησε το portfolio σου"}
        </h1>
      </motion.header>

      {!editing && (
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 + i * 0.1, ease: EASE }}
              className="pf-step"
            >
              <span className="pf-step-n">{i + 1}</span>
              <s.icon className="mt-4 size-5 text-white/70" />
              <h3 className="mt-3 text-sm font-semibold text-white">{s.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-white/55">{s.text}</p>
            </motion.div>
          ))}
        </div>
      )}

      <motion.form
        onSubmit={(e) => void submit(e)}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.35, ease: EASE }}
        className="pf-panel mt-8 space-y-5 p-6 sm:p-8"
      >
        <label className="block">
          <span className="mb-1.5 flex items-center justify-between text-[11px] uppercase tracking-[0.22em] text-white/45">
            Τίτλος <span className="normal-case tracking-normal">{form.headline.length}/80</span>
          </span>
          <input
            className="pf-input"
            placeholder="π.χ. Fade specialist · Barber στην Αθήνα"
            maxLength={80}
            value={form.headline}
            onChange={(e) => set("headline", e.target.value)}
            disabled={busy}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 flex items-center justify-between text-[11px] uppercase tracking-[0.22em] text-white/45">
            Bio <span className="normal-case tracking-normal">{form.bio.length}/500</span>
          </span>
          <textarea
            className="pf-input min-h-[110px] resize-y"
            placeholder="Πες λίγα λόγια για σένα και το στυλ σου…"
            maxLength={500}
            value={form.bio}
            onChange={(e) => set("bio", e.target.value)}
            disabled={busy}
          />
        </label>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[11px] uppercase tracking-[0.22em] text-white/45">Πόλη</span>
            <input className="pf-input" placeholder="Αθήνα" maxLength={60} value={form.city} onChange={(e) => set("city", e.target.value)} disabled={busy} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] uppercase tracking-[0.22em] text-white/45">Instagram</span>
            <input
              className="pf-input"
              placeholder="username (χωρίς @)"
              maxLength={40}
              value={form.instagram}
              onChange={(e) => set("instagram", e.target.value.replace(/[^A-Za-z0-9._]/g, ""))}
              disabled={busy}
            />
          </label>
        </div>

        {error && (
          <p className="pf-toast" role="alert">
            <span>
              {error}
              {/username/i.test(error) && (
                <>
                  {" "}
                  <Link to="/profile" className="font-semibold underline underline-offset-4">
                    Πήγαινε στο προφίλ
                  </Link>
                </>
              )}
            </span>
          </p>
        )}

        <button type="submit" className="pf-btn pf-btn-solid w-full py-3.5 tracking-[0.18em]" disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin" />}
          {busy ? "Αποθήκευση…" : editing ? "ΑΠΟΘΗΚΕΥΣΗ" : "ΔΗΜΙΟΥΡΓΙΑ PORTFOLIO"}
        </button>
        {!editing && (
          <p className="text-center text-[11px] text-white/35">
            Η διεύθυνση του portfolio σου προκύπτει από το username σου και δεν αλλάζει.
          </p>
        )}
      </motion.form>
    </>,
  );
}