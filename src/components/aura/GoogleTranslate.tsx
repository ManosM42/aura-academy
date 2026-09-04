// src/components/aura/GoogleTranslate.tsx
import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    google: any;
    googleTranslateElementInit: () => void;
  }
}

const SUPPORTED_LANGS = ["en", "el", "de"] as const;
type Lang = (typeof SUPPORTED_LANGS)[number];

const COOKIE_NAME = "googtrans";

/** Reads the current language from the googtrans cookie (format "/en/el"). */
function readLangFromCookie(): Lang {
  const match = document.cookie.match(/(?:^|;\s*)googtrans=([^;]*)/);
  if (!match) return "en";
  const target = decodeURIComponent(match[1]).split("/")[2];
  return (SUPPORTED_LANGS as readonly string[]).includes(target) ? (target as Lang) : "en";
}

function clearGoogTransCookie() {
  const host = window.location.hostname;
  const expired = "expires=Thu, 01 Jan 1970 00:00:00 UTC";
  [
    `${COOKIE_NAME}=; ${expired}; path=/;`,
    `${COOKIE_NAME}=; ${expired}; path=/; domain=${host};`,
    `${COOKIE_NAME}=; ${expired}; path=/; domain=.${host};`,
  ].forEach((v) => (document.cookie = v));
}

function writeGoogTransCookie(lang: Lang) {
  clearGoogTransCookie();
  if (lang === "en") return;
  const host = window.location.hostname;
  const value = `/en/${lang}`;
  const oneYear = 60 * 60 * 24 * 365;
  document.cookie = `${COOKIE_NAME}=${value}; path=/; max-age=${oneYear};`;
}

function getCombo(): HTMLSelectElement | null {
  return document.querySelector<HTMLSelectElement>(".goog-te-combo");
}

/**
 * Polls for Google's real <select class="goog-te-combo">. The translate.google.com
 * script injects it asynchronously after googleTranslateElementInit runs, and there's
 * no load event for it, so we poll briefly instead of guessing a fixed delay.
 */
function waitForCombo(timeoutMs = 8000): Promise<HTMLSelectElement | null> {
  return new Promise((resolve) => {
    const existing = getCombo();
    if (existing) return resolve(existing);
    const start = Date.now();
    const interval = setInterval(() => {
      const combo = getCombo();
      if (combo) {
        clearInterval(interval);
        resolve(combo);
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(interval);
        resolve(null);
      }
    }, 150);
  });
}

/**
 * Drives Google's own hidden combo exactly like a real click would, instead of
 * round-tripping through the googtrans cookie + a full page reload. This is what
 * makes switching languages back and forth (EL -> DE -> EN -> EL, etc.) reliable:
 * Google's listener owns the translation state and re-translates in place, so there's
 * no stale-cookie / domain-scope / re-init race to fight.
 */
async function switchGoogleLanguage(lang: Lang): Promise<boolean> {
  const combo = await waitForCombo();
  if (!combo) return false;
  if (combo.value === lang) return true;
  combo.value = lang; // selecting "en" (the source language) reverts to the original text
  combo.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

export function GoogleTranslateWidget() {
  const [currentLang, setCurrentLang] = useState<Lang>("en");
  const [ready, setReady] = useState(false);
  const pendingLangRef = useRef<Lang | null>(null);

  useEffect(() => {
    setCurrentLang(readLangFromCookie());

    const markReadyAndFlush = () => {
      waitForCombo().then((combo) => {
        if (!combo) return;
        setReady(true);
        if (pendingLangRef.current) {
          switchGoogleLanguage(pendingLangRef.current);
          pendingLangRef.current = null;
        }
      });
    };

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
        markReadyAndFlush();
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
      markReadyAndFlush();
    }
  }, []);

  async function changeLanguage(lang: Lang) {
    if (lang === currentLang) return;
    setCurrentLang(lang); // optimistic UI update

    if (!ready) {
      // Combo isn't mounted yet — remember the request; markReadyAndFlush() applies
      // it the instant the widget finishes initializing.
      pendingLangRef.current = lang;
      return;
    }

    const ok = await switchGoogleLanguage(lang);
    if (!ok) {
      // Last-resort fallback (e.g. widget blocked by an extension): old cookie+reload path.
      writeGoogTransCookie(lang);
      window.location.reload();
    }
  }

  const labels: Record<Lang, string> = { en: "EN", el: "ΕΛ", de: "DE" };

  return (
    <div className="relative inline-block">
      <div
        id="google_translate_element"
        className="absolute h-0 w-0 overflow-hidden opacity-0 pointer-events-none"
      />
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