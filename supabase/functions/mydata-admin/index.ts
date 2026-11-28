// ADMIN ONLY. Central control for the direct AADE myDATA integration.
//
// Actions (POST { action, ... }):
//   status                 non-secret snapshot: config, per-environment settings, credential status, rules, counts
//   set_credentials        { environment, user_id, subscription_key }  stored in Supabase Vault, never echoed back
//   clear_credentials      { environment }
//   save_settings          { environment, issuer_vat_number, issuer_branch, series }
//   save_rule              { environment, scenario, invoice_type, vat_category, vat_exemption_category?, vat_rate_bp,
//                            income_classification_type?, income_classification_category, payment_method_type, notes? }
//   confirm_rule           { environment, scenario }   records that the accountant confirmed the rule
//   test_connection        { environment }             read-only call to AADE; creates and sends no document
//   set_issuance_channel   { channel }                 none | mydata | viva_fiscalisation (one authoritative channel)
//   enable_live            { confirm: "ENABLE LIVE" }  opens the LIVE gate when every prerequisite holds
//   disable_live           {}
//   set_environment        { environment, confirm? }   confirm must be "SWITCH TO LIVE" for live
//
// Authorization: requireFiscalAdmin() verifies the caller's JWT and public.fiscal_is_admin(). Every state change is one
// SQL RPC that re-checks the actor against public.fiscal_admins and writes mydata_audit_log in the same transaction.
// The service-role client never leaves this function. Secret values are never returned or logged.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireFiscalAdmin, fiscalCors, FiscalAdminAuthError } from "../_shared/fiscal/auth.ts";
import { errorResponse, HttpError, jsonResponse, logEvent, readJsonObject } from "../_shared/fiscal/util.ts";
import { createMyDataClient } from "../_shared/mydata/client.ts";
import { loadCredentials } from "../_shared/mydata/credentials.ts";
import { assertEnvironment, MyDataConfigError } from "../_shared/mydata/endpoints.ts";
import type { MyDataEnvironment } from "../_shared/mydata/endpoints.ts";

const ACTIONS = [
  "status", "set_credentials", "clear_credentials", "save_settings", "save_rule", "confirm_rule",
  "test_connection", "set_issuance_channel", "enable_live", "disable_live", "set_environment",
] as const;
type Action = (typeof ACTIONS)[number];

const SCENARIOS = ["SUBSCRIPTION", "RENEWAL", "UPGRADE", "BOOK", "SEMINAR"] as const;
const CHANNELS = ["none", "mydata", "viva_fiscalisation"] as const;
const CONFIRM_ENABLE_LIVE = "ENABLE LIVE";
const CONFIRM_SWITCH_LIVE = "SWITCH TO LIVE";

function env(body: Record<string, unknown>): MyDataEnvironment {
  try {
    return assertEnvironment(body.environment);
  } catch {
    throw new HttpError(400, "validation", "environment must be demo or live");
  }
}

function secretText(body: Record<string, unknown>, key: string): string {
  const v = body[key];
  if (typeof v !== "string" || !/^[\x21-\x7E]{1,200}$/.test(v)) {
    throw new HttpError(400, "validation", `${key} must be 1-200 printable characters without spaces`);
  }
  return v;
}

function intField(body: Record<string, unknown>, key: string, min: number, max: number, optional = false): number | null {
  const v = body[key];
  if ((v === undefined || v === null) && optional) return null;
  if (typeof v !== "number" || !Number.isInteger(v) || v < min || v > max) {
    throw new HttpError(400, "validation", `${key} must be an integer between ${min} and ${max}`);
  }
  return v;
}

function textField(body: Record<string, unknown>, key: string, pattern: RegExp, optional = false): string | null {
  const v = body[key];
  if ((v === undefined || v === null || v === "") && optional) return null;
  if (typeof v !== "string" || !pattern.test(v)) throw new HttpError(400, "validation", `${key} is invalid`);
  return v;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], key: string): T {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    throw new HttpError(400, "validation", `${key} must be one of: ${allowed.join(", ")}`);
  }
  return value as T;
}

function rpcFailure(fn: string, error: { code?: string; message: string }): never {
  switch (error.code) {
    case "42501": throw new HttpError(403, "forbidden", "Not permitted");
    case "23514": throw new HttpError(409, "precondition_failed", error.message);
    case "23505": throw new HttpError(409, "conflict", error.message);
    case "22023": throw new HttpError(400, "validation", error.message);
    case "P0002": throw new HttpError(404, "not_found", error.message);
    default: throw new Error(`${fn} failed`);
  }
}

async function rpc(db: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await db.rpc(fn, args);
  if (error) rpcFailure(fn, error);
  return data;
}

async function status(db: SupabaseClient) {
  const [config, settings, rules, creds, invoices] = await Promise.all([
    db.from("mydata_config").select("active_environment,live_enabled,issuance_channel,live_enabled_at,updated_at").eq("singleton", true).single(),
    db.from("mydata_environment_settings").select("environment,base_url,issuer_vat_number,issuer_branch,issuer_country,series,updated_at"),
    db.from("mydata_product_rules").select("environment,scenario,invoice_type,vat_category,vat_exemption_category,vat_rate_bp,income_classification_type,income_classification_category,payment_method_type,notes,is_confirmed,confirmed_at,updated_at"),
    // Credential STATUS only. The secrets live in Vault and are not selectable here.
    db.from("mydata_credentials_meta").select("environment,configured,updated_at,last_test_at,last_test_ok,last_test_message"),
    db.from("mydata_invoices").select("environment,status").limit(5000),
  ]);
  for (const r of [config, settings, rules, creds, invoices]) {
    if (r.error) throw new Error("status query failed");
  }
  const counts: Record<string, Record<string, number>> = { demo: {}, live: {} };
  for (const row of invoices.data ?? []) {
    const bucket = counts[row.environment as string];
    if (bucket) bucket[row.status as string] = (bucket[row.status as string] ?? 0) + 1;
  }
  return {
    config: config.data,
    settings: settings.data,
    rules: rules.data,
    credentials: creds.data,
    invoice_counts: counts,
    is_live_active: config.data?.active_environment === "live",
  };
}

async function testConnection(db: SupabaseClient, environment: MyDataEnvironment, actorId: string) {
  let result: { ok: boolean; kind: string; httpStatus: number | null; message: string };
  try {
    const credentials = await loadCredentials(db, environment);
    result = await createMyDataClient({ environment, credentials }).testConnection();
  } catch (err) {
    const message = err instanceof MyDataConfigError ? err.message : "connection test failed";
    result = { ok: false, kind: "not_configured", httpStatus: null, message };
  }
  await rpc(db, "mydata_record_connection_test", {
    p_environment: environment, p_ok: result.ok, p_message: result.message, p_actor: actorId,
  });
  return { environment, ...result };
}

Deno.serve(async (req) => {
  const cors = fiscalCors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return jsonResponse(405, { error: "method_not_allowed" }, cors);

  let admin: { userId: string };
  try {
    admin = await requireFiscalAdmin(req);
  } catch (err) {
    return errorResponse(err, cors);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse(500, { error: "config", message: "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing" }, cors);
  }
  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  try {
    const body = await readJsonObject(req);
    const action = oneOf<Action>(body.action, ACTIONS, "action");
    const actor = admin.userId;

    switch (action) {
      case "status":
        return jsonResponse(200, await status(db), cors);

      case "set_credentials": {
        const environment = env(body);
        await rpc(db, "mydata_set_credentials", {
          p_environment: environment, p_user_id: secretText(body, "user_id"),
          p_subscription_key: secretText(body, "subscription_key"), p_actor: actor,
        });
        // Deliberately no secret and no hint of it in the response.
        return jsonResponse(200, { ok: true, environment, configured: true, tested: false }, cors);
      }

      case "clear_credentials": {
        const environment = env(body);
        await rpc(db, "mydata_clear_credentials", { p_environment: environment, p_actor: actor });
        return jsonResponse(200, { ok: true, environment, configured: false }, cors);
      }

      case "save_settings": {
        const environment = env(body);
        await rpc(db, "mydata_save_environment_settings", {
          p_environment: environment,
          p_vat: textField(body, "issuer_vat_number", /^\d{9}$/),
          p_branch: intField(body, "issuer_branch", 0, 99999),
          p_series: textField(body, "series", /^[A-Za-z0-9_\-./]{1,50}$/),
          p_actor: actor,
        });
        return jsonResponse(200, { ok: true, environment }, cors);
      }

      case "save_rule": {
        const environment = env(body);
        await rpc(db, "mydata_save_product_rule", {
          p_environment: environment,
          p_scenario: oneOf(body.scenario, SCENARIOS, "scenario"),
          p_invoice_type: textField(body, "invoice_type", /^\d{1,2}\.\d{1,2}$/),
          p_vat_category: intField(body, "vat_category", 1, 20),
          p_vat_exemption_category: intField(body, "vat_exemption_category", 1, 50, true),
          p_vat_rate_bp: intField(body, "vat_rate_bp", 0, 10000),
          p_income_type: textField(body, "income_classification_type", /^[A-Za-z0-9_]{1,40}$/, true),
          p_income_category: textField(body, "income_classification_category", /^[A-Za-z0-9_]{1,40}$/),
          p_payment_method_type: intField(body, "payment_method_type", 1, 99),
          p_notes: textField(body, "notes", /^[\s\S]{1,1000}$/, true),
          p_actor: actor,
        });
        return jsonResponse(200, { ok: true, environment, confirmed: false }, cors);
      }

      case "confirm_rule": {
        const environment = env(body);
        await rpc(db, "mydata_confirm_product_rule", {
          p_environment: environment, p_scenario: oneOf(body.scenario, SCENARIOS, "scenario"), p_actor: actor,
        });
        return jsonResponse(200, { ok: true, environment, confirmed: true }, cors);
      }

      case "test_connection":
        return jsonResponse(200, await testConnection(db, env(body), actor), cors);

      case "set_issuance_channel": {
        const channel = oneOf(body.channel, CHANNELS, "channel");
        await rpc(db, "mydata_set_issuance_channel", { p_channel: channel, p_actor: actor });
        return jsonResponse(200, { ok: true, channel }, cors);
      }

      case "enable_live": {
        if (body.confirm !== CONFIRM_ENABLE_LIVE) {
          throw new HttpError(400, "confirmation_required", `Send confirm: "${CONFIRM_ENABLE_LIVE}"`);
        }
        await rpc(db, "mydata_enable_live", { p_actor: actor });
        return jsonResponse(200, { ok: true, live_enabled: true }, cors);
      }

      case "disable_live": {
        await rpc(db, "mydata_disable_live", { p_actor: actor });
        return jsonResponse(200, { ok: true, live_enabled: false, active_environment: "demo" }, cors);
      }

      case "set_environment": {
        const environment = env(body);
        if (environment === "live" && body.confirm !== CONFIRM_SWITCH_LIVE) {
          throw new HttpError(400, "confirmation_required", `Send confirm: "${CONFIRM_SWITCH_LIVE}"`);
        }
        await rpc(db, "mydata_set_active_environment", { p_environment: environment, p_actor: actor });
        return jsonResponse(200, { ok: true, active_environment: environment }, cors);
      }
    }
  } catch (err) {
    if (!(err instanceof HttpError) && !(err instanceof FiscalAdminAuthError)) {
      logEvent("mydata_admin_error", { message: String(err).slice(0, 200) });
    }
    return errorResponse(err, cors);
  }
});
