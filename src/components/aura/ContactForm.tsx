import { useState, type FormEvent } from "react";
import ChromeButton from "@/components/aura/ChromeButton";
import { db } from "@/lib/db";
import { useAuth } from "@/lib/useAuth";

type Kind = "message" | "appointment";

interface FieldErrors {
  full_name?: string;
  email?: string;
  phone?: string;
  message?: string;
  preferred_at?: string;
  consent?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const inputClass =
  "w-full rounded-lg border border-white/10 bg-[#111111] px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-600 transition-colors focus:border-white/35 focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40";
const labelClass = "mb-2 block text-[11px] uppercase tracking-[0.25em] text-neutral-500";

export default function ContactForm() {
  const { session } = useAuth();

  const [kind, setKind] = useState<Kind>("message");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState(session?.user.email ?? "");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [preferredAt, setPreferredAt] = useState("");
  const [consent, setConsent] = useState(false);
  const [honeypot, setHoneypot] = useState("");

  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [serverError, setServerError] = useState<string | null>(null);

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (fullName.trim().length < 2) next.full_name = "Συμπλήρωσε το ονοματεπώνυμό σου.";
    if (!EMAIL_RE.test(email.trim())) next.email = "Δώσε ένα έγκυρο email.";
    if (kind === "appointment") {
      if (phone.trim().length < 8) next.phone = "Για ραντεβού χρειαζόμαστε τηλέφωνο.";
      if (!preferredAt) next.preferred_at = "Διάλεξε ημερομηνία και ώρα.";
      else if (new Date(preferredAt).getTime() < Date.now())
        next.preferred_at = "Η ημερομηνία πρέπει να είναι στο μέλλον.";
    }
    if (message.trim().length < 10) next.message = "Γράψε τουλάχιστον 10 χαρακτήρες.";
    if (!consent) next.consent = "Χρειαζόμαστε τη συγκατάθεσή σου για να σου απαντήσουμε.";
    return next;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError(null);

    // Honeypot: τα bots γεμίζουν κρυφά πεδία — σιωπηλή "επιτυχία".
    if (honeypot.trim() !== "") {
      setStatus("sent");
      return;
    }

    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setStatus("sending");

    const { error } = await db.from("contact_messages").insert({
      kind,
      full_name: fullName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim() || null,
      message: message.trim(),
      preferred_at: kind === "appointment" ? new Date(preferredAt).toISOString() : null,
      user_id: session?.user.id ?? null,
    });

    if (error) {
      setStatus("error");
      setServerError(error.message);
      return;
    }

    setStatus("sent");
    setFullName("");
    setPhone("");
    setMessage("");
    setPreferredAt("");
    setConsent(false);
  }

  if (status === "sent") {
    return (
      <div className="rounded-2xl border border-white/15 bg-[#0A0A0A] p-8 text-center">
        <p className="text-xs uppercase tracking-[0.4em] text-neutral-500">ΕΛΗΦΘΗ</p>
        <h3 className="mt-4 text-2xl font-semibold tracking-tight text-neutral-100">
          {kind === "appointment" ? "Το αίτημα ραντεβού στάλθηκε." : "Το μήνυμά σου στάλθηκε."}
        </h3>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-neutral-400">
          Η ομάδα της AURA απαντά συνήθως μέσα σε 1–2 εργάσιμες ημέρες στο email που έδωσες.
        </p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="mt-6 rounded-full border border-white/20 px-6 py-2.5 text-xs uppercase tracking-[0.2em] text-neutral-200 transition-colors hover:border-white/50 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        >
          Νέο μήνυμα
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-6 sm:p-8"
    >
      <fieldset className="mb-7">
        <legend className={labelClass}>Τι θέλεις να κάνεις</legend>
        <div className="inline-flex rounded-full border border-white/10 p-1">
          {(
            [
              { value: "message", label: "ΜΗΝΥΜΑ" },
              { value: "appointment", label: "ΡΑΝΤΕΒΟΥ" },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={kind === option.value}
              onClick={() => setKind(option.value)}
              className={[
                "rounded-full px-5 py-2 text-[11px] uppercase tracking-[0.2em] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
                kind === option.value
                  ? "bg-white/10 text-white"
                  : "text-neutral-500 hover:text-neutral-200",
              ].join(" ")}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="contact-name">
            Ονοματεπώνυμο
          </label>
          <input
            id="contact-name"
            name="full_name"
            autoComplete="name"
            className={inputClass}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            aria-invalid={Boolean(errors.full_name)}
            aria-describedby={errors.full_name ? "err-name" : undefined}
            placeholder="Γιάννης Παπαδόπουλος"
          />
          {errors.full_name && (
            <p id="err-name" className="mt-2 text-xs text-neutral-400">
              {errors.full_name}
            </p>
          )}
        </div>

        <div>
          <label className={labelClass} htmlFor="contact-email">
            Email
          </label>
          <input
            id="contact-email"
            name="email"
            type="email"
            autoComplete="email"
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "err-email" : undefined}
            placeholder="you@example.com"
          />
          {errors.email && (
            <p id="err-email" className="mt-2 text-xs text-neutral-400">
              {errors.email}
            </p>
          )}
        </div>

        <div>
          <label className={labelClass} htmlFor="contact-phone">
            Τηλέφωνο {kind === "message" && <span className="text-neutral-700">(προαιρετικό)</span>}
          </label>
          <input
            id="contact-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            className={inputClass}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={errors.phone ? "err-phone" : undefined}
            placeholder="+30 69XXXXXXXX"
          />
          {errors.phone && (
            <p id="err-phone" className="mt-2 text-xs text-neutral-400">
              {errors.phone}
            </p>
          )}
        </div>

        {kind === "appointment" && (
          <div>
            <label className={labelClass} htmlFor="contact-when">
              Προτιμώμενη ημερομηνία & ώρα
            </label>
            <input
              id="contact-when"
              name="preferred_at"
              type="datetime-local"
              className={inputClass}
              value={preferredAt}
              onChange={(e) => setPreferredAt(e.target.value)}
              aria-invalid={Boolean(errors.preferred_at)}
              aria-describedby={errors.preferred_at ? "err-when" : undefined}
            />
            {errors.preferred_at && (
              <p id="err-when" className="mt-2 text-xs text-neutral-400">
                {errors.preferred_at}
              </p>
            )}
          </div>
        )}

        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="contact-message">
            {kind === "appointment" ? "Τι θέλεις να δουλέψουμε" : "Μήνυμα"}
          </label>
          <textarea
            id="contact-message"
            name="message"
            rows={5}
            className={`${inputClass} resize-y`}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            aria-invalid={Boolean(errors.message)}
            aria-describedby={errors.message ? "err-message" : undefined}
            placeholder="Πες μας λίγα λόγια για το επίπεδό σου και τον στόχο σου."
          />
          {errors.message && (
            <p id="err-message" className="mt-2 text-xs text-neutral-400">
              {errors.message}
            </p>
          )}
        </div>
      </div>

      {/* Honeypot — κρυφό από χρήστες και screen readers, ορατό στα bots. */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="contact-company">Company</label>
        <input
          id="contact-company"
          name="company"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>

      <div className="mt-6 flex items-start gap-3">
        <input
          id="contact-consent"
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          aria-invalid={Boolean(errors.consent)}
          className="mt-1 h-4 w-4 shrink-0 rounded border-white/20 bg-[#111111] accent-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        />
        <label htmlFor="contact-consent" className="text-xs leading-relaxed text-neutral-400">
          Συμφωνώ να αποθηκεύσει η AURA τα στοιχεία μου για να απαντήσει στο αίτημά μου.
        </label>
      </div>
      {errors.consent && <p className="mt-2 text-xs text-neutral-400">{errors.consent}</p>}

      {status === "error" && serverError && (
        <p role="alert" className="mt-5 rounded-lg border border-white/15 bg-[#111111] px-4 py-3 text-xs text-neutral-300">
          Κάτι πήγε λάθος: {serverError}
        </p>
      )}

      <div className="mt-8">
        <ChromeButton type="submit" disabled={status === "sending"} className="w-full sm:w-auto">
          {status === "sending"
            ? "ΑΠΟΣΤΟΛΗ…"
            : kind === "appointment"
              ? "ΚΛΕΙΣΕ ΡΑΝΤΕΒΟΥ"
              : "ΣΤΕΙΛΕ ΜΗΝΥΜΑ"}
        </ChromeButton>
      </div>
    </form>
  );
}