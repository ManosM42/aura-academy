// supabase/functions/_shared/fiscal/repo.ts
// Database access for the fiscal tables. One place that knows the column names from
// the 20261127190000_fiscal_foundation.sql migration, so Edge Functions don't duplicate SQL.
import type { SupabaseClient } from "npm:@supabase/supabase-js@^2";
import type {
  FiscalAttemptOutcome,
  FiscalDocumentStatus,
  FiscalEnvironment,
  FiscalErrorKind,
  FiscalReceiptKind,
} from "./types.ts";

const ATTEMPT_MESSAGE_MAX = 2000;
const ATTEMPT_EXCERPT_MAX = 4000;
const EMAIL_ERROR_MAX = 1000;

/** Lease length in seconds for a claimed email. Assumed default; must match the worker's send timeout. */
export const EMAIL_LEASE_SECONDS = 300;

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
  ft_mark: string | null;
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
 * (environment, merchant_id, receipt_reference). Relies on the unique constraint in the
 * migration, so concurrent callers (webhook retries, worker retries) cannot create two
 * documents for the same reference.
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

/**
 * Moves a pending document to submitting. Returns false when it is not pending.
 * Unknown and unverified documents are deliberately NOT claimable. They need reconciliation
 * against Viva before anything is sent again.
 */
export async function claimDocumentForSubmission(db: SupabaseClient, id: string): Promise<boolean> {
  const { data, error } = await db
    .from("fiscal_documents")
    .update({ status: "submitting" })
    .eq("id", id)
    .eq("status", "pending")
    .select("id");
  if (error) throw new Error(`claim document failed: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

export interface SignedUpdate {
  ftReceiptIdentification: string;
  ftMark: string;
  ftState: string | null;
  ftSignatures: unknown;
  transmissionIndicator: string | null;
  signedAtIso: string;
}

/** Marks a submitting document as signed. Throws if the row is no longer submitting. */
export async function markDocumentSigned(
  db: SupabaseClient,
  id: string,
  update: SignedUpdate,
): Promise<void> {
  const { data, error } = await db
    .from("fiscal_documents")
    .update({
      status: "signed",
      ft_receipt_identification: update.ftReceiptIdentification,
      ft_mark: update.ftMark,
      ft_state: update.ftState,
      ft_signatures: update.ftSignatures,
      transmission_indicator: update.transmissionIndicator,
      signed_at: update.signedAtIso,
    })
    .eq("id", id)
    .eq("status", "submitting")
    .select("id");
  if (error) throw new Error(`mark document signed failed: ${error.message}`);
  if ((data?.length ?? 0) === 0) throw new Error(`document ${id} was not submitting; signed update rejected`);
}

/** Moves a submitting document to rejected, unknown or unverified. */
export async function markDocumentOutcome(
  db: SupabaseClient,
  id: string,
  status: Extract<FiscalDocumentStatus, "rejected" | "unknown" | "unverified">,
): Promise<void> {
  const { data, error } = await db
    .from("fiscal_documents")
    .update({ status })
    .eq("id", id)
    .eq("status", "submitting")
    .select("id");
  if (error) throw new Error(`mark document ${status} failed: ${error.message}`);
  if ((data?.length ?? 0) === 0) throw new Error(`document ${id} was not submitting; ${status} update rejected`);
}

export interface RecordAttemptInput {
  documentId: string;
  requestSha256: string;
  startedAtIso: string;
  finishedAtIso: string;
  httpStatus: number | null;
  outcome: FiscalAttemptOutcome;
  errorKind?: FiscalErrorKind | null;
  errorMessage?: string | null;
  responseExcerpt?: string | null;
}

/** Writes one attempt row. The attempt number is assigned inside fiscal_record_attempt under a row lock. */
export async function recordAttempt(db: SupabaseClient, input: RecordAttemptInput): Promise<number> {
  const { data, error } = await db.rpc("fiscal_record_attempt", {
    p_document_id: input.documentId,
    p_request_sha256: input.requestSha256,
    p_started_at: input.startedAtIso,
    p_finished_at: input.finishedAtIso,
    p_http_status: input.httpStatus,
    p_outcome: input.outcome,
    p_error_kind: input.errorKind ?? null,
    p_error_message: input.errorMessage?.slice(0, ATTEMPT_MESSAGE_MAX) ?? null,
    p_response_excerpt: input.responseExcerpt?.slice(0, ATTEMPT_EXCERPT_MAX) ?? null,
  });
  if (error) throw new Error(`fiscal_record_attempt failed: ${error.message}`);
  return Number(data);
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
  /** Set on rows returned by claimDueEmails. Required for every completion, failure or abort call. */
  lock_token: string | null;
}

/**
 * Idempotency key for the first delivery of a document to a recipient. Manual resends get
 * their key from fiscal_request_email_resend, so this function is never used for a resend.
 */
export function emailIdempotencyKey(documentId: string, recipient: string): string {
  return `fiscal-doc:${documentId}:${recipient.trim().toLowerCase()}:0`;
}

/** Queues the first email for a signed document. Idempotent: a repeat call returns the existing row. */
export async function queueEmailDelivery(
  db: SupabaseClient,
  documentId: string,
  recipient: string,
): Promise<EmailDeliveryRow> {
  const normalized = recipient.trim().toLowerCase();
  const key = emailIdempotencyKey(documentId, normalized);
  const { data, error } = await db
    .from("fiscal_email_deliveries")
    .insert({
      document_id: documentId,
      recipient: normalized,
      idempotency_key: key,
    })
    .select("*")
    .single();

  if (error?.code === "23505") {
    const { data: existing, error: selErr } = await db
      .from("fiscal_email_deliveries")
      .select("*")
      .eq("idempotency_key", key)
      .single();
    if (selErr) throw new Error(`re-select queued email failed: ${selErr.message}`);
    return existing as EmailDeliveryRow;
  }
  if (error) throw new Error(`queue email delivery failed: ${error.message}`);
  return data as EmailDeliveryRow;
}

/**
 * Manual resend. Calls fiscal_request_email_resend, the only resend path. The RPC checks that
 * the document is fully signed, refuses while a delivery is queued or sending, creates a new
 * delivery with a fresh idempotency key, and writes the audit row. Returns the new delivery id.
 */
export async function requestEmailResend(
  db: SupabaseClient,
  documentId: string,
  actorId: string,
  recipient: string | null,
): Promise<string> {
  const { data, error } = await db.rpc("fiscal_request_email_resend", {
    p_document_id: documentId,
    p_recipient: recipient,
    p_actor: actorId,
  });
  if (error) throw new Error(`fiscal_request_email_resend failed: ${error.message}`);
  if (typeof data !== "string") throw new Error("fiscal_request_email_resend returned no delivery id");
  return data;
}

/**
 * Claims due deliveries with a lease. Passes both arguments by name so PostgreSQL resolves
 * the two-argument overload. The one-argument overload is never called.
 */
export async function claimDueEmails(db: SupabaseClient, limit: number): Promise<EmailDeliveryRow[]> {
  const { data, error } = await db.rpc("fiscal_claim_due_emails", {
    p_limit: limit,
    p_lock_seconds: EMAIL_LEASE_SECONDS,
  });
  if (error) throw new Error(`claim due emails failed: ${error.message}`);
  return (data as EmailDeliveryRow[]) ?? [];
}

/** Marks a claimed delivery as sent. Rejected by the RPC if the lock token no longer matches. */
export async function markEmailSent(
  db: SupabaseClient,
  id: string,
  lockToken: string,
  providerMessageId: string,
): Promise<void> {
  const { error } = await db.rpc("fiscal_complete_email_delivery", {
    p_id: id,
    p_lock_token: lockToken,
    p_provider_message_id: providerMessageId,
  });
  if (error) throw new Error(`fiscal_complete_email_delivery failed: ${error.message}`);
}

/**
 * Records a failed send for a claimed delivery. The RPC decides between failed and dead
 * from the attempt count. Rejected if the lock token no longer matches.
 */
export async function markEmailFailed(
  db: SupabaseClient,
  id: string,
  lockToken: string,
  lastError: string,
  retrySeconds: number,
): Promise<void> {
  const { error } = await db.rpc("fiscal_fail_email_delivery", {
    p_id: id,
    p_lock_token: lockToken,
    p_error: lastError.slice(0, EMAIL_ERROR_MAX),
    p_retry_seconds: Math.max(0, Math.floor(retrySeconds)),
  });
  if (error) throw new Error(`fiscal_fail_email_delivery failed: ${error.message}`);
}

/** Releases a claimed delivery without a send attempt. Rejected if the lock token no longer matches. */
export async function abortEmailDelivery(
  db: SupabaseClient,
  id: string,
  lockToken: string,
  reason: string,
): Promise<void> {
  const { error } = await db.rpc("fiscal_abort_email_delivery", {
    p_id: id,
    p_lock_token: lockToken,
    p_reason: reason.slice(0, EMAIL_ERROR_MAX),
  });
  if (error) throw new Error(`fiscal_abort_email_delivery failed: ${error.message}`);
}

/** Resets a failed or dead email to queued, for the admin retry action. Only touches unlocked rows. */
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

/**
 * Resets a rejected document to pending for a new attempt. Unknown and unverified documents
 * are NOT reset here. They need reconciliation with Viva first.
 */
export async function resetRejectedDocument(db: SupabaseClient, id: string): Promise<boolean> {
  const { data, error } = await db
    .from("fiscal_documents")
    .update({ status: "pending" })
    .eq("id", id)
    .eq("status", "rejected")
    .select("id");
  if (error) throw new Error(`reset rejected document failed: ${error.message}`);
  return (data?.length ?? 0) > 0;
}