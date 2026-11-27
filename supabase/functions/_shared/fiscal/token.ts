// Fiscal API OAuth token acquisition.
//
// Endpoints and flow are confirmed by Viva's generic OAuth 2.0 page
// (IdentityServer, client_credentials grant, Basic-auth-encoded client id/secret).
// ASSUMPTION, NOT CONFIRMED BY A FISCAL-SPECIFIC PAGE: the same Client ID/Secret
// that Viva flags for fiscalization (the Smart Checkout OAuth client tied to the
// merchant that received AllowFiscalization) is used to request the token consumed
// by the Fiscal "receipts:sign" endpoint. Viva's Fiscalisation ISV page describes
// onboarding only as "send us your Merchant ID and AFM so we enable fiscal flags",
// and does not name a separate Fiscal OAuth client type. If Viva's onboarding
// response says otherwise, only this file needs to change: the rest of the fiscal
// code only depends on FiscalTokenProvider, not on how the token was obtained.

import type { FiscalEnvironment } from "./types.ts";

const TOKEN_URL: Record<FiscalEnvironment, string> = {
  demo: "https://demo-accounts.vivapayments.com/connect/token",
  live: "https://accounts.vivapayments.com/connect/token",
};

const TOKEN_TIMEOUT_MS = 15_000;
// Refresh this many seconds before actual expiry, to absorb clock drift and request latency.
const EXPIRY_SAFETY_MARGIN_S = 60;

export interface FiscalClientCredentials {
  clientId: string;
  clientSecret: string;
}

interface CachedToken {
  accessToken: string;
  expiresAtMs: number;
}

interface TokenResponseBody {
  access_token?: unknown;
  expires_in?: unknown;
  token_type?: unknown;
}

export class FiscalAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FiscalAuthError";
  }
}

/**
 * In-memory cache, one entry per environment. Edge Function instances are short-lived,
 * so this only saves calls within a single warm instance; it is not a durability guarantee.
 */
const cache = new Map<FiscalEnvironment, CachedToken>();

/** Reads VIVA_{SANDBOX|PRODUCTION}_CLIENT_ID / _CLIENT_SECRET, matching viva.ts's naming. */
export function fiscalClientCredentialsFromEnv(
  environment: FiscalEnvironment,
  read: (name: string) => string | undefined,
): FiscalClientCredentials {
  const prefix = environment === "live" ? "VIVA_PRODUCTION" : "VIVA_SANDBOX";
  const clientId = read(`${prefix}_CLIENT_ID`)?.trim() ?? "";
  const clientSecret = read(`${prefix}_CLIENT_SECRET`)?.trim() ?? "";

  if (!clientId || !clientSecret) {
    throw new FiscalAuthError(
      `${prefix}_CLIENT_ID and ${prefix}_CLIENT_SECRET must both be set for the ${environment} fiscal environment`,
    );
  }
  return { clientId, clientSecret };
}

/** Requests (or reuses a cached) Fiscal API bearer token for the given environment. */
export async function getFiscalAccessToken(
  environment: FiscalEnvironment,
  credentials: FiscalClientCredentials,
  signal: AbortSignal,
  now: () => number = Date.now,
): Promise<string> {
  const cached = cache.get(environment);
  if (cached && cached.expiresAtMs > now()) {
    return cached.accessToken;
  }

  const url = TOKEN_URL[environment];
  const basic = encodeBase64(`${credentials.clientId}:${credentials.clientSecret}`);
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal.addEventListener("abort", onAbort);
  const timer = setTimeout(() => controller.abort(), TOKEN_TIMEOUT_MS);

  try {
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${basic}`,
        },
        body: "grant_type=client_credentials",
        signal: controller.signal,
      });
    } catch (err) {
      throw new FiscalAuthError(`Token request failed: ${describe(err)}`);
    }

    const text = await response.text();
    if (!response.ok) {
      throw new FiscalAuthError(`Token endpoint returned HTTP ${response.status}: ${text.slice(0, 300)}`);
    }

    let body: TokenResponseBody;
    try {
      body = JSON.parse(text) as TokenResponseBody;
    } catch {
      throw new FiscalAuthError("Token endpoint returned a non-JSON body");
    }

    if (typeof body.access_token !== "string" || body.access_token.length === 0) {
      throw new FiscalAuthError("Token response has no access_token");
    }
    const expiresIn = typeof body.expires_in === "number" && body.expires_in > 0 ? body.expires_in : 3600;

    const accessToken = body.access_token;
    cache.set(environment, {
      accessToken,
      expiresAtMs: now() + (expiresIn - EXPIRY_SAFETY_MARGIN_S) * 1000,
    });
    return accessToken;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", onAbort);
  }
}

/** Builds a FiscalTokenProvider bound to one environment and one set of credentials. */
export function makeFiscalTokenProvider(
  environment: FiscalEnvironment,
  credentials: FiscalClientCredentials,
): (signal: AbortSignal) => Promise<string> {
  return (signal: AbortSignal) => getFiscalAccessToken(environment, credentials, signal);
}

/** Clears the in-memory cache. Exposed only for tests. */
export function clearFiscalTokenCacheForTests(): void {
  cache.clear();
}

function encodeBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}