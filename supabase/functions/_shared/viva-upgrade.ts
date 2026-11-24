// supabase/functions/_shared/viva-upgrade.ts
//
// Plan upgrade for a member who pays with Viva. Same rules and numbers as the
// Stripe path in change-plan: the member pays the NEW plan's price for the days
// left in the current billing period (no credit for the old plan, upgrades
// only), the plan switches at once and the next renewal is at the new price.
//
// The payment uses the card saved at the first payment (merchant-initiated, no
// redirect). The plan changes only after Viva CONFIRMS the money, and a charge
// whose outcome is unknown is never retried automatically.
import { chargeRecurring, retrieveTransaction, type VivaConfig } from "./viva.ts";
import { alertAdmins, EUR_ISO_NUMERIC, rpc, type RpcClient } from "./viva-process.ts";

const DAY_MS = 86_400_000;
const MIN_CHARGE_CENTS = 50;
const CREDIT_UNUSED_OLD_PLAN = false; // keep identical to the Stripe path

export interface VivaUpgradeInput {
  client: RpcClient;
  cfg: VivaConfig;
  userId: string;
  currentPlanId: string;
  targetPlanId: string;
  currentPlanName: string;
  targetPlanName: string;
  /** Today's list prices (plans table, edited in the admin panel). */
  currentAmountCents: number;
  newAmountCents: number;
  /** End of the current billing period (ISO). */
  periodEnd: string;
  previewOnly: boolean;
}

export interface VivaUpgradeResponse {
  status: number;
  body: Record<string, unknown>;
}

/** The numbers shown in the upgrade window. */
export function computeUpgradeQuote(currentAmount: number, newAmount: number, periodEndIso: string, nowMs: number = Date.now()) {
  const endMs = new Date(periodEndIso).getTime();
  if (!Number.isFinite(endMs) || endMs <= nowMs) return null;

  // Our subscriptions are monthly: the period started one calendar month before it ends.
  const start = new Date(endMs);
  start.setUTCMonth(start.getUTCMonth() - 1);
  const startMs = start.getTime();

  const periodDays = Math.max(1, Math.round((endMs - startMs) / DAY_MS));
  // Part of a day counts as a full day, so the charge is never zero.
  const remainingDays = Math.min(periodDays, Math.max(1, Math.ceil((endMs - nowMs) / DAY_MS)));
  const proratedNew = Math.round((newAmount * remainingDays) / periodDays);
  const creditCents = CREDIT_UNUSED_OLD_PLAN ? Math.round((currentAmount * remainingDays) / periodDays) : 0;
  const dueToday = Math.max(proratedNew - creditCents, MIN_CHARGE_CENTS);
  return { periodDays, remainingDays, creditCents, dueTodayCents: Math.min(dueToday, newAmount) };
}

const fail = (status: number, error: string): VivaUpgradeResponse => ({ status, body: { error } });

export async function runVivaUpgrade(i: VivaUpgradeInput): Promise<VivaUpgradeResponse> {
  const quote = computeUpgradeQuote(i.currentAmountCents, i.newAmountCents, i.periodEnd);
  if (!quote) return fail(409, "Η συνδρομή σου ανανεώνεται αυτή τη στιγμή. Δοκίμασε ξανά σε λίγα λεπτά.");

  // ---- preview: numbers only, nothing changes ----
  if (i.previewOnly) {
    return {
      status: 200,
      body: {
        currentPlanId: i.currentPlanId,
        targetPlanId: i.targetPlanId,
        currentPlanName: i.currentPlanName,
        targetPlanName: i.targetPlanName,
        currency: "eur",
        currentAmountCents: i.currentAmountCents,
        newAmountCents: i.newAmountCents,
        periodDays: quote.periodDays,
        remainingDays: quote.remainingDays,
        creditCents: quote.creditCents,
        dueTodayCents: quote.dueTodayCents,
        renewalDate: new Date(i.periodEnd).toISOString(),
        card: null, // Viva does not tell us the brand; the saved card is used
      },
    };
  }

  // ---- 1. reserve the upgrade in OUR database (one money movement at a time) ----
  const begin = await rpc<{ result: string; order_id?: string; initial_transaction_id?: string }>(i.client, "viva_begin_upgrade", {
    p_environment: i.cfg.env,
    p_user: i.userId,
    p_target_plan: i.targetPlanId,
    p_amount_cents: quote.dueTodayCents,
  });
  switch (begin.result) {
    case "ready": break;
    case "already_in_progress": return fail(409, "Μια χρέωση είναι ήδη σε εξέλιξη. Δοκίμασε ξανά σε λίγα λεπτά.");
    case "no_authorization": return fail(409, "Δεν υπάρχει αποθηκευμένη κάρτα για αυτή τη συνδρομή. Επικοινώνησε μαζί μας.");
    case "not_an_upgrade": return fail(400, "Μπορείς να αναβαθμίσεις μόνο σε ανώτερο πλάνο.");
    case "renewing": return fail(409, "Η συνδρομή σου ανανεώνεται αυτή τη στιγμή. Δοκίμασε ξανά σε λίγα λεπτά.");
    case "no_subscription": return fail(404, "Δεν βρέθηκε ενεργή συνδρομή για αναβάθμιση.");
    default:
      console.error("viva_begin_upgrade refused:", begin.result);
      return fail(500, "Δεν ήταν δυνατή η αναβάθμιση. Δοκίμασε ξανά.");
  }
  const orderId = begin.order_id as string;

  // ---- 2. charge the saved card ----
  const charge = await chargeRecurring(i.cfg, begin.initial_transaction_id as string, {
    amountCents: quote.dueTodayCents,
    customerTrns: `AURA ${i.targetPlanName} - αναβάθμιση`,
    merchantTrns: orderId,
  });

  if (charge.kind === "unknown") {
    // We cannot tell whether money moved: NOTHING is retried, nothing is changed.
    await alertAdmins(i.client, "Αναβάθμιση Viva χωρίς απάντηση", "Η χρέωση αναβάθμισης δεν επιβεβαιώθηκε (πρόβλημα επικοινωνίας). Έλεγξε τη συναλλαγή στη Viva πριν επαναληφθεί.", {
      order_id: orderId, kind: "upgrade_unknown", reason: charge.reason,
    });
    return fail(502, "Δεν πήραμε επιβεβαίωση της πληρωμής. Αν χρεωθείς, η αναβάθμιση θα ολοκληρωθεί αυτόματα· αλλιώς δοκίμασε ξανά αργότερα.");
  }
  if (charge.kind === "rejected") {
    await rpc(i.client, "viva_fail_upgrade", { p_environment: i.cfg.env, p_order_id: orderId, p_reason: `viva_rejected_${charge.status}` });
    await alertAdmins(i.client, "Η Viva απέρριψε αίτημα αναβάθμισης", `Η Viva απάντησε ${charge.status}. Έλεγξε τα διαπιστευτήρια και ότι είναι ενεργοποιημένες οι επαναλαμβανόμενες πληρωμές.`, {
      order_id: orderId, kind: "upgrade_rejected", http_status: charge.status,
    });
    return fail(502, "Δεν ήταν δυνατή η χρέωση. Δεν χρεώθηκες. Δοκίμασε ξανά αργότερα.");
  }
  if (charge.kind === "declined") {
    await rpc(i.client, "viva_fail_upgrade", { p_environment: i.cfg.env, p_order_id: orderId, p_reason: `declined_${charge.errorCode ?? "unknown"}` });
    return fail(402, "Η κάρτα σου απορρίφθηκε. Δεν χρεώθηκες και το πλάνο σου δεν άλλαξε.");
  }

  // ---- 3. believe it only after Viva confirms it ----
  let tx;
  try {
    tx = await retrieveTransaction(i.cfg, charge.transactionId);
  } catch (err) {
    await alertAdmins(i.client, "Αναβάθμιση Viva χωρίς επιβεβαίωση", "Η χρέωση έγινε αλλά δεν επιβεβαιώθηκε ακόμη από τη Viva. Η αναβάθμιση θα ολοκληρωθεί όταν έρθει η επιβεβαίωση.", {
      order_id: orderId, kind: "upgrade_unverified",
    });
    console.error("upgrade: could not verify with Viva:", err instanceof Error ? err.message : "unknown");
    return fail(502, "Η πληρωμή σου επεξεργάζεται. Η αναβάθμιση θα ολοκληρωθεί σε λίγα λεπτά.");
  }

  if (tx.statusId === "E") {
    await rpc(i.client, "viva_fail_upgrade", { p_environment: i.cfg.env, p_order_id: orderId, p_reason: "viva_status_E" });
    return fail(402, "Η πληρωμή δεν ολοκληρώθηκε. Δεν χρεώθηκες και το πλάνο σου δεν άλλαξε.");
  }
  if (tx.statusId !== "F") {
    return fail(502, "Η πληρωμή σου επεξεργάζεται. Η αναβάθμιση θα ολοκληρωθεί σε λίγα λεπτά.");
  }
  if (tx.merchantTrns !== orderId || tx.amountCents !== quote.dueTodayCents || (tx.currencyCode !== null && tx.currencyCode !== EUR_ISO_NUMERIC)) {
    await alertAdmins(i.client, "Αναβάθμιση Viva: ασυμφωνία στοιχείων", "Η Viva επιβεβαίωσε πληρωμή που δεν ταιριάζει με την παραγγελία μας. Δεν άλλαξε το πλάνο.", {
      order_id: orderId, transaction_id: charge.transactionId, kind: "upgrade_mismatch", expected_cents: quote.dueTodayCents, received_cents: tx.amountCents,
    });
    return fail(502, "Η πληρωμή σου επεξεργάζεται. Αν δεν ολοκληρωθεί, θα επικοινωνήσουμε μαζί σου.");
  }

  // ---- 4. apply: the plan switches only now ----
  const applied = await rpc<{ result: string; period_end?: string }>(i.client, "viva_apply_upgrade", {
    p_environment: i.cfg.env,
    p_merchant_trns: orderId,
    p_transaction_id: tx.transactionId,
    p_amount_cents: tx.amountCents,
    p_paid_at: tx.insDate,
  });
  if (applied.result !== "upgraded" && applied.result !== "already_processed") {
    await alertAdmins(i.client, "Πρόβλημα αναβάθμισης Viva", `Η πληρωμή επιβεβαιώθηκε αλλά η αναβάθμιση δεν εφαρμόστηκε (${applied.result}). Χρειάζεται έλεγχος.`, {
      order_id: orderId, transaction_id: tx.transactionId, kind: applied.result,
    });
    return fail(500, "Πληρώθηκες, αλλά δεν μπορέσαμε να αλλάξουμε το πλάνο σου αυτόματα. Θα το διορθώσουμε άμεσα.");
  }

  return {
    status: 200,
    body: {
      ok: true,
      planId: i.targetPlanId,
      chargedCents: quote.dueTodayCents,
      nextRenewal: new Date(i.periodEnd).toISOString(),
      card: null,
      invoiceUrl: null,
      invoiceNumber: null,
    },
  };
}
