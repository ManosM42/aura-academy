// src/lib/ranks.ts

export type PlanId = "low" | "mid" | "high" | "limited";

export interface AuraPlan {
  id: PlanId;
  name: string;
  tagline: string;
  badge?: string;
  priceLabel: string;
  amountCents: number;
  currency: "usd";
  interval: "month";
  stripePriceId: string; // Connected Stripe price key
  features: string[];
  highlight: boolean;
}

export const AURA_PLANS: AuraPlan[] = [
  {
    id: "low",
    name: "LOW METHOD",
    tagline: "Η βασική είσοδος στην ακαδημία και την κοινότητα.",
    priceLabel: "24,99$",
    amountCents: 2499,
    currency: "usd",
    interval: "month",
    stripePriceId: "price_1UCnzNLnBpuAzyZY2gfMNHHf", // Replace with actual Stripe Price ID
    features: [
      "ΠΡΟΣΒΑΣΗ ΣΤΗΝ ACADEMY",
      "ΜΗΝΙΑΙΑ VIDEOS",
      "ΑΥΡΑ SOCIAL ACCESS",
      "ΑΚΥΡΩΣΗ ΑΝΑ ΠΑΣΑ ΣΤΙΓΜΗ",
    ],
    highlight: false,
  },
  {
    id: "mid",
    name: "MID METHOD",
    tagline: "Προχώρησε επίπεδο με ενεργό Aura Rank και αξιολογήσεις.",
    badge: "ΔΗΜΟΦΙΛΕΣ",
    priceLabel: "45,99$",
    amountCents: 4599,
    currency: "usd",
    interval: "month",
    stripePriceId: "price_1UCo03LnBpuAzyZYR1QsDcNZ", // Replace with actual Stripe Price ID
    features: [
      "ΠΡΟΣΒΑΣΗ ΣΤΟ AURA RANK",
      "ΠΡΟΣΒΑΣΗ ΣΤΟ REVIEW SYSTEM",
      "AURA CERTIFICATION",
      "+ ΟΛΑ ΑΠΟ ΤΟ LOW METHOD",
    ],
    highlight: true,
  },
  {
    id: "high",
    name: "HIGH METHOD",
    tagline: "Ολική εμβάθυνση με αποκλειστικό E-book και πλήρη εργαλεία.",
    priceLabel: "65,99$",
    amountCents: 6599,
    currency: "usd",
    interval: "month",
    stripePriceId: "price_1UCo0PLnBpuAzyZYajqu8c5Q", // Replace with actual Stripe Price ID
    features: [
      "E-BOOK of AURA PROFESSIONAL HAIR METHOD",
      "+ ΟΛΑ ΑΠΟ MID & LOW METHOD",
      "ΠΡΟΧΩΡΗΜΕΝΑ VIDEOS ΚΟΥΡΕΜΑΤΩΝ",
      "ΠΡΟΤΕΡΑΙΟΤΗΤΑ ΣΤΟ SUPPORT",
    ],
    highlight: false,
  },
  {
    id: "limited",
    name: "LIMITED EDITION PHYSICAL BOOK",
    tagline: "Η απόλυτη εμπειρία: Φυσικό βιβλίο + QR codes για αποκλειστικά videos.",
    badge: "ΣΥΛΛΕΚΤΙΚΟ",
    priceLabel: "149.99$",
    amountCents: 14999,
    currency: "usd",
    interval: "month",
    stripePriceId: "price_1UCo0qLnBpuAzyZYABo0Prch", // Replace with actual Stripe Price ID
    features: [
      "PREMIUM ΦΥΣΙΚΟ ΑΥΘΕΝΤΙΚΟ AURA PROFESSIONAL HAIR METHOD BOOK ΜΕ QR CODES",
      "ΠΡΟΣΒΑΣΗ ΣΕ LIMITED VIDEOS ΜΕΣΩ QR CODES ΤΟΥ ΒΙΒΛΙΟΥ",
      "VIP STATUS ΣΤΗΝ ΚΟΙΝΟΤΗΤΑ",
      "ΔΗΜΙΟΥΡΓΙΑ ΠΟΣΤ ΣΤΟ ACADEMY FEED",
      "+ ΟΛΑ ΑΠΟ ΤΟ HIGH METHOD",
    ],
    highlight: false,
  },
];

export function isPlanId(value: unknown): value is PlanId {
  return value === "low" || value === "mid" || value === "high" || value === "limited";
}

export function getPlan(id: string | undefined | null): AuraPlan | undefined {
  if (!isPlanId(id)) return undefined;
  return AURA_PLANS.find((plan) => plan.id === id);
}