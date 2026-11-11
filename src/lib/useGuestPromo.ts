// src/lib/useGuestPromo.ts
//
// Decides WHEN to show a "join AURA, members save" pop-up to visitors who are
// not signed in. Two triggers, whichever comes first, once per browser session:
//   1. a timer (skipped while `paused`, e.g. while a checkout window is open)
//   2. the moment a guest presses Order / Book: `guard(action)` shows the pop-up
//      first and runs `action` as soon as they close it or choose to continue.
// Signed-in users never see it.
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthUser } from "@/lib/useAuthUser";

export function useGuestPromo({
  storageKey,
  delayMs = 9000,
  enabled = true,
  paused = false,
}: {
  storageKey: string;
  delayMs?: number;
  /** Turn the pop-up off entirely (e.g. when no plan has a discount any more). */
  enabled?: boolean;
  paused?: boolean;
}) {
  const { user, loading } = useAuthUser();
  const eligible = enabled && !loading && !user;

  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const shownRef = useRef(false);

  const seen = useCallback((): boolean => {
    if (shownRef.current) return true;
    try {
      return sessionStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  }, [storageKey]);

  const markSeen = useCallback(() => {
    shownRef.current = true;
    try {
      sessionStorage.setItem(storageKey, "1");
    } catch {
      /* storage blocked: the ref still keeps it to once per page visit */
    }
  }, [storageKey]);

  // Timer trigger
  useEffect(() => {
    if (!eligible || paused || seen()) return;
    const timer = window.setTimeout(() => {
      if (seen()) return;
      markSeen();
      setOpen(true);
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [eligible, paused, delayMs, seen, markSeen]);

  // If they sign in while it is open, close it and let their action through.
  useEffect(() => {
    if (!eligible && open) {
      setOpen(false);
      setPending(null);
    }
  }, [eligible, open]);

  /** Wrap the Order / Book click. */
  const guard = useCallback(
    (action: () => void) => {
      if (eligible && !seen()) {
        markSeen();
        setPending(() => action);
        setOpen(true);
        return;
      }
      action();
    },
    [eligible, seen, markSeen],
  );

  /** Close (X, Esc, backdrop or "continue"): if they were ordering, carry on. */
  const close = useCallback(() => {
    const action = pending;
    setOpen(false);
    setPending(null);
    action?.();
  }, [pending]);

  return { open, close, guard, canContinue: pending !== null };
}
