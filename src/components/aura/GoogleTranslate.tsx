// src/components/aura/GoogleTranslate.tsx
import { useEffect, useState } from "react";

declare global {
  interface Window {
    google: any;
    googleTranslateElementInit: () => void;
  }
}

export function GoogleTranslateWidget() {
  const [currentLang, setCurrentLang] = useState("en");

  useEffect(() => {
    // Read current language from googtrans cookie
    const match = document.cookie.match(/(^|;) ?googtrans=([^;]*)(;|$)/);
    if (match) {
      const parts = match[2].split("/");
      if (parts.length > 2 && parts[2]) {
        setCurrentLang(parts[2]);
      } else {
        setCurrentLang("en");
      }
    } else {
      setCurrentLang("en");
    }

    // Initialize Google Translate globally if not already set
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

    // Load Google Translate script safely
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

    // Thoroughly clear cookies across all domains and paths for Mobile/Desktop sync
    const hostname = window.location.hostname;
    const domains = [hostname, `.${hostname}`, hostname.replace(/^www\./, "")];

    domains.forEach((domain) => {
      document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${domain};`;
      document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    });

    if (lang !== "en") {
      document.cookie = `googtrans=/en/${lang}; path=/; domain=${hostname}`;
      document.cookie = `googtrans=/en/${lang}; path=/;`;
    }

    // Force reload to apply translation states correctly on mobile/desktop
    window.location.reload();
  };

  return (
    <div className="relative inline-block">
      {/* Hidden Google Translate Element container optimized for mobile/desktop rendering */}
      <div 
        id="google_translate_element" 
        className="absolute opacity-0 pointer-events-none w-0 h-0 overflow-hidden"
      />

      {/* Custom Silver Chrome & Dark Theme Dropdown */}
      <div className="relative flex items-center">
        <select
          value={currentLang}
          onChange={(e) => changeLanguage(e.target.value)}
          aria-label="Select Language"
          className="appearance-none bg-[#050505] text-neutral-200 border border-white/20 px-3.5 py-1.5 rounded-full text-[10px] font-extralight uppercase tracking-[0.3em] cursor-pointer outline-none transition-all duration-300 hover:border-white/45 hover:shadow-[0_0_20px_rgba(255,255,255,0.1)] pr-7 touch-manipulation"
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