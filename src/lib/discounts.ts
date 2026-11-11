// src/lib/discounts.ts
//
// Member discounts for the physical book and the online seminars.
//
// IMPORTANT: this file only DISPLAYS prices. The amount Stripe really charges
// is decided by the edge functions (create-book-checkout / create-online-checkout)
// through public.aura_quote(), from the caller's verified session.
import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import { isPlanId, type PlanId } from "@/lib/plans";

export interface MyDiscounts {
  /** Active plan of the signed-in user, or null for guests / no active plan. */
  plan: PlanId | null;
  bookPercent: number;
  seminarPercent: number;
  loading: boolean;
}

const NONE: MyDiscounts = { plan: null, bookPercent: 0, seminarPercent: 0, loading: false };

function clampPercent(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

/**
 * Same maths as public.aura_apply_percent(): integer cents, rounded half up.
 * 4900 cents at 25% -> 3675.
 */
export function applyPercent(cents: number, percent: number): number {
  const p = clampPercent(percent);
  return Math.max(0, Math.floor((cents * (100 - p) + 50) / 100));
}

async function fetchMyDiscounts(): Promise<MyDiscounts> {
  const { data, error } = await db.rpc("get_my_discounts");
  if (error || !data) {
    if (error) console.error("get_my_discounts:", error.message);
    return NONE;
  }
  const row = data as { plan?: unknown; book_percent?: unknown; online_seminar_percent?: unknown };
  return {
    plan: isPlanId(row.plan) ? row.plan : null,
    bookPercent: clampPercent(row.book_percent),
    seminarPercent: clampPercent(row.online_seminar_percent),
    loading: false,
  };
}

/** Discounts of the current visitor. Re-reads when they sign in or out. */
export function useMyDiscounts(): MyDiscounts {
  const [state, setState] = useState<MyDiscounts>({ ...NONE, loading: true });

  useEffect(() => {
    let active = true;

    const load = () => {
      void fetchMyDiscounts()
        .then((next) => active && setState(next))
        .catch(() => active && setState(NONE));
    };

    load();
    const { data: sub } = db.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") load();
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}

/* ------------------------------------------------------------------ */
/* Public discount table (for marketing pop-ups: "PRO saves 25%…")     */
/* ------------------------------------------------------------------ */

export type DiscountProduct = "book" | "online_seminar";
export type DiscountTable = Record<PlanId, Record<DiscountProduct, number>>;

/** Used until the database answers, and if it cannot be reached. Same as aura-discounts.sql. */
const DEFAULT_TABLE: DiscountTable = {
  low: { book: 0, online_seminar: 0 },
  mid: { book: 25, online_seminar: 0 },
  high: { book: 50, online_seminar: 25 },
};

/** Percentages per plan, read from public.plan_discounts (readable by everyone). */
export function usePlanDiscountTable(): DiscountTable {
  const [table, setTable] = useState<DiscountTable>(DEFAULT_TABLE);

  useEffect(() => {
    let active = true;

    void (async () => {
      const { data, error } = await db.from("plan_discounts").select("plan_id, product, percent");
      if (!active || error || !Array.isArray(data) || data.length === 0) return;

      const next: DiscountTable = {
        low: { ...DEFAULT_TABLE.low },
        mid: { ...DEFAULT_TABLE.mid },
        high: { ...DEFAULT_TABLE.high },
      };
      for (const row of data as { plan_id: unknown; product: unknown; percent: unknown }[]) {
        if (!isPlanId(row.plan_id)) continue;
        if (row.product === "book" || row.product === "online_seminar") {
          next[row.plan_id][row.product] = clampPercent(row.percent);
        }
      }
      setTable(next);
    })();

    return () => {
      active = false;
    };
  }, []);

  return table;
}
