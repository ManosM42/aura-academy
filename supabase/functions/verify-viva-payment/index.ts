// supabase/functions/verify-viva-payment/index.ts
//
// Called by the checkout RETURN page. Viva sends the customer back with
//   ?t=<transaction id>&s=<order code>&lang=..&eventId=..
// (t is present ONLY when the payment went through; a refused or cancelled
// payment comes back without it, with an eventId).
//
// This function does NOT trust the redirect. If a transaction id is present it
// asks Viva directly (Retrieve Transaction, server to server) and applies the
// result with the same idempotent code the webhook uses, so the subscription,
// seminar or book order is completed even if the webhook is late or was never
// registered. Calling it many times is harmless.
//
// It needs no login (seminar and book customers may be visitors) and answers only
// non-personal facts: what kind of order it is, its status and a label.
import { createClient } from "npm:@supabase/supabase-js@^2";
import {
  isTransactionId,
  loadVivaConfig,
  retrieveTransaction,
  VivaApiError,
  VivaConfigError,
  type VivaConfig,
  type VivaTransaction,
} from "../_shared/viva.ts";
import { processFailed, processPaid, rpc, TransientError, type RpcClient } from "../_shared/viva-process.ts";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

interface Lookup {
  kind: string;
  status: string;
  label?: string | null;
  amount_cents?: number | null;
  reason?: string | null;
  event_id?: number | null;
}

/** Our order statuses -> what the page shows. */
function pageStatus(dbStatus: string): "paid" | "pending" | "failed" {
  if (dbStatus === "paid" || dbStatus === "shipped" || dbStatus === "delivered") return "paid";
  if (dbStatus === "failed" || dbStatus === "cancelled" || dbStatus === "expired") return "failed";
  return "pending";
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let cfg: VivaConfig;
  try {
    cfg = loadVivaConfig((name) => Deno.env.get(name));
  } catch (err) {
    console.error("Viva configuration problem:", err instanceof VivaConfigError ? err.message : "unknown");
    return json({ error: "misconfigured" }, 500);
  }
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json({ error: "misconfigured" }, 500);
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } }) as unknown as RpcClient;

  // ---- Input: only what Viva puts in the return URL. ----
  let input: { t?: unknown; s?: unknown; eventId?: unknown };
  try {
    input = JSON.parse(await req.text()) as typeof input;
  } catch {
    return json({ error: "invalid json" }, 400);
  }
  const t = typeof input.t === "string" && isTransactionId(input.t) ? input.t.toLowerCase() : null;
  const s = typeof input.s === "string" && /^\d{6,20}$/.test(input.s) ? input.s : null;
  const eventIdRaw = typeof input.eventId === "string" || typeof input.eventId === "number" ? Number(input.eventId) : NaN;
  const eventId = Number.isInteger(eventIdRaw) && eventIdRaw >= 0 && eventIdRaw < 1_000_000 ? eventIdRaw : null;
  if (!t && !s) return json({ error: "missing payment reference" }, 400);

  try {
    // ---- If Viva gave us a transaction id, ask Viva about it. ----
    let tx: VivaTransaction | null = null;
    let vivaUnreachable = false;
    if (t) {
      try {
        tx = await retrieveTransaction(cfg, t);
      } catch (err) {
        if (!(err instanceof VivaApiError && (err.status === 404 || err.status === 400))) {
          vivaUnreachable = true; // report "still checking"; the page will ask again
          console.error("verify: could not reach Viva:", err instanceof Error ? err.message : "unknown");
        }
      }
    }

    const orderCode = tx?.orderCode ?? s;
    if (tx && s && tx.orderCode !== null && tx.orderCode !== s) return json({ error: "reference mismatch" }, 400);
    if (!orderCode) {
      // A renewal-style transaction has no order code and is not for this page.
      return json({ status: vivaUnreachable ? "pending" : "unknown" }, vivaUnreachable ? 200 : 404);
    }

    // Only orders that exist in OUR database are processed (this is not an open proxy to Viva).
    const before = await rpc<Lookup | null>(admin, "viva_order_lookup", { p_environment: cfg.env, p_order_code: orderCode });
    if (!before) return json({ status: "unknown" }, 404);

    // ---- Apply what Viva confirmed (idempotent). ----
    if (tx) {
      try {
        if (tx.statusId === "F") await processPaid(admin, cfg, tx);
        else if (tx.statusId === "E") await processFailed(admin, cfg, tx);
        // any other status: not final yet, report pending
      } catch (err) {
        if (!(err instanceof TransientError)) throw err;
        console.error("verify: processing postponed:", err.message);
      }
    } else if (eventId !== null) {
      // Back from Viva WITHOUT a transaction id: the payment was refused or abandoned. Record why.
      await rpc(admin, "viva_note_checkout_failure", { p_environment: cfg.env, p_order_code: orderCode, p_event_id: eventId });
    }

    // ---- Report the truth from OUR database. ----
    const after = (await rpc<Lookup | null>(admin, "viva_order_lookup", { p_environment: cfg.env, p_order_code: orderCode })) ?? before;
    return json({
      kind: after.kind,
      status: vivaUnreachable && pageStatus(after.status) === "pending" ? "pending" : pageStatus(after.status),
      label: after.label ?? null,
      amountCents: after.amount_cents ?? null,
      eventId: after.event_id ?? eventId,
    });
  } catch (err) {
    console.error("verify-viva-payment failed:", err instanceof Error ? err.message : "unknown");
    return json({ error: "temporary failure" }, 500);
  }
});
