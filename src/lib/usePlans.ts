// src/lib/usePlans.ts
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { db } from "@/lib/db";
import {
  formatEuro,
  getLivePlans,
  isPlanId,
  setLivePlans,
  subscribePlans,
  type AuraPlan,
} from "@/lib/plans";

// `plans` is not in the generated types, so use an untyped client.
const sb = db as unknown as SupabaseClient;

interface PlanRowDb {
  id: string;
  name: string;
  slogan: string | null;
  tagline: string | null;
  badge: string | null;
  price_cents: number;
  currency: string | null;
  features: unknown;
  highlight: boolean;
  sort_order: number;
}

export function rowToPlan(row: PlanRowDb): AuraPlan | null {
  if (!isPlanId(row.id)) return null;
  const features = Array.isArray(row.features)
    ? row.features.filter((f): f is string => typeof f === "string" && f.trim().length > 0)
    : [];
  return {
    id: row.id,
    name: row.name,
    slogan: row.slogan ?? "",
    tagline: row.tagline ?? "",
    badge: row.badge?.trim() ? row.badge : undefined,
    priceLabel: formatEuro(row.price_cents),
    amountCents: row.price_cents,
    currency: "eur",
    interval: "month",
    features,
    highlight: row.highlight,
  };
}

let loaded = false;
let inflight: Promise<void> | null = null;

async function fetchPlans(): Promise<void> {
  const { data, error } = await sb
    .from("plans")
    .select("id, name, slogan, tagline, badge, price_cents, currency, features, highlight, sort_order")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);

  const plans = ((data ?? []) as PlanRowDb[])
    .map(rowToPlan)
    .filter((p): p is AuraPlan => p !== null);

  // An empty table must never leave the site without plans: keep the defaults.
  if (plans.length > 0) setLivePlans(plans);
}

/** Call after an admin saves, so public pages re-fetch the new prices. */
export function invalidatePlans(): void {
  loaded = false;
  inflight = null;
  setLivePlans(null);
}

/**
 * The plans to show. Defaults first, replaced by the admin-edited ones as soon
 * as the database answers. `loading` is true until the first answer, so pricing
 * and checkout can avoid flashing a stale price.
 */
export function usePlans(): {
  plans: AuraPlan[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const plans = useSyncExternalStore(subscribePlans, getLivePlans, getLivePlans);
  const [loading, setLoading] = useState(!loaded);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      inflight = inflight ?? fetchPlans();
      await inflight;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load plans.");
    } finally {
      inflight = null;
      loaded = true;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loaded) void refresh();
  }, [refresh]);

  return { plans, loading, error, refresh };
}