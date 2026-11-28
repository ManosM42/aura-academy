// AADE myDATA endpoints. The ONLY place that maps an environment to a URL.
// Source: AADE "myDATA API Documentation" v2.0.2 (ERP), section on environments:
//   DEMO (development): https://mydataapidev.aade.gr/<Operation>
//   LIVE (production):  https://mydatapi.aade.gr/myDATA/<Operation>
// Runtime-neutral (no Deno or Node specific APIs) so the tests can run under either.

export type MyDataEnvironment = "demo" | "live";

export const MYDATA_BASE_URLS: Readonly<Record<MyDataEnvironment, string>> = Object.freeze({
  demo: "https://mydataapidev.aade.gr",
  live: "https://mydatapi.aade.gr/myDATA",
});

export type MyDataOperation = "SendInvoices" | "CancelInvoice" | "RequestTransmittedDocs" | "RequestDocs";

const OPERATIONS: readonly MyDataOperation[] = ["SendInvoices", "CancelInvoice", "RequestTransmittedDocs", "RequestDocs"];

export class MyDataConfigError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "MyDataConfigError";
    this.code = code;
  }
}

export function isMyDataEnvironment(value: unknown): value is MyDataEnvironment {
  return value === "demo" || value === "live";
}

export function assertEnvironment(value: unknown): MyDataEnvironment {
  if (!isMyDataEnvironment(value)) {
    throw new MyDataConfigError("invalid_environment", "environment must be demo or live");
  }
  return value;
}

export function endpointFor(
  environment: MyDataEnvironment,
  operation: MyDataOperation,
  query: Readonly<Record<string, string | number | bigint | undefined>> = {},
): string {
  const env = assertEnvironment(environment);
  if (!OPERATIONS.includes(operation)) {
    throw new MyDataConfigError("invalid_operation", `unsupported operation ${String(operation)}`);
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }
  const qs = params.toString();
  return `${MYDATA_BASE_URLS[env]}/${operation}${qs ? `?${qs}` : ""}`;
}
