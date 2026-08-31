// src/lib/db.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * The generated Database type comes from the previous Supabase project and may
 * not describe the AURA tables. We access those tables through a non-generic
 * client so the app compiles regardless, and type the *results* ourselves below.
 * (Runtime behaviour is identical — this only relaxes compile-time table names.)
 */
export const db = supabase as unknown as SupabaseClient;

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface SkillProgressRow {
  id: string;
  user_id: string;
  skill_id: string;
  verified: boolean;
  verified_at: string;
}

export interface CertificateRow {
  id: string;
  user_id: string;
  certificate_id: string;
  title: string;
  holder_name: string | null;
  issued_at: string;
}

export interface VerifiedCertificate {
  certificate_id: string;
  title: string;
  holder_name: string | null;
  issued_at: string;
}

/** AURA-XXXX-XXXX-XXXX */
export function generateCertificateId(): string {
  const seg = () =>
    Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, "0");
  return `AURA-${seg()}-${seg()}-${seg()}`;
}