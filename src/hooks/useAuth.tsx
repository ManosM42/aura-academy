// src/hooks/useAuth.tsx
import { useCallback, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { PlanId } from "@/lib/plans";

interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ needsConfirmation: boolean }>;
  /** Το planId ταξιδεύει στο callback URL — προαιρετικό, ώστε οι
   *  υπάρχοντες callers να δουλεύουν χωρίς αλλαγή. */
  signInWithGoogle: (planId?: PlanId) => Promise<void>;
  signOut: () => Promise<void>;
}

/**
 * Παρακολουθεί το Supabase session. Μόνο client-side — η εφαρμογή διαβάζει
 * το auth στον browser, όχι σε SSR.
 */
export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        setSession(data.session);
        setUser(data.session?.user ?? null);
        setLoading(false);
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!mounted) return;
      setSession(next);
      setUser(next?.user ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    // Αν είναι ενεργή η επιβεβαίωση email, δεν υπάρχει ακόμα session.
    return { needsConfirmation: !data.session };
  }, []);

  const signInWithGoogle = useCallback(async (planId?: PlanId) => {
    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : ((import.meta.env["VITE_SITE_URL"] as string | undefined) ??
          "http://localhost:3000");

    // Το Supabase διατηρεί τα query params του redirectTo, οπότε το
    // /auth/callback ξέρει το πακέτο ακόμα κι όταν το localStorage είναι
    // άδειο, έχει λήξει, ή γράφτηκε σε άλλο origin (preview iframe).
    const callback = new URL("/auth/callback", origin);
    if (planId) callback.searchParams.set("plan", planId);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callback.toString(),
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) throw error;
    // Full-page redirect στη Google — δεν χρειάζεται τοπικό navigate.
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  return { session, user, loading, signIn, signUp, signInWithGoogle, signOut };
}