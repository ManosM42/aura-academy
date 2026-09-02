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

    // Initialize Google Translate
    if (!document.getElementById("google-translate-script")) {
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

      const script = document.createElement("script");
      script.id = "google-translate-script";
      script.type = "text/javascript";
      script.src = "//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  const changeLanguage = (lang: string) => {
    // Clean up existing cookies safely
    document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=" + window.location.hostname;

    if (lang !== "en") {
      document.cookie = `googtrans=/en/${lang}; path=/`;
    }

    window.location.reload();
  };

  return (
    <div className="relative inline-block">
      {/* 
        IMPORTANT: Do NOT use display: none or Tailwind hidden here. 
        Google Translate requires the element to be rendered in the DOM to initialize properly.
        We use an off-screen/sr-only style pattern instead.
      */}
      <div 
        id="google_translate_element" 
        style={{
          position: "absolute",
          width: "1px",
          height: "1px",
          padding: "0",
          margin: "-1px",
          overflow: "hidden",
          clip: "rect(0, 0, 0, 0)",
          whiteSpace: "nowrap",
          border: "0"
        }} 
      />

      {/* Custom Silver Chrome & Dark Theme Dropdown */}
      <div className="relative flex items-center">
        <select
          value={currentLang}
          onChange={(e) => changeLanguage(e.target.value)}
          aria-label="Select Language"
          className="appearance-none bg-[#050505] text-neutral-200 border border-white/20 px-3.5 py-1.5 rounded-full text-[10px] font-extralight uppercase tracking-[0.3em] cursor-pointer outline-none transition-all duration-300 hover:border-white/45 hover:shadow-[0_0_20px_rgba(255,255,255,0.1)] pr-7"
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