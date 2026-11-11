// src/lib/changePlan.ts
import { supabase } from "@/lib/supabase";
import type { PlanId } from "@/lib/plans";

export const PLAN_RANK: Record<PlanId, number> = { low: 1, mid: 2, high: 3 };

/**
 * What a pricing card should show for the signed-in user:
 *  - none:    no active subscription -> normal "subscribe" button
 *  - current: this is the user's plan  -> "Έχεις πρόσβαση"
 *  - upgrade: a higher plan            -> "Αναβάθμιση"
 *  - lower:   a plan below the user's  -> already included, no button
 */
export type PlanCardState = "none" | "current" | "upgrade" | "lower";

export function getPlanCardState(
  currentPlanId: PlanId | null | undefined,
  cardPlanId: PlanId,
): PlanCardState {
  if (!currentPlanId) return "none";
  if (cardPlanId === currentPlanId) return "current";
  return PLAN_RANK[cardPlanId] > PLAN_RANK[currentPlanId] ? "upgrade" : "lower";
}

export interface UpgradePreview {
  currentPlanId: PlanId;
  targetPlanId: PlanId;
  currentPlanName: string;
  targetPlanName: string;
  currency: string;
  /** What the customer pays per month right now. */
  currentAmountCents: number;
  /** Full monthly price of the new plan (charged from the next cycle on). */
  newAmountCents: number;
  /** What is charged today. */
  differenceCents: number;
  /** ISO date of the next renewal (same day next month). */
  nextRenewal: string;
}

export interface UpgradeResult {
  ok: true;
  planId: PlanId;
  chargedCents: number | null;
  nextRenewal: string | null;
}

async function callChangePlan<T>(body: { planId: PlanId; preview?: boolean }): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T & { error?: string }>("change-plan", {
    body,
  });

  if (error) {
    // FunctionsHttpError keeps the original Response in `context`.
    const res = (error as { context?: Response }).context;
    if (res && typeof res.json === "function") {
      try {
        const payload = (await res.json()) as { error?: string };
        if (payload?.error) throw new Error(payload.error);
      } catch (parseErr) {
        if (parseErr instanceof Error && parseErr.message) throw parseErr;
      }
    }
    throw new Error(error.message || "Η αναβάθμιση δεν μπόρεσε να ολοκληρωθεί.");
  }

  const payload = data as (T & { error?: string }) | null;
  if (!payload) throw new Error("Κενή απάντηση από τον server.");
  if (payload.error) throw new Error(payload.error);
  return payload;
}

/** Numbers only, nothing is charged or changed. */
export function previewUpgrade(planId: PlanId): Promise<UpgradePreview> {
  return callChangePlan<UpgradePreview>({ planId, preview: true });
}

/** Charges the difference and switches the plan. */
export function upgradePlan(planId: PlanId): Promise<UpgradeResult> {
  return callChangePlan<UpgradeResult>({ planId });
}