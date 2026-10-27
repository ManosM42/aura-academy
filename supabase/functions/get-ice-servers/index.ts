// supabase/functions/get-ice-servers/index.ts
// Deploy: supabase functions deploy get-ice-servers --no-verify-jwt
// Secrets: METERED_DOMAIN (e.g. yourapp.metered.live), METERED_API_KEY
//
// Returns TURN/STUN servers (Metered) so calls connect even on strict
// mobile / office networks. Only signed-in users can ask for them.
// If Metered is not configured or fails, it falls back to free STUN.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-retry-count, traceparent, tracestate, baggage",
};

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

const STUN = [
  { urls: ["stun:stun.cloudflare.com:3478", "stun:stun.l.google.com:19302"] },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  // must be a signed-in user
  const authHeader = req.headers.get("Authorization") ?? "";
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!authHeader.startsWith("Bearer ") || !url || !anon) {
    return reply({ error: "unauthorized" }, 401);
  }
  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data } = await userClient.auth.getUser();
  if (!data?.user) return reply({ error: "unauthorized" }, 401);

  // Metered credentials (kept secret, never sent to the browser)
  const domain = (Deno.env.get("METERED_DOMAIN") ?? "")
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");
  const apiKey = Deno.env.get("METERED_API_KEY");
  if (!domain || !apiKey) return reply({ iceServers: STUN, turn: false });

  try {
    const res = await fetch(
      `https://${domain}/api/v1/turn/credentials?apiKey=${encodeURIComponent(apiKey)}`,
    );
    if (!res.ok) {
      console.error("metered turn failed", res.status, await res.text());
      return reply({ iceServers: STUN, turn: false });
    }
    const turnServers = await res.json();
    if (!Array.isArray(turnServers) || turnServers.length === 0) {
      return reply({ iceServers: STUN, turn: false });
    }
    return reply({ iceServers: [...STUN, ...turnServers], turn: true });
  } catch (e) {
    console.error("get-ice-servers failed", e);
    return reply({ iceServers: STUN, turn: false });
  }
});