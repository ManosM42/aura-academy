// supabase/functions/viva-renew/index.ts
//
// STAGE 4: the renewal engine. Called on a schedule (pg_cron, hourly) with a
// secret header. For every Viva subscription that is due it:
//
//   1. reserves the billing period in OUR database   (viva_begin_renewal)
//   2. charges the saved payment method at Viva      (no customer interaction)
//   3. asks Viva to CONFIRM the result before believing it
//   4. applies it atomically                         (viva_apply_renewal)
//
// Safety rules:
//  * At most ONE charge per member per billing period: the order row is the lock.
//  * If we cannot tell whether a charge went through (network cut, timeout,
//    Viva error), the order stays PENDING and is never retried automatically:
//    the money may have moved. The webhook usually settles it; otherwise the
//    admin is alerted.
//  * A declined card starts the grace period (members keep access meanwhile);
//    OUR errors (bad credentials...) are never held against the customer.
//  * Prices come from public.plans at charge time (the admin panel decides).
import { createClient } from "npm:@supabase/supabase-js@^2";
import {
  chargeRecurring,
  loadVivaConfig,
  retrieveTransaction,
  VivaConfigError,
  type VivaConfig,
} from "../_shared/viva.ts";

const EUR_ISO_NUMERIC = "978";
const DEFAULT_BATCH = 25;
const STALE_FROM_MINUTES = 180; // alert once, in the hourly run that first sees an order this old
const STALE_TO_MINUTES = 240;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

type AdminClient = ReturnType<typeof createClient>;

async function rpc<T = Record<string, unknown>>(admin: AdminClient, name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await admin.rpc(name, args);
  if (error) throw new Error(`${name} failed: ${error.message}`);
  return data as T;
}

async function alertAdmins(admin: AdminClient, title: string, body: string, data: Record<string, unknown>) {
  try {
    await admin.rpc("notify_admins", { p_type: "billing_alert", p_title: title, p_body: body, p_url: "/admin", p_data: data });
  } catch (err) {
    console.error("alertAdmins failed:", err instanceof Error ? err.message : "unknown");
  }
}

/** Constant-time string comparison (the cron secret). */
function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  const len = Math.max(x.length, y.length);
  for (let i = 0; i < len; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

interface Summary {
  due: number;
  renewed: number;
  declined: number;
  rejected: number;
  left_pending: number;
  skipped: number;
  anomalies: number;
  ended: number;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  // ---- Only our scheduler may call this. ----
  const expected = Deno.env.get("CRON_SECRET");
  if (!expected) {
    console.error("CRON_SECRET is not set");
    return json({ error: "misconfigured" }, 500);
  }
  if (!safeEqual(req.headers.get("x-cron-secret") ?? "", expected)) return json({ error: "unauthorized" }, 401);

  let cfg: VivaConfig;
  try {
    cfg = loadVivaConfig((name) => Deno.env.get(name));
    if (!cfg.merchantId || !cfg.apiKey) {
      throw new VivaConfigError("Missing Viva secrets: MERCHANT_ID / API_KEY");
    }
  } catch (err) {
    console.error("Viva configuration problem:", err instanceof VivaConfigError ? err.message : "unknown");
    return json({ error: "misconfigured" }, 500);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    console.error("Missing Supabase environment configuration");
    return json({ error: "misconfigured" }, 500);
  }
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const batch = Math.min(Math.max(Number(Deno.env.get("VIVA_RENEW_BATCH")) || DEFAULT_BATCH, 1), 100);
  const summary: Summary = { due: 0, renewed: 0, declined: 0, rejected: 0, left_pending: 0, skipped: 0, anomalies: 0, ended: 0 };

  try {
    // ---------------- 1. charge what is due ----------------
    const due = await rpc<{ subscription_id: string }[]>(admin, "viva_due_renewals", {
      p_environment: cfg.env,
      p_limit: batch,
    });
    summary.due = Array.isArray(due) ? due.length : 0;

    for (const row of Array.isArray(due) ? due : []) {
      try {
        await renewOne(admin, cfg, row.subscription_id, summary);
      } catch (err) {
        // One member's problem must never stop the others.
        console.error("renewal failed unexpectedly:", err instanceof Error ? err.message : "unknown");
        summary.anomalies += 1;
      }
    }

    // ---------------- 2. end what is over ----------------
    const lapsed = await rpc<{ ended: { user_id: string; reason: string }[] }>(admin, "viva_finish_lapsed", {
      p_environment: cfg.env,
    });
    for (const e of lapsed.ended ?? []) {
      summary.ended += 1;
      const loud = e.reason === "overdue" || e.reason === "no_authorization";
      await alertAdmins(
        admin,
        loud ? "Λήξη συνδρομής Viva (απαιτεί έλεγχο)" : "Λήξη συνδρομής Viva",
        loud
          ? `Η συνδρομή έληξε χωρίς ανανέωση (${e.reason}). Έλεγξε αν υπάρχει πρόβλημα στις χρεώσεις.`
          : `Η συνδρομή έληξε (${e.reason}).`,
        { user_id: e.user_id, kind: `lapsed_${e.reason}` },
      );
    }

    // ---------------- 3. attempts whose outcome we never learned ----------------
    const stale = await rpc<{ order_id: string; user_id: string; amount_cents: number }[]>(admin, "viva_stale_renewals", {
      p_environment: cfg.env,
      p_from_minutes: STALE_FROM_MINUTES,
      p_to_minutes: STALE_TO_MINUTES,
    });
    for (const s of Array.isArray(stale) ? stale : []) {
      await alertAdmins(
        admin,
        "Ανανέωση Viva χωρίς αποτέλεσμα",
        "Μια χρέωση ανανέωσης δεν έχει επιβεβαιωθεί εδώ και ώρες. ΔΕΝ θα ξαναδοκιμαστεί αυτόματα (μπορεί να έχει χρεωθεί ο πελάτης). Έλεγξε τη συναλλαγή στη Viva.",
        { order_id: s.order_id, user_id: s.user_id, amount_cents: s.amount_cents, kind: "renewal_unresolved" },
      );
    }

    console.log("viva-renew run:", JSON.stringify(summary));
    return json({ ok: true, ...summary });
  } catch (err) {
    console.error("viva-renew run failed:", err instanceof Error ? err.message : "unknown");
    return json({ error: "run failed", ...summary }, 500);
  }
});

async function renewOne(admin: AdminClient, cfg: VivaConfig, subscriptionId: string, summary: Summary): Promise<void> {
  const begin = await rpc<{
    result: string;
    order_id?: string;
    user_id?: string;
    plan_id?: string;
    amount_cents?: number;
    initial_transaction_id?: string;
  }>(admin, "viva_begin_renewal", { p_environment: cfg.env, p_subscription_id: subscriptionId });

  if (begin.result === "plan_invalid") {
    summary.anomalies += 1;
    await alertAdmins(admin, "Πρόβλημα ανανέωσης Viva", "Το πλάνο του μέλους δεν έχει έγκυρη τιμή ή νόμισμα. Δεν έγινε χρέωση.", {
      user_id: null, kind: "plan_invalid", subscription_id: subscriptionId,
    });
    return;
  }
  if (begin.result !== "ready" || !begin.order_id || !begin.initial_transaction_id || !begin.amount_cents) {
    summary.skipped += 1; // not due any more / already in progress / no authorization
    return;
  }

  const orderId = begin.order_id;
  const amountCents = begin.amount_cents;

  const charge = await chargeRecurring(cfg, begin.initial_transaction_id, {
    amountCents,
    customerTrns: `AURA ${begin.plan_id ?? ""} - μηνιαία συνδρομή`.trim(),
    merchantTrns: orderId,
  });

  // ---- Outcome we cannot be sure about: do NOT retry, do NOT fail. ----
  if (charge.kind === "unknown") {
    summary.left_pending += 1;
    console.error("renewal outcome unknown:", charge.reason);
    await alertAdmins(admin, "Ανανέωση Viva χωρίς απάντηση", "Η χρέωση ανανέωσης δεν επιβεβαιώθηκε (πρόβλημα επικοινωνίας). ΔΕΝ θα ξαναδοκιμαστεί αυτόματα. Θα ενημερωθείς αν η Viva επιβεβαιώσει την πληρωμή.", {
      order_id: orderId, kind: "renewal_unknown", reason: charge.reason,
    });
    return;
  }

  // ---- OUR side was refused (credentials / request): nothing moved, not the customer's fault. ----
  if (charge.kind === "rejected") {
    summary.rejected += 1;
    await rpc(admin, "viva_fail_renewal", { p_environment: cfg.env, p_order_id: orderId, p_reason: `viva_rejected_${charge.status}`, p_counts: false });
    await alertAdmins(admin, "Η Viva απέρριψε το αίτημα ανανέωσης", `Η Viva απάντησε ${charge.status}. Έλεγξε τα διαπιστευτήρια (Merchant ID / API key) και ότι είναι ενεργοποιημένες οι επαναλαμβανόμενες πληρωμές. Κανένας πελάτης δεν επηρεάστηκε.`, {
      order_id: orderId, kind: "renewal_rejected", http_status: charge.status,
    });
    return;
  }

  // ---- The bank said no. ----
  if (charge.kind === "declined") {
    await failForCustomer(admin, cfg, orderId, `declined_${charge.errorCode ?? "unknown"}`, summary);
    return;
  }

  // ---- Viva gave us a transaction id: remember it, then verify it. ----
  await rpc(admin, "viva_note_renewal_transaction", { p_order_id: orderId, p_transaction_id: charge.transactionId });

  let tx;
  try {
    tx = await retrieveTransaction(cfg, charge.transactionId);
  } catch (err) {
    summary.left_pending += 1;
    console.error("could not verify the renewal with Viva:", err instanceof Error ? err.message : "unknown");
    await alertAdmins(admin, "Ανανέωση Viva χωρίς επιβεβαίωση", "Η χρέωση έγινε αλλά δεν επιβεβαιώθηκε ακόμη από τη Viva. ΔΕΝ θα ξαναδοκιμαστεί αυτόματα.", {
      order_id: orderId, kind: "renewal_unverified",
    });
    return;
  }

  if (tx.statusId === "F") {
    if (tx.merchantTrns !== orderId || tx.amountCents !== amountCents || (tx.currencyCode !== null && tx.currencyCode !== EUR_ISO_NUMERIC)) {
      // The money may have moved but it is not what we asked for. A human decides.
      summary.anomalies += 1;
      summary.left_pending += 1;
      await alertAdmins(admin, "Ανανέωση Viva: ασυμφωνία στοιχείων", "Η Viva επιβεβαίωσε πληρωμή που δεν ταιριάζει με την παραγγελία μας. Δεν έγινε ενεργοποίηση.", {
        order_id: orderId, transaction_id: charge.transactionId, kind: "renewal_mismatch",
        expected_cents: amountCents, received_cents: tx.amountCents,
      });
      return;
    }

    const applied = await rpc<{ result: string }>(admin, "viva_apply_renewal", {
      p_environment: cfg.env,
      p_merchant_trns: orderId,
      p_transaction_id: tx.transactionId,
      p_amount_cents: tx.amountCents,
      p_paid_at: tx.insDate,
    });

    if (applied.result === "renewed" || applied.result === "already_processed") {
      summary.renewed += 1;
      return;
    }
    summary.anomalies += 1;
    await alertAdmins(admin, "Πρόβλημα ανανέωσης Viva", `Η πληρωμή επιβεβαιώθηκε αλλά δεν εφαρμόστηκε (${applied.result}). Έλεγξε τη συναλλαγή.`, {
      order_id: orderId, transaction_id: charge.transactionId, kind: applied.result,
    });
    return;
  }

  if (tx.statusId === "E") {
    await failForCustomer(admin, cfg, orderId, `viva_status_${tx.statusId}`, summary);
    return;
  }

  // Any other status is not final: leave the order pending and let the webhook decide.
  summary.left_pending += 1;
  await alertAdmins(admin, "Ανανέωση Viva σε αναμονή", `Η συναλλαγή έχει κατάσταση ${tx.statusId} (όχι τελική). Αναμένεται ειδοποίηση από τη Viva.`, {
    order_id: orderId, transaction_id: charge.transactionId, kind: "renewal_not_final",
  });
}

async function failForCustomer(admin: AdminClient, cfg: VivaConfig, orderId: string, reason: string, summary: Summary) {
  summary.declined += 1;
  const r = await rpc<{ result: string; attempts?: number; user_id?: string; grace_until?: string; will_retry?: boolean }>(
    admin,
    "viva_fail_renewal",
    { p_environment: cfg.env, p_order_id: orderId, p_reason: reason, p_counts: true },
  );
  // One alert per member for the first failure; the end of the grace period alerts again.
  if (r.result === "failure_recorded" && (r.attempts ?? 1) <= 1) {
    await alertAdmins(admin, "Αποτυχία ανανέωσης συνδρομής Viva", "Η κάρτα του μέλους απορρίφθηκε. Το μέλος κρατά πρόσβαση στην περίοδο χάριτος και θα γίνουν νέες προσπάθειες.", {
      user_id: r.user_id ?? null, kind: "renewal_declined", grace_until: r.grace_until ?? null,
    });
  }
}
