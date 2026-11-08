// src/lib/portfolio.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { db } from "@/lib/db";
import { useSubscription } from "@/lib/useSubscription";

// The portfolio tables/functions are not in the generated types yet.
const sb = db as unknown as SupabaseClient;

export const PORTFOLIO_BUCKET = "portfolio";
export const MAX_POSTS = 120;
export const CAPTION_MAX = 2200;

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface BoardEntry {
  slug: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  headline: string;
  city: string;
  posts_count: number;
  likes_count: number;
  cover_path: string | null;
  created_at: string;
}

export interface PortfolioInfo {
  user_id: string;
  slug: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  headline: string;
  bio: string;
  city: string;
  instagram: string;
  posts_count: number;
  likes_count: number;
  created_at: string;
  is_live: boolean;
  is_owner: boolean;
}

export interface PortfolioPost {
  id: string;
  image_path: string;
  caption: string;
  created_at: string;
  like_count: number;
  liked_by_me: boolean;
}

export interface MyPortfolio {
  slug: string;
  headline: string;
  bio: string;
  city: string;
  instagram: string;
}

export interface PortfolioForm {
  headline: string;
  bio: string;
  city: string;
  instagram: string;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function errMessage(e: unknown, fallback: string): string {
  if (e && typeof e === "object" && "message" in e && typeof (e as any).message === "string") {
    return (e as any).message as string;
  }
  return fallback;
}

/**
 * Short random id for file names.
 * crypto.randomUUID() only exists on HTTPS / localhost, so we fall back safely.
 */
function randomId(): string {
  try {
    if (typeof crypto !== "undefined") {
      if (typeof crypto.randomUUID === "function") return crypto.randomUUID().slice(0, 8);
      if (typeof crypto.getRandomValues === "function") {
        const bytes = new Uint8Array(4);
        crypto.getRandomValues(bytes);
        return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
      }
    }
  } catch {
    /* fall through */
  }
  return Math.random().toString(36).slice(2, 10);
}

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

export function imageUrl(path: string): string {
  return sb.storage.from(PORTFOLIO_BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function fetchBoard(): Promise<BoardEntry[]> {
  const { data, error } = await sb.rpc("portfolio_board");
  if (error) throw new Error(error.message);
  return (data ?? []) as BoardEntry[];
}

export async function fetchPortfolio(slug: string): Promise<PortfolioInfo | null> {
  const { data, error } = await sb.rpc("portfolio_get", { p_slug: slug });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as PortfolioInfo[];
  return rows[0] ?? null;
}

export async function fetchPosts(userId: string, offset = 0, limit = 60): Promise<PortfolioPost[]> {
  const { data, error } = await sb.rpc("portfolio_posts", {
    p_user: userId,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as PortfolioPost[];
}

export async function fetchMyPortfolio(userId: string): Promise<MyPortfolio | null> {
  const { data, error } = await sb
    .from("portfolios")
    .select("slug, headline, bio, city, instagram")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as MyPortfolio | null) ?? null;
}

/* ------------------------------------------------------------------ */
/* Writes                                                              */
/* ------------------------------------------------------------------ */

export async function createPortfolio(form: PortfolioForm): Promise<string> {
  const { data, error } = await sb.rpc("create_my_portfolio", {
    p_headline: form.headline,
    p_bio: form.bio,
    p_city: form.city,
    p_instagram: form.instagram,
  });
  if (error) throw new Error(error.message);
  if (typeof data !== "string" || !data) throw new Error("Το portfolio δεν δημιουργήθηκε.");
  return data;
}

export async function updatePortfolio(userId: string, form: PortfolioForm): Promise<void> {
  const { error } = await sb
    .from("portfolios")
    .update({
      headline: form.headline.trim().slice(0, 80),
      bio: form.bio.trim().slice(0, 500),
      city: form.city.trim().slice(0, 60),
      instagram: form.instagram.replace(/[^A-Za-z0-9._]/g, "").slice(0, 40),
    })
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

/** Returns the new like state with the exact server count. */
export async function toggleLike(postId: string): Promise<{ liked: boolean; like_count: number }> {
  const { data, error } = await sb.rpc("toggle_portfolio_like", { p_post: postId });
  if (error) throw new Error(error.message);
  const row = (Array.isArray(data) ? data[0] : data) as { liked: boolean; like_count: number } | undefined;
  if (!row) throw new Error("Το like δεν αποθηκεύτηκε.");
  return row;
}

/** Shrinks a photo in the browser (max side, JPEG) so uploads are fast and light. */
export async function compressImage(file: File, maxSide = 1600, quality = 0.86): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Η εικόνα δεν μπόρεσε να διαβαστεί. Δοκίμασε JPG, PNG ή WebP."));
      el.src = url;
    });

    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Ο browser δεν υποστηρίζει επεξεργασία εικόνας.");
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) throw new Error("Η συμπίεση της εικόνας απέτυχε.");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function publishPost(userId: string, file: File, caption: string): Promise<PortfolioPost> {
  const blob = await compressImage(file);
  const path = `${userId}/${Date.now()}-${randomId()}.jpg`;

  const up = await sb.storage.from(PORTFOLIO_BUCKET).upload(path, blob, {
    contentType: "image/jpeg",
    upsert: false,
  });
  if (up.error) throw new Error(up.error.message);

  const { data, error } = await sb
    .from("portfolio_posts")
    .insert({ user_id: userId, image_path: path, caption: caption.trim().slice(0, CAPTION_MAX) })
    .select("id, image_path, caption, created_at")
    .single();

  if (error) {
    void sb.storage.from(PORTFOLIO_BUCKET).remove([path]); // don't leave an orphan file
    throw new Error(errMessage(error, "Το post δεν δημοσιεύτηκε."));
  }

  return { ...(data as Omit<PortfolioPost, "like_count" | "liked_by_me">), like_count: 0, liked_by_me: false };
}

export async function deletePost(post: PortfolioPost): Promise<void> {
  const { error } = await sb.from("portfolio_posts").delete().eq("id", post.id);
  if (error) throw new Error(error.message);
  void sb.storage.from(PORTFOLIO_BUCKET).remove([post.image_path]);
}

/* ------------------------------------------------------------------ */
/* Hooks                                                               */
/* ------------------------------------------------------------------ */

/** Is this user on the active AURA ELITE plan (plan id "high")? */
export function useIsElite(userId: string | undefined): { isElite: boolean; loading: boolean } {
  const { subscription, hasAccess, loading } = useSubscription(userId);
  return { isElite: Boolean(hasAccess) && subscription?.plan_id === "high", loading };
}

/** The signed-in user's own portfolio (null = none yet). Pass undefined to skip loading. */
export function useMyPortfolio(userId: string | undefined): {
  portfolio: MyPortfolio | null;
  loading: boolean;
  refresh: () => void;
} {
  const [portfolio, setPortfolio] = useState<MyPortfolio | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(userId));
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    let active = true;
    if (!userId) {
      setPortfolio(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchMyPortfolio(userId)
      .then((p) => {
        if (active) setPortfolio(p);
      })
      .catch(() => {
        if (active) setPortfolio(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId, tick]);

  return { portfolio, loading, refresh };
}