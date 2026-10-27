// Deploy: supabase functions deploy create-book-checkout --no-verify-jwt
// Secret:  STRIPE_SECRET_KEY
//
// The PRICE NEVER comes from the browser: it is read from book_settings,
// which only an admin can edit.
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

const str = (v: unknown, max = 200) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: CORS });
  if (req.method !== "POST") return reply({ error: "method_not_allowed" }, 405);

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!stripeKey) return reply({ error: "stripe_key_missing" }, 500);
    if (!url || !serviceKey) return reply({ error: "supabase_env_missing" }, 500);

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
    const db = createClient(url, serviceKey, { auth: { persistSession: false } });

    const body = await req.json();
    const quantity = Math.floor(Number(body.quantity));
    const fullName = str(body.fullName);
    const email = str(body.email, 254);
    const phone = str(body.phone, 40);
    const addressLine1 = str(body.addressLine1);
    const addressLine2 = str(body.addressLine2);
    const city = str(body.city, 100);
    const region = str(body.region, 100);
    const postalCode = str(body.postalCode, 20);
    const country = str(body.country, 100);
    const notes = str(body.notes, 500);

    if (
      !Number.isFinite(quantity) || quantity < 1 || quantity > 10 ||
      !fullName || !phone || !addressLine1 || !city || !postalCode || !country ||
      !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)
    ) {
      return reply({ error: "invalid_input" }, 400);
    }

    const { data: settings } = await db
      .from("book_settings")
      .select("*")
      .eq("id", 1)
      .single();
    if (!settings || !settings.is_active || settings.price_cents <= 0) {
      return reply({ error: "book_unavailable" }, 409);
    }
    if (settings.stock !== null && settings.stock < quantity) {
      return reply({ error: "sold_out" }, 409);
    }

    const unit = settings.price_cents as number;
    const shipping = settings.shipping_cents as number;
    const total = unit * quantity + shipping;
    const orderId = crypto.randomUUID();

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        quantity,
        price_data: {
          currency: settings.currency,
          unit_amount: unit,
          product_data: { name: settings.title },
        },
      },
    ];
    if (shipping > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: settings.currency,
          unit_amount: shipping,
          product_data: { name: "Shipping" },
        },
      });
    }

    const session = await stripe.checkout.sessions.create({
      ui_mode: "embedded",
      mode: "payment",
      redirect_on_completion: "never",
      customer_email: email,
      line_items: lineItems,
      metadata: { order_id: orderId, kind: "book" },
    });

    const { error } = await db.from("book_orders").insert({
      id: orderId,
      quantity,
      unit_price_cents: unit,
      shipping_cents: shipping,
      total_cents: total,
      currency: settings.currency,
      full_name: fullName,
      email,
      phone,
      address_line1: addressLine1,
      address_line2: addressLine2 || null,
      city,
      region: region || null,
      postal_code: postalCode,
      country,
      notes: notes || null,
      stripe_session_id: session.id,
    });
    if (error) throw error;

    return reply({ clientSecret: session.client_secret, orderId, totalCents: total });
  } catch (e) {
    console.error("create-book-checkout failed:", e);
    return reply({ error: "server_error", detail: String((e as Error)?.message ?? e) }, 500);
  }
});