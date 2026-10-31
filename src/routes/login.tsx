// src/routes/login.tsx
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type InputHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import AuraMark from "@/components/aura/AuraMark";
import ChromeButton from "@/components/aura/ChromeButton";
import ChromeCursor from "@/components/aura/ChromeCursor";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { consumeCheckoutIntent, peekCheckoutIntent } from "@/lib/checkout-intent";
import { isPlanId, type PlanId } from "@/lib/plans";

/* ------------------------------------------------------------------ */
/* Route                                                               */
/* ------------------------------------------------------------------ */

interface LoginSearch {
  plan?: PlanId;
  mode?: "reset";
}

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    plan: isPlanId(search["plan"]) ? search["plan"] : undefined,
    mode: search["mode"] === "reset" ? "reset" : undefined,
  }),
  component: LoginPage,
});

type Mode = "signin" | "signup" | "forgot" | "update" | "username" | "sent";
type SentState = { kind: "confirm" | "reset"; email: string };

/* ------------------------------------------------------------------ */
/* Cloudflare Turnstile                                                */
/* ------------------------------------------------------------------ */

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id?: string) => void;
  remove: (id?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let turnstilePromise: Promise<void> | null = null;
function loadTurnstile(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (!turnstilePromise) {
    turnstilePromise = new Promise<void>((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      s.async = true;
      s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => {
        turnstilePromise = null;
        reject(new Error("Captcha failed to load"));
      };
      document.head.appendChild(s);
    });
  }
  return turnstilePromise;
}

function CaptchaBox({
  onToken,
  resetSignal,
}: {
  onToken: (token: string | null) => void;
  resetSignal: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    let cancelled = false;
    loadTurnstile()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile) return;
        widgetId.current = window.turnstile.render(ref.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: "dark",
          callback: (t: string) => onTokenRef.current(t),
          "expired-callback": () => onTokenRef.current(null),
          "error-callback": () => onTokenRef.current(null),
        });
      })
      .catch(() => onTokenRef.current(null));
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, []);

  // Tokens are single-use: reset the widget after every attempt.
  useEffect(() => {
    if (resetSignal === 0) return;
    if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
    onTokenRef.current(null);
  }, [resetSignal]);

  if (!TURNSTILE_SITE_KEY) return null;
  return <div ref={ref} className="flex min-h-[65px] justify-center" />;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

function passwordStrength(pw: string): number {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

type UsernameStatus = "idle" | "invalid" | "checking" | "available" | "taken" | "error";

function useUsernameCheck(value: string, enabled: boolean): UsernameStatus {
  const [status, setStatus] = useState<UsernameStatus>("idle");
  useEffect(() => {
    if (!enabled || !value) {
      setStatus("idle");
      return;
    }
    if (!USERNAME_RE.test(value)) {
      setStatus("invalid");
      return;
    }
    setStatus("checking");
    let cancelled = false;
    const t = window.setTimeout(async () => {
      const { data, error } = await supabase.rpc("is_username_available", { p_username: value });
      if (cancelled) return;
      setStatus(error ? "error" : data ? "available" : "taken");
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [value, enabled]);
  return status;
}

const usernameHint: Record<UsernameStatus, { text: string; tone: string }> = {
  idle: { text: "3–20 characters: letters, numbers, underscore.", tone: "text-aura-text-muted" },
  invalid: { text: "Use 3–20 lowercase letters, numbers or underscores.", tone: "text-red-400/90" },
  checking: { text: "Checking availability…", tone: "text-aura-text-muted" },
  available: { text: "Username is available ✓", tone: "text-emerald-300/90" },
  taken: { text: "That username is already taken.", tone: "text-red-400/90" },
  error: { text: "Couldn't verify availability. You can still try.", tone: "text-amber-300/90" },
};

/* ------------------------------------------------------------------ */
/* Small UI pieces                                                     */
/* ------------------------------------------------------------------ */

function Field({
  id,
  label,
  hint,
  hintTone = "text-aura-text-muted",
  right,
  ...props
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  hintTone?: string;
  right?: ReactNode;
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <motion.div variants={item} className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className="font-aura text-[0.7rem] uppercase tracking-[0.2em] text-aura-text-muted"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={id}
          {...props}
          className="lg-input font-aura w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-sm text-aura-text outline-none placeholder:text-aura-text-muted disabled:opacity-60"
        />
        {right && <div className="absolute inset-y-0 right-2 flex items-center">{right}</div>}
      </div>
      {hint && <span className={`font-aura text-[0.7rem] ${hintTone}`}>{hint}</span>}
    </motion.div>
  );
}

function Message({ kind, children }: { kind: "error" | "notice"; children: ReactNode }) {
  return (
    <motion.p
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      role={kind === "error" ? "alert" : "status"}
      className={`font-aura rounded-lg border px-3.5 py-2.5 text-sm ${
        kind === "error"
          ? "border-red-400/20 bg-red-500/[0.07] text-red-300/95"
          : "border-white/15 bg-white/[0.04] text-aura-text"
      }`}
    >
      {children}
    </motion.p>
  );
}

function EyeButton({ shown, onClick }: { shown: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={shown ? "Hide password" : "Show password"}
      className="rounded-md p-2 text-aura-text-muted transition-colors hover:text-white"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {shown ? (
          <>
            <path d="M3 3l18 18" />
            <path d="M10.6 6.1A10.9 10.9 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-3.2 3.9M6.6 7.6A16.6 16.6 0 0 0 2.5 12S6 18 12 18c1.3 0 2.5-.3 3.6-.8" />
            <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
          </>
        ) : (
          <>
            <path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" />
            <circle cx="12" cy="12" r="3" />
          </>
        )}
      </svg>
    </button>
  );
}

function StrengthBar({ value }: { value: number }) {
  const labels = ["Too weak", "Weak", "Okay", "Strong", "Excellent"];
  return (
    <div className="mt-1" aria-live="polite">
      <div className="flex gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="h-[3px] flex-1 rounded-full transition-all duration-500"
            style={{
              background: i < value ? "linear-gradient(90deg,#9ca3af,#ffffff)" : "rgba(255,255,255,0.08)",
              boxShadow: i < value ? "0 0 10px rgba(255,255,255,0.35)" : "none",
            }}
          />
        ))}
      </div>
      <span className="font-aura mt-1.5 block text-[0.7rem] text-aura-text-muted">{labels[value]}</span>
    </div>
  );
}

const GoogleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
    <path
      fill="currentColor"
      d="M43.6 20.5h-1.9V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.3 4.1 29.4 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.2-.1-2.3-.4-3.5z"
    />
  </svg>
);

const AppleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
    <path
      fill="currentColor"
      d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
    />
  </svg>
);

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function LoginPage() {
  const navigate = useNavigate();
  const { plan: searchPlan, mode: searchMode } = Route.useSearch();
  const { user, loading } = useAuth();
  const reduceMotion = useReducedMotion();

  const [mode, setMode] = useState<Mode>(searchMode === "reset" ? "update" : "signin");
  const [recovery, setRecovery] = useState(searchMode === "reset");
  const [sent, setSent] = useState<SentState | null>(null);

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [needsResend, setNeedsResend] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "apple" | null>(null);

  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);

  const cardRef = useRef<HTMLDivElement>(null);
  const routingRef = useRef(false);

  const captchaRequired = Boolean(TURNSTILE_SITE_KEY);
  const showCaptcha = mode === "signin" || mode === "signup" || mode === "forgot";
  const busy = submitting || oauthLoading !== null;

  const usernameStatus = useUsernameCheck(username, mode === "signup" || mode === "username");
  const strength = passwordStrength(password);

  /* ---------- routing after auth ---------- */

  const goAfterAuth = useCallback(() => {
    const plan = searchPlan ?? consumeCheckoutIntent();
    if (plan) navigate({ to: "/checkout", search: { plan } });
    else navigate({ to: "/dashboard" });
  }, [navigate, searchPlan]);

  const continueAfterAuth = useCallback(
    async (userId: string) => {
      if (routingRef.current) return;
      routingRef.current = true;
      const { data, error: profileError } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", userId)
        .maybeSingle();

      // If the profile can't be read (RLS misconfig), don't trap the user here.
      if (profileError) {
        console.error("[login] profile lookup failed:", profileError.message);
        goAfterAuth();
        return;
      }
      if (!data?.username) {
        routingRef.current = false;
        setMode("username");
        return;
      }
      goAfterAuth();
    },
    [goAfterAuth],
  );

  useEffect(() => {
    if (loading || !user || recovery) return;
    void continueAfterAuth(user.id);
  }, [loading, user, recovery, continueAfterAuth]);

  /* password-recovery link opened */
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setRecovery(true);
        setMode("update");
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  /* ---------- helpers ---------- */

  const redirectBase = () => {
    const plan = searchPlan ?? peekCheckoutIntent();
    return `${window.location.origin}/login${plan ? `?plan=${plan}` : ""}`;
  };

  function changeMode(next: Mode) {
    setMode(next);
    setError(null);
    setNotice(null);
    setNeedsResend(false);
    setPassword("");
    setShowPw(false);
  }

  function burnCaptcha() {
    setCaptchaToken(null);
    setCaptchaReset((n) => n + 1);
  }

  function guardCaptcha(): boolean {
    if (captchaRequired && !captchaToken) {
      setError("Please complete the security check first.");
      return false;
    }
    return true;
  }

  function guardTerms(): boolean {
    if (!agreed) {
      setError("You must agree to the Terms of Service & Privacy Policy to proceed.");
      return false;
    }
    return true;
  }

  function onCardMove(e: MouseEvent<HTMLDivElement>) {
    const el = cardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  }

  /* ---------- actions ---------- */

  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setNeedsResend(false);
    if (!guardTerms() || !guardCaptcha()) return;

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setError("Enter your email and password.");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error: err } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
        options: { captchaToken: captchaToken ?? undefined },
      });
      if (err) {
        if (/confirm/i.test(err.message)) {
          setNeedsResend(true);
          setError("Your email isn't verified yet. Check your inbox or resend the link.");
        } else {
          setError(err.message);
        }
        return;
      }
      if (data.user) await continueAfterAuth(data.user.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      burnCaptcha();
      setSubmitting(false);
    }
  }

  async function handleSignUp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!guardTerms() || !guardCaptcha()) return;

    const cleanEmail = email.trim();
    const cleanName = fullName.trim();

    if (!USERNAME_RE.test(username)) {
      setError("Choose a valid username (3–20 lowercase letters, numbers or underscores).");
      return;
    }
    if (usernameStatus === "taken") {
      setError("That username is already taken.");
      return;
    }
    if (!cleanEmail) {
      setError("Enter your email.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error: err } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          emailRedirectTo: redirectBase(),
          captchaToken: captchaToken ?? undefined,
          data: { username, full_name: cleanName || null },
        },
      });
      if (err) {
        setError(err.message);
        return;
      }
      // With email confirmation on, an already-registered email returns a user with no identities.
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        setError("An account with this email already exists. Try signing in instead.");
        return;
      }
      if (data.session && data.user) {
        await continueAfterAuth(data.user.id);
      } else {
        setSent({ kind: "confirm", email: cleanEmail });
        changeMode("sent");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      burnCaptcha();
      setSubmitting(false);
    }
  }

  async function handleForgot(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!guardCaptcha()) return;
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError("Enter your email.");
      return;
    }
    setSubmitting(true);
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${window.location.origin}/login?mode=reset`,
        captchaToken: captchaToken ?? undefined,
      });
      if (err) {
        setError(err.message);
        return;
      }
      setSent({ kind: "reset", email: cleanEmail });
      changeMode("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      burnCaptcha();
      setSubmitting(false);
    }
  }

  async function handleUpdatePassword(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setSubmitting(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) {
        setError(err.message);
        return;
      }
      setRecovery(false); // effect takes over and routes the user onward
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveUsername(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!user) {
      setError("Your session expired. Please sign in again.");
      return;
    }
    if (!USERNAME_RE.test(username)) {
      setError("Choose a valid username (3–20 lowercase letters, numbers or underscores).");
      return;
    }
    if (usernameStatus === "taken") {
      setError("That username is already taken.");
      return;
    }
    setSubmitting(true);
    try {
      const { error: err } = await supabase
        .from("profiles")
        .upsert({ id: user.id, username, updated_at: new Date().toISOString() }, { onConflict: "id" });
      if (err) {
        setError(err.code === "23505" ? "That username is already taken." : err.message);
        return;
      }
      void supabase.auth.updateUser({ data: { username } }); // best-effort metadata sync
      goAfterAuth();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleOAuth(provider: "google" | "apple") {
    setError(null);
    setNotice(null);
    if (!guardTerms()) return;
    setOauthLoading(provider);
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: redirectBase() },
    });
    if (err) {
      setError(err.message);
      setOauthLoading(null);
    }
  }

  async function handleResend() {
    const target = sent?.email ?? email.trim();
    if (!target) {
      setError("Enter your email first.");
      return;
    }
    if (!guardCaptcha() && mode !== "sent") return;
    setSubmitting(true);
    setError(null);
    try {
      const { error: err } = await supabase.auth.resend({
        type: "signup",
        email: target,
        options: { emailRedirectTo: redirectBase(), captchaToken: captchaToken ?? undefined },
      });
      if (err) setError(err.message);
      else setNotice("Verification email sent again.");
    } finally {
      burnCaptcha();
      setSubmitting(false);
    }
  }

  /* ---------- shared fragments ---------- */

  const termsBox = (
    <motion.div
      variants={item}
      className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/40 p-3.5"
    >
      <input
        type="checkbox"
        id="terms-checkbox"
        checked={agreed}
        onChange={(e) => {
          setAgreed(e.target.checked);
          if (e.target.checked) setError(null);
        }}
        disabled={busy}
        className="mt-0.5 h-4 w-4 cursor-pointer rounded border-white/20 bg-black/60 accent-white"
      />
      <label
        htmlFor="terms-checkbox"
        className="font-aura cursor-pointer select-none text-xs font-extralight leading-relaxed text-aura-text-secondary"
      >
        I agree to the{" "}
        <Link to="/terms" className="text-white underline underline-offset-4 transition-colors hover:text-neutral-300">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link to="/terms" className="text-white underline underline-offset-4 transition-colors hover:text-neutral-300">
          Privacy Policy
        </Link>
        .
      </label>
    </motion.div>
  );

  const socials = (
    <motion.div variants={item} className="grid grid-cols-2 gap-3">
      <button
        type="button"
        className="lg-social font-aura"
        onClick={() => handleOAuth("google")}
        disabled={busy}
      >
        <GoogleIcon />
        {oauthLoading === "google" ? "Redirecting…" : "Google"}
      </button>
      <button
        type="button"
        className="lg-social font-aura"
        onClick={() => handleOAuth("apple")}
        disabled={busy}
      >
        <AppleIcon />
        {oauthLoading === "apple" ? "Redirecting…" : "Apple"}
      </button>
    </motion.div>
  );

  const divider = (
    <motion.div variants={item} className="flex items-center gap-4">
      <span className="h-px flex-1 bg-gradient-to-r from-transparent to-white/15" aria-hidden />
      <span className="font-aura text-[0.65rem] uppercase tracking-[0.28em] text-aura-text-muted">or</span>
      <span className="h-px flex-1 bg-gradient-to-l from-transparent to-white/15" aria-hidden />
    </motion.div>
  );

  const messages = (
    <>
      {error && <Message kind="error">{error}</Message>}
      {notice && <Message kind="notice">{notice}</Message>}
      {needsResend && (
        <button
          type="button"
          onClick={handleResend}
          disabled={busy}
          className="font-aura text-left text-sm text-white underline underline-offset-4 hover:text-neutral-300 disabled:opacity-60"
        >
          Resend verification email
        </button>
      )}
    </>
  );

  const submitDisabled = busy || (showCaptcha && captchaRequired && !captchaToken);

  /* ---------- titles ---------- */

  const titles: Record<Mode, { title: string; sub: string }> = {
    signin: { title: "Enter the Academy", sub: "Sign in to continue mastering the craft." },
    signup: { title: "Create Your Account", sub: "Begin your path. Learn. Practice. Prove." },
    forgot: { title: "Reset Password", sub: "We'll email you a secure link." },
    update: { title: "New Password", sub: "Choose a strong password to secure your account." },
    username: { title: "Claim Your Name", sub: "Pick a username to finish setting up your profile." },
    sent:
      sent?.kind === "reset"
        ? { title: "Link Sent", sub: `If ${sent.email} has an account, a reset link is on its way.` }
        : { title: "Check Your Inbox", sub: `We sent a verification link to ${sent?.email ?? "your email"}.` },
  };

  const redirecting = !loading && !!user && mode !== "username" && mode !== "update" && !recovery;

  /* ---------- body per mode ---------- */

  function renderBody() {
    if (redirecting) {
      return (
        <div className="flex flex-col items-center gap-4 py-10">
          <span className="lg-spinner" aria-hidden />
          <p className="font-aura text-sm text-aura-text-secondary">Preparing your account…</p>
        </div>
      );
    }

    if (mode === "signin") {
      return (
        <motion.form variants={container} initial="hidden" animate="show" onSubmit={handleSignIn} noValidate className="flex flex-col gap-4">
          {socials}
          {divider}
          <Field
            id="login-email"
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
          />
          <Field
            id="login-password"
            label="Password"
            type={showPw ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
            right={<EyeButton shown={showPw} onClick={() => setShowPw((s) => !s)} />}
          />
          <motion.div variants={item} className="-mt-1 text-right">
            <button
              type="button"
              onClick={() => changeMode("forgot")}
              className="font-aura text-xs text-aura-text-secondary underline-offset-4 transition-colors hover:text-white hover:underline"
            >
              Forgot password?
            </button>
          </motion.div>
          {termsBox}
          {messages}
          <motion.div variants={item}>
            <ChromeButton type="submit" disabled={submitDisabled || !agreed} className="w-full disabled:opacity-50">
              {submitting ? "Please wait…" : "SIGN IN"}
            </ChromeButton>
          </motion.div>
        </motion.form>
      );
    }

    if (mode === "signup") {
      const hint = usernameHint[usernameStatus];
      return (
        <motion.form variants={container} initial="hidden" animate="show" onSubmit={handleSignUp} noValidate className="flex flex-col gap-4">
          {socials}
          {divider}
          <Field
            id="signup-name"
            label="Full name (optional)"
            type="text"
            autoComplete="name"
            placeholder="Ada Lovelace"
            value={fullName}
            onChange={(e) => setFullName(e.target.value.slice(0, 60))}
            disabled={busy}
          />
          <Field
            id="signup-username"
            label="Username"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="your_handle"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20))}
            disabled={busy}
            hint={hint.text}
            hintTone={hint.tone}
          />
          <Field
            id="signup-email"
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
          />
          <div>
            <Field
              id="signup-password"
              label="Password"
              type={showPw ? "text" : "password"}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              right={<EyeButton shown={showPw} onClick={() => setShowPw((s) => !s)} />}
            />
            {password && <StrengthBar value={strength} />}
          </div>
          {termsBox}
          {messages}
          <motion.div variants={item}>
            <ChromeButton type="submit" disabled={submitDisabled || !agreed} className="w-full disabled:opacity-50">
              {submitting ? "Please wait…" : "CREATE ACCOUNT"}
            </ChromeButton>
          </motion.div>
        </motion.form>
      );
    }

    if (mode === "forgot") {
      return (
        <motion.form variants={container} initial="hidden" animate="show" onSubmit={handleForgot} noValidate className="flex flex-col gap-4">
          <Field
            id="forgot-email"
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
          />
          {messages}
          <motion.div variants={item}>
            <ChromeButton type="submit" disabled={submitDisabled} className="w-full disabled:opacity-50">
              {submitting ? "Please wait…" : "SEND RESET LINK"}
            </ChromeButton>
          </motion.div>
        </motion.form>
      );
    }

    if (mode === "update") {
      return (
        <motion.form variants={container} initial="hidden" animate="show" onSubmit={handleUpdatePassword} noValidate className="flex flex-col gap-4">
          <div>
            <Field
              id="new-password"
              label="New password"
              type={showPw ? "text" : "password"}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              right={<EyeButton shown={showPw} onClick={() => setShowPw((s) => !s)} />}
            />
            {password && <StrengthBar value={strength} />}
          </div>
          {messages}
          <motion.div variants={item}>
            <ChromeButton type="submit" disabled={busy} className="w-full disabled:opacity-50">
              {submitting ? "Please wait…" : "UPDATE PASSWORD"}
            </ChromeButton>
          </motion.div>
        </motion.form>
      );
    }

    if (mode === "username") {
      const hint = usernameHint[usernameStatus];
      return (
        <motion.form variants={container} initial="hidden" animate="show" onSubmit={handleSaveUsername} noValidate className="flex flex-col gap-4">
          <Field
            id="claim-username"
            label="Username"
            type="text"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="your_handle"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20))}
            disabled={busy}
            hint={hint.text}
            hintTone={hint.tone}
          />
          {messages}
          <motion.div variants={item}>
            <ChromeButton type="submit" disabled={busy || usernameStatus === "taken" || usernameStatus === "invalid"} className="w-full disabled:opacity-50">
              {submitting ? "Saving…" : "CONTINUE"}
            </ChromeButton>
          </motion.div>
        </motion.form>
      );
    }

    // sent
    return (
      <motion.div variants={container} initial="hidden" animate="show" className="flex flex-col items-center gap-5 text-center">
        <motion.div variants={item} className="lg-mail" aria-hidden>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="14" rx="2.5" />
            <path d="M3.5 7l8.5 6 8.5-6" />
          </svg>
        </motion.div>
        <motion.p variants={item} className="font-aura text-sm leading-relaxed text-aura-text-secondary">
          {sent?.kind === "reset"
            ? "Open the link in the email to choose a new password."
            : "Click the link in the email to verify your account. You'll land right back here."}
        </motion.p>
        {messages}
        {sent?.kind === "confirm" && (
          <motion.div variants={item} className="flex w-full flex-col gap-3">
            {captchaRequired && <p className="font-aura text-xs text-aura-text-muted">Complete the check below to resend.</p>}
            <button type="button" onClick={handleResend} disabled={busy || (captchaRequired && !captchaToken)} className="lg-social font-aura w-full justify-center disabled:opacity-50">
              {submitting ? "Sending…" : "Resend email"}
            </button>
          </motion.div>
        )}
      </motion.div>
    );
  }

  /* ---------- render ---------- */

  const showSentCaptcha = mode === "sent" && sent?.kind === "confirm" && captchaRequired;

  return (
    <div className="lg-root relative flex min-h-screen items-center justify-center overflow-hidden bg-aura-bg px-5 py-12 text-aura-text">
      <style>{css}</style>
      <div className="aura-grain" aria-hidden />
      <ChromeCursor />
      <div className="hero-atmosphere absolute inset-0" aria-hidden />
      <div className="lg-grid absolute inset-0" aria-hidden />

      {!reduceMotion && (
        <>
          <motion.div className="lg-orb left-[8%] top-[12%] h-72 w-72" animate={{ y: [0, -30, 0], x: [0, 16, 0] }} transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }} aria-hidden />
          <motion.div className="lg-orb bottom-[8%] right-[6%] h-96 w-96" animate={{ y: [0, 26, 0], x: [0, -20, 0] }} transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }} aria-hidden />
        </>
      )}

      <motion.div
        initial={{ opacity: 0, y: 28, filter: "blur(8px)", scale: 0.98 }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)", scale: 1 }}
        transition={{ duration: 1.1, ease: EASE }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="lg-glow" aria-hidden />
        <div className="lg-card-wrap">
          <div className="lg-card-border" aria-hidden />
          <div ref={cardRef} onMouseMove={onCardMove} className="lg-card p-8 sm:p-10">
            <div className="lg-spot" aria-hidden />

            <div className="relative flex flex-col items-center text-center">
              <Link to="/" aria-label="AURA home">
                <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.9, ease: EASE, delay: 0.2 }}>
                  <AuraMark />
                </motion.div>
              </Link>
              <span className="chrome-text font-aura mt-6 text-xs font-semibold uppercase tracking-[0.5em]">Aura</span>

              <AnimatePresence mode="wait">
                <motion.div
                  key={mode + (sent?.kind ?? "")}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3, ease: EASE }}
                >
                  <h1 className="lg-title font-aura mt-4 text-3xl font-bold tracking-tight">{titles[mode].title}</h1>
                  <p className="font-aura mt-3 text-sm text-aura-text-secondary">{titles[mode].sub}</p>
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="relative mt-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key={mode + (redirecting ? "-r" : "")}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3, ease: EASE }}
                >
                  {renderBody()}
                </motion.div>
              </AnimatePresence>

              {(showCaptcha || showSentCaptcha) && !redirecting && (
                <div className="mt-5">
                  <CaptchaBox onToken={setCaptchaToken} resetSignal={captchaReset} />
                </div>
              )}
            </div>

            {!redirecting && (
              <>
                <div className="chrome-line mx-auto mt-8 h-px w-2/3" aria-hidden />
                <p className="font-aura relative mt-6 text-center text-sm text-aura-text-secondary">
                  {mode === "signin" && (
                    <>
                      New to AURA?{" "}
                      <button type="button" disabled={busy} onClick={() => changeMode("signup")} className="lg-link">
                        Create an account
                      </button>
                    </>
                  )}
                  {mode === "signup" && (
                    <>
                      Already have an account?{" "}
                      <button type="button" disabled={busy} onClick={() => changeMode("signin")} className="lg-link">
                        Sign in
                      </button>
                    </>
                  )}
                  {(mode === "forgot" || mode === "sent" || mode === "update") && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setRecovery(false);
                        changeMode("signin");
                      }}
                      className="lg-link"
                    >
                      ← Back to sign in
                    </button>
                  )}
                  {mode === "username" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        await supabase.auth.signOut();
                        routingRef.current = false;
                        changeMode("signin");
                      }}
                      className="lg-link"
                    >
                      Use a different account
                    </button>
                  )}
                </p>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Styles (self-contained: silver chrome, glows, animations)           */
/* ------------------------------------------------------------------ */

const css = `
@keyframes lg-spin { to { transform: rotate(360deg); } }
@keyframes lg-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
@keyframes lg-pulse { 0%,100% { opacity: .55; } 50% { opacity: .9; } }
@keyframes lg-sweep { 0% { transform: translateX(-120%) skewX(-18deg); } 100% { transform: translateX(220%) skewX(-18deg); } }

.lg-grid {
  background-image:
    linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px);
  background-size: 56px 56px;
  -webkit-mask-image: radial-gradient(ellipse 70% 60% at 50% 45%, #000 20%, transparent 75%);
          mask-image: radial-gradient(ellipse 70% 60% at 50% 45%, #000 20%, transparent 75%);
  pointer-events: none;
}
.lg-orb {
  position: absolute; border-radius: 9999px; pointer-events: none;
  background: radial-gradient(circle at 35% 30%, rgba(232,236,242,.16), rgba(160,168,180,.05) 45%, transparent 70%);
  filter: blur(40px);
}
.lg-glow {
  position: absolute; inset: -48px; border-radius: 2rem; pointer-events: none;
  background: radial-gradient(60% 55% at 50% 40%, rgba(220,226,236,.20), transparent 70%);
  filter: blur(36px); animation: lg-pulse 6s ease-in-out infinite;
}
.lg-card-wrap { position: relative; border-radius: 1.25rem; padding: 1px; overflow: hidden; isolation: isolate; background: rgba(255,255,255,.07); }
.lg-card-border {
  position: absolute; inset: -60%; z-index: -1;
  background: conic-gradient(from 0deg, transparent 0 52%, rgba(255,255,255,0) 58%, rgba(232,236,242,.95) 74%, rgba(255,255,255,0) 90%, transparent 100%);
  animation: lg-spin 7s linear infinite;
}
.lg-card {
  position: relative; overflow: hidden; border-radius: calc(1.25rem - 1px);
  background: linear-gradient(180deg, rgba(20,21,27,.95), rgba(9,10,13,.97));
  -webkit-backdrop-filter: blur(24px); backdrop-filter: blur(24px);
}
.lg-spot {
  position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(420px circle at var(--mx, 50%) var(--my, 0%), rgba(255,255,255,.075), transparent 60%);
}
.lg-title {
  background: linear-gradient(110deg, #6b7280 0%, #f8fafc 25%, #9ca3af 45%, #ffffff 60%, #6b7280 100%);
  background-size: 250% 100%; -webkit-background-clip: text; background-clip: text; color: transparent;
  animation: lg-shimmer 6s linear infinite;
}
.lg-input { transition: border-color .25s, box-shadow .25s, background-color .25s; }
.lg-input:focus {
  border-color: rgba(232,236,242,.55);
  background-color: rgba(0,0,0,.55);
  box-shadow: 0 0 0 1px rgba(232,236,242,.35), 0 0 28px -6px rgba(232,236,242,.45);
}
.lg-social {
  position: relative; overflow: hidden; display: inline-flex; align-items: center; justify-content: center; gap: .6rem;
  padding: .75rem 1rem; border-radius: .6rem; font-size: .8rem; letter-spacing: .04em; color: #e8ecf2;
  border: 1px solid rgba(255,255,255,.12); background: linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,.02));
  transition: border-color .25s, box-shadow .25s, transform .25s;
}
.lg-social:hover:not(:disabled) { border-color: rgba(255,255,255,.35); box-shadow: 0 0 24px -6px rgba(232,236,242,.4); transform: translateY(-1px); }
.lg-social:disabled { opacity: .55; cursor: not-allowed; }
.lg-social::after {
  content: ""; position: absolute; top: 0; bottom: 0; width: 40%; left: 0; pointer-events: none;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.18), transparent); transform: translateX(-120%) skewX(-18deg);
}
.lg-social:hover:not(:disabled)::after { animation: lg-sweep .9s ease; }
.lg-link { color: #fff; text-underline-offset: 4px; transition: color .2s; }
.lg-link:hover:not(:disabled) { text-decoration: underline; color: #d1d5db; }
.lg-link:disabled { opacity: .6; }
.lg-spinner {
  width: 34px; height: 34px; border-radius: 9999px; border: 2px solid rgba(255,255,255,.12); border-top-color: #fff;
  animation: lg-spin .9s linear infinite; box-shadow: 0 0 20px rgba(255,255,255,.2);
}
.lg-mail {
  display: grid; place-items: center; width: 68px; height: 68px; border-radius: 9999px; color: #f1f5f9;
  border: 1px solid rgba(255,255,255,.18); background: radial-gradient(circle at 30% 25%, rgba(255,255,255,.14), rgba(255,255,255,.02));
  box-shadow: 0 0 40px -8px rgba(232,236,242,.5); animation: lg-pulse 3.5s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) {
  .lg-card-border, .lg-title, .lg-glow, .lg-mail, .lg-spinner { animation: none !important; }
}
`;