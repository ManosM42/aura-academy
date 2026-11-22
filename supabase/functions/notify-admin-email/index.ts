// supabase/functions/notify-admin-email/index.ts
//
// Στέλνει email στους admins (μέσω Resend) όταν:
//   • πουλιέται βιβλίο (παραγγελία γίνεται "paid")
//   • γίνεται κράτηση σεμιναρίου επί τόπου
//   • πληρώνεται κράτηση online σεμιναρίου
//   • έρχεται νέο μήνυμα / ραντεβού στο Inbox
//
// Το καλούν τα triggers της βάσης (δες email-notifications.sql). Δεν το καλεί ποτέ ο browser.
//
// Secrets:
//   RESEND_API_KEY        (υποχρεωτικό)  το κλειδί από το resend.com (ξεκινά με re_)
//   EMAIL_WEBHOOK_SECRET  (υποχρεωτικό)  ίδιο με το «email_webhook_secret» του Vault
//   EMAIL_FROM            (προτείνεται)  π.χ. "AURA <notifications@το-domain-σου.gr>"
//   NOTIFY_EMAILS         (προαιρετικό)  default: kalaganist@gmail.com,redhost@gmail.com
//   SITE_URL              (προαιρετικό)  π.χ. https://το-domain-σου.gr  (για τα κουμπιά «Άνοιγμα στο Admin»)
//   BOOK_ORDERS_TABLE     (προαιρετικό)  default: book_orders

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildMail, buildTestMail, classify, type Extras, type Mail, type WebhookPayload } from "./templates.ts";

const RECIPIENTS = (Deno.env.get("NOTIFY_EMAILS") ?? "redhost@gmail.com")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const BOOK_TABLE = Deno.env.get("BOOK_ORDERS_TABLE") ?? "book_orders";
const FROM = Deno.env.get("EMAIL_FROM") ?? "AURA <onboarding@resend.dev>";
const SITE_URL = Deno.env.get("SITE_URL") ?? "";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* ------------------------------------------------------------------ */
/* Resend                                                              */
/* ------------------------------------------------------------------ */

type SendResult = { ok: boolean; status: number; id?: string; error?: string };

async function resendCall(apiKey: string, mail: Mail, to: string[], idemKey?: string): Promise<SendResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        // ίδιο γεγονός δύο φορές => ένα email (ισχύει 24 ώρες)
        ...(idemKey ? { "Idempotency-Key": idemKey.slice(0, 250) } : {}),
      },
      body: JSON.stringify({
        from: FROM,
        to,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        ...(mail.replyTo ? { reply_to: mail.replyTo } : {}),
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
    if (res.ok) return { ok: true, status: res.status, id: data.id };
    return { ok: false, status: res.status, error: data.message ?? data.name ?? `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, status: 0, error: String(e) };
  } finally {
    clearTimeout(timer);
  }
}

async function sendWithRetry(apiKey: string, mail: Mail, to: string[], idemKey?: string): Promise<SendResult> {
  let r = await resendCall(apiKey, mail, to, idemKey);
  if (!r.ok && (r.status === 0 || r.status === 429 || r.status >= 500)) {
    await sleep(1200); // το Resend δέχεται ~2 αιτήματα/δευτερόλεπτο
    r = await resendCall(apiKey, mail, to, idemKey);
  }
  return r;
}

type Delivery = { sent: string[]; failed: { to: string; error?: string }[] };

async function deliver(apiKey: string, mail: Mail, keyBase?: string): Promise<Delivery> {
  // 1) ένα αίτημα για όλους τους παραλήπτες
  const all = await sendWithRetry(apiKey, mail, RECIPIENTS, keyBase ? `${keyBase}:all` : undefined);
  if (all.ok) return { sent: RECIPIENTS, failed: [] };

  // 2) Αν το Resend αρνείται (π.χ. domain χωρίς επαλήθευση => επιτρέπει μόνο το email του λογαριασμού),
  //    στέλνουμε ένα-ένα, ώστε όποιος επιτρέπεται να πάρει το email.
  if (all.status === 400 || all.status === 403 || all.status === 422) {
    console.error(
      `Resend απέρριψε την ομαδική αποστολή (${all.status}): ${all.error}. ` +
        "Επαλήθευσε domain στο resend.com/domains και βάλε EMAIL_FROM με διεύθυνση από αυτό.",
    );
    const sent: string[] = [];
    const failed: { to: string; error?: string }[] = [];
    for (const to of RECIPIENTS) {
      await sleep(600);
      const r = await sendWithRetry(apiKey, mail, [to], keyBase ? `${keyBase}:${to}` : undefined);
      if (r.ok) sent.push(to);
      else failed.push({ to, error: r.error });
    }
    return { sent, failed };
  }

  return { sent: [], failed: [{ to: RECIPIENTS.join(", "), error: all.error }] };
}

/* ------------------------------------------------------------------ */
/* Επιπλέον στοιχεία από τη βάση                                        */
/* ------------------------------------------------------------------ */

async function loadExtras(kind: string, record: Record<string, unknown>): Promise<Extras> {
  const extras: Extras = { siteUrl: SITE_URL };
  if (kind !== "online_seminar_paid") return extras;

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const seminarId = String(record.seminar_id ?? "");
    if (!url || !key || !seminarId) return extras;

    const admin = createClient(url, key);
    const [sem, paid] = await Promise.all([
      admin.from("online_seminars").select("title, starts_at, duration_minutes, capacity").eq("id", seminarId).maybeSingle(),
      admin
        .from("online_seminar_bookings")
        .select("id", { count: "exact", head: true })
        .eq("seminar_id", seminarId)
        .eq("status", "paid"),
    ]);
    extras.seminar = sem.data ?? null;
    extras.paidCount = paid.count ?? null;
  } catch (e) {
    console.error("loadExtras:", e); // δεν είναι κρίσιμο: το email θα σταλεί και χωρίς αυτά
  }
  return extras;
}

/* ------------------------------------------------------------------ */
/* Handler                                                             */
/* ------------------------------------------------------------------ */

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const expected = Deno.env.get("EMAIL_WEBHOOK_SECRET");
  if (!expected) {
    console.error("Λείπει το EMAIL_WEBHOOK_SECRET");
    return json(500, { error: "not_configured" });
  }
  if (!safeEqual(req.headers.get("x-webhook-secret") ?? "", expected)) {
    return json(401, { error: "unauthorized" });
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    console.error("Λείπει το RESEND_API_KEY");
    return json(500, { error: "missing_resend_key" });
  }

  let payload: (WebhookPayload & { test?: boolean }) | null = null;
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }
  if (!payload || typeof payload !== "object") return json(400, { error: "invalid_payload" });

  // Δοκιμαστικό email: curl ... -d '{"test":true}'
  if (payload.test === true) {
    const result = await deliver(apiKey, buildTestMail(RECIPIENTS, SITE_URL));
    return json(result.sent.length ? 200 : 502, { ok: result.sent.length > 0, ...result });
  }

  const kind = classify(payload, { bookTable: BOOK_TABLE });
  if (!kind) return json(200, { ok: true, skipped: true });

  const extras = await loadExtras(kind, payload.record ?? {});
  const mail = buildMail(kind, payload, extras);
  const idem = `${payload.table}:${String(payload.record?.id ?? "")}:${kind}`;

  const result = await deliver(apiKey, mail, idem);
  if (result.failed.length) console.error(`notify-admin-email (${kind}): αποτυχία για`, JSON.stringify(result.failed));
  else console.log(`notify-admin-email (${kind}): στάλθηκε σε ${result.sent.join(", ")}`);

  return json(result.sent.length ? 200 : 502, { ok: result.sent.length > 0, kind, ...result });
});