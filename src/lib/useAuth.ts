// src/lib/useAuth.ts
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

/**
 * Session + profile. Το signInWithGoogle ζει ΜΟΝΟ στο @/hooks/useAuth.
 * Το dead paste που υπήρχε στο τέλος αυτού του αρχείου αφαιρέθηκε — δεν
 * το έκανε import κανείς, γι' αυτό το redirect έμενε σπασμένο.
 */
export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (active) setSession(data.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (active) setSession(next);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

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