// Helpers shared by the fiscal Edge Functions. No database or network access happens here,
// so the Deno tests can import this file directly.

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

const MAX_BODY_BYTES = 64 * 1024;
const encoder = new TextEncoder();

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Structured log line. Never pass secrets or tokens here. */
export function logEvent(event: string, fields: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ ts: new Date().toISOString(), event, ...fields }));
}

export function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** JSON response. BigInt values are written as decimal strings. */
export function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  const text = JSON.stringify(body, (_key, value: unknown) =>
    typeof value === "bigint" ? value.toString() : value,
  );
  return new Response(text, {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

/** Maps a thrown value to a response. Never includes stack traces or secret values. */
export function errorResponse(err: unknown, headers: Record<string, string> = {}): Response {
  if (err instanceof HttpError) {
    return jsonResponse(err.status, { error: err.code, message: err.message }, headers);
  }
  const name = err instanceof Error ? err.name : "";
  const message = describeError(err);
  if (name === "FiscalValidationError") {
    return jsonResponse(400, { error: "validation", message }, headers);
  }
  if (name === "FiscalConfigError" || name === "FiscalAuthError") {
    return jsonResponse(503, { error: "config", message }, headers);
  }
  if (name === "FiscalAdminAuthError") {
    const status = (err as Error & { httpStatus?: number }).httpStatus ?? 401;
    return jsonResponse(status, { error: "auth", message }, headers);
  }
  logEvent("unhandled_error", { message: message.slice(0, 300) });
  return jsonResponse(500, { error: "internal", message: "Unexpected server error" }, headers);
}

/** Reads a JSON object body with a size limit. An empty body counts as {}. */
export async function readJsonObject(req: Request): Promise<Record<string, unknown>> {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    throw new HttpError(413, "payload_too_large", "Request body is too large");
  }
  const text = await req.text();
  if (encoder.encode(text).length > MAX_BODY_BYTES) {
    throw new HttpError(413, "payload_too_large", "Request body is too large");
  }
  if (text.trim() === "") return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new HttpError(400, "bad_json", "Body must be valid JSON");
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new HttpError(400, "bad_json", "Body must be a JSON object");
  }
  return parsed as Record<string, unknown>;
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Compares two secrets without stopping at the first mismatched byte. */
export function constantTimeEqual(a: string, b: string): boolean {
  const x = encoder.encode(a);
  const y = encoder.encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

/** Accepts a non-negative integer (number or digit string) in minor units. */
export function parseMinorUnits(value: unknown, field: string): bigint {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  if (typeof value === "string" && /^[0-9]{1,18}$/.test(value)) return BigInt(value);
  throw new HttpError(400, "validation", `${field} must be a non-negative integer in minor units`);
}

/** Reads an integer that came back from the database as a number or a string. */
export function bigIntFromStored(value: unknown): bigint {
  const text = typeof value === "number" || typeof value === "string" ? String(value) : "";
  if (!/^-?[0-9]+$/.test(text)) throw new Error("stored value is not an integer");
  return BigInt(text);
}

export function uuidField(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  if (typeof value !== "string" || !UUID_RE.test(value)) {
    throw new HttpError(400, "validation", `${key} must be a UUID`);
  }
  return value;
}

/** 1234 minor units becomes "12.34". Only for display in emails. */
export function formatEuroMinor(amount: bigint): string {
  return `${amount / 100n}.${(amount % 100n).toString().padStart(2, "0")}`;
}