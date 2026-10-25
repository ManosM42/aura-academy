import { supabase } from "@/lib/supabase"; // <- adjust to wherever your Supabase client lives

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

export type PublicOnlineSeminar = Omit<OnlineSeminar, "published" | "created_at"> & { taken: number };

export type OnlineBooking = {
  id: string;
  seminar_id: string;
  full_name: string;
  email: string;
  phone: string;
  status: "pending" | "paid" | "failed" | "refunded";
  amount_cents: number | null;
  paid_at: string | null;
  created_at: string;
  online_seminars: { title: string; starts_at: string } | null;
};

export type SeminarInput = Omit<OnlineSeminar, "id" | "created_at">;

export function formatPrice(cents: number, currency = "eur") {
  return new Intl.NumberFormat("el-GR", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
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
  const q = id
    ? supabase.from("online_seminars").update(input).eq("id", id)
    : supabase.from("online_seminars").insert(input);
  const { error } = await q;
  if (error) throw error;
}

export async function setOnlineSeminarPublished(id: string, published: boolean) {
  const { error } = await supabase.from("online_seminars").update({ published }).eq("id", id);
  if (error) throw error;
}

export async function deleteOnlineSeminar(id: string) {
  const { error } = await supabase.from("online_seminars").delete().eq("id", id);
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

export async function setOnlineBookingStatus(id: string, status: OnlineBooking["status"]) {
  const { error } = await supabase
    .from("online_seminar_bookings")
    .update({ status, paid_at: status === "paid" ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw error;
}

export async function startOnlineCheckout(p: {
  seminarId: string;
  fullName: string;
  email: string;
  phone: string;
}): Promise<{ clientSecret: string; sessionId: string }> {
  // Plain fetch to the edge function so the real error code is never hidden.
  const url = (supabase as any).supabaseUrl as string;
  const key = (supabase as any).supabaseKey as string;

  let res: Response;
  try {
    res = await fetch(`${url}/functions/v1/create-online-checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify(p),
    });
  } catch {
    throw new Error("network_error");
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.clientSecret) {
    console.error("create-online-checkout:", res.status, data);
    throw new Error(data?.error ?? "server_error");
  }
  return data;
}

/** Polls until the Stripe webhook has marked the booking as paid. */
export async function waitForPaid(sessionId: string, tries = 12, delayMs = 1500): Promise<boolean> {
  for (let i = 0; i < tries; i++) {
    const { data } = await supabase.rpc("get_online_booking_status", { p_session: sessionId });
    if (data === "paid") return true;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
}