import { useEffect, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import { isStaffRole } from "@/lib/queries";
import logo from "@/assets/logo.jpg";

interface NavItem {
  to: string;
  label: string;
}

export function Navbar() {
  const router = useRouter();
  const { session, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const pathname = router.state.location.pathname;
  const staff = profile ? isStaffRole(profile.role) : false;

  // Συμπαγές background μόλις ξεκινήσει το scroll.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Κλείσιμο του panel σε κάθε αλλαγή route.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Κλείδωμα του body scroll όσο είναι ανοιχτό, + κλείσιμο με Escape.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = open ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    setOpen(false);
    router.navigate({ to: "/" });
  }

  const links: NavItem[] = session
    ? [
        { to: "/dashboard", label: "Dashboard" },
        { to: "/academy", label: "Academy" },
        { to: "/skills", label: "Skills" },
        ...(staff
          ? [
              { to: "/review", label: "Review Queue" },
              { to: "/admin", label: "Admin Panel" },
            ]
          : []),
      ]
    : [];

  const initials = (profile?.full_name ?? "?")
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 border-b transition-colors duration-300 ${
          scrolled || open
            ? "border-white/10 bg-black/80 backdrop-blur-xl"
            : "border-transparent bg-black/30 backdrop-blur-md"
        }`}
      >
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link
            to={session ? "/" : "/"}
            className="flex items-center gap-2 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <img
              src={logo}
              alt="AURA"
              className="h-8 w-8 rounded-full object-cover ring-1 ring-white/20"
            />
            <span className="text-sm font-semibold tracking-[0.3em] text-white">
              AURA
            </span>
          </Link>

          {/* Hamburger — ίδιο σε desktop & mobile */}
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Κλείσιμο μενού" : "Άνοιγμα μενού"}
            aria-expanded={open}
            aria-controls="aura-nav-panel"
            className="chrome-surface group flex h-10 w-10 items-center justify-center rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          >
            <span className="relative block h-4 w-5">
              <span
                className={`absolute left-0 block h-0.5 w-5 rounded-full bg-neutral-900 transition-all duration-300 ${
                  open ? "top-1/2 -translate-y-1/2 rotate-45" : "top-0"
                }`}
              />
              <span
                className={`absolute left-0 top-1/2 block h-0.5 w-5 -translate-y-1/2 rounded-full bg-neutral-900 transition-opacity duration-200 ${
                  open ? "opacity-0" : "opacity-100"
                }`}
              />
              <span
                className={`absolute left-0 block h-0.5 w-5 rounded-full bg-neutral-900 transition-all duration-300 ${
                  open ? "top-1/2 -translate-y-1/2 -rotate-45" : "bottom-0"
                }`}
              />
            </span>
          </button>
        </nav>
      </header>

      {/* Overlay + panel */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              aria-hidden
            />

            <motion.aside
              id="aura-nav-panel"
              key="panel"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 260, damping: 30 }}
              className="fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col border-l border-white/10 bg-neutral-950/95 backdrop-blur-2xl"
            >
              <div className="flex h-16 items-center justify-between border-b border-white/10 px-6">
                <span className="text-sm font-semibold tracking-[0.3em] text-white">
                  ΜΕΝΟΥ
                </span>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Κλείσιμο μενού"
                  className="chrome-surface flex h-9 w-9 items-center justify-center rounded-lg text-lg leading-none text-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                >
                  ✕
                </button>
              </div>

              <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-6 py-6">
                {session ? (
                  <>
                    <Link to="/profile" className="chrome-chip mb-2">
                      {profile?.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt=""
                          className="h-9 w-9 rounded-full object-cover ring-1 ring-black/20"
                        />
                      ) : (
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/10 text-xs font-semibold text-neutral-900">
                          {initials || "?"}
                        </span>
                      )}
                      <span className="flex flex-col text-left">
                        <span className="truncate text-sm font-semibold text-neutral-900">
                          {profile?.full_name ?? "Το προφίλ μου"}
                        </span>
                        <span className="text-[11px] uppercase tracking-wider text-neutral-700">
                          Προβολή προφίλ
                        </span>
                      </span>
                    </Link>

                    {links.map((item, i) => (
                      <ChromeLink
                        key={item.to}
                        to={item.to}
                        label={item.label}
                        index={i}
                      />
                    ))}

                    <button
                      onClick={handleSignOut}
                      className="mt-4 rounded-xl border border-white/15 px-4 py-3 text-left text-sm font-medium text-white/80 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                    >
                      Αποσύνδεση
                    </button>
                  </>
                ) : (
                  <>
                    <ChromeLink to="/" label="Αρχική" index={0} />
                    <ChromeLink to="/login" label="Σύνδεση" index={1} />
                  </>
                )}
              </div>

              <div className="border-t border-white/10 px-6 py-4">
                <span className="text-[11px] uppercase tracking-[0.3em] text-white/30">
                  AURA — Master the Craft
                </span>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function ChromeLink({
  to,
  label,
  index,
}: {
  to: string;
  label: string;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.08 + index * 0.05, duration: 0.3 }}
    >
      <Link
        to={to}
        className="chrome-button group relative flex items-center justify-between overflow-hidden rounded-xl px-4 py-3 text-sm font-semibold text-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
      >
        <span className="relative z-10">{label}</span>
        <span className="relative z-10 text-neutral-700 transition-transform duration-300 group-hover:translate-x-1">
          →
        </span>
        <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/70 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
      </Link>
    </motion.div>
  );
}