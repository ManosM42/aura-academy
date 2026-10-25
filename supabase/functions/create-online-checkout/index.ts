// supabase functions deploy create-online-checkout --no-verify-jwt
// secrets: STRIPE_SECRET_KEY (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are provided automatically)
import Stripe from "https://esm.sh/stripe@16.12.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { seminarId, fullName, email, phone } = await req.json();
    if (!seminarId || !fullName?.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email ?? "") || !phone?.trim()) {
      return json({ error: "invalid_input" }, 400);
    }

    const { data: seminar } = await db
      .from("online_seminars")
      .select("*")
      .eq("id", seminarId)
      .eq("published", true)
      .single();
    if (!seminar) return json({ error: "not_found" }, 404);

    if (seminar.capacity) {
      const { count } = await db
        .from("online_seminar_bookings")
        .select("id", { count: "exact", head: true })
        .eq("seminar_id", seminarId)
        .eq("status", "paid");
      if ((count ?? 0) >= seminar.capacity) return json({ error: "sold_out" }, 409);
    }

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
            unit_amount: seminar.price_cents,
            product_data: { name: `Online seminar: ${seminar.title}` },
          },
        },
      ],
      metadata: { booking_id: bookingId, seminar_id: seminarId },
    });

    const { error } = await db.from("online_seminar_bookings").insert({
      id: bookingId,
      seminar_id: seminarId,
      full_name: fullName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      amount_cents: seminar.price_cents,
      stripe_session_id: session.id,
    });
    if (error) throw error;

    return json({ clientSecret: session.client_secret, sessionId: session.id });
  } catch (e) {
    console.error(e);
    return json({ error: "server_error" }, 500);
  }
});