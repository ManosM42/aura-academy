// src/routes/login.tsx
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { motion } from "motion/react";
import AuraMark from "@/components/aura/AuraMark";
import ChromeButton from "@/components/aura/ChromeButton";
import ChromeCursor from "@/components/aura/ChromeCursor";
import { useAuth } from "@/hooks/useAuth";
import { consumeCheckoutIntent, peekCheckoutIntent } from "@/lib/checkout-intent";
import { isPlanId, type PlanId } from "@/lib/plans";

interface LoginSearch {
  plan?: PlanId;
}

export const Route = createFileRoute("/login")({
  // Το ?plan= είναι ο ΠΡΩΤΕΥΩΝ φορέας του πακέτου. Χωρίς αυτό το
  // validateSearch, τα search={{ plan }} links σε PricingCards.tsx,
  // checkout.index.tsx και auth.callback.tsx δεν κάνουν typecheck.
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    plan: isPlanId(search["plan"]) ? search["plan"] : undefined,
  }),
  component: LoginPage,
});

type Mode = "signin" | "signup";

function LoginPage() {
  const navigate = useNavigate();
  const { plan: searchPlan } = Route.useSearch();
  const { user, loading, signIn, signUp, signInWithGoogle } = useAuth();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  /**
   * Μετά από επιτυχή αυθεντικοποίηση: το πακέτο έρχεται πρώτα από το URL
   * (?plan=) και μόνο ως fallback από το αποθηκευμένο intent. Το URL είναι
   * αξιόπιστο· το localStorage χάνεται σε λήξη TTL, private mode, ή όταν
   * το OAuth επιστρέψει σε άλλο origin. Αλλιώς → dashboard.
   */
  const goAfterAuth = useCallback(() => {
    const plan = searchPlan ?? consumeCheckoutIntent();
    if (plan) {
      navigate({ to: "/checkout", search: { plan } });
    } else {
      navigate({ to: "/dashboard" });
    }
  }, [navigate, searchPlan]);

  // Already signed in -> honour a pending checkout intent, else dashboard.
  useEffect(() => {
    if (!loading && user) goAfterAuth();
  }, [loading, user, goAfterAuth]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const cleanEmail = email.trim();

    if (!cleanEmail || !password) {
      setError("Enter your email and password.");
      return;
    }
    if (mode === "signup" && password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "signin") {
        await signIn(cleanEmail, password);
        goAfterAuth();
      } else {
        const { needsConfirmation } = await signUp(cleanEmail, password);
        if (needsConfirmation) {
          setNotice("Check your inbox to confirm your email, then sign in.");
          setMode("signin");
          setPassword("");
        } else {
          goAfterAuth();
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setNotice(null);
    setGoogleLoading(true);
    try {
      // peek, ΟΧΙ consume: αν σβήσουμε το intent τώρα και το OAuth
      // αποτύχει ή ο χρήστης γυρίσει πίσω, το πακέτο έχει χαθεί.
      const plan = searchPlan ?? peekCheckoutIntent();
      // Redirects to Google, then back to /auth/callback?plan=…
      await signInWithGoogle(plan ?? undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed.");
      setGoogleLoading(false);
    }
  }

  const busy = submitting || googleLoading;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-aura-bg px-6 text-aura-text">
      <div className="aura-grain" aria-hidden />
      <ChromeCursor />
      <div className="hero-atmosphere absolute inset-0" aria-hidden />

      <motion.div
        initial={{ opacity: 0, y: 24, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        className="chrome-field relative z-10 my-12 w-full max-w-md rounded-2xl border border-white/10 bg-aura-surface/80 p-8 backdrop-blur-xl sm:p-10"
      >
        <div className="flex flex-col items-center text-center">
          <Link to="/" aria-label="AURA home">
            <AuraMark />
          </Link>
          <span className="chrome-text font-aura mt-6 text-xs font-semibold uppercase tracking-[0.5em]">
            Aura
          </span>
          <h1 className="chrome-text font-aura mt-4 text-3xl font-bold tracking-tight">
            {mode === "signin" ? "Enter the Academy" : "Create Your Account"}
          </h1>
          <p className="font-aura mt-3 text-sm text-aura-text-secondary">
            {mode === "signin"
              ? "Sign in to continue mastering the craft."
              : "Begin your path. Learn. Practice. Prove."}
          </p>
        </div>

        {/* Google OAuth */}
        <ChromeButton
          type="button"
          variant="secondary"
          onClick={handleGoogle}
          disabled={busy}
          className="mt-8 w-full gap-3"
        >
          <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
            <path
              fill="#FFFFFF"
              d="M43.6 20.5h-1.9V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.3 4.1 29.4 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.2-.1-2.3-.4-3.5z"
            />
          </svg>
          {googleLoading ? "Redirecting…" : "Continue with Google"}
        </ChromeButton>

        {/* divider */}
        <div className="my-7 flex items-center gap-4">
          <span className="h-px flex-1 bg-white/10" aria-hidden />
          <span className="font-aura text-[0.65rem] uppercase tracking-[0.28em] text-aura-text-muted">
            or
          </span>
          <span className="h-px flex-1 bg-white/10" aria-hidden />
        </div>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <label className="flex flex-col gap-2" htmlFor="login-email">
            <span className="font-aura text-[0.7rem] uppercase tracking-[0.2em] text-aura-text-muted">
              Email
            </span>
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
              aria-invalid={Boolean(error)}
              className="focus-ring font-aura rounded-lg border border-white/10 bg-aura-bg2 px-4 py-3 text-sm text-aura-text outline-none transition-colors placeholder:text-aura-text-muted focus:border-white/30 disabled:opacity-60"
              placeholder="you@example.com"
            />
          </label>

          <label className="flex flex-col gap-2" htmlFor="login-password">
            <span className="font-aura text-[0.7rem] uppercase tracking-[0.2em] text-aura-text-muted">
              Password
            </span>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              aria-invalid={Boolean(error)}
              aria-describedby={mode === "signup" ? "login-password-hint" : undefined}
              className="focus-ring font-aura rounded-lg border border-white/10 bg-aura-bg2 px-4 py-3 text-sm text-aura-text outline-none transition-colors placeholder:text-aura-text-muted focus:border-white/30 disabled:opacity-60"
              placeholder="••••••••"
            />
            {mode === "signup" && (
              <span
                id="login-password-hint"
                className="font-aura text-[0.7rem] text-aura-text-muted"
              >
                At least 6 characters.
              </span>
            )}
          </label>

          {error && (
            <p className="font-aura text-sm text-red-400/90" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="chrome-text font-aura text-sm" role="status">
              {notice}
            </p>
          )}

          <ChromeButton type="submit" disabled={busy} className="mt-2 w-full">
            {submitting ? "Please wait…" : mode === "signin" ? "SIGN IN" : "CREATE ACCOUNT"}
          </ChromeButton>
        </form>

        <div className="chrome-line mx-auto mt-8 h-px w-2/3" aria-hidden />

        <p className="font-aura mt-6 text-center text-sm text-aura-text-secondary">
          {mode === "signin" ? "New to AURA?" : "Already have an account?"}{" "}
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
              setNotice(null);
            }}
            className="font-aura text-aura-white underline-offset-4 transition-colors hover:underline disabled:opacity-60"
          >
            {mode === "signin" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </motion.div>
    </div>
  );
}