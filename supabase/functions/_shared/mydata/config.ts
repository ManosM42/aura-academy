// Runtime configuration and the guards that keep DEMO and LIVE (and Viva sandbox/production) apart.

import { assertEnvironment, MYDATA_BASE_URLS, MyDataConfigError } from "./endpoints.ts";
import type { MyDataEnvironment } from "./endpoints.ts";

export type IssuanceChannel = "none" | "mydata" | "viva_fiscalisation";

export interface MyDataConfigRow {
  active_environment: string;
  live_enabled: boolean;
  issuance_channel: IssuanceChannel;
}

export interface EnvironmentSettingsRow {
  environment: string;
  base_url: string;
  issuer_vat_number: string | null;
  issuer_branch: number;
  issuer_country: string;
  series: string | null;
}

export interface ActiveRuntime {
  environment: MyDataEnvironment;
  issuerVatNumber: string;
  issuerBranch: number;
  issuerCountry: string;
  series: string;
}

/**
 * The environment issuance must use. Refuses unless myDATA is the chosen issuance channel, and refuses LIVE
 * unless the LIVE gate was explicitly opened (the database enforces the same rule independently).
 */
export function selectActiveEnvironment(cfg: MyDataConfigRow): MyDataEnvironment {
  if (cfg.issuance_channel !== "mydata") {
    throw new MyDataConfigError("channel_not_mydata", `issuance channel is "${cfg.issuance_channel}", not mydata`);
  }
  const env = assertEnvironment(cfg.active_environment);
  if (env === "live" && cfg.live_enabled !== true) {
    throw new MyDataConfigError("live_not_enabled", "LIVE is selected but has not been enabled");
  }
  return env;
}

export function resolveRuntime(cfg: MyDataConfigRow, settings: readonly EnvironmentSettingsRow[]): ActiveRuntime {
  const environment = selectActiveEnvironment(cfg);
  const row = settings.find((s) => s.environment === environment);
  if (!row) throw new MyDataConfigError("settings_missing", `no settings row for ${environment}`);
  // Defence against a tampered row: the stored URL must be AADE's official URL for THIS environment.
  if (row.base_url !== MYDATA_BASE_URLS[environment]) {
    throw new MyDataConfigError("endpoint_mismatch", `settings for ${environment} do not use the official ${environment} endpoint`);
  }
  if (!row.issuer_vat_number || !/^\d{9}$/.test(row.issuer_vat_number)) {
    throw new MyDataConfigError("issuer_missing", `${environment} issuer VAT number is not configured`);
  }
  if (!row.series) throw new MyDataConfigError("series_missing", `${environment} series is not configured`);
  return {
    environment,
    issuerVatNumber: row.issuer_vat_number,
    issuerBranch: row.issuer_branch,
    issuerCountry: row.issuer_country,
    series: row.series,
  };
}

/**
 * Viva payment environment and myDATA environment are separate settings, but a document may only be issued when
 * they correspond: a sandbox payment must never create a LIVE fiscal document, and a real (production) payment
 * must never be "fiscalised" against DEMO. A mismatch leaves the payment un-issued so it can be retried after the
 * configuration is corrected.
 */
export function assertPaymentMatchesEnvironment(paymentEnvironment: unknown, active: MyDataEnvironment): void {
  const expected: MyDataEnvironment | null =
    paymentEnvironment === "sandbox" ? "demo" : paymentEnvironment === "production" ? "live" : null;
  if (expected === null) {
    throw new MyDataConfigError("payment_environment_unknown", "the payment has no known Viva environment");
  }
  if (expected !== active) {
    throw new MyDataConfigError(
      "environment_mismatch",
      `a Viva ${String(paymentEnvironment)} payment cannot be issued while myDATA ${active} is active`,
    );
  }
}
