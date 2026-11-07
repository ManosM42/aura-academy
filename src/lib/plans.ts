// src/lib/plans.ts
//
// The REAL plans (names, features, prices) now live in the database table
// `public.plans` and are edited from /admin/plans-and-users.
// The list below is only the fallback used if the database cannot be reached,
// and the shape/types every page shares.
export type PlanId = "low" | "mid" | "high";

export interface AuraPlan {
  id: PlanId;
  name: string;
  slogan: string;
  tagline: string;
  badge?: string;
  priceLabel: string;
  amountCents: number;
  currency: "eur";
  interval: "month";
  /** Deprecated: prices are no longer configured in Stripe. Kept so old code compiles. */
  stripePriceId?: string;
  features: string[];
  highlight: boolean;
}

/** 2499 -> "24,99€" */
export function formatEuro(cents: number): string {
  const euros = cents / 100;
  const text = Number.isInteger(euros)
    ? String(euros)
    : euros.toFixed(2).replace(".", ",");
  return `${text}€`;
}

export const AURA_DEFAULT_PLANS: AuraPlan[] = [
  {
    id: "low",
    name: "AURA BASIC",
    slogan: "ENTER THE AURA SYSTEM.",
    tagline:
      "Η πρώτη επαφή με την εκπαιδευτική φιλοσοφία και τη μεθοδολογία της AURA. Για barbers που θέλουν να αποκτήσουν πρόσβαση σε επαγγελματική γνώση και να ξεκινήσουν την εξέλιξή τους.",
    priceLabel: "24,99€",
    amountCents: 2499,
    currency: "eur",
    interval: "month",
    features: [
      "Μηνιαία εκπαιδευτικά videos",
      "AURA Social Access",
      "Πρόσβαση στο Review System",
      "AURA Find Job – πρόσβαση σε επαγγελματικές ευκαιρίες",
      "Δυνατότητα ακύρωσης ανά πάσα στιγμή",
    ],
    highlight: false,
  },
  {
    id: "mid",
    name: "AURA PRO",
    slogan: "MASTER YOUR CRAFT.",
    tagline:
      "Ένα ολοκληρωμένο εκπαιδευτικό επίπεδο για barbers που θέλουν να αναπτύξουν την τεχνική τους, να διευρύνουν τις γνώσεις τους και να εξελίξουν την επαγγελματική τους ταυτότητα.",
    badge: "ΔΗΜΟΦΙΛΕΣ",
    priceLabel: "49,99€",
    amountCents: 4999,
    currency: "eur",
    interval: "month",
    features: [
      "Όλα τα προνόμια του AURA BASIC",
      "Προχωρημένα εκπαιδευτικά videos κουρεμάτων",
      "Πρόσβαση στο AURA Certification",
      "50% έκπτωση στο AURA Professional Hair Method E-book",
      "25% έκπτωση στο αυθεντικό φυσικό AURA Professional Hair Method Book με QR Codes",
      "10% έκπτωση στα προϊόντα FORZA BRAVA",
      "Δυνατότητα ακύρωσης ανά πάσα στιγμή",
    ],
    highlight: true,
  },
  {
    id: "high",
    name: "AURA ELITE",
    slogan: "DON’T JUST LEARN. EVOLVE.",
    tagline:
      "Το ανώτερο επίπεδο εκπαίδευσης της AURA. Μια αποκλειστική εμπειρία που συνδυάζει εξειδικευμένη εκπαίδευση, προσωπική καθοδήγηση, αξιολόγηση και επαγγελματική εξέλιξη.",
    priceLabel: "79,99€",
    amountCents: 7999,
    currency: "eur",
    interval: "month",
    features: [
      "Όλα τα προνόμια του AURA PRO",
      "Προσωπικό AURA Portfolio",
      "Προσωπική αξιολόγηση κουρεμάτων από εκπαιδευτή AURA",
      "Έως 4 προσωπικές αξιολογήσεις τον μήνα",
      "Αναλυτικό feedback και προτάσεις βελτίωσης",
      "AURA Personal Progress Tracking",
      "Αποκλειστικά ELITE εκπαιδευτικά μαθήματα",
      "AURA Elite Challenges – μηνιαίες εκπαιδευτικές προκλήσεις",
      "Early Access – πρώτοι στα νέα εκπαιδευτικά videos πριν από τη δημοσίευσή τους",
      "Αποκλειστική ιδιωτική κοινότητα AURA ELITE",
      "VIP Community Status",
      "Προτεραιότητα στο Support",
      "Πρόσβαση δημοσίευσης εργασιών στην Ακαδημία",
      "50% έκπτωση στο φυσικό AURA Professional Hair Method Book",
      "25% έκπτωση στα AURA Online Seminars",
      "10% έκπτωση στα προϊόντα FORZA BRAVA",
      "Δυνατότητα ακύρωσης ανά πάσα στιγμή",
    ],
    highlight: false,
  },
];

/** Backward compatible name: still the static defaults. Prefer usePlans(). */
export const AURA_PLANS = AURA_DEFAULT_PLANS;

/* ------------------------------------------------------------------ */
/* Live plans (filled by usePlans from the database)                   */
/* ------------------------------------------------------------------ */

let livePlans: AuraPlan[] | null = null;
const listeners = new Set<() => void>();

export function setLivePlans(next: AuraPlan[] | null): void {
  livePlans = next;
  listeners.forEach((l) => l());
}

export function getLivePlans(): AuraPlan[] {
  return livePlans ?? AURA_DEFAULT_PLANS;
}

export function subscribePlans(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isPlanId(value: unknown): value is PlanId {
  return value === "low" || value === "mid" || value === "high";
}

/** Live (admin-edited) plan if loaded, otherwise the default one. */
export function getPlan(id: string | undefined | null): AuraPlan | undefined {
  if (!isPlanId(id)) return undefined;
  return (
    getLivePlans().find((plan) => plan.id === id) ??
    AURA_DEFAULT_PLANS.find((plan) => plan.id === id)
  );
}