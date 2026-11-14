// src/lib/create-viva-checkout.ts
import { supabase } from "@/lib/supabase";
import type { PlanId } from "@/lib/plans";

/** The only places a customer may be sent to pay (demo and live Smart Checkout). */
const ALLOWED_CHECKOUT_PREFIXES = [
  "https://demo.vivapayments.com/web/checkout?ref=",
  "https://www.vivapayments.com/web/checkout?ref=",
];

export function isVivaCheckoutUrl(url: string): boolean {
  return ALLOWED_CHECKOUT_PREFIXES.some((prefix) => url.startsWith(prefix));
}

/**
 * Asks the create-viva-checkout Edge Function for a payment page and returns
 * its URL. The browser sends ONLY the plan id: price, user and eligibility are
 * all decided on the server. Throws an Error with a readable message.
 */
export async function createVivaCheckout(planId: PlanId): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{
    redirectUrl?: string;
    error?: string;
  }>("create-viva-checkout", { body: { planId } });

  if (error) {
    const res = (error as { context?: Response }).context;
    if (res && typeof res.json === "function") {
      try {
        const payload = (await res.json()) as { error?: string };
        if (payload?.error) throw new Error(payload.error);
      } catch (parseErr) {
        if (parseErr instanceof Error && parseErr.message) throw parseErr;
      }
    }
    throw new Error(error.message || "Η πληρωμή δεν μπόρεσε να ξεκινήσει.");
  }

  if (data?.error) throw new Error(data.error);
  const url = data?.redirectUrl;
  // Never follow an address we do not recognise.
  if (!url || !isVivaCheckoutUrl(url)) throw new Error("Δεν δημιουργήθηκε σελίδα πληρωμής.");
  return url;
}
