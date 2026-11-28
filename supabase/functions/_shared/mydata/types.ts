import type { MyDataEnvironment } from "./endpoints.ts";

/** Credentials are tagged with the environment they belong to. The client refuses a mismatch. */
export interface MyDataCredentials {
  readonly environment: MyDataEnvironment;
  readonly userId: string;
  readonly subscriptionKey: string;
}

export interface MyDataParty {
  vatNumber: string;
  /** ISO 3166 two-letter country code. */
  country: string;
  /** Branch number, 0 for the head office. */
  branch: number;
  name?: string;
  address?: { street?: string; number?: string; postalCode: string; city: string };
}

export interface MyDataIncomeClassification {
  /** e.g. E3_561_003. Supplied by the business/accountant, never defaulted here. */
  classificationType?: string;
  /** e.g. category1_3. */
  classificationCategory: string;
  /** Amount in euro cents. */
  amount: bigint;
}

export interface MyDataInvoiceLine {
  lineNumber: number;
  quantity?: number;
  /** Net value in euro cents. */
  netValue: bigint;
  vatCategory: number;
  /** VAT in euro cents. */
  vatAmount: bigint;
  vatExemptionCategory?: number;
  lineComments?: string;
  incomeClassifications: MyDataIncomeClassification[];
}

export interface MyDataPayment {
  /** Payment method type code from the AADE payment-method table, supplied by configuration. */
  type: number;
  /** Euro cents. */
  amount: bigint;
  paymentMethodInfo?: string;
  transactionId?: string;
  providersSignature?: { signingAuthor: string; signature: string };
}

export interface MyDataInvoiceInput {
  issuer: MyDataParty;
  counterpart?: MyDataParty;
  series: string;
  aa: string;
  /** YYYY-MM-DD */
  issueDate: string;
  /** AADE invoice type, e.g. "11.2". */
  invoiceType: string;
  lines: MyDataInvoiceLine[];
  payments: MyDataPayment[];
}

export class MyDataValidationError extends Error {
  readonly problems: readonly string[];
  constructor(problems: readonly string[]) {
    super(`Invalid myDATA invoice: ${problems.join("; ")}`);
    this.name = "MyDataValidationError";
    this.problems = problems;
  }
}

export interface MyDataResponseError {
  code: string;
  message: string;
}

export interface MyDataResponseItem {
  index: number | null;
  statusCode: string;
  invoiceUid: string | null;
  invoiceMark: string | null;
  authenticationCode: string | null;
  cancellationMark: string | null;
  qrUrl: string | null;
  errors: MyDataResponseError[];
}

export interface MyDataTransmittedInvoice {
  uid: string | null;
  mark: string | null;
  cancelledByMark: string | null;
  issuerVatNumber: string | null;
  series: string | null;
  aa: string | null;
  issueDate: string | null;
  invoiceType: string | null;
  totalGrossValue: string | null;
}

/**
 * Outcome of a submission. The kinds drive the retry policy:
 *  transmitted  AADE accepted it and returned a UID and a MARK.
 *  rejected     AADE refused the content (ValidationError, XMLSyntaxError, HTTP 400). Fix the data; never auto-retry.
 *  auth_failed  HTTP 401. Credentials rejected, nothing processed. Fix credentials, then retry.
 *  not_sent     The request never left (configuration problem) or was throttled (HTTP 429). Safe to retry.
 *  technical    TechnicalError in the response body. AADE may or may not have stored it. Reconcile before resending.
 *  unknown      Timeout, network failure or HTTP 5xx. AADE may have processed it. Reconcile before resending.
 *  unverified   HTTP 200 but the body could not be trusted (unparsable, no UID/MARK, unexpected item count).
 */
export type MyDataSubmitOutcome =
  | { kind: "transmitted"; uid: string; mark: string; authenticationCode: string | null; qrUrl: string | null; httpStatus: number; raw: string }
  | { kind: "rejected"; statusCode: string; errors: MyDataResponseError[]; httpStatus: number; raw: string }
  | { kind: "auth_failed"; httpStatus: number; raw: string }
  | { kind: "not_sent"; errorKind: "config" | "rate_limited"; message: string; httpStatus: number | null }
  | { kind: "technical"; errors: MyDataResponseError[]; httpStatus: number; raw: string }
  | { kind: "unknown"; errorKind: "timeout" | "network" | "http"; message: string; httpStatus: number | null }
  | { kind: "unverified"; reason: string; httpStatus: number; raw: string };

export type MyDataCancelOutcome =
  | { kind: "cancelled"; cancellationMark: string; httpStatus: number; raw: string }
  | { kind: "rejected"; statusCode: string; errors: MyDataResponseError[]; httpStatus: number; raw: string }
  | { kind: "auth_failed"; httpStatus: number; raw: string }
  | { kind: "unknown"; message: string; httpStatus: number | null }
  | { kind: "unverified"; reason: string; httpStatus: number; raw: string };
