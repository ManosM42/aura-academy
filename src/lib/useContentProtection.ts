// src/lib/useContentProtection.ts
import { useEffect, useState } from "react";

/**
 * Deterrents only. Cannot stop OS-level screenshots or screen recorders.
 * Returns `shielded`: true while the content should be hidden (tab hidden,
 * window unfocused, PrintScreen pressed).
 */
export function useContentProtection(enabled: boolean, hideOnBlur = true) {
  const [shielded, setShielded] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setShielded(false);
      return;
    }

    const block = (e: Event) => e.preventDefault();

    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const mod = e.ctrlKey || e.metaKey;
      if (
        k === "f12" ||
        (mod && ["s", "p", "u"].includes(k)) ||
        (mod && e.shiftKey && ["i", "j", "c"].includes(k))
      ) {
        e.preventDefault();
      }
    };

    // PrintScreen only fires keyup on most browsers.
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "PrintScreen") {
        navigator.clipboard?.writeText("").catch(() => {});
        setShielded(true);
        window.setTimeout(() => setShielded(document.hidden), 1500);
      }
    };

    const onVisibility = () => setShielded(document.hidden);
    const onBlur = () => hideOnBlur && setShielded(true);
    const onFocus = () => setShielded(document.hidden);

    document.addEventListener("contextmenu", block);
    document.addEventListener("dragstart", block);
    document.addEventListener("copy", block);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);

    return () => {
      document.removeEventListener("contextmenu", block);
      document.removeEventListener("dragstart", block);
      document.removeEventListener("copy", block);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
    };
  }, [enabled, hideOnBlur]);

  return shielded;
}