// supabase/functions/admin-billing-sync/index.ts
//
// Admin-only. Pulls the truth from Stripe into the database:
//   1. every subscription  -> public.subscriptions (status, period end, cancel flag)
//   2. every PAID invoice  -> public.payments      (income, last payment, renewals)
//   3. refunds             -> payments.amount_refunded_cents
// Safe to run any time (everything is an idempotent upsert).
import Stripe from "npm:stripe@^18";
import { createClient } from "npm:@supabase/supabase-js@^2";
import { recordInvoice, refId, syncSubscription, UserDeletedError } from "../_shared/billing.ts";

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

const MAX_ERRORS_REPORTED = 10;

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

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  const user = userData?.user;
  if (userError || !user) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // Admin check (same rule as public.is_admin_user()).
  const { data: profile } = await admin
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .maybeSingle();
  const isAdmin =
    Boolean(profile) &&
    ["admin", "super_admin"].includes(String(profile?.role)) &&
    String(profile?.status ?? "active") === "active";
  if (!isAdmin) return json({ error: "Forbidden" }, 403);

  const stripe = new Stripe(stripeKey);
  const result = {
    subscriptions: 0,
    skippedSubscriptions: 0,
    payments: 0,
    refunds: 0,
    errors: [] as string[],
  };
  const note = (msg: string) => {
    console.error(msg);
    if (result.errors.length < MAX_ERRORS_REPORTED) result.errors.push(msg);
  };

  try {
    // 1. Subscriptions
    for await (const sub of stripe.subscriptions.list({ status: "all", limit: 100 })) {
      try {
        const synced = await syncSubscription(admin, sub);
        if (synced) result.subscriptions += 1;
        else result.skippedSubscriptions += 1;
      } catch (err) {
        if (err instanceof UserDeletedError) {
          result.skippedSubscriptions += 1; // belongs to a deleted account
          continue;
        }
        note(`subscription ${sub.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // 2. Paid invoices (try to expand the payment intent for refunds)
    const sweepInvoices = async (expandPayments: boolean) => {
      const params: Stripe.InvoiceListParams = { status: "paid", limit: 100 };
      if (expandPayments) params.expand = ["data.payments"];
      for await (const inv of stripe.invoices.list(params)) {
        try {
          if (await recordInvoice(admin, inv)) result.payments += 1;
        } catch (err) {
          note(`invoice ${inv.id}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    };
    try {
      await sweepInvoices(true);
    } catch (err) {
      note(`invoice expand failed, retrying plain: ${err instanceof Error ? err.message : String(err)}`);
      result.payments = 0;
      await sweepInvoices(false);
    }

    // 3. Refunds (best effort)
    try {
      const refunded = new Map<string, number>();
      for await (const refund of stripe.refunds.list({ limit: 100 })) {
        if (refund.status !== "succeeded") continue;
        const pi = refId(refund.payment_intent);
        if (!pi) continue;
        refunded.set(pi, (refunded.get(pi) ?? 0) + (refund.amount ?? 0));
      }
      for (const [pi, cents] of refunded) {
        const { error } = await admin
          .from("payments")
          .update({ amount_refunded_cents: cents })
          .eq("stripe_payment_intent_id", pi);
        if (error) note(`refund ${pi}: ${error.message}`);
        else result.refunds += 1;
      }
    } catch (err) {
      note(`refunds: ${err instanceof Error ? err.message : String(err)}`);
    }

    return json({ ok: true, ...result });
  } catch (error) {
    console.error("admin-billing-sync failed", error);
    const message = error instanceof Error ? error.message : String(error);
    return json({ error: `Ο συγχρονισμός απέτυχε: ${message}`, ...result }, 500);
  }
});