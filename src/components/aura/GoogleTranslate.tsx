// src/components/aura/GoogleTranslate.tsx
import { useEffect, useState } from "react";

declare global {
  interface Window {
    google: any;
    googleTranslateElementInit: () => void;
  }
}

const SUPPORTED_LANGS = ["en", "el", "de"] as const;
type Lang = (typeof SUPPORTED_LANGS)[number];

const COOKIE_NAME = "googtrans";

/**
 * Διαβάζει την τρέχουσα γλώσσα από το googtrans cookie.
 * Η Google το γράφει σε format "/en/el" (source/target).
 * Απουσία cookie ή target === "" -> πρωτότυπη γλώσσα (en).
 */
function readLangFromCookie(): Lang {
  const match = document.cookie.match(/(?:^|;\s*)googtrans=([^;]*)/);
  if (!match) return "en";
  const raw = decodeURIComponent(match[1]);
  const parts = raw.split("/"); // ["", "en", "el"]
  const target = parts[2];
  return (SUPPORTED_LANGS as readonly string[]).includes(target)
    ? (target as Lang)
    : "en";
}

/**
 * Σβήνει το googtrans cookie σε ΟΛΟΥΣ τους πιθανούς συνδυασμούς
 * path/domain που μπορεί να το έχει γράψει η Google (με ή χωρίς
 * leading dot, με ή χωρίς domain), ώστε να μη μείνει "φαντάσμα"
 * τιμή που μπλοκάρει το επόμενο switch.
 */
function clearGoogTransCookie() {
  const host = window.location.hostname;
  const expired = "expires=Thu, 01 Jan 1970 00:00:00 UTC";
  const variants = [
    `${COOKIE_NAME}=; ${expired}; path=/;`,
    `${COOKIE_NAME}=; ${expired}; path=/; domain=${host};`,
    `${COOKIE_NAME}=; ${expired}; path=/; domain=.${host};`,
  ];
  variants.forEach((v) => (document.cookie = v));
}

/**
 * Γράφει το googtrans cookie για τη ζητούμενη γλώσσα σε ΟΛΟΥΣ τους
 * σχετικούς domain scopes, ώστε να "πιάσει" σίγουρα ανεξαρτήτως του
 * πώς είναι configured το site (localhost, subdomain, root domain).
 */
function writeGoogTransCookie(lang: Lang) {
  clearGoogTransCookie();
  if (lang === "en") return; // "" = πρωτότυπο, δεν χρειάζεται cookie

  const host = window.location.hostname;
  const value = `/en/${lang}`;
  const oneYear = 60 * 60 * 24 * 365;
  const variants = [
    `${COOKIE_NAME}=${value}; path=/; max-age=${oneYear};`,
    `${COOKIE_NAME}=${value}; path=/; domain=${host}; max-age=${oneYear};`,
  ];
  // Το leading-dot domain πιάνει μόνο σε πραγματικά domains, όχι σε
  // localhost/IP — εκεί ρίχνει silent error που δεν πειράζει.
  if (host !== "localhost" && !/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    variants.push(
      `${COOKIE_NAME}=${value}; path=/; domain=.${host}; max-age=${oneYear};`,
    );
  }
  variants.forEach((v) => {
    try {
      document.cookie = v;
    } catch {
      /* ignore invalid domain combos */
    }
  });
}

export function GoogleTranslateWidget() {
  const [currentLang, setCurrentLang] = useState<Lang>("en");

  useEffect(() => {
    setCurrentLang(readLangFromCookie());

    if (!window.googleTranslateElementInit) {
      window.googleTranslateElementInit = () => {
        if (window.google && window.google.translate) {
          new window.google.translate.TranslateElement(
            {
              pageLanguage: "en",
              includedLanguages: SUPPORTED_LANGS.join(","),
              layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE,
              autoDisplay: false,
            },
            "google_translate_element",
          );
        }
      };
    }

    if (!document.getElementById("google-translate-script")) {
      const script = document.createElement("script");
      script.id = "google-translate-script";
      script.type = "text/javascript";
      script.src =
        "//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
      script.async = true;
      document.body.appendChild(script);
    } else if (window.google?.translate) {
      try {
        if (!document.getElementById("google_translate_element")?.hasChildNodes()) {
          window.googleTranslateElementInit();
        }
      } catch (e) {
        console.error("Google Translate Init Error:", e);
      }
    }
  }, []);

  function changeLanguage(lang: Lang) {
    if (lang === currentLang) return;

    // Optimistic UI update ώστε το dropdown να δείχνει αμέσως τη νέα
    // επιλογή, ακόμα κι αν το reload πάρει λίγα ms.
    setCurrentLang(lang);

    // Γράφουμε σωστά το cookie (καθαρίζοντας πρώτα οποιαδήποτε παλιά
    // τιμή) και μετά κάνουμε ένα καθαρό reload. Αυτό είναι ο μόνος
    // 100% αξιόπιστος τρόπος να αλλάξεις γλώσσα -> γλώσσα (π.χ. EL -> DE
    // -> EN -> EL) χωρίς να "κολλάει", γιατί η Google ξεκινάει κάθε
    // φορά από clean, αμετάφραστο DOM αντί να προσπαθεί να ξανα-
    // μεταφράσει ένα ήδη-μεταφρασμένο page μέσω live event dispatch.
    writeGoogTransCookie(lang);
    window.location.reload();
  }

  const labels: Record<Lang, string> = { en: "EN", el: "ΕΛ", de: "DE" };

  return (
    <div className="relative inline-block">
      {/* Hidden Google Translate Element container */}
      <div
        id="google_translate_element"
        className="absolute h-0 w-0 overflow-hidden opacity-0 pointer-events-none"
      />

      {/* Custom Silver Chrome & Dark Theme Dropdown */}
      <div className="relative flex items-center">
        <select
          value={currentLang}
          onChange={(e) => changeLanguage(e.target.value as Lang)}
          aria-label="Select Language"
          className="notranslate appearance-none cursor-pointer touch-manipulation rounded-full border border-white/20 bg-[#050505] px-3.5 py-1.5 pr-7 text-[10px] font-extralight uppercase tracking-[0.3em] text-neutral-200 outline-none transition-all duration-300 hover:border-white/45 hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]"
        >
          {SUPPORTED_LANGS.map((lang) => (
            <option key={lang} value={lang} className="bg-[#050505] text-neutral-200">
              {labels[lang]}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-2.5 text-[8px] text-neutral-400">
          ▼
        </span>
      </div>
    </div>
  );
}