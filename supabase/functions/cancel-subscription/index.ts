// supabase/functions/cancel-subscription/index.ts
// Σταματάει τη συνδρομή "στο τέλος της τρέχουσας περιόδου" (Stripe
// cancel_at_period_end), ΠΟΤΕ άμεσο cancel. Ο χρήστης κρατάει πρόσβαση
// μέχρι να λήξει ό,τι έχει ήδη πληρώσει και απλώς δεν χρεώνεται ξανά.
//
// ΠΡΟΣΟΧΗ ΑΣΦΑΛΕΙΑΣ: δεν δεχόμαστε ΠΟΤΕ subscriptionId από το request body.
// Το βρίσκουμε ΜΟΝΟΙ ΜΑΣ από τη γραμμή του authenticated χρήστη στη βάση,
// ώστε να μην μπορεί κανείς να ακυρώσει τη συνδρομή κάποιου άλλου.
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

// Δεν ακυρώνουμε γραμμές που είναι ήδη σε τελική κατάσταση.
const NON_CANCELLABLE_STATUSES = new Set(["canceled", "incomplete_expired"]);

/**
 * current_period_end ζει σε διαφορετικό μέρος ανάλογα με το Stripe API
 * version — ίδια λογική με το verify-checkout-session.
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

  // 1. Ταυτοποίηση χρήστη — ΠΡΙΝ αγγίξουμε οτιδήποτε σχετικό με Stripe.
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
    // 2. Βρίσκουμε ΤΗ ΔΙΚΗ ΤΟΥ πιο πρόσφατη γραμμή συνδρομής — ποτέ κάτι
    //    που να έρχεται από το request.
    const { data: row, error: rowError } = await admin
      .from("subscriptions")
      .select("id, status, stripe_subscription_id, cancel_at_period_end")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (rowError) {
      console.error("subscriptions lookup failed", rowError.message);
      return json({ error: "Δεν ήταν δυνατή η ανάγνωση της συνδρομής." }, 500);
    }

    if (!row?.stripe_subscription_id) {
      return json({ error: "Δεν βρέθηκε συνδρομή για ακύρωση." }, 404);
    }

    if (NON_CANCELLABLE_STATUSES.has(row.status)) {
      return json({ error: "Η συνδρομή δεν είναι ενεργή." }, 409);
    }

    // 3. Ήδη προγραμματισμένη για ακύρωση — idempotent, δεν ξαναχτυπάμε Stripe.
    if (row.cancel_at_period_end) {
      const current = await stripe.subscriptions.retrieve(
        row.stripe_subscription_id,
      );
      return json({
        success: true,
        subscription: {
          status: current.status,
          currentPeriodEnd: resolvePeriodEnd(current),
          cancelAtPeriodEnd: true,
        },
      });
    }

    // 4. Το Stripe είναι η πηγή αλήθειας: cancel_at_period_end = true.
    //    ΔΕΝ κάνουμε immediate cancel — ο χρήστης κρατάει πρόσβαση μέχρι
    //    το τέλος της τρέχουσας, ήδη πληρωμένης, περιόδου.
    const updated = await stripe.subscriptions.update(
      row.stripe_subscription_id,
      { cancel_at_period_end: true },
    );

    // 5. Συγχρονισμός της γραμμής μας με ό,τι επιβεβαίωσε το Stripe.
    //    Ίδιο upsert-shape με το webhook — όποιο τρέξει δεύτερο απλώς
    //    ξαναγράφει τα ίδια δεδομένα, άρα δεν υπάρχει race condition.
    const { error: updateError } = await admin
      .from("subscriptions")
      .update({
        status: updated.status,
        current_period_end: resolvePeriodEnd(updated),
        cancel_at_period_end: updated.cancel_at_period_end ?? true,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .eq("stripe_subscription_id", row.stripe_subscription_id);

    if (updateError) {
      // Το Stripe ήδη το έκανε — απλώς δεν προλάβαμε να το γράψουμε.
      // Ο webhook (customer.subscription.updated) θα το συμπληρώσει.
      console.error("subscriptions update failed", updateError.message);
    }

    return json({
      success: true,
      subscription: {
        status: updated.status,
        currentPeriodEnd: resolvePeriodEnd(updated),
        cancelAtPeriodEnd: updated.cancel_at_period_end ?? true,
      },
    });
  } catch (error) {
    console.error("cancel-subscription failed", error);
    const message = error instanceof Error ? error.message : String(error);
    return json({ error: `Η ακύρωση απέτυχε: ${message}` }, 500);
  }
});