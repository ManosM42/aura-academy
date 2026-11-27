// Issues one fiscal sale receipt for a payment that is already confirmed as paid.
//
// Request (server to server, Authorization: Bearer <service role key>):
//   { "source": "billing_order" | "book_order" | "online_seminar_booking", "id": "<uuid>" }
//
// Payment verification is not repeated here. The verified Viva path (webhook, Retrieve
// Transaction, shared viva-process) is the only code that sets a row to "paid". Rows that are
// not paid are refused.
//
// Outcomes:
//   signed               200, the only path that queues a receipt email
//   rejected             409/422, no receipt exists, no automatic retry
//   unknown, unverified  202, goes to reconciliation, never resubmitted here
//   not_sent             503, no receipt was created; the document goes back to pending

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@^2";
import {
  bigIntFromStored,
  constantTimeEqual,
  describeError,
  errorResponse,
  HttpError,
  jsonResponse,
  logEvent,
  readJsonObject,
  UUID_RE,
  uuidField,
} from "../_shared/fiscal/util.ts";
import {
  appendAuditLog,
  claimDocumentForSubmission,
  getOrCreateDocument,
  markDocumentOutcome,
  markDocumentSigned,
  queueEmailDelivery,
  recordAttempt,
  type FiscalDocumentRow,
} from "../_shared/fiscal/repo.ts";
import {
  buildGreekCaseData,
  formatReceiptMoment,
  interpretSignResult,
  parseAcceptedFtStates,
  postReceipt,
  validateReceiptRequest,
} from "../_shared/fiscal/viva-fiscal.ts";
// UNVERIFIED: the export name and signature come from the fiscal token module, which was not in the files sent.
import { getFiscalAccessToken } from "../_shared/fiscal/token.ts";
import type {
  FiscalChargeItem,
  FiscalCustomer,
  FiscalEnvironment,
  FiscalErrorKind,
  FiscalPayItem,
  FiscalReceiptRequest,
  FiscalSignOutcome,
} from "../_shared/fiscal/types.ts";

const SOURCE_TABLES = {
  billing_order: "billing_orders",
  book_order: "book_orders",
  online_seminar_booking: "online_seminar_bookings",
} as const;
type SourceKind = keyof typeof SOURCE_TABLES;

const SCENARIOS = ["SUBSCRIPTION", "RENEWAL", "UPGRADE", "BOOK", "SEMINAR"] as const;
type Scenario = (typeof SCENARIOS)[number];

// UNVERIFIED: billing_orders.kind values. Any other kind is refused rather than guessed.
const BILLING_KIND_TO_SCENARIO: Readonly<Record<string, Scenario>> = {
  subscription: "SUBSCRIPTION",
  renewal: "RENEWAL",
  upgrade: "UPGRADE",
};

const DESCRIPTION_BY_SCENARIO: Readonly<Partial<Record<Scenario, string>>> = {
  SUBSCRIPTION: "AURA Academy subscription",
  RENEWAL: "AURA Academy subscription renewal",
  UPGRADE: "AURA Academy plan upgrade",
};

// UNVERIFIED: payment environment values in the payment tables.
const FISCAL_ENV_FOR_PAYMENT: Readonly<Record<string, FiscalEnvironment>> = {
  sandbox: "demo",
  production: "live",
};

const EUR_CODE = "978";
const CASE_RE = /^[1-9]\d{0,19}$/;
const VAT_RATE_RE = /^\d{1,5}$/;
const VAT_NUMBER_RE = /^\d{9}$/;
const SERIES_RE = /^[A-Za-z0-9_-]{1,20}$/;
const DESCRIPTION_MAX = 120;

class FiscalConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FiscalConfigError";
  }
}

interface ScenarioConfig {
  chargeCase: bigint;
  /** Hundredths of a percent. 2400 means 24%. */
  vatRate: number;
}

interface FiscalConfig {
  environment: FiscalEnvironment;
  merchantVat: string;
  series: string;
  saleReceiptCase: bigint;
  payItemCase: bigint;
  acceptedFtStates: readonly string[];
  scenarios: Readonly<Record<Scenario, ScenarioConfig>>;
}

interface SaleSource {
  reference: string;
  scenario: Scenario;
  environment: FiscalEnvironment;
  amount: bigint;
  paidAt: Date;
  description: string;
  transactionId: string | null;
  orderCode: string | null;
  email: string | null;
  customer: FiscalCustomer | null;
}

type SaleDocRow = FiscalDocumentRow & {
  series: string | null;
  aa: number | null;
  vat_number: string | null;
};

function requireEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new FiscalConfigError(`${name} is not set`);
  return value;
}

function caseFromEnv(name: string): bigint {
  const raw = requireEnv(name);
  if (!CASE_RE.test(raw)) throw new FiscalConfigError(`${name} must be a positive integer`);
  return BigInt(raw);
}

function loadFiscalConfig(): FiscalConfig {
  const environment = requireEnv("FISCAL_ENVIRONMENT");
  if (environment !== "demo" && environment !== "live") {
    throw new FiscalConfigError("FISCAL_ENVIRONMENT must be demo or live");
  }
  const merchantVat = requireEnv("FISCAL_MERCHANT_VAT");
  if (!VAT_NUMBER_RE.test(merchantVat)) throw new FiscalConfigError("FISCAL_MERCHANT_VAT must be 9 digits");
  const series = requireEnv("FISCAL_SERIES");
  if (!SERIES_RE.test(series)) throw new FiscalConfigError("FISCAL_SERIES must be 1 to 20 letters, digits, _ or -");

  let acceptedFtStates: readonly string[];
  try {
    acceptedFtStates = parseAcceptedFtStates(requireEnv("FISCAL_SALE_ACCEPTED_FT_STATES"));
  } catch (err) {
    throw new FiscalConfigError(describeError(err));
  }

  const entries = SCENARIOS.map((scenario) => {
    const rate = requireEnv(`FISCAL_VAT_RATE_${scenario}`);
    if (!VAT_RATE_RE.test(rate)) throw new FiscalConfigError(`FISCAL_VAT_RATE_${scenario} must be an integer`);
    return [scenario, { chargeCase: caseFromEnv(`FISCAL_CHARGE_CASE_${scenario}`), vatRate: Number(rate) }] as const;
  });

  return {
    environment,
    merchantVat,
    series,
    saleReceiptCase: caseFromEnv("FISCAL_SALE_RECEIPT_CASE"),
    payItemCase: caseFromEnv("FISCAL_PAY_ITEM_CASE"),
    acceptedFtStates,
    scenarios: Object.fromEntries(entries) as Record<Scenario, ScenarioConfig>,
  };
}

function requireServiceCaller(req: Request, serviceKey: string): void {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (token === "" || !constantTimeEqual(token, serviceKey)) {
    throw new HttpError(401, "unauthorized", "Service role credentials are required");
  }
}

function ownValue<T>(record: Readonly<Record<string, T>>, key: unknown): T | undefined {
  return typeof key === "string" && Object.hasOwn(record, key) ? record[key] : undefined;
}

function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function uuidOrNull(value: unknown): string | null {
  return typeof value === "string" && UUID_RE.test(value) ? value.toLowerCase() : null;
}

function clip(text: string): string {
  return text.length > DESCRIPTION_MAX ? text.slice(0, DESCRIPTION_MAX) : text;
}

function fiscalEnvFor(paymentEnvironment: unknown): FiscalEnvironment {
  const env = ownValue(FISCAL_ENV_FOR_PAYMENT, paymentEnvironment);
  if (!env) throw new HttpError(409, "environment_unknown", "The payment has no known environment");
  return env;
}

function requirePaidRow(row: { status: unknown; provider: unknown; paidAt: unknown }): Date {
  if (row.status !== "paid") throw new HttpError(409, "not_paid", "Only paid payments can be fiscalised");
  if (row.provider !== "viva") throw new HttpError(422, "unsupported_provider", "Only Viva payments are fiscalised here");
  const text = textOrNull(row.paidAt);
  const date = text ? new Date(text) : null;
  if (!date || Number.isNaN(date.getTime())) throw new HttpError(409, "not_paid", "The payment has no paid_at time");
  return date;
}

function requireEurAmount(amountRaw: unknown, currency: unknown): bigint {
  if (currency !== "EUR") throw new HttpError(422, "unsupported_currency", "Only EUR payments are fiscalised here");
  const amount = bigIntFromStored(amountRaw);
  if (amount <= 0n) throw new HttpError(409, "invalid_amount", "The payment amount must be positive");
  return amount;
}

/**
 * Greek retail prices include VAT. vatRate is in hundredths of a percent.
 * Rounds half up. UNVERIFIED: the accountant must confirm both the VAT-inclusive assumption and the rounding.
 */
export function splitIncludedVat(gross: bigint, vatRate: number): bigint {
  const rate = BigInt(vatRate);
  const denominator = 10000n + rate;
  return (gross * rate + denominator / 2n) / denominator;
}

async function loadInvoiceCustomer(db: SupabaseClient, userId: string): Promise<FiscalCustomer | null> {
  const { data, error } = await db
    .from("billing_profiles")
    .select("full_name,company_name,vat_number,address_line1,city,postal_code,country,wants_invoice")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`billing_profiles select failed: ${error.message}`);
  if (!data || data.wants_invoice !== true) return null;

  const vat = textOrNull(data.vat_number);
  const street = textOrNull(data.address_line1);
  const zip = textOrNull(data.postal_code);
  const city = textOrNull(data.city);
  const country = textOrNull(data.country);
  const name = textOrNull(data.company_name) ?? textOrNull(data.full_name);
  if (!vat || !street || !zip || !city || !country || !name) {
    throw new HttpError(409, "customer_incomplete", "An invoice was requested but the billing details are incomplete");
  }
  return {
    customerVATId: vat,
    customerName: name,
    customerStreet: street,
    customerZip: zip,
    customerCity: city,
    customerCountry: country,
  };
}

async function loadBillingOrder(db: SupabaseClient, id: string): Promise<SaleSource> {
  const { data, error } = await db
    .from("billing_orders")
    .select("user_id,kind,status,provider,environment,amount_cents,currency,paid_at,viva_order_code,viva_transaction_id,customer")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`billing_orders select failed: ${error.message}`);
  if (!data) throw new HttpError(404, "not_found", "Billing order not found");

  const scenario = ownValue(BILLING_KIND_TO_SCENARIO, data.kind);
  if (!scenario) throw new HttpError(422, "unsupported_kind", "This billing order kind has no fiscal scenario");

  const paidAt = requirePaidRow({ status: data.status, provider: data.provider, paidAt: data.paid_at });
  const payer = data.customer !== null && typeof data.customer === "object" ? (data.customer as Record<string, unknown>) : null;
  const customer = typeof data.user_id === "string" ? await loadInvoiceCustomer(db, data.user_id) : null;

  return {
    reference: `billing_order:${id}`,
    scenario,
    environment: fiscalEnvFor(data.environment),
    amount: requireEurAmount(data.amount_cents, data.currency),
    paidAt,
    description: clip(DESCRIPTION_BY_SCENARIO[scenario] ?? "AURA Academy"),
    transactionId: uuidOrNull(data.viva_transaction_id),
    orderCode: textOrNull(data.viva_order_code),
    email: textOrNull(payer?.email),
    customer,
  };
}

async function loadBookOrder(db: SupabaseClient, id: string): Promise<SaleSource> {
  const { data, error } = await db
    .from("book_orders")
    .select("status,payment_provider,payment_environment,quantity,total_cents,currency,paid_at,viva_order_code,viva_transaction_id,email")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`book_orders select failed: ${error.message}`);
  if (!data) throw new HttpError(404, "not_found", "Book order not found");

  const paidAt = requirePaidRow({ status: data.status, provider: data.payment_provider, paidAt: data.paid_at });
  const quantity = Number(data.quantity);
  if (!Number.isSafeInteger(quantity) || quantity < 1) throw new HttpError(409, "invalid_quantity", "Invalid book quantity");

  return {
    reference: `book_order:${id}`,
    scenario: "BOOK",
    environment: fiscalEnvFor(data.payment_environment),
    // total_cents includes shipping. UNVERIFIED: the accountant must confirm the VAT treatment of shipping.
    amount: requireEurAmount(data.total_cents, data.currency),
    paidAt,
    description: clip(`Book, ${quantity} pcs`),
    transactionId: uuidOrNull(data.viva_transaction_id),
    orderCode: textOrNull(data.viva_order_code),
    email: textOrNull(data.email),
    customer: null,
  };
}

async function loadSeminarBooking(db: SupabaseClient, id: string): Promise<SaleSource> {
  const { data, error } = await db
    .from("online_seminar_bookings")
    .select("seminar_id,status,payment_provider,payment_environment,amount_cents,paid_at,viva_order_code,viva_transaction_id,email")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`online_seminar_bookings select failed: ${error.message}`);
  if (!data) throw new HttpError(404, "not_found", "Seminar booking not found");

  const paidAt = requirePaidRow({ status: data.status, provider: data.payment_provider, paidAt: data.paid_at });

  const { data: seminar, error: seminarErr } = await db
    .from("online_seminars")
    .select("title,currency")
    .eq("id", data.seminar_id)
    .maybeSingle();
  if (seminarErr) throw new Error(`online_seminars select failed: ${seminarErr.message}`);
  if (!seminar) throw new HttpError(409, "seminar_missing", "The seminar for this booking does not exist");

  const title = textOrNull(seminar.title) ?? "Online seminar";
  return {
    reference: `online_seminar_booking:${id}`,
    scenario: "SEMINAR",
    environment: fiscalEnvFor(data.payment_environment),
    amount: requireEurAmount(data.amount_cents, seminar.currency),
    paidAt,
    description: clip(`Online seminar: ${title}`),
    transactionId: uuidOrNull(data.viva_transaction_id),
    orderCode: textOrNull(data.viva_order_code),
    email: textOrNull(data.email),
    customer: null,
  };
}

async function findDocument(db: SupabaseClient, config: FiscalConfig, reference: string): Promise<SaleDocRow | null> {
  const { data, error } = await db
    .from("fiscal_documents")
    .select("*")
    .eq("environment", config.environment)
    .eq("merchant_id", config.merchantVat)
    .eq("receipt_reference", reference)
    .maybeSingle();
  if (error) throw new Error(`fiscal_documents select failed: ${error.message}`);
  return (data as SaleDocRow | null) ?? null;
}

async function allocateAa(db: SupabaseClient, config: FiscalConfig): Promise<number> {
  const { data, error } = await db.rpc("fiscal_allocate_aa", {
    p_environment: config.environment,
    p_merchant_id: config.merchantVat,
    p_series: config.series,
  });
  if (error) throw new Error(`fiscal_allocate_aa failed: ${error.message}`);
  const aa = Number(data);
  if (!Number.isSafeInteger(aa) || aa < 1) throw new Error("fiscal_allocate_aa returned an invalid number");
  return aa;
}

function buildRequest(config: FiscalConfig, source: SaleSource, doc: SaleDocRow): FiscalReceiptRequest {
  if (!doc.vat_number || !doc.series || doc.aa === null) {
    throw new Error("fiscal document is missing its numbering fields");
  }
  const scenario = config.scenarios[source.scenario];
  const moment = formatReceiptMoment(new Date(doc.receipt_moment));
  const caseData = buildGreekCaseData({
    merchantVatId: doc.vat_number,
    series: doc.series,
    aa: doc.aa,
    receiptReference: doc.receipt_reference,
    receiptMoment: moment,
    receiptAmount: source.amount,
  });

  const chargeItem: FiscalChargeItem = {
    position: 1,
    description: source.description,
    quantity: 100,
    unitPrice: null,
    amount: source.amount,
    vatRate: scenario.vatRate,
    vatAmount: splitIncludedVat(source.amount, scenario.vatRate),
    moment,
    ftChargeItemCase: scenario.chargeCase,
    currencyCode: EUR_CODE,
  };
  const payItem: FiscalPayItem = {
    position: 1,
    description: "Card payment",
    amount: source.amount,
    moment,
    ftPayItemCase: config.payItemCase,
    currencyCode: EUR_CODE,
    transactionId: source.transactionId,
  };

  return {
    sessionId: doc.session_id,
    receiptReference: doc.receipt_reference,
    receiptMoment: moment,
    ftReceiptCase: config.saleReceiptCase,
    currencyCode: EUR_CODE,
    receiptAmount: source.amount,
    customer: source.customer,
    chargeItems: [chargeItem],
    payItems: [payItem],
    ftReceiptCaseData: caseData,
  };
}

function attemptFields(outcome: FiscalSignOutcome): {
  httpStatus: number | null;
  errorKind: FiscalErrorKind | null;
  message: string | null;
  excerpt: string | null;
} {
  switch (outcome.kind) {
    case "signed":
    case "rejected":
      return { httpStatus: outcome.httpStatus, errorKind: null, message: null, excerpt: outcome.responseExcerpt };
    case "unknown":
      return {
        httpStatus: outcome.httpStatus,
        errorKind: outcome.errorKind,
        message: outcome.message,
        excerpt: outcome.responseExcerpt,
      };
    case "unverified":
      return { httpStatus: outcome.httpStatus, errorKind: null, message: outcome.message, excerpt: outcome.responseExcerpt };
    case "not_sent":
      return {
        httpStatus: outcome.httpStatus ?? null,
        errorKind: outcome.errorKind,
        message: outcome.message,
        excerpt: outcome.responseExcerpt ?? null,
      };
  }
}

async function safeAudit(db: SupabaseClient, documentId: string, action: string, details: Record<string, unknown>): Promise<void> {
  try {
    await appendAuditLog(db, { documentId, actor: "fiscal-issue-sale", action, details });
  } catch (err) {
    logEvent("audit_write_failed", { action, message: describeError(err).slice(0, 200) });
  }
}

async function queueReceiptEmail(db: SupabaseClient, documentId: string, email: string | null): Promise<boolean> {
  if (!email) return false;
  await queueEmailDelivery(db, documentId, email);
  return true;
}

async function releaseToPending(db: SupabaseClient, documentId: string): Promise<void> {
  const { data, error } = await db
    .from("fiscal_documents")
    .update({ status: "pending" })
    .eq("id", documentId)
    .eq("status", "submitting")
    .select("id");
  if (error) throw new Error(`release document to pending failed: ${error.message}`);
  if ((data?.length ?? 0) === 0) throw new Error(`document ${documentId} was not submitting; release rejected`);
}

async function issueSale(db: SupabaseClient, config: FiscalConfig, source: SaleSource): Promise<Response> {
  if (source.environment !== config.environment) {
    throw new HttpError(409, "environment_mismatch", "This payment belongs to a different fiscal environment");
  }

  let doc = await findDocument(db, config, source.reference);
  if (!doc) {
    const aa = await allocateAa(db, config);
    const moment = formatReceiptMoment(source.paidAt);
    const hashPayload = buildGreekCaseData({
      merchantVatId: config.merchantVat,
      series: config.series,
      aa,
      receiptReference: source.reference,
      receiptMoment: moment,
      receiptAmount: source.amount,
    }).GR.HashPayload;

    const { row, created } = await getOrCreateDocument(db, {
      environment: config.environment,
      merchantId: config.merchantVat,
      receiptKind: "sale",
      receiptReference: source.reference,
      sessionId: crypto.randomUUID(),
      ftReceiptCase: config.saleReceiptCase,
      receiptMoment: moment,
      currencyCode: EUR_CODE,
      amountMinor: source.amount,
      vatNumber: config.merchantVat,
      series: config.series,
      aa,
      hashAlg: "sha256",
      hashPayload,
      paymentTransactionId: source.transactionId,
      paymentOrderCode: source.orderCode,
      customerEmail: source.email,
      customerName: source.customer?.customerName ?? null,
    });
    if (!created) logEvent("sale_aa_unused", { reference: source.reference, aa });
    doc = row as SaleDocRow;
  }

  if (bigIntFromStored(doc.amount_minor) !== source.amount || doc.currency_code !== EUR_CODE) {
    throw new HttpError(409, "document_mismatch", "An existing receipt for this payment has a different amount or currency");
  }

  switch (doc.status) {
    case "signed": {
      const emailQueued = await queueReceiptEmail(db, doc.id, source.email);
      return jsonResponse(200, {
        status: "signed",
        reference: source.reference,
        ftReceiptIdentification: doc.ft_receipt_identification,
        ftMark: doc.ft_mark,
        emailQueued,
      });
    }
    case "pending":
      break;
    case "submitting":
      return jsonResponse(409, { status: "in_progress", message: "A receipt for this payment is being sent" });
    case "rejected":
      return jsonResponse(409, { status: "rejected", message: "The earlier receipt was rejected. Reset is disabled." });
    case "unknown":
    case "unverified":
      return jsonResponse(409, { status: "reconciliation_required", message: "Reconcile this receipt before sending again" });
  }

  const request = buildRequest(config, source, doc);
  validateReceiptRequest(request);

  const claimed = await claimDocumentForSubmission(db, doc.id);
  if (!claimed) return jsonResponse(409, { status: "in_progress", message: "A receipt for this payment is being sent" });

  const startedAt = new Date();
  const sent = await postReceipt(config.environment, request, getFiscalAccessToken);
  const finishedAt = new Date();
  const outcome = interpretSignResult(sent.result, { acceptedFtStates: config.acceptedFtStates });

  try {
    const fields = attemptFields(outcome);
    await recordAttempt(db, {
      documentId: doc.id,
      requestSha256: sent.requestSha256,
      startedAtIso: startedAt.toISOString(),
      finishedAtIso: finishedAt.toISOString(),
      httpStatus: fields.httpStatus,
      outcome: outcome.kind,
      errorKind: fields.errorKind,
      errorMessage: fields.message,
      responseExcerpt: fields.excerpt,
    });
  } catch (err) {
    // The outcome still has to be stored. A failed attempt log must not lose a signed receipt.
    logEvent("attempt_record_failed", { documentId: doc.id, message: describeError(err).slice(0, 200) });
  }

  switch (outcome.kind) {
    case "signed": {
      await markDocumentSigned(db, doc.id, {
        ftReceiptIdentification: outcome.ftReceiptIdentification,
        ftMark: outcome.ftMark,
        ftState: outcome.ftState,
        ftSignatures: outcome.ftSignatures,
        transmissionIndicator: outcome.transmissionIndicator,
        signedAtIso: new Date().toISOString(),
      });
      await safeAudit(db, doc.id, "sale_signed", { reference: source.reference, httpStatus: outcome.httpStatus });
      const emailQueued = await queueReceiptEmail(db, doc.id, source.email);
      return jsonResponse(200, {
        status: "signed",
        reference: source.reference,
        ftReceiptIdentification: outcome.ftReceiptIdentification,
        ftMark: outcome.ftMark,
        emailQueued,
      });
    }
    case "rejected": {
      await markDocumentOutcome(db, doc.id, "rejected");
      await safeAudit(db, doc.id, "sale_rejected", { reference: source.reference, httpStatus: outcome.httpStatus });
      return jsonResponse(422, { status: "rejected", reference: source.reference });
    }
    case "unknown": {
      await markDocumentOutcome(db, doc.id, "unknown");
      await safeAudit(db, doc.id, "sale_unknown", { reference: source.reference, errorKind: outcome.errorKind });
      return jsonResponse(202, { status: "reconciliation_required", reference: source.reference });
    }
    case "unverified": {
      await markDocumentOutcome(db, doc.id, "unverified");
      await safeAudit(db, doc.id, "sale_unverified", { reference: source.reference, reason: outcome.reason });
      return jsonResponse(202, { status: "unverified", reason: outcome.reason, reference: source.reference });
    }
    case "not_sent": {
      await releaseToPending(db, doc.id);
      await safeAudit(db, doc.id, "sale_not_sent", { reference: source.reference, errorKind: outcome.errorKind });
      return jsonResponse(503, { status: "not_sent", error: outcome.errorKind, message: outcome.message });
    }
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "method_not_allowed", message: "Use POST" }, { Allow: "POST" });
  }
  try {
    const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    requireServiceCaller(req, serviceKey);

    const body = await readJsonObject(req);
    const source = body.source;
    if (typeof source !== "string" || !Object.hasOwn(SOURCE_TABLES, source)) {
      throw new HttpError(400, "validation", "source must be billing_order, book_order or online_seminar_booking");
    }
    const sourceId = uuidField(body, "id");
    const config = loadFiscalConfig();
    const db = createClient(requireEnv("SUPABASE_URL"), serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const kind = source as SourceKind;
    const sale =
      kind === "billing_order"
        ? await loadBillingOrder(db, sourceId)
        : kind === "book_order"
          ? await loadBookOrder(db, sourceId)
          : await loadSeminarBooking(db, sourceId);

    return await issueSale(db, config, sale);
  } catch (err) {
    return errorResponse(err);
  }
});