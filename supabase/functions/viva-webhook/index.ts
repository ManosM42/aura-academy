// supabase/functions/viva-webhook/index.ts
//
// STAGE 3: receives Viva.com webhooks and, ONLY after Viva itself confirms the
// payment, activates the subscription.
//
//   Viva --POST--> this function --Retrieve Transaction--> Viva   (truth)
//                       |
//                       +--> database functions (atomic, idempotent)
//
// Rules this file follows:
//  * A webhook body is a HINT. Nothing is believed until Retrieve Transaction
//    (OAuth, server to server) confirms status, order code and amount.
//  * Amount, plan, user and reference are compared with OUR billing_orders row.
//  * Duplicate / retried / out-of-order deliveries cannot double-activate:
//    the event is claimed first, and the money logic is one atomic SQL function.
//  * Viva retries on anything except 2xx (hourly, 24 times). So:
//      - transient problems (Viva unreachable, database error)  -> 5xx (retry)
//      - things a retry cannot fix (unknown payment, wrong amount) -> 200 + alert
//  * Never log card data or personal data.
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

const EVENT_PAYMENT_CREATED = 1796;
const EVENT_REVERSAL_CREATED = 1797;
const EVENT_FAILED = 1798;
const MAX_BODY_BYTES = 64 * 1024;
const EUR_ISO_NUMERIC = "978";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** Thrown for problems a retry could fix (Viva unreachable, database error). */
class TransientError extends Error {}

type AdminClient = ReturnType<typeof createClient>;

async function rpc<T = Record<string, unknown>>(admin: AdminClient, name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await admin.rpc(name, args);
  if (error) throw new TransientError(`${name} failed: ${error.message}`);
  return data as T;
}

/** Tells the admins (push + inbox) that something needs a human. Never throws. */
async function alertAdmins(admin: AdminClient, title: string, body: string, data: Record<string, unknown>) {
  try {
    await admin.rpc("notify_admins", { p_type: "billing_alert", p_title: title, p_body: body, p_url: "/admin", p_data: data });
  } catch (err) {
    console.error("alertAdmins failed:", err instanceof Error ? err.message : "unknown");
  }
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

type Outcome = { status: "processed" | "ignored"; result: string };

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

  const eventOrderCode = data.OrderCode == null ? "" : String(data.OrderCode);
  if (!isTransactionId(data.TransactionId) || !/^\d{6,20}$/.test(eventOrderCode)) {
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
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

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
    if (tx.orderCode !== eventOrderCode) {
      await finish("ignored", "order_code_differs_from_viva");
      await alertAdmins(admin, "Πρόβλημα πληρωμής Viva", "Η ειδοποίηση δεν ταιριάζει με τα στοιχεία της Viva. Δεν έγινε ενεργοποίηση.", {
        transaction_id: transactionId, kind: "order_code_mismatch",
      });
      return json({ ok: true, flagged: true });
    }

    let outcome: Outcome;

    if (eventType === EVENT_PAYMENT_CREATED) {
      outcome = await handlePayment(admin, cfg, tx);
    } else if (eventType === EVENT_FAILED) {
      outcome = await handleFailure(admin, cfg, tx);
    } else {
      outcome = await handleReversal(admin, cfg, tx, data);
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

/* ------------------------------ 1796: paid ------------------------------ */

async function handlePayment(admin: AdminClient, cfg: VivaConfig, tx: VivaTransaction): Promise<Outcome> {
  // Not final yet: ask Viva to send it again later.
  if (tx.statusId !== "F") throw new TransientError(`transaction status is ${tx.statusId}, not F`);

  if (tx.currencyCode !== null && tx.currencyCode !== EUR_ISO_NUMERIC) {
    await alertAdmins(admin, "Πρόβλημα πληρωμής Viva", "Η πληρωμή δεν είναι σε EUR. Δεν έγινε ενεργοποίηση.", {
      transaction_id: tx.transactionId, kind: "currency_mismatch",
    });
    return { status: "ignored", result: "currency_mismatch" };
  }

  const r = await rpc<{ result: string; order_id?: string; user_id?: string; expected_cents?: number; received_cents?: number }>(
    admin,
    "viva_apply_payment",
    {
      p_environment: cfg.env,
      p_order_code: tx.orderCode,
      p_merchant_trns: tx.merchantTrns,
      p_transaction_id: tx.transactionId,
      p_amount_cents: tx.amountCents,
      p_paid_at: tx.insDate,
      p_recurring: tx.recurringSupport,
    },
  );

  switch (r.result) {
    case "activated":
    case "already_processed":
      return { status: "processed", result: r.result };

    case "activated_without_recurring":
      await alertAdmins(admin, "Συνδρομή Viva χωρίς ανανέωση", "Η συνδρομή ενεργοποιήθηκε, αλλά η Viva δεν επέτρεψε επαναλαμβανόμενες χρεώσεις. Δεν θα ανανεωθεί αυτόματα.", {
        order_id: r.order_id ?? null, kind: "no_recurring_support",
      });
      return { status: "processed", result: r.result };

    case "duplicate_payment":
      await alertAdmins(admin, "Διπλή χρέωση Viva", "Ο πελάτης χρεώθηκε δύο φορές για την ίδια παραγγελία. Η δεύτερη πληρωμή καταγράφηκε, δεν δόθηκε τίποτα. Χρειάζεται επιστροφή.", {
        order_id: r.order_id ?? null, transaction_id: tx.transactionId, kind: "duplicate_payment",
      });
      return { status: "processed", result: r.result };

    case "paid_while_subscribed":
      await alertAdmins(admin, "Πληρωμή Viva ενώ υπάρχει συνδρομή", "Ο χρήστης πλήρωσε ενώ είχε ήδη ενεργή συνδρομή. Η πληρωμή καταγράφηκε, δεν άλλαξε η συνδρομή. Χρειάζεται επιστροφή ή έλεγχος.", {
        order_id: r.order_id ?? null, user_id: r.user_id ?? null, transaction_id: tx.transactionId, kind: "paid_while_subscribed",
      });
      return { status: "processed", result: r.result };

    case "user_missing":
      await alertAdmins(admin, "Πληρωμή Viva χωρίς λογαριασμό", "Έγινε πληρωμή για λογαριασμό που έχει διαγραφεί. Η πληρωμή καταγράφηκε. Χρειάζεται επιστροφή.", {
        order_id: r.order_id ?? null, transaction_id: tx.transactionId, kind: "user_missing",
      });
      return { status: "processed", result: r.result };

    default:
      // order_not_found, merchant_reference_mismatch, amount_mismatch, invalid_input:
      // real money may have arrived that we did NOT record. A human must look.
      await alertAdmins(admin, "Πρόβλημα πληρωμής Viva", `Η πληρωμή δεν ταιριάζει με καμία παραγγελία μας (${r.result}). Δεν έγινε ενεργοποίηση. Έλεγξε τη συναλλαγή στη Viva.`, {
        transaction_id: tx.transactionId, order_code: tx.orderCode, kind: r.result,
        expected_cents: r.expected_cents ?? null, received_cents: r.received_cents ?? null,
      });
      return { status: "ignored", result: r.result };
  }
}

/* ----------------------------- 1798: failed ----------------------------- */

async function handleFailure(admin: AdminClient, cfg: VivaConfig, tx: VivaTransaction): Promise<Outcome> {
  // Viva says the customer may retry and still succeed. If it is already
  // successful, the 1796 event is the one that counts.
  if (tx.statusId === "F") return { status: "ignored", result: "actually_succeeded" };

  const r = await rpc<{ result: string }>(admin, "viva_record_failure", {
    p_environment: cfg.env,
    p_order_code: tx.orderCode,
    p_merchant_trns: tx.merchantTrns,
    p_reason: `viva_status_${tx.statusId}`,
  });
  return { status: r.result === "failure_recorded" ? "processed" : "ignored", result: r.result };
}

/* ---------------------------- 1797: refunded ---------------------------- */

async function handleReversal(
  admin: AdminClient,
  cfg: VivaConfig,
  tx: VivaTransaction,
  data: Record<string, unknown>,
): Promise<Outcome> {
  if (tx.statusId !== "F") throw new TransientError(`reversal status is ${tx.statusId}, not F`);

  if (!isTransactionId(data.ParentId)) return { status: "ignored", result: "reversal_without_parent" };
  const parentId = data.ParentId.toLowerCase();

  // Viva reports a reversal as a signed amount; only its size matters here.
  const refundCents = Math.abs(tx.amountCents);
  const r = await rpc<{ result: string; user_id?: string; refunded_total_cents?: number; payment_cents?: number }>(
    admin,
    "viva_apply_refund",
    {
      p_environment: cfg.env,
      p_parent_transaction_id: parentId,
      p_reversal_transaction_id: tx.transactionId,
      p_refund_cents: refundCents,
    },
  );

  if (r.result === "refund_applied") {
    await alertAdmins(admin, "Επιστροφή χρημάτων Viva", "Καταγράφηκε επιστροφή χρημάτων. Η πρόσβαση του μέλους ΔΕΝ αφαιρέθηκε αυτόματα· έλεγξε αν χρειάζεται ακύρωση συνδρομής.", {
      user_id: r.user_id ?? null, refunded_total_cents: r.refunded_total_cents ?? null, kind: "refund_applied",
    });
    return { status: "processed", result: r.result };
  }
  if (r.result === "already_applied") return { status: "processed", result: r.result };

  await alertAdmins(admin, "Πρόβλημα επιστροφής Viva", `Η επιστροφή δεν ταιριάζει με πληρωμή που έχουμε καταγράψει (${r.result}).`, {
    transaction_id: tx.transactionId, kind: r.result,
  });
  return { status: "ignored", result: r.result };
}
