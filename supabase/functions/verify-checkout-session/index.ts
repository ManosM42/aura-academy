// supabase/functions/verify-checkout-session/index.ts
import Stripe from "npm:stripe@^18";
import { createClient } from "npm:@supabase/supabase-js@^2";
import {
  ACCESS_STATUSES,
  recordInvoice,
  refId,
  syncSubscription,
} from "../_shared/billing.ts";

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

  let sessionId: unknown;
  try {
    const parsed = JSON.parse(await req.text()) as { sessionId?: unknown };
    sessionId = parsed?.sessionId;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (typeof sessionId !== "string" || !sessionId.startsWith("cs_")) {
    return json({ error: "Μη έγκυρο session πληρωμής." }, 400);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  const user = userData?.user;
  if (userError || !user) {
    console.error("getUser failed", userError?.message ?? "no user");
    return json({ error: "Unauthorized" }, 401);
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const stripe = new Stripe(stripeKey);

  try {
    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription", "subscription.items.data.price"],
    });

    const ownerId =
      checkoutSession.client_reference_id ?? checkoutSession.metadata?.supabase_user_id ?? null;

    if (ownerId !== user.id) {
      console.error("Session ownership mismatch", { sessionId, ownerId, caller: user.id });
      return json({ error: "Το session δεν ανήκει σε αυτόν τον χρήστη." }, 403);
    }

    if (checkoutSession.status !== "complete") {
      return json({
        state: "pending",
        hasAccess: false,
        subscription: null,
        sessionStatus: checkoutSession.status,
        paymentStatus: checkoutSession.payment_status,
      });
    }

    const subRef = checkoutSession.subscription;
    if (!subRef) {
      console.error("Completed session without subscription", sessionId);
      return json({ error: "Η πληρωμή δεν δημιούργησε συνδρομή." }, 502);
    }

    const subscription: Stripe.Subscription =
      typeof subRef === "string"
        ? await stripe.subscriptions.retrieve(subRef, { expand: ["items.data.price"] })
        : subRef;

    const customerId = refId(subscription.customer);
    if (customerId) {
      const { error: customerError } = await admin
        .from("stripe_customers")
        .upsert({ user_id: user.id, stripe_customer_id: customerId }, { onConflict: "user_id" });
      if (customerError) console.error("stripe_customers upsert failed", customerError.message);
    }

    const synced = await syncSubscription(admin, subscription, {
      planId: checkoutSession.metadata?.plan_id,
      userId: user.id,
    });

    if (!synced) {
      return json({ error: "Δεν αναγνωρίστηκε το πακέτο." }, 502);
    }

    // Record the first payment right away, so income shows up even before
    // the webhook arrives. Never block the user's access on this.
    try {
      const invoiceId = refId(subscription.latest_invoice);
      if (invoiceId) {
        let invoice: Stripe.Invoice;
        try {
          invoice = await stripe.invoices.retrieve(invoiceId, { expand: ["payments"] });
        } catch {
          invoice = await stripe.invoices.retrieve(invoiceId);
        }
        await recordInvoice(admin, invoice, { userId: user.id, planId: synced.planId });
      }
    } catch (err) {
      console.error("Could not record the first payment (webhook will)", err);
    }

    const hasAccess = ACCESS_STATUSES.includes(subscription.status);
    const { data: stored } = await admin
      .from("subscriptions")
      .select("current_period_end, cancel_at_period_end")
      .eq("stripe_subscription_id", subscription.id)
      .maybeSingle();

    return json({
      state: hasAccess ? "active" : "pending",
      hasAccess,
      subscription: {
        planId: synced.planId,
        status: subscription.status,
        currentPeriodEnd: stored?.current_period_end ?? null,
        cancelAtPeriodEnd: stored?.cancel_at_period_end ?? false,
      },
    });
  } catch (error) {
    console.error("verify-checkout-session failed", error);
    const message = error instanceof Error ? error.message : String(error);
    return json({ error: `Η επιβεβαίωση απέτυχε: ${message}` }, 500);
  }
});