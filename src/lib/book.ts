// src/lib/book.ts
import { supabase } from "@/lib/supabase";

export interface BookSettings {
  id: number;
  title: string;
  price_cents: number;
  shipping_cents: number;
  currency: string;
  stock: number | null;
  is_active: boolean;
  updated_at: string;
}

export type BookOrderStatus =
  | "pending"
  | "paid"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

export interface BookOrder {
  id: string;
  created_at: string;
  status: BookOrderStatus;
  quantity: number;
  unit_price_cents: number;
  shipping_cents: number;
  total_cents: number;
  currency: string;
  full_name: string;
  email: string;
  phone: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  region: string | null;
  postal_code: string;
  country: string;
  notes: string | null;
  tracking_number: string | null;
  admin_note: string | null;
  paid_at: string | null;
  shipped_at: string | null;
}

export interface ShippingInput {
  quantity: number;
  fullName: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  notes: string;
}

export function formatMoney(cents: number, currency = "eur"): string {
  return new Intl.NumberFormat("el-GR", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

const ERROR_TEXT: Record<string, string> = {
  invalid_input: "Please check your details and try again.",
  sold_out: "Sorry, there are not enough copies left.",
  book_unavailable: "The book is not available for ordering right now.",
  not_found: "We could not find this order.",
  server_error: "Something went wrong on our side. Please try again.",
};

async function invoke<T>(name: string, body: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });

  if (error) {
    const res = (error as { context?: Response }).context;
    if (res && typeof res.json === "function") {
      try {
        const payload = (await res.json()) as { error?: string };
        if (payload?.error) throw new Error(ERROR_TEXT[payload.error] ?? payload.error);
      } catch (e) {
        if (e instanceof Error && e.message) throw e;
      }
    }
    throw new Error(error.message || "Request failed.");
  }

  const payload = data as { error?: string } | null;
  if (payload?.error) throw new Error(ERROR_TEXT[payload.error] ?? payload.error);
  return data as T;
}

/* ------------------------------ public ------------------------------ */

export async function getBookSettings(): Promise<BookSettings | null> {
  const { data, error } = await supabase
    .from("book_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as BookSettings | null) ?? null;
}

export function createBookCheckout(input: ShippingInput) {
  return invoke<{ clientSecret: string; orderId: string; totalCents: number }>(
    "create-book-checkout",
    input,
  );
}

export function confirmBookOrder(orderId: string) {
  return invoke<{ status: BookOrderStatus }>("confirm-book-order", { orderId });
}

/* ------------------------------- admin ------------------------------ */

export async function updateBookSettings(patch: {
  title: string;
  price_cents: number;
  shipping_cents: number;
  stock: number | null;
  is_active: boolean;
}): Promise<BookSettings> {
  const { data, error } = await supabase
    .from("book_settings")
    .upsert({ id: 1, ...patch })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as BookSettings;
}

export async function getBookOrders(): Promise<BookOrder[]> {
  const { data, error } = await supabase
    .from("book_orders")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as BookOrder[];
}

export async function updateBookOrder(
  id: string,
  patch: {
    status: BookOrderStatus;
    tracking_number: string | null;
    admin_note: string | null;
    shipped_at?: string;
  },
): Promise<BookOrder> {
  const { data, error } = await supabase
    .from("book_orders")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as BookOrder;
}