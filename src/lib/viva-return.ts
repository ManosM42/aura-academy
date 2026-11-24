// src/lib/viva-return.ts
//
// What Viva puts in the URL when it sends a customer back to the site:
//   success:  ?t=<transaction id>&s=<order code>&lang=el-GR&eventId=0
//   refused / cancelled:  ?s=<order code>&lang=el-GR&eventId=<code>      (NO t)
// These parameters are never trusted: the checkout return page hands them to
// the server, which asks Viva directly what happened.
import { supabase } from "@/lib/supabase";

const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export interface VivaReturnParams {
  /** Transaction id: only present when the payment went through. */
  t: string | null;
  /** Viva order code. */
  s: string;
  /** Viva event id. */
  eventId: number | null;
}

/** Reads the parameters if (and only if) the URL looks like a return from Viva. */
export function readVivaReturnParams(search: string | URLSearchParams): VivaReturnParams | null {
  const sp = typeof search === "string" ? new URLSearchParams(search) : search;
  const s = sp.get("s");
  if (!s || !/^\d{6,20}$/.test(s)) return null;

  const tRaw = sp.get("t");
  const t = tRaw && UUID.test(tRaw) ? tRaw.toLowerCase() : null;
  const eRaw = sp.get("eventId");
  const eventId = eRaw !== null && /^\d{1,7}$/.test(eRaw) ? Number(eRaw) : null;

  // A real Viva return has either the transaction id or an event id.
  if (t === null && eventId === null) return null;
  return { t, s, eventId };
}

export type VivaPageStatus = "paid" | "pending" | "failed" | "unknown";

export interface VivaVerifyResult {
  /** subscription_initial | subscription_renewal | subscription_upgrade | seminar | book */
  kind: string;
  status: VivaPageStatus;
  label: string | null;
  amountCents: number | null;
  eventId: number | null;
}

/** Asks the server to confirm the payment with Viva (safe to call repeatedly). */
export async function verifyVivaPayment(p: VivaReturnParams): Promise<VivaVerifyResult> {
  const { data, error } = await supabase.functions.invoke<Partial<VivaVerifyResult> & { error?: string }>("verify-viva-payment", {
    body: { t: p.t, s: p.s, eventId: p.eventId },
  });

  if (error) {
    const res = (error as { context?: Response }).context;
    // An order we do not know is a definite answer, not a glitch.
    if (res && res.status === 404) return { kind: "unknown", status: "unknown", label: null, amountCents: null, eventId: p.eventId };
    throw new Error(error.message || "Η επαλήθευση της πληρωμής δεν ήταν δυνατή.");
  }
  const status = data?.status;
  return {
    kind: data?.kind ?? "unknown",
    status: status === "paid" || status === "pending" || status === "failed" ? status : "unknown",
    label: data?.label ?? null,
    amountCents: typeof data?.amountCents === "number" ? data.amountCents : null,
    eventId: typeof data?.eventId === "number" ? data.eventId : p.eventId,
  };
}

/** Plain-language explanation shown when a payment did not go through. */
export function failureMessage(eventId: number | null | undefined): string {
  const code = typeof eventId === "number" ? ` (κωδικός Viva: ${eventId})` : "";
  return `Η πληρωμή δεν ολοκληρώθηκε${code}. Δεν χρεώθηκες. Έλεγξε τα στοιχεία της κάρτας, δοκίμασε άλλη κάρτα ή ξαναπροσπάθησε.`;
}
