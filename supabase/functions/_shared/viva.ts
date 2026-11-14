// supabase/functions/_shared/viva.ts
//
// Thin, provider-isolated client for Viva.com (Smart Checkout). No Supabase
// code in here, so it can be unit-tested and replaced independently.
//
// Environments are completely separate: pick ONE with VIVA_ENV and only the
// secrets of that environment are ever read.
//
//   VIVA_ENV                      sandbox | production      (required)
//   VIVA_SANDBOX_CLIENT_ID        Smart Checkout client id        (demo)
//   VIVA_SANDBOX_CLIENT_SECRET    Smart Checkout client secret    (demo)
//   VIVA_SANDBOX_SOURCE_CODE      payment source code             (demo)
//   VIVA_SANDBOX_WEBHOOK_KEY      verification key for the webhook (demo, Stage 3)
//   VIVA_PRODUCTION_CLIENT_ID / _CLIENT_SECRET / _SOURCE_CODE / _WEBHOOK_KEY   (live)
//
// Endpoints below are the ones documented at developer.viva.com:
//   token    POST {accounts}/connect/token         (OAuth2 client credentials)
//   order    POST {api}/checkout/v2/orders         (amount in cents)
//   redirect {checkout}?ref={orderCode}

export type VivaEnv = "sandbox" | "production";

export interface VivaConfig {
  env: VivaEnv;
  clientId: string;
  clientSecret: string;
  sourceCode: string;
  /** Only needed by the webhook endpoint (answers Viva's verification request). */
  webhookKey: string | null;
  apiBase: string;
  accountsBase: string;
  checkoutBase: string;
}

const URLS: Record<VivaEnv, { apiBase: string; accountsBase: string; checkoutBase: string }> = {
  sandbox: {
    apiBase: "https://demo-api.vivapayments.com",
    accountsBase: "https://demo-accounts.vivapayments.com",
    checkoutBase: "https://demo.vivapayments.com/web/checkout",
  },
  production: {
    apiBase: "https://api.vivapayments.com",
    accountsBase: "https://accounts.vivapayments.com",
    checkoutBase: "https://www.vivapayments.com/web/checkout",
  },
};

/** Hosts the browser is allowed to be redirected to (checked again in the frontend). */
export const VIVA_CHECKOUT_PREFIXES = [URLS.sandbox.checkoutBase, URLS.production.checkoutBase];

export class VivaConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VivaConfigError";
  }
}

export class VivaApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "VivaApiError";
    this.status = status;
  }
}

/** Reads ONLY the selected environment's secrets. Throws if anything is missing. */
export function loadVivaConfig(getEnv: (name: string) => string | undefined): VivaConfig {
  const env = getEnv("VIVA_ENV");
  if (env !== "sandbox" && env !== "production") {
    throw new VivaConfigError("VIVA_ENV must be 'sandbox' or 'production'");
  }
  const prefix = env === "sandbox" ? "VIVA_SANDBOX_" : "VIVA_PRODUCTION_";
  const clientId = getEnv(`${prefix}CLIENT_ID`);
  const clientSecret = getEnv(`${prefix}CLIENT_SECRET`);
  const sourceCode = getEnv(`${prefix}SOURCE_CODE`);
  const missing = [
    !clientId && `${prefix}CLIENT_ID`,
    !clientSecret && `${prefix}CLIENT_SECRET`,
    !sourceCode && `${prefix}SOURCE_CODE`,
  ].filter(Boolean);
  if (missing.length > 0 || !clientId || !clientSecret || !sourceCode) {
    throw new VivaConfigError(`Missing Viva secrets: ${missing.join(", ")}`);
  }
  const webhookKey = getEnv(`${prefix}WEBHOOK_KEY`) || null;
  return { env, clientId, clientSecret, sourceCode, webhookKey, ...URLS[env] };
}

type FetchFn = typeof fetch;

async function timedFetch(fetchFn: FetchFn, url: string, init: RequestInit, ms = 15000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetchFn(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Never put secrets in logs: this keeps only a short, trimmed slice of the body. */
function shortBody(text: string): string {
  return text.replace(/\s+/g, " ").slice(0, 300);
}

/* ---------------------------- OAuth2 token ---------------------------- */

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

export async function getAccessToken(cfg: VivaConfig, fetchFn: FetchFn = fetch): Promise<string> {
  const cacheKey = `${cfg.env}:${cfg.clientId}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 30_000) return cached.token;

  const basic = btoa(`${cfg.clientId}:${cfg.clientSecret}`);
  const res = await timedFetch(fetchFn, `${cfg.accountsBase}/connect/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const text = await res.text();
  if (!res.ok) throw new VivaApiError(`token request failed: ${shortBody(text)}`, res.status);

  let parsed: { access_token?: unknown; expires_in?: unknown };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new VivaApiError("token response was not JSON", 502);
  }
  if (typeof parsed.access_token !== "string" || parsed.access_token.length === 0) {
    throw new VivaApiError("token response had no access_token", 502);
  }
  const ttl = typeof parsed.expires_in === "number" && parsed.expires_in > 0 ? parsed.expires_in : 300;
  tokenCache.set(cacheKey, { token: parsed.access_token, expiresAt: Date.now() + ttl * 1000 });
  return parsed.access_token;
}

/** Test helper. */
export function clearVivaTokenCache(): void {
  tokenCache.clear();
}

/* ------------------------------ Orders ------------------------------- */

export interface CreateOrderInput {
  /** Amount in CENTS (integer). Always computed on the server from public.plans. */
  amountCents: number;
  /** Our billing_orders.id: how a payment is matched back to what we decided. */
  merchantTrns: string;
  /** Shown to the customer on Viva's page. */
  customerTrns: string;
  customer: { email: string; fullName?: string | null; requestLang?: string };
  /** First payment of a subscription: asks for consent to later merchant-initiated charges. */
  allowRecurring: boolean;
  paymentTimeoutSeconds?: number;
  tags?: string[];
}

export async function createPaymentOrder(
  cfg: VivaConfig,
  input: CreateOrderInput,
  fetchFn: FetchFn = fetch,
): Promise<{ orderCode: string }> {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw new VivaApiError("amountCents must be a positive integer", 400);
  }

  const token = await getAccessToken(cfg, fetchFn);

  const body = {
    amount: input.amountCents,
    customerTrns: input.customerTrns,
    customer: {
      email: input.customer.email,
      ...(input.customer.fullName ? { fullName: input.customer.fullName } : {}),
      requestLang: input.customer.requestLang ?? "el-GR",
    },
    paymentTimeout: input.paymentTimeoutSeconds ?? 1800,
    allowRecurring: input.allowRecurring,
    sourceCode: cfg.sourceCode,
    merchantTrns: input.merchantTrns,
    ...(input.tags && input.tags.length > 0 ? { tags: input.tags } : {}),
  };

  const res = await timedFetch(fetchFn, `${cfg.apiBase}/checkout/v2/orders`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) throw new VivaApiError(`create order failed: ${shortBody(text)}`, res.status);

  // The order code is a 16-digit integer. Read it from the raw text so it can
  // never lose precision by passing through a JavaScript number.
  const match = /"orderCode"\s*:\s*"?(\d{6,20})"?/.exec(text);
  if (!match || !match[1]) throw new VivaApiError("create order: no orderCode in response", 502);
  return { orderCode: match[1] };
}

/** Where the customer pays. Smart Checkout must be a full redirect, never an iframe. */
export function checkoutRedirectUrl(cfg: VivaConfig, orderCode: string): string {
  if (!/^\d{6,20}$/.test(orderCode)) throw new VivaApiError("invalid order code", 400);
  return `${cfg.checkoutBase}?ref=${orderCode}`;
}

/* --------------------------- Retrieve transaction --------------------------- */

export interface VivaTransaction {
  transactionId: string;
  /** 'F' = finished/successful. Other letters are not final (see Viva response codes). */
  statusId: string;
  orderCode: string;
  /** Viva returns the amount in EUROS (e.g. 49.99). Converted here to cents. */
  amountCents: number;
  currencyCode: string | null;
  merchantTrns: string | null;
  recurringSupport: boolean;
  insDate: string | null;
}

const TRANSACTION_ID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export function isTransactionId(value: unknown): value is string {
  return typeof value === "string" && TRANSACTION_ID_RE.test(value);
}

/**
 * Asks Viva for the truth about a transaction (GET /checkout/v2/transactions/{id}).
 * A webhook body is only a hint: nothing is believed until Viva confirms it here.
 * Throws VivaApiError (status 404 = Viva has no such transaction).
 */
export async function retrieveTransaction(
  cfg: VivaConfig,
  transactionId: string,
  fetchFn: FetchFn = fetch,
): Promise<VivaTransaction> {
  if (!isTransactionId(transactionId)) throw new VivaApiError("invalid transaction id", 400);
  transactionId = transactionId.toLowerCase();

  const token = await getAccessToken(cfg, fetchFn);
  const res = await timedFetch(fetchFn, `${cfg.apiBase}/checkout/v2/transactions/${transactionId}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  if (!res.ok) throw new VivaApiError(`retrieve transaction failed: ${shortBody(text)}`, res.status);

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new VivaApiError("retrieve transaction: response was not JSON", 502);
  }

  const orderMatch = /"orderCode"\s*:\s*"?(\d{6,20})"?/.exec(text);
  const amount = Number(parsed.amount);
  if (!orderMatch || !orderMatch[1] || typeof parsed.statusId !== "string" || !Number.isFinite(amount)) {
    throw new VivaApiError("retrieve transaction: unexpected response shape", 502);
  }

  // Euros with at most 2 decimals. Anything else is not a real amount: refuse
  // it instead of rounding it into something that might match.
  const cents = Math.round(amount * 100);
  if (Math.abs(amount * 100 - cents) > 0.0001) {
    throw new VivaApiError("retrieve transaction: amount has fractional cents", 502);
  }

  return {
    transactionId,
    statusId: parsed.statusId,
    orderCode: orderMatch[1],
    amountCents: cents,
    currencyCode: parsed.currencyCode == null ? null : String(parsed.currencyCode),
    merchantTrns: typeof parsed.merchantTrns === "string" ? parsed.merchantTrns : null,
    recurringSupport: parsed.recurringSupport === true,
    insDate: typeof parsed.insDate === "string" ? parsed.insDate : null,
  };
}

/* ------------------------- Webhook source addresses ------------------------- */

// Published by Viva (developer.viva.com/webhooks-for-payments). Used as an
// extra layer only; the real protection is retrieveTransaction() above.
const WEBHOOK_SOURCES: Record<VivaEnv, string[]> = {
  production: [
    "51.138.37.238", "40.127.253.112/28", "51.105.129.192/28",
    "20.54.89.16", "4.223.76.50", "51.12.157.0/28",
  ],
  sandbox: [
    "20.50.240.57", "40.74.20.78", "195.167.87.181",
    "195.167.87.180", "20.13.195.185", "135.225.16.50",
  ],
};

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    n = n * 256 + octet;
  }
  return n;
}

/** True if `ip` (IPv4) is one of the addresses Viva publishes for that environment. */
export function isVivaWebhookIp(ip: string | null | undefined, env: VivaEnv): boolean {
  if (!ip) return false;
  const addr = ipv4ToInt(ip.trim());
  if (addr === null) return false;
  for (const entry of WEBHOOK_SOURCES[env]) {
    const [base, bitsText] = entry.split("/");
    const baseInt = ipv4ToInt(base ?? "");
    if (baseInt === null) continue;
    const bits = bitsText === undefined ? 32 : Number(bitsText);
    const size = 2 ** (32 - bits);
    if (Math.floor(addr / size) === Math.floor(baseInt / size)) return true;
  }
  return false;
}
