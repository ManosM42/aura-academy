// supabase/functions/notify-admin-email/templates.ts
// Καθαρή λογική (χωρίς Deno APIs): ποια γεγονότα στέλνουν email και πώς χτίζεται το κάθε email.

type Row = Record<string, unknown>;

export type WebhookPayload = {
  table: string;
  type: string; // INSERT | UPDATE
  record: Row;
  old_record?: Row | null;
};

export type EventKind =
  | "contact_message"
  | "contact_appointment"
  | "seminar_booking"
  | "online_seminar_paid"
  | "book_sold";

/** Επιπλέον στοιχεία που φέρνει η function από τη βάση (π.χ. τίτλος online σεμιναρίου). */
export type Extras = {
  siteUrl?: string;
  seminar?: { title?: string | null; starts_at?: string | null; duration_minutes?: number | null; capacity?: number | null } | null;
  paidCount?: number | null;
};

export type Mail = { subject: string; html: string; text: string; replyTo?: string };

/* ------------------------------------------------------------------ */
/* Ποιο γεγονός είναι αυτό;                                             */
/* ------------------------------------------------------------------ */

export function classify(p: WebhookPayload, opts: { bookTable: string }): EventKind | null {
  const rec = p.record ?? {};
  const wasPaid = p.old_record?.status === "paid";
  const nowPaid = rec.status === "paid";
  const becamePaid = nowPaid && (p.type === "INSERT" || !wasPaid);

  switch (p.table) {
    case "contact_messages":
      if (p.type !== "INSERT") return null;
      return rec.kind === "appointment" ? "contact_appointment" : "contact_message";
    case "seminar_bookings":
      return p.type === "INSERT" ? "seminar_booking" : null; // κράτηση σεμιναρίου επί τόπου
    case "online_seminar_bookings":
      return becamePaid ? "online_seminar_paid" : null; // πληρωμένη κράτηση online σεμιναρίου
    default:
      if (p.table === opts.bookTable) return becamePaid ? "book_sold" : null; // πουλήθηκε βιβλίο
      return null;
  }
}

/* ------------------------------------------------------------------ */
/* Βοηθητικά                                                            */
/* ------------------------------------------------------------------ */

export const esc = (v: unknown): string =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v).trim());
const isEmail = (v: string) => /^[^@\s,;<>]+@[^@\s,;<>]+\.[^@\s,;<>]+$/.test(v);

function money(cents: unknown, currency: unknown = "eur"): string {
  const n = Number(cents);
  if (!Number.isFinite(n)) return "—";
  try {
    return new Intl.NumberFormat("el-GR", { style: "currency", currency: str(currency).toUpperCase() || "EUR" }).format(n / 100);
  } catch {
    return `${(n / 100).toFixed(2)} €`;
  }
}

function dateTime(iso: unknown): string {
  const s = str(iso);
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString("el-GR", { timeZone: "Europe/Athens", dateStyle: "full", timeStyle: "short" });
}

function dateOnly(v: unknown): string {
  const s = str(v);
  if (!s) return "—";
  const d = new Date(`${s}T12:00:00`);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("el-GR", { timeZone: "Europe/Athens", weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

const EXPERIENCE: Record<string, string> = {
  beginner: "Αρχάριος",
  intermediate: "Μέτριο επίπεδο",
  professional: "Επαγγελματίας",
};

/* ------------------------------------------------------------------ */
/* Δομή email: γραμμές + προαιρετικό μεγάλο κείμενο                     */
/* ------------------------------------------------------------------ */

type Line = { label: string; value: string; href?: string };
type Spec = {
  subject: string;
  badge: string; // μικρή ετικέτα πάνω από τον τίτλο
  title: string;
  lead?: string;
  lines: Line[];
  blocks?: { label: string; text: string }[]; // μεγάλα κείμενα (μήνυμα, σημειώσεις)
  link?: { label: string; path: string };
  replyTo?: string;
};

const clean = (lines: (Line | null | false)[]): Line[] =>
  lines.filter((l): l is Line => !!l && l.value !== "" && l.value !== "—");

function render(spec: Spec, siteUrl?: string): Mail {
  const base = str(siteUrl).replace(/\/+$/, "");
  const url = spec.link && base ? `${base}${spec.link.path}` : "";

  const rowsHtml = spec.lines
    .map((l) => {
      const val = l.href
        ? `<a href="${esc(l.href)}" style="color:#111;text-decoration:underline">${esc(l.value)}</a>`
        : esc(l.value).replace(/\n/g, "<br>");
      return `<tr><td style="padding:9px 14px 9px 0;color:#6b7280;font-size:13px;vertical-align:top;white-space:nowrap">${esc(l.label)}</td><td style="padding:9px 0;color:#111;font-size:14px;font-weight:500;vertical-align:top">${val}</td></tr>`;
    })
    .join("");

  const blocksHtml = (spec.blocks ?? [])
    .map(
      (b) =>
        `<div style="margin-top:18px"><div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#6b7280;margin-bottom:6px">${esc(b.label)}</div><div style="background:#f4f4f5;border-radius:10px;padding:14px 16px;font-size:14px;line-height:1.6;color:#111;white-space:pre-wrap">${esc(b.text)}</div></div>`,
    )
    .join("");

  const button = url
    ? `<div style="margin-top:24px"><a href="${esc(url)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:11px 20px;border-radius:999px">${esc(spec.link!.label)}</a></div>`
    : "";

  const html = `<!doctype html><html lang="el"><body style="margin:0;padding:24px;background:#eef0f3;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb">
<div style="background:#0b0b0c;padding:18px 24px"><span style="color:#fff;font-size:15px;font-weight:700;letter-spacing:.32em">AURA</span><span style="color:#9ca3af;font-size:11px;letter-spacing:.2em;text-transform:uppercase;margin-left:12px">${esc(spec.badge)}</span></div>
<div style="padding:24px">
<h1 style="margin:0;font-size:20px;line-height:1.3;color:#111">${esc(spec.title)}</h1>
${spec.lead ? `<p style="margin:8px 0 0;font-size:14px;color:#4b5563">${esc(spec.lead)}</p>` : ""}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:18px;width:100%;border-top:1px solid #eee">${rowsHtml}</table>
${blocksHtml}${button}
</div></div>
<p style="max-width:560px;margin:14px auto 0;text-align:center;font-size:11px;color:#9ca3af">Αυτόματη ειδοποίηση από το AURA. Μπορείς να απαντήσεις απευθείας σε αυτό το email.</p>
</body></html>`;

  const text = [
    spec.title,
    spec.lead ?? "",
    "",
    ...spec.lines.map((l) => `${l.label}: ${l.value}`),
    ...(spec.blocks ?? []).flatMap((b) => ["", `${b.label}:`, b.text]),
    url ? `\n${spec.link!.label}: ${url}` : "",
  ]
    .filter((s, i, a) => !(s === "" && a[i - 1] === ""))
    .join("\n")
    .trim();

  return { subject: spec.subject.replace(/[\r\n]+/g, " ").trim(), html, text, replyTo: spec.replyTo };
}

const mailto = (email: string) => (isEmail(email) ? `mailto:${email}` : undefined);
const tel = (phone: string) => (phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : undefined);
const short = (s: string, n = 60) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/* ------------------------------------------------------------------ */
/* Τα 5 email                                                           */
/* ------------------------------------------------------------------ */

export function buildMail(kind: EventKind, p: WebhookPayload, extras: Extras = {}): Mail {
  const r = p.record;
  const name = str(r.full_name) || "Κάποιος";
  const email = str(r.email);
  const phone = str(r.phone);
  const replyTo = isEmail(email) ? email : undefined;

  switch (kind) {
    case "contact_message":
    case "contact_appointment": {
      const appt = kind === "contact_appointment";
      return render(
        {
          subject: `${appt ? "📅 Νέο ραντεβού" : "✉️ Νέο μήνυμα"} από ${short(name, 40)}`,
          badge: appt ? "Ραντεβού" : "Inbox",
          title: appt ? `Νέο αίτημα ραντεβού από ${name}` : `Νέο μήνυμα από ${name}`,
          lines: clean([
            { label: "Όνομα", value: name },
            { label: "Email", value: email, href: mailto(email) },
            { label: "Τηλέφωνο", value: phone, href: tel(phone) },
            appt && { label: "Επιθυμητή ημερομηνία", value: dateTime(r.preferred_at) },
            { label: "Ελήφθη", value: dateTime(r.created_at) },
          ]),
          blocks: [{ label: "Μήνυμα", text: str(r.message) || "(κενό)" }],
          link: { label: "Άνοιγμα στο Inbox", path: "/admin/inbox" },
          replyTo,
        },
        extras.siteUrl,
      );
    }

    case "seminar_booking": {
      const group = r.format === "group";
      const people = Number(r.participants) || 1;
      return render(
        {
          subject: `🎓 Νέα κράτηση σεμιναρίου (${group ? "Group" : "Private"}) · ${dateOnly(r.seminar_date)} · ${short(name, 30)}`,
          badge: "Σεμινάριο επί τόπου",
          title: `Νέα κράτηση σεμιναρίου από ${name}`,
          lead: group ? `Group για ${people} άτομα.` : "Private εκπαίδευση 1-προς-1.",
          lines: clean([
            { label: "Κωδικός", value: str(r.reference) },
            { label: "Format", value: group ? `Group · ${people} άτομα` : "Private" },
            { label: "Ημερομηνία", value: dateOnly(r.seminar_date) },
            { label: "Ώρα", value: str(r.slot) },
            { label: "Όνομα", value: name },
            { label: "Email", value: email, href: mailto(email) },
            { label: "Τηλέφωνο", value: phone, href: tel(phone) },
            { label: "Πόλη", value: str(r.city) },
            { label: "Επίπεδο", value: EXPERIENCE[str(r.experience_level)] ?? str(r.experience_level) },
            group && { label: "Ομάδα", value: str(r.group_name) },
          ]),
          blocks: [
            group && str(r.participant_names) ? { label: "Συμμετέχοντες", text: str(r.participant_names) } : null,
            str(r.goals) ? { label: "Στόχοι", text: str(r.goals) } : null,
            str(r.notes) ? { label: "Σημειώσεις", text: str(r.notes) } : null,
          ].filter((b): b is { label: string; text: string } => !!b),
          link: { label: "Άνοιγμα στο Admin", path: "/admin" },
          replyTo,
        },
        extras.siteUrl,
      );
    }

    case "online_seminar_paid": {
      const sem = extras.seminar;
      const title = str(sem?.title) || "Online σεμινάριο";
      const list = Number(r.list_price_cents);
      const discount = Number(r.discount_percent) || 0;
      const seats =
        extras.paidCount != null
          ? `${extras.paidCount}${sem?.capacity ? ` / ${sem.capacity}` : ""} πληρωμένες θέσεις`
          : "";
      return render(
        {
          subject: `💳 Πληρώθηκε online σεμινάριο: ${short(title, 40)} · ${short(name, 30)}`,
          badge: "Online σεμινάριο",
          title: `Νέα πληρωμένη κράτηση από ${name}`,
          lead: title,
          lines: clean([
            { label: "Σεμινάριο", value: title },
            sem?.starts_at ? { label: "Ημερομηνία & ώρα", value: dateTime(sem.starts_at) } : null,
            sem?.duration_minutes ? { label: "Διάρκεια", value: `${sem.duration_minutes} λεπτά` } : null,
            { label: "Όνομα", value: name },
            { label: "Email", value: email, href: mailto(email) },
            { label: "Τηλέφωνο", value: phone, href: tel(phone) },
            { label: "Πληρώθηκε", value: money(r.amount_cents) },
            discount > 0 && Number.isFinite(list) ? { label: "Έκπτωση μέλους", value: `${discount}% (τιμή καταλόγου ${money(list)})` } : null,
            { label: "Ώρα πληρωμής", value: dateTime(r.paid_at) },
            r.viva_order_code ? { label: "Viva order", value: str(r.viva_order_code) } : null,
            seats ? { label: "Θέσεις", value: seats } : null,
          ]),
          link: { label: "Άνοιγμα στο Admin", path: "/admin" },
          replyTo,
        },
        extras.siteUrl,
      );
    }

    case "book_sold": {
      const qty = Number(r.quantity) || 1;
      const currency = r.currency;
      const unit = Number(r.unit_price_cents);
      const region = str(r.region);
      const address = [
        str(r.address_line1),
        str(r.address_line2),
        `${str(r.postal_code)} ${str(r.city)}${region ? `, ${region}` : ""}`.trim(),
        str(r.country),
      ]
        .filter(Boolean)
        .join("\n");
      return render(
        {
          subject: `📚 Πουλήθηκε βιβλίο ×${qty} · ${money(r.total_cents, currency)} · ${short(name, 30)}`,
          badge: "Βιβλίο",
          title: `Πουλήθηκε βιβλίο: ${name}`,
          lead: "Η παραγγελία πληρώθηκε και είναι έτοιμη προς αποστολή.",
          lines: clean([
            { label: "Ποσότητα", value: `${qty} ${qty > 1 ? "αντίτυπα" : "αντίτυπο"}` },
            Number.isFinite(unit) ? { label: "Τιμή τεμαχίου", value: money(unit, currency) } : null,
            { label: "Μεταφορικά", value: money(r.shipping_cents, currency) },
            { label: "Σύνολο", value: money(r.total_cents, currency) },
            { label: "Πληρώθηκε", value: dateTime(r.paid_at) },
            { label: "Αποστολή σε", value: name },
            { label: "Διεύθυνση", value: address },
            { label: "Τηλέφωνο", value: phone, href: tel(phone) },
            { label: "Email", value: email, href: mailto(email) },
            r.id ? { label: "Παραγγελία", value: str(r.id).slice(0, 8) } : null,
          ]),
          blocks: str(r.notes) ? [{ label: "Σημείωση πελάτη", text: str(r.notes) }] : [],
          link: { label: "Άνοιγμα Book Manager", path: "/admin/book" },
          replyTo,
        },
        extras.siteUrl,
      );
    }
  }
}

/** Email δοκιμής: για να επιβεβαιώσεις ότι όλο το σύστημα δουλεύει. */
export function buildTestMail(recipients: string[], siteUrl?: string): Mail {
  return render(
    {
      subject: "✅ AURA: δοκιμαστική ειδοποίηση",
      badge: "Δοκιμή",
      title: "Οι ειδοποιήσεις email δουλεύουν",
      lead: "Θα λαμβάνεις email για κάθε νέο μήνυμα/ραντεβού στο Inbox, κάθε κράτηση σεμιναρίου, κάθε πληρωμένο online σεμινάριο και κάθε βιβλίο που πουλιέται.",
      lines: [{ label: "Παραλήπτες", value: recipients.join(", ") }],
      link: { label: "Άνοιγμα Admin", path: "/admin" },
    },
    siteUrl,
  );
}