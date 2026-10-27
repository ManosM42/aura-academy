// Deploy: supabase functions deploy confirm-book-order --no-verify-jwt
// Secret:  STRIPE_SECRET_KEY
//
// Called by the browser after Stripe says the embedded checkout completed.
// We NEVER trust the browser: the payment is re-checked directly with Stripe.
// Idempotent: safe to call many times, stock is decremented only once.
import Stripe from "https://esm.sh/stripe@16.12.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-retry-count, traceparent, tracestate, baggage",
  "Access-Control-Max-Age": "86400",
};

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: CORS });
  if (req.method !== "POST") return reply({ error: "method_not_allowed" }, 405);

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!stripeKey || !url || !serviceKey) return reply({ error: "server_misconfigured" }, 500);

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
    const db = createClient(url, serviceKey, { auth: { persistSession: false } });

    const { orderId } = await req.json();
    if (typeof orderId !== "string" || !UUID.test(orderId)) {
      return reply({ error: "invalid_input" }, 400);
    }

    const { data: order } = await db
      .from("book_orders")
      .select("id, status, quantity, stripe_session_id")
      .eq("id", orderId)
      .maybeSingle();
    if (!order) return reply({ error: "not_found" }, 404);
    if (order.status !== "pending") return reply({ status: order.status });
    if (!order.stripe_session_id) return reply({ error: "no_session" }, 409);

    const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id);
    if (session.payment_status !== "paid") return reply({ status: "pending" });

    // Only the first caller flips pending -> paid, so stock drops exactly once.
    const { data: updated } = await db
      .from("book_orders")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", orderId)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (updated) await db.rpc("decrement_book_stock", { p_qty: order.quantity });

    return reply({ status: "paid" });
  } catch (e) {
    console.error("confirm-book-order failed:", e);
    return reply({ error: "server_error", detail: String((e as Error)?.message ?? e) }, 500);
  }
});