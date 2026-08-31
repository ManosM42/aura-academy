// src/lib/useSubscription.ts
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
  created_at: string;
}

const ACTIVE_STATUSES = ["active", "trialing"] as const;

const COLUMNS =
  "id, user_id, plan_id, status, current_period_end, cancel_at_period_end, created_at";

/** Μόνο αυτά τα statuses ξεκλειδώνουν την Academy. */
export function isActiveStatus(status: string): boolean {
  return (ACTIVE_STATUSES as readonly string[]).includes(status);
}

export interface UseSubscriptionOptions {
  /**
   * Επιστρέφει και canceled / past_due / unpaid. Το προφίλ τα χρειάζεται
   * για να δείξει *τι αγόρασε* ο χρήστης· το checkout guard ΔΕΝ πρέπει να
   * τα ζητά, γιατί μια ληγμένη γραμμή θα μπλόκαρε νέα αγορά.
   */
  includeInactive?: boolean;
}

export interface SubscriptionState {
  subscription: SubscriptionRow | null;
  hasAccess: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useSubscription(
  userId: string | undefined,
  options: UseSubscriptionOptions = {},
): SubscriptionState {
  const includeInactive = options.includeInactive ?? false;

  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(userId));
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

    let query = db.from("subscriptions").select(COLUMNS).eq("user_id", userId);

    if (!includeInactive) {
      query = query.in("status", ACTIVE_STATUSES as unknown as string[]);
    }

    // order + limit(1) κρατά το maybeSingle() ασφαλές ακόμα κι αν ένας
    // χρήστης καταλήξει με πάνω από μία γραμμή (το Stripe δεν εγγυάται
    // σειρά events).
    void query
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
          if (data) {
            // Υπάρχει γραμμή αλλά με άγνωστο plan_id: το δείχνουμε αντί να
            // προσποιηθούμε ότι ο χρήστης δεν πλήρωσε ποτέ.
            console.error("subscriptions row with unknown plan_id", data);
            setError("Άγνωστο πακέτο στη συνδρομή.");
          }
          setSubscription(null);
        }
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [userId, includeInactive, tick]);

  return {
    subscription,
    hasAccess: subscription !== null && isActiveStatus(subscription.status),
    loading,
    error,
    refresh,
  };
}