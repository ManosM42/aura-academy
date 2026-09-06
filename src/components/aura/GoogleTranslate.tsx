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

function readLangFromCookie(): Lang {
  const match = document.cookie.match(/(?:^|;\s*)googtrans=([^;]*)/);
  if (!match) return "en";
  const target = decodeURIComponent(match[1]).split("/")[2];
  return (SUPPORTED_LANGS as readonly string[]).includes(target) ? (target as Lang) : "en";
}

function writeGoogTransCookie(lang: Lang) {
  const host = window.location.hostname;
  const expired = "expires=Thu, 01 Jan 1970 00:00:00 UTC";
  
  // Clear any existing cookies to avoid duplicates (host vs .host)
  [
    `${COOKIE_NAME}=; ${expired}; path=/;`,
    `${COOKIE_NAME}=; ${expired}; path=/; domain=${host};`,
    `${COOKIE_NAME}=; ${expired}; path=/; domain=.${host};`,
  ].forEach((v) => (document.cookie = v));

  // If defaulting to English, just leave the cookies cleared
  if (lang === "en") return;

  // Set the new language cookie so Google reads it immediately on reload
  const value = `/en/${lang}`;
  const oneYear = 60 * 60 * 24 * 365;
  [
    `${COOKIE_NAME}=${value}; path=/; max-age=${oneYear};`,
    `${COOKIE_NAME}=${value}; path=/; domain=${host}; max-age=${oneYear};`,
    `${COOKIE_NAME}=${value}; path=/; domain=.${host}; max-age=${oneYear};`,
  ].forEach((v) => (document.cookie = v));
}

export function GoogleTranslateWidget() {
  const [currentLang, setCurrentLang] = useState<Lang>("en");

  useEffect(() => {
    // Set local state based on the current cookie on mount
    setCurrentLang(readLangFromCookie());

    // Define the initialization callback for the Google script
    window.googleTranslateElementInit = () => {
      if (window.google?.translate?.TranslateElement) {
        new window.google.translate.TranslateElement(
          {
            pageLanguage: "en",
            includedLanguages: SUPPORTED_LANGS.join(","),
            layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE,
            autoDisplay: false,
          },
          "google_translate_element"
        );
      }
    };

    // Inject the script natively
    if (!document.getElementById("google-translate-script")) {
      const script = document.createElement("script");
      script.id = "google-translate-script";
      script.type = "text/javascript";
      script.src = "//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
      script.async = true;
      document.body.appendChild(script);
    } else if (window.google?.translate) {
      // If the script is already present (e.g. client-side routing) re-init
      window.googleTranslateElementInit();
    }
  }, []);

  function changeLanguage(lang: Lang) {
    if (lang === currentLang) return;
    
    // Write cookie and immediately reload the page.
    // The Google script natively respects the googtrans cookie on boot.
    writeGoogTransCookie(lang);
    window.location.reload();
  }

  const labels: Record<Lang, string> = { en: "EN", el: "ΕΛ", de: "DE" };

  return (
    <div className="relative inline-block">
      {/* Target div for the hidden Google translate widget */}
      <div
        id="google_translate_element"
        className="absolute h-0 w-0 overflow-hidden opacity-0 pointer-events-none"
      />
      
      {/* Custom Select UI - exactly as you provided */}
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