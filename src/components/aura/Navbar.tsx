// src/components/aura/Navbar.tsx
import { useEffect, useMemo, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { isAdminRole, isStaffRole } from "@/lib/roles";
import { GoogleTranslateWidget } from "@/components/aura/GoogleTranslate";
import logo from "@/assets/logo.jpg";

interface NavItem {
  to: string;
  label: string;
}

const PUBLIC_LINKS: NavItem[] = [
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
  { to: "/method", label: "Method" },
  { to: "/pricing", label: "Pricing" },
];

export function Navbar() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const pathname = router.state.location.pathname;
  const role = profile?.role ?? null;
  const staff = isStaffRole(role);
  const admin = isAdminRole(role);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

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

  const links: NavItem[] = useMemo(() => {
    if (!user) return PUBLIC_LINKS;
    return [
      { to: "/dashboard", label: "Dashboard" },
      { to: "/courses", label: "Courses" },
      { to: "/academy", label: "Academy" },
      { to: "/skills", label: "Skills" },
      ...(staff ? [{ to: "/review", label: "Review Queue" }] : []),
      ...(admin
        ? [
            { to: "/admin", label: "Admin Panel" },
            { to: "/admin/inbox", label: "Inbox" },
          ]
        : []),
    ];
  }, [user, staff, admin]);

  const initials = (profile?.full_name ?? "?")
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const isActive = (to: string) => pathname === to || pathname.startsWith(`${to}/`);

  return (
    <>
      <header
        className={[
          "fixed inset-x-0 top-0 z-50 transition-all duration-300",
          scrolled
            ? "border-b border-white/10 bg-black/80 backdrop-blur-md"
            : "border-b border-transparent bg-transparent",
        ].join(" ")}
      >
        <nav
          aria-label="Main Navigation"
          className="mx-auto flex h-20 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8"
        >
          {/* Added notranslate class so Google Translate never alters the brand title */}
          <Link to="/" className="flex items-center gap-3.5 group notranslate" aria-label="Home">
            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-white/10 blur-sm opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <img
                src={logo}
                alt="AURA"
                aria-hidden
                className="relative h-11 w-11 rounded-full border border-white/20 object-cover shadow-[0_0_15px_rgba(255,255,255,0.08)] transition-transform duration-300 group-hover:scale-105"
              />
            </div>
            
            <div className="flex flex-col justify-center">
              <span className="inline-block origin-left scale-x-125 text-base font-extralight tracking-[0.45em] text-neutral-100 leading-none">
                ΛURΛ
              </span>
              <span className="inline-block origin-left scale-x-110 text-[9px] font-extralight tracking-[0.35em] text-neutral-400 uppercase mt-1 leading-none">
                HAIR METHOD
              </span>
            </div>
          </Link>

          <ul className="hidden items-center gap-2 md:flex">
            {links.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  aria-current={isActive(item.to) ? "page" : undefined}
                  className={[
                    "inline-block rounded-full px-3.5 py-1.5 text-[10px] uppercase font-extralight tracking-[0.35em] scale-x-[1.12] origin-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
                    isActive(item.to) ? "text-white font-normal" : "text-neutral-400 hover:text-neutral-100",
                  ].join(" ")}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-3">
            {/* Clean Client-Side Translated Dropdown Widget */}
            <GoogleTranslateWidget />

            {!user && (
              <Link
                to="/pricing"
                className="hidden rounded-full border border-white/20 px-5 py-2 text-[10px] font-extralight uppercase tracking-[0.35em] text-neutral-100 transition-all duration-300 scale-x-105 hover:-translate-y-0.5 hover:border-white/45 hover:shadow-[0_0_24px_-8px_rgba(255,255,255,0.35)] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 sm:inline-flex"
              >
                Start
              </Link>
            )}

            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? "Close Menu" : "Open Menu"}
              aria-expanded={open}
              aria-controls="aura-nav-panel"
              className="chrome-surface group flex h-10 w-10 items-center justify-center rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            >
              <span aria-hidden className="flex flex-col items-center justify-center gap-[5px]">
                <span
                  className={[
                    "block h-[1.5px] w-4 bg-neutral-900 transition-transform duration-300",
                    open ? "translate-y-[6.5px] rotate-45" : "",
                  ].join(" ")}
                />
                <span
                  className={[
                    "block h-[1.5px] w-4 bg-neutral-900 transition-opacity duration-200",
                    open ? "opacity-0" : "opacity-100",
                  ].join(" ")}
                />
                <span
                  className={[
                    "block h-[1.5px] w-4 bg-neutral-900 transition-transform duration-300",
                    open ? "-translate-y-[6.5px] -rotate-45" : "",
                  ].join(" ")}
                />
              </span>
            </button>
          </div>
        </nav>
      </header>

      <AnimatePresence>
        {open && (
          <>
            <motion.button
              type="button"
              aria-label="Close Menu"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 cursor-default bg-black/60 backdrop-blur-sm"
            />

            <motion.aside
              id="aura-nav-panel"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col overflow-y-auto border-l border-white/10 bg-[#050505] px-6 py-6"
            >
              <div className="flex items-center justify-between">
                <span className="inline-block scale-x-110 origin-left text-[10px] font-extralight uppercase tracking-[0.4em] text-neutral-500">
                  Menu
                </span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close Menu"
                  className="chrome-surface flex h-9 w-9 items-center justify-center rounded-lg text-lg leading-none text-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                >
                  ✕
                </button>
              </div>

              {user && (
                <Link
                  to="/profile"
                  className="mt-6 flex items-center gap-4 rounded-2xl border border-white/10 bg-[#0A0A0A] p-4 transition-colors hover:border-white/25"
                >
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt=""
                      aria-hidden
                      className="h-11 w-11 rounded-full border border-white/15 object-cover"
                    />
                  ) : (
                    <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-[#171717] text-xs font-extralight text-neutral-300">
                      {initials || "?"}
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-extralight text-neutral-100">
                      {profile?.full_name ?? "My Profile"}
                    </span>
                    <span className="block text-[10px] font-extralight uppercase tracking-[0.2em] text-neutral-500">
                      View Profile
                    </span>
                  </span>
                </Link>
              )}

              <ul className="mt-6 flex-1 space-y-1">
                {links.map((item) => (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      aria-current={isActive(item.to) ? "page" : undefined}
                      className={[
                        "group flex items-center justify-between rounded-xl px-4 py-3.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
                        isActive(item.to)
                          ? "bg-white/[0.06] text-white font-normal"
                          : "text-neutral-400 hover:bg-white/[0.04] hover:text-neutral-100",
                      ].join(" ")}
                    >
                      <span className="inline-block scale-x-110 origin-left text-xs font-extralight uppercase tracking-[0.3em]">
                        {item.label}
                      </span>
                      <span
                        aria-hidden
                        className="text-neutral-600 transition-transform duration-300 group-hover:translate-x-1"
                      >
                        →
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>

              <div className="mt-6 border-t border-white/10 pt-5">
                {user ? (
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="w-full rounded-full border border-white/15 px-5 py-3 text-[10px] font-extralight uppercase tracking-[0.3em] text-neutral-300 transition-colors hover:border-white/40 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                  >
                    Sign Out
                  </button>
                ) : (
                  <div className="space-y-3">
                    <Link
                      to="/pricing"
                      className="block rounded-full border border-white/25 px-5 py-3 text-center text-[10px] font-extralight uppercase tracking-[0.3em] text-neutral-100 transition-colors hover:border-white/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                    >
                      Start Now
                    </Link>
                    <Link
                      to="/login"
                      className="block px-5 py-2 text-center text-[10px] font-extralight uppercase tracking-[0.3em] text-neutral-500 transition-colors hover:text-neutral-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                    >
                      Sign In
                    </Link>
                  </div>
                )}
                <p className="mt-5 text-center text-[9px] font-extralight uppercase tracking-[0.35em] text-neutral-600">
                  The operating system for the modern barber.
                </p>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}