// Loads the credentials of exactly one environment through the service-role-only RPC
// public.mydata_get_credentials (which reads Supabase Vault). There is no environment variable fallback and
// no "default" environment: asking for demo can only ever return demo credentials.

import { assertEnvironment, MyDataConfigError } from "./endpoints.ts";
import type { MyDataEnvironment } from "./endpoints.ts";
import type { MyDataCredentials } from "./types.ts";

export interface RpcCapable {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

export async function loadCredentials(db: RpcCapable, environment: MyDataEnvironment): Promise<MyDataCredentials> {
  const env = assertEnvironment(environment);
  const { data, error } = await db.rpc("mydata_get_credentials", { p_environment: env });
  if (error) throw new MyDataConfigError("credentials_unavailable", `could not read ${env} credentials`);
  const row = Array.isArray(data) ? data[0] : data;
  const userId = row && typeof row === "object" ? (row as Record<string, unknown>).user_id : null;
  const key = row && typeof row === "object" ? (row as Record<string, unknown>).subscription_key : null;
  if (typeof userId !== "string" || userId.trim() === "" || typeof key !== "string" || key.trim() === "") {
    throw new MyDataConfigError("credentials_missing", `${env} credentials are not configured`);
  }
  return Object.freeze({ environment: env, userId: userId.trim(), subscriptionKey: key.trim() });
}
