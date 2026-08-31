// src/hooks/useAuth.tsx
import { useCallback, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ needsConfirmation: boolean }>;
  signInWithGoogle: () => Promise<void>;
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
      // Ο έλεγχος mounted έλειπε εδώ: μετά το unmount γινόταν setState.
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

  const signInWithGoogle = useCallback(async () => {
    // ΕΔΩ ήταν το bug: redirectTo `${origin}/dashboard`.
    // Το /auth/callback είναι αυτό που αποφασίζει αν ο χρήστης πάει σε
    // Stripe checkout (υπάρχει checkout intent) ή στο dashboard.
    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : ((import.meta.env["VITE_SITE_URL"] as string | undefined) ?? "");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback`,
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