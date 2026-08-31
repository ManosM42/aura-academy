import { useCallback, useEffect, useRef, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { supabase } from "@/lib/supabase";
import type { AuraPlan } from "@/lib/plans";

let stripePromise: Promise<Stripe | null> | null = null;

function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    const key = import.meta.env["VITE_STRIPE_PUBLISHABLE_KEY"] as string | undefined;
    if (!key) {
      return Promise.reject(
        new Error("Λείπει το VITE_STRIPE_PUBLISHABLE_KEY από το περιβάλλον."),
      );
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

export default function CheckoutModal({ plan, open, onClose }: CheckoutModalProps) {
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

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
      // Χωρίς αυτό το μήνυμα είναι πάντα "non-2xx status code".
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
            <h2
              id="aura-checkout-title"
              className="truncate text-lg font-semibold tracking-wide text-neutral-100"
            >
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
              <span className="text-3xl font-semibold tracking-tight text-white">
                {plan.priceLabel}
              </span>
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
              Ασφαλής πληρωμή μέσω Stripe. Η AURA δεν αποθηκεύει στοιχεία κάρτας. Ακύρωση ανά πάσα
              στιγμή από το προφίλ σου.
            </p>
          </aside>

          <div className="min-h-[420px] px-4 py-5 sm:px-6">
            {error ? (
              <div className="flex h-full flex-col items-start justify-center gap-4">
                <p className="text-sm text-neutral-300">
                  Η πληρωμή δεν μπόρεσε να ξεκινήσει.
                </p>
                <p className="text-xs text-neutral-500">{error}</p>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="rounded-full border border-white/20 px-5 py-2 text-xs uppercase tracking-[0.2em] text-neutral-200 transition-colors hover:border-white/50 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                >
                  Δοκίμασε ξανά
                </button>
              </div>
            ) : (
              <StripePane fetchClientSecret={fetchClientSecret} onError={setError} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StripePane({
  fetchClientSecret,
  onError,
}: {
  fetchClientSecret: () => Promise<string>;
  onError: (message: string) => void;
}) {
  const [stripe, setStripe] = useState<Stripe | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    getStripe()
      .then((instance) => {
        if (!active) return;
        setStripe(instance);
        setReady(true);
      })
      .catch((err: unknown) => {
        if (!active) return;
        onError(err instanceof Error ? err.message : "Το Stripe δεν φορτώθηκε.");
      });
    return () => {
      active = false;
    };
  }, [onError]);

  if (!ready || !stripe) {
    return (
      <div className="flex h-full min-h-[400px] animate-pulse flex-col gap-3 pt-4" aria-busy="true">
        <div className="h-11 rounded-lg bg-white/5" />
        <div className="h-11 rounded-lg bg-white/5" />
        <div className="h-11 w-2/3 rounded-lg bg-white/5" />
        <div className="mt-4 h-12 rounded-full bg-white/10" />
      </div>
    );
  }

  return (
    <EmbeddedCheckoutProvider stripe={stripe} options={{ fetchClientSecret }}>
      <EmbeddedCheckout className="w-full" />
    </EmbeddedCheckoutProvider>
  );
}