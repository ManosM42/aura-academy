// Deploy: supabase functions deploy send-push --no-verify-jwt
// Secrets: WEBHOOK_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
//
// Called by the database webhook on every new row of admin_notifications.
// Sends a Web Push to every browser registered by an admin / operations user.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import webpush from "npm:web-push@3.6.7";

const MOD_ROLES = ["admin", "super_admin", "operations"];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const secret = Deno.env.get("WEBHOOK_SECRET");
  if (!secret || req.headers.get("x-webhook-secret") !== secret) {
    return json({ error: "unauthorized" }, 401);
  }

  const pub = Deno.env.get("VAPID_PUBLIC_KEY");
  const priv = Deno.env.get("VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com";
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!pub || !priv || !url || !serviceKey) return json({ error: "server_misconfigured" }, 500);

  try {
    const payload = await req.json();
    const rec = (payload.record ?? payload) as {
      id?: string;
      type?: string;
      title?: string;
      body?: string;
      url?: string | null;
    };

    webpush.setVapidDetails(subject, pub, priv);
    const db = createClient(url, serviceKey, { auth: { persistSession: false } });

    const { data: mods } = await db.from("profiles").select("id").in("role", MOD_ROLES);
    const ids = (mods ?? []).map((m: { id: string }) => m.id);
    if (ids.length === 0) return json({ sent: 0, removed: 0 });

    const { data: subs } = await db
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .in("user_id", ids);

    const message = JSON.stringify({
      id: rec.id,
      tag: rec.type,
      title: rec.title ?? "AURA",
      body: rec.body ?? "",
      url: rec.url ?? "/admin",
    });

    let sent = 0;
    const dead: string[] = [];
    await Promise.allSettled(
      (subs ?? []).map(async (s: { id: string; endpoint: string; p256dh: string; auth: string }) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            message,
            { TTL: 60 * 60 },
          );
          sent++;
        } catch (err) {
          const code = (err as { statusCode?: number }).statusCode;
          // 404 / 410 = the browser unsubscribed: clean it up
          if (code === 404 || code === 410) dead.push(s.id);
          else console.error("push failed", code, (err as Error).message);
        }
      }),
    );

    if (dead.length) await db.from("push_subscriptions").delete().in("id", dead);
    return json({ sent, removed: dead.length });
  } catch (e) {
    console.error("send-push failed:", e);
    return json({ error: "server_error", detail: String((e as Error)?.message ?? e) }, 500);
  }
});