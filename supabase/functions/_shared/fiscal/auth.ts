// Admin authentication for the fiscal Edge Functions. Authorisation uses the same
// fiscal_is_admin() function as the RLS policies, so dashboard reads and admin
// actions cannot disagree.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export class FiscalAdminAuthError extends Error {
  constructor(
    message: string,
    public readonly httpStatus: number,
  ) {
    super(message);
    this.name = "FiscalAdminAuthError";
  }
}

export interface AdminContext {
  userId: string;
  /** Client scoped to the caller's JWT. Reads go through RLS. */
  userClient: SupabaseClient;
}

/** Validates the caller's Supabase JWT and confirms fiscal_is_admin() is true for that user. */
export async function requireFiscalAdmin(req: Request): Promise<AdminContext> {
  const token = (req.headers.get("Authorization") ?? "").match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) throw new FiscalAdminAuthError("Missing bearer token", 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) {
    throw new FiscalAdminAuthError("Server is missing SUPABASE_URL or SUPABASE_ANON_KEY", 500);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: userData, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !userData?.user) {
    throw new FiscalAdminAuthError("Invalid or expired session", 401);
  }

  const { data: isAdmin, error: rpcErr } = await userClient.rpc("fiscal_is_admin");
  if (rpcErr) throw new FiscalAdminAuthError("Admin check failed", 500);
  if (isAdmin !== true) throw new FiscalAdminAuthError("Caller is not a fiscal admin", 403);

  return { userId: userData.user.id, userClient };
}

/**
 * CORS for admin endpoints. Only FISCAL_ADMIN_ORIGIN receives an Access-Control-Allow-Origin
 * header. Other origins get no CORS headers, so the browser blocks them.
 */
export function fiscalCors(origin: string | null): Record<string, string> {
  const allowed = Deno.env.get("FISCAL_ADMIN_ORIGIN")?.trim() ?? "";
  const headers: Record<string, string> = {
    Vary: "Origin",
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
  if (origin && allowed && origin === allowed) {
    headers["Access-Control-Allow-Origin"] = allowed;
  }
  return headers;
}