// src/lib/jobs.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { db } from "@/lib/db";

// job_listings is not in the generated types, so use an untyped client.
export const sb = db as unknown as SupabaseClient;

export const LOGO_BUCKET = "job-logos";
export const MAX_LOGO_BYTES = 2 * 1024 * 1024;
export const LOGO_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const LEVELS = ["Junior", "Mid", "Senior"] as const;
export const EMPLOYMENT_TYPES = ["Full-time", "Part-time", "Seasonal"] as const;

export interface JobListing {
  id: string;
  shop_name: string;
  title: string;
  address: string;
  city: string;
  salary: string;
  experience: string | null;
  level: string | null;
  employment_type: string | null;
  phone: string | null;
  email: string;
  website: string | null;
  instagram: string | null;
  maps_url: string | null;
  description: string;
  logo_path: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function uid(): string {
  const c: Crypto | undefined = typeof crypto !== "undefined" ? crypto : undefined;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
}

export function errText(e: unknown, fallback: string): string {
  if (e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string") {
    return (e as { message: string }).message;
  }
  return fallback;
}

export function logoUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const { data } = sb.storage.from(LOGO_BUCKET).getPublicUrl(path);
  return data?.publicUrl ?? null;
}

/** Only allow real web links (blocks javascript: and friends). */
export function safeUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (!v) return null;
  const withProto = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withProto);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export function instagramUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return safeUrl(v);
  const handle = v.replace(/^@/, "").replace(/[^a-zA-Z0-9._]/g, "");
  return handle ? `https://instagram.com/${handle}` : null;
}

export function mapsLink(job: Pick<JobListing, "maps_url" | "address" | "city">): string {
  return (
    safeUrl(job.maps_url) ??
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${job.address}, ${job.city}`)}`
  );
}

export function isNew(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() < 7 * 24 * 60 * 60 * 1000;
}

export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

/** Opens the student's mail app with a ready-to-send application to the barbershop. */
export function applyMailto(job: JobListing, applicant: { name: string; email: string }): string {
  const subject = `Αίτηση για τη θέση ${job.title} – ${applicant.name}`;
  const body = [
    "Καλησπέρα σας,",
    "",
    `Ονομάζομαι ${applicant.name} και ενδιαφέρομαι για τη θέση «${job.title}» στο ${job.shop_name} (${job.city}), την οποία είδα μέσω του AURA Academy.`,
    "",
    "Θα χαρώ να σας γνωρίσω και να σας στείλω βιογραφικό / portfolio με δουλειές μου.",
    "",
    "Στοιχεία επικοινωνίας:",
    `Ονοματεπώνυμο: ${applicant.name}`,
    `Email: ${applicant.email}`,
    "",
    "Ευχαριστώ πολύ,",
    applicant.name,
  ].join("\n");
  return `mailto:${job.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}