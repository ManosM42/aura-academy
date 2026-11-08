// supabase/functions/stripe-webhook/index.ts
// ΠΡΟΣΟΧΗ: πρέπει να τρέχει ΧΩΡΙΣ JWT verification (verify_jwt = false),
// γιατί το καλεί το Stripe. Η ασφάλεια βασίζεται στην υπογραφή.
import Stripe from "npm:stripe@^18";
import { createClient } from "npm:@supabase/supabase-js@^2";
import {
  invoiceSubscriptionId,
  recordInvoice,
  refId,
  syncSubscription,
  UserDeletedError,
} from "../_shared/billing.ts";

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!stripeKey || !webhookSecret || !supabaseUrl || !serviceKey) {
    console.error("Missing environment configuration");
    return new Response("Server misconfigured", { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  const stripe = new Stripe(stripeKey);
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
  } catch (error) {
    console.error("Signature verification failed", error);
    return new Response("Invalid signature", { status: 400 });
  }

  /** Fetches the subscription and mirrors it into public.subscriptions. */
  async function syncById(subscriptionId: string, planHint?: unknown): Promise<void> {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["items.data.price"],
    });
    const result = await syncSubscription(admin, subscription, { planId: planHint });
    if (!result) {
      // 500 → Stripe retries; usually the user mapping was not written yet.
      throw new Error(`Could not map subscription ${subscriptionId}`);
    }
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const subscriptionId = refId(session.subscription);
        if (!subscriptionId) break;
        await syncById(subscriptionId, session.metadata?.plan_id);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "customer.subscription.paused":
      case "customer.subscription.resumed": {
        const sub = event.data.object as Stripe.Subscription;
        const result = await syncSubscription(admin, sub);
        if (!result) throw new Error(`Could not map subscription ${sub.id}`);
        break;
      }

      // A monthly charge succeeded: this is what feeds the income tables.
      case "invoice.paid":
      case "invoice.payment_succeeded": {
        const inv = event.data.object as Stripe.Invoice;

        const subId = invoiceSubscriptionId(inv);
        if (subId) await syncById(subId);

        let full: Stripe.Invoice = inv;
        try {
          full = await stripe.invoices.retrieve(inv.id as string, { expand: ["payments"] });
        } catch {
          /* the payment intent id is optional (only needed for refunds) */
        }
        await recordInvoice(admin, full);
        break;
      }

      // A renewal failed: Stripe moves the subscription to past_due.
      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        const subId = invoiceSubscriptionId(inv);
        if (subId) await syncById(subId);
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const pi = refId(charge.payment_intent);
        if (pi) {
          const { error } = await admin
            .from("payments")
            .update({ amount_refunded_cents: charge.amount_refunded ?? 0 })
            .eq("stripe_payment_intent_id", pi);
          if (error) throw new Error(`refund update failed: ${error.message}`);
        }
        break;
      }

      default:
        // Τα υπόλοιπα events τα αγνοούμε σκόπιμα.
        break;
    }
  } catch (error) {
    // The account was deleted: nothing to record. Answer 200 so Stripe does not retry for days.
    if (error instanceof UserDeletedError) {
      console.log(`Ignoring ${event.type}: ${error.message}`);
      return new Response(JSON.stringify({ received: true, ignored: "account_deleted" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    // 500 → το Stripe κάνει retry.
    console.error(`Handler failed for ${event.type}`, error);
    return new Response("Handler error", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});