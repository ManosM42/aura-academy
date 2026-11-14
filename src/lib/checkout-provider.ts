// src/lib/checkout-provider.ts
//
// Which payment provider does THIS visitor's checkout use?
// The database decides (public.get_my_checkout_provider); the Edge Function
// re-checks the same rule, so the browser can never force Viva.
// If anything goes wrong we fall back to Stripe, i.e. today's behaviour.
import { db } from "@/lib/db";

export type CheckoutProvider = "stripe" | "viva";

export async function getCheckoutProvider(): Promise<CheckoutProvider> {
  try {
    const { data, error } = await db.rpc("get_my_checkout_provider");
    if (error) {
      console.error("get_my_checkout_provider:", error.message);
      return "stripe";
    }
    return data === "viva" ? "viva" : "stripe";
  } catch {
    return "stripe";
  }
}
