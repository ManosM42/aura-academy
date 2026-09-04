import { Link } from "@tanstack/react-router";
import { Instagram } from "lucide-react";

export default function Footer() {
  return (
    <footer className="relative w-full overflow-x-hidden border-t border-white/[0.06] bg-aura-bg2 px-6 py-16">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-8 text-center md:flex-row md:items-start md:justify-between md:text-left">
        <div>
          <span className="chrome-text font-aura text-lg font-extrabold uppercase tracking-[0.4em]">
            Λ U R Λ
          </span>
          <p className="font-aura mt-3 max-w-xs text-sm text-aura-text-secondary">
            The operating system for the modern barber. Learn. Practice. Prove.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-10 items-center md:items-start">
          <nav className="font-aura flex gap-10 text-sm text-aura-text-secondary">
            <div className="flex flex-col gap-2 items-center md:items-start">
              <Link to="/about" className="transition-colors hover:text-aura-white">About</Link>
              <Link to="/contact" className="transition-colors hover:text-aura-white">Contact</Link>
              <Link to="/pricing" className="transition-colors hover:text-aura-white">Pricing</Link>
              <Link to="/method" className="transition-colors hover:text-aura-white">Method</Link>
              <Link to="/terms" className="transition-colors hover:text-aura-white">Terms</Link>
            </div>
          </nav>

          <div className="flex flex-col gap-2 items-center md:items-start">
            <a 
              href="https://www.instagram.com/aura_.method/?__pwa=1" 
              target="_blank" 
              rel="noopener noreferrer"
              className="font-aura flex items-center gap-2 text-sm text-aura-text-secondary transition-colors hover:text-aura-white"
              aria-label="Instagram"
            >
              <Instagram className="size-4" />
              <span>Instagram</span>
            </a>
          </div>
        </div>
      </div>

      <div className="chrome-line mx-auto mt-12 h-px max-w-6xl" />
      <p className="font-aura mt-8 text-center text-xs text-aura-text-muted">
        © {new Date().getFullYear()} ΛURΛ. HAIR METHOD.
      </p>
    </footer>
  );
}