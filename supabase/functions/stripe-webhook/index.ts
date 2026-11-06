// supabase/functions/stripe-webhook/index.ts
// ΠΡΟΣΟΧΗ: πρέπει να τρέχει ΧΩΡΙΣ JWT verification (verify_jwt = false),
// γιατί το καλεί το Stripe. Η ασφάλεια βασίζεται στην υπογραφή.
import Stripe from "npm:stripe@^18";
import { createClient } from "npm:@supabase/supabase-js@^2";

const PLAN_IDS = ["low", "mid", "high"] as const;
type PlanId = (typeof PLAN_IDS)[number];

function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && (PLAN_IDS as readonly string[]).includes(value);
}

/** Η πηγή αλήθειας: το price ID της συνδρομής στο Stripe. */
const PRICE_TO_PLAN: Record<string, PlanId> = {
  price_1UYmcfLnBpuAzyZYjd8sJZmB: "low",   // AURA BASIC
  price_1UYmdKLnBpuAzyZYxr6UrDFH: "mid",   // AURA PRO
  price_1UYmdqLnBpuAzyZYoFITGf2H: "high",  // AURA ELITE

  // ΠΑΛΙΑ prices: κράτα τα ώστε οι υπάρχοντες συνδρομητές να συνεχίσουν να έχουν πρόσβαση
  price_1UCnzNLnBpuAzyZY2gfMNHHf: "low",
  price_1UCo03LnBpuAzyZYR1QsDcNZ: "mid",
  price_1UCo0PLnBpuAzyZYajqu8c5Q: "high",
  // Το παλιό LIMITED δεν υπάρχει πια ως πλάνο. Το αντιστοίχισα στο "high":
  // άλλαξέ το αν θέλεις διαφορετικά.
  price_1UCo0qLnBpuAzyZYABo0Prch: "high",
};

/** Παλιά ονόματα στο metadata (αν υπάρχουν συνδρομές από παλιότερη έκδοση). */
const LEGACY_METADATA_PLAN: Record<string, PlanId> = {
  starter: "low",
  core: "mid",
  full: "high",
};

function resolvePlan(subscription: Stripe.Subscription): PlanId | null {
  const priceId = subscription.items?.data?.[0]?.price?.id;
  if (priceId && Object.prototype.hasOwnProperty.call(PRICE_TO_PLAN, priceId)) {
    return PRICE_TO_PLAN[priceId]!;
  }

  const meta = subscription.metadata?.["plan_id"];
  if (isPlanId(meta)) return meta;
  if (typeof meta === "string" && Object.prototype.hasOwnProperty.call(LEGACY_METADATA_PLAN, meta)) {
    return LEGACY_METADATA_PLAN[meta]!;
  }

  return null; // δεν μαντεύουμε ποτέ πλάνο
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
  async function resolveUserId(subscription: Stripe.Subscription): Promise<string | null> {
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

    const item = subscription.items?.data?.[0];
    const periodEndSeconds = item?.current_period_end;
    const customerId =
      typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;

    const common = {
      status: subscription.status,
      stripe_customer_id: customerId ?? null,
      stripe_subscription_id: subscription.id,
      current_period_end: periodEndSeconds ? new Date(periodEndSeconds * 1000).toISOString() : null,
      cancel_at_period_end: subscription.cancel_at_period_end ?? false,
    };

    const planId = resolvePlan(subscription);

    if (!planId) {
      // Άγνωστο price: δεν μαντεύουμε πλάνο. Αν η συνδρομή υπάρχει ήδη, συγχρονίζουμε
      // μόνο status/ημερομηνίες. Αν δεν υπάρχει, πετάμε σφάλμα: το Stripe θα κάνει
      // retry και, μόλις προσθέσεις το price στο PRICE_TO_PLAN, θα περάσει.
      const priceId = item?.price?.id;
      const { data: updated, error } = await admin
        .from("subscriptions")
        .update(common)
        .eq("stripe_subscription_id", subscription.id)
        .select("id");
      if (error) throw new Error(`subscriptions update failed: ${error.message}`);
      if (!updated || updated.length === 0) {
        throw new Error(
          `Unknown price ${priceId} for subscription ${subscription.id}: add it to PRICE_TO_PLAN`,
        );
      }
      console.error(`Unknown price ${priceId}: synced status only for ${subscription.id}`);
      return;
    }

    const { error } = await admin
      .from("subscriptions")
      .upsert({ user_id: userId, plan_id: planId, ...common }, { onConflict: "stripe_subscription_id" });

    if (error) throw new Error(`subscriptions upsert failed: ${error.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const subscriptionId =
          typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
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