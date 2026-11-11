// src/components/aura/AccessGate.tsx
//
// Wrap the <Outlet /> in __root.tsx with this component.
// A signed-in user WITHOUT an active plan (and who is not staff) sees the lock screen
// on every page except the public ones listed in lib/access.ts.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Loader2, Lock } from "lucide-react";
import ChromeButton from "@/components/aura/ChromeButton";
import PricingCards from "@/components/aura/PricingCards";
import { supabase } from "@/lib/supabase";
import { cleanupDeadSubscriptions, fetchAccess, isPublicPath } from "@/lib/access";

type Phase = "loading" | "allowed" | "locked" | "error";
interface Result {
  uid: string;
  phase: Phase;
  hadPlan: boolean;
}

const RECHECK_MS = 60_000; // while the user has access
const RECHECK_LOCKED_MS = 5_000; // while locked: picks up a payment that just went through

export default function AccessGate({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [res, setRes] = useState<Result | null>(null);

  const resRef = useRef<Result | null>(null);
  resRef.current = res;
  const requestRef = useRef(0);
  const cleanedFor = useRef<string | null>(null);

  const publicRoute = isPublicPath(pathname);
  const needsCheck = authReady && !!userId && !publicRoute;
  const phase: Phase = res && res.uid === userId ? res.phase : "loading";
  const hadPlan = res && res.uid === userId ? res.hadPlan : false;

  /* ---- who is signed in ---- */
  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUserId(data.session?.user.id ?? null);
      setAuthReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
      setAuthReady(true);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  /* ---- the access check ---- */
  const check = useCallback(async (uid: string, silent: boolean) => {
    const req = ++requestRef.current;
    if (!silent) {
      setRes((r) => ({ uid, phase: "loading", hadPlan: r?.uid === uid ? r.hadPlan : false }));
    }
    try {
      const state = await fetchAccess(uid);
      if (req !== requestRef.current) return;

      if (state.hasAccess) {
        setRes({ uid, phase: "allowed", hadPlan: false });
        return;
      }

      setRes((r) => ({
        uid,
        phase: "locked",
        hadPlan: state.hadPlan || (r?.uid === uid && r.hadPlan),
      }));

      // Remove the dead plan from the database (once per locked user).
      if (cleanedFor.current !== uid) {
        cleanedFor.current = uid;
        await cleanupDeadSubscriptions();
      }
    } catch (err) {
      if (req !== requestRef.current) return;
      console.error("[AccessGate] access check failed:", err);
      // A failed re-check must not kick out someone we already verified; otherwise fail closed.
      setRes((r) => (r && r.uid === uid && r.phase === "allowed" ? r : { uid, phase: "error", hadPlan: false }));
    }
  }, []);

  // Check when the user or the page changes.
  useEffect(() => {
    if (!needsCheck || !userId) return;
    const current = resRef.current;
    const known = current?.uid === userId && (current.phase === "allowed" || current.phase === "locked");
    void check(userId, known);
  }, [needsCheck, userId, pathname, check]);

  // Re-check regularly and when the tab becomes visible again.
  useEffect(() => {
    if (!needsCheck || !userId) return;
    const every = phase === "locked" ? RECHECK_LOCKED_MS : RECHECK_MS;
    const id = window.setInterval(() => void check(userId, true), every);
    const onVisible = () => {
      if (document.visibilityState === "visible") void check(userId, true);
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [needsCheck, userId, phase, check]);

  /* ---- what to render ---- */
  if (!publicRoute && !authReady) return <GateLoader />;
  if (!needsCheck) return <>{children}</>; // signed out (routes handle it) or a public page
  if (phase === "allowed") return <>{children}</>;
  if (phase === "locked") return <LockedScreen hadPlan={hadPlan} />;
  if (phase === "error") return <GateError onRetry={() => userId && void check(userId, false)} />;
  return <GateLoader />;
}

/* ------------------------------------------------------------------ */

function useSignOut() {
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const signOut = useCallback(async () => {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("[AccessGate] sign out failed:", err);
    } finally {
      setSigningOut(false);
      navigate({ to: "/" });
    }
  }, [navigate]);
  return { signOut, signingOut };
}

function GateLoader() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-aura-bg" role="status" aria-label="Loading">
      <Loader2 className="size-7 animate-spin text-white/60" />
    </div>
  );
}

function GateError({ onRetry }: { onRetry: () => void }) {
  const { signOut, signingOut } = useSignOut();
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-5 bg-aura-bg px-6 text-center text-white">
      <p className="max-w-sm text-sm text-white/65" role="alert">
        We couldn’t verify your access. Check your connection and try again.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <ChromeButton type="button" onClick={onRetry}>
          TRY AGAIN
        </ChromeButton>
        <ChromeButton type="button" variant="secondary" onClick={() => void signOut()} disabled={signingOut}>
          SIGN OUT
        </ChromeButton>
      </div>
    </div>
  );
}

function LockedScreen({ hadPlan }: { hadPlan: boolean }) {
  const { signOut, signingOut } = useSignOut();

  return (
    <div className="relative min-h-screen w-full overflow-x-clip bg-aura-bg px-5 pb-24 pt-28 text-white sm:px-8 sm:pt-32">
      <div className="aura-grain" aria-hidden />
      <div className="hero-atmosphere absolute inset-0" aria-hidden />

      <div className="relative z-10 mx-auto max-w-6xl">
        <header className="mx-auto max-w-2xl text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-full border border-white/20 bg-white/[0.05] shadow-[0_0_44px_-8px_rgba(232,236,242,0.6)]">
            <Lock className="size-6 text-white/90" />
          </span>
          <span className="chrome-text mt-6 block text-[11px] font-semibold uppercase tracking-[0.5em]">
            Members only
          </span>
          <h1 className="chrome-text mt-4 text-3xl font-bold tracking-tight sm:text-5xl">
            Join AURA to unlock access
          </h1>
          <p className="mx-auto mt-5 max-w-lg text-sm leading-relaxed text-white/60 sm:text-base">
            You need an active plan to access the Academy. Choose your plan below and you’re in.
          </p>
          {hadPlan && (
            <p className="mx-auto mt-3 max-w-lg text-xs leading-relaxed text-white/40">
              Your previous plan has ended or could not be renewed.
            </p>
          )}
        </header>

        <section className="mt-14" aria-label="Plans">
          <PricingCards />
        </section>

        <div className="mt-14 flex justify-center">
          <ChromeButton type="button" variant="secondary" onClick={() => void signOut()} disabled={signingOut}>
            {signingOut ? "SIGNING OUT…" : "SIGN OUT"}
          </ChromeButton>
        </div>
      </div>
    </div>
  );
}