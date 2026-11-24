// supabase/functions/viva-webhook/index.ts
//
// Receives Viva.com webhooks. A webhook body is only a HINT: nothing is
// believed until Retrieve Transaction (server to server) confirms it, and the
// result is applied by the shared, idempotent processing in _shared/viva-process.ts
// (subscriptions, renewals, upgrades, online seminars and book orders).
//
// Viva retries on anything except 2xx (hourly, 24 times):
//   * transient problems (Viva unreachable, database error, payment not final) -> 5xx (retry)
//   * things a retry cannot fix (unknown payment, wrong amount)                  -> 200 + admin alert
import { createClient } from "npm:@supabase/supabase-js@^2";
import {
  isTransactionId,
  isVivaWebhookIp,
  loadVivaConfig,
  retrieveTransaction,
  VivaApiError,
  VivaConfigError,
  type VivaConfig,
  type VivaTransaction,
} from "../_shared/viva.ts";
import {
  alertAdmins,
  processFailed,
  processPaid,
  processReversal,
  rpc,
  TransientError,
  type Outcome,
  type RpcClient,
} from "../_shared/viva-process.ts";

const EVENT_PAYMENT_CREATED = 1796;
const EVENT_REVERSAL_CREATED = 1797;
const EVENT_FAILED = 1798;
const MAX_BODY_BYTES = 64 * 1024;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function clientIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return (forwarded.split(",")[0] ?? "").trim() || null;
  return req.headers.get("cf-connecting-ip");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/** Only non-sensitive fields are stored in provider_events (no email, name or card data). */
function redact(body: Record<string, unknown>, data: Record<string, unknown>): Record<string, unknown> {
  const pick = (v: unknown) => (typeof v === "string" || typeof v === "number" || typeof v === "boolean" ? v : null);
  return {
    EventTypeId: pick(body.EventTypeId),
    MessageId: pick(body.MessageId),
    CorrelationId: pick(body.CorrelationId),
    TransactionId: pick(data.TransactionId),
    ParentId: pick(data.ParentId),
    OrderCode: pick(data.OrderCode),
    StatusId: pick(data.StatusId),
    Amount: pick(data.Amount),
    MerchantTrns: pick(data.MerchantTrns),
  };
}

Deno.serve(async (req: Request): Promise<Response> => {
  let cfg: VivaConfig;
  try {
    cfg = loadVivaConfig((name) => Deno.env.get(name));
  } catch (err) {
    console.error("Viva configuration problem:", err instanceof VivaConfigError ? err.message : "unknown");
    return json({ error: "misconfigured" }, 500);
  }

  // ---- Viva's endpoint verification: print our key as-is. ----
  if (req.method === "GET") {
    if (!cfg.webhookKey) {
      console.error("Webhook key secret is not set");
      return json({ error: "misconfigured" }, 500);
    }
    return json({ Key: cfg.webhookKey });
  }
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  // ---- Optional source-address check (published Viva addresses). ----
  const ipMode = (Deno.env.get("VIVA_WEBHOOK_IP_MODE") ?? "log").toLowerCase();
  if (ipMode !== "off") {
    const ip = clientIp(req);
    if (!isVivaWebhookIp(ip, cfg.env)) {
      console.warn(`webhook from a non-Viva address (${ip ?? "unknown"}), mode=${ipMode}`);
      if (ipMode === "enforce") return json({ error: "forbidden" }, 403);
    }
  }

  // ---- Parse (bounded). ----
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return json({ error: "payload too large" }, 413);
  let body: Record<string, unknown>;
  try {
    const parsed = asRecord(JSON.parse(raw));
    if (!parsed) throw new Error("not an object");
    body = parsed;
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const eventType = Number(body.EventTypeId);
  const data = asRecord(body.EventData) ?? {};

  // Events we do not use are acknowledged and left alone (no database write).
  if (![EVENT_PAYMENT_CREATED, EVENT_FAILED, EVENT_REVERSAL_CREATED].includes(eventType)) {
    return json({ ok: true, ignored: "event type not used" });
  }

  // Payments created from an order carry an OrderCode; a renewal charge may not.
  const rawOrderCode = data.OrderCode == null ? "" : String(data.OrderCode);
  const eventOrderCode = rawOrderCode === "0" ? "" : rawOrderCode;
  if (!isTransactionId(data.TransactionId) || (eventOrderCode !== "" && !/^\d{6,20}$/.test(eventOrderCode))) {
    console.error("Relevant Viva event with a malformed payload, type", eventType);
    return json({ error: "malformed event" }, 400);
  }
  // One canonical spelling everywhere (event key, Viva lookup, ledger).
  const transactionId = data.TransactionId.toLowerCase();

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    console.error("Missing Supabase environment configuration");
    return json({ error: "misconfigured" }, 500);
  }
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } }) as unknown as RpcClient;

  // ---- Claim the event (idempotency). ----
  let eventId: string | null = null;
  try {
    const claim = await rpc<{ id: string; claimed: boolean }>(admin, "viva_claim_event", {
      p_environment: cfg.env,
      p_event_key: `viva:${eventType}:${transactionId}`,
      p_event_type: String(eventType),
      p_payload: redact(body, data),
    });
    if (!claim.claimed) return json({ ok: true, duplicate: true });
    eventId = claim.id;
  } catch (err) {
    console.error("claim failed:", err instanceof Error ? err.message : "unknown");
    return json({ error: "temporary failure" }, 500); // Viva will retry
  }

  const finish = async (status: "processed" | "ignored" | "failed", note: string | null) => {
    try {
      await rpc(admin, "viva_finish_event", { p_id: eventId, p_status: status, p_error: note });
    } catch (err) {
      console.error("finish failed:", err instanceof Error ? err.message : "unknown");
    }
  };

  try {
    // ---- Ask Viva what really happened. ----
    let tx: VivaTransaction;
    try {
      tx = await retrieveTransaction(cfg, transactionId);
    } catch (err) {
      if (err instanceof VivaApiError && (err.status === 404 || err.status === 400)) {
        // Viva has no such transaction: a forged or stale notification. Nothing to retry.
        await finish("ignored", "transaction_not_found_at_viva");
        return json({ ok: true, ignored: "unknown transaction" });
      }
      throw new TransientError(err instanceof Error ? err.message : "retrieve failed");
    }

    // The notification and Viva must agree on which order this is.
    if (eventOrderCode !== "" && tx.orderCode !== null && tx.orderCode !== eventOrderCode) {
      await finish("ignored", "order_code_differs_from_viva");
      await alertAdmins(admin, "Πρόβλημα πληρωμής Viva", "Η ειδοποίηση δεν ταιριάζει με τα στοιχεία της Viva. Δεν έγινε ενεργοποίηση.", {
        transaction_id: transactionId, kind: "order_code_mismatch",
      });
      return json({ ok: true, flagged: true });
    }

    let outcome: Outcome;
    if (eventType === EVENT_PAYMENT_CREATED) {
      outcome = await processPaid(admin, cfg, tx);
    } else if (eventType === EVENT_FAILED) {
      outcome = await processFailed(admin, cfg, tx);
    } else {
      if (!isTransactionId(data.ParentId)) {
        outcome = { status: "ignored", result: "reversal_without_parent", kind: "unknown" };
      } else {
        outcome = await processReversal(admin, cfg, tx, data.ParentId.toLowerCase());
      }
    }

    await finish(outcome.status, outcome.result);
    return json({ ok: true, result: outcome.result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    console.error("viva-webhook processing failed:", message);
    await finish("failed", message);
    return json({ error: "temporary failure" }, 500); // Viva will retry (hourly, up to 24 times)
  }
});
