// src/routes/delete.account.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "motion/react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AlertTriangle, ArrowLeft, Check, Loader2, ShieldAlert, Trash2 } from "lucide-react";
import ChromeButton from "@/components/aura/ChromeButton";
import { db } from "@/lib/db";
import { useAuth } from "@/lib/useAuth";
import { useSubscription } from "@/lib/useSubscription";
import { getPlan } from "@/lib/plans";

export const Route = createFileRoute("/delete/account")({
  head: () => ({
    meta: [
      { title: "AURA — Διαγραφή λογαριασμού" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: DeleteAccountPage,
});

const sb = db as unknown as SupabaseClient;
const PHRASE = "REMOVE MY ACCOUNT";
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

async function readFunctionError(error: any): Promise<string> {
  try {
    const body = await error?.context?.json?.();
    if (body?.error) return String(body.error);
  } catch {
    /* fall through */
  }
  return error?.message ?? "Η διαγραφή απέτυχε.";
}

function DeleteAccountPage() {
  const { session, loading: authLoading } = useAuth();
  const userId = session?.user.id;
  const { subscription, hasAccess } = useSubscription(userId);
  const reduce = useReducedMotion();

  const [phrase, setPhrase] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const phraseOk = phrase === PHRASE;
  const canSubmit = phraseOk && agreed && !busy;
  const plan = getPlan(subscription?.plan_id);

  // After success: back to the home page.
  useEffect(() => {
    if (!done) return;
    const t = window.setTimeout(() => window.location.assign("/"), 4500);
    return () => window.clearTimeout(t);
  }, [done]);

  async function handleDelete(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);

    try {
      const { error: fnError } = await sb.functions.invoke("delete-account", {
        body: { confirmation: phrase, acceptedTerms: agreed },
      });
      if (fnError) throw new Error(await readFunctionError(fnError));

      // The login no longer exists on the server: clear the local session only.
      try {
        await sb.auth.signOut({ scope: "local" });
      } catch {
        /* the session is already invalid */
      }
      try {
        window.localStorage.removeItem("aura.checkout.intent");
      } catch {
        /* storage blocked */
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Η διαγραφή απέτυχε.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="da-root relative min-h-screen w-full overflow-x-clip bg-aura-bg px-5 pb-24 pt-28 text-white sm:pt-32">
      <style>{css}</style>
      <div className="aura-grain" aria-hidden />
      <div className="da-glow" aria-hidden />
      {!reduce && <div className="da-ring" aria-hidden />}

      <div className="relative z-10 mx-auto max-w-2xl">
        {authLoading ? (
          <div className="animate-pulse space-y-4" aria-busy="true">
            <div className="h-4 w-1/3 rounded bg-white/5" />
            <div className="h-48 rounded-2xl bg-white/5" />
          </div>
        ) : done ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE }}
            className="da-card p-10 text-center"
            role="status"
          >
            <span className="da-badge da-badge-ok">
              <Check className="size-6" />
            </span>
            <h1 className="da-title mt-6 text-3xl font-bold tracking-tight">Ο λογαριασμός σου διαγράφηκε</h1>
            <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-white/55">
              Η συνδρομή σου ακυρώθηκε και τα δεδομένα σου αφαιρέθηκαν. Αν αλλάξεις γνώμη, μπορείς να
              δημιουργήσεις ξανά λογαριασμό όποτε θέλεις. Σε μεταφέρουμε στην αρχική…
            </p>
            <a href="/" className="mt-8 inline-block">
              <ChromeButton type="button">ΑΡΧΙΚΗ</ChromeButton>
            </a>
          </motion.div>
        ) : !session ? (
          <div className="da-card p-10 text-center">
            <h1 className="da-title text-3xl font-bold tracking-tight">Χρειάζεται σύνδεση</h1>
            <p className="mt-4 text-sm text-white/55">Συνδέσου για να διαχειριστείς τον λογαριασμό σου.</p>
            <Link to="/login" className="mt-8 inline-block">
              <ChromeButton type="button">ΣΥΝΔΕΣΗ</ChromeButton>
            </Link>
          </div>
        ) : (
          <motion.form
            onSubmit={handleDelete}
            initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.9, ease: EASE }}
            className="da-card p-7 sm:p-10"
            noValidate
          >
            <Link to="/profile" className="da-back">
              <ArrowLeft className="size-4" /> Πίσω στο προφίλ
            </Link>

            <div className="mt-8 flex items-center gap-4">
              <span className="da-badge">
                <ShieldAlert className="size-6" />
              </span>
              <div>
                <p className="text-[11px] uppercase tracking-[0.4em] text-red-300/70">Μόνιμη ενέργεια</p>
                <h1 className="da-title mt-1 text-3xl font-bold tracking-tight">Διαγραφή λογαριασμού</h1>
              </div>
            </div>

            {hasAccess && subscription && (
              <div className="mt-8 flex gap-3 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100" role="alert">
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-300" />
                <p className="leading-relaxed">
                  Έχεις ενεργή συνδρομή{plan ? <strong> {plan.name}</strong> : null}. Θα ακυρωθεί{" "}
                  <strong>αμέσως</strong> και δεν θα γίνουν άλλες χρεώσεις. Δεν επιστρέφεται το υπόλοιπο της
                  τρέχουσας περιόδου.
                </p>
              </div>
            )}

            <section className="mt-8">
              <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-white/50">Τι θα διαγραφεί</h2>
              <ul className="mt-4 space-y-3 text-sm text-white/70">
                {[
                  "Το προφίλ σου, το username και η φωτογραφία σου",
                  "Η πρόοδος, τα μαθήματα και οι αξιολογήσεις σου",
                  "Τα μηνύματα και τα αρχεία σου στην κοινότητα",
                  "Η συνδρομή σου (ακυρώνεται άμεσα στο Stripe)",
                  "Ο λογαριασμός σύνδεσης (Google / Apple / email)",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <Trash2 className="mt-0.5 size-4 shrink-0 text-red-300/70" />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-xs leading-relaxed text-white/40">
                Τα στοιχεία των παραστατικών (ποσά, ημερομηνίες) διατηρούνται ανωνυμοποιημένα, χωρίς σύνδεση με
                εσένα, όπως απαιτεί η φορολογική νομοθεσία. Μπορείς να ξαναδημιουργήσεις λογαριασμό στο μέλλον με
                το ίδιο email ή Google/Apple λογαριασμό· θα ξεκινήσεις από την αρχή.
              </p>
            </section>

            <div className="da-divider my-8" aria-hidden />

            <label htmlFor="da-phrase" className="block text-sm text-white/70">
              Για επιβεβαίωση γράψε <strong className="select-all font-mono tracking-wider text-white">{PHRASE}</strong>
            </label>
            <input
              id="da-phrase"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              disabled={busy}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder={PHRASE}
              aria-invalid={phrase.length > 0 && !phraseOk}
              className="da-input mt-3 font-mono tracking-wider"
            />
            {phrase.length > 0 && !phraseOk && (
              <p className="mt-2 text-xs text-white/40">Πρέπει να ταιριάζει ακριβώς, με κεφαλαία.</p>
            )}

            <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-black/40 p-4">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                disabled={busy}
                className="mt-0.5 h-4 w-4 cursor-pointer accent-white"
              />
              <span className="text-xs leading-relaxed text-white/60">
                Έχω διαβάσει και αποδέχομαι τους{" "}
                <Link to="/terms" target="_blank" className="text-white underline underline-offset-4 hover:text-neutral-300">
                  Όρους Χρήσης
                </Link>
                , και κατανοώ ότι η διαγραφή του λογαριασμού μου είναι μόνιμη και δεν αναιρείται.
              </span>
            </label>

            {error && (
              <p className="mt-5 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200" role="alert">
                {error}
              </p>
            )}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button type="submit" disabled={!canSubmit} className="da-danger">
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                {busy ? "Διαγραφή…" : "ΔΙΑΓΡΑΦΗ ΛΟΓΑΡΙΑΣΜΟΥ"}
              </button>
              <Link to="/profile" className="flex-1">
                <ChromeButton type="button" variant="secondary" className="w-full" disabled={busy}>
                  ΑΚΥΡΩΣΗ
                </ChromeButton>
              </Link>
            </div>
          </motion.form>
        )}
      </div>
    </div>
  );
}

const css = `
@keyframes da-spin { to { transform: rotate(360deg); } }
@keyframes da-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

.da-glow { position: absolute; left: 50%; top: 8%; width: min(720px, 90vw); height: 420px; transform: translateX(-50%); pointer-events: none;
  background: radial-gradient(60% 60% at 50% 40%, rgba(220,226,236,.12), transparent 70%); filter: blur(40px); }
.da-ring { position: absolute; left: 50%; top: 26%; width: min(620px, 90vw); aspect-ratio: 1; transform: translate(-50%, -50%); border-radius: 9999px; pointer-events: none; opacity: .4;
  background: conic-gradient(from 0deg, transparent 0 62%, rgba(248,113,113,.35) 82%, transparent 100%);
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 1.5px), #000 calc(100% - 1px)); mask: radial-gradient(farthest-side, transparent calc(100% - 1.5px), #000 calc(100% - 1px));
  animation: da-spin 24s linear infinite; }
.da-card { border-radius: 1.5rem; border: 1px solid rgba(255,255,255,.12);
  background: linear-gradient(180deg, rgba(22,23,29,.95), rgba(9,10,13,.97)); box-shadow: 0 40px 90px -40px rgba(0,0,0,.9), inset 0 1px 0 rgba(255,255,255,.06);
  -webkit-backdrop-filter: blur(20px); backdrop-filter: blur(20px); }
.da-title { background: linear-gradient(110deg, #6b7280 0%, #f8fafc 25%, #9ca3af 45%, #ffffff 60%, #8b93a1 80%, #f1f5f9 100%);
  background-size: 250% 100%; -webkit-background-clip: text; background-clip: text; color: transparent; animation: da-shimmer 8s linear infinite; }
.da-back { display: inline-flex; align-items: center; gap: .6rem; font-size: 11px; letter-spacing: .3em; text-transform: uppercase; color: rgba(255,255,255,.55); transition: color .25s, transform .25s; }
.da-back:hover { color: #fff; transform: translateX(-3px); }
.da-badge { display: grid; place-items: center; flex-shrink: 0; width: 56px; height: 56px; border-radius: 9999px; color: #fca5a5;
  border: 1px solid rgba(248,113,113,.4); background: radial-gradient(circle at 30% 25%, rgba(248,113,113,.2), rgba(255,255,255,.02)); box-shadow: 0 0 40px -10px rgba(248,113,113,.6); }
.da-badge-ok { margin: 0 auto; color: #f1f5f9; border-color: rgba(232,236,242,.4); background: radial-gradient(circle at 30% 25%, rgba(255,255,255,.18), rgba(255,255,255,.02)); box-shadow: 0 0 40px -10px rgba(232,236,242,.6); }
.da-divider { height: 1px; background: linear-gradient(90deg, transparent, rgba(255,255,255,.2), transparent); }
.da-input { width: 100%; padding: .85rem 1rem; border-radius: .8rem; font-size: 14px; color: #f3f4f6; outline: none; border: 1px solid rgba(255,255,255,.14); background: rgba(0,0,0,.45);
  transition: border-color .25s, box-shadow .25s; }
.da-input::placeholder { color: rgba(255,255,255,.2); }
.da-input:focus { border-color: rgba(232,236,242,.55); box-shadow: 0 0 0 1px rgba(232,236,242,.3), 0 0 26px -8px rgba(232,236,242,.45); }
.da-input[aria-invalid="true"] { border-color: rgba(248,113,113,.5); }
.da-danger { display: inline-flex; flex: 1; align-items: center; justify-content: center; gap: .6rem; padding: .95rem 1.4rem; border-radius: .7rem; font-size: 12px; font-weight: 600; letter-spacing: .2em; color: #fff; cursor: pointer;
  border: 1px solid rgba(248,113,113,.6); background: linear-gradient(180deg, rgba(220,38,38,.75), rgba(127,29,29,.85));
  box-shadow: 0 0 34px -10px rgba(248,113,113,.7), inset 0 1px 0 rgba(255,255,255,.25); transition: transform .15s, box-shadow .25s, opacity .2s, filter .2s; }
.da-danger:hover:not(:disabled) { box-shadow: 0 0 46px -6px rgba(248,113,113,.9), inset 0 1px 0 rgba(255,255,255,.3); transform: translateY(-1px); }
.da-danger:active:not(:disabled) { transform: translateY(1px); }
.da-danger:disabled { opacity: .35; filter: grayscale(.6); cursor: not-allowed; box-shadow: none; }
.da-root a:focus-visible, .da-root button:focus-visible, .da-root input:focus-visible { outline: 2px solid rgba(232,236,242,.8); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { .da-title, .da-ring { animation: none !important; } }
`;