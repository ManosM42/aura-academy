// supabase/functions/_shared/cors.ts
// Shared CORS handling. Deliberately allow-listed rather than "*", because
// this endpoint creates paid Stripe sessions on behalf of a signed-in user.

const BASE_ALLOWED = ["http://localhost:3000", "http://127.0.0.1:3000"];

/** PUBLIC_SITE_URL + optional comma-separated ALLOWED_ORIGINS + localhost. */
function allowedOrigins(): string[] {
  const list = [...BASE_ALLOWED];

  const site = Deno.env.get("PUBLIC_SITE_URL");
  if (site) list.push(site.replace(/\/+$/, ""));

  const extra = Deno.env.get("ALLOWED_ORIGINS");
  if (extra) {
    for (const item of extra.split(",")) {
      const trimmed = item.trim().replace(/\/+$/, "");
      if (trimmed) list.push(trimmed);
    }
  }

  return [...new Set(list)];
}

export function corsHeaders(origin: string | null): Record<string, string> {
  const allowList = allowedOrigins();
  // Unknown origin -> echo the canonical one so the browser blocks it,
  // instead of silently allowing anybody.
  const allow = origin && allowList.includes(origin) ? origin : allowList[0]!;

  return {
    "Access-Control-Allow-Origin": allow,
    // Must cover every header supabase-js sends, or the preflight passes the
    // status check and then fails on headers.
    "Access-Control-Allow-Headers":
      "authorization, apikey, x-client-info, content-type, x-retry-count, traceparent, tracestate, baggage",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

/** Returns a 204 preflight response, or null if this is not a preflight. */
export function preflight(req: Request): Response | null {
  if (req.method !== "OPTIONS") return null;
  return new Response(null, {
    status: 204,
    headers: corsHeaders(req.headers.get("Origin")),
  });
}

/** JSON response that ALWAYS carries CORS headers — including errors. */
export function json(
  body: unknown,
  status: number,
  origin: string | null,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      "Content-Type": "application/json",
    },
  });
}