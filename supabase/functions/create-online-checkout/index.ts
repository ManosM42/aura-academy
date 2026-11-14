
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
// supabase functions deploy create-online-checkout --no-verify-jwt
//
// Secrets:
// VIVA_ENV=sandbox
// VIVA_SANDBOX_CLIENT_ID
// VIVA_SANDBOX_CLIENT_SECRET
// VIVA_SANDBOX_SOURCE_CODE

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

  let bookingId: string | null = null;

  try {
    const body = await req.json();

    const seminarId = str(body.seminarId, 100);
    const fullName = str(body.fullName);
    const email = str(body.email, 254).toLowerCase();
    const phone = str(body.phone, 40);

    if (
      !seminarId ||
      !fullName ||
      !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ||
      !phone
    ) {
      return reply({ error: "invalid_input" }, 400);
    }

    // 1. Read the seminar and its price from Supabase.
    const { data: seminar, error: seminarError } = await db
      .from("online_seminars")
      .select("*")
      .eq("id", seminarId)
      .eq("published", true)
      .single();

    if (seminarError || !seminar) {
      return reply({ error: "not_found" }, 404);
    }

    const listPrice = Number(seminar.price_cents);
    const currency = String(seminar.currency ?? "eur").toLowerCase();

    if (
      !Number.isSafeInteger(listPrice) ||
      listPrice <= 0 ||
      currency !== "eur"
    ) {
      console.error("Invalid seminar price or currency");
      return reply({ error: "invalid_seminar_configuration" }, 500);
    }

    // 2. Check seminar capacity.
    if (seminar.capacity !== null && seminar.capacity !== undefined) {
      const { count, error: countError } = await db
        .from("online_seminar_bookings")
        .select("id", { count: "exact", head: true })
        .eq("seminar_id", seminarId)
        .in("status", ["pending", "paid"]);

      if (countError) throw countError;

      if ((count ?? 0) >= Number(seminar.capacity)) {
        return reply({ error: "sold_out" }, 409);
      }
    }

    // 3. Calculate the member discount server-side.
    const quote = await quoteForCaller(
      req,
      db,
      "online_seminar",
      listPrice,
    );

    const amountCents = quote.finalCents;

    if (
      !Number.isSafeInteger(amountCents) ||
      amountCents <= 0
    ) {
      return reply({ error: "invalid_payment_amount" }, 500);
    }

    // 4. Create the internal booking first.
    bookingId = crypto.randomUUID();

    const { error: insertError } = await db
      .from("online_seminar_bookings")
      .insert({
        id: bookingId,
        seminar_id: seminarId,
        full_name: fullName,
        email,
        phone,
        amount_cents: amountCents,
        list_price_cents: quote.listCents,
        discount_percent: quote.percent,
        user_id: quote.userId,
        status: "pending",
        paid_at: null,
        stripe_session_id: null,
        payment_provider: "viva",
        payment_environment: cfg.env,
        viva_order_code: null,
      });

    if (insertError) {
      console.error("Booking insert failed:", insertError.message);
      return reply({ error: "booking_creation_failed" }, 500);
    }

    // 5. Create the Viva Smart Checkout order.
    // merchantTrns links the payment to our internal booking.
    let vivaOrderCode: string;

    try {
      const created = await createPaymentOrder(cfg, {
        amountCents,
        merchantTrns: bookingId,
        customerTrns: `AURA Online Seminar - ${seminar.title}`,
        customer: {
          email,
          fullName,
          requestLang: "el-GR",
        },
        allowRecurring: false,
        paymentTimeoutSeconds: 1800,
        tags: [
          "aura-online-seminar",
          `booking-${bookingId}`,
          `seminar-${seminarId}`,
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
        .from("online_seminar_bookings")
        .update({ status: "failed" })
        .eq("id", bookingId)
        .eq("status", "pending");

      return reply({ error: "viva_order_creation_failed" }, 502);
    }

    // 6. Persist the Viva order reference before redirecting.
    const { error: updateError } = await db
      .from("online_seminar_bookings")
      .update({ viva_order_code: vivaOrderCode })
      .eq("id", bookingId)
      .eq("status", "pending");

    if (updateError) {
      console.error("Could not save Viva order code:", updateError.message);

      await db
        .from("online_seminar_bookings")
        .update({ status: "failed" })
        .eq("id", bookingId);

      return reply({ error: "could_not_save_payment_reference" }, 500);
    }

    // 7. Return Viva's secure hosted checkout URL.
    return reply({
      redirectUrl: checkoutRedirectUrl(cfg, vivaOrderCode),
      bookingId,
      amountCents,
      listPriceCents: quote.listCents,
      discountPercent: quote.percent,
      currency: "EUR",
      provider: "viva",
    });

  } catch (error) {
    console.error(
      "create-online-checkout failed:",
      error instanceof Error ? error.message : "unknown",
    );

    if (bookingId) {
      await db
        .from("online_seminar_bookings")
        .update({ status: "failed" })
        .eq("id", bookingId)
        .eq("status", "pending");
    }

    return reply({ error: "server_error" }, 500);
  }
});
