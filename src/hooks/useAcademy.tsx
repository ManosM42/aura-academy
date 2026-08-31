// src/hooks/useAcademy.tsx
import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { db, generateCertificateId, type CertificateRow } from "@/lib/db";

interface UseAcademy {
  verifiedSkills: Set<string>;
  certificates: CertificateRow[];
  loading: boolean;
  error: string | null;
  verifySkill: (skillId: string) => Promise<void>;
  claimCertificate: (
    title: string,
    holderName: string | null,
  ) => Promise<CertificateRow>;
  refresh: () => Promise<void>;
}

export function useAcademy(user: User | null): UseAcademy {
  const [verifiedSkills, setVerifiedSkills] = useState<Set<string>>(new Set());
  const [certificates, setCertificates] = useState<CertificateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setVerifiedSkills(new Set());
      setCertificates([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const [skillRes, certRes] = await Promise.all([
      db
        .from("skill_progress")
        .select("skill_id")
        .eq("user_id", user.id)
        .eq("verified", true),
      db
        .from("certificates")
        .select("*")
        .eq("user_id", user.id)
        .order("issued_at", { ascending: false }),
    ]);

    if (skillRes.error) {
      setError(skillRes.error.message);
    } else {
      const rows = (skillRes.data ?? []) as { skill_id: string }[];
      setVerifiedSkills(new Set(rows.map((r) => r.skill_id)));
    }

    if (certRes.error) setError((prev) => prev ?? certRes.error!.message);
    else setCertificates((certRes.data as CertificateRow[]) ?? []);

    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const verifySkill = useCallback(
    async (skillId: string) => {
      if (!user) return;

      // Optimistic update.
      setVerifiedSkills((prev) => new Set(prev).add(skillId));

      const { error: upsertErr } = await db
        .from("skill_progress")
        .upsert(
          { user_id: user.id, skill_id: skillId, verified: true },
          { onConflict: "user_id,skill_id" },
        );

      if (upsertErr) {
        // Roll back on failure.
        setVerifiedSkills((prev) => {
          const next = new Set(prev);
          next.delete(skillId);
          return next;
        });
        throw upsertErr;
      }
    },
    [user],
  );

  const claimCertificate = useCallback(
    async (title: string, holderName: string | null): Promise<CertificateRow> => {
      if (!user) throw new Error("You must be signed in.");

      // Don't issue a duplicate for the same title.
      const existing = certificates.find((c) => c.title === title);
      if (existing) return existing;

      const certificate_id = generateCertificateId();
      const { data, error: insertErr } = await db
        .from("certificates")
        .insert({
          user_id: user.id,
          certificate_id,
          title,
          holder_name: holderName,
        })
        .select("*")
        .single();

      if (insertErr) throw insertErr;

      const row = data as CertificateRow;
      setCertificates((prev) => [row, ...prev]);
      return row;
    },
    [user, certificates],
  );

  return {
    verifiedSkills,
    certificates,
    loading,
    error,
    verifySkill,
    claimCertificate,
    refresh: load,
  };
}