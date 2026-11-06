// src/lib/plans.ts
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
  stripePriceId: string; // βάλε τα νέα Price IDs από το Stripe (βλ. οδηγίες)
  features: string[];
  highlight: boolean;
}

export const AURA_PLANS: AuraPlan[] = [
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
    stripePriceId: "price_1UYmcfLnBpuAzyZYjd8sJZmB",
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
    stripePriceId: "price_1UYmdKLnBpuAzyZYxr6UrDFH",
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
    stripePriceId: "price_1UYmdqLnBpuAzyZYoFITGf2H",
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

export function isPlanId(value: unknown): value is PlanId {
  return value === "low" || value === "mid" || value === "high";
}

export function getPlan(id: string | undefined | null): AuraPlan | undefined {
  if (!isPlanId(id)) return undefined;
  return AURA_PLANS.find((plan) => plan.id === id);
  
}
