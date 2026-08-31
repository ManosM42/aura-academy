// supabase/functions/create-checkout-session/index.ts
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

const PLAN_PRICE_ENV: Record<string, string> = {
  full: "STRIPE_PRICE_FULL",
  core: "STRIPE_PRICE_CORE",
  starter: "STRIPE_PRICE_STARTER",
};

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

  // 1. Ταυτοποίηση χρήστη από το Authorization header.
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  const user = userData?.user;
  if (userError || !user?.email) return json({ error: "Unauthorized" }, 401);

  // 2. Έλεγχος πακέτου.
  let planId: unknown;
  try {
    const body = (await req.json()) as { planId?: unknown };
    planId = body.planId;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (typeof planId !== "string" || !(planId in PLAN_PRICE_ENV)) {
    return json({ error: "Unknown plan" }, 400);
  }

  const priceId = Deno.env.get(PLAN_PRICE_ENV[planId]);
  if (!priceId) {
    console.error(`Missing price env var for plan ${planId}`);
    return json({ error: "Plan not available" }, 500);
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const stripe = new Stripe(stripeKey);

  try {
    // 3. Μπλοκάρουμε διπλή συνδρομή.
    const { data: existing } = await admin
      .from("subscriptions")
      .select("id")
      .eq("user_id", user.id)
      .in("status", ["active", "trialing"])
      .maybeSingle();

    if (existing) return json({ error: "Υπάρχει ήδη ενεργή συνδρομή." }, 409);

    // 4. Stripe customer (reuse ή δημιουργία).
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

    // 5. Embedded Checkout Session.
    const origin =
      Deno.env.get("PUBLIC_SITE_URL") ?? req.headers.get("origin") ?? "http://localhost:5173";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      ui_mode: "embedded",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      client_reference_id: user.id,
      metadata: { supabase_user_id: user.id, plan_id: planId },
      subscription_data: {
        metadata: { supabase_user_id: user.id, plan_id: planId },
      },
      return_url: `${origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
    });

    if (!session.client_secret) return json({ error: "Stripe δεν επέστρεψε client secret." }, 502);

    return json({ clientSecret: session.client_secret });
  } catch (error) {
    console.error("create-checkout-session failed", error);
    return json({ error: "Η δημιουργία πληρωμής απέτυχε." }, 500);
  }
});