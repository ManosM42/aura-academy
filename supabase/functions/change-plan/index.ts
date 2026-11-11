// supabase/functions/change-plan/index.ts
//
// UPGRADES the calling user's ACTIVE subscription to a higher plan.
//
//   * The billing day does NOT change. The renewal date stays exactly where it is.
//   * Today the customer pays the NEW plan's monthly price for the days that are left in the
//     current billing period:   newPrice x remainingDays / daysInBillingPeriod
//     (e.g. PRO 49,99 with 13 of 31 days left = 20,96).
//   * At the next renewal the customer pays the FULL price of the new plan.
//   * If the payment fails, NOTHING changes. If the plan switch fails after a successful
//     payment, the payment is refunded automatically.
//
// Flow: draft invoice + one invoice item -> finalize -> pay -> swap the subscription price
// (proration_behavior "none", billing cycle untouched) -> sync the database.
//
// Body:  { planId: "mid" | "high", preview?: boolean }
//   preview: true  -> only returns the numbers, changes nothing.
//
// Deploy WITH JWT verification (the default).
import Stripe from "npm:stripe@^18";
import { createClient } from "npm:@supabase/supabase-js@^2";
import { invoicePaymentIntentId, recordInvoice, syncSubscription } from "../_shared/billing.ts";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

type PlanId = "low" | "mid" | "high";

const RANK: Record<PlanId, number> = { low: 1, mid: 2, high: 3 };

function isPlanId(value: unknown): value is PlanId {
  return value === "low" || value === "mid" || value === "high";
}

/** Stripe refuses charges below roughly 0,50 EUR. */
const MIN_CHARGE_CENTS = 50;

/**
 * false (as requested): the customer pays the new price for the remaining days and gets NO
 *   credit for the unused days of the old plan they already paid for.
 * true: standard proration, the unused part of the old plan is deducted from the charge.
 */
const CREDIT_UNUSED_OLD_PLAN = false;

const DAY_MS = 86_400_000;

/** The card that will be charged (best effort, never throws). */
async function getCardOnFile(
  stripe: Stripe,
  sub: Stripe.Subscription,
  customerId: string,
): Promise<{ card: { brand: string; last4: string } | null; paymentMethodId: string | null }> {
  const idOf = (ref: unknown): string | null => {
    if (typeof ref === "string") return ref;
    if (ref && typeof ref === "object" && "id" in ref) return String((ref as { id: unknown }).id);
    return null;
  };
  try {
    let pmId = idOf(sub.default_payment_method);
    if (!pmId) {
      const customer = await stripe.customers.retrieve(customerId);
      if (!("deleted" in customer && customer.deleted)) {
        pmId = idOf(customer.invoice_settings?.default_payment_method);
      }
    }
    if (!pmId) return { card: null, paymentMethodId: null };
    const pm = await stripe.paymentMethods.retrieve(pmId);
    return {
      card: pm.card ? { brand: pm.card.brand, last4: pm.card.last4 } : null,
      paymentMethodId: pmId,
    };
  } catch (err) {
    console.error("could not read the card on file", err);
    return { card: null, paymentMethodId: null };
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!stripeKey || !supabaseUrl || !anonKey || !serviceKey) {
    console.error("Missing environment configuration");
    return json({ error: "Server misconfigured" }, 500);
  }

  // ---- 1. validate input + caller ---------------------------------------
  let body: { planId?: unknown; preview?: unknown };
  try {
    body = JSON.parse(await req.text());
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (!isPlanId(body.planId)) return json({ error: "Unknown plan" }, 400);
  const targetPlanId: PlanId = body.planId;
  const previewOnly = body.preview === true;

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  const user = userData?.user;
  if (userError || !user) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const stripe = new Stripe(stripeKey);

  let invoiceId: string | null = null;
  let paymentTaken = false;

  try {
    // ---- 2. the user's current ACTIVE subscription -------------------------
    const { data: subRow, error: subError } = await admin
      .from("subscriptions")
      .select("stripe_subscription_id, plan_id, status")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subError) {
      console.error("subscription lookup failed", subError.message);
      return json({ error: "Your subscription could not be loaded." }, 500);
    }
    if (!subRow || !subRow.stripe_subscription_id) {
      return json({ error: "No active subscription found to upgrade." }, 404);
    }

    const currentPlanId = subRow.plan_id;
    if (!isPlanId(currentPlanId)) {
      console.error("Unknown current plan_id", currentPlanId);
      return json({ error: "Unknown current plan." }, 500);
    }
    if (RANK[targetPlanId] <= RANK[currentPlanId]) {
      return json({ error: "You can only upgrade to a higher plan." }, 400);
    }

    // ---- 3. plans (names + target price) from the database ------------------
    const { data: planRows, error: plansError } = await admin
      .from("plans")
      .select("id, name, price_cents, currency, active, stripe_product_id")
      .in("id", [currentPlanId, targetPlanId]);
    if (plansError) {
      console.error("plans lookup failed", plansError.message);
      return json({ error: "Could not load the plans." }, 500);
    }
    const currentPlan = planRows?.find((p) => p.id === currentPlanId);
    const targetPlan = planRows?.find((p) => p.id === targetPlanId);
    if (!targetPlan || !targetPlan.active) {
      return json({ error: "This plan is not available." }, 404);
    }

    const newAmount = Number(targetPlan.price_cents);
    if (!Number.isInteger(newAmount) || newAmount < MIN_CHARGE_CENTS) {
      return json({ error: "This plan has no valid price." }, 500);
    }
    const currency = String(targetPlan.currency ?? "eur").toLowerCase();
    const targetName = String(targetPlan.name);
    const currentName = String(currentPlan?.name ?? currentPlanId);

    // ---- 4. the live Stripe subscription ------------------------------------
    const sub = await stripe.subscriptions.retrieve(String(subRow.stripe_subscription_id), {
      expand: ["items.data.price"],
    });

    if (sub.status !== "active") {
      return json({ error: "Your subscription is not active right now. Fix your payment first." }, 409);
    }
    if (sub.items.data.length !== 1) {
      console.error("Unexpected subscription items", sub.id, sub.items.data.length);
      return json({ error: "Your subscription has an unexpected shape. Please contact us." }, 409);
    }
    const item = sub.items.data[0];
    if (!item) return json({ error: "Your subscription has no product." }, 409);
    if ((item.quantity ?? 1) !== 1) {
      return json({ error: "Your subscription has an unexpected quantity. Please contact us." }, 409);
    }

    // What the customer ACTUALLY pays today (may differ from today's list price).
    const currentAmount = item.price.unit_amount;
    if (typeof currentAmount !== "number") {
      return json({ error: "The current price of your subscription was not found." }, 409);
    }
    if (String(item.price.currency).toLowerCase() !== currency) {
      return json({ error: "The two plans use different currencies. Please contact us." }, 409);
    }

    // ---- 5. the days left in the CURRENT billing period ---------------------
    const period = (sub as unknown as { current_period_start?: number; current_period_end?: number });
    const itemPeriod = item as unknown as { current_period_start?: number; current_period_end?: number };
    const startSec = period.current_period_start ?? itemPeriod.current_period_start;
    const endSec = period.current_period_end ?? itemPeriod.current_period_end;
    if (!startSec || !endSec) {
      console.error("Subscription without period dates", sub.id);
      return json({ error: "Your billing period could not be read. Please contact us." }, 409);
    }
    const startMs = startSec * 1000;
    const endMs = endSec * 1000;
    const nowMs = Date.now();
    if (endMs <= nowMs) {
      return json({ error: "Your subscription is renewing right now. Try again in a few minutes." }, 409);
    }

    const periodDays = Math.max(1, Math.round((endMs - startMs) / DAY_MS));
    // Part of a day counts as a full day, so the charge is never zero.
    const remainingDays = Math.min(periodDays, Math.max(1, Math.ceil((endMs - nowMs) / DAY_MS)));

    const proratedNew = Math.round((newAmount * remainingDays) / periodDays);
    const creditCents = CREDIT_UNUSED_OLD_PLAN
      ? Math.round((currentAmount * remainingDays) / periodDays)
      : 0;
    const dueToday = Math.max(proratedNew - creditCents, MIN_CHARGE_CENTS);

    const renewalDate = new Date(endMs).toISOString();
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    const method = await getCardOnFile(stripe, sub, customerId);

    // ---- 6. preview: numbers only, nothing is changed ----------------------
    if (previewOnly) {
      return json({
        currentPlanId,
        targetPlanId,
        currentPlanName: currentName,
        targetPlanName: targetName,
        currency,
        currentAmountCents: currentAmount,
        newAmountCents: newAmount,
        periodDays,
        remainingDays,
        creditCents,
        dueTodayCents: dueToday,
        renewalDate,
        card: method.card,
      });
    }

    // ---- 7. the Stripe product of the target plan --------------------------
    let productId: string | null = (targetPlan.stripe_product_id as string | null) ?? null;
    if (productId) {
      try {
        await stripe.products.update(productId, { name: targetName });
      } catch (err) {
        console.error("Stored product unusable, creating a new one", err);
        productId = null;
      }
    }
    if (!productId) {
      const product = await stripe.products.create({
        name: targetName,
        metadata: { plan_id: String(targetPlan.id) },
      });
      productId = product.id;
      const { error: saveError } = await admin
        .from("plans")
        .update({ stripe_product_id: productId })
        .eq("id", targetPlan.id);
      if (saveError) console.error("Could not store stripe_product_id", saveError.message);
    }

    // ---- 8. take the payment FIRST (if it fails, nothing has changed) -------
    const draft = await stripe.invoices.create({
      customer: customerId,
      currency,
      collection_method: "charge_automatically",
      auto_advance: false,
      pending_invoice_items_behavior: "exclude",
      description: `Upgrade to ${targetName}`,
      metadata: {
        kind: "plan_upgrade",
        supabase_user_id: user.id,
        plan_id: targetPlanId,
        subscription_id: sub.id,
      },
    });
    invoiceId = draft.id;

    await stripe.invoiceItems.create({
      customer: customerId,
      invoice: draft.id,
      amount: dueToday,
      currency,
      description:
        `${targetName}: ${remainingDays} of ${periodDays} days until ${renewalDate.slice(0, 10)}` +
        (creditCents > 0 ? " (minus unused days of the previous plan)" : ""),
    });

    await stripe.invoices.finalizeInvoice(draft.id, { auto_advance: false });
    await stripe.invoices.pay(
      draft.id,
      method.paymentMethodId ? { payment_method: method.paymentMethodId } : {},
    );
    paymentTaken = true;

    const paidInvoice = await stripe.invoices.retrieve(draft.id, { expand: ["payments"] });

    // ---- 9. switch the plan; the billing day stays EXACTLY the same ---------
    let updated: Stripe.Subscription | null = null;
    try {
      updated = await stripe.subscriptions.update(sub.id, {
        items: [
          {
            id: item.id,
            price_data: {
              currency,
              product: productId,
              unit_amount: newAmount,
              recurring: { interval: "month" },
            },
          },
        ],
        proration_behavior: "none", // we already charged the remaining days ourselves
        cancel_at_period_end: false, // upgrading means staying
        metadata: { plan_id: targetPlanId, supabase_user_id: user.id },
      });
    } catch (swapError) {
      console.error(`change-plan ${user.id}: plan switch FAILED after payment`, swapError);
      const pi = invoicePaymentIntentId(paidInvoice);
      let refunded = false;
      if (pi) {
        try {
          await stripe.refunds.create({
            payment_intent: pi,
            reason: "requested_by_customer",
            metadata: { kind: "plan_upgrade_failed", supabase_user_id: user.id },
          });
          refunded = true;
        } catch (refundError) {
          console.error(`CRITICAL change-plan ${user.id}: refund failed for ${pi}`, refundError);
        }
      } else {
        console.error(`CRITICAL change-plan ${user.id}: no payment intent to refund on ${paidInvoice.id}`);
      }
      return json(
        {
          error: refunded
            ? "We couldn’t switch your plan, so your payment was refunded automatically. Nothing changed."
            : "We couldn’t switch your plan after the payment. Please contact us and we’ll fix it right away.",
        },
        500,
      );
    }
    if (!updated) return json({ error: "The plan switch failed." }, 500);

    console.log(
      `change-plan ${user.id}: ${currentPlanId} -> ${targetPlanId}, charged ${paidInvoice.amount_paid} ${currency} (${remainingDays}/${periodDays} days)`,
    );

    // ---- 10. bookkeeping (the webhook does the same, this just makes it instant) ----
    try {
      await recordInvoice(admin, paidInvoice, { userId: user.id, planId: targetPlanId });
    } catch (err) {
      console.error("recordInvoice failed (the webhook will record it)", err);
    }

    try {
      const fresh = await stripe.subscriptions.retrieve(sub.id, { expand: ["items.data.price"] });
      const result = await syncSubscription(admin, fresh, { planId: targetPlanId });
      if (!result) throw new Error("syncSubscription returned nothing");
    } catch (err) {
      console.error("immediate sync failed, falling back to plan_id update", err);
      const { error: fallbackError } = await admin
        .from("subscriptions")
        .update({ plan_id: targetPlanId })
        .eq("stripe_subscription_id", sub.id);
      if (fallbackError) console.error("fallback plan_id update failed", fallbackError.message);
    }

    return json({
      ok: true,
      planId: targetPlanId,
      chargedCents: paidInvoice.amount_paid ?? dueToday,
      nextRenewal: renewalDate,
      card: method.card,
      invoiceUrl: paidInvoice.hosted_invoice_url ?? null,
      invoiceNumber: paidInvoice.number ?? null,
    });
  } catch (error) {
    // The payment did not go through: remove the unpaid invoice so nothing is left behind.
    if (invoiceId && !paymentTaken) {
      try {
        const inv = await stripe.invoices.retrieve(invoiceId);
        if (inv.status === "draft") await stripe.invoices.del(invoiceId);
        else if (inv.status === "open") await stripe.invoices.voidInvoice(invoiceId);
      } catch (cleanupErr) {
        console.error("could not clean up invoice", invoiceId, cleanupErr);
      }
    }

    console.error("change-plan failed", error);
    const e = error as { type?: string; code?: string; message?: string };
    if (
      e?.type === "StripeCardError" ||
      e?.code === "invoice_payment_intent_requires_action" ||
      e?.code === "authentication_required"
    ) {
      return json(
        {
          error:
            "The payment didn’t go through and your subscription was not changed. Check your card or try another one.",
          detail: e.message,
        },
        402,
      );
    }
    const message = error instanceof Error ? error.message : String(error);
    return json({ error: `The upgrade failed: ${message}` }, 500);
  }
});