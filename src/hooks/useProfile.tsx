// src/hooks/useProfile.tsx
import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { db, type Profile } from "@/lib/db";

interface UseProfile {
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  updateProfile: (
    patch: Partial<Pick<Profile, "full_name" | "avatar_url">>,
  ) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useProfile(user: User | null): UseProfile {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: selectErr } = await db
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (selectErr) {
      setError(selectErr.message);
      setLoading(false);
      return;
    }

    if (data) {
      setProfile(data as Profile);
      setLoading(false);
      return;
    }

    // No row yet — create one from the auth metadata (email or Google).
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const seed = {
      id: user.id,
      email: user.email ?? null,
      full_name:
        (meta.full_name as string | undefined) ??
        (meta.name as string | undefined) ??
        null,
      avatar_url: (meta.avatar_url as string | undefined) ?? null,
    };

    const { data: created, error: upsertErr } = await db
      .from("profiles")
      .upsert(seed, { onConflict: "id" })
      .select("*")
      .single();

    if (upsertErr) setError(upsertErr.message);
    else setProfile(created as Profile);

    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const updateProfile = useCallback(
    async (patch: Partial<Pick<Profile, "full_name" | "avatar_url">>) => {
      if (!user) return;
      const { data, error: updateErr } = await db
        .from("profiles")
        .update(patch)
        .eq("id", user.id)
        .select("*")
        .single();
      if (updateErr) throw updateErr;
      setProfile(data as Profile);
    },
    [user],
  );

  return { profile, loading, error, updateProfile, refresh: load };
}