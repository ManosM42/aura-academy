import { isPlanId, type PlanId } from "@/lib/plans";

const KEY = "aura.checkout.intent";

/** Αποθηκεύει το πακέτο που διάλεξε ο επισκέπτης πριν στείλουμε στο login. */
export function setCheckoutIntent(planId: PlanId): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY, planId);
  } catch {
    // Private mode / storage disabled — απλά χάνεται η πρόθεση, δεν σπάει η ροή.
  }
}

/** Επιστρέφει και καθαρίζει την πρόθεση. Καλείται μετά από επιτυχές login. */
export function consumeCheckoutIntent(): PlanId | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.sessionStorage.getItem(KEY);
    window.sessionStorage.removeItem(KEY);
    return isPlanId(value) ? value : null;
  } catch {
    return null;
  }
}

export function clearCheckoutIntent(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* no-op */
  }
}