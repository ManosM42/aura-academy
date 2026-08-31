// src/components/aura/LanguageToggle.tsx
import { LANGS, useI18n, type Lang } from "@/lib/i18n";

const LABELS: Record<Lang, { short: string; full: string }> = {
  el: { short: "EL", full: "Ελληνικά" },
  en: { short: "EN", full: "English" },
};

interface LanguageToggleProps {
  className?: string;
}

export default function LanguageToggle({ className = "" }: LanguageToggleProps) {
  const { lang, setLang, t } = useI18n();

  return (
    <div
      role="group"
      aria-label={t("nav.language")}
      className={`inline-flex items-center gap-1 rounded-full border border-white/10 bg-[#0A0A0A] p-1 ${className}`}
    >
      {LANGS.map((code) => {
        const active = code === lang;
        return (
          <button
            key={code}
            type="button"
            lang={code}
            aria-pressed={active}
            title={LABELS[code].full}
            onClick={() => setLang(code)}
            className={[
              "rounded-full px-3.5 py-1.5 text-[10px] uppercase tracking-[0.2em] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
              active
                ? "bg-white/10 text-white"
                : "text-neutral-500 hover:bg-white/[0.04] hover:text-neutral-200",
            ].join(" ")}
          >
            <span aria-hidden>{LABELS[code].short}</span>
            <span className="sr-only">{LABELS[code].full}</span>
          </button>
        );
      })}
    </div>
  );
}