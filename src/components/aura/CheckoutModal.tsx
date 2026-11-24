import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { supabase } from "@/lib/supabase";
import type { AuraPlan } from "@/lib/plans";
import { getCheckoutProvider, type CheckoutProvider } from "@/lib/checkout-provider";
import { createVivaCheckout } from "@/lib/create-viva-checkout";
import {
  EMPTY_BILLING_PROFILE,
  getMyBillingProfile,
  saveMyBillingProfile,
  validateBillingProfile,
  type BillingProfile,
  type ProfileErrors,
} from "@/lib/billingProfile";

let stripePromise: Promise<Stripe | null> | null = null;

function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    const key = import.meta.env["VITE_STRIPE_PUBLISHABLE_KEY"] as string | undefined;
    if (!key) {
      return Promise.reject(new Error("Λείπει το VITE_STRIPE_PUBLISHABLE_KEY από το περιβάλλον."));
    }
    stripePromise = loadStripe(key);
  }
  return stripePromise;
}

interface CheckoutModalProps {
  plan: AuraPlan;
  open: boolean;
  onClose: () => void;
}

type Step = "details" | "pay";

const inputCls =
  "w-full rounded-lg border border-white/15 bg-black/60 px-3 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 outline-none transition-colors focus:border-white/45 focus:ring-2 focus:ring-white/10";
const chromeBtnGlow =
  "absolute -inset-0.5 rounded-full bg-gradient-to-r from-white via-neutral-300 to-neutral-500 opacity-60 blur-sm transition duration-300 group-hover:opacity-100";
const chromeBtn =
  "relative flex items-center justify-center rounded-full border border-white/40 bg-gradient-to-r from-white via-neutral-100 to-neutral-300 px-7 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-black shadow-[0_0_20px_rgba(255,255,255,0.3)] transition-all hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(255,255,255,0.5)] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:cursor-not-allowed disabled:opacity-50";
const ghostBtn =
  "rounded-full border border-white/20 px-5 py-2 text-xs uppercase tracking-[0.2em] text-neutral-200 transition-colors hover:border-white/50 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50";

export default function CheckoutModal({ plan, open, onClose }: CheckoutModalProps) {
  const [error, setError] = useState<string | null>(null);
  // null = still asking the server which provider applies to this visitor.
  const [provider, setProvider] = useState<CheckoutProvider | null>(null);
  const [step, setStep] = useState<Step>("details");
  const [profile, setProfile] = useState<BillingProfile>(EMPTY_BILLING_PROFILE);
  const [email, setEmail] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(true);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  // Each time the modal opens: which provider applies, and the customer's saved details.
  useEffect(() => {
    if (!open) return;
    let active = true;
    setProvider(null);
    setStep("details");
    setError(null);
    setLoadingProfile(true);
    void getCheckoutProvider().then((value) => {
      if (active) setProvider(value);
    });
    void (async () => {
      const [saved, userRes] = await Promise.all([getMyBillingProfile(), supabase.auth.getUser()]);
      if (!active) return;
      setEmail(userRes.data.user?.email ?? "");
      setProfile((prev) => saved ?? { ...prev, full_name: prev.full_name || (userRes.data.user?.user_metadata?.["full_name"] as string | undefined) || "" });
      setLoadingProfile(false);
    })();
    return () => {
      active = false;
    };
  }, [open]);

  // Escape + κλείδωμα scroll + αρχικό focus.
  useEffect(() => {
    if (!open || typeof document === "undefined") return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const fetchClientSecret = useCallback(async (): Promise<string> => {
    setError(null);

    const { data, error: fnError } = await supabase.functions.invoke<{
      clientSecret?: string;
      error?: string;
    }>("create-checkout-session", { body: { planId: plan.id } });

    if (fnError) {
      // Το FunctionsHttpError κρατά το αρχικό Response στο `context`.
      const res = (fnError as { context?: Response }).context;
      if (res && typeof res.json === "function") {
        try {
          const payload = (await res.json()) as { error?: string };
          if (payload?.error) throw new Error(payload.error);
        } catch (parseErr) {
          if (parseErr instanceof Error && parseErr.message) throw parseErr;
        }
      }
      throw new Error(fnError.message || "Η πληρωμή δεν μπόρεσε να ξεκινήσει.");
    }

    if (!data?.clientSecret) {
      throw new Error(data?.error ?? "Δεν δημιουργήθηκε συνεδρία πληρωμής.");
    }

    return data.clientSecret;
  }, [plan.id]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="aura-checkout-title"
    >
      <button
        type="button"
        aria-label="Κλείσιμο πληρωμής"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default"
        tabIndex={-1}
      />

      <div className="relative z-10 my-auto w-full max-w-4xl overflow-hidden rounded-2xl border border-white/15 bg-[#050505] shadow-[0_0_120px_-40px_rgba(255,255,255,0.4)]">
        <header className="flex items-center justify-between gap-4 border-b border-white/10 px-6 py-4">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.4em] text-neutral-500">AURA CHECKOUT</p>
            <h2 id="aura-checkout-title" className="truncate text-lg font-semibold tracking-wide text-neutral-100">
              {plan.name}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Κλείσιμο"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/15 text-neutral-300 transition-colors hover:border-white/40 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          >
            ✕
          </button>
        </header>

        <div className="grid gap-0 lg:grid-cols-[300px_1fr]">
          <aside className="border-b border-white/10 bg-[#0A0A0A] px-6 py-6 lg:border-b-0 lg:border-r">
            <p className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold tracking-tight text-white">{plan.priceLabel}</span>
              <span className="text-xs uppercase tracking-[0.2em] text-neutral-500">/ ΜΗΝΑ</span>
            </p>
            <p className="mt-3 text-sm text-neutral-500">{plan.tagline}</p>
            <ul className="mt-6 space-y-2.5 border-t border-white/5 pt-5">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-3 text-xs uppercase tracking-wide text-neutral-400">
                  <span aria-hidden className="mt-1.5 h-px w-3 shrink-0 bg-white/40" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-[11px] leading-relaxed text-neutral-600">
              Ασφαλής πληρωμή μέσω {provider === "stripe" ? "Stripe" : "Viva.com"}. Η AURA δεν αποθηκεύει στοιχεία
              κάρτας. Ακύρωση ανά πάσα στιγμή από το προφίλ σου.
            </p>
          </aside>

          <div className="flex min-h-[420px] flex-col justify-center px-4 py-5 sm:px-6">
            {error ? (
              <div className="flex h-full flex-col items-start justify-center gap-4">
                <p className="text-sm text-neutral-300">Η πληρωμή δεν μπόρεσε να ξεκινήσει.</p>
                <p className="text-xs text-neutral-500">{error}</p>
                <button type="button" onClick={() => { setError(null); setStep("details"); }} className={ghostBtn}>
                  Δοκίμασε ξανά
                </button>
              </div>
            ) : provider === null || loadingProfile ? (
              <PaneSkeleton />
            ) : step === "details" ? (
              <DetailsForm
                profile={profile}
                email={email}
                onChange={setProfile}
                onDone={() => setStep("pay")}
              />
            ) : provider === "viva" ? (
              <VivaPane
                planId={plan.id}
                summary={<DetailsSummary profile={profile} onEdit={() => setStep("details")} />}
                onNeedDetails={() => setStep("details")}
              />
            ) : (
              <StripePane
                fetchClientSecret={fetchClientSecret}
                onError={setError}
                summary={<DetailsSummary profile={profile} onEdit={() => setStep("details")} />}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PaneSkeleton() {
  return (
    <div className="flex h-full min-h-[400px] animate-pulse flex-col justify-center gap-3 pt-4" aria-busy="true">
      <div className="h-11 rounded-lg bg-white/5" />
      <div className="h-11 rounded-lg bg-white/5" />
      <div className="h-11 w-2/3 rounded-lg bg-white/5" />
      <div className="mt-4 h-12 rounded-full bg-white/10" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 1: the customer's personal details                             */
/* ------------------------------------------------------------------ */

function Field({ label, error, children }: { label: string; error?: string | undefined; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-500">{label}</span>
      {children}
      {error && (
        <span role="alert" className="mt-1 block text-[11px] text-red-300">
          {error}
        </span>
      )}
    </label>
  );
}

function DetailsForm({
  profile,
  email,
  onChange,
  onDone,
}: {
  profile: BillingProfile;
  email: string;
  onChange: (next: BillingProfile) => void;
  onDone: () => void;
}) {
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const set = <K extends keyof BillingProfile>(key: K, value: BillingProfile[K]) => onChange({ ...profile, [key]: value });

  async function submit() {
    if (busy) return;
    setMessage(null);
    const found = validateBillingProfile(profile);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    try {
      await saveMyBillingProfile(profile);
      onDone();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Δεν ήταν δυνατή η αποθήκευση των στοιχείων.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="space-y-4"
    >
      <div>
        <p className="text-[10px] uppercase tracking-[0.4em] text-neutral-500">ΒΗΜΑ 1 ΑΠΟ 2</p>
        <h3 className="mt-1 text-base font-semibold text-neutral-100">Τα στοιχεία σου</h3>
        <p className="mt-1 text-xs text-neutral-500">Χρειαζόμαστε μερικά στοιχεία για να ολοκληρωθεί η συνδρομή σου.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ονοματεπώνυμο *" error={errors.full_name}>
          <input className={inputCls} autoComplete="name" value={profile.full_name} onChange={(e) => set("full_name", e.target.value)} />
        </Field>
        <Field label="Email">
          <input className={`${inputCls} cursor-not-allowed opacity-60`} value={email} readOnly tabIndex={-1} />
        </Field>
        <Field label="Τηλέφωνο *" error={errors.phone}>
          <input className={inputCls} type="tel" autoComplete="tel" value={profile.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+30 69..." />
        </Field>
        <Field label="Διεύθυνση *" error={errors.address_line1}>
          <input className={inputCls} autoComplete="address-line1" value={profile.address_line1} onChange={(e) => set("address_line1", e.target.value)} placeholder="Οδός και αριθμός" />
        </Field>
        <Field label="Όροφος / συμπλήρωμα" error={errors.address_line2}>
          <input className={inputCls} autoComplete="address-line2" value={profile.address_line2} onChange={(e) => set("address_line2", e.target.value)} placeholder="Προαιρετικό" />
        </Field>
        <Field label="Πόλη *" error={errors.city}>
          <input className={inputCls} autoComplete="address-level2" value={profile.city} onChange={(e) => set("city", e.target.value)} />
        </Field>
        <Field label="Τ.Κ. *" error={errors.postal_code}>
          <input className={inputCls} autoComplete="postal-code" value={profile.postal_code} onChange={(e) => set("postal_code", e.target.value)} />
        </Field>
        <Field label="Χώρα *" error={errors.country}>
          <input className={inputCls} autoComplete="country-name" value={profile.country} onChange={(e) => set("country", e.target.value)} />
        </Field>
      </div>

      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2.5 text-sm text-neutral-300">
        <input
          type="checkbox"
          className="size-4 accent-white"
          checked={profile.wants_invoice}
          onChange={(e) => set("wants_invoice", e.target.checked)}
        />
        Θέλω τιμολόγιο (επιχείρηση)
      </label>

      {profile.wants_invoice && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Επωνυμία *" error={errors.company_name}>
            <input className={inputCls} autoComplete="organization" value={profile.company_name} onChange={(e) => set("company_name", e.target.value)} />
          </Field>
          <Field label="ΑΦΜ *" error={errors.vat_number}>
            <input className={inputCls} inputMode="numeric" value={profile.vat_number} onChange={(e) => set("vat_number", e.target.value)} />
          </Field>
          <Field label="ΔΟΥ *" error={errors.tax_office}>
            <input className={inputCls} value={profile.tax_office} onChange={(e) => set("tax_office", e.target.value)} />
          </Field>
        </div>
      )}

      {message && (
        <p role="alert" className="text-xs text-red-300">
          {message}
        </p>
      )}

      <div className="group relative inline-block pt-1">
        <div className={chromeBtnGlow} />
        <button type="submit" disabled={busy} className={chromeBtn}>
          {busy ? "Αποθήκευση…" : "Συνέχεια στην πληρωμή"}
        </button>
      </div>
    </form>
  );
}

function DetailsSummary({ profile, onEdit }: { profile: BillingProfile; onEdit: () => void }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
      <p className="min-w-0 truncate text-xs text-neutral-400">
        <span className="font-semibold text-neutral-200">{profile.full_name}</span> · {profile.phone} · {profile.city}
      </p>
      <button type="button" onClick={onEdit} className="text-[11px] uppercase tracking-[0.2em] text-neutral-400 underline-offset-4 hover:text-white hover:underline">
        Αλλαγή στοιχείων
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 2 (Viva): a full-page redirect, it cannot be embedded          */
/* ------------------------------------------------------------------ */

function VivaPane({ planId, summary, onNeedDetails }: { planId: AuraPlan["id"]; summary: ReactNode; onNeedDetails: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function start() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const url = await createVivaCheckout(planId);
      window.location.assign(url);
      // Keep the button disabled: the browser is navigating away.
    } catch (err) {
      const text = err instanceof Error ? err.message : "Η πληρωμή δεν μπόρεσε να ξεκινήσει.";
      if (/billing_profile_required|στοιχεία σου/i.test(text)) onNeedDetails();
      setMessage(text);
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full min-h-[400px] flex-col items-start justify-center gap-5">
      <div className="w-full">{summary}</div>
      <p className="text-[10px] uppercase tracking-[0.4em] text-neutral-500">ΒΗΜΑ 2 ΑΠΟ 2 · ΑΣΦΑΛΗΣ ΠΛΗΡΩΜΗ</p>
      <p className="max-w-md text-sm leading-relaxed text-neutral-300">
        Θα μεταφερθείς στη σελίδα ασφαλούς πληρωμής της Viva.com για να ολοκληρώσεις τη συνδρομή σου. Μετά την πληρωμή θα
        επιστρέψεις εδώ και η συνδρομή σου θα ενεργοποιηθεί μόλις επιβεβαιωθεί η πληρωμή.
      </p>
      {message && (
        <p role="alert" className="max-w-md text-xs text-red-300">
          {message}
        </p>
      )}
      <div className="group relative pt-1">
        <div className={chromeBtnGlow} />
        <button type="button" onClick={() => void start()} disabled={busy} className={chromeBtn}>
          {busy ? "Μεταφορά…" : "Πληρωμή με κάρτα"}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 2 (Stripe): the original embedded checkout                     */
/* ------------------------------------------------------------------ */

function StripePane({
  fetchClientSecret,
  onError,
  summary,
}: {
  fetchClientSecret: () => Promise<string>;
  onError: (message: string) => void;
  summary: ReactNode;
}) {
  const [stripe, setStripe] = useState<Promise<Stripe | null> | null>(null);

  useEffect(() => {
    try {
      setStripe(getStripe());
    } catch (err) {
      onError(err instanceof Error ? err.message : "Η πληρωμή δεν μπόρεσε να ξεκινήσει.");
    }
  }, [onError]);

  if (!stripe) return <PaneSkeleton />;

  return (
    <div className="space-y-4">
      {summary}
      <EmbeddedCheckoutProvider stripe={stripe} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
