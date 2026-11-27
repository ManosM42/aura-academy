// Viva Fiscalisation adapter for Greece (merchant endpoint, card-not-present sales).
//
// Documented by Viva (developer.viva.com, Fiscalisation section):
//   - POST /fiscalization/v1/receipts:sign, OAuth2 bearer token, AllowFiscalization role.
//   - MARK is in ftSignatures. ftReceiptIdentification is the receipt number, not the MARK.
//   - transmissionIndicator 0 = fiscalised and transmitted to AADE.
//   - ftState is the country/version prefix 0x4752_2000 plus flag bits. EEEE_EEEE = error,
//     FFFF_FFFF = fail. Zero Receipt "ready" = 5139205309155246080.
//   - A reused sessionId returns the stored result of the earlier call (stated for zero receipts).
//
// NOT documented, so supplied by configuration (SaleSuccessPolicy):
//   - which ftState values mean "signed" for a sale. Viva's sale samples show 0, but no page
//     defines it. With an empty policy no sale is ever returned as "signed".
//
// This module never reads the environment and never touches the database.

import {
  FT_STATE_GR_QUEUE_READY,
  type FiscalEnvironment,
  type FiscalReceiptRequest,
  type FiscalSignOutcome,
  type GreekReceiptCaseData,
} from "./types.ts";

const RECEIPT_SIGN_URL: Record<FiscalEnvironment, string> = {
  demo: "https://demo-api.vivapayments.com/fiscalization/v1/receipts:sign",
  live: "https://api.vivapayments.com/fiscalization/v1/receipts:sign",
};

export const DEFAULT_REQUEST_TIMEOUT_MS = 20_000;
const EXCERPT_MAX_CHARS = 4_000;

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MOMENT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const CURRENCY_RE = /^\d{3}$/;
const MERCHANT_VAT_RE = /^\d{9}$/;
const MARK_RE = /^\d{1,20}$/;
const UID_RE = /^[\x21-\x7e]{1,100}$/;

// ftSignatures lookups. The MARK appears under caption "MARK" (Samples page) and under caption
// "invoiceMark" with type 5139205309155246100 (Core Concepts). The UID uses "invoiceUid" and ...099.
const MARK_CAPTIONS: readonly string[] = ["MARK", "invoiceMark"];
const MARK_SIGNATURE_TYPE = "5139205309155246100";
const UID_CAPTIONS: readonly string[] = ["invoiceUid"];
const UID_SIGNATURE_TYPE = "5139205309155246099";

// Error names Viva documents for merchants that are not ready to sign.
const ERR_INVALID_MERCHANT = "FiskaltrustInvalidMerchantOrTerminal";
const ERR_UNKNOWN_STATE = "FiskaltrustSignReceiptUnknownState";

// ftState layout: upper 32 bits = country + version, lower 32 bits = flags.
const FT_STATE_GR_PREFIX = FT_STATE_GR_QUEUE_READY >> 32n;
const FT_STATE_FLAGS_MASK = 0xffffffffn;
const FT_STATE_FLAGS_ERROR = 0xeeeeeeeen;
const FT_STATE_FLAGS_FAIL = 0xffffffffn;

/** Returns a Bearer token for the Fiscal API. Inject a wrapper around token.ts. */
export type FiscalTokenProvider = (signal: AbortSignal) => Promise<string>;

/** Which ftState values count as a signed sale. Supplied by configuration. */
export interface SaleSuccessPolicy {
  /** Exact int64 values as decimal strings. Empty means no sale is ever treated as signed. */
  readonly acceptedFtStates: readonly string[];
}

export class FiscalValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FiscalValidationError";
  }
}

/** Raw result of one HTTP call. Interpreted by interpretSignResult / interpretZeroReceipt. */
export type FiscalTransportResult =
  | {
      kind: "response";
      httpStatus: number;
      excerpt: string;
      body: Record<string, unknown> | null;
    }
  | { kind: "unknown"; errorKind: "timeout" | "network"; message: string }
  | { kind: "not_sent"; errorKind: "auth" | "config"; message: string };

// ---------------------------------------------------------------------------
// HashPayload and moments
// ---------------------------------------------------------------------------

/** 2026-07-10T11:28:00.123Z -> 2026-07-10T11:28:00Z, the shape used in every Viva sample. */
export function formatReceiptMoment(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function isUtcMoment(value: string): boolean {
  return MOMENT_RE.test(value) && !Number.isNaN(Date.parse(value));
}

/**
 * Minor units to the amount text used in HashPayload: euros with at least one decimal.
 * 1780 -> "17.8", 124 -> "1.24", 12400 -> "124.0", -124 -> "-1.24". Derived from Viva's examples.
 */
export function formatHashAmount(minor: bigint): string {
  const negative = minor < 0n;
  const abs = negative ? -minor : minor;
  const whole = abs / 100n;
  let fraction = (abs % 100n).toString().padStart(2, "0");
  if (fraction.endsWith("0")) fraction = fraction.slice(0, 1);
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

export interface HashPayloadInput {
  merchantVatId: string;
  series: string;
  aa: number;
  receiptReference: string;
  receiptMoment: string;
  receiptAmount: bigint;
}

/** MerchantVATID-Series-AA-cbReceiptReference-cbReceiptMoment-Amount, as documented by Viva. */
export function buildHashPayload(input: HashPayloadInput): string {
  return [
    input.merchantVatId,
    input.series,
    String(input.aa),
    input.receiptReference,
    input.receiptMoment,
    formatHashAmount(input.receiptAmount),
  ].join("-");
}

export function buildGreekCaseData(input: HashPayloadInput): GreekReceiptCaseData {
  return {
    GR: {
      MerchantVATID: input.merchantVatId,
      Series: input.series,
      AA: input.aa,
      HashAlg: "sha256",
      HashPayload: buildHashPayload(input),
    },
  };
}

// ---------------------------------------------------------------------------
// Request validation
// ---------------------------------------------------------------------------

/** Throws FiscalValidationError before any network call when the request is malformed. */
export function validateReceiptRequest(req: FiscalReceiptRequest): void {
  const fail = (message: string): never => {
    throw new FiscalValidationError(message);
  };

  if (!UUID_V4_RE.test(req.sessionId)) fail("sessionId must be a UUID v4");
  if (req.receiptReference.length < 1 || req.receiptReference.length > 100) {
    fail("receiptReference must be 1 to 100 characters");
  }
  if (!isUtcMoment(req.receiptMoment)) {
    fail("receiptMoment must be ISO 8601 UTC such as 2026-07-10T11:28:00Z");
  }
  if (!CURRENCY_RE.test(req.currencyCode)) fail("currencyCode must be a 3-digit numeric code");
  if (req.ftReceiptCase <= 0n) fail("ftReceiptCase must be a positive int64");
  if (req.receiptAmount < 0n) fail("receiptAmount cannot be negative");

  const chargePositions = new Set<number>();
  for (const item of req.chargeItems) {
    const where = `charge item ${item.position}`;
    if (!Number.isSafeInteger(item.position) || item.position < 1) {
      fail(`${where}: position must be an integer of at least 1`);
    }
    if (chargePositions.has(item.position)) fail(`${where}: duplicate position`);
    chargePositions.add(item.position);
    if (item.description.trim().length === 0) fail(`${where}: description is required`);
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1) {
      fail(`${where}: quantity must be an integer of at least 1 (100 means one unit)`);
    }
    if (item.amount < 0n) fail(`${where}: amount cannot be negative`);
    if (item.vatAmount < 0n) fail(`${where}: vatAmount cannot be negative`);
    if (item.unitPrice !== null && item.unitPrice < 0n) fail(`${where}: unitPrice cannot be negative`);
    if (!Number.isSafeInteger(item.vatRate) || item.vatRate < 0) {
      fail(`${where}: vatRate must be a non-negative integer`);
    }
    if (!isUtcMoment(item.moment)) fail(`${where}: moment must be ISO 8601 UTC`);
    if (!CURRENCY_RE.test(item.currencyCode)) fail(`${where}: currencyCode must be 3 digits`);
    if (item.ftChargeItemCase <= 0n) fail(`${where}: ftChargeItemCase must be a positive int64`);
  }

  const payPositions = new Set<number>();
  for (const item of req.payItems) {
    const where = `pay item ${item.position}`;
    if (!Number.isSafeInteger(item.position) || item.position < 1) {
      fail(`${where}: position must be an integer of at least 1`);
    }
    if (payPositions.has(item.position)) fail(`${where}: duplicate position`);
    payPositions.add(item.position);
    if (item.description.trim().length === 0) fail(`${where}: description is required`);
    if (item.amount < 0n) fail(`${where}: amount cannot be negative`);
    if (!isUtcMoment(item.moment)) fail(`${where}: moment must be ISO 8601 UTC`);
    if (!CURRENCY_RE.test(item.currencyCode)) fail(`${where}: currencyCode must be 3 digits`);
    if (item.ftPayItemCase <= 0n) fail(`${where}: ftPayItemCase must be a positive int64`);
    if (item.transactionId !== null && !UUID_RE.test(item.transactionId)) {
      fail(`${where}: transactionId must be a UUID or null`);
    }
  }

  // Viva rejects requests where pay items and charge items differ ("The sum of the charge items
  // must be equal to the sum of the pay items"). The receipt amount is held to the same total.
  const chargeTotal = req.chargeItems.reduce((sum, item) => sum + item.amount, 0n);
  const payTotal = req.payItems.reduce((sum, item) => sum + item.amount, 0n);
  if (chargeTotal !== req.receiptAmount || payTotal !== req.receiptAmount) {
    fail("charge items, pay items and receiptAmount must add up to the same total");
  }

  if (req.ftReceiptCaseData !== null) {
    const gr = req.ftReceiptCaseData.GR;
    if (!MERCHANT_VAT_RE.test(gr.MerchantVATID)) fail("GR.MerchantVATID must be 9 digits");
    if (gr.Series.length < 1 || gr.Series.length > 20) fail("GR.Series must be 1 to 20 characters");
    if (!Number.isSafeInteger(gr.AA) || gr.AA < 1) fail("GR.AA must be a positive integer");
    if (gr.HashAlg !== "sha256") fail("GR.HashAlg must be sha256");
    const expected = buildHashPayload({
      merchantVatId: gr.MerchantVATID,
      series: gr.Series,
      aa: gr.AA,
      receiptReference: req.receiptReference,
      receiptMoment: req.receiptMoment,
      receiptAmount: req.receiptAmount,
    });
    if (gr.HashPayload !== expected) {
      fail("GR.HashPayload does not match the receipt. Build it with buildGreekCaseData.");
    }
  }
}

// ---------------------------------------------------------------------------
// Wire format
// ---------------------------------------------------------------------------

// JSON cannot carry bigint. Each bigint becomes a marked string, and the marks are then removed
// so the digits are written as bare integers. The marker is random per call, so request text
// can never collide with it.
function stringifyWire(value: unknown): string {
  const marker = `@@bigint:${crypto.randomUUID()}:`;
  const text = JSON.stringify(value, (_key, v: unknown) =>
    typeof v === "bigint" ? `${marker}${v.toString()}` : v,
  );
  return text.replace(new RegExp(`"${marker}(-?\\d+)"`, "g"), "$1");
}

function toWire(req: FiscalReceiptRequest): Record<string, unknown> {
  const wire: Record<string, unknown> = {
    sessionId: req.sessionId,
    cbReceiptReference: req.receiptReference,
    cbReceiptMoment: req.receiptMoment,
    cbReceiptAmount: req.receiptAmount,
    ftReceiptCase: req.ftReceiptCase,
    currencyCode: req.currencyCode,
    ftReceiptCaseData: req.ftReceiptCaseData,
    cbChargeItems: req.chargeItems.map((i) => ({
      position: i.position,
      description: i.description,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      amount: i.amount,
      vatRate: i.vatRate,
      vatAmount: i.vatAmount,
      moment: i.moment,
      ftChargeItemCase: i.ftChargeItemCase,
      currencyCode: i.currencyCode,
    })),
    cbPayItems: req.payItems.map((p) => ({
      position: p.position,
      description: p.description,
      amount: p.amount,
      moment: p.moment,
      ftPayItemCase: p.ftPayItemCase,
      currencyCode: p.currencyCode,
      transactionId: p.transactionId,
    })),
  };
  if (req.customer !== null) wire.cbCustomer = req.customer;
  return wire;
}

// Integers of 16 or more digits lose precision as JS numbers. This quotes them (outside string
// literals only) so they arrive as exact strings. Text inside JSON strings is never changed.
function quoteBigIntegers(text: string): string {
  const numberToken = /-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
  let out = "";
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '"') {
      let j = i + 1;
      while (j < text.length) {
        if (text[j] === "\\") {
          j += 2;
          continue;
        }
        if (text[j] === '"') break;
        j += 1;
      }
      out += text.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (ch === "-" || (ch >= "0" && ch <= "9")) {
      numberToken.lastIndex = i;
      const match = numberToken.exec(text);
      if (match) {
        const token = match[0];
        const isInteger = /^-?\d+$/.test(token);
        const digits = token.startsWith("-") ? token.length - 1 : token.length;
        out += isInteger && digits >= 16 ? `"${token}"` : token;
        i += token.length;
        continue;
      }
    }
    out += ch;
    i += 1;
  }
  return out;
}

export function parseResponseBody(text: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(quoteBigIntegers(text));
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

export interface PostReceiptOptions {
  /** Test seam. Defaults to the global fetch. */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export interface PostReceiptResult {
  result: FiscalTransportResult;
  /** SHA-256 (hex) of the exact request body, for fiscal_attempts.request_sha256. */
  requestSha256: string;
}

/**
 * Sends one receipt to the Viva sign endpoint and returns the raw result.
 * A timeout or network error after the request left this server is "unknown", never "not_sent".
 */
export async function postReceipt(
  environment: FiscalEnvironment,
  req: FiscalReceiptRequest,
  getAccessToken: FiscalTokenProvider,
  options: PostReceiptOptions = {},
): Promise<PostReceiptResult> {
  validateReceiptRequest(req);

  const body = stringifyWire(toWire(req));
  const requestSha256 = await sha256Hex(body);

  const url = RECEIPT_SIGN_URL[environment];
  if (!url) {
    return {
      result: { kind: "not_sent", errorKind: "config", message: `unknown environment: ${environment}` },
      requestSha256,
    };
  }

  const doFetch = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS);

  try {
    let token: string;
    try {
      token = await getAccessToken(controller.signal);
    } catch (err) {
      return { result: { kind: "not_sent", errorKind: "auth", message: describe(err) }, requestSha256 };
    }
    if (token.length === 0) {
      return {
        result: { kind: "not_sent", errorKind: "auth", message: "token provider returned an empty token" },
        requestSha256,
      };
    }

    try {
      const response = await doFetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body,
        redirect: "error",
        signal: controller.signal,
      });
      const text = await response.text();
      return {
        result: {
          kind: "response",
          httpStatus: response.status,
          excerpt: text.slice(0, EXCERPT_MAX_CHARS),
          body: parseResponseBody(text),
        },
        requestSha256,
      };
    } catch (err) {
      return {
        result: {
          kind: "unknown",
          errorKind: controller.signal.aborted ? "timeout" : "network",
          message: describe(err),
        },
        requestSha256,
      };
    }
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// ftState and signatures
// ---------------------------------------------------------------------------

export type FtStateClass =
  | { kind: "gr_ready" }
  | { kind: "gr_flags"; flags: bigint }
  | { kind: "literal_zero" }
  | { kind: "error" }
  | { kind: "fail" }
  | { kind: "other" }
  | { kind: "unparseable" };

/** Classifies an ftState using only the layout documented on Viva's Core Concepts page. */
export function classifyFtState(text: string | null): FtStateClass {
  if (text === null || !/^\d{1,20}$/.test(text)) return { kind: "unparseable" };
  const state = BigInt(text);
  if (state === 0n) return { kind: "literal_zero" };
  const flags = state & FT_STATE_FLAGS_MASK;
  if (flags === FT_STATE_FLAGS_ERROR) return { kind: "error" };
  if (flags === FT_STATE_FLAGS_FAIL) return { kind: "fail" };
  if (state >> 32n === FT_STATE_GR_PREFIX) {
    return flags === 0n ? { kind: "gr_ready" } : { kind: "gr_flags", flags };
  }
  return { kind: "other" };
}

export type SignatureLookup =
  | { kind: "found"; value: string }
  | { kind: "missing" }
  | { kind: "ambiguous"; values: string[] };

function findSignatureValue(
  signatures: unknown,
  captions: readonly string[],
  typeValue: string,
  valueRe: RegExp,
): SignatureLookup {
  if (!Array.isArray(signatures)) return { kind: "missing" };
  const values = new Set<string>();
  for (const entry of signatures) {
    if (entry === null || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const matches =
      (typeof e.caption === "string" && captions.includes(e.caption)) ||
      asText(e.ftSignatureType) === typeValue;
    if (!matches) continue;
    const data = asText(e.data);
    if (data !== null && valueRe.test(data)) values.add(data);
  }
  if (values.size === 0) return { kind: "missing" };
  if (values.size === 1) return { kind: "found", value: [...values][0] };
  return { kind: "ambiguous", values: [...values] };
}

/** The AADE MARK. Never falls back to ftReceiptIdentification. */
export function extractMark(signatures: unknown): SignatureLookup {
  return findSignatureValue(signatures, MARK_CAPTIONS, MARK_SIGNATURE_TYPE, MARK_RE);
}

export function extractInvoiceUid(signatures: unknown): SignatureLookup {
  return findSignatureValue(signatures, UID_CAPTIONS, UID_SIGNATURE_TYPE, UID_RE);
}

/** Parses FISCAL_SALE_ACCEPTED_FT_STATES: comma-separated non-negative integers. Empty means none. */
export function parseAcceptedFtStates(raw: string | null | undefined): readonly string[] {
  if (raw === null || raw === undefined || raw.trim() === "") return [];
  const out = new Set<string>();
  for (const part of raw.split(",")) {
    const value = part.trim();
    if (!/^\d{1,20}$/.test(value)) {
      throw new Error(`FISCAL_SALE_ACCEPTED_FT_STATES: "${value}" is not a non-negative integer`);
    }
    out.add(BigInt(value).toString());
  }
  return [...out];
}

// ---------------------------------------------------------------------------
// Interpretation
// ---------------------------------------------------------------------------

/**
 * Interprets a sale sign response. "signed" requires: 2xx, an ftState from the policy that is
 * not an error/fail state, transmissionIndicator 0, a receipt identification and exactly one MARK.
 * Anything else that came back 2xx is "unverified" and must not be retried automatically.
 */
export function interpretSignResult(
  result: FiscalTransportResult,
  policy: SaleSuccessPolicy,
): FiscalSignOutcome {
  if (result.kind === "not_sent") return result;
  if (result.kind === "unknown") {
    return {
      kind: "unknown",
      httpStatus: null,
      errorKind: result.errorKind,
      message: result.message,
      responseExcerpt: "",
    };
  }

  const { httpStatus, excerpt, body } = result;
  if (httpStatus >= 200 && httpStatus < 300) {
    return interpretSuccessStatus(httpStatus, excerpt, body, policy);
  }

  if (excerpt.includes(ERR_INVALID_MERCHANT)) {
    return {
      kind: "not_sent",
      errorKind: "config",
      message: "Fiscalisation is not set up for this merchant, or the merchant id is wrong.",
      httpStatus,
      responseExcerpt: excerpt,
    };
  }
  if (excerpt.includes(ERR_UNKNOWN_STATE)) {
    return {
      kind: "not_sent",
      errorKind: "config",
      message: "The Start Receipt has not been processed for this merchant.",
      httpStatus,
      responseExcerpt: excerpt,
    };
  }
  if (httpStatus === 401 || httpStatus === 403) {
    return {
      kind: "not_sent",
      errorKind: "auth",
      message: `HTTP ${httpStatus}: token rejected or AllowFiscalization role missing.`,
      httpStatus,
      responseExcerpt: excerpt,
    };
  }

  // Other client errors mean the receipt was refused. Timeouts, rate limits and server errors
  // leave the outcome unknown.
  const definitiveRefusal =
    httpStatus >= 400 && httpStatus < 500 && httpStatus !== 408 && httpStatus !== 429;
  if (definitiveRefusal) return { kind: "rejected", httpStatus, responseExcerpt: excerpt };

  return {
    kind: "unknown",
    httpStatus,
    errorKind: "http",
    message: `HTTP ${httpStatus}`,
    responseExcerpt: excerpt,
  };
}

function interpretSuccessStatus(
  httpStatus: number,
  excerpt: string,
  body: Record<string, unknown> | null,
  policy: SaleSuccessPolicy,
): FiscalSignOutcome {
  if (body === null) {
    return {
      kind: "unknown",
      httpStatus,
      errorKind: "parse",
      message: "2xx response body is not a JSON object.",
      responseExcerpt: excerpt,
    };
  }

  const ftState = asText(body.ftState);
  const transmissionIndicator = asText(body.transmissionIndicator);
  const stateClass = classifyFtState(ftState);

  // Documented failure flags: nothing was persisted, so no receipt exists.
  if (stateClass.kind === "error" || stateClass.kind === "fail") {
    return { kind: "rejected", httpStatus, ftState, responseExcerpt: excerpt };
  }

  const unverified = (
    reason: Extract<FiscalSignOutcome, { kind: "unverified" }>["reason"],
    message: string,
  ): FiscalSignOutcome => ({
    kind: "unverified",
    httpStatus,
    ftState,
    transmissionIndicator,
    reason,
    message,
    responseExcerpt: excerpt,
  });

  if (policy.acceptedFtStates.length === 0) {
    return unverified(
      "success_rule_unconfigured",
      "No accepted ftState values are configured, so no sale is treated as signed.",
    );
  }
  if (ftState === null || !policy.acceptedFtStates.includes(ftState)) {
    return unverified("ft_state_not_accepted", `ftState ${ftState ?? "missing"} is not in the accepted list.`);
  }
  if (transmissionIndicator !== "0") {
    return unverified(
      "transmission_not_confirmed",
      `transmissionIndicator is ${transmissionIndicator ?? "missing"}. Viva documents 0 as transmitted to AADE.`,
    );
  }

  const receiptId = body.ftReceiptIdentification;
  if (typeof receiptId !== "string" || receiptId.length === 0) {
    return unverified("identification_missing", "Response has no ftReceiptIdentification.");
  }

  const mark = extractMark(body.ftSignatures);
  if (mark.kind === "missing") return unverified("mark_missing", "No MARK found in ftSignatures.");
  if (mark.kind === "ambiguous") {
    return unverified("mark_ambiguous", "ftSignatures contains more than one distinct MARK.");
  }

  const uid = extractInvoiceUid(body.ftSignatures);
  return {
    kind: "signed",
    httpStatus,
    ftReceiptIdentification: receiptId,
    ftMark: mark.value,
    invoiceUid: uid.kind === "found" ? uid.value : null,
    ftState,
    ftSignatures: body.ftSignatures ?? null,
    transmissionIndicator,
    responseExcerpt: excerpt,
  };
}

export type QueueCheck =
  | { kind: "ready"; ftState: string }
  | { kind: "not_ready"; ftState: string }
  | { kind: "unknown"; message: string };

/**
 * Interprets a Zero Receipt response. This is the queue-health state, a different thing from a
 * sale response. Only the exact documented ready value counts as ready.
 */
export function interpretZeroReceipt(result: FiscalTransportResult): QueueCheck {
  if (result.kind !== "response") return { kind: "unknown", message: result.message };
  if (result.httpStatus < 200 || result.httpStatus >= 300) {
    return { kind: "unknown", message: `HTTP ${result.httpStatus}` };
  }
  const state = asText(result.body?.ftState);
  if (state === null) return { kind: "unknown", message: "Response has no ftState" };
  return classifyFtState(state).kind === "gr_ready"
    ? { kind: "ready", ftState: state }
    : { kind: "not_ready", ftState: state };
}

/** Viva documents this answer for a Start Receipt sent twice. It is harmless. */
export function isQueueAlreadyOperational(excerpt: string): boolean {
  return /already operational/i.test(excerpt);
}

function asText(value: unknown): string | null {
  return typeof value === "string" || typeof value === "number" ? String(value) : null;
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}