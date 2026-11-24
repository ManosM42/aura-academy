// supabase/functions/_shared/viva-process.ts
//
// ONE place that turns a transaction CONFIRMED BY VIVA into database changes.
// Used by the webhook, by the checkout-return verification and (for renewals and
// upgrades) by the charge flows. Everything here is idempotent: processing the
// same transaction twice, in any order, changes nothing the second time.
//
// A transaction reference (merchantTrns) always points at OUR order, so the same
// code handles: first subscription payments, renewals, plan upgrades, online
// seminar bookings and book orders.
import type { VivaConfig, VivaTransaction } from "./viva.ts";

export const EUR_ISO_NUMERIC = "978";

/** Thrown for problems a retry could fix (Viva unreachable, database error, payment not final yet). */
export class TransientError extends Error {}

export interface RpcClient {
  rpc(name: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

export type Kind = "subscription" | "renewal" | "upgrade" | "seminar" | "book" | "unknown";
export interface Outcome {
  status: "processed" | "ignored";
  result: string;
  kind: Kind;
}

export async function rpc<T = Record<string, unknown>>(client: RpcClient, name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await client.rpc(name, args);
  if (error) throw new TransientError(`${name} failed: ${error.message}`);
  return data as T;
}

/** Tells the admins (push + inbox) that something needs a human. Never throws. */
export async function alertAdmins(client: RpcClient, title: string, body: string, data: Record<string, unknown>): Promise<void> {
  try {
    await client.rpc("notify_admins", { p_type: "billing_alert", p_title: title, p_body: body, p_url: "/admin", p_data: data });
  } catch (err) {
    console.error("alertAdmins failed:", err instanceof Error ? err.message : "unknown");
  }
}

export async function kindOf(client: RpcClient, cfg: VivaConfig, tx: VivaTransaction): Promise<Kind> {
  if (!tx.merchantTrns) return "unknown";
  const k = await rpc<string | null>(client, "viva_order_kind", { p_environment: cfg.env, p_merchant_trns: tx.merchantTrns });
  switch (k) {
    case "initial": return "subscription";
    case "renewal": return "renewal";
    case "upgrade": return "upgrade";
    case "seminar": return "seminar";
    case "book": return "book";
    default: return "unknown";
  }
}

/* ============================ PAID (status F) ============================ */

export async function processPaid(client: RpcClient, cfg: VivaConfig, tx: VivaTransaction): Promise<Outcome> {
  // Not final yet: the caller decides whether to ask Viva to try again later.
  if (tx.statusId !== "F") throw new TransientError(`transaction status is ${tx.statusId}, not F`);

  const kind = await kindOf(client, cfg, tx);

  if (tx.currencyCode !== null && tx.currencyCode !== EUR_ISO_NUMERIC) {
    await alertAdmins(client, "Πρόβλημα πληρωμής Viva", "Η πληρωμή δεν είναι σε EUR. Δεν έγινε ενεργοποίηση.", {
      transaction_id: tx.transactionId, kind: "currency_mismatch",
    });
    return { status: "ignored", result: "currency_mismatch", kind };
  }

  switch (kind) {
    case "renewal": return paidSimple(client, cfg, tx, kind, "viva_apply_renewal", false, "renewed");
    case "upgrade": return paidSimple(client, cfg, tx, kind, "viva_apply_upgrade", false, "upgraded");
    case "seminar": return paidSimple(client, cfg, tx, kind, "viva_apply_seminar_payment", true, "paid");
    case "book": return paidSimple(client, cfg, tx, kind, "viva_apply_book_payment", true, "paid");
    default: return paidInitial(client, cfg, tx);
  }
}

const FLAG_TEXT: Record<string, [string, string]> = {
  duplicate_payment: ["Διπλή χρέωση Viva", "Ο πελάτης χρεώθηκε δύο φορές για την ίδια παραγγελία. Η δεύτερη πληρωμή δεν άλλαξε τίποτα. Χρειάζεται επιστροφή."],
  paid_while_subscribed: ["Πληρωμή Viva ενώ υπάρχει συνδρομή", "Ο χρήστης πλήρωσε ενώ είχε ήδη ενεργή συνδρομή. Η πληρωμή καταγράφηκε, δεν άλλαξε η συνδρομή. Χρειάζεται επιστροφή ή έλεγχος."],
  user_missing: ["Πληρωμή Viva χωρίς λογαριασμό", "Έγινε πληρωμή για λογαριασμό που έχει διαγραφεί. Η πληρωμή καταγράφηκε. Χρειάζεται επιστροφή."],
  paid_but_not_active: ["Πληρωμή ανανέωσης για ανενεργή συνδρομή", "Έγινε χρέωση ανανέωσης αλλά η συνδρομή δεν ήταν ενεργή. Η πληρωμή καταγράφηκε, δεν άλλαξε η συνδρομή. Χρειάζεται επιστροφή ή έλεγχος."],
  paid_but_not_applied: ["Πληρωμή αναβάθμισης που δεν εφαρμόστηκε", "Η πληρωμή αναβάθμισης έφτασε αλλά η αναβάθμιση δεν ήταν πια εφικτή. Η πληρωμή καταγράφηκε. Χρειάζεται επιστροφή ή έλεγχος."],
};

/** Renewals, upgrades, seminars and books: found by OUR reference, never by order code alone. */
async function paidSimple(
  client: RpcClient, cfg: VivaConfig, tx: VivaTransaction, kind: Kind,
  fn: string, withOrderCode: boolean, okResult: string,
): Promise<Outcome> {
  const args: Record<string, unknown> = {
    p_environment: cfg.env,
    p_merchant_trns: tx.merchantTrns,
    p_transaction_id: tx.transactionId,
    p_amount_cents: tx.amountCents,
    p_paid_at: tx.insDate,
  };
  if (withOrderCode) args.p_order_code = tx.orderCode;

  const r = await rpc<{ result: string; order_id?: string; user_id?: string }>(client, fn, args);

  if (r.result === okResult || r.result === "already_processed") return { status: "processed", result: r.result, kind };

  const flag = FLAG_TEXT[r.result];
  if (flag) {
    await alertAdmins(client, flag[0], flag[1], {
      order_id: r.order_id ?? null, user_id: r.user_id ?? null, transaction_id: tx.transactionId, kind: r.result,
    });
    return { status: "processed", result: r.result, kind };
  }

  // order_not_found, amount_mismatch, order_code_mismatch...: real money may have arrived that we did NOT record.
  await alertAdmins(client, "Πρόβλημα πληρωμής Viva", `Η πληρωμή δεν ταιριάζει με καμία παραγγελία μας (${r.result}). Δεν έγινε ενεργοποίηση. Έλεγξε τη συναλλαγή στη Viva.`, {
    transaction_id: tx.transactionId, order_code: tx.orderCode, kind: r.result,
  });
  return { status: "ignored", result: r.result, kind };
}

/** The first payment of a subscription: found by the order code Viva gave us. */
async function paidInitial(client: RpcClient, cfg: VivaConfig, tx: VivaTransaction): Promise<Outcome> {
  const kind: Kind = "subscription";
  if (tx.orderCode === null) {
    await alertAdmins(client, "Πρόβλημα πληρωμής Viva", "Πληρωμή χωρίς κωδικό παραγγελίας που δεν αντιστοιχεί σε παραγγελία μας. Δεν έγινε ενεργοποίηση. Έλεγξε τη συναλλαγή στη Viva.", {
      transaction_id: tx.transactionId, kind: "order_code_missing",
    });
    return { status: "ignored", result: "order_code_missing", kind: "unknown" };
  }

  const r = await rpc<{ result: string; order_id?: string; user_id?: string; expected_cents?: number; received_cents?: number }>(
    client, "viva_apply_payment",
    {
      p_environment: cfg.env,
      p_order_code: tx.orderCode,
      p_merchant_trns: tx.merchantTrns,
      p_transaction_id: tx.transactionId,
      p_amount_cents: tx.amountCents,
      p_paid_at: tx.insDate,
      p_recurring: tx.recurringSupport,
    },
  );

  if (r.result === "activated" || r.result === "already_processed") return { status: "processed", result: r.result, kind };

  if (r.result === "activated_without_recurring") {
    await alertAdmins(client, "Συνδρομή Viva χωρίς ανανέωση", "Η συνδρομή ενεργοποιήθηκε, αλλά η Viva δεν επέτρεψε επαναλαμβανόμενες χρεώσεις. Δεν θα ανανεωθεί αυτόματα.", {
      order_id: r.order_id ?? null, kind: "no_recurring_support",
    });
    return { status: "processed", result: r.result, kind };
  }

  const flag = FLAG_TEXT[r.result];
  if (flag) {
    await alertAdmins(client, flag[0], flag[1], {
      order_id: r.order_id ?? null, user_id: r.user_id ?? null, transaction_id: tx.transactionId, kind: r.result,
    });
    return { status: "processed", result: r.result, kind };
  }

  await alertAdmins(client, "Πρόβλημα πληρωμής Viva", `Η πληρωμή δεν ταιριάζει με καμία παραγγελία μας (${r.result}). Δεν έγινε ενεργοποίηση. Έλεγξε τη συναλλαγή στη Viva.`, {
    transaction_id: tx.transactionId, order_code: tx.orderCode, kind: r.result,
    expected_cents: r.expected_cents ?? null, received_cents: r.received_cents ?? null,
  });
  return { status: "ignored", result: r.result, kind };
}

/* ========================== FAILED (not F, e.g. E) ========================== */

/**
 * Viva says the customer may retry and still succeed, so a failure is never final:
 * it only annotates a still-pending order. A later success is still accepted.
 */
export async function processFailed(client: RpcClient, cfg: VivaConfig, tx: VivaTransaction): Promise<Outcome> {
  const kind = await kindOf(client, cfg, tx);
  if (tx.statusId === "F") return { status: "ignored", result: "actually_succeeded", kind };

  const reason = `viva_status_${tx.statusId}`;

  if (kind === "renewal") {
    if (!tx.merchantTrns) return { status: "ignored", result: "renewal_without_reference", kind };
    const r = await rpc<{ result: string }>(client, "viva_fail_renewal", {
      p_environment: cfg.env, p_order_id: tx.merchantTrns, p_reason: reason, p_counts: true,
    });
    return { status: r.result === "failure_recorded" ? "processed" : "ignored", result: r.result, kind };
  }
  if (kind === "upgrade") {
    const r = await rpc<{ result: string }>(client, "viva_fail_upgrade", {
      p_environment: cfg.env, p_order_id: tx.merchantTrns, p_reason: reason,
    });
    return { status: r.result === "failure_recorded" ? "processed" : "ignored", result: r.result, kind };
  }
  if (tx.orderCode === null) return { status: "ignored", result: "failure_without_order", kind };

  if (kind === "subscription") {
    const r = await rpc<{ result: string }>(client, "viva_record_failure", {
      p_environment: cfg.env, p_order_code: tx.orderCode, p_merchant_trns: tx.merchantTrns, p_reason: reason,
    });
    return { status: r.result === "failure_recorded" ? "processed" : "ignored", result: r.result, kind };
  }
  if (kind === "seminar" || kind === "book") {
    const r = await rpc<{ result: string }>(client, "viva_note_checkout_failure", {
      p_environment: cfg.env, p_order_code: tx.orderCode, p_event_id: null,
    });
    return { status: r.result === "noted" ? "processed" : "ignored", result: r.result, kind };
  }
  return { status: "ignored", result: "unknown_order", kind };
}

/* ============================ REFUND (reversal) ============================ */

export async function processReversal(client: RpcClient, cfg: VivaConfig, tx: VivaTransaction, parentId: string): Promise<Outcome> {
  if (tx.statusId !== "F") throw new TransientError(`reversal status is ${tx.statusId}, not F`);

  // Viva reports a reversal as a signed amount; only its size matters here.
  const r = await rpc<{ result: string; user_id?: string; refunded_total_cents?: number }>(client, "viva_apply_refund", {
    p_environment: cfg.env,
    p_parent_transaction_id: parentId,
    p_reversal_transaction_id: tx.transactionId,
    p_refund_cents: Math.abs(tx.amountCents),
  });

  if (r.result === "refund_applied") {
    await alertAdmins(client, "Επιστροφή χρημάτων Viva", "Καταγράφηκε επιστροφή χρημάτων. Η πρόσβαση του μέλους ΔΕΝ αφαιρέθηκε αυτόματα· έλεγξε αν χρειάζεται ακύρωση συνδρομής.", {
      user_id: r.user_id ?? null, refunded_total_cents: r.refunded_total_cents ?? null, kind: "refund_applied",
    });
    return { status: "processed", result: r.result, kind: "unknown" };
  }
  if (r.result === "already_applied") return { status: "processed", result: r.result, kind: "unknown" };

  await alertAdmins(client, "Πρόβλημα επιστροφής Viva", `Η επιστροφή δεν ταιριάζει με πληρωμή που έχουμε καταγράψει (${r.result}).`, {
    transaction_id: tx.transactionId, kind: r.result,
  });
  return { status: "ignored", result: r.result, kind: "unknown" };
}
