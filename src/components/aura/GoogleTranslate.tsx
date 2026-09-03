// src/components/aura/GoogleTranslate.tsx
import { useEffect, useState } from "react";

declare global {
  interface Window {
    google: any;
    googleTranslateElementInit: () => void;
  }
}

/**
 * Ψάχνει το πραγματικό <select class="goog-te-combo"> που φτιάχνει η
 * Google μέσα στο #google_translate_element. Αυτό είναι το ΜΟΝΟ element
 * που ελέγχει όντως τη μετάφραση — το δικό μας dropdown είναι απλά
 * cosmetic, οπότε η αλλαγή γλώσσας πρέπει να γίνεται μέσω αυτού.
 */
function findGoogleCombo(): HTMLSelectElement | null {
  return document.querySelector<HTMLSelectElement>(".goog-te-combo");
}

/**
 * Ενεργοποιεί αλλαγή γλώσσας απευθείας στο google combo, χωρίς reload.
 * lang === "en" -> επαναφορά στο πρωτότυπο (value "" είναι η σύμβαση
 * που χρησιμοποιεί η Google για "restore original").
 */
function triggerGoogleTranslate(lang: string): boolean {
  const combo = findGoogleCombo();
  if (!combo) return false;
  combo.value = lang === "en" ? "" : lang;
  combo.dispatchEvent(new Event("change"));
  return true;
}

export function GoogleTranslateWidget() {
  const [currentLang, setCurrentLang] = useState("en");

  useEffect(() => {
    // Read current language from googtrans cookie (μόνο για το αρχικό UI state)
    const match = document.cookie.match(/(^|;) ?googtrans=([^;]*)(;|$)/);
    if (match) {
      const parts = match[2].split("/");
      setCurrentLang(parts.length > 2 && parts[2] ? parts[2] : "en");
    } else {
      setCurrentLang("en");
    }

    if (!window.googleTranslateElementInit) {
      window.googleTranslateElementInit = () => {
        if (window.google && window.google.translate) {
          new window.google.translate.TranslateElement(
            {
              pageLanguage: "en",
              includedLanguages: "en,el,de",
              layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE,
              autoDisplay: false,
            },
            "google_translate_element"
          );
        }
      };
    }

    if (!document.getElementById("google-translate-script")) {
      const script = document.createElement("script");
      script.id = "google-translate-script";
      script.type = "text/javascript";
      script.src = "//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
      script.async = true;
      document.body.appendChild(script);
    } else if (window.google && window.google.translate) {
      try {
        if (!document.getElementById("google_translate_element")?.hasChildNodes()) {
          window.googleTranslateElementInit();
        }
      } catch (e) {
        console.error("Google Translate Init Error:", e);
      }
    }
  }, []);

  const changeLanguage = (lang: string) => {
    setCurrentLang(lang);

    // 1) Προσπάθησε ΑΜΕΣΑ μέσω του πραγματικού google select (χωρίς
    // reload). Αυτό λύνει το πρόβλημα "κολλάει σε μία γλώσσα" γιατί
    // δεν εξαρτάται καθόλου από cookie-parsing σε reload.
    if (triggerGoogleTranslate(lang)) return;

    // 2) Αν το combo δεν είναι ΑΚΟΜΑ έτοιμο (π.χ. το iframe της Google
    // δεν έχει προλάβει να φορτώσει), δοκίμασε ξανά για ~2 δευτερόλεπτα.
    let attempts = 0;
    const retry = window.setInterval(() => {
      attempts += 1;
      if (triggerGoogleTranslate(lang) || attempts >= 10) {
        window.clearInterval(retry);
      }
    }, 200);
  };

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
          onChange={(e) => changeLanguage(e.target.value)}
          aria-label="Select Language"
          className="notranslate appearance-none cursor-pointer touch-manipulation rounded-full border border-white/20 bg-[#050505] px-3.5 py-1.5 pr-7 text-[10px] font-extralight uppercase tracking-[0.3em] text-neutral-200 outline-none transition-all duration-300 hover:border-white/45 hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]"
        >
          <option value="en" className="bg-[#050505] text-neutral-200">EN</option>
          <option value="el" className="bg-[#050505] text-neutral-200">ΕΛ</option>
          <option value="de" className="bg-[#050505] text-neutral-200">DE</option>
        </select>
        <span className="pointer-events-none absolute right-2.5 text-[8px] text-neutral-400">
          ▼
        </span>
      </div>
    </div>
  );
}