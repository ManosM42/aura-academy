// Customer fiscal-document email through Resend.
// Only call this for documents with status "signed". Payment confirmation emails use a separate path.
// The Idempotency-Key header is assumed from Resend's API. Confirm it in Resend's docs before go-live.

const RESEND_URL = "https://api.resend.com/emails";
const SEND_TIMEOUT_MS = 15_000;
export const EMAIL_MAX_ATTEMPTS = 8;

export interface ResendConfig {
  apiKey: string;
  fromEmail: string;
  fromName: string;
}

/** Reads RESEND_API_KEY, RESEND_FROM_EMAIL and RESEND_FROM_NAME. Throws if the key or sender is missing. */
export function resendConfigFromEnv(read: (name: string) => string | undefined): ResendConfig {
  const apiKey = read("RESEND_API_KEY")?.trim() ?? "";
  const fromEmail = read("RESEND_FROM_EMAIL")?.trim() ?? "";
  const fromName = (read("RESEND_FROM_NAME")?.trim() || "AURA Academy").replace(/[<>"\r\n]/g, "");

  if (!apiKey) throw new Error("RESEND_API_KEY is not set");
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(fromEmail)) {
    throw new Error("RESEND_FROM_EMAIL is missing or invalid");
  }
  return { apiKey, fromEmail, fromName };
}

export interface FiscalEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Stored on the delivery row. Reused on every retry of the same delivery. */
  idempotencyKey: string;
}

export type EmailSendResult =
  | { kind: "sent"; providerMessageId: string }
  | { kind: "retry"; httpStatus: number | null; message: string }
  | { kind: "failed"; httpStatus: number; message: string };

export async function sendFiscalEmail(config: ResendConfig, email: FiscalEmail): Promise<EmailSendResult> {
  let response: Response;
  try {
    response = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": email.idempotencyKey,
      },
      body: JSON.stringify({
        from: `${config.fromName} <${config.fromEmail}>`,
        to: [email.to],
        subject: email.subject,
        html: email.html,
        text: email.text,
      }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
  } catch (err) {
    return { kind: "retry", httpStatus: null, message: describe(err) };
  }

  let raw: string;
  try {
    raw = await response.text();
  } catch (err) {
    return { kind: "retry", httpStatus: response.status, message: describe(err) };
  }

  if (response.ok) {
    const id = parseMessageId(raw);
    return id
      ? { kind: "sent", providerMessageId: id }
      : { kind: "retry", httpStatus: response.status, message: "Resend accepted the request without an id" };
  }
  if (response.status === 429 || response.status >= 500) {
    return { kind: "retry", httpStatus: response.status, message: `Resend HTTP ${response.status}` };
  }
  return {
    kind: "failed",
    httpStatus: response.status,
    message: `Resend HTTP ${response.status}: ${raw.slice(0, 300)}`,
  };
}

/** Seconds to wait before retry number `attempt` (1-based): 2, 4, 8 minutes ... capped at 6 hours. */
export function retryDelaySeconds(attempt: number): number {
  return Math.min(6 * 60 * 60, 2 ** Math.max(1, attempt) * 60);
}

const ESCAPE: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escape every customer-supplied value before it goes into HTML. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ESCAPE[c] ?? c);
}

function parseMessageId(raw: string): string | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && "id" in parsed) {
      const id = (parsed as { id: unknown }).id;
      if (typeof id === "string" && id.length > 0) return id;
    }
  } catch {
    // Fall through: a non-JSON success body is treated as a retry by the caller.
  }
  return null;
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}