// Database access for the fiscal tables. One place that knows the column names from
// the 20261127190000_fiscal_foundation.sql migration, so Edge Functions don't duplicate SQL.

import type { SupabaseClient } from "npm:@supabase/supabase-js@^2";
import type {
  FiscalDocumentStatus,
  FiscalEnvironment,
  FiscalReceiptKind,
} from "./types.ts";

export interface FiscalDocumentRow {
  id: string;
  environment: FiscalEnvironment;
  merchant_id: string;
  receipt_kind: FiscalReceiptKind;
  receipt_reference: string;
  session_id: string;
  ft_receipt_case: string;
  receipt_moment: string;
  currency_code: string;
  amount_minor: string;
  status: FiscalDocumentStatus;
  ft_receipt_identification: string | null;
  signed_at: string | null;
  payment_transaction_id: string | null;
  payment_order_code: string | null;
  customer_email: string | null;
  customer_name: string | null;
}

export interface CreateDocumentInput {
  environment: FiscalEnvironment;
  merchantId: string;
  receiptKind: FiscalReceiptKind;
  receiptReference: string;
  sessionId: string;
  ftReceiptCase: bigint;
  receiptMoment: string;
  currencyCode: string;
  amountMinor: bigint;
  vatNumber?: string | null;
  series?: string | null;
  aa?: number | null;
  hashAlg?: "sha256" | null;
  hashPayload?: string | null;
  paymentTransactionId?: string | null;
  paymentOrderCode?: string | null;
  customerEmail?: string | null;
  customerName?: string | null;
}

/**
 * Inserts a fiscal_documents row, or returns the existing one for the same
 * (environment, merchant_id, receipt_reference). Relies on the unique constraint
 * in the migration, so concurrent callers (webhook retries, worker retries) cannot
 * create two documents for the same reference.
 */
export async function getOrCreateDocument(
  db: SupabaseClient,
  input: CreateDocumentInput,
): Promise<{ row: FiscalDocumentRow; created: boolean }> {
  const { data: existing, error: selectErr } = await db
    .from("fiscal_documents")
    .select("*")
    .eq("environment", input.environment)
    .eq("merchant_id", input.merchantId)
    .eq("receipt_reference", input.receiptReference)
    .maybeSingle();

  if (selectErr) throw new Error(`fiscal_documents select failed: ${selectErr.message}`);
  if (existing) return { row: existing as FiscalDocumentRow, created: false };

  const { data: inserted, error: insertErr } = await db
    .from("fiscal_documents")
    .insert({
      environment: input.environment,
      merchant_id: input.merchantId,
      receipt_kind: input.receiptKind,
      receipt_reference: input.receiptReference,
      session_id: input.sessionId,
      ft_receipt_case: input.ftReceiptCase.toString(),
      receipt_moment: input.receiptMoment,
      currency_code: input.currencyCode,
      amount_minor: input.amountMinor.toString(),
      vat_number: input.vatNumber ?? null,
      series: input.series ?? null,
      aa: input.aa ?? null,
      hash_alg: input.hashAlg ?? null,
      hash_payload: input.hashPayload ?? null,
      payment_transaction_id: input.paymentTransactionId ?? null,
      payment_order_code: input.paymentOrderCode ?? null,
      customer_email: input.customerEmail ?? null,
      customer_name: input.customerName ?? null,
      status: "pending",
    })
    .select("*")
    .single();

  // 23505 = unique_violation: another request won the race. Read back its row.
  if (insertErr?.code === "23505") {
    const { data: raceWinner, error: raceErr } = await db
      .from("fiscal_documents")
      .select("*")
      .eq("environment", input.environment)
      .eq("merchant_id", input.merchantId)
      .eq("receipt_reference", input.receiptReference)
      .single();
    if (raceErr) throw new Error(`fiscal_documents re-select after conflict failed: ${raceErr.message}`);
    return { row: raceWinner as FiscalDocumentRow, created: false };
  }
  if (insertErr) throw new Error(`fiscal_documents insert failed: ${insertErr.message}`);
  return { row: inserted as FiscalDocumentRow, created: true };
}

export async function getDocumentById(db: SupabaseClient, id: string): Promise<FiscalDocumentRow | null> {
  const { data, error } = await db.from("fiscal_documents").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`fiscal_documents select by id failed: ${error.message}`);
  return (data as FiscalDocumentRow | null) ?? null;
}

/** Marks the document "submitting". No-op (returns false) if it is not currently pending or unknown. */
export async function claimDocumentForSubmission(db: SupabaseClient, id: string): Promise<boolean> {
  const { data, error } = await db
    .from("fiscal_documents")
    .update({ status: "submitting" })
    .eq("id", id)
    .in("status", ["pending", "unknown"])
    .select("id");
  if (error) throw new Error(`claim document failed: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

export interface SignedUpdate {
  ftReceiptIdentification: string;
  ftState: string | null;
  ftSignatures: unknown;
  transmissionIndicator: string | null;
  signedAtIso: string;
}

export async function markDocumentSigned(db: SupabaseClient, id: string, update: SignedUpdate): Promise<void> {
  const { error } = await db
    .from("fiscal_documents")
    .update({
      status: "signed",
      ft_receipt_identification: update.ftReceiptIdentification,
      ft_state: update.ftState,
      ft_signatures: update.ftSignatures,
      transmission_indicator: update.transmissionIndicator,
      signed_at: update.signedAtIso,
    })
    .eq("id", id);
  if (error) throw new Error(`mark document signed failed: ${error.message}`);
}

export async function markDocumentStatus(
  db: SupabaseClient,
  id: string,
  status: "rejected" | "unknown" | "pending",
): Promise<void> {
  const { error } = await db.from("fiscal_documents").update({ status }).eq("id", id);
  if (error) throw new Error(`mark document ${status} failed: ${error.message}`);
}

export interface RecordAttemptInput {
  documentId: string;
  requestSha256: string;
  httpStatus: number | null;
  outcome: "signed" | "rejected" | "unknown" | "not_sent";
  errorKind?: "timeout" | "network" | "http" | "parse" | "auth" | "config" | null;
  errorMessage?: string | null;
  responseExcerpt?: string | null;
  finishedAtIso: string;
}

/** Inserts the next attempt row for a document. attempt_no is computed from the current max. */
export async function recordAttempt(db: SupabaseClient, input: RecordAttemptInput): Promise<void> {
  const { data: last, error: lastErr } = await db
    .from("fiscal_attempts")
    .select("attempt_no")
    .eq("document_id", input.documentId)
    .order("attempt_no", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastErr) throw new Error(`read last attempt failed: ${lastErr.message}`);

  const nextAttemptNo = (last?.attempt_no ?? 0) + 1;
  const { error } = await db.from("fiscal_attempts").insert({
    document_id: input.documentId,
    attempt_no: nextAttemptNo,
    request_sha256: input.requestSha256,
    finished_at: input.finishedAtIso,
    http_status: input.httpStatus,
    outcome: input.outcome,
    error_kind: input.errorKind ?? null,
    error_message: input.errorMessage ?? null,
    response_excerpt: input.responseExcerpt ?? null,
  });
  if (error) throw new Error(`insert attempt failed: ${error.message}`);
}

export async function appendAuditLog(
  db: SupabaseClient,
  entry: { documentId?: string | null; actor: string; action: string; details?: Record<string, unknown> },
): Promise<void> {
  const { error } = await db.from("fiscal_audit_log").insert({
    document_id: entry.documentId ?? null,
    actor: entry.actor,
    action: entry.action,
    details: entry.details ?? {},
  });
  if (error) throw new Error(`audit log insert failed: ${error.message}`);
}

export interface QueueStateRow {
  environment: FiscalEnvironment;
  merchant_id: string;
  status: "pending" | "initialising" | "initialised" | "failed";
  start_document_id: string | null;
  initialised_at: string | null;
  last_checked_at: string | null;
  last_ft_state: string | null;
}

export async function getQueueState(
  db: SupabaseClient,
  environment: FiscalEnvironment,
  merchantId: string,
): Promise<QueueStateRow | null> {
  const { data, error } = await db
    .from("fiscal_queue_state")
    .select("*")
    .eq("environment", environment)
    .eq("merchant_id", merchantId)
    .maybeSingle();
  if (error) throw new Error(`fiscal_queue_state select failed: ${error.message}`);
  return (data as QueueStateRow | null) ?? null;
}

/** Ensures a queue_state row exists (status "pending") and returns it. Idempotent. */
export async function ensureQueueState(
  db: SupabaseClient,
  environment: FiscalEnvironment,
  merchantId: string,
): Promise<QueueStateRow> {
  const existing = await getQueueState(db, environment, merchantId);
  if (existing) return existing;

  const { data, error } = await db
    .from("fiscal_queue_state")
    .insert({ environment, merchant_id: merchantId, status: "pending" })
    .select("*")
    .maybeSingle();
  // 23505: another request created it first.
  if (error?.code === "23505") {
    const row = await getQueueState(db, environment, merchantId);
    if (!row) throw new Error("queue state insert conflicted but row is still missing");
    return row;
  }
  if (error) throw new Error(`fiscal_queue_state insert failed: ${error.message}`);
  return data as QueueStateRow;
}

export async function setQueueStateStatus(
  db: SupabaseClient,
  environment: FiscalEnvironment,
  merchantId: string,
  fields: Partial<{
    status: "pending" | "initialising" | "initialised" | "failed";
    start_document_id: string | null;
    initialised_at: string | null;
    last_checked_at: string | null;
    last_ft_state: string | null;
  }>,
): Promise<void> {
  const { error } = await db
    .from("fiscal_queue_state")
    .update(fields)
    .eq("environment", environment)
    .eq("merchant_id", merchantId);
  if (error) throw new Error(`fiscal_queue_state update failed: ${error.message}`);
}

export interface EmailDeliveryRow {
  id: string;
  document_id: string;
  recipient: string;
  status: "queued" | "sending" | "sent" | "failed" | "dead";
  attempts: number;
  next_attempt_at: string;
  provider_message_id: string | null;
  last_error: string | null;
}

/** Idempotency key: stable for a given document + recipient, so retries never duplicate. */
export function emailIdempotencyKey(documentId: string, recipient: string): string {
  return `fiscal-doc:${documentId}:${recipient.toLowerCase()}`;
}

export async function queueEmailDelivery(
  db: SupabaseClient,
  documentId: string,
  recipient: string,
): Promise<EmailDeliveryRow> {
  const { data, error } = await db
    .from("fiscal_email_deliveries")
    .insert({
      document_id: documentId,
      recipient,
      idempotency_key: emailIdempotencyKey(documentId, recipient),
    })
    .select("*")
    .single();

  if (error?.code === "23505") {
    const { data: existing, error: selErr } = await db
      .from("fiscal_email_deliveries")
      .select("*")
      .eq("document_id", documentId)
      .eq("recipient", recipient)
      .single();
    if (selErr) throw new Error(`re-select queued email failed: ${selErr.message}`);
    return existing as EmailDeliveryRow;
  }
  if (error) throw new Error(`queue email delivery failed: ${error.message}`);
  return data as EmailDeliveryRow;
}

/** Wraps the fiscal_claim_due_emails() RPC from the migration. */
export async function claimDueEmails(db: SupabaseClient, limit: number): Promise<EmailDeliveryRow[]> {
  const { data, error } = await db.rpc("fiscal_claim_due_emails", { p_limit: limit });
  if (error) throw new Error(`claim due emails failed: ${error.message}`);
  return (data as EmailDeliveryRow[]) ?? [];
}

export async function markEmailSent(db: SupabaseClient, id: string, providerMessageId: string): Promise<void> {
  const { error } = await db
    .from("fiscal_email_deliveries")
    .update({ status: "sent", provider_message_id: providerMessageId, sent_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`mark email sent failed: ${error.message}`);
}

export async function markEmailFailedOrDead(
  db: SupabaseClient,
  id: string,
  attempts: number,
  maxAttempts: number,
  nextAttemptAtIso: string,
  lastError: string,
): Promise<void> {
  const { error } = await db
    .from("fiscal_email_deliveries")
    .update({
      status: attempts >= maxAttempts ? "dead" : "failed",
      next_attempt_at: nextAttemptAtIso,
      last_error: lastError.slice(0, 1000),
    })
    .eq("id", id);
  if (error) throw new Error(`mark email failed/dead failed: ${error.message}`);
}

/** Resets a dead or failed email to queued, for the admin "resend" action. */
export async function resetEmailForRetry(db: SupabaseClient, id: string): Promise<boolean> {
  const { data, error } = await db
    .from("fiscal_email_deliveries")
    .update({ status: "queued", next_attempt_at: new Date().toISOString(), last_error: null })
    .eq("id", id)
    .in("status", ["failed", "dead"])
    .select("id");
  if (error) throw new Error(`reset email for retry failed: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

/** Resets a rejected or unknown document back to pending, for the admin "retry" action. */
export async function resetDocumentForRetry(db: SupabaseClient, id: string): Promise<boolean> {
  const { data, error } = await db
    .from("fiscal_documents")
    .update({ status: "pending" })
    .eq("id", id)
    .in("status", ["rejected", "unknown"])
    .select("id");
  if (error) throw new Error(`reset document for retry failed: ${error.message}`);
  return (data?.length ?? 0) > 0;
}