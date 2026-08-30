export default function Footer() {
  return (
    <footer className="relative border-t border-white/[0.06] bg-aura-bg2 px-6 py-16">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-8 text-center md:flex-row md:items-start md:justify-between md:text-left">
        <div>
          <span className="chrome-text font-aura text-lg font-extrabold uppercase tracking-[0.4em]">
            Aura
          </span>
          <p className="font-aura mt-3 max-w-xs text-sm text-aura-text-secondary">
            The operating system for the modern barber. Learn. Practice. Prove.
          </p>
        </div>

        <nav className="font-aura flex gap-10 text-sm text-aura-text-secondary">
          <div className="flex flex-col gap-2">
            <a href="#method" className="transition-colors hover:text-aura-white">Method</a>
            <a href="#skilltree" className="transition-colors hover:text-aura-white">Skill Tree</a>
            <a href="#certification" className="transition-colors hover:text-aura-white">Certification</a>
          </div>
        </nav>
      </div>

      <div className="chrome-line mx-auto mt-12 h-px max-w-6xl" />
      <p className="font-aura mt-8 text-center text-xs text-aura-text-muted">
        © {new Date().getFullYear()} AURA. Master the craft.
      </p>
    </footer>
  );
}