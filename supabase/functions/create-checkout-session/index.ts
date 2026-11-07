// supabase/functions/create-checkout-session/index.ts
//
// The price now comes from public.plans (edited in the admin panel).
// There is no Stripe Price ID to maintain: we send the amount inline with
// `price_data`, attached to ONE Stripe product per plan that we create and
// remember automatically (plans.stripe_product_id).
import Stripe from "npm:stripe@^18";
import { createClient } from "npm:@supabase/supabase-js@^2";

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

function isPlanId(value: unknown): value is PlanId {
  return value === "low" || value === "mid" || value === "high";
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!stripeKey || !supabaseUrl || !anonKey || !serviceKey) {
    console.error("Missing environment configuration", {
      stripeKey: Boolean(stripeKey),
      supabaseUrl: Boolean(supabaseUrl),
      anonKey: Boolean(anonKey),
      serviceKey: Boolean(serviceKey),
    });
    return json({ error: "Server misconfigured" }, 500);
  }

  let planId: unknown;
  try {
    const parsed = JSON.parse(await req.text()) as { planId?: unknown };
    planId = parsed?.planId;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (!isPlanId(planId)) return json({ error: "Unknown plan" }, 400);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  const user = userData?.user;
  if (userError || !user?.email) {
    console.error("getUser failed", userError?.message ?? "no email on user");
    return json({ error: "Unauthorized" }, 401);
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const stripe = new Stripe(stripeKey);

  try {
    // 1. The plan and its CURRENT price, straight from the database.
    const { data: plan, error: planError } = await admin
      .from("plans")
      .select("id, name, price_cents, currency, active, stripe_product_id")
      .eq("id", planId)
      .maybeSingle();

    if (planError) {
      console.error("plans lookup failed", planError.message);
      return json({ error: "Could not load the plan." }, 500);
    }
    if (!plan || !plan.active) return json({ error: "Το πλάνο δεν είναι διαθέσιμο." }, 404);

    const unitAmount = Number(plan.price_cents);
    if (!Number.isInteger(unitAmount) || unitAmount < 50) {
      console.error("Invalid price on plan", plan.id, plan.price_cents);
      return json({ error: "Το πλάνο δεν έχει έγκυρη τιμή." }, 500);
    }

    // 2. Already subscribed? No second charge.
    const { data: existing } = await admin
      .from("subscriptions")
      .select("id")
      .eq("user_id", user.id)
      .in("status", ["active", "trialing"])
      .maybeSingle();
    if (existing) return json({ error: "Υπάρχει ήδη ενεργή συνδρομή." }, 409);

    // 3. Stripe customer
    const { data: mapping } = await admin
      .from("stripe_customers")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    let customerId = mapping?.stripe_customer_id as string | undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;

      const { error: insertError } = await admin
        .from("stripe_customers")
        .insert({ user_id: user.id, stripe_customer_id: customerId });
      if (insertError) console.error("stripe_customers insert failed", insertError.message);
    }

    // 4. One Stripe product per plan: keep its name in sync, or create it.
    let productId: string | null = (plan.stripe_product_id as string | null) ?? null;
    if (productId) {
      try {
        await stripe.products.update(productId, { name: String(plan.name) });
      } catch (err) {
        // Deleted product, or the ID belongs to the other Stripe mode (test/live).
        console.error("Stored product unusable, creating a new one", err);
        productId = null;
      }
    }
    if (!productId) {
      const product = await stripe.products.create({
        name: String(plan.name),
        metadata: { plan_id: String(plan.id) },
      });
      productId = product.id;
      const { error: saveError } = await admin
        .from("plans")
        .update({ stripe_product_id: productId })
        .eq("id", plan.id);
      if (saveError) console.error("Could not store stripe_product_id", saveError.message);
    }

    const origin =
      Deno.env.get("PUBLIC_SITE_URL") ?? req.headers.get("origin") ?? "http://localhost:3000";

    // 5. Embedded checkout with an inline monthly price.
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      ui_mode: "embedded",
      customer: customerId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: String(plan.currency ?? "eur").toLowerCase(),
            product: productId,
            unit_amount: unitAmount,
            recurring: { interval: "month" },
          },
        },
      ],
      allow_promotion_codes: true,
      client_reference_id: user.id,
      metadata: { supabase_user_id: user.id, plan_id: planId },
      subscription_data: {
        metadata: { supabase_user_id: user.id, plan_id: planId },
      },
      return_url: `${origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
    });

    if (!session.client_secret) {
      console.error("Stripe returned no client_secret", session.id);
      return json({ error: "Stripe δεν επέστρεψε client secret." }, 502);
    }

    return json({ clientSecret: session.client_secret });
  } catch (error) {
    console.error("create-checkout-session failed", error);
    const message = error instanceof Error ? error.message : String(error);
    return json({ error: `Η δημιουργία πληρωμής απέτυχε: ${message}` }, 500);
  }
});