// supabase/functions/viva-health/index.ts
//
// ADMIN ONLY. One call that tells the admin whether the Viva connection is
// healthy: which secrets exist (never their values), whether Viva accepts our
// credentials, and what the webhook has done recently. Shown in the admin panel.
import { createClient } from "npm:@supabase/supabase-js@^2";
import { getAccessToken, loadVivaConfig, VivaConfigError } from "../_shared/viva.ts";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: "misconfigured" }, 500);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
  const { data: u, error: uErr } = await userClient.auth.getUser();
  if (uErr || !u?.user) return json({ error: "Unauthorized" }, 401);
  const { data: isAdmin } = await userClient.rpc("is_admin_user");
  if (isAdmin !== true) return json({ error: "Forbidden" }, 403);

  const env = Deno.env.get("VIVA_ENV");
  const prefix = env === "production" ? "VIVA_PRODUCTION_" : "VIVA_SANDBOX_";
  const has = (name: string) => Boolean(Deno.env.get(name));
  const secrets = {
    VIVA_ENV: env === "sandbox" || env === "production",
    CLIENT_ID: has(`${prefix}CLIENT_ID`),
    CLIENT_SECRET: has(`${prefix}CLIENT_SECRET`),
    SOURCE_CODE: has(`${prefix}SOURCE_CODE`),
    WEBHOOK_KEY: has(`${prefix}WEBHOOK_KEY`),
    MERCHANT_ID: has(`${prefix}MERCHANT_ID`),
    API_KEY: has(`${prefix}API_KEY`),
    CRON_SECRET: has("CRON_SECRET"),
  };

  // Does Viva accept our Smart Checkout credentials?
  let oauth: { ok: boolean; error?: string } = { ok: false, error: "not configured" };
  try {
    const cfg = loadVivaConfig((name) => Deno.env.get(name));
    await getAccessToken(cfg);
    oauth = { ok: true };
  } catch (err) {
    oauth = { ok: false, error: err instanceof VivaConfigError ? err.message : "Η Viva δεν δέχεται τα διαπιστευτήρια (Client ID / Secret)." };
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const [settings, last, recent, pending] = await Promise.all([
    admin.from("billing_settings").select("active_provider, viva_admin_only, grace_days").eq("id", true).maybeSingle(),
    admin.from("provider_events").select("received_at").eq("provider", "viva").order("received_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("provider_events").select("status").eq("provider", "viva").gte("received_at", since).limit(500),
    admin.from("billing_orders").select("id", { count: "exact", head: true }).eq("provider", "viva").eq("status", "pending").gte("created_at", since),
  ]);

  const counts: Record<string, number> = { processed: 0, ignored: 0, failed: 0, received: 0 };
  for (const row of (recent.data ?? []) as { status: string }[]) counts[row.status] = (counts[row.status] ?? 0) + 1;

  const missing = Object.entries(secrets).filter(([, ok]) => !ok).map(([k]) => k);
  return json({
    environment: env ?? null,
    provider: (settings.data as { active_provider?: string } | null)?.active_provider ?? null,
    graceDays: (settings.data as { grace_days?: number } | null)?.grace_days ?? null,
    secrets,
    missing,
    oauth,
    lastWebhookAt: (last.data as { received_at?: string } | null)?.received_at ?? null,
    webhook24h: counts,
    pendingOrders24h: pending.count ?? 0,
  });
});
