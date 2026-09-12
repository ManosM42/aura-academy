// supabase/functions/_shared/auth.ts
//
// Every course-file Edge Function needs to answer two questions before
// touching B2 or the database:
//   1. Who is calling? (verify the Supabase JWT they sent)
//   2. Are they allowed to do this? (content role for writes; enrolled/
//      plan-eligible OR content role for reads)
// This file answers both, once, so each function just calls it instead
// of re-implementing JWT/role checks.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@^2";

const CONTENT_ROLES = new Set([
  "content_manager",
  "operations",
  "admin",
  "super_admin",
]);

export interface AuthedCaller {
  userId: string;
  role: string | null;
  isContentRole: boolean;
}

export interface AuthResult {
  ok: true;
  caller: AuthedCaller;
  /** Service-role client — bypasses RLS. Use deliberately, only for the
   *  exact rows this function is meant to touch. */
  admin: SupabaseClient;
}

export interface AuthFailure {
  ok: false;
  status: number;
  error: string;
}

/**
 * Verifies the caller's bearer token against Supabase Auth, loads their
 * profile role, and returns a service-role client for the function to use
 * for the actual DB work (service role is required because course_files
 * SELECT/write RLS is staff-only, and we need to check/serve student
 * access to individual objects ourselves — see user_can_access_course).
 */
export async function authenticateCaller(req: Request): Promise<AuthResult | AuthFailure> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) {
    console.error("Missing Supabase environment configuration for auth check");
    return { ok: false, status: 500, error: "Server misconfigured" };
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return { ok: false, status: 401, error: "Missing bearer token" };
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) {
    return { ok: false, status: 401, error: "Invalid or expired session" };
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (profileError) {
    console.error("Failed to load caller profile", profileError);
    return { ok: false, status: 500, error: "Could not verify permissions" };
  }

  const role = (profile as { role?: string } | null)?.role ?? null;

  return {
    ok: true,
    admin,
    caller: {
      userId: userData.user.id,
      role,
      isContentRole: role != null && CONTENT_ROLES.has(role),
    },
  };
}

/** For upload/delete: only content_manager/operations/admin/super_admin. */
export function requireContentRole(result: AuthResult): AuthFailure | null {
  if (!result.caller.isContentRole) {
    return { ok: false, status: 403, error: "Requires content manager permissions" };
  }
  return null;
}

/**
 * For read/preview: content roles always pass; everyone else needs
 * public.user_can_access_course(userId, courseId) — enrolled + plan
 * check, same rule the RLS policies use, re-verified here explicitly
 * because this function runs with the service role and RLS doesn't apply.
 */
export async function requireCourseAccess(
  result: AuthResult,
  courseId: string,
): Promise<AuthFailure | null> {
  if (result.caller.isContentRole) return null;

  const { data, error } = await result.admin.rpc("user_can_access_course", {
    p_user_id: result.caller.userId,
    p_course_id: courseId,
  });
  if (error) {
    console.error("user_can_access_course check failed", error);
    return { ok: false, status: 500, error: "Could not verify course access" };
  }
  if (!data) {
    return { ok: false, status: 403, error: "Not enrolled in this course" };
  }
  return null;
}