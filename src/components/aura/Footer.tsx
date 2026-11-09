import { Link } from "@tanstack/react-router";
import { ArrowUp, ArrowUpRight, Instagram, Lock } from "lucide-react";

/* ---------- Payment methods supported through Stripe ----------
   Logos are inline SVGs drawn for a dark background (no white tiles).
   To use the official brand files, drop them in /public/payments/ and set `src`
   on the entry: it overrides the inline SVG. */

type Method = { name: string; src?: string; logo: React.ReactNode };

const svgProps = {
  viewBox: "0 0 96 40",
  className: "h-9 w-auto sm:h-11",
  role: "img" as const,
};

const FONT = "Arial, Helvetica, sans-serif";

const METHODS: Method[] = [
  {
    name: "Visa",
    logo: (
      <svg {...svgProps} aria-label="Visa">
        <text x="48" y="27" textAnchor="middle" fontFamily={FONT} fontWeight={900} fontStyle="italic" fontSize="28" letterSpacing="-1" fill="#FFFFFF">
          VISA
        </text>
        <path d="M22 34 Q48 30 74 34" stroke="#F7B600" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    name: "Mastercard",
    logo: (
      <svg {...svgProps} aria-label="Mastercard">
        <circle cx="36" cy="20" r="16" fill="#EB001B" />
        <circle cx="60" cy="20" r="16" fill="#F79E1B" />
        <path d="M48 9.42A16 16 0 0 1 48 30.58A16 16 0 0 1 48 9.42Z" fill="#FF5F00" />
      </svg>
    ),
  },
  {
    name: "American Express",
    logo: (
      <svg {...svgProps} aria-label="American Express">
        <rect x="6" y="6" width="84" height="28" rx="4" fill="#2E77BC" />
        <text x="48" y="26" textAnchor="middle" fontFamily={FONT} fontWeight={800} fontSize="18" letterSpacing="1" fill="#FFFFFF">
          AMEX
        </text>
      </svg>
    ),
  },
  {
    name: "Apple Pay",
    logo: (
      <svg {...svgProps} aria-label="Apple Pay">
        <g transform="translate(12 8)">
          <path
            fill="#FFFFFF"
            d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
            transform="scale(0.9) translate(0 -1)"
          />
        </g>
        <text x="40" y="28" fontFamily={FONT} fontWeight={600} fontSize="22" fill="#FFFFFF">
          Pay
        </text>
      </svg>
    ),
  },
  {
    name: "Google Pay",
    logo: (
      <svg {...svgProps} aria-label="Google Pay">
        <text x="48" y="26" textAnchor="middle" fontFamily={FONT} fontWeight={600} fontSize="18">
          <tspan fill="#4285F4">G</tspan>
          <tspan fill="#EA4335">o</tspan>
          <tspan fill="#FBBC05">o</tspan>
          <tspan fill="#4285F4">g</tspan>
          <tspan fill="#34A853">l</tspan>
          <tspan fill="#EA4335">e</tspan>
          <tspan fill="#E8EAED"> Pay</tspan>
        </text>
      </svg>
    ),
  },
  {
    name: "PayPal",
    logo: (
      <svg {...svgProps} aria-label="PayPal">
        <text x="48" y="27" textAnchor="middle" fontFamily={FONT} fontWeight={800} fontStyle="italic" fontSize="24">
          <tspan fill="#5B9DFF">Pay</tspan>
          <tspan fill="#00B5F0">Pal</tspan>
        </text>
      </svg>
    ),
  },
  {
    name: "Klarna",
    logo: (
      <svg {...svgProps} aria-label="Klarna">
        <rect x="4" y="6" width="88" height="28" rx="14" fill="#FFB3C7" />
        <text x="48" y="26.5" textAnchor="middle" fontFamily={FONT} fontWeight={800} fontSize="18" fill="#0A0B09">
          Klarna.
        </text>
      </svg>
    ),
  },
  {
    name: "Link",
    logo: (
      <svg {...svgProps} aria-label="Link by Stripe">
        <rect x="14" y="6" width="68" height="28" rx="8" fill="#00D66F" />
        <text x="48" y="27" textAnchor="middle" fontFamily={FONT} fontWeight={800} fontSize="20" fill="#011E0F">
          link
        </text>
      </svg>
    ),
  },
];

const LINKS = {
  Explore: [
    { to: "/method", label: "Method" },
    { to: "/pricing", label: "Pricing" },
    { to: "/about", label: "About" },
  ],
  Support: [
    { to: "/contact", label: "Contact" },
    { to: "/terms", label: "Terms" },
  ],
} as const;

const linkCls =
  "inline-flex items-center gap-1 text-sm text-aura-text-secondary transition-all duration-300 hover:text-aura-white hover:[text-shadow:0_0_18px_rgba(220,226,235,0.55)] focus-visible:outline-none focus-visible:text-aura-white";

export default function Footer() {
  return (
    <footer className="relative w-full overflow-hidden bg-aura-bg2 px-6 pb-10 pt-24">
      {/* Top glowing chrome edge */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 h-40 w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(210,218,230,0.22),transparent_70%)] blur-2xl"
      />
      {/* Ambient corner glows */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 -left-32 h-96 w-96 rounded-full bg-[radial-gradient(circle,rgba(190,198,212,0.10),transparent_65%)] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 -right-32 h-96 w-96 rounded-full bg-[radial-gradient(circle,rgba(190,198,212,0.08),transparent_65%)] blur-3xl"
      />
      {/* Giant watermark wordmark */}
      <div
        aria-hidden="true"
        className="chrome-text font-aura pointer-events-none absolute inset-x-0 bottom-0 select-none text-center text-[22vw] font-extrabold uppercase leading-none tracking-[0.2em] opacity-[0.04] md:text-[16vw]"
      >
        ΛURΛ
      </div>

      <div className="relative mx-auto max-w-6xl">
        {/* Main grid */}
        <div className="grid gap-14 md:grid-cols-[1.4fr_1fr_1fr_auto] md:gap-12">
          {/* Brand */}
          <div className="flex flex-col items-center text-center md:items-start md:text-left">
            <span className="chrome-text font-aura text-2xl font-extrabold uppercase tracking-[0.45em] drop-shadow-[0_0_22px_rgba(220,226,235,0.35)]">
              Λ U R Λ
            </span>
            <p className="font-aura mt-5 max-w-xs text-sm leading-relaxed text-aura-text-secondary">
              The operating system for the modern barber. Learn. Practice. Prove.
            </p>

            <Link
              to="/pricing"
              className="font-aura group relative mt-7 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-5 py-2.5 text-sm font-semibold text-aura-white transition-all duration-300 hover:border-white/40 hover:bg-white/[0.07] hover:shadow-[0_0_28px_rgba(220,226,235,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            >
              Start learning
              <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </div>

          {/* Link columns */}
          {Object.entries(LINKS).map(([title, items]) => (
            <nav
              key={title}
              aria-label={title}
              className="font-aura flex flex-col items-center gap-4 md:items-start"
            >
              <h3 className="chrome-text text-sm font-bold tracking-[0.2em]">{title}</h3>
              <ul className="flex flex-col items-center gap-3 md:items-start">
                {items.map((item) => (
                  <li key={item.to}>
                    <Link to={item.to} className={linkCls}>
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          {/* Social */}
          <div className="font-aura flex flex-col items-center gap-4 md:items-start">
            <h3 className="chrome-text text-sm font-bold tracking-[0.2em]">Follow</h3>
            <a
              href="https://www.instagram.com/aura_.method/?__pwa=1"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="group flex size-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-aura-text-secondary transition-all duration-300 hover:border-white/40 hover:text-aura-white hover:shadow-[0_0_26px_rgba(220,226,235,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            >
              <Instagram className="size-5 transition-transform duration-300 group-hover:scale-110" />
            </a>
          </div>
        </div>

        {/* Payments */}
        <div className="mt-24 flex flex-col items-center text-center">
          <div className="font-aura flex items-center gap-2.5 text-sm text-aura-text-secondary">
            <Lock className="size-4 text-aura-white/80" />
            <span>Secure checkout, powered by</span>
            <span className="chrome-text text-lg font-extrabold tracking-tight drop-shadow-[0_0_14px_rgba(220,226,235,0.4)]">
              stripe
            </span>
          </div>

          <ul className="mt-10 flex flex-wrap items-center justify-center gap-x-10 gap-y-8 sm:gap-x-14">
            {METHODS.map((m) => (
              <li
                key={m.name}
                title={m.name}
                className="flex items-center drop-shadow-[0_0_12px_rgba(255,255,255,0.07)] transition-all duration-300 hover:-translate-y-1 hover:drop-shadow-[0_0_20px_rgba(255,255,255,0.45)]"
              >
                {m.src ? (
                  <img src={m.src} alt={m.name} className="h-9 w-auto sm:h-11" loading="lazy" />
                ) : (
                  m.logo
                )}
              </li>
            ))}
          </ul>

          <p className="font-aura mt-8 text-xs text-aura-text-muted">
            Available payment methods vary by country and device.
          </p>
        </div>

        {/* Bottom bar */}
        <div className="chrome-line mt-14 h-px w-full" />
        <div className="font-aura mt-8 flex flex-col items-center justify-between gap-5 text-xs text-aura-text-muted md:flex-row">
          <p>© {new Date().getFullYear()} ΛURΛ. HAIR METHOD.</p>

          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            aria-label="Back to top"
            className="group flex size-9 items-center justify-center rounded-full border border-white/10 text-aura-text-secondary transition-all duration-300 hover:border-white/40 hover:text-aura-white hover:shadow-[0_0_22px_rgba(220,226,235,0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          >
            <ArrowUp className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5" />
          </button>
        </div>
      </div>
    </footer>
  );
}