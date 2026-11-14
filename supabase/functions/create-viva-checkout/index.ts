// supabase/functions/create-viva-checkout/index.ts
//
// STAGE 2: starts a subscription payment on Viva.com (sandbox first).
//
//   browser -> this function -> Viva "create payment order" -> redirect URL
//
// Everything that matters is decided HERE, never in the browser:
//   * who the user is           (verified JWT)
//   * which provider they get   (public.aura_checkout_provider_for)
//   * the plan and its price    (public.plans, edited in the admin panel)
//   * whether they may subscribe (no active/trialing subscription yet)
// The browser only sends { planId }.
//
// This function does NOT activate anything. A redirect back from Viva is not
// proof of payment: activation is Stage 3 (verified webhook).
import { createClient } from "npm:@supabase/supabase-js@^2";
import {
  checkoutRedirectUrl,
  createPaymentOrder,
  loadVivaConfig,
  VivaConfigError,
} from "../_shared/viva.ts";

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

/** A pending order younger than this is reused instead of creating a second Viva order. */
const REUSE_WINDOW_MS = 25 * 60 * 1000; // Viva order timeout is 30 min
const EXPIRE_AFTER_MS = 35 * 60 * 1000;

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) {
    console.error("Missing Supabase environment configuration");
    return json({ error: "Server misconfigured" }, 500);
  }

  let cfg;
  try {
    cfg = loadVivaConfig((name) => Deno.env.get(name));
  } catch (err) {
    console.error("Viva configuration problem:", err instanceof VivaConfigError ? err.message : "unknown");
    return json({ error: "Server misconfigured" }, 500);
  }

  // 1. Body: only the plan id is accepted from the browser.
  let planId: unknown;
  try {
    planId = (JSON.parse(await req.text()) as { planId?: unknown })?.planId;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (!isPlanId(planId)) return json({ error: "Unknown plan" }, 400);

  // 2. Who is calling? (verified by Supabase Auth)
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  const user = userData?.user;
  if (userError || !user?.email) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  try {
    // 3. Is this user allowed to use Viva right now? (feature flag / pilot)
    const { data: provider, error: providerError } = await admin.rpc("aura_checkout_provider_for", {
      p_user: user.id,
    });
    if (providerError) {
      console.error("provider lookup failed:", providerError.message);
      return json({ error: "Could not start the payment." }, 500);
    }
    if (provider !== "viva") return json({ error: "viva_not_enabled" }, 403);

    // 4. The plan and its CURRENT price, from the database.
    const { data: plan, error: planError } = await admin
      .from("plans")
      .select("id, name, price_cents, currency, active")
      .eq("id", planId)
      .maybeSingle();
    if (planError) {
      console.error("plans lookup failed:", planError.message);
      return json({ error: "Could not load the plan." }, 500);
    }
    if (!plan || !plan.active) return json({ error: "Το πλάνο δεν είναι διαθέσιμο." }, 404);

    const amountCents = Number(plan.price_cents);
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      console.error("Invalid price on plan", plan.id);
      return json({ error: "Το πλάνο δεν έχει έγκυρη τιμή." }, 500);
    }
    if (String(plan.currency ?? "eur").toLowerCase() !== "eur") {
      console.error("Unsupported currency on plan", plan.id);
      return json({ error: "Το πλάνο δεν έχει έγκυρο νόμισμα." }, 500);
    }

    // 5. Already subscribed (with Stripe OR Viva)? No second subscription.
    const { data: existing } = await admin
      .from("subscriptions")
      .select("id")
      .eq("user_id", user.id)
      .in("status", ["active", "trialing"])
      .limit(1)
      .maybeSingle();
    if (existing) return json({ error: "Υπάρχει ήδη ενεργή συνδρομή." }, 409);

    // 6. Housekeeping + double-click protection.
    const now = Date.now();
    await admin
      .from("billing_orders")
      .update({ status: "expired" })
      .eq("user_id", user.id)
      .eq("provider", "viva")
      .eq("kind", "initial")
      .eq("status", "pending")
      .lt("created_at", new Date(now - EXPIRE_AFTER_MS).toISOString());

    const { data: reusable } = await admin
      .from("billing_orders")
      .select("id, viva_order_code")
      .eq("user_id", user.id)
      .eq("provider", "viva")
      .eq("environment", cfg.env)
      .eq("kind", "initial")
      .eq("status", "pending")
      .eq("plan_id", plan.id)
      .eq("amount_cents", amountCents)
      .not("viva_order_code", "is", null)
      .gt("created_at", new Date(now - REUSE_WINDOW_MS).toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (reusable?.viva_order_code) {
      return json({
        redirectUrl: checkoutRedirectUrl(cfg, String(reusable.viva_order_code)),
        orderId: reusable.id,
        reused: true,
      });
    }

    // 7. Record OUR order first. Its id travels to Viva as merchantTrns.
    const { data: order, error: orderError } = await admin
      .from("billing_orders")
      .insert({
        user_id: user.id,
        provider: "viva",
        kind: "initial",
        plan_id: plan.id,
        amount_cents: amountCents,
        currency: "eur",
        status: "pending",
        environment: cfg.env,
      })
      .select("id")
      .single();
    if (orderError || !order) {
      console.error("billing_orders insert failed:", orderError?.message);
      return json({ error: "Could not start the payment." }, 500);
    }

    // 8. Ask Viva for a payment order (amount = the database price).
    const { data: profile } = await admin.from("profiles").select("full_name").eq("id", user.id).maybeSingle();

    let orderCode: string;
    try {
      const created = await createPaymentOrder(cfg, {
        amountCents,
        merchantTrns: String(order.id),
        customerTrns: `AURA ${String(plan.name)} - μηνιαία συνδρομή`,
        customer: {
          email: user.email,
          fullName: (profile?.full_name as string | null | undefined) ?? null,
          requestLang: "el-GR",
        },
        allowRecurring: true,
        tags: ["aura-subscription", String(plan.id)],
      });
      orderCode = created.orderCode;
    } catch (err) {
      console.error("Viva create order failed:", err instanceof Error ? err.message : "unknown");
      await admin
        .from("billing_orders")
        .update({ status: "failed", failure_reason: "order_creation_failed" })
        .eq("id", order.id);
      return json({ error: "Δεν ήταν δυνατή η έναρξη της πληρωμής. Δοκίμασε ξανά σε λίγο." }, 502);
    }

    const { error: saveError } = await admin
      .from("billing_orders")
      .update({ viva_order_code: orderCode })
      .eq("id", order.id);
    if (saveError) {
      // We could not remember Viva's order code, so a payment could not be matched. Do not send the customer.
      console.error("saving viva_order_code failed:", saveError.message);
      await admin
        .from("billing_orders")
        .update({ status: "failed", failure_reason: "order_code_not_saved" })
        .eq("id", order.id);
      return json({ error: "Could not start the payment." }, 500);
    }

    return json({ redirectUrl: checkoutRedirectUrl(cfg, orderCode), orderId: order.id, reused: false });
  } catch (error) {
    console.error("create-viva-checkout failed:", error instanceof Error ? error.message : "unknown");
    return json({ error: "Could not start the payment." }, 500);
  }
});
