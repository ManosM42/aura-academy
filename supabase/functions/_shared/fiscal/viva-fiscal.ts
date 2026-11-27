// Viva Fiscalisation adapter (merchant endpoint, card-not-present sales).
// Endpoint and request fields come from the Viva "Fiscalisation for card-not-present Sales" page.
// Token acquisition is NOT implemented: see notVerifiedTokenProvider.

import {
  FT_STATE_GR_QUEUE_READY,
  type FiscalEnvironment,
  type FiscalReceiptRequest,
  type FiscalSignOutcome,
} from "./types.ts";

const RECEIPT_SIGN_URL: Record<FiscalEnvironment, string> = {
  demo: "https://demo-api.vivapayments.com/fiscalization/v1/receipts:sign",
  live: "https://api.vivapayments.com/fiscalization/v1/receipts:sign",
};

const REQUEST_TIMEOUT_MS = 20_000;
const EXCERPT_MAX_CHARS = 4_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BIG_MARK = "@@bigint:";

/** Returns a Bearer token for the Fiscal API. Must be injected by the caller. */
export type FiscalTokenProvider = (signal: AbortSignal) => Promise<string>;

/** Placeholder until Viva confirms the Fiscal OAuth token endpoint and client credentials. */
export const notVerifiedTokenProvider: FiscalTokenProvider = async () => {
  throw new Error(
    "Fiscal API token acquisition is not implemented. Viva has not confirmed the token endpoint or the Fiscal client credentials.",
  );
};

export class FiscalValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FiscalValidationError";
  }
}

/** Raw result of one HTTP call. Interpreted by the functions below. */
export type FiscalTransportResult =
  | {
      kind: "response";
      httpStatus: number;
      excerpt: string;
      body: Record<string, unknown> | null;
    }
  | { kind: "unknown"; errorKind: "timeout" | "network"; message: string }
  | { kind: "not_sent"; errorKind: "auth" | "config"; message: string };

/** Throws FiscalValidationError before any network call when the request is malformed. */
export function validateReceiptRequest(req: FiscalReceiptRequest): void {
  const fail = (message: string): never => {
    throw new FiscalValidationError(message);
  };

  if (!UUID_RE.test(req.sessionId)) fail("sessionId must be a UUID");
  if (req.receiptReference.length < 1 || req.receiptReference.length > 100) {
    fail("receiptReference must be 1 to 100 characters");
  }
  if (Number.isNaN(Date.parse(req.receiptMoment))) fail("receiptMoment must be an ISO date-time");
  if (!/^\d{3}$/.test(req.currencyCode)) fail("currencyCode must be a 3-digit numeric code");
  if (req.receiptAmount < 0n) fail("receiptAmount cannot be negative");

  for (const item of req.chargeItems) {
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1) {
      fail(`charge item ${item.position}: quantity must be an integer of at least 1`);
    }
    if (item.amount < 0n) fail(`charge item ${item.position}: amount cannot be negative`);
  }

  // Internal invariant, matching the sample: charges and payments both equal the receipt total.
  const chargeTotal = req.chargeItems.reduce((sum, item) => sum + item.amount, 0n);
  const payTotal = req.payItems.reduce((sum, item) => sum + item.amount, 0n);
  if (chargeTotal !== req.receiptAmount || payTotal !== req.receiptAmount) {
    fail("charge items, pay items and receiptAmount must add up to the same total");
  }

  if (req.ftReceiptCaseData) {
    const aa = req.ftReceiptCaseData.GR.AA;
    if (!Number.isSafeInteger(aa) || aa < 1) fail("GR.AA must be a positive integer");
  }
}

// JSON cannot carry bigint. Marked values are written back as bare integers, so digits stay exact.
function stringifyWire(value: unknown): string {
  const text = JSON.stringify(value, (_key, v: unknown) =>
    typeof v === "bigint" ? `${BIG_MARK}${v.toString()}` : v,
  );
  return text.replace(/"@@bigint:(-?\d+)"/g, "$1");
}

// Integers of 16+ digits lose precision as JS numbers. Quote them so they arrive as exact strings.
function parseResponseBody(text: string): Record<string, unknown> | null {
  const quoted = text.replace(/([:\[,]\s*)(-?\d{16,})(?=\s*[,\]}])/g, '$1"$2"');
  try {
    const parsed: unknown = JSON.parse(quoted);
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function toWire(req: FiscalReceiptRequest): Record<string, unknown> {
  return {
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
}

/**
 * Sends one receipt to the Viva Fiscal endpoint. Returns the raw result.
 * The caller must store the request hash and the result before acting on it.
 */
export async function postReceipt(
  environment: FiscalEnvironment,
  req: FiscalReceiptRequest,
  getAccessToken: FiscalTokenProvider,
): Promise<{ result: FiscalTransportResult; bodySha256Input: string }> {
  validateReceiptRequest(req);

  const url = RECEIPT_SIGN_URL[environment];
  if (!url) {
    return {
      result: { kind: "not_sent", errorKind: "config", message: `unknown environment: ${environment}` },
      bodySha256Input: "",
    };
  }

  const body = stringifyWire(toWire(req));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    let token: string;
    try {
      token = await getAccessToken(controller.signal);
    } catch (err) {
      return {
        result: { kind: "not_sent", errorKind: "auth", message: describe(err) },
        bodySha256Input: body,
      };
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body,
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
        bodySha256Input: body,
      };
    } catch (err) {
      return {
        result: {
          kind: "unknown",
          errorKind: controller.signal.aborted ? "timeout" : "network",
          message: describe(err),
        },
        bodySha256Input: body,
      };
    }
  } finally {
    clearTimeout(timer);
  }
}

/** Interprets a Start Receipt or sale response. */
export function interpretSignResult(result: FiscalTransportResult): FiscalSignOutcome {
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
    const id = body?.ftReceiptIdentification;
    if (typeof id === "string" && id.length > 0) {
      return {
        kind: "signed",
        httpStatus,
        ftReceiptIdentification: id,
        ftState: asText(body?.ftState),
        ftSignatures: body?.ftSignatures ?? null,
        transmissionIndicator: asText(body?.transmissionIndicator),
        responseExcerpt: excerpt,
      };
    }
    return {
      kind: "unknown",
      httpStatus,
      errorKind: "parse",
      message: "Success response without ftReceiptIdentification. Confirm the success rule with Viva.",
      responseExcerpt: excerpt,
    };
  }

  // Client errors mean the receipt was refused. Timeouts, rate limits and server errors are unknown.
  const isDefinitiveRefusal =
    httpStatus >= 400 && httpStatus < 500 && httpStatus !== 408 && httpStatus !== 429;
  if (isDefinitiveRefusal) {
    return { kind: "rejected", httpStatus, responseExcerpt: excerpt };
  }
  return {
    kind: "unknown",
    httpStatus,
    errorKind: "http",
    message: `HTTP ${httpStatus}`,
    responseExcerpt: excerpt,
  };
}

export type QueueCheck =
  | { kind: "ready"; ftState: string }
  | { kind: "not_ready"; ftState: string | null }
  | { kind: "unknown"; message: string };

/** Interprets a Zero Receipt response. Ready means ftState equals the documented ready value. */
export function interpretZeroReceipt(result: FiscalTransportResult): QueueCheck {
  if (result.kind !== "response") return { kind: "unknown", message: result.message };
  if (result.httpStatus < 200 || result.httpStatus >= 300) {
    return { kind: "unknown", message: `HTTP ${result.httpStatus}` };
  }
  const state = asText(result.body?.ftState);
  if (state === null) return { kind: "unknown", message: "Response has no ftState" };
  return state === FT_STATE_GR_QUEUE_READY.toString()
    ? { kind: "ready", ftState: state }
    : { kind: "not_ready", ftState: state };
}

function asText(value: unknown): string | null {
  return typeof value === "string" || typeof value === "number" ? String(value) : null;
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}