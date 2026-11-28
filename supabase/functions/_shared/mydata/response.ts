// Parsing and interpretation of AADE myDATA responses (ResponseDoc and RequestedDoc).
//
// Spec facts (AADE API v2.0.2): business errors are returned with HTTP 200, so the body is authoritative.
// statusCode is one of Success, ValidationError, TechnicalError, XMLSyntaxError. A resubmission with the
// same identifying data REPLACES the earlier document, so an unclear outcome must be reconciled before
// anything is sent again.

import type {
  MyDataCancelOutcome,
  MyDataResponseError,
  MyDataResponseItem,
  MyDataSubmitOutcome,
  MyDataTransmittedInvoice,
} from "./types.ts";

export const MAX_RAW_RESPONSE = 20000;

export class MyDataParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MyDataParseError";
  }
}

const ENTITIES: Readonly<Record<string, string>> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

export function decodeXml(text: string): string {
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (_m, e: string) => {
    if (e.startsWith("#x")) return String.fromCodePoint(parseInt(e.slice(2), 16));
    if (e.startsWith("#")) return String.fromCodePoint(parseInt(e.slice(1), 10));
    return ENTITIES[e] ?? _m;
  });
}

function blocks(xml: string, name: string): string[] {
  const re = new RegExp(`<(?:[\\w.-]+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w.-]+:)?${name}\\s*>`, "g");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) out.push(m[1]);
  return out;
}

function firstText(xml: string, name: string): string | null {
  const found = blocks(xml, name)[0];
  if (found === undefined) return null;
  const text = decodeXml(found.trim());
  return text === "" ? null : text;
}

export function truncateRaw(raw: string): string {
  return raw.length > MAX_RAW_RESPONSE ? raw.slice(0, MAX_RAW_RESPONSE) : raw;
}

/** Parses a ResponseDoc. Throws MyDataParseError when no <response> element exists. */
export function parseResponseDoc(xml: string): MyDataResponseItem[] {
  const items = blocks(xml, "response");
  if (items.length === 0) throw new MyDataParseError("no <response> element in the body");
  return items.map((block) => {
    const errorsBlock = blocks(block, "errors")[0] ?? "";
    const errors: MyDataResponseError[] = blocks(errorsBlock, "error").map((e) => ({
      code: firstText(e, "code") ?? "",
      message: firstText(e, "message") ?? "",
    }));
    const indexText = firstText(block, "index");
    return {
      index: indexText !== null && /^\d+$/.test(indexText) ? Number(indexText) : null,
      statusCode: firstText(block, "statusCode") ?? "",
      invoiceUid: firstText(block, "invoiceUid"),
      invoiceMark: firstText(block, "invoiceMark"),
      authenticationCode: firstText(block, "authenticationCode"),
      cancellationMark: firstText(block, "cancellationMark"),
      qrUrl: firstText(block, "qrUrl"),
      errors,
    };
  });
}

/** Parses the invoices inside a RequestedDoc (RequestTransmittedDocs / RequestDocs). */
export function parseRequestedInvoices(xml: string): MyDataTransmittedInvoice[] {
  return blocks(xml, "invoice").map((inv) => {
    const issuer = blocks(inv, "issuer")[0] ?? "";
    const header = blocks(inv, "invoiceHeader")[0] ?? "";
    const summary = blocks(inv, "invoiceSummary")[0] ?? "";
    return {
      uid: firstText(inv, "uid"),
      mark: firstText(inv, "mark"),
      cancelledByMark: firstText(inv, "cancelledByMark"),
      issuerVatNumber: firstText(issuer, "vatNumber"),
      series: firstText(header, "series"),
      aa: firstText(header, "aa"),
      issueDate: firstText(header, "issueDate"),
      invoiceType: firstText(header, "invoiceType"),
      totalGrossValue: firstText(summary, "totalGrossValue"),
    };
  });
}

/** Finds our invoice among transmitted ones, for reconciliation after an unclear outcome. */
export function findTransmitted(
  invoices: readonly MyDataTransmittedInvoice[],
  wanted: { issuerVatNumber: string; series: string; aa: string },
): MyDataTransmittedInvoice | null {
  return (
    invoices.find(
      (i) =>
        i.issuerVatNumber === wanted.issuerVatNumber &&
        i.series === wanted.series &&
        i.aa === wanted.aa &&
        i.mark !== null &&
        i.cancelledByMark === null,
    ) ?? null
  );
}

/** Turns an HTTP status and body of a SendInvoices call into one outcome. Never reports success without a UID and a MARK. */
export function interpretSubmitResponse(httpStatus: number, body: string): MyDataSubmitOutcome {
  const raw = truncateRaw(body);

  if (httpStatus === 401 || httpStatus === 403) return { kind: "auth_failed", httpStatus, raw };
  if (httpStatus === 429) {
    return { kind: "not_sent", errorKind: "rate_limited", message: "AADE throttled the request (HTTP 429)", httpStatus };
  }
  if (httpStatus === 408 || httpStatus >= 500) {
    return { kind: "unknown", errorKind: "http", message: `AADE returned HTTP ${httpStatus}`, httpStatus };
  }
  if (httpStatus < 200 || httpStatus >= 300) {
    return { kind: "rejected", statusCode: `HTTP_${httpStatus}`, errors: [], httpStatus, raw };
  }

  let items: MyDataResponseItem[];
  try {
    items = parseResponseDoc(body);
  } catch (err) {
    return { kind: "unverified", reason: `unparsable response: ${(err as Error).message}`, httpStatus, raw };
  }
  if (items.length !== 1) {
    return { kind: "unverified", reason: `expected 1 response item, got ${items.length}`, httpStatus, raw };
  }
  const item = items[0];

  switch (item.statusCode) {
    case "Success":
      if (!item.invoiceUid || !item.invoiceMark) {
        return { kind: "unverified", reason: "Success without invoiceUid and invoiceMark", httpStatus, raw };
      }
      return {
        kind: "transmitted",
        uid: item.invoiceUid,
        mark: item.invoiceMark,
        authenticationCode: item.authenticationCode,
        qrUrl: item.qrUrl,
        httpStatus,
        raw,
      };
    case "ValidationError":
    case "XMLSyntaxError":
      return { kind: "rejected", statusCode: item.statusCode, errors: item.errors, httpStatus, raw };
    case "TechnicalError":
      return { kind: "technical", errors: item.errors, httpStatus, raw };
    default:
      return { kind: "unverified", reason: `unexpected statusCode "${item.statusCode}"`, httpStatus, raw };
  }
}

export function interpretCancelResponse(httpStatus: number, body: string): MyDataCancelOutcome {
  const raw = truncateRaw(body);
  if (httpStatus === 401 || httpStatus === 403) return { kind: "auth_failed", httpStatus, raw };
  if (httpStatus === 408 || httpStatus === 429 || httpStatus >= 500) {
    return { kind: "unknown", message: `AADE returned HTTP ${httpStatus}`, httpStatus };
  }
  if (httpStatus < 200 || httpStatus >= 300) {
    return { kind: "rejected", statusCode: `HTTP_${httpStatus}`, errors: [], httpStatus, raw };
  }
  let items: MyDataResponseItem[];
  try {
    items = parseResponseDoc(body);
  } catch (err) {
    return { kind: "unverified", reason: `unparsable response: ${(err as Error).message}`, httpStatus, raw };
  }
  if (items.length !== 1) return { kind: "unverified", reason: `expected 1 response item, got ${items.length}`, httpStatus, raw };
  const item = items[0];
  if (item.statusCode === "Success") {
    if (!item.cancellationMark) return { kind: "unverified", reason: "Success without cancellationMark", httpStatus, raw };
    return { kind: "cancelled", cancellationMark: item.cancellationMark, httpStatus, raw };
  }
  if (item.statusCode === "ValidationError" || item.statusCode === "XMLSyntaxError") {
    return { kind: "rejected", statusCode: item.statusCode, errors: item.errors, httpStatus, raw };
  }
  if (item.statusCode === "TechnicalError") return { kind: "unknown", message: "TechnicalError from AADE", httpStatus };
  return { kind: "unverified", reason: `unexpected statusCode "${item.statusCode}"`, httpStatus, raw };
}
