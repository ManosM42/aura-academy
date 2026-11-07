// supabase/functions/_shared/billing.ts
// Shared by stripe-webhook, verify-checkout-session and admin-billing-sync.
import type Stripe from "npm:stripe@^18";
import type { SupabaseClient } from "npm:@supabase/supabase-js@^2";

export type PlanId = "low" | "mid" | "high";

export const ACCESS_STATUSES = ["active", "trialing"];

/** Old plan names that may still exist in Stripe metadata or old rows. */
const LEGACY_PLAN: Record<string, PlanId> = {
  starter: "low",
  core: "mid",
  full: "high",
  limited: "high",
};

export function normalizePlanId(value: unknown): PlanId | null {
  if (value === "low" || value === "mid" || value === "high") return value;
  if (typeof value === "string" && Object.prototype.hasOwnProperty.call(LEGACY_PLAN, value)) {
    return LEGACY_PLAN[value] ?? null;
  }
  return null;
}

/** Stripe returns either an id string or an expanded object. */
export function refId(ref: unknown): string | null {
  if (!ref) return null;
  if (typeof ref === "string") return ref;
  if (typeof ref === "object" && "id" in ref && typeof (ref as { id: unknown }).id === "string") {
    return (ref as { id: string }).id;
  }
  return null;
}

type PeriodBearing = { current_period_end?: number | null };

export function periodEndIso(sub: Stripe.Subscription): string | null {
  const item = sub.items?.data?.[0] as (Stripe.SubscriptionItem & PeriodBearing) | undefined;
  const fromItem = item?.current_period_end;
  const fromSub = (sub as unknown as PeriodBearing).current_period_end;
  const seconds =
    typeof fromItem === "number" ? fromItem : typeof fromSub === "number" ? fromSub : null;
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

/* ------------------------------------------------------------------ */
/* Subscriptions                                                       */
/* ------------------------------------------------------------------ */

export async function resolveUserId(
  admin: SupabaseClient,
  sub: Stripe.Subscription,
): Promise<string | null> {
  const fromMeta = sub.metadata?.["supabase_user_id"];
  if (typeof fromMeta === "string" && fromMeta.length > 0) return fromMeta;

  const customerId = refId(sub.customer);
  if (!customerId) return null;

  const { data } = await admin
    .from("stripe_customers")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  return (data?.user_id as string | undefined) ?? null;
}

/**
 * Which AURA plan is this subscription?
 * 1) metadata.plan_id  2) a hint (e.g. from the checkout session)
 * 3) the Stripe product we created for a plan  4) what we already stored.
 */
export async function resolvePlanId(
  admin: SupabaseClient,
  sub: Stripe.Subscription,
  hint?: unknown,
): Promise<PlanId | null> {
  const fromMeta = normalizePlanId(sub.metadata?.["plan_id"]);
  if (fromMeta) return fromMeta;

  const fromHint = normalizePlanId(hint);
  if (fromHint) return fromHint;

  const price = sub.items?.data?.[0]?.price;
  const productId = refId(price?.product);
  if (productId) {
    const { data } = await admin
      .from("plans")
      .select("id")
      .eq("stripe_product_id", productId)
      .maybeSingle();
    const fromProduct = normalizePlanId(data?.id);
    if (fromProduct) return fromProduct;
  }

  const { data: existing } = await admin
    .from("subscriptions")
    .select("plan_id")
    .eq("stripe_subscription_id", sub.id)
    .maybeSingle();
  return normalizePlanId(existing?.plan_id);
}

/** Upserts public.subscriptions from a Stripe subscription. Null = couldn't map it. */
export async function syncSubscription(
  admin: SupabaseClient,
  sub: Stripe.Subscription,
  hint?: { planId?: unknown; userId?: string | null },
): Promise<{ userId: string; planId: PlanId } | null> {
  const userId = hint?.userId ?? (await resolveUserId(admin, sub));
  if (!userId) {
    console.error(`No user mapping for subscription ${sub.id}`);
    return null;
  }

  const planId = await resolvePlanId(admin, sub, hint?.planId);
  if (!planId) {
    console.error(`Could not resolve plan for subscription ${sub.id}`);
    return null;
  }

  const { error } = await admin.from("subscriptions").upsert(
    {
      user_id: userId,
      plan_id: planId,
      status: sub.status,
      stripe_customer_id: refId(sub.customer),
      stripe_subscription_id: sub.id,
      current_period_end: periodEndIso(sub),
      cancel_at_period_end: sub.cancel_at_period_end ?? false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" },
  );
  if (error) throw new Error(`subscriptions upsert failed: ${error.message}`);

  return { userId, planId };
}

/* ------------------------------------------------------------------ */
/* Invoices -> payments ledger                                         */
/* ------------------------------------------------------------------ */

type InvoiceLike = {
  subscription?: unknown;
  payment_intent?: unknown;
  parent?: { subscription_details?: { subscription?: unknown } | null } | null;
  payments?: { data?: Array<{ payment?: { payment_intent?: unknown } | null }> } | null;
};

/** Works on both the old (invoice.subscription) and new (invoice.parent...) API shapes. */
export function invoiceSubscriptionId(inv: Stripe.Invoice): string | null {
  const x = inv as unknown as InvoiceLike;
  return refId(x.subscription) ?? refId(x.parent?.subscription_details?.subscription);
}

export function invoicePaymentIntentId(inv: Stripe.Invoice): string | null {
  const x = inv as unknown as InvoiceLike;
  return refId(x.payment_intent) ?? refId(x.payments?.data?.[0]?.payment?.payment_intent);
}

function iso(seconds: number | null | undefined): string | null {
  return typeof seconds === "number" && seconds > 0 ? new Date(seconds * 1000).toISOString() : null;
}

/**
 * Stores one PAID invoice. Idempotent (unique on stripe_invoice_id).
 * Returns true when a row was written.
 */
export async function recordInvoice(
  admin: SupabaseClient,
  inv: Stripe.Invoice,
  known?: { userId?: string | null; planId?: string | null },
): Promise<boolean> {
  if (inv.status !== "paid") return false;
  const amount = inv.amount_paid ?? 0;
  if (amount <= 0) return false; // free / 100% coupon invoices are not income

  const subId = invoiceSubscriptionId(inv);
  const customerId = refId(inv.customer);

  let userId = known?.userId ?? null;
  let planId = known?.planId ?? null;

  if (subId && (!userId || !planId)) {
    const { data } = await admin
      .from("subscriptions")
      .select("user_id, plan_id")
      .eq("stripe_subscription_id", subId)
      .maybeSingle();
    userId = userId ?? ((data?.user_id as string | undefined) ?? null);
    planId = planId ?? ((data?.plan_id as string | undefined) ?? null);
  }

  if (!userId && customerId) {
    const { data } = await admin
      .from("stripe_customers")
      .select("user_id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    userId = (data?.user_id as string | undefined) ?? null;
  }

  const line = inv.lines?.data?.[0] as { period?: { start?: number; end?: number } } | undefined;
  const paidAt =
    iso(inv.status_transitions?.paid_at) ?? iso(inv.created) ?? new Date().toISOString();
  const pi = invoicePaymentIntentId(inv);

  const row = {
    stripe_invoice_id: inv.id,
    ...(subId ? { stripe_subscription_id: subId } : {}),
    ...(customerId ? { stripe_customer_id: customerId } : {}),
    ...(pi ? { stripe_payment_intent_id: pi } : {}),
    ...(userId ? { user_id: userId } : {}),
    ...(planId ? { plan_id: normalizePlanId(planId) ?? planId } : {}),
    amount_cents: amount,
    currency: (inv.currency ?? "eur").toLowerCase(),
    billing_reason: inv.billing_reason ?? null,
    period_start: iso(line?.period?.start ?? inv.period_start),
    period_end: iso(line?.period?.end ?? inv.period_end),
    paid_at: paidAt,
  };

  const { error } = await admin.from("payments").upsert(row, { onConflict: "stripe_invoice_id" });
  if (error) throw new Error(`payments upsert failed: ${error.message}`);
  return true;
}