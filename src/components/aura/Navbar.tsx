import { useEffect, useState } from "react";
import ChromeButton from "./ChromeButton";

const LINKS = [
  { label: "Method", href: "#method" },
  { label: "Skill Tree", href: "#skilltree" },
  { label: "Certification", href: "#certification" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        scrolled
          ? "border-b border-white/10 bg-aura-bg/70 backdrop-blur-xl"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <a
          href="#top"
          className="chrome-text font-aura text-lg font-extrabold uppercase tracking-[0.4em]"
        >
          Aura
        </a>

        <ul className="hidden items-center gap-9 md:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="font-aura text-sm text-aura-text-secondary transition-colors hover:text-aura-white"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <ChromeButton
          className="px-5 py-2 text-xs"
          onClick={() =>
            document
              .querySelector("#certification")
              ?.scrollIntoView({ behavior: "smooth" })
          }
        >
          START LEARNING
        </ChromeButton>
      </nav>
    </header>
  );
}