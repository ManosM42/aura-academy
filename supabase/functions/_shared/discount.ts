// supabase/functions/_shared/discount.ts
//
// Server-side member pricing. The browser only DISPLAYS discounts; the amount
// that Stripe charges is always decided here, from the caller's verified JWT
// and public.aura_quote() (see aura-discounts.sql).

// deno-lint-ignore no-explicit-any
type AnyClient = any;

export interface Quote {
  userId: string | null;
  plan: string | null;
  percent: number;
  listCents: number;
  finalCents: number;
}

/** The user id behind the Authorization header, or null for guests / anon key. */
export async function callerUserId(req: Request, db: AnyClient): Promise<string | null> {
  const header = req.headers.get("Authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  if (!token) return null;

  // The plain anon/publishable key is not a user token: getUser() rejects it,
  // which is exactly what we want (guest = no discount).
  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user.id as string;
}

/**
 * Price for this caller. `product` is 'book' or 'online_seminar'.
 * Throws if the database cannot answer, so we never silently charge a
 * different price than the one the member was promised.
 */
export async function quoteForCaller(
  req: Request,
  db: AnyClient,
  product: "book" | "online_seminar",
  listCents: number,
): Promise<Quote> {
  const userId = await callerUserId(req, db);
  if (!userId) {
    return { userId: null, plan: null, percent: 0, listCents, finalCents: listCents };
  }

  const { data, error } = await db.rpc("aura_quote", {
    p_user: userId,
    p_product: product,
    p_list_cents: listCents,
  });
  if (error || !data) throw new Error(`aura_quote failed: ${error?.message ?? "no data"}`);

  const q = data as { plan: string | null; percent: number; final_cents: number };
  return {
    userId,
    plan: q.plan ?? null,
    percent: Number(q.percent) || 0,
    listCents,
    finalCents: Number(q.final_cents),
  };
}
