// src/lib/cancel-subscription.ts
import { supabase } from "@/lib/supabase";

export interface CancelSubscriptionResult {
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

/**
 * Calls the cancel-subscription Edge Function. Schedules the CALLER'S OWN
 * subscription to stop renewing at the end of the current, already-paid
 * period — never an immediate cancel, never touches anyone else's plan.
 * Throws an Error whose message is the function's own error text.
 */
export async function cancelMySubscription(): Promise<CancelSubscriptionResult> {
  const { data, error } = await supabase.functions.invoke<{
    success?: boolean;
    subscription?: CancelSubscriptionResult;
    error?: string;
  }>("cancel-subscription", { body: {} });

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
    throw new Error(error.message || "Η ακύρωση απέτυχε.");
  }

  if (data?.error) throw new Error(data.error);
  if (!data?.subscription) throw new Error("Το Stripe δεν επέστρεψε κατάσταση συνδρομής.");

  return data.subscription;
}