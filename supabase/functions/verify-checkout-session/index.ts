// supabase/functions/verify-checkout-session/index.ts
import Stripe from "npm:stripe@^18";
import { createClient } from "npm:@supabase/supabase-js@^2";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

type PlanId = "full" | "core" | "starter";

const PLAN_PRICE_ENV: Record<PlanId, string> = {
  full: "STRIPE_PRICE_FULL",
  core: "STRIPE_PRICE_CORE",
  starter: "STRIPE_PRICE_STARTER",
};

const ACCESS_STATUSES = new Set(["active", "trialing"]);

function isPlanId(value: unknown): value is PlanId {
  return value === "full" || value === "core" || value === "starter";
}

/** Αντίστροφη αντιστοίχιση price -> plan, για session χωρίς metadata. */
function planFromPrice(priceId: string | null): PlanId | null {
  if (!priceId) return null;
  for (const [plan, envName] of Object.entries(PLAN_PRICE_ENV) as [
    PlanId,
    string,
  ][]) {
    if (Deno.env.get(envName) === priceId) return plan;
  }
  return null;
}

/**
 * Στα νεότερα Stripe API versions το current_period_end έφυγε από το
 * Subscription και ζει στα subscription items. Δοκιμάζουμε και τα δύο.
 */
type PeriodBearing = { current_period_end?: number | null };

function resolvePeriodEnd(sub: Stripe.Subscription): string | null {
  const item = sub.items?.data?.[0] as
    | (Stripe.SubscriptionItem & PeriodBearing)
    | undefined;
  const fromItem = item?.current_period_end;
  const fromSub = (sub as unknown as PeriodBearing).current_period_end;
  const seconds =
    typeof fromItem === "number"
      ? fromItem
      : typeof fromSub === "number"
        ? fromSub
        : null;
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

function priceIdOf(sub: Stripe.Subscription): string | null {
  const price = sub.items?.data?.[0]?.price;
  if (!price) return null;
  return typeof price === "string" ? price : price.id;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
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

  // 1. Body πρώτα, ώστε ένα χαλασμένο request να φαίνεται πάντα στα logs.
  let rawBody = "";
  try {
    rawBody = await req.text();
  } catch (readError) {
    console.error("Could not read request body", readError);
    return json({ error: "Invalid JSON body" }, 400);
  }

  let sessionId: unknown;
  try {
    const parsed = JSON.parse(rawBody) as { sessionId?: unknown };
    sessionId = parsed?.sessionId;
  } catch {
    console.error("Invalid JSON body", {
      contentType: req.headers.get("content-type"),
      preview: rawBody.slice(0, 200),
    });
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (typeof sessionId !== "string" || !sessionId.startsWith("cs_")) {
    console.error("Invalid sessionId", { received: sessionId });
    return json({ error: "Μη έγκυρο session πληρωμής." }, 400);
  }

  // 2. Ταυτοποίηση χρήστη.
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    console.error("Missing bearer token");
    return json({ error: "Unauthorized" }, 401);
  }

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

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });
  const stripe = new Stripe(stripeKey);

  try {
    // 3. Το Stripe είναι η πηγή αλήθειας.
    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription", "subscription.items.data.price"],
    });

    // 4. Ο καλών πρέπει να είναι ο κάτοχος του session.
    const ownerId =
      checkoutSession.client_reference_id ??
      checkoutSession.metadata?.supabase_user_id ??
      null;

    if (ownerId !== user.id) {
      console.error("Session ownership mismatch", {
        sessionId,
        ownerId,
        caller: user.id,
      });
      return json({ error: "Το session δεν ανήκει σε αυτόν τον χρήστη." }, 403);
    }

    // 5. Ακόμα σε εξέλιξη: δεν γράφουμε τίποτα.
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
        ? await stripe.subscriptions.retrieve(subRef, {
            expand: ["items.data.price"],
          })
        : subRef;

    const metaPlan = checkoutSession.metadata?.plan_id;
    const planId: PlanId | null = isPlanId(metaPlan)
      ? metaPlan
      : planFromPrice(priceIdOf(subscription));

    if (!planId) {
      console.error("Could not resolve plan", {
        sessionId,
        metaPlan,
        priceId: priceIdOf(subscription),
      });
      return json({ error: "Δεν αναγνωρίστηκε το πακέτο." }, 502);
    }

    const customerId =
      typeof subscription.customer === "string"
        ? subscription.customer
        : (subscription.customer?.id ?? null);

    // 6. stripe_customers: idempotent.
    if (customerId) {
      const { error: customerError } = await admin
        .from("stripe_customers")
        .upsert(
          { user_id: user.id, stripe_customer_id: customerId },
          { onConflict: "user_id" },
        );
      if (customerError) {
        console.error("stripe_customers upsert failed", customerError.message);
      }
    }

    // 7. subscriptions: ίδιο upsert με το webhook, άρα όποιο τρέξει
    //    δεύτερο απλώς ξαναγράφει τα ίδια δεδομένα.
    const row = {
      user_id: user.id,
      plan_id: planId,
      status: subscription.status,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      current_period_end: resolvePeriodEnd(subscription),
      cancel_at_period_end: subscription.cancel_at_period_end ?? false,
      updated_at: new Date().toISOString(),
    };

    const { error: upsertError } = await admin
      .from("subscriptions")
      .upsert(row, { onConflict: "stripe_subscription_id" });

    if (upsertError) {
      console.error("subscriptions upsert failed", upsertError.message);
      return json(
        { error: `Η καταγραφή της συνδρομής απέτυχε: ${upsertError.message}` },
        500,
      );
    }

    const hasAccess = ACCESS_STATUSES.has(subscription.status);

    return json({
      state: hasAccess ? "active" : "pending",
      hasAccess,
      subscription: {
        planId,
        status: subscription.status,
        currentPeriodEnd: row.current_period_end,
        cancelAtPeriodEnd: row.cancel_at_period_end,
      },
    });
  } catch (error) {
    console.error("verify-checkout-session failed", error);
    const message = error instanceof Error ? error.message : String(error);
    return json({ error: `Η επιβεβαίωση απέτυχε: ${message}` }, 500);
  }
});