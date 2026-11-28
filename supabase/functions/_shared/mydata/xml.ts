// Builds the InvoicesDoc XML for SendInvoices.
//
// Sources: AADE myDATA API Documentation v2.0.2 (ERP) field tables, and AADE's published sample XML
// (SampleXML_2.1_taxes_per_invoice.xml), which fixes the namespaces (invoice v1.0 and incomeClassificaton
// v1.0; note AADE's spelling), the element order (issuer, counterpart, invoiceHeader, paymentMethods,
// invoiceDetails, invoiceSummary) and the fact that incomeClassification itself is unprefixed while its
// children are icls:.
//
// NOT VERIFIED against AADE: this file has never been accepted by the AADE DEMO API. The first DEMO
// submission is the real test. Anything the specification does not let this code decide (invoice type,
// VAT category, classification, payment method) is a required input and is never defaulted.

import { MyDataValidationError } from "./types.ts";
import type { MyDataInvoiceInput, MyDataInvoiceLine, MyDataParty } from "./types.ts";

export const INVOICE_NS = "http://www.aade.gr/myDATA/invoice/v1.0";
export const INCOME_CLASSIFICATION_NS = "https://www.aade.gr/myDATA/incomeClassificaton/v1.0";
export const EXPENSES_CLASSIFICATION_NS = "https://www.aade.gr/myDATA/expensesClassificaton/v1.0";

/** Invoice types listed in the AADE specification. Membership only; whether a type is legally right is the accountant's call. */
export const KNOWN_INVOICE_TYPES: readonly string[] = [
  "1.1", "1.2", "1.3", "1.4", "1.5", "1.6",
  "2.1", "2.2", "2.3", "2.4",
  "3.1", "3.2",
  "5.1", "5.2",
  "6.1", "6.2",
  "7.1",
  "8.1", "8.2", "8.4", "8.5",
  "9.3",
  "11.1", "11.2", "11.3", "11.4", "11.5",
  "13.1", "13.2", "13.3", "13.4", "13.30", "13.31",
  "14.1", "14.2", "14.3", "14.4", "14.5", "14.30", "14.31",
  "15.1",
  "16.1",
  "17.1", "17.2", "17.3", "17.4", "17.5", "17.6",
];

const UINT64_MAX = 18446744073709551615n;
// XML 1.0 forbids most C0 control characters.
// deno-lint-ignore no-control-regex
const INVALID_XML_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g;

export function escapeXml(text: string): string {
  return text
    .replace(INVALID_XML_CHARS, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** 1234n cents becomes "12.34". Negative values are rejected. */
export function centsToDecimal(cents: bigint): string {
  if (cents < 0n) throw new RangeError("amount must not be negative");
  return `${cents / 100n}.${(cents % 100n).toString().padStart(2, "0")}`;
}

function isValidDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

export interface BuildOptions {
  /** YYYY-MM-DD "today" in Greece. Injected so tests are deterministic. */
  today: string;
}

export interface InvoiceTotals {
  totalNet: bigint;
  totalVat: bigint;
  totalGross: bigint;
}

export function computeTotals(lines: readonly MyDataInvoiceLine[]): InvoiceTotals {
  let totalNet = 0n;
  let totalVat = 0n;
  for (const line of lines) {
    totalNet += line.netValue;
    totalVat += line.vatAmount;
  }
  return { totalNet, totalVat, totalGross: totalNet + totalVat };
}

function validateParty(party: MyDataParty, label: string, problems: string[], isIssuer: boolean): void {
  if (!/^[0-9A-Za-z]{1,30}$/.test(party.vatNumber)) problems.push(`${label}.vatNumber is invalid`);
  if (party.country === "GR" && isIssuer && !/^\d{9}$/.test(party.vatNumber)) {
    problems.push(`${label}.vatNumber must be 9 digits for a Greek issuer`);
  }
  if (!/^[A-Z]{2}$/.test(party.country)) problems.push(`${label}.country must be a two-letter code`);
  if (!Number.isInteger(party.branch) || party.branch < 0) problems.push(`${label}.branch must be an integer >= 0`);
  // Spec: the name and address of a Greek issuer are not accepted; the name of a Greek counterpart is not accepted.
  if (party.country === "GR" && isIssuer && (party.name !== undefined || party.address !== undefined)) {
    problems.push("issuer name and address must be omitted for a Greek issuer");
  }
  if (party.country === "GR" && !isIssuer && party.name !== undefined) {
    problems.push("counterpart name must be omitted for a Greek counterpart");
  }
}

export function validateInvoiceInput(input: MyDataInvoiceInput, options: BuildOptions): void {
  const problems: string[] = [];

  validateParty(input.issuer, "issuer", problems, true);
  if (input.counterpart) validateParty(input.counterpart, "counterpart", problems, false);

  if (input.series.length < 1 || input.series.length > 50) problems.push("series must be 1-50 characters");
  if (!/^\d{1,20}$/.test(input.aa) || BigInt(input.aa) > UINT64_MAX) problems.push("aa must be a whole number");
  if (!isValidDate(input.issueDate)) problems.push("issueDate must be a real date (YYYY-MM-DD)");
  else if (input.issueDate > options.today) problems.push("issueDate must not be in the future");
  if (!KNOWN_INVOICE_TYPES.includes(input.invoiceType)) problems.push(`invoiceType ${input.invoiceType} is not an AADE invoice type`);

  if (input.lines.length === 0) problems.push("at least one line is required");
  const seen = new Set<number>();
  for (const line of input.lines) {
    if (!Number.isInteger(line.lineNumber) || line.lineNumber < 1) problems.push("lineNumber must be an integer >= 1");
    if (seen.has(line.lineNumber)) problems.push(`duplicate lineNumber ${line.lineNumber}`);
    seen.add(line.lineNumber);
    if (line.netValue < 0n || line.vatAmount < 0n) problems.push(`line ${line.lineNumber}: amounts must not be negative`);
    if (!Number.isInteger(line.vatCategory) || line.vatCategory < 1) problems.push(`line ${line.lineNumber}: vatCategory is required`);
    // Spec: vatExemptionCategory is required when vatCategory is 7 and not allowed otherwise.
    if (line.vatCategory === 7 && line.vatExemptionCategory === undefined) {
      problems.push(`line ${line.lineNumber}: vatExemptionCategory is required when vatCategory is 7`);
    }
    if (line.vatCategory !== 7 && line.vatExemptionCategory !== undefined) {
      problems.push(`line ${line.lineNumber}: vatExemptionCategory is only allowed when vatCategory is 7`);
    }
    if (line.incomeClassifications.length === 0) problems.push(`line ${line.lineNumber}: an income classification is required`);
    for (const c of line.incomeClassifications) {
      if (c.amount < 0n) problems.push(`line ${line.lineNumber}: classification amount must not be negative`);
      if (!/^[A-Za-z0-9_]{1,40}$/.test(c.classificationCategory)) problems.push(`line ${line.lineNumber}: classificationCategory is invalid`);
      if (c.classificationType !== undefined && !/^[A-Za-z0-9_]{1,40}$/.test(c.classificationType)) {
        problems.push(`line ${line.lineNumber}: classificationType is invalid`);
      }
    }
  }

  const totals = computeTotals(input.lines);
  if (input.payments.length === 0) problems.push("at least one payment method is required");
  const paid = input.payments.reduce((sum, p) => sum + p.amount, 0n);
  if (input.payments.length > 0 && paid !== totals.totalGross) problems.push("payment amounts must add up to the gross total");
  for (const p of input.payments) {
    if (!Number.isInteger(p.type) || p.type < 1) problems.push("payment type is required");
    if (p.amount <= 0n) problems.push("payment amount must be positive");
  }

  if (problems.length > 0) throw new MyDataValidationError(problems);
}

function tag(name: string, value: string | number | bigint): string {
  return `<${name}>${escapeXml(String(value))}</${name}>`;
}

function partyXml(name: "issuer" | "counterpart", party: MyDataParty): string {
  let inner = tag("vatNumber", party.vatNumber) + tag("country", party.country) + tag("branch", party.branch);
  if (party.name !== undefined) inner += tag("name", party.name);
  if (party.address) {
    let a = "";
    if (party.address.street !== undefined) a += tag("street", party.address.street);
    if (party.address.number !== undefined) a += tag("number", party.address.number);
    a += tag("postalCode", party.address.postalCode) + tag("city", party.address.city);
    inner += `<address>${a}</address>`;
  }
  return `<${name}>${inner}</${name}>`;
}

function classificationXml(c: { classificationType?: string; classificationCategory: string; amount: bigint }): string {
  const type = c.classificationType !== undefined ? tag("icls:classificationType", c.classificationType) : "";
  // Per AADE's sample XML the wrapper element is in the default (invoice) namespace; only its children are icls:.
  return `<incomeClassification>${type}${tag("icls:classificationCategory", c.classificationCategory)}${tag("icls:amount", centsToDecimal(c.amount))}</incomeClassification>`;
}

/** Aggregates the line classifications for invoiceSummary, one entry per (type, category). */
function summaryClassifications(lines: readonly MyDataInvoiceLine[]): { classificationType?: string; classificationCategory: string; amount: bigint }[] {
  const map = new Map<string, { classificationType?: string; classificationCategory: string; amount: bigint }>();
  for (const line of lines) {
    for (const c of line.incomeClassifications) {
      const key = `${c.classificationType ?? ""}|${c.classificationCategory}`;
      const existing = map.get(key);
      if (existing) existing.amount += c.amount;
      else map.set(key, { classificationType: c.classificationType, classificationCategory: c.classificationCategory, amount: c.amount });
    }
  }
  return [...map.values()];
}

/** Returns the complete InvoicesDoc XML for exactly one invoice. Throws MyDataValidationError when invalid. */
export function buildInvoicesDoc(input: MyDataInvoiceInput, options: BuildOptions): string {
  validateInvoiceInput(input, options);
  const totals = computeTotals(input.lines);

  const payments = input.payments
    .map((p) => {
      let inner = tag("type", p.type) + tag("amount", centsToDecimal(p.amount));
      if (p.paymentMethodInfo !== undefined) inner += tag("paymentMethodInfo", p.paymentMethodInfo);
      if (p.transactionId !== undefined) inner += tag("transactionId", p.transactionId);
      if (p.providersSignature) {
        inner += `<ProvidersSignature>${tag("SigningAuthor", p.providersSignature.signingAuthor)}${tag("Signature", p.providersSignature.signature)}</ProvidersSignature>`;
      }
      return `<paymentMethodDetails>${inner}</paymentMethodDetails>`;
    })
    .join("");

  const header =
    `<invoiceHeader>${tag("series", input.series)}${tag("aa", input.aa)}${tag("issueDate", input.issueDate)}` +
    `${tag("invoiceType", input.invoiceType)}${tag("currency", "EUR")}</invoiceHeader>`;

  const details = input.lines
    .map((line) => {
      let inner = tag("lineNumber", line.lineNumber);
      if (line.quantity !== undefined) inner += tag("quantity", line.quantity);
      inner += tag("netValue", centsToDecimal(line.netValue)) + tag("vatCategory", line.vatCategory) + tag("vatAmount", centsToDecimal(line.vatAmount));
      if (line.vatExemptionCategory !== undefined) inner += tag("vatExemptionCategory", line.vatExemptionCategory);
      if (line.lineComments !== undefined) inner += tag("lineComments", line.lineComments);
      inner += line.incomeClassifications.map(classificationXml).join("");
      return `<invoiceDetails>${inner}</invoiceDetails>`;
    })
    .join("");

  const summary =
    `<invoiceSummary>${tag("totalNetValue", centsToDecimal(totals.totalNet))}${tag("totalVatAmount", centsToDecimal(totals.totalVat))}` +
    `${tag("totalWithheldAmount", "0.00")}${tag("totalFeesAmount", "0.00")}${tag("totalStampDutyAmount", "0.00")}` +
    `${tag("totalOtherTaxesAmount", "0.00")}${tag("totalDeductionsAmount", "0.00")}${tag("totalGrossValue", centsToDecimal(totals.totalGross))}` +
    `${summaryClassifications(input.lines).map(classificationXml).join("")}</invoiceSummary>`;

  const counterpart = input.counterpart ? partyXml("counterpart", input.counterpart) : "";

  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<InvoicesDoc xmlns="${INVOICE_NS}" xmlns:icls="${INCOME_CLASSIFICATION_NS}" xmlns:ecls="${EXPENSES_CLASSIFICATION_NS}">` +
    `<invoice>${partyXml("issuer", input.issuer)}${counterpart}${header}<paymentMethods>${payments}</paymentMethods>` +
    `${details}${summary}</invoice></InvoicesDoc>`
  );
}

/**
 * Splits a VAT-INCLUSIVE gross price into net and VAT. vatRateBp is hundredths of a percent (2400 = 24%).
 * Rounds the VAT half up; net = gross - vat, so net + vat always equals gross exactly.
 * UNVERIFIED accounting decision: whether AURA prices are VAT-inclusive and the rounding rule must be
 * confirmed by the accountant.
 */
export function splitGross(gross: bigint, vatRateBp: number): { net: bigint; vat: bigint } {
  if (gross < 0n) throw new RangeError("gross must not be negative");
  if (!Number.isInteger(vatRateBp) || vatRateBp < 0) throw new RangeError("vatRateBp must be a non-negative integer");
  const rate = BigInt(vatRateBp);
  const denominator = 10000n + rate;
  const vat = (gross * rate + denominator / 2n) / denominator;
  return { net: gross - vat, vat };
}
