import { forwardRef } from "react";

type Variant = "primary" | "secondary";

interface ChromeButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

/**
 * Primary: dark surface + chrome border + reflective hover sweep.
 * Secondary: transparent + minimal silver border.
 * No filled brand colors — monochrome only.
 */
const ChromeButton = forwardRef<HTMLButtonElement, ChromeButtonProps>(
  ({ variant = "primary", className = "", children, ...props }, ref) => {
    const base =
      "font-aura relative inline-flex items-center justify-center rounded-full px-7 py-3 text-sm font-medium tracking-wide transition-all duration-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40 disabled:opacity-50";

    const styles =
      variant === "primary"
        ? "btn-sweep bg-aura-surface text-aura-white border border-white/15 hover:-translate-y-0.5 hover:border-white/40 hover:shadow-[0_0_28px_-6px_rgba(255,255,255,0.22)]"
        : "bg-transparent text-aura-text-secondary border border-white/10 hover:-translate-y-0.5 hover:text-aura-white hover:border-white/25";

    return (
      <button ref={ref} className={`${base} ${styles} ${className}`} {...props}>
        {children}
      </button>
    );
  }
);

ChromeButton.displayName = "ChromeButton";
export default ChromeButton;