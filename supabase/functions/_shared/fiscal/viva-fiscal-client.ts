// supabase/functions/_shared/fiscal/viva-fiscal-client.ts
// Client for Viva Fiscalisation, Greece, card-not-present sales (Merchant endpoint).
// Verified against developer.viva.com: POST /fiscalization/v1/receipts:sign,
// OAuth2 client_credentials via /connect/token.
// The meaning of ftState is NOT verified here, so this module reports HTTP
// outcomes only. The caller decides what counts as issued.

export type VivaFiscalEnv = "demo" | "production";

export type VivaFiscalConfig = {
  env: VivaFiscalEnv;
  clientId: string;
  clientSecret: string;
  timeoutMs: number;
};

const HOSTS: Record<VivaFiscalEnv, { api: string; accounts: string }> = {
  demo: {
    api: "https://demo-api.vivapayments.com",
    accounts: "https://demo-accounts.vivapayments.com",
  },
  production: {
    api: "https://api.vivapayments.com",
    accounts: "https://accounts.vivapayments.com",
  },
};

const DEFAULT_TIMEOUT_MS = 20_000;
const TOKEN_REFRESH_MARGIN_S = 60;

export class VivaFiscalConfigError extends Error {}

export class VivaFiscalAuthError extends Error {
  constructor(readonly status: number) {
    super(`Viva token request failed with HTTP ${status}`);
    this.name = "VivaFiscalAuthError";
  }
}

/** Reads and validates configuration. Requires an explicit VIVA_FISCAL_ENV. */
export function loadVivaFiscalConfig(
  getEnv: (name: string) => string | undefined,
): VivaFiscalConfig {
  const env = getEnv("VIVA_FISCAL_ENV");
  if (env !== "demo" && env !== "production") {
    throw new VivaFiscalConfigError(
      "VIVA_FISCAL_ENV must be 'demo' or 'production'",
    );
  }
  const clientId = getEnv("VIVA_FISCAL_CLIENT_ID")?.trim();
  const clientSecret = getEnv("VIVA_FISCAL_CLIENT_SECRET")?.trim();
  if (!clientId || !clientSecret) {
    throw new VivaFiscalConfigError(
      "VIVA_FISCAL_CLIENT_ID and VIVA_FISCAL_CLIENT_SECRET are required",
    );
  }
  const rawTimeout = getEnv("VIVA_FISCAL_TIMEOUT_MS");
  const parsedTimeout = rawTimeout ? Number(rawTimeout) : DEFAULT_TIMEOUT_MS;
  const timeoutMs =
    Number.isFinite(parsedTimeout) && parsedTimeout > 0
      ? parsedTimeout
      : DEFAULT_TIMEOUT_MS;
  return { env, clientId, clientSecret, timeoutMs };
}

/**
 * Outcome of one sign call.
 * - http_ok: HTTP 2xx. The body is returned as-is. The caller must check the
 *   documented success fields before treating the receipt as issued.
 * - rejected: a 4xx that means Viva did not sign the receipt. Safe to retry
 *   only after the caller fixes the cause.
 * - unknown: a timeout, network error, 5xx, 408 or 429. Viva may or may not
 *   have signed the receipt, so the caller must reconcile before retrying.
 * - not_sent: the token could not be obtained, so the receipt was never sent.
 */
export type SignOutcome =
  | { kind: "http_ok"; status: number; body: unknown }
  | { kind: "rejected"; status: number; body: unknown }
  | {
      kind: "unknown";
      reason: "timeout" | "network" | "server_error" | "retryable_status";
      status?: number;
      detail: string;
    }
  | { kind: "not_sent"; reason: "auth_failed"; status: number };

type CachedToken = { key: string; token: string; expiresAtMs: number };
let tokenCache: CachedToken | null = null;

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Returns a bearer token, reusing the cached one until shortly before expiry. */
export async function getVivaAccessToken(
  config: VivaFiscalConfig,
): Promise<string> {
  const key = `${config.env}:${config.clientId}`;
  const now = Date.now();
  if (tokenCache && tokenCache.key === key && tokenCache.expiresAtMs > now) {
    return tokenCache.token;
  }

  const basic = btoa(`${config.clientId}:${config.clientSecret}`);
  const res = await fetchWithTimeout(
    `${HOSTS[config.env].accounts}/connect/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basic}`,
      },
      body: new URLSearchParams({ grant_type: "client_credentials" }),
    },
    config.timeoutMs,
  );

  if (!res.ok) {
    throw new VivaFiscalAuthError(res.status);
  }

  const json: unknown = await res.json();
  if (
    !isRecord(json) ||
    typeof json.access_token !== "string" ||
    typeof json.expires_in !== "number"
  ) {
    throw new VivaFiscalAuthError(res.status);
  }

  const lifetimeS = Math.max(json.expires_in - TOKEN_REFRESH_MARGIN_S, 0);
  tokenCache = {
    key,
    token: json.access_token,
    expiresAtMs: now + lifetimeS * 1000,
  };
  return json.access_token;
}

/**
 * Sends one receipt to Viva's sign endpoint.
 * `bodyJson` must already be serialized JSON. Build it in the caller so that
 * int64 values (case codes, receipt amounts) keep their exact digits.
 * Pass a fixed idempotency sessionId in the body, so a retry of an unknown
 * outcome is not a new receipt.
 */
export async function signReceiptWithViva(
  config: VivaFiscalConfig,
  bodyJson: string,
): Promise<SignOutcome> {
  let token: string;
  try {
    token = await getVivaAccessToken(config);
  } catch (err) {
    const status = err instanceof VivaFiscalAuthError ? err.status : 0;
    return { kind: "not_sent", reason: "auth_failed", status };
  }

  const url = `${HOSTS[config.env].api}/fiscalization/v1/receipts:sign`;
  let res: Response;
  try {
    res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: bodyJson,
      },
      config.timeoutMs,
    );
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      kind: "unknown",
      reason: aborted ? "timeout" : "network",
      detail: err instanceof Error ? err.message : String(err),
    };
  }

  const text = await res.text();
  let body: unknown = text;
  try {
    body = text.length > 0 ? JSON.parse(text) : null;
  } catch {
    // Keep the raw text. The caller stores it for diagnosis.
  }

  if (res.ok) {
    return { kind: "http_ok", status: res.status, body };
  }
  if (res.status >= 500) {
    return {
      kind: "unknown",
      reason: "server_error",
      status: res.status,
      detail: text.slice(0, 2000),
    };
  }
  if (res.status === 408 || res.status === 429) {
    return {
      kind: "unknown",
      reason: "retryable_status",
      status: res.status,
      detail: text.slice(0, 2000),
    };
  }
  return { kind: "rejected", status: res.status, body };
}