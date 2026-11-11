// src/lib/perks.ts
//
// Member perks (e.g. the FORZA BRAVA code). The server only returns the code to
// signed-in users whose active plan qualifies: see aura-forza-brava.sql.
import { useCallback, useEffect, useState } from "react";
import { db } from "@/lib/db";
import { isPlanId, type PlanId } from "@/lib/plans";

export interface PerkState {
  loading: boolean;
  /** The request itself failed (network, SQL not installed...). Not the same as "not eligible". */
  error: string | null;
  /** The perk exists and is switched on. */
  available: boolean;
  /** This user's plan qualifies. Decided by the server. */
  eligible: boolean;
  plan: PlanId | null;
  percent: number;
  /** Only ever set when `eligible` is true. */
  code: string | null;
  reload: () => void;
}

export function useMyPerk(perk: string, userId?: string): PerkState {
  const [state, setState] = useState<Omit<PerkState, "reload">>({
    loading: true,
    error: null,
    available: false,
    eligible: false,
    plan: null,
    percent: 0,
    code: null,
  });
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    let active = true;
    setState((s) => ({ ...s, loading: true, error: null }));

    void (async () => {
      const { data, error } = await db.rpc("get_my_perk", { p_perk: perk });
      if (!active) return;

      if (error || !data) {
        setState({
          loading: false,
          error: error?.message ?? "No answer from the server.",
          available: false,
          eligible: false,
          plan: null,
          percent: 0,
          code: null,
        });
        return;
      }

      const row = data as {
        available?: unknown;
        eligible?: unknown;
        plan?: unknown;
        percent?: unknown;
        code?: unknown;
      };
      const eligible = row.eligible === true;
      const percent = Number(row.percent);
      setState({
        loading: false,
        error: null,
        available: row.available === true,
        eligible,
        plan: isPlanId(row.plan) ? row.plan : null,
        percent: Number.isFinite(percent) ? Math.min(100, Math.max(0, Math.round(percent))) : 0,
        code: eligible && typeof row.code === "string" ? row.code : null,
      });
    })();

    return () => {
      active = false;
    };
  }, [perk, userId, tick]);

  return { ...state, reload };
}
