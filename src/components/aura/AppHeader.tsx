// src/components/aura/AppHeader.tsx
import { useEffect, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion, type Variants } from "motion/react";
import ChromeButton from "./ChromeButton";
import AuraAvatar from "./AuraAvatar";
import HamburgerButton from "./HamburgerButton";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import logo from "@/assets/logo.jpg";

const NAV = [
  { label: "Dashboard", to: "/dashboard" as const },
  { label: "Profile", to: "/profile" as const },
];

const listVariants: Variants = {
  open: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
  closed: {},
};

const itemVariants: Variants = {
  closed: { opacity: 0, y: 24, filter: "blur(6px)" },
  open: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
};

export default function AppHeader() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { profile } = useProfile(user);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  // Lock body scroll + close on Escape while the overlay is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function handleSignOut() {
    setOpen(false);
    await signOut();
    navigate({ to: "/login" });
  }

  return (
    <>
      <header className="nav-scrolled sticky top-0 z-50">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link
            to="/"
            className="flex items-center gap-3"
            aria-label="AURA home"
            onClick={() => setOpen(false)}
          >
            <img src={logo} alt="AURA" className="nav-logo" draggable={false} />
            <span className="chrome-text font-aura text-sm font-extrabold uppercase tracking-[0.4em]">
              Aura
            </span>
          </Link>

          <div className="flex items-center gap-4">
            <Link
              to="/profile"
              aria-label="Your profile"
              className="rounded-full"
              onClick={() => setOpen(false)}
            >
              <AuraAvatar
                name={profile?.full_name}
                email={user?.email}
                src={profile?.avatar_url}
                size={36}
              />
            </Link>
            <HamburgerButton open={open} onClick={() => setOpen((v) => !v)} />
          </div>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            key="app-menu-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="menu-overlay fixed inset-0 z-40"
          >
            <div className="hero-atmosphere absolute inset-0" aria-hidden />

            <motion.nav
              className="relative z-10 flex min-h-screen flex-col items-center justify-center gap-3 px-6"
              variants={listVariants}
              initial="closed"
              animate="open"
              exit="closed"
            >
              <motion.div
                variants={itemVariants}
                className="mb-6 flex flex-col items-center gap-3"
              >
                <AuraAvatar
                  name={profile?.full_name}
                  email={user?.email}
                  src={profile?.avatar_url}
                  size={64}
                />
                {user?.email && (
                  <span className="font-aura text-sm text-aura-text-secondary">
                    {user.email}
                  </span>
                )}
              </motion.div>

              {NAV.map((item) => (
                <motion.div key={item.to} variants={itemVariants}>
                  <Link
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className={`menu-link ${
                      pathname === item.to ? "is-active" : ""
                    }`}
                  >
                    {item.label}
                  </Link>
                </motion.div>
              ))}

              <motion.div variants={itemVariants} className="mt-8">
                <ChromeButton variant="secondary" onClick={handleSignOut}>
                  Sign out
                </ChromeButton>
              </motion.div>
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}