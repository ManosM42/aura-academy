import { useCallback, useEffect, useState } from "react";
import { db } from "@/lib/db";
import { isPlanId, type PlanId } from "@/lib/plans";

export interface SubscriptionRow {
  id: string;
  user_id: string;
  plan_id: PlanId;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

const ACTIVE_STATUSES = ["active", "trialing"] as const;

export interface SubscriptionState {
  subscription: SubscriptionRow | null;
  hasAccess: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useSubscription(userId: string | undefined): SubscriptionState {
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null);
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    let active = true;

    if (!userId) {
      setSubscription(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    db.from("subscriptions")
      .select("id, user_id, plan_id, status, current_period_end, cancel_at_period_end")
      .eq("user_id", userId)
      .in("status", ACTIVE_STATUSES as unknown as string[])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data, error: queryError }) => {
        if (!active) return;
        if (queryError) {
          setError(queryError.message);
          setSubscription(null);
        } else if (data && isPlanId((data as SubscriptionRow).plan_id)) {
          setSubscription(data as SubscriptionRow);
        } else {
          setSubscription(null);
        }
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [userId, tick]);

  return {
    subscription,
    hasAccess: subscription !== null,
    loading,
    error,
    refresh,
  };
}