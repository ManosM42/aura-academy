// src/lib/billingProfile.ts
//
// The customer's personal details, asked in the checkout and kept for the admin.
// Saved through a database function that validates every field again on the
// server and only ever writes the signed-in customer's own row.
import { db } from "@/lib/db";

export interface BillingProfile {
  full_name: string;
  phone: string;
  address_line1: string;
  address_line2: string;
  city: string;
  postal_code: string;
  country: string;
  wants_invoice: boolean;
  company_name: string;
  vat_number: string;
  tax_office: string;
}

export const EMPTY_BILLING_PROFILE: BillingProfile = {
  full_name: "",
  phone: "",
  address_line1: "",
  address_line2: "",
  city: "",
  postal_code: "",
  country: "Ελλάδα",
  wants_invoice: false,
  company_name: "",
  vat_number: "",
  tax_office: "",
};

export type ProfileErrors = Partial<Record<keyof BillingProfile, string>>;

const MESSAGES = {
  full_name: "Γράψε το ονοματεπώνυμό σου.",
  phone: "Γράψε ένα έγκυρο τηλέφωνο.",
  address_line1: "Γράψε τη διεύθυνσή σου.",
  address_line2: "Η διεύθυνση είναι πολύ μεγάλη.",
  city: "Γράψε την πόλη σου.",
  postal_code: "Γράψε τον ταχυδρομικό κώδικα.",
  country: "Γράψε τη χώρα σου.",
  company_name: "Γράψε την επωνυμία της επιχείρησης.",
  vat_number: "Γράψε έγκυρο ΑΦΜ (8-14 χαρακτήρες).",
  tax_office: "Γράψε τη ΔΟΥ.",
} as const;

/** The same rules the database applies, so the customer sees the problem before sending. */
export function validateBillingProfile(p: BillingProfile): ProfileErrors {
  const e: ProfileErrors = {};
  const len = (v: string) => v.trim().length;
  if (len(p.full_name) < 2 || len(p.full_name) > 120) e.full_name = MESSAGES.full_name;
  if (!/^[0-9+()\s.-]{6,40}$/.test(p.phone.trim())) e.phone = MESSAGES.phone;
  if (len(p.address_line1) < 3 || len(p.address_line1) > 200) e.address_line1 = MESSAGES.address_line1;
  if (len(p.city) < 2 || len(p.city) > 100) e.city = MESSAGES.city;
  if (len(p.postal_code) < 2 || len(p.postal_code) > 20) e.postal_code = MESSAGES.postal_code;
  if (len(p.country) < 2 || len(p.country) > 100) e.country = MESSAGES.country;
  if (p.wants_invoice) {
    if (len(p.company_name) < 1 || len(p.company_name) > 200) e.company_name = MESSAGES.company_name;
    if (!/^[A-Za-z0-9]{8,14}$/.test(p.vat_number.replace(/[\s.-]/g, ""))) e.vat_number = MESSAGES.vat_number;
    if (len(p.tax_office) < 1 || len(p.tax_office) > 120) e.tax_office = MESSAGES.tax_office;
  }
  return e;
}

/** The saved details of the signed-in customer, or null if they never filled them in. */
export async function getMyBillingProfile(): Promise<BillingProfile | null> {
  const { data, error } = await db.rpc("get_my_billing_profile");
  if (error) {
    console.error("get_my_billing_profile:", error.message);
    return null;
  }
  const row = (Array.isArray(data) ? data[0] : data) as Partial<Record<string, unknown>> | null;
  if (!row || typeof row["full_name"] !== "string" || row["full_name"].length === 0) return null;
  const s = (k: string) => (typeof row[k] === "string" ? (row[k] as string) : "");
  return {
    full_name: s("full_name"),
    phone: s("phone"),
    address_line1: s("address_line1"),
    address_line2: s("address_line2"),
    city: s("city"),
    postal_code: s("postal_code"),
    country: s("country") || "Ελλάδα",
    wants_invoice: row["wants_invoice"] === true,
    company_name: s("company_name"),
    vat_number: s("vat_number"),
    tax_office: s("tax_office"),
  };
}

export async function saveMyBillingProfile(p: BillingProfile): Promise<void> {
  const { error } = await db.rpc("save_my_billing_profile", {
    p_full_name: p.full_name,
    p_phone: p.phone,
    p_address_line1: p.address_line1,
    p_address_line2: p.address_line2,
    p_city: p.city,
    p_postal_code: p.postal_code,
    p_country: p.country,
    p_wants_invoice: p.wants_invoice,
    p_company_name: p.company_name,
    p_vat_number: p.vat_number,
    p_tax_office: p.tax_office,
  });
  if (error) {
    const m = /invalid_billing_profile:(\w+)/.exec(error.message);
    if (m && m[1]) throw new Error((MESSAGES as Record<string, string>)[m[1]] ?? "Έλεγξε τα στοιχεία σου.");
    if (/not_signed_in/.test(error.message)) throw new Error("Πρέπει να συνδεθείς για να συνεχίσεις.");
    throw new Error("Δεν ήταν δυνατή η αποθήκευση των στοιχείων. Δοκίμασε ξανά.");
  }
}
