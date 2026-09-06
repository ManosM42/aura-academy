// src/lib/cookieConsent.tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ConsentStatus = "accepted" | "rejected" | null;

const STORAGE_KEY = "aura_cookie_consent";

interface CookieConsentContextValue {
  status: ConsentStatus;
  accept: () => void;
  reject: () => void;
  reset: () => void; // χρήσιμο για link "Διαχείριση cookies" στο footer
}

const CookieConsentContext = createContext<CookieConsentContextValue | null>(null);

function readStoredConsent(): ConsentStatus {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw === "accepted" || raw === "rejected" ? raw : null;
}

export function CookieConsentProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ConsentStatus>(null);

  useEffect(() => {
    setStatus(readStoredConsent());
  }, []);

  function persist(value: ConsentStatus) {
    setStatus(value);
    if (value === null) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, value);
    }
  }

  const value: CookieConsentContextValue = {
    status,
    accept: () => persist("accepted"),
    reject: () => persist("rejected"),
    reset: () => persist(null),
  };

  return <CookieConsentContext.Provider value={value}>{children}</CookieConsentContext.Provider>;
}

export function useCookieConsent() {
  const ctx = useContext(CookieConsentContext);
  if (!ctx) throw new Error("useCookieConsent must be used within a CookieConsentProvider");
  return ctx;
}