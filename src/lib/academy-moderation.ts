// src/lib/academy-moderation.ts
import { supabase } from "@/lib/supabase";

// Change this if your posts table has another name.
export const POSTS_TABLE = "academy_posts";

export const MOD_ROLES = ["admin", "super_admin", "operations"];
export const isModeratorRole = (role?: string | null) => !!role && MOD_ROLES.includes(role);

export interface PostingStatus {
  banned: boolean;
  reason: string | null;
}

export interface BannedUser {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  reason: string | null;
  banned_at: string | null;
}

const ERROR_TEXT: Record<string, string> = {
  POSTING_BANNED: "Η δημοσίευση έχει απενεργοποιηθεί για τον λογαριασμό σου.",
  CANNOT_BAN_SELF: "Δεν μπορείς να αποκλείσεις τον εαυτό σου.",
  CANNOT_BAN_MODERATOR: "Δεν μπορείς να αποκλείσεις άλλον διαχειριστή.",
  USER_NOT_FOUND: "Ο χρήστης δεν βρέθηκε.",
  FORBIDDEN: "Δεν έχεις δικαίωμα για αυτή την ενέργεια.",
};

/** Turns a raw Supabase / Postgres error into a friendly Greek message. */
export function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  for (const key of Object.keys(ERROR_TEXT)) if (msg.includes(key)) return ERROR_TEXT[key]!;
  return msg;
}

/** Never throws: before the SQL is applied the columns do not exist yet. */
export async function getMyPostingStatus(userId: string): Promise<PostingStatus> {
  const { data, error } = await supabase
    .from("profiles")
    .select("posting_banned, posting_ban_reason")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return { banned: false, reason: null };
  const row = data as { posting_banned?: boolean; posting_ban_reason?: string | null };
  return { banned: !!row.posting_banned, reason: row.posting_ban_reason ?? null };
}

export async function getBannedUsers(): Promise<BannedUser[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, posting_ban_reason, posting_banned_at")
    .eq("posting_banned", true)
    .order("posting_banned_at", { ascending: false });
  if (error) throw new Error(friendlyError(new Error(error.message)));
  return (data ?? []).map((r) => {
    const row = r as {
      id: string;
      full_name: string | null;
      avatar_url: string | null;
      posting_ban_reason: string | null;
      posting_banned_at: string | null;
    };
    return {
      id: row.id,
      full_name: row.full_name,
      avatar_url: row.avatar_url,
      reason: row.posting_ban_reason,
      banned_at: row.posting_banned_at,
    };
  });
}

export async function setPostingBan(userId: string, banned: boolean, reason?: string): Promise<void> {
  const { error } = await supabase.rpc("set_posting_ban", {
    p_user: userId,
    p_banned: banned,
    p_reason: reason?.trim() || null,
  });
  if (error) throw new Error(friendlyError(new Error(error.message)));
}

export async function deletePostAsModerator(postId: string): Promise<void> {
  const { data, error } = await supabase.from(POSTS_TABLE).delete().eq("id", postId).select("id");
  if (error) throw new Error(friendlyError(new Error(error.message)));
  // RLS silently deletes 0 rows when you are not allowed to
  if (!data || data.length === 0) throw new Error("Δεν ήταν δυνατή η διαγραφή (δεν έχεις δικαίωμα).");
}

/** Best-effort author id: your post objects may use any of these field names. */
export function getPostAuthorId(post: unknown): string | null {
  const p = post as Record<string, unknown> & { author?: { id?: string } | null };
  const id = p.author_id ?? p.user_id ?? p.profile_id ?? p.created_by ?? p.author?.id;
  return typeof id === "string" ? id : null;
}