// src/lib/checkout-intent.ts
import { isPlanId, type PlanId } from "@/lib/plans";

const KEY = "aura.checkout.intent";
/** Λήγει σε 30′ — αρκεί για OAuth round trip, όχι για την επόμενη μέρα. */
const TTL_MS = 30 * 60 * 1000;

interface StoredIntent {
  plan: PlanId;
  savedAt: number;
}

function store(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    // localStorage αντί sessionStorage: το OAuth μπορεί να επιστρέψει σε
    // νέο tab (in-app browsers στο κινητό), όπου το sessionStorage είναι άδειο.
    return window.localStorage;
  } catch {
    return null;
  }
}

function parse(raw: string | null): PlanId | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredIntent>;
    if (!isPlanId(parsed.plan) || typeof parsed.savedAt !== "number") return null;
    if (Date.now() - parsed.savedAt > TTL_MS) return null;
    return parsed.plan;
  } catch {
    return null;
  }
}

/** Αποθηκεύει το πακέτο που διάλεξε ο επισκέπτης πριν τον στείλουμε στο login. */
export function setCheckoutIntent(planId: PlanId): void {
  const s = store();
  if (!s) return;
  try {
    const payload: StoredIntent = { plan: planId, savedAt: Date.now() };
    s.setItem(KEY, JSON.stringify(payload));
  } catch {
    // Private mode / γεμάτο storage — ο χρήστης ξαναδιαλέγει πακέτο.
  }
}

/** Διαβάζει χωρίς να σβήνει. */
export function peekCheckoutIntent(): PlanId | null {
  const s = store();
  return s ? parse(s.getItem(KEY)) : null;
}

/** Διαβάζει ΚΑΙ σβήνει. Μόνο τη στιγμή του redirect προς checkout. */
export function consumeCheckoutIntent(): PlanId | null {
  const plan = peekCheckoutIntent();
  clearCheckoutIntent();
  return plan;
}

export function clearCheckoutIntent(): void {
  const s = store();
  if (!s) return;
  try {
    s.removeItem(KEY);
  } catch {
    /* no-op */
  }
}