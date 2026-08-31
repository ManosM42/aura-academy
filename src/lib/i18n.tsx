// src/lib/i18n.tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export const LANGS = ["el", "en"] as const;
export type Lang = (typeof LANGS)[number];

export const DEFAULT_LANG: Lang = "el";
const STORAGE_KEY = "aura.lang";

function isLang(value: unknown): value is Lang {
  return typeof value === "string" && (LANGS as readonly string[]).includes(value);
}

/** Πηγή αλήθειας για τα κλειδιά. Ό,τι μπαίνει εδώ, απαιτείται και στα αγγλικά. */
const el = {
  "nav.mainNav": "Κύρια πλοήγηση",
  "nav.home": "AURA — Αρχική",
  "nav.menu": "Μενού",
  "nav.openMenu": "Άνοιγμα μενού",
  "nav.closeMenu": "Κλείσιμο μενού",
  "nav.language": "Γλώσσα",
  "nav.about": "ΕΜΕΙΣ",
  "nav.contact": "ΕΠΙΚΟΙΝΩΝΙΑ",
  "nav.method": "ΜΕΘΟΔΟΣ",
  "nav.prices": "ΤΙΜΕΣ",
  "nav.dashboard": "Dashboard",
  "nav.academy": "Ακαδημία",
  "nav.courses": "Courses",
  "nav.skills": "Δεξιότητες",
  "nav.reviewQueue": "Ουρά αξιολόγησης",
  "nav.adminPanel": "Πάνελ Admin",
  "nav.inbox": "Μηνύματα",
  "nav.start": "ΞΕΚΙΝΑ",
  "nav.startNow": "ΞΕΚΙΝΑ ΤΩΡΑ",
  "nav.signIn": "Σύνδεση",
  "nav.signOut": "Αποσύνδεση",
  "nav.myProfile": "Το προφίλ μου",
  "nav.viewProfile": "Προβολή προφίλ",
  "nav.tagline": "AURA — HAIR METHOD",
  "auth.finishingTitle": "Ολοκληρώνουμε τη σύνδεση…",
  "auth.finishingKicker": "ΣΥΝΔΕΣΗ",
  "auth.timeoutKicker": "ΚΑΘΥΣΤΕΡΗΣΗ",
  "auth.timeoutTitle": "Η σύνδεση δεν ολοκληρώθηκε",
  "auth.timeoutBody":
    "Δεν καταφέραμε να επιβεβαιώσουμε τη σύνδεσή σου. Δοκίμασε ξανά από τη σελίδα σύνδεσης.",
  "auth.errorKicker": "ΣΦΑΛΜΑ",
  "auth.errorTitle": "Η σύνδεση απέτυχε",
  "auth.backToLogin": "ΠΙΣΩ ΣΤΗ ΣΥΝΔΕΣΗ",
  "auth.goHome": "Αρχική",
} as const;

export type TranslationKey = keyof typeof el;

const en: Record<TranslationKey, string> = {
  "nav.mainNav": "Main navigation",
  "nav.home": "AURA — Home",
  "nav.menu": "Menu",
  "nav.openMenu": "Open menu",
  "nav.closeMenu": "Close menu",
  "nav.language": "Language",
  "nav.about": "ABOUT US",
  "nav.contact": "CONTACT",
  "nav.method": "METHOD",
  "nav.prices": "PRICES",
  "nav.dashboard": "Dashboard",
  "nav.academy": "Academy",
 "nav.courses": "Courses",
  "nav.skills": "Skills",
  "nav.reviewQueue": "Review Queue",
  "nav.adminPanel": "Admin Panel",
  "nav.inbox": "Inbox",
  "nav.start": "START",
  "nav.startNow": "START NOW",
  "nav.signIn": "Sign in",
  "nav.signOut": "Sign out",
  "nav.myProfile": "My profile",
  "nav.viewProfile": "View profile",
  "nav.tagline": "AURA — HAIR METHOD",
  "auth.finishingTitle": "Finishing your sign-in…",
  "auth.finishingKicker": "SIGNING IN",
  "auth.timeoutKicker": "TAKING TOO LONG",
  "auth.timeoutTitle": "Sign-in did not complete",
  "auth.timeoutBody": "We could not confirm your session. Please try again from the login page.",
  "auth.errorKicker": "ERROR",
  "auth.errorTitle": "Sign-in failed",
  "auth.backToLogin": "BACK TO LOGIN",
  "auth.goHome": "Home",
};

const DICTIONARIES: Record<Lang, Record<TranslationKey, string>> = { el, en };

export type Translate = (key: TranslationKey, vars?: Record<string, string | number>) => string;

interface I18nValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Translate;
}

const I18nContext = createContext<I18nValue | null>(null);

function readStoredLang(): Lang | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isLang(stored) ? stored : null;
  } catch {
    // localStorage μπλοκαρισμένο (private mode) — αγνοούμε σιωπηλά.
    return null;
  }
}

function detectBrowserLang(): Lang {
  const candidates = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const value of candidates) {
    if (typeof value !== "string") continue;
    const base = value.slice(0, 2).toLowerCase();
    if (base === "el") return "el";
    if (base === "en") return "en";
  }
  return DEFAULT_LANG;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  // Ο server δεν έχει localStorage: ξεκινάμε ντετερμινιστικά και συγχρονίζουμε στον client.
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);

  useEffect(() => {
    const next = readStoredLang() ?? detectBrowserLang();
    if (next !== DEFAULT_LANG) setLangState(next);
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Δεν είναι κρίσιμο· η γλώσσα απλά δεν θυμάται μεταξύ sessions.
    }
  }, []);

  const t = useCallback<Translate>(
    (key, vars) => {
      const template = DICTIONARIES[lang][key] ?? DICTIONARIES[DEFAULT_LANG][key] ?? key;
      if (!vars) return template;
      return template.replace(/\{(\w+)\}/g, (match, name: string) => {
        const value = vars[name];
        return value === undefined ? match : String(value);
      });
    },
    [lang],
  );

  const value = useMemo<I18nValue>(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>.");
  return ctx;
}