// src/lib/access.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { db } from "@/lib/db";
import { isStaffRole } from "@/lib/queries";

// New functions/tables are not in the generated types yet.
const sb = db as unknown as SupabaseClient;

/**
 * Pages anyone can open, even without a plan.
 * "/login" and "/checkout" MUST stay here: people sign in and pay through them.
 * Add any other public page here (matches the path itself and everything under it).
 */
export const PUBLIC_PATHS = [
  "/",
  "/pricing",
  "/terms",
  "/contact",
  "/about",
  "/ourteam",
  "/login",
  "/checkout",
];

export function isPublicPath(pathname: string): boolean {
  const lower = pathname.toLowerCase();
  const p = lower.length > 1 ? lower.replace(/\/+$/, "") : lower;
  return PUBLIC_PATHS.some((base) =>
    base === "/" ? p === "/" : p === base || p.startsWith(`${base}/`),
  );
}

const ACCESS_STATUSES = ["active", "trialing"];

export interface AccessState {
  /** Staff, or an active/trialing subscription. */
  hasAccess: boolean;
  isStaff: boolean;
  /** The user has (or had) a subscription row, e.g. an expired one. */
  hadPlan: boolean;
}

/** Throws on a network/database error (callers must NOT treat that as "no plan"). */
export async function fetchAccess(userId: string): Promise<AccessState> {
  const { data: profile, error: profileError } = await sb
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) throw new Error(profileError.message);

  if (isStaffRole(String((profile as { role?: unknown } | null)?.role ?? "student"))) {
    return { hasAccess: true, isStaff: true, hadPlan: false };
  }

  const { data: subs, error: subsError } = await sb
    .from("subscriptions")
    .select("status")
    .eq("user_id", userId);
  if (subsError) throw new Error(subsError.message);

  const rows = (subs ?? []) as { status: string }[];
  return {
    hasAccess: rows.some((r) => ACCESS_STATUSES.includes(r.status)),
    isStaff: false,
    hadPlan: rows.length > 0,
  };
}

/** Removes the caller's dead plan rows (never touches active ones). Payments are kept. */
export async function cleanupDeadSubscriptions(): Promise<void> {
  const { error } = await sb.rpc("cleanup_my_dead_subscriptions");
  if (error) console.error("[access] cleanup_my_dead_subscriptions failed:", error.message);
}