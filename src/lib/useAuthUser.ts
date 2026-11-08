// src/lib/useAuthUser.ts
// Tiny hook: the signed-in Supabase user. If you already have one (useAuth etc.), use yours instead.
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { db } from "@/lib/db";

export function useAuthUser(): { user: User | null; loading: boolean } {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    db.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    const { data: sub } = db.auth.onAuthStateChange((_e, session) => {
      if (active) setUser(session?.user ?? null);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
}