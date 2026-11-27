// Shared fiscal types. Provider-neutral. Viva wire details live in viva-fiscal.ts.

export type FiscalEnvironment = "demo" | "live";

export type FiscalReceiptKind = "start" | "zero" | "sale";

export type FiscalDocumentStatus = "pending" | "submitting" | "signed" | "rejected" | "unknown";

export type FiscalErrorKind = "timeout" | "network" | "http" | "parse" | "auth" | "config";

/** One signing attempt, after the provider response has been interpreted. */
export type FiscalSignOutcome =
  | {
      kind: "signed";
      httpStatus: number;
      ftReceiptIdentification: string;
      ftState: string | null;
      ftSignatures: unknown;
      transmissionIndicator: string | null;
      responseExcerpt: string;
    }
  | { kind: "rejected"; httpStatus: number; responseExcerpt: string }
  | {
      /** The request may or may not have been processed. Do not resubmit automatically. */
      kind: "unknown";
      httpStatus: number | null;
      errorKind: FiscalErrorKind;
      message: string;
      responseExcerpt: string;
    }
  | {
      /** The request never left this server. Safe to retry after fixing the cause. */
      kind: "not_sent";
      errorKind: "auth" | "config";
      message: string;
    };

export interface FiscalChargeItem {
  position: number;
  description: string;
  /** Integer quantity, at least 1. */
  quantity: number;
  /** Minor units (cents). Null when the sale has no unit price. */
  unitPrice: bigint | null;
  /** Line total in minor units. */
  amount: bigint;
  /** Sent as an integer. Meaning of the value (percent or category code) is unverified. */
  vatRate: number;
  vatAmount: bigint;
  moment: string;
  ftChargeItemCase: bigint;
  currencyCode: string;
}

export interface FiscalPayItem {
  position: number;
  description: string;
  amount: bigint;
  moment: string;
  ftPayItemCase: bigint;
  currencyCode: string;
  /** Viva transaction id, when the payment came through Viva. */
  transactionId: string | null;
}

/** Greek (GR) fiscal case data. The AA and HashPayload rules are unverified. */
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
  /** UUID. Reuse the same value when retrying the same document. */
  sessionId: string;
  receiptReference: string;
  /** ISO 8601 date-time, UTC. */
  receiptMoment: string;
  ftReceiptCase: bigint;
  /** ISO 4217 numeric code as a string, for example "978" (EUR). */
  currencyCode: string;
  receiptAmount: bigint;
  chargeItems: FiscalChargeItem[];
  payItems: FiscalPayItem[];
  ftReceiptCaseData: GreekReceiptCaseData | null;
}

/**
 * Case codes from the Viva Fiscalisation pages. Only START and ZERO are confirmed by the
 * Start Receipt and Zero Receipt pages. The sale value comes from a sample and must be confirmed.
 */
export const FT_RECEIPT_CASE_GR = {
  START: 5139205309155262465n,
  ZERO: 5139205309155254272n,
  SALE_SAMPLE: 5139205309155770370n,
} as const;

/** ftState that a Zero Receipt returns when the Greek queue is ready. */
export const FT_STATE_GR_QUEUE_READY = 5139205309155246080n;