// supabase/functions/delete-account/index.ts
//
// Permanently removes the CALLING user's account.
// Order matters:
//   1. validate (signed in, exact phrase, terms accepted, not a staff account)
//   2. mark the profile as "deleted" (webhooks stop writing for this user)
//   3. STOP BILLING in Stripe (cancel every subscription immediately, no more charges)
//      -> if this fails we abort and restore the account, nothing is deleted
//   4. delete uploaded files (storage)
//   5. purge database rows (public.purge_user_data, all-or-nothing)
//   6. hard-delete the auth user (the same e-mail / Google / Apple can sign up again)
//
// Payment records (amounts, dates, plan) are kept but ANONYMIZED (no user link),
// because Greek tax law requires you to keep accounting records.
import Stripe from "npm:stripe@^18";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@^2";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

const REQUIRED_PHRASE = "REMOVE MY ACCOUNT";

/** Team accounts own content (courses, reviews...). They are removed by a super admin, not here. */
const STAFF_ROLES = new Set([
  "educator",
  "senior_educator",
  "content_manager",
  "operations",
  "admin",
  "super_admin",
]);

const DEAD_STATUSES = new Set(["canceled", "incomplete_expired"]);

function isMissing(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === "resource_missing";
}

/* ------------------------------------------------------------------ */
/* Stripe                                                              */
/* ------------------------------------------------------------------ */

async function collectStripeIds(admin: SupabaseClient, stripe: Stripe, userId: string) {
  const customerIds = new Set<string>();
  const subscriptionIds = new Set<string>();

  const { data: maps } = await admin
    .from("stripe_customers")
    .select("stripe_customer_id")
    .eq("user_id", userId);
  for (const m of maps ?? []) if (m.stripe_customer_id) customerIds.add(String(m.stripe_customer_id));

  const { data: subs } = await admin
    .from("subscriptions")
    .select("stripe_customer_id, stripe_subscription_id")
    .eq("user_id", userId);
  for (const s of subs ?? []) {
    if (s.stripe_customer_id) customerIds.add(String(s.stripe_customer_id));
    if (s.stripe_subscription_id) subscriptionIds.add(String(s.stripe_subscription_id));
  }

  // Safety net: customers we created for this user but lost the mapping of.
  try {
    const found = await stripe.customers.search({
      query: `metadata['supabase_user_id']:'${userId}'`,
      limit: 20,
    });
    for (const c of found.data) customerIds.add(c.id);
  } catch (err) {
    console.error("customer search failed (continuing)", err);
  }

  return { customerIds, subscriptionIds };
}

/** Cancels every live subscription NOW (no proration, no final invoice). Throws if one cannot be stopped. */
async function cancelAllSubscriptions(
  stripe: Stripe,
  subscriptionIds: Set<string>,
  customerIds: Set<string>,
): Promise<number> {
  let canceled = 0;
  const seen = new Set<string>();

  const cancelOne = async (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    try {
      const sub = await stripe.subscriptions.retrieve(id);
      if (DEAD_STATUSES.has(sub.status)) return;
      await stripe.subscriptions.cancel(id, { prorate: false, invoice_now: false });
      canceled += 1;
    } catch (err) {
      if (isMissing(err)) return;
      throw err;
    }
  };

  for (const id of subscriptionIds) await cancelOne(id);

  for (const customerId of customerIds) {
    try {
      for await (const sub of stripe.subscriptions.list({ customer: customerId, status: "all", limit: 100 })) {
        await cancelOne(sub.id);
      }
    } catch (err) {
      if (!isMissing(err)) throw err;
    }
  }
  return canceled;
}

/* ------------------------------------------------------------------ */
/* Storage                                                             */
/* ------------------------------------------------------------------ */

async function removeFolder(admin: SupabaseClient, bucket: string, prefix: string, depth = 0): Promise<number> {
  if (depth > 3) return 0;
  const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error || !data) return 0; // bucket missing or empty: nothing to do

  let removed = 0;
  const files: string[] = [];
  for (const entry of data) {
    const path = `${prefix}/${entry.name}`;
    if (entry.id) files.push(path); // files have an id, folders don't
    else removed += await removeFolder(admin, bucket, path, depth + 1);
  }
  for (let i = 0; i < files.length; i += 100) {
    const chunk = files.slice(i, i + 100);
    const { error: rmError } = await admin.storage.from(bucket).remove(chunk);
    if (rmError) console.error(`storage remove failed in ${bucket}`, rmError.message);
    else removed += chunk.length;
  }
  return removed;
}

async function removeStoredFiles(
  admin: SupabaseClient,
  supabaseUrl: string,
  userId: string,
  avatarUrl: string | null,
): Promise<void> {
  const buckets = (Deno.env.get("ACCOUNT_DELETE_BUCKETS") ?? "elite-chat,avatars")
    .split(",")
    .map((b) => b.trim())
    .filter(Boolean);

  for (const bucket of buckets) {
    try {
      await removeFolder(admin, bucket, userId);
    } catch (err) {
      console.error(`storage cleanup failed for ${bucket}`, err);
    }
  }

  // The profile photo may live under a different path: delete it by its URL (our storage only).
  if (avatarUrl && avatarUrl.startsWith(supabaseUrl)) {
    const match = /\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+?)(?:\?|$)/.exec(avatarUrl);
    if (match?.[1] && match[2]) {
      try {
        await admin.storage.from(match[1]).remove([decodeURIComponent(match[2])]);
      } catch (err) {
        console.error("avatar removal failed", err);
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Handler                                                             */
/* ------------------------------------------------------------------ */

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!stripeKey || !supabaseUrl || !anonKey || !serviceKey) {
    console.error("Missing environment configuration");
    return json({ error: "Server misconfigured" }, 500);
  }

  // ---- 1. validate -------------------------------------------------
  let body: { confirmation?: unknown; acceptedTerms?: unknown };
  try {
    body = JSON.parse(await req.text());
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (body.confirmation !== REQUIRED_PHRASE) {
    return json({ error: `Γράψε ακριβώς: ${REQUIRED_PHRASE}` }, 400);
  }
  if (body.acceptedTerms !== true) {
    return json({ error: "Πρέπει να αποδεχτείς τους Όρους Χρήσης." }, 400);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  const user = userData?.user;
  if (userError || !user) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const stripe = new Stripe(stripeKey);
  const userId = user.id;

  const { data: profile } = await admin
    .from("profiles")
    .select("role, status, avatar_url")
    .eq("id", userId)
    .maybeSingle();

  const role = String(profile?.role ?? "student");
  if (STAFF_ROLES.has(role)) {
    return json(
      { error: "Οι λογαριασμοί ομάδας (εκπαιδευτές/admin) αφαιρούνται από έναν super admin. Επικοινώνησε μαζί μας." },
      403,
    );
  }

  const previousStatus = String(profile?.status ?? "active");

  try {
    // ---- 2. lock the account so webhooks / sessions stop touching it ---
    if (profile) {
      const { error: lockError } = await admin.from("profiles").update({ status: "deleted" }).eq("id", userId);
      if (lockError) throw new Error(`Could not lock the account: ${lockError.message}`);
    }

    // ---- 3. STOP BILLING ----------------------------------------------
    let customerIds = new Set<string>();
    try {
      const ids = await collectStripeIds(admin, stripe, userId);
      customerIds = ids.customerIds;
      const canceled = await cancelAllSubscriptions(stripe, ids.subscriptionIds, ids.customerIds);
      console.log(`delete-account ${userId}: canceled ${canceled} subscription(s)`);
    } catch (err) {
      console.error("Stripe cancellation failed, aborting deletion", err);
      if (profile) await admin.from("profiles").update({ status: previousStatus }).eq("id", userId);
      return json(
        { error: "Δεν μπορέσαμε να ακυρώσουμε τη συνδρομή σου στο Stripe. Δεν διαγράφηκε τίποτα — δοκίμασε ξανά ή επικοινώνησε μαζί μας." },
        502,
      );
    }

    // ---- 4. files -------------------------------------------------------
    await removeStoredFiles(admin, supabaseUrl, userId, (profile?.avatar_url as string | null) ?? null);

    // ---- 5. database (atomic) --------------------------------------------
    const { data: purge, error: purgeError } = await admin.rpc("purge_user_data", { p_user_id: userId });
    if (purgeError) {
      console.error("purge_user_data failed", purgeError.message);
      return json(
        {
          error:
            "Η συνδρομή σου ακυρώθηκε, αλλά η διαγραφή των δεδομένων δεν ολοκληρώθηκε. Μπορείς να ξαναπατήσεις διαγραφή ή να επικοινωνήσεις μαζί μας.",
          detail: purgeError.message,
        },
        500,
      );
    }
    console.log(`delete-account ${userId}: purge`, JSON.stringify(purge));

    // ---- 6. the login itself ------------------------------------------------
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error("auth deleteUser failed", deleteError.message);
      return json(
        {
          error: "Τα δεδομένα σου διαγράφηκαν, αλλά το login δεν αφαιρέθηκε. Ξαναπάτησε διαγραφή ή επικοινώνησε μαζί μας.",
          detail: deleteError.message,
        },
        500,
      );
    }

    // Stripe customer objects: remove personal data there too (payment records stay for accounting).
    for (const customerId of customerIds) {
      try {
        await stripe.customers.del(customerId);
      } catch (err) {
        if (!isMissing(err)) console.error(`could not delete Stripe customer ${customerId}`, err);
      }
    }

    return json({ ok: true });
  } catch (error) {
    console.error("delete-account failed", error);
    const message = error instanceof Error ? error.message : String(error);
    return json({ error: `Η διαγραφή απέτυχε: ${message}` }, 500);
  }
});