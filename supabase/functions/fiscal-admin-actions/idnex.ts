// ADMIN ONLY. Manual actions on fiscal documents:
//   resend_email     queue a NEW email delivery for an already signed receipt
//   reset_rejected   move a rejected, unsigned document back to pending with a new session_id
//   requeue_unknown  move an unknown document to 'reconciliation_pending'
//
// Every action is one SQL RPC. The state change and its fiscal_audit_log row are written
// in the same transaction, so an audit failure rolls the action back.
//
// requeue_unknown never resubmits anything. It only marks the document for reconciliation,
// which must inspect the original Viva transaction/session and must not issue a new receipt.
//
// Auth: _shared/fiscal/auth.ts requireFiscalAdmin() checks the caller's JWT and fiscal_is_admin().
// The service-role client is used only for the RPC calls and never leaves the server.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireFiscalAdmin, fiscalCors, FiscalAdminAuthError } from "../_shared/fiscal/auth.ts";
import {
  errorResponse,
  jsonResponse,
  logEvent,
  readJsonObject,
  uuidField,
  HttpError,
} from "../_shared/fiscal/util.ts";

type Action = "resend_email" | "reset_rejected" | "requeue_unknown";

const ACTIONS: readonly Action[] = ["resend_email", "reset_rejected", "requeue_unknown"];

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
    const action = body.action;
    if (typeof action !== "string" || !ACTIONS.includes(action as Action)) {
      throw new HttpError(400, "validation", `action must be one of: ${ACTIONS.join(", ")}`);
    }
    const documentId = uuidField(body, "document_id");

    switch (action as Action) {
      case "resend_email":
        return jsonResponse(200, await resendEmail(db, documentId, admin.userId), cors);
      case "reset_rejected":
        return jsonResponse(200, await resetRejected(db, documentId, admin.userId), cors);
      case "requeue_unknown":
        return jsonResponse(200, await requeueUnknown(db, documentId, admin.userId), cors);
    }
  } catch (err) {
    if (!(err instanceof HttpError) && !(err instanceof FiscalAdminAuthError)) {
      logEvent("fiscal_admin_actions_error", { message: String(err) });
    }
    return errorResponse(err, cors);
  }
});

interface RpcError {
  code?: string;
  message: string;
}

/** Maps the SQLSTATE codes raised by the fiscal RPCs to HTTP errors. Anything else is a 500. */
function throwRpcError(fn: string, error: RpcError): never {
  switch (error.code) {
    case "P0002":
      throw new HttpError(404, "not_found", error.message);
    case "23514":
      throw new HttpError(409, "invalid_state", error.message);
    case "23505":
      throw new HttpError(409, "already_pending", error.message);
    case "22023":
      throw new HttpError(400, "validation", error.message);
    default:
      throw new Error(`${fn} failed: ${error.message}`);
  }
}

async function resendEmail(db: SupabaseClient, documentId: string, actorId: string) {
  // The RPC locks the document, requires a fully signed receipt, refuses when a delivery is
  // already queued or sending, creates a new delivery with a fresh idempotency key, and writes the audit row.
  const { data, error } = await db.rpc("fiscal_request_email_resend", {
    p_document_id: documentId,
    p_recipient: null,
    p_actor: actorId,
  });
  if (error) throwRpcError("fiscal_request_email_resend", error);
  if (typeof data !== "string") throw new Error("fiscal_request_email_resend returned no delivery id");
  return { ok: true, delivery_id: data };
}

async function resetRejected(db: SupabaseClient, documentId: string, actorId: string) {
  // Only a 'rejected', unsigned document is reset. The RPC generates the new session_id.
  const { data, error } = await db.rpc("fiscal_admin_reset_rejected", {
    p_document_id: documentId,
    p_actor: actorId,
  });
  if (error) throwRpcError("fiscal_admin_reset_rejected", error);
  if (typeof data !== "string") throw new Error("fiscal_admin_reset_rejected returned no session id");
  return { ok: true, new_session_id: data };
}

async function requeueUnknown(db: SupabaseClient, documentId: string, actorId: string) {
  // unknown -> reconciliation_pending. No new signing request, no new receipt, same session untouched.
  const { data, error } = await db.rpc("fiscal_request_reconciliation", {
    p_document_id: documentId,
    p_actor: actorId,
  });
  if (error) throwRpcError("fiscal_request_reconciliation", error);
  return { ok: true, status: data };
}