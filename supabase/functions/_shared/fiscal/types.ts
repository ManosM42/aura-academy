// Shared fiscal types. Provider-neutral. Viva wire details live in viva-fiscal.ts.

export type FiscalEnvironment = "demo" | "live";
export type FiscalReceiptKind = "start" | "zero" | "sale";
export type FiscalDocumentStatus =
  | "pending"
  | "submitting"
  | "signed"
  | "rejected"
  | "unknown"
  | "unverified";
export type FiscalErrorKind = "timeout" | "network" | "http" | "parse" | "auth" | "config";
export type FiscalAttemptOutcome = "signed" | "rejected" | "unknown" | "not_sent" | "unverified";

/** Why a 2xx response was not accepted as a signed sale. Shown to admins. */
export type FiscalUnverifiedReason =
  | "success_rule_unconfigured"
  | "ft_state_not_accepted"
  | "transmission_not_confirmed"
  | "identification_missing"
  | "mark_missing"
  | "mark_ambiguous";

/** One signing attempt, after the provider response has been interpreted. */
export type FiscalSignOutcome =
  | {
      /** Viva confirmed the signature and the transmission to AADE. */
      kind: "signed";
      httpStatus: number;
      /** Receipt number assigned by Viva. It is NOT the MARK. */
      ftReceiptIdentification: string;
      /** AADE MARK taken from ftSignatures. */
      ftMark: string;
      /** AADE document UID (ftSignatures invoiceUid), when present. */
      invoiceUid: string | null;
      ftState: string;
      ftSignatures: unknown;
      transmissionIndicator: string;
      responseExcerpt: string;
    }
  | {
      /** Viva refused the receipt, or reported an error/fail ftState. No receipt exists. */
      kind: "rejected";
      httpStatus: number;
      ftState?: string | null;
      responseExcerpt: string;
    }
  | {
      /** The request may or may not have been processed. Reconcile before any new session. */
      kind: "unknown";
      httpStatus: number | null;
      errorKind: FiscalErrorKind;
      message: string;
      responseExcerpt: string;
    }
  | {
      /** Viva answered 2xx but the success criteria are not all met. Needs a human. */
      kind: "unverified";
      httpStatus: number;
      ftState: string | null;
      transmissionIndicator: string | null;
      reason: FiscalUnverifiedReason;
      message: string;
      responseExcerpt: string;
    }
  | {
      /** No receipt was created: the request was not sent, or was refused for auth/config reasons. */
      kind: "not_sent";
      errorKind: "auth" | "config";
      message: string;
      httpStatus?: number;
      responseExcerpt?: string;
    };

/** Fields from the Viva cbCustomer object. All optional; which ones are needed is an accountant decision. */
export interface FiscalCustomer {
  customerVATId?: string;
  customerName?: string;
  customerStreet?: string;
  customerZip?: string;
  customerCity?: string;
  customerCountry?: string;
}

export interface FiscalChargeItem {
  position: number;
  description: string;
  /** Hundredths of a unit: 100 means one unit (Viva: "Quantity is multiplied by 100"). */
  quantity: number;
  /** Minor units (cents). Null when not sent. */
  unitPrice: bigint | null;
  /** Line total in minor units (price * quantity). */
  amount: bigint;
  /** Hundredths of a percent in every Viva sample (2400 = 24%). The value is an accountant setting. */
  vatRate: number;
  vatAmount: bigint;
  /** ISO 8601 UTC, for example 2026-07-10T11:28:00Z. */
  moment: string;
  /** Encodes goods/service and the VAT category. An accountant setting per product type. */
  ftChargeItemCase: bigint;
  /** ISO 4217 numeric code as text, for example "978". */
  currencyCode: string;
}

export interface FiscalPayItem {
  position: number;
  description: string;
  amount: bigint;
  moment: string;
  ftPayItemCase: bigint;
  currencyCode: string;
  /** Viva transaction id (UUID) when the payment came through Viva. */
  transactionId: string | null;
}

/** Greek (GR) case data. HashPayload is built by buildHashPayload in viva-fiscal.ts. */
export interface GreekReceiptCaseData {
  GR: {
    MerchantVATID: string;
    Series: string;
    AA: number;
    HashAlg: "sha256";
    HashPayload: string;
  };
}

export interface FiscalReceiptRequest {
  /** UUID v4. Reuse the same value only when resending the identical request. */
  sessionId: string;
  receiptReference: string;
  /** ISO 8601 UTC with a trailing Z. Must match the moment used in HashPayload. */
  receiptMoment: string;
  ftReceiptCase: bigint;
  currencyCode: string;
  receiptAmount: bigint;
  customer: FiscalCustomer | null;
  chargeItems: FiscalChargeItem[];
  payItems: FiscalPayItem[];
  /** Null for Start and Zero receipts. */
  ftReceiptCaseData: GreekReceiptCaseData | null;
}

/** Case codes for the queue operations. Both are given on Viva's Start Receipt page. */
export const FT_RECEIPT_CASE_GR = {
  START: 5139205309155262465n,
  ZERO: 5139205309155254272n,
} as const;

/**
 * Sale case codes that appear on Viva's Samples page. They are a catalogue, not a default.
 * Which one AURA uses (retail receipt or invoice) is decided with the accountant.
 * Note: Viva's Core Concepts page uses 5139205309155246081 for 11.1, which conflicts with the
 * Samples page. Confirm in demo. 5139205309155770370 is payment transfer (8.4), not a sale.
 */
export const GR_DOCUMENTED_SALE_RECEIPT_CASES = {
  RETAIL_RECEIPT_11_1_AND_11_2: 5139205309155770369n,
  INVOICE_1_1_AND_2_1: 5139205309155774466n,
} as const;

/**
 * ftState value for "ready": country and version 0x4752_2000 with all flag bits clear.
 * Documented on Viva's Core Concepts, Start Receipt and Zero Receipt pages.
 */
export const FT_STATE_GR_QUEUE_READY = 5139205309155246080n;