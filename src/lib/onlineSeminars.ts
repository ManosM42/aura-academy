
import { supabase } from "@/lib/supabase";

export type OnlineSeminar = {
  id: string;
  title: string;
  description: string;
  starts_at: string;
  duration_minutes: number;
  price_cents: number;
  currency: string;
  capacity: number | null;
  published: boolean;
  created_at: string;
};

export type PublicOnlineSeminar = Omit<
  OnlineSeminar,
  "published" | "created_at"
> & { taken: number };

export type OnlineBooking = {
  id: string;
  seminar_id: string;
  full_name: string;
  email: string;
  phone: string;
  status: "pending" | "paid" | "failed" | "refunded";
  amount_cents: number | null;
  /** Price before the member discount. Null for older bookings. */
  list_price_cents?: number | null;
  discount_percent?: number | null;
  paid_at: string | null;
  created_at: string;
  online_seminars: { title: string; starts_at: string } | null;
};

export type SeminarInput = Omit<OnlineSeminar, "id" | "created_at">;

export function formatPrice(cents: number, currency = "eur") {
  return new Intl.NumberFormat("el-GR", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

export async function getPublicOnlineSeminars(): Promise<PublicOnlineSeminar[]> {
  const { data, error } = await supabase
    .from("online_seminars_public")
    .select("*")
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as PublicOnlineSeminar[];
}

export async function getAdminOnlineSeminars(): Promise<OnlineSeminar[]> {
  const { data, error } = await supabase
    .from("online_seminars")
    .select("*")
    .order("starts_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as OnlineSeminar[];
}

export async function saveOnlineSeminar(input: SeminarInput, id?: string) {
  const query = id
    ? supabase.from("online_seminars").update(input).eq("id", id)
    : supabase.from("online_seminars").insert(input);

  const { error } = await query;
  if (error) throw error;
}

export async function setOnlineSeminarPublished(
  id: string,
  published: boolean,
) {
  const { error } = await supabase
    .from("online_seminars")
    .update({ published })
    .eq("id", id);

  if (error) throw error;
}

export async function deleteOnlineSeminar(id: string) {
  const { error } = await supabase
    .from("online_seminars")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

export async function getOnlineBookings(): Promise<OnlineBooking[]> {
  const { data, error } = await supabase
    .from("online_seminar_bookings")
    .select("*, online_seminars(title, starts_at)")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as OnlineBooking[];
}

export async function setOnlineBookingStatus(
  id: string,
  status: OnlineBooking["status"],
) {
  const { error } = await supabase
    .from("online_seminar_bookings")
    .update({
      status,
      paid_at: status === "paid" ? new Date().toISOString() : null,
    })
    .eq("id", id);

  if (error) throw error;
}

/* -------------------------------------------------------------------------- */
/* Viva.com Smart Checkout                                                    */
/* -------------------------------------------------------------------------- */

export interface OnlineCheckoutResult {
  /** Viva hosted Smart Checkout URL. */
  redirectUrl: string;
  /** Internal AURA booking ID. Used to check payment status after checkout. */
  bookingId: string;
  amountCents: number;
  listPriceCents: number;
  discountPercent: number;
  currency: "EUR";
  provider: "viva";
}

/**
 * Only allow redirects to the official Viva Smart Checkout hosts.
 * This prevents an unexpected URL from the Edge Function being trusted.
 */
function isValidVivaCheckoutUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;

  try {
    const url = new URL(value);

    const allowedHosts = [
      "demo.vivapayments.com",
      "www.vivapayments.com",
    ];

    return (
      url.protocol === "https:" &&
      allowedHosts.includes(url.hostname) &&
      url.pathname === "/web/checkout" &&
      /^\d{6,20}$/.test(url.searchParams.get("ref") ?? "")
    );
  } catch {
    return false;
  }
}

export async function startOnlineCheckout(p: {
  seminarId: string;
  fullName: string;
  email: string;
  phone: string;
}): Promise<OnlineCheckoutResult> {
  // Use the existing Supabase client configuration.
  const url = (supabase as any).supabaseUrl as string;
  const key = (supabase as any).supabaseKey as string;

  if (!url || !key) {
    throw new Error("supabase_config_missing");
  }

  // Send the authenticated user's token when available.
  // The Edge Function verifies the user and calculates any member discount.
  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();

  if (sessionError) {
    throw new Error("session_error");
  }

  const bearer = sessionData.session?.access_token ?? key;

  let response: Response;

  try {
    response = await fetch(
      `${url}/functions/v1/create-online-checkout`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: key,
          Authorization: `Bearer ${bearer}`,
        },
        body: JSON.stringify({
          seminarId: p.seminarId,
          fullName: p.fullName.trim(),
          email: p.email.trim(),
          phone: p.phone.trim(),
        }),
      },
    );
  } catch {
    throw new Error("network_error");
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    console.error("create-online-checkout failed:", response.status, data);
    throw new Error(data?.error ?? "checkout_creation_failed");
  }

  if (
    !data ||
    !isValidVivaCheckoutUrl(data.redirectUrl) ||
    typeof data.bookingId !== "string" ||
    !data.bookingId ||
    typeof data.amountCents !== "number" ||
    typeof data.listPriceCents !== "number" ||
    typeof data.discountPercent !== "number"
  ) {
    console.error("Invalid Viva checkout response:", data);
    throw new Error("invalid_viva_checkout_response");
  }

  return {
    redirectUrl: data.redirectUrl,
    bookingId: data.bookingId,
    amountCents: data.amountCents,
    listPriceCents: data.listPriceCents,
    discountPercent: data.discountPercent,
    currency: "EUR",
    provider: "viva",
  };
}

/**
 * Polls AURA until the Viva webhook marks this booking as paid.
 *
 * IMPORTANT:
 * The get_online_booking_status RPC must accept p_booking_id
 * and return the booking status. It must no longer search by Stripe session ID.
 */
export async function waitForPaid(
  bookingId: string,
  tries = 20,
  delayMs = 2000,
): Promise<boolean> {
  if (!bookingId) {
    throw new Error("booking_id_required");
  }

  for (let i = 0; i < tries; i++) {
    const { data, error } = await supabase.rpc(
      "get_online_booking_status",
      { p_booking_id: bookingId },
    );

    if (error) {
      console.error("get_online_booking_status failed:", error);
      throw new Error("booking_status_check_failed");
    }

    if (data === "paid") return true;
    if (data === "failed" || data === "refunded") return false;

    if (i < tries - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return false;
}
