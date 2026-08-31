export type PlanId = "full" | "core" | "starter";

export interface AuraPlan {
  id: PlanId;
  /** Τίτλος καρτέλας */
  name: string;
  /** Μικρή περιγραφή κάτω από τον τίτλο */
  tagline: string;
  /** Ετικέτα πάνω από τον τίτλο (μόνο στο highlighted) */
  badge?: string;
  priceLabel: string;
  /** Σε cents — μόνο για εμφάνιση/έλεγχο, η αλήθεια είναι το Stripe Price */
  amountCents: number;
  currency: "usd";
  interval: "month";
  haircuts: number;
  features: string[];
  highlight: boolean;
}

export const AURA_PLANS: AuraPlan[] = [
  {
    id: "full",
    name: "ΠΛΗΡΗΣ ΜΕΘΟΔΟΣ",
    tagline: "Όλη η μέθοδος, όλα τα εργαλεία, χωρίς περιορισμούς.",
    badge: "ΠΛΗΡΗΣ ΕΜΠΕΙΡΙΑ",
    priceLabel: "79.99$",
    amountCents: 7999,
    currency: "usd",
    interval: "month",
    haircuts: 20,
    features: [
      "20 ΚΟΥΡΕΜΑΤΑ",
      "MINIMAIA VIDEO",
      "ΑΚΥΡΩΣΗ ΑΝΑ ΠΑΣΑ ΣΤΙΓΜΗ",
      "ΜΑΘΕ ΟΣΟ ΠΑΡΑΚΟΛΟΥΘΕΙΣ",
      "ΠΙΣΤΟΠΟΙΗΤΙΚΟ ΟΛΟΚΛΗΡΩΣΗΣ",
      "ΠΡΟΣΒΑΣΗ ΣΕ ΝΕΑ ΒΙΝΤΕΟ",
    ],
    highlight: true,
  },
  {
    id: "core",
    name: "ΒΑΣΙΚΗ ΜΕΘΟΔΟΣ",
    tagline: "Η μέθοδος στην ουσία της.",
    priceLabel: "59.99$",
    amountCents: 5999,
    currency: "usd",
    interval: "month",
    haircuts: 12,
    features: [
      "12 ΚΟΥΡΕΜΑΤΑ",
      "MINIMAIA VIDEO",
      "ΑΚΥΡΩΣΗ ΑΝΑ ΠΑΣΑ ΣΤΙΓΜΗ",
      "ΜΑΘΕ ΟΣΟ ΠΑΡΑΚΟΛΟΥΘΕΙΣ",
    ],
    highlight: false,
  },
  {
    id: "starter",
    name: "ΑΡΧΙΚΗ ΜΕΘΟΔΟΣ",
    tagline: "Η πρώτη γνωριμία με τη μέθοδο.",
    priceLabel: "39.99$",
    amountCents: 3999,
    currency: "usd",
    interval: "month",
    haircuts: 6,
    features: ["6 ΚΟΥΡΕΜΑΤΑ", "MINIMAIA VIDEO", "ΑΚΥΡΩΣΗ ΑΝΑ ΠΑΣΑ ΣΤΙΓΜΗ"],
    highlight: false,
  },
];

export function isPlanId(value: unknown): value is PlanId {
  return value === "full" || value === "core" || value === "starter";
}

export function getPlan(id: string | undefined | null): AuraPlan | undefined {
  if (!isPlanId(id)) return undefined;
  return AURA_PLANS.find((plan) => plan.id === id);
}