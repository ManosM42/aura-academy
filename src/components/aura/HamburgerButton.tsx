// src/components/aura/HamburgerButton.tsx
interface HamburgerButtonProps {
  open: boolean;
  onClick: () => void;
  className?: string;
}

/**
 * Chrome hamburger toggle. The three lines animate into an X when `open`.
 * Purely presentational — parent owns the open state.
 */
export default function HamburgerButton({
  open,
  onClick,
  className = "",
}: HamburgerButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={open ? "Close menu" : "Open menu"}
      aria-expanded={open}
      className={`hamburger ${open ? "is-open" : ""} ${className}`}
    >
      <span className="hamburger-line" />
      <span className="hamburger-line" />
      <span className="hamburger-line" />
    </button>
  );
}