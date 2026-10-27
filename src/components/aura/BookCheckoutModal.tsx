// src/components/aura/BookCheckoutModal.tsx
//
// In-app checkout: 1) shipping details  2) Stripe embedded payment  3) done.
// Requires:  npm i @stripe/stripe-js @stripe/react-stripe-js
// Uses the same publishable key env var as your seminar checkout modal.
import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { loadStripe } from "@stripe/stripe-js";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { AlertCircle, ArrowLeft, Check, Loader2, Minus, Plus, ShieldCheck, X } from "lucide-react";
import {
  confirmBookOrder,
  createBookCheckout,
  formatMoney,
  type BookSettings,
} from "@/lib/book";
import { CHROME_FILL, ChromeCTA, ChromeText, EASE, fieldClass } from "@/components/aura/chrome";

// Change the env var name if your seminar checkout uses a different one.
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string);

type Step = "details" | "pay" | "done";

const EMPTY = {
  fullName: "",
  email: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  region: "",
  postalCode: "",
  country: "Greece",
  notes: "",
};

const STEPS: { key: Step; label: string }[] = [
  { key: "details", label: "Shipping" },
  { key: "pay", label: "Payment" },
  { key: "done", label: "Done" },
];

export default function BookCheckoutModal({
  open,
  onClose,
  settings,
}: {
  open: boolean;
  onClose: () => void;
  settings: BookSettings;
}) {
  const reduce = useReducedMotion();
  const [step, setStep] = useState<Step>("details");
  const [form, setForm] = useState(EMPTY);
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const maxQty = Math.min(10, settings.stock ?? 10);
  const subtotal = settings.price_cents * quantity;
  const total = subtotal + settings.shipping_cents;
  const locked = step === "pay" && !!clientSecret; // do not lose a paid session by accident

  // Reset every time it opens
  useEffect(() => {
    if (!open) return;
    setStep("details");
    setForm(EMPTY);
    setQuantity(1);
    setBusy(false);
    setError(null);
    setClientSecret(null);
    setOrderId(null);
    setConfirmed(false);
  }, [open]);

  // Scroll lock + Escape
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, busy, onClose]);

  function set<K extends keyof typeof EMPTY>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleDetails(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const res = await createBookCheckout({ quantity, ...form });
      setClientSecret(res.clientSecret);
      setOrderId(res.orderId);
      setStep("pay");
      panelRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Stripe tells us the payment finished -> verify it server-side.
  async function handleComplete() {
    setStep("done");
    panelRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    if (!orderId) return;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const res = await confirmBookOrder(orderId);
        if (res.status !== "pending") {
          setConfirmed(true);
          return;
        }
      } catch {
        /* retry */
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Order the AURA book"
          className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* backdrop */}
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
            onClick={() => !busy && !locked && onClose()}
          />

          {/* panel */}
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.97 }}
            transition={{ duration: 0.55, ease: EASE }}
            className="relative max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl p-px sm:rounded-3xl"
            style={{
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.5), rgba(255,255,255,0.06) 35%, rgba(255,255,255,0.06) 65%, rgba(255,255,255,0.45))",
              boxShadow: "0 0 120px rgba(255,255,255,0.08), 0 30px 90px rgba(0,0,0,0.95)",
            }}
          >
            <div className="relative rounded-t-[23px] bg-[#09090a] p-5 sm:rounded-[23px] sm:p-8">
              {/* top sheen + ambient glow */}
              <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-32" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.07), transparent)" }} />
              <motion.div
                aria-hidden
                className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-white/10 blur-[90px]"
                animate={reduce ? undefined : { opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              />

              {/* close */}
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                aria-label="Close"
                className="absolute right-4 top-4 z-10 flex size-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.05] text-white/70 outline-none transition-all hover:border-white/50 hover:bg-white/10 hover:text-white hover:shadow-[0_0_20px_rgba(255,255,255,0.25)] focus-visible:ring-2 focus-visible:ring-white/60 disabled:opacity-40"
              >
                <X className="size-4" />
              </button>

              {/* header */}
              <div className="relative">
                <p className="text-[11px] uppercase tracking-[0.4em] text-white/45">Order</p>
                <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
                  <ChromeText>{settings.title}</ChromeText>
                </h2>

                {/* stepper */}
                <ol className="mt-6 flex items-center gap-2">
                  {STEPS.map((s, i) => {
                    const done = i < stepIndex || step === "done";
                    const on = i === stepIndex;
                    return (
                      <li key={s.key} className="flex flex-1 items-center gap-2 last:flex-none">
                        <span
                          className="flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all duration-500"
                          style={{
                            backgroundImage: done || on ? CHROME_FILL : undefined,
                            background: done || on ? undefined : "rgba(255,255,255,0.06)",
                            color: done || on ? "#0a0a0a" : "rgba(255,255,255,0.4)",
                            boxShadow: on ? "0 0 22px rgba(255,255,255,0.55)" : "none",
                          }}
                        >
                          {done ? <Check className="size-3.5" /> : i + 1}
                        </span>
                        <span className={`hidden text-xs font-semibold sm:block ${on || done ? "text-white" : "text-white/35"}`}>{s.label}</span>
                        {i < STEPS.length - 1 && (
                          <span className="relative mx-1 h-px flex-1 bg-white/10">
                            <motion.span
                              className="absolute inset-y-0 left-0 bg-gradient-to-r from-white/80 to-white/30"
                              initial={false}
                              animate={{ width: i < stepIndex ? "100%" : "0%" }}
                              transition={{ duration: 0.6, ease: EASE }}
                            />
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </div>

              {/* body */}
              <div className="relative mt-8">
                <AnimatePresence mode="wait">
                  {/* ------------------------- DETAILS ------------------------- */}
                  {step === "details" && (
                    <motion.form
                      key="details"
                      onSubmit={handleDetails}
                      initial={{ opacity: 0, x: 24 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -24 }}
                      transition={{ duration: 0.4, ease: EASE }}
                      className="grid gap-8 md:grid-cols-[1.4fr_1fr]"
                    >
                      <div className="space-y-4">
                        <Field label="Full name" required>
                          <input required autoFocus autoComplete="name" className={fieldClass} value={form.fullName} onChange={(e) => set("fullName", e.target.value)} placeholder="Your full name" />
                        </Field>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field label="Email" required>
                            <input required type="email" autoComplete="email" className={fieldClass} value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="you@email.com" />
                          </Field>
                          <Field label="Phone" required>
                            <input required type="tel" autoComplete="tel" className={fieldClass} value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+30 ..." />
                          </Field>
                        </div>
                        <Field label="Address" required>
                          <input required autoComplete="address-line1" className={fieldClass} value={form.addressLine1} onChange={(e) => set("addressLine1", e.target.value)} placeholder="Street and number" />
                        </Field>
                        <Field label="Apartment, floor, etc.">
                          <input autoComplete="address-line2" className={fieldClass} value={form.addressLine2} onChange={(e) => set("addressLine2", e.target.value)} placeholder="Optional" />
                        </Field>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field label="City" required>
                            <input required autoComplete="address-level2" className={fieldClass} value={form.city} onChange={(e) => set("city", e.target.value)} />
                          </Field>
                          <Field label="Region / State">
                            <input autoComplete="address-level1" className={fieldClass} value={form.region} onChange={(e) => set("region", e.target.value)} placeholder="Optional" />
                          </Field>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field label="Postal code" required>
                            <input required autoComplete="postal-code" className={fieldClass} value={form.postalCode} onChange={(e) => set("postalCode", e.target.value)} />
                          </Field>
                          <Field label="Country" required>
                            <input required autoComplete="country-name" className={fieldClass} value={form.country} onChange={(e) => set("country", e.target.value)} />
                          </Field>
                        </div>
                        <Field label="Delivery notes">
                          <textarea rows={2} className={fieldClass} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Optional: doorbell, preferred time..." />
                        </Field>
                      </div>

                      {/* summary */}
                      <div className="md:sticky md:top-0 md:self-start">
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/50">Summary</p>

                          <div className="mt-4 flex items-center justify-between">
                            <span className="text-sm text-white/80">Quantity</span>
                            <div className="flex items-center gap-1 rounded-full border border-white/15 bg-black/50 p-1">
                              <QtyBtn label="Decrease" disabled={quantity <= 1} onClick={() => setQuantity((q) => Math.max(1, q - 1))}><Minus className="size-3.5" /></QtyBtn>
                              <AnimatePresence mode="popLayout" initial={false}>
                                <motion.span key={quantity} initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -8, opacity: 0 }} transition={{ duration: 0.2 }} className="w-8 text-center text-sm font-bold text-white">
                                  {quantity}
                                </motion.span>
                              </AnimatePresence>
                              <QtyBtn label="Increase" disabled={quantity >= maxQty} onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}><Plus className="size-3.5" /></QtyBtn>
                            </div>
                          </div>

                          <dl className="mt-5 space-y-2.5 border-t border-white/10 pt-4 text-sm">
                            <Row label={`Book × ${quantity}`} value={formatMoney(subtotal, settings.currency)} />
                            <Row label="Shipping" value={settings.shipping_cents > 0 ? formatMoney(settings.shipping_cents, settings.currency) : "Free"} />
                          </dl>

                          <div className="mt-4 flex items-baseline justify-between border-t border-white/10 pt-4">
                            <span className="text-sm text-white/70">Total</span>
                            <motion.span key={total} initial={{ scale: 1.15, opacity: 0.5 }} animate={{ scale: 1, opacity: 1 }} className="text-2xl font-extrabold text-white drop-shadow-[0_0_18px_rgba(255,255,255,0.5)]">
                              {formatMoney(total, settings.currency)}
                            </motion.span>
                          </div>
                        </div>

                        {error && (
                          <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-white/20 bg-white/[0.05] p-3 text-sm text-white/85">
                            <AlertCircle className="mt-0.5 size-4 shrink-0" />
                            {error}
                          </p>
                        )}

                        <ChromeCTA type="submit" disabled={busy} className="mt-5 w-full">
                          {busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                          {busy ? "Preparing payment..." : "Continue to payment"}
                        </ChromeCTA>
                        <p className="mt-3 text-center text-[11px] text-white/35">Secure payment powered by Stripe.</p>
                      </div>
                    </motion.form>
                  )}

                  {/* -------------------------- PAY --------------------------- */}
                  {step === "pay" && clientSecret && (
                    <motion.div
                      key="pay"
                      initial={{ opacity: 0, x: 24 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -24 }}
                      transition={{ duration: 0.4, ease: EASE }}
                    >
                      <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                        <span className="text-sm text-white/70">
                          {quantity} × book · to {form.city}
                        </span>
                        <span className="text-lg font-extrabold text-white">{formatMoney(total, settings.currency)}</span>
                      </div>
                      <div className="overflow-hidden rounded-2xl bg-white p-1 shadow-[0_0_60px_rgba(255,255,255,0.12)]">
                        <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret, onComplete: handleComplete }}>
                          <EmbeddedCheckout />
                        </EmbeddedCheckoutProvider>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setStep("details"); setClientSecret(null); setOrderId(null); }}
                        className="mt-4 inline-flex items-center gap-2 text-xs text-white/50 outline-none transition-colors hover:text-white focus-visible:text-white"
                      >
                        <ArrowLeft className="size-3.5" /> Edit shipping details
                      </button>
                    </motion.div>
                  )}

                  {/* -------------------------- DONE -------------------------- */}
                  {step === "done" && (
                    <motion.div
                      key="done"
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.6, ease: EASE }}
                      className="py-8 text-center"
                    >
                      <div className="relative mx-auto mb-6 flex size-24 items-center justify-center">
                        {!reduce && (
                          <motion.span
                            aria-hidden
                            className="absolute inset-0 rounded-full border border-white/60"
                            animate={{ scale: [1, 1.8], opacity: [0.6, 0] }}
                            transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                          />
                        )}
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", stiffness: 220, damping: 14, delay: 0.1 }}
                          className="flex size-20 items-center justify-center rounded-full text-neutral-950"
                          style={{ backgroundImage: CHROME_FILL, boxShadow: "0 0 50px rgba(255,255,255,0.6), inset 0 1px 0 rgba(255,255,255,0.95)" }}
                        >
                          <Check className="size-9" strokeWidth={3} />
                        </motion.span>
                      </div>
                      <h3 className="text-2xl font-extrabold sm:text-3xl"><ChromeText>Order received</ChromeText></h3>
                      <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-white/60">
                        Thank you, {form.fullName.split(" ")[0] || "friend"}. Your book will be shipped to{" "}
                        <span className="text-white">{form.addressLine1}, {form.city}</span>. We will contact you at{" "}
                        <span className="text-white">{form.email}</span> about your delivery.
                      </p>
                      <p className="mt-3 text-xs text-white/35">
                        {confirmed ? "Payment confirmed." : "Confirming your payment..."}
                      </p>
                      <ChromeCTA type="button" onClick={onClose} className="mt-8">Close</ChromeCTA>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
        {label}
        {required && <span className="text-white/70"> *</span>}
      </span>
      {children}
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-white/55">{label}</dt>
      <dd className="font-medium text-white">{value}</dd>
    </div>
  );
}

function QtyBtn({ children, onClick, disabled, label }: { children: ReactNode; onClick: () => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="flex size-7 items-center justify-center rounded-full text-white/80 outline-none transition-all hover:bg-white/15 hover:text-white focus-visible:ring-2 focus-visible:ring-white/60 disabled:opacity-30"
    >
      {children}
    </button>
  );
}