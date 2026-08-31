// supabase/functions/stripe-webhook/index.ts
// ΠΡΟΣΟΧΗ: πρέπει να τρέχει ΧΩΡΙΣ JWT verification (verify_jwt = false),
// γιατί το καλεί το Stripe. Η ασφάλεια βασίζεται στην υπογραφή.
import Stripe from "npm:stripe@^18";
import { createClient } from "npm:@supabase/supabase-js@^2";

const PLAN_IDS = ["full", "core", "starter"] as const;
type PlanId = (typeof PLAN_IDS)[number];

function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && (PLAN_IDS as readonly string[]).includes(value);
}

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

  /** Βρίσκει το supabase user id από metadata ή από το customer mapping. */
  async function resolveUserId(
    subscription: Stripe.Subscription,
  ): Promise<string | null> {
    const fromMetadata = subscription.metadata?.["supabase_user_id"];
    if (typeof fromMetadata === "string" && fromMetadata.length > 0) return fromMetadata;

    const customerId =
      typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
    if (!customerId) return null;

    const { data } = await admin
      .from("stripe_customers")
      .select("user_id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();

    return (data?.user_id as string | undefined) ?? null;
  }

  async function upsertSubscription(subscription: Stripe.Subscription): Promise<void> {
    const userId = await resolveUserId(subscription);
    if (!userId) {
      console.error(`No user mapping for subscription ${subscription.id}`);
      return;
    }

    const metadataPlan = subscription.metadata?.["plan_id"];
    const planId: PlanId = isPlanId(metadataPlan) ? metadataPlan : "starter";
    if (!isPlanId(metadataPlan)) {
      console.error(`Subscription ${subscription.id} χωρίς έγκυρο plan_id — fallback σε starter.`);
    }

    const item = subscription.items?.data?.[0];
    const periodEndSeconds = item?.current_period_end;
    const customerId =
      typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;

    const { error } = await admin.from("subscriptions").upsert(
      {
        user_id: userId,
        plan_id: planId,
        status: subscription.status,
        stripe_customer_id: customerId ?? null,
        stripe_subscription_id: subscription.id,
        current_period_end: periodEndSeconds
          ? new Date(periodEndSeconds * 1000).toISOString()
          : null,
        cancel_at_period_end: subscription.cancel_at_period_end ?? false,
      },
      { onConflict: "stripe_subscription_id" },
    );

    if (error) console.error("subscriptions upsert failed", error.message);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;
        if (!subscriptionId) break;
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await upsertSubscription(subscription);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "customer.subscription.paused":
      case "customer.subscription.resumed": {
        await upsertSubscription(event.data.object as Stripe.Subscription);
        break;
      }

      default:
        // Τα υπόλοιπα events τα αγνοούμε σκόπιμα.
        break;
    }
  } catch (error) {
    // 500 → το Stripe κάνει retry.
    console.error(`Handler failed for ${event.type}`, error);
    return new Response("Handler error", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});