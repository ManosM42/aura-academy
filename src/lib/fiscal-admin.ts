import type { SupabaseClient } from "@supabase/supabase-js";

export interface Page<T> {
  total: number;
  limit: number;
  offset: number;
  rows: T[];
}

export interface DocumentFilters {
  environment?: string;
  status?: string;
  search?: string;
  page: number;
  pageSize: number;
}

export interface FiscalDocumentSummary {
  id: string;
  environment: string;
  receipt_kind: string;
  receipt_reference: string;
  status: string;
  ft_receipt_identification: string | null;
  amount_minor: string;
  currency_code: string;
  receipt_moment: string;
  signed_at: string | null;
  payment_order_code: string | null;
  customer_email: string | null;
  /** Raw value from Viva. Its meaning for AADE transmission is not verified. Show it as-is. */
  transmission_indicator: string | null;
}

export interface EmailDeliverySummary {
  id: string;
  document_id?: string;
  receipt_reference?: string;
  environment?: string;
  recipient: string;
  status: "queued" | "sending" | "sent" | "failed" | "dead";
  attempts: number;
  next_attempt_at: string;
  provider_message_id: string | null;
  last_error: string | null;
}

export interface AuditEntry {
  document_id?: string | null;
  actor: string;
  action: string;
  details: Record<string, unknown> | null;
}

export interface DocumentDetail {
  document: Record<string, unknown>;
  emails: EmailDeliverySummary[];
  audit: AuditEntry[];
}

export interface FiscalOverview {
  documents_by_status: Record<string, number>;
  emails_by_status: Record<string, number>;
  queue_states: Array<{
    environment: string;
    merchant_id: string;
    status: string;
    start_document_id: string | null;
    initialised_at: string | null;
    last_checked_at: string | null;
    last_ft_state: string | null;
  }>;
}

export interface FiscalHealth {
  checked_at: string;
  database_reachable: boolean;
  documents: Record<string, number>;
  emails: Record<string, number>;
  queue_states: Array<{
    environment: string;
    merchant_id: string;
    status: string;
    last_checked_at: string | null;
  }>;
  viva_fiscal: string;
  aade_mydata: string;
}

const MAX_PAGE_SIZE = 100;

function clampPageSize(size: number): number {
  return Math.min(Math.max(Math.floor(size) || 25, 1), MAX_PAGE_SIZE);
}

function pageOffset(page: number, size: number): number {
  return Math.max(Math.floor(page) - 1, 0) * size;
}

async function callRpc<T>(
  db: SupabaseClient,
  fn: string,
  args: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await db.rpc(fn, args);
  if (error) {
    throw new Error(`${fn} failed: ${error.message}`);
  }
  return data as T;
}

export function getFiscalOverview(
  db: SupabaseClient,
  environment?: string,
): Promise<FiscalOverview> {
  return callRpc<FiscalOverview>(db, "fiscal_admin_overview", {
    p_environment: environment ?? null,
  });
}

export function listFiscalDocuments(
  db: SupabaseClient,
  filters: DocumentFilters,
): Promise<Page<FiscalDocumentSummary>> {
  const size = clampPageSize(filters.pageSize);
  return callRpc<Page<FiscalDocumentSummary>>(db, "fiscal_admin_list_documents", {
    p_environment: filters.environment ?? null,
    p_status: filters.status ?? null,
    p_search: filters.search?.trim() ? filters.search.trim() : null,
    p_limit: size,
    p_offset: pageOffset(filters.page, size),
  });
}

/** Returns null when the document does not exist. */
export function getFiscalDocumentDetail(
  db: SupabaseClient,
  documentId: string,
): Promise<DocumentDetail | null> {
  return callRpc<DocumentDetail | null>(db, "fiscal_admin_document_detail", {
    p_document_id: documentId,
  });
}

export function listEmailDeliveries(
  db: SupabaseClient,
  status: string | undefined,
  page: number,
  pageSize: number,
): Promise<Page<EmailDeliverySummary>> {
  const size = clampPageSize(pageSize);
  return callRpc<Page<EmailDeliverySummary>>(db, "fiscal_admin_list_email_deliveries", {
    p_status: status ?? null,
    p_limit: size,
    p_offset: pageOffset(page, size),
  });
}

export function listFiscalAudit(
  db: SupabaseClient,
  documentId: string | null,
  page: number,
  pageSize: number,
): Promise<Page<AuditEntry>> {
  const size = Math.min(Math.max(Math.floor(pageSize) || 50, 1), 200);
  return callRpc<Page<AuditEntry>>(db, "fiscal_admin_list_audit", {
    p_document_id: documentId,
    p_limit: size,
    p_offset: pageOffset(page, size),
  });
}

export function getFiscalHealth(db: SupabaseClient): Promise<FiscalHealth> {
  return callRpc<FiscalHealth>(db, "fiscal_admin_health", {});
}