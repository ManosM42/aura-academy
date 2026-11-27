// STAGE: sends fiscal receipt emails for documents that are already status='signed'.
// Called on a schedule (pg_cron) with the x-fiscal-cron-secret header.
//
// Flow:
//   1. fiscal_claim_email_deliveries() leases due rows (queued, or sending with an expired lease).
//      It only returns deliveries whose document is signed and has ft_receipt_identification and ft_mark.
//      SKIP LOCKED plus a lease token mean two worker runs can never hold the same delivery.
//   2. Per delivery, in its own try/catch: re-read the document, re-check it, send through Resend
//      with the delivery's idempotency key.
//   3. Record the result through an RPC that checks the lease token:
//        sent          -> fiscal_complete_email_delivery
//        retryable     -> fiscal_fail_email_delivery (requeues, or fails when attempts reach max_attempts)
//        non-retryable -> fiscal_abort_email_delivery
//      If recording fails, the delivery is reported as "error", never as sent or retried. Its lease
//      expires and it is claimed again with the same idempotency key, so Resend de-duplicates the send.
//
// Never emailed: unverified, unknown, rejected or pending documents.
// The email makes no claim about AADE transmission, because this worker does not verify it.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  resendConfigFromEnv,
  retryDelaySeconds,
  sendFiscalEmail,
  type ResendConfig,
} from "../_shared/fiscal/email.ts";
import { formatEuroMinor, logEvent, describeError } from "../_shared/fiscal/util.ts";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Headers": "authorization, content-type, x-fiscal-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Deliveries are sent one after another, so the lease must cover the whole batch.
const BATCH_SIZE = 10;
const LEASE_SECONDS = 300;

interface ClaimedDelivery {
  id: string;
  document_id: string;
  recipient: string;
  idempotency_key: string;
  attempts: number; // already incremented by the claim
  max_attempts: number;
  lock_token: string;
}

interface DocumentForEmail {
  id: string;
  status: string;
  receipt_reference: string;
  amount_minor: number | string | null;
  currency_code: string;
  ft_receipt_identification: string | null;
  ft_mark: string | null;
  signed_at: string | null;
}

type Outcome = "sent" | "retry" | "failed" | "error";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: CORS });

  const expectedSecret = Deno.env.get("FISCAL_CRON_SECRET");
  const providedSecret = req.headers.get("x-fiscal-cron-secret");
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return json(401, { error: "unauthorized" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json(500, { error: "server is missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" });
  }
  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  let resendConfig: ResendConfig;
  try {
    resendConfig = resendConfigFromEnv((name) => Deno.env.get(name));
  } catch (err) {
    logEvent("fiscal_email_worker_config_error", { message: describeError(err) });
    return json(503, { error: "config", message: describeError(err) });
  }

  let due: ClaimedDelivery[];
  try {
    due = await claimDueDeliveries(db, BATCH_SIZE, LEASE_SECONDS);
  } catch (err) {
    logEvent("fiscal_email_worker_claim_error", { message: describeError(err) });
    return json(500, { error: "claim_failed", message: describeError(err) });
  }
  if (due.length === 0) return json(200, { processed: 0 });

  const counts = { sent: 0, retried: 0, failed: 0, errors: 0 };
  for (const delivery of due) {
    const outcome = await processDeliverySafely(db, resendConfig, delivery);
    if (outcome === "sent") counts.sent += 1;
    else if (outcome === "retry") counts.retried += 1;
    else if (outcome === "failed") counts.failed += 1;
    else counts.errors += 1;
  }

  logEvent("fiscal_email_worker_batch", { claimed: due.length, ...counts });
  return json(200, { processed: due.length, ...counts });
});

async function claimDueDeliveries(
  db: SupabaseClient,
  limit: number,
  leaseSeconds: number,
): Promise<ClaimedDelivery[]> {
  const { data, error } = await db.rpc("fiscal_claim_email_deliveries", {
    p_limit: limit,
    p_lease_seconds: leaseSeconds,
  });
  if (error) throw new Error(`claim deliveries failed: ${error.message}`);
  return (data ?? []) as ClaimedDelivery[];
}

/** One delivery's failure never stops the batch. */
async function processDeliverySafely(
  db: SupabaseClient,
  resendConfig: ResendConfig,
  delivery: ClaimedDelivery,
): Promise<Outcome> {
  try {
    return await processDelivery(db, resendConfig, delivery);
  } catch (err) {
    // The lease stays in place and expires, then the claim picks the delivery up again.
    logEvent("fiscal_email_worker_delivery_exception", {
      delivery_id: delivery.id,
      message: describeError(err),
    });
    return "error";
  }
}

async function processDelivery(
  db: SupabaseClient,
  resendConfig: ResendConfig,
  delivery: ClaimedDelivery,
): Promise<Outcome> {
  // Re-read the document immediately before sending.
  const { data: doc, error: docErr } = await db
    .from("fiscal_documents")
    .select("id, status, receipt_reference, amount_minor, currency_code, ft_receipt_identification, ft_mark, signed_at")
    .eq("id", delivery.document_id)
    .maybeSingle<DocumentForEmail>();

  if (docErr) {
    logEvent("fiscal_email_worker_doc_error", { delivery_id: delivery.id, message: docErr.message });
    return await recordRetry(db, delivery, `failed to load document: ${docErr.message}`);
  }

  const problem = sendabilityProblem(doc);
  if (problem !== null || !doc) {
    return await recordAbort(db, delivery, problem ?? "document not found");
  }

  const amountMinor = toBigInt(doc.amount_minor);
  if (amountMinor === null) {
    return await recordAbort(db, delivery, "document amount is missing or not an integer");
  }

  let result: Awaited<ReturnType<typeof sendFiscalEmail>>;
  try {
    result = await sendFiscalEmail(resendConfig, {
      to: delivery.recipient,
      idempotencyKey: delivery.idempotency_key,
      subject: `Your receipt ${singleLine(doc.ft_receipt_identification ?? "")} — AURA Academy`,
      html: renderHtml(doc, amountMinor),
      text: renderText(doc, amountMinor),
    });
  } catch (err) {
    return await recordRetry(db, delivery, `send threw: ${describeError(err)}`);
  }

  if (result.kind === "sent") {
    const { error } = await db.rpc("fiscal_complete_email_delivery", {
      p_id: delivery.id,
      p_lock_token: delivery.lock_token,
      p_provider_message_id: result.providerMessageId,
    });
    if (error) {
      // The provider accepted the email, but we could not record it. Do not report it as sent.
      logEvent("fiscal_email_worker_complete_error", { delivery_id: delivery.id, message: error.message });
      return "error";
    }
    return "sent";
  }

  const detail = `http ${result.httpStatus ?? "n/a"}: ${result.message}`;
  if (result.kind === "retry") return await recordRetry(db, delivery, detail);
  return await recordAbort(db, delivery, detail);
}

/** Returns a reason string if the document must not be emailed, or null if it may be. */
function sendabilityProblem(doc: DocumentForEmail | null): string | null {
  if (!doc) return "document not found";
  if (doc.status !== "signed") return `document status is '${doc.status}', not 'signed'`;
  if (!doc.signed_at) return "document has no signed_at";
  if (!nonEmpty(doc.ft_receipt_identification)) return "ft_receipt_identification is empty";
  if (!nonEmpty(doc.ft_mark)) return "ft_mark is empty";
  if (doc.currency_code !== "978" && doc.currency_code !== "EUR") {
    return `unsupported currency '${doc.currency_code}'`;
  }
  return null;
}

async function recordRetry(db: SupabaseClient, delivery: ClaimedDelivery, message: string): Promise<Outcome> {
  const { data, error } = await db.rpc("fiscal_fail_email_delivery", {
    p_id: delivery.id,
    p_lock_token: delivery.lock_token,
    p_error: message,
    p_retry_seconds: retryDelaySeconds(delivery.attempts),
  });
  if (error) {
    logEvent("fiscal_email_worker_retry_record_error", { delivery_id: delivery.id, message: error.message });
    return "error";
  }
  // The RPC sets 'failed' when attempts reached this delivery's max_attempts, otherwise 'queued'.
  return data === "failed" ? "failed" : "retry";
}

async function recordAbort(db: SupabaseClient, delivery: ClaimedDelivery, reason: string): Promise<Outcome> {
  const { error } = await db.rpc("fiscal_abort_email_delivery", {
    p_id: delivery.id,
    p_lock_token: delivery.lock_token,
    p_reason: reason,
  });
  if (error) {
    logEvent("fiscal_email_worker_abort_record_error", { delivery_id: delivery.id, message: error.message });
    return "error";
  }
  return "failed";
}

function nonEmpty(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function toBigInt(value: unknown): bigint | null {
  if (typeof value === "number" && Number.isSafeInteger(value)) return BigInt(value);
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) return BigInt(value.trim());
  return null;
}

/** Subjects are plain text. Strip line breaks to prevent header injection. */
function singleLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

/** HTML-escapes text for element content and quoted attributes. */
function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '""')
    .replace(/'/g, "&#39;");
}

function renderHtml(doc: DocumentForEmail, amountMinor: bigint): string {
  const amount = escapeHtmlText(formatEuroMinor(amountMinor));
  const reference = escapeHtmlText(doc.receipt_reference);
  const receiptId = escapeHtmlText(doc.ft_receipt_identification ?? "");
  const mark = escapeHtmlText(doc.ft_mark ?? "");
  return `<!doctype html>
<html>
  <body style="font-family: sans-serif; color: #111;">
    <h1>Your receipt from AURA Academy</h1>
    <p>Thank you for your payment. Your fiscal receipt has been issued.</p>
    <table style="border-collapse: collapse;">
      <tr><td style="padding: 4px 12px;">Receipt reference</td><td style="padding: 4px 12px;"><strong>${reference}</strong></td></tr>
      <tr><td style="padding: 4px 12px;">Receipt number</td><td style="padding: 4px 12px;"><strong>${receiptId}</strong></td></tr>
      <tr><td style="padding: 4px 12px;">MARK</td><td style="padding: 4px 12px;"><strong>${mark}</strong></td></tr>
      <tr><td style="padding: 4px 12px;">Amount</td><td style="padding: 4px 12px;"><strong>&euro;${amount}</strong></td></tr>
    </table>
    <p style="color: #666; font-size: 13px;">Keep this email as your receipt record.</p>
  </body>
</html>`;
}

function renderText(doc: DocumentForEmail, amountMinor: bigint): string {
  const amount = formatEuroMinor(amountMinor);
  return [
    "Your receipt from AURA Academy",
    "",
    `Receipt reference: ${doc.receipt_reference}`,
    `Receipt number: ${doc.ft_receipt_identification ?? ""}`,
    `MARK: ${doc.ft_mark ?? ""}`,
    `Amount: €${amount}`,
    "",
    "Keep this email as your receipt record.",
  ].join("\n");
}