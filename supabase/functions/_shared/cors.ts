// supabase/functions/_shared/cors.ts
// Shared CORS handling for all edge functions.
// Allow-list based (never "*"), because these endpoints act on behalf of signed-in users.

/** Always allowed. Edit this list when you add a domain. */
const DEFAULT_ORIGINS = [
  "https://theauramethod.site",
  "https://www.theauramethod.site",
];

/** Local development: any port on localhost / 127.0.0.1. */
const LOCAL_DEV = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

const ALLOW_HEADERS = [
  "authorization",
  "apikey",
  "x-client-info",
  "content-type",
  "accept",
  "accept-language",
  "x-supabase-api-version",
  "x-retry-count",
  "traceparent",
  "tracestate",
  "baggage",
].join(", ");

const ALLOW_METHODS = "GET, POST, PUT, DELETE, OPTIONS";

function normalize(value: string): string {
  return value.trim().replace(/\/+$/, "").toLowerCase();
}

/**
 * Exact origins plus optional wildcard patterns.
 * Env vars (both optional):
 *   PUBLIC_SITE_URL   = https://theauramethod.site
 *   ALLOWED_ORIGINS   = https://a.com,https://b.com,*.vercel.app
 */
function buildAllowList(): { exact: Set<string>; wildcards: string[] } {
  const exact = new Set<string>(DEFAULT_ORIGINS.map(normalize));
  const wildcards: string[] = [];

  const site = Deno.env.get("PUBLIC_SITE_URL");
  if (site) exact.add(normalize(site));

  const extra = Deno.env.get("ALLOWED_ORIGINS");
  if (extra) {
    for (const raw of extra.split(",")) {
      const item = normalize(raw);
      if (!item) continue;
      if (item.includes("*")) {
        // "*.vercel.app" or "https://*.vercel.app"
        wildcards.push(item.replace(/^https?:\/\//, "").replace(/^\*\./, ""));
      } else {
        exact.add(item);
      }
    }
  }

  return { exact, wildcards };
}

export function isAllowedOrigin(origin: string | null): origin is string {
  if (!origin) return false;
  const o = normalize(origin);

  if (LOCAL_DEV.test(o)) return true;

  const { exact, wildcards } = buildAllowList();
  if (exact.has(o)) return true;

  // Wildcard subdomains: https only.
  if (o.startsWith("https://")) {
    const host = o.slice("https://".length);
    return wildcards.some((suffix) => host.endsWith(`.${suffix}`));
  }
  return false;
}

/**
 * Headers for a response to `origin`.
 * Unknown origin -> NO Allow-Origin header, so the browser blocks it.
 */
export function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": ALLOW_HEADERS,
    "Access-Control-Allow-Methods": ALLOW_METHODS,
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };

  if (isAllowedOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

/** Answers a CORS preflight, or returns null when the request is not one. */
export function preflight(req: Request): Response | null {
  if (req.method !== "OPTIONS") return null;

  const origin = req.headers.get("Origin");
  if (!isAllowedOrigin(origin)) {
    return new Response(null, { status: 403, headers: { Vary: "Origin" } });
  }
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

/** JSON response that always carries CORS headers, including errors. */
export function json(
  body: unknown,
  status: number,
  origin: string | null,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  });
}

/**
 * Wrap a handler so that:
 *  - preflight is answered automatically
 *  - every response (including thrown errors) has CORS headers
 *
 *   Deno.serve(withCors(async (req, origin) => json({ ok: true }, 200, origin)));
 */
export function withCors(
  handler: (req: Request, origin: string | null) => Promise<Response> | Response,
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    const pre = preflight(req);
    if (pre) return pre;

    const origin = req.headers.get("Origin");
    try {
      const res = await handler(req, origin);

      // Make sure CORS headers are present even if the handler built its own Response.
      const headers = new Headers(res.headers);
      for (const [k, v] of Object.entries(corsHeaders(origin))) {
        if (!headers.has(k)) headers.set(k, v);
      }
      return new Response(res.body, { status: res.status, headers });
    } catch (err) {
      console.error("[edge function error]", err);
      return json({ error: "Internal server error" }, 500, origin);
    }
  };
}