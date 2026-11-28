// Direct AADE myDATA client. Pure: no database access. fetch is injectable so tests never touch the network.
//
// Authentication (AADE API v2.0.2): headers aade-user-id and ocp-apim-subscription-key.
// ISOLATION: a client is bound to ONE environment. Credentials carry the environment they belong to and
// the constructor refuses a mismatch, so DEMO credentials can never be sent to LIVE or the reverse.

import { assertEnvironment, endpointFor, MyDataConfigError } from "./endpoints.ts";
import type { MyDataEnvironment } from "./endpoints.ts";
import { findTransmitted, interpretCancelResponse, interpretSubmitResponse, parseRequestedInvoices, truncateRaw } from "./response.ts";
import type { MyDataCancelOutcome, MyDataCredentials, MyDataSubmitOutcome, MyDataTransmittedInvoice } from "./types.ts";

export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal }) => Promise<{ status: number; text(): Promise<string> }>;

export interface MyDataClientOptions {
  environment: MyDataEnvironment;
  credentials: MyDataCredentials;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}

export interface SubmitResult {
  outcome: MyDataSubmitOutcome;
  requestSha256: string;
  startedAt: Date;
  finishedAt: Date;
}

export interface ConnectionTestResult {
  ok: boolean;
  kind: "ok" | "auth_failed" | "unreachable" | "inconclusive";
  httpStatus: number | null;
  message: string;
}

export interface MyDataClient {
  readonly environment: MyDataEnvironment;
  sendInvoices(invoicesDocXml: string): Promise<SubmitResult>;
  cancelInvoice(mark: string): Promise<{ outcome: MyDataCancelOutcome; startedAt: Date; finishedAt: Date }>;
  requestTransmittedDocs(params: { mark: string; dateFrom?: string; dateTo?: string; invType?: string }): Promise<{ httpStatus: number; invoices: MyDataTransmittedInvoice[]; raw: string }>;
  reconcile(wanted: { issuerVatNumber: string; series: string; aa: string; issueDate: string }): Promise<MyDataTransmittedInvoice | null>;
  testConnection(): Promise<ConnectionTestResult>;
}

const DEFAULT_TIMEOUT_MS = 30_000;
// Larger than any MARK AADE will have issued. A read-only request using it returns no documents, which
// proves authentication and reachability without creating, changing or exporting anything.
const PROBE_MARK = "9223372036854775806";

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function defaultFetch(): FetchLike {
  return (url, init) => fetch(url, init);
}

export function createMyDataClient(options: MyDataClientOptions): MyDataClient {
  const environment = assertEnvironment(options.environment);
  const creds = options.credentials;
  if (creds.environment !== environment) {
    throw new MyDataConfigError(
      "credential_environment_mismatch",
      `credentials belong to ${creds.environment}, client is ${environment}`,
    );
  }
  if (!creds.userId || !creds.subscriptionKey) {
    throw new MyDataConfigError("credentials_missing", `${environment} credentials are incomplete`);
  }
  const doFetch = options.fetchImpl ?? defaultFetch();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const redact = (text: string): string =>
    text.split(creds.subscriptionKey).join("[redacted]").split(creds.userId).join("[redacted]");

  const headers = (extra: Record<string, string> = {}): Record<string, string> => ({
    "aade-user-id": creds.userId,
    "ocp-apim-subscription-key": creds.subscriptionKey,
    Accept: "application/xml",
    ...extra,
  });

  type Raw =
    | { ok: true; status: number; body: string }
    | { ok: false; errorKind: "timeout" | "network"; message: string };

  async function call(method: string, url: string, body?: string): Promise<Raw> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await doFetch(url, {
        method,
        headers: headers(body !== undefined ? { "Content-Type": "application/xml; charset=UTF-8" } : {}),
        body,
        signal: controller.signal,
      });
      return { ok: true, status: res.status, body: await res.text() };
    } catch (err) {
      const aborted = err instanceof Error && err.name === "AbortError";
      return {
        ok: false,
        errorKind: aborted ? "timeout" : "network",
        message: redact(aborted ? `no response within ${timeoutMs} ms` : err instanceof Error ? err.message : String(err)),
      };
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    environment,

    async sendInvoices(xml) {
      const startedAt = new Date();
      const requestSha256 = await sha256Hex(xml);
      const res = await call("POST", endpointFor(environment, "SendInvoices"), xml);
      const finishedAt = new Date();
      const outcome: MyDataSubmitOutcome = res.ok
        ? interpretSubmitResponse(res.status, res.body)
        : { kind: "unknown", errorKind: res.errorKind, message: res.message, httpStatus: null };
      return { outcome, requestSha256, startedAt, finishedAt };
    },

    async cancelInvoice(mark) {
      if (!/^\d{1,19}$/.test(mark)) throw new MyDataConfigError("invalid_mark", "mark must be digits");
      const startedAt = new Date();
      const res = await call("POST", endpointFor(environment, "CancelInvoice", { mark }), "");
      const finishedAt = new Date();
      const outcome: MyDataCancelOutcome = res.ok
        ? interpretCancelResponse(res.status, res.body)
        : { kind: "unknown", message: res.message, httpStatus: null };
      return { outcome, startedAt, finishedAt };
    },

    async requestTransmittedDocs(params) {
      if (!/^\d{1,19}$/.test(params.mark)) throw new MyDataConfigError("invalid_mark", "mark must be digits");
      const res = await call(
        "GET",
        endpointFor(environment, "RequestTransmittedDocs", {
          mark: params.mark,
          dateFrom: params.dateFrom,
          dateTo: params.dateTo,
          invType: params.invType,
        }),
      );
      if (!res.ok) throw new MyDataConfigError("unreachable", res.message);
      if (res.status < 200 || res.status >= 300) {
        throw new MyDataConfigError("http_error", `RequestTransmittedDocs returned HTTP ${res.status}`);
      }
      return { httpStatus: res.status, invoices: parseRequestedInvoices(res.body), raw: truncateRaw(res.body) };
    },

    async reconcile(wanted) {
      // AADE expects dd/MM/yyyy for date filters. mark=0 asks for everything after mark 0 within the date window.
      const [y, m, d] = wanted.issueDate.split("-");
      const date = `${d}/${m}/${y}`;
      const result = await this.requestTransmittedDocs({ mark: "0", dateFrom: date, dateTo: date });
      return findTransmitted(result.invoices, wanted);
    },

    async testConnection() {
      const res = await call("GET", endpointFor(environment, "RequestTransmittedDocs", { mark: PROBE_MARK }));
      if (!res.ok) return { ok: false, kind: "unreachable", httpStatus: null, message: res.message };
      if (res.status === 401 || res.status === 403) {
        return { ok: false, kind: "auth_failed", httpStatus: res.status, message: "AADE rejected the credentials" };
      }
      if (res.status >= 200 && res.status < 300) {
        return { ok: true, kind: "ok", httpStatus: res.status, message: "Authenticated and reachable" };
      }
      if (res.status >= 500) return { ok: false, kind: "unreachable", httpStatus: res.status, message: `AADE returned HTTP ${res.status}` };
      return { ok: false, kind: "inconclusive", httpStatus: res.status, message: `Unexpected HTTP ${res.status}` };
    },
  };
}
