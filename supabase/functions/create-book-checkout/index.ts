
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { quoteForCaller } from "../_shared/discount.ts";
import {
  loadVivaConfig,
  createPaymentOrder,
  checkoutRedirectUrl,
  VivaConfigError,
  VivaApiError,
} from "../_shared/viva.ts";

// Deploy:
// supabase functions deploy create-book-checkout --no-verify-jwt
//
// Required secrets:
// VIVA_ENV=sandbox
// VIVA_SANDBOX_CLIENT_ID
// VIVA_SANDBOX_CLIENT_SECRET
// VIVA_SANDBOX_SOURCE_CODE
// SUPABASE_URL
// SUPABASE_SERVICE_ROLE_KEY

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
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: CORS });
  }

  if (req.method !== "POST") {
    return reply({ error: "method_not_allowed" }, 405);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !serviceKey) {
    return reply({ error: "supabase_env_missing" }, 500);
  }

  let cfg;

  try {
    cfg = loadVivaConfig((name) => Deno.env.get(name));
  } catch (error) {
    console.error(
      "Viva configuration error:",
      error instanceof VivaConfigError ? error.message : "unknown",
    );
    return reply({ error: "viva_configuration_error" }, 500);
  }

  const db = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  let orderId: string | null = null;

  try {
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
      !Number.isFinite(quantity) ||
      quantity < 1 ||
      quantity > 10 ||
      !fullName ||
      !phone ||
      !addressLine1 ||
      !city ||
      !postalCode ||
      !country ||
      !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)
    ) {
      return reply({ error: "invalid_input" }, 400);
    }

    // 1. Read the authoritative book price from Supabase.
    const { data: settings, error: settingsError } = await db
      .from("book_settings")
      .select("*")
      .eq("id", 1)
      .single();

    if (settingsError || !settings || !settings.is_active) {
      return reply({ error: "book_unavailable" }, 409);
    }

    const listPrice = Number(settings.price_cents);
    const shipping = Number(settings.shipping_cents ?? 0);
    const currency = String(settings.currency ?? "eur").toLowerCase();

    if (
      !Number.isSafeInteger(listPrice) ||
      listPrice <= 0 ||
      !Number.isSafeInteger(shipping) ||
      shipping < 0 ||
      currency !== "eur"
    ) {
      console.error("Invalid book settings");
      return reply({ error: "invalid_book_configuration" }, 500);
    }

    if (
      settings.stock !== null &&
      Number(settings.stock) < quantity
    ) {
      return reply({ error: "sold_out" }, 409);
    }

    // 2. Apply the existing server-side member discount.
    // Shipping is deliberately NOT discounted.
    const quote = await quoteForCaller(
      req,
      db,
      "book",
      listPrice,
    );

    const unit = quote.finalCents;
    const total = unit * quantity + shipping;

    if (
      !Number.isSafeInteger(unit) ||
      unit <= 0 ||
      !Number.isSafeInteger(total) ||
      total <= 0
    ) {
      return reply({ error: "invalid_payment_amount" }, 500);
    }

    // 3. Create our internal order FIRST.
    // Its UUID is sent to Viva as merchantTrns.
    orderId = crypto.randomUUID();

    const { error: insertError } = await db
      .from("book_orders")
      .insert({
        id: orderId,
        quantity,
        unit_price_cents: unit,
        list_unit_price_cents: quote.listCents,
        discount_percent: quote.percent,
        user_id: quote.userId,
        shipping_cents: shipping,
        total_cents: total,
        currency,
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
        status: "pending",
        payment_provider: "viva",
        payment_environment: cfg.env,
        viva_order_code: null,
        stripe_session_id: null,
      });

    if (insertError) {
      console.error("Book order insert failed:", insertError.message);
      return reply({ error: "could_not_create_book_order" }, 500);
    }

    // 4. Create the Viva Smart Checkout order.
    // Amount is calculated entirely on the server.
    let vivaOrderCode: string;

    try {
      const created = await createPaymentOrder(cfg, {
        amountCents: total,
        merchantTrns: orderId,
        customerTrns: `AURA Academy - ${String(settings.title)} x${quantity}`,
        customer: {
          email,
          fullName,
          requestLang: "el-GR",
        },
        allowRecurring: false,
        paymentTimeoutSeconds: 1800,
        tags: [
          "aura-book",
          `order-${orderId}`,
          `quantity-${quantity}`,
        ],
      });

      vivaOrderCode = created.orderCode;
    } catch (error) {
      console.error(
        "Viva order creation failed:",
        error instanceof VivaApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "unknown",
      );

      await db
        .from("book_orders")
        .update({
          status: "cancelled",
        })
        .eq("id", orderId)
        .eq("status", "pending");

      return reply({ error: "viva_order_creation_failed" }, 502);
    }

    // 5. Persist Viva's order code BEFORE redirecting the customer.
    const { error: updateError } = await db
      .from("book_orders")
      .update({
        viva_order_code: vivaOrderCode,
      })
      .eq("id", orderId)
      .eq("status", "pending");

    if (updateError) {
      console.error("Could not save Viva order code:", updateError.message);

      await db
        .from("book_orders")
        .update({ status: "cancelled" })
        .eq("id", orderId);

      // Never redirect if we cannot match the payment to our order.
      return reply({ error: "could_not_save_payment_reference" }, 500);
    }

    // 6. Return the secure Viva redirect URL.
    return reply({
      redirectUrl: checkoutRedirectUrl(cfg, vivaOrderCode),
      orderId,
      totalCents: total,
      unitPriceCents: unit,
      shippingCents: shipping,
      discountPercent: quote.percent,
      currency: "EUR",
      provider: "viva",
    });
  } catch (error) {
    console.error(
      "create-book-checkout failed:",
      error instanceof Error ? error.message : "unknown",
    );

    if (orderId) {
      await db
        .from("book_orders")
        .update({ status: "cancelled" })
        .eq("id", orderId)
        .eq("status", "pending");
    }

    return reply({ error: "server_error" }, 500);
  }
});
