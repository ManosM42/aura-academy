import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { getMyProfile } from "@/lib/queries";
import type { Profile } from "@/lib/database.types";

export interface AuthState {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  refresh: () => void;
}

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  // Track the auth session (client-side only).
  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (active) setSession(data.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Load the matching profile whenever the session (or a manual refresh) changes.
  useEffect(() => {
    let active = true;

    if (!session) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    getMyProfile()
      .then((p) => active && setProfile(p))
      .catch(() => active && setProfile(null))
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, [session, tick]);

  return { session, profile, loading, refresh: () => setTick((n) => n + 1) };
}
// src/hooks/useAuth.ts — αντικατέστησε ΜΟΝΟ το σώμα του signInWithGoogle
async function signInWithGoogle(): Promise<void> {
  const origin =
    typeof window !== "undefined" ? window.location.origin : (import.meta.env.VITE_SITE_URL ?? "");

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      // ΚΡΙΣΙΜΟ: όχι /dashboard. Το /auth/callback αποφασίζει
      // αν ο χρήστης πάει σε checkout ή σε dashboard.
      redirectTo: `${origin}/auth/callback`,
      queryParams: { prompt: "select_account" },
    },
  });

  if (error) throw error;
}