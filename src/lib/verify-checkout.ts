// src/lib/verify-checkout.ts
import { supabase } from "@/lib/supabase";

export interface VerifiedSubscription {
  planId: string;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface VerifyResult {
  state: "active" | "pending";
  hasAccess: boolean;
  subscription: VerifiedSubscription | null;
}

interface VerifyPayload extends Partial<VerifyResult> {
  error?: string;
}

/**
 * Επιβεβαιώνει το Stripe Checkout Session και γράφει τη συνδρομή
 * χωρίς να περιμένει το webhook. Είναι idempotent: μπορεί να κληθεί
 * όσες φορές χρειαστεί για το ίδιο session.
 */
export async function verifyCheckoutSession(
  sessionId: string,
): Promise<VerifyResult> {
  const { data, error } = await supabase.functions.invoke<VerifyPayload>(
    "verify-checkout-session",
    { body: { sessionId } },
  );

  if (error) {
    // Το FunctionsHttpError κρατά το αρχικό Response στο `context`.
    const res = (error as { context?: Response }).context;
    if (res && typeof res.json === "function") {
      try {
        const payload = (await res.json()) as { error?: string };
        if (payload?.error) throw new Error(payload.error);
      } catch (parseErr) {
        if (parseErr instanceof Error && parseErr.message) throw parseErr;
      }
    }
    throw new Error(error.message || "Η επιβεβαίωση της πληρωμής απέτυχε.");
  }

  if (!data) throw new Error("Κενή απάντηση από τον server.");
  if (data.error) throw new Error(data.error);

  return {
    state: data.state ?? "pending",
    hasAccess: Boolean(data.hasAccess),
    subscription: data.subscription ?? null,
  };
}