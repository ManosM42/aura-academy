// Resolves per-environment fiscal configuration from Supabase secrets.
// Secret names deliberately mirror _shared/viva.ts (VIVA_SANDBOX_*, VIVA_PRODUCTION_*),
// plus a small set of fiscal-only names, so the setup script has one naming scheme to manage.

import type { FiscalEnvironment } from "./types.ts";
import { fiscalClientCredentialsFromEnv, type FiscalClientCredentials } from "./token.ts";

export interface FiscalEnvConfig {
  environment: FiscalEnvironment;
  merchantId: string;
  vatNumber: string;
  credentials: FiscalClientCredentials;
}

export class FiscalConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FiscalConfigError";
  }
}

/**
 * Reads VIVA_ENV to pick demo or live, then the matching merchant id, AFM and OAuth
 * client. Matches the pattern _shared/viva.ts already uses for Smart Checkout.
 */
export function loadFiscalEnvConfig(read: (name: string) => string | undefined): FiscalEnvConfig {
  const vivaEnv = (read("VIVA_ENV")?.trim() ?? "sandbox").toLowerCase();
  const environment: FiscalEnvironment = vivaEnv === "production" ? "live" : "demo";
  const prefix = environment === "live" ? "VIVA_PRODUCTION" : "VIVA_SANDBOX";

  const merchantId = read(`${prefix}_MERCHANT_ID`)?.trim() ?? "";
  const vatNumber = read("FISCAL_MERCHANT_VAT_NUMBER")?.trim() ?? "";

  if (!merchantId) {
    throw new FiscalConfigError(`${prefix}_MERCHANT_ID is not set; required for fiscal document identification`);
  }
  if (!/^\d{9}$/.test(vatNumber)) {
    throw new FiscalConfigError("FISCAL_MERCHANT_VAT_NUMBER must be set to a 9-digit AFM");
  }

  return {
    environment,
    merchantId,
    vatNumber,
    credentials: fiscalClientCredentialsFromEnv(environment, read),
  };
}