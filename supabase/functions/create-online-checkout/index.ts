// Deploy: supabase functions deploy create-online-checkout --no-verify-jwt
// Secret:  STRIPE_SECRET_KEY
import Stripe from "https://esm.sh/stripe@16.12.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { quoteForCaller } from "../_shared/discount.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  // Always answer the preflight first, before touching anything that can fail.
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: CORS });
  if (req.method !== "POST") return reply({ error: "method_not_allowed" }, 405);

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!stripeKey) return reply({ error: "stripe_key_missing" }, 500);
    if (!url || !serviceKey) return reply({ error: "supabase_env_missing" }, 500);

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
    const db = createClient(url, serviceKey);

    const { seminarId, fullName, email, phone } = await req.json();
    if (!seminarId || !fullName?.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email ?? "") || !phone?.trim()) {
      return reply({ error: "invalid_input" }, 400);
    }

    const { data: seminar } = await db
      .from("online_seminars")
      .select("*")
      .eq("id", seminarId)
      .eq("published", true)
      .single();
    if (!seminar) return reply({ error: "not_found" }, 404);

    if (seminar.capacity) {
      const { count } = await db
        .from("online_seminar_bookings")
        .select("id", { count: "exact", head: true })
        .eq("seminar_id", seminarId)
        .eq("status", "paid");
      if ((count ?? 0) >= seminar.capacity) return reply({ error: "sold_out" }, 409);
    }

    // Member price: decided here, from the caller's verified session. Guests and
    // plans without a discount pay the list price set by the admin.
    const quote = await quoteForCaller(req, db, "online_seminar", seminar.price_cents);

    const bookingId = crypto.randomUUID();
    const session = await stripe.checkout.sessions.create({
      ui_mode: "embedded",
      mode: "payment",
      redirect_on_completion: "never",
      customer_email: email.trim(),
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: seminar.currency,
            unit_amount: quote.finalCents,
            product_data: {
              name: `Online seminar: ${seminar.title}`,
              ...(quote.percent > 0
                ? { description: `AURA member discount -${quote.percent}% (list price ${(quote.listCents / 100).toFixed(2)})` }
                : {}),
            },
          },
        },
      ],
      metadata: {
        booking_id: bookingId,
        seminar_id: seminarId,
        discount_percent: String(quote.percent),
      },
    });

    const { error } = await db.from("online_seminar_bookings").insert({
      id: bookingId,
      seminar_id: seminarId,
      full_name: fullName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      amount_cents: quote.finalCents,
      list_price_cents: quote.listCents,
      discount_percent: quote.percent,
      user_id: quote.userId,
      stripe_session_id: session.id,
    });
    if (error) throw error;

    return reply({
      clientSecret: session.client_secret,
      sessionId: session.id,
      amountCents: quote.finalCents,
      listPriceCents: quote.listCents,
      discountPercent: quote.percent,
    });
  } catch (e) {
    console.error("create-online-checkout failed:", e);
    return reply({ error: "server_error", detail: String((e as Error)?.message ?? e) }, 500);
  }
});