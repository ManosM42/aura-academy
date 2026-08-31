// src/lib/create-checkout-session.ts
import { supabase } from "@/lib/supabase";
import type { PlanId } from "@/lib/plans";

/**
 * Calls the create-checkout-session Edge Function and returns the Stripe
 * client secret. Throws an Error whose message is the function's own error
 * text, so failures are readable instead of "non-2xx status code".
 */
export async function createCheckoutSession(planId: PlanId): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{
    clientSecret?: string;
    sessionId?: string;
    error?: string;
  }>("create-checkout-session", {
    body: { planId },
  });

  if (error) {
    // FunctionsHttpError carries the original Response on `context`.
    const res = (error as { context?: Response }).context;
    if (res && typeof res.json === "function") {
      try {
        const payload = (await res.json()) as { error?: string };
        if (payload?.error) throw new Error(payload.error);
      } catch (parseErr) {
        if (parseErr instanceof Error && parseErr.message) throw parseErr;
      }
    }
    throw new Error(error.message || "Checkout could not be started.");
  }

  if (data?.error) throw new Error(data.error);
  if (!data?.clientSecret) throw new Error("Stripe returned no client secret.");

  return data.clientSecret;
}

