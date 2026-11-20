import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useAuraChat } from "./useAuraChat";
import { useMediaQuery } from "./useLockedViewport";

// Το βαρύ κομμάτι (χαρακτήρας, lip-sync, chat) κατεβαίνει μόνο όταν ο χρήστης ανοίξει το widget
const AuraWidgetPanel = lazy(() => import("./AuraWidgetPanel"));

const ICON_SRC = "/aura-ai-icon.jpg";
const SEEN_KEY = "aura_widget_seen";

const RING_CSS = `
@keyframes aura-ring { 0% { transform: scale(1); opacity: 0.55; } 100% { transform: scale(1.7); opacity: 0; } }
.aura-ring { animation: aura-ring 2.4s ease-out 3; }
@keyframes aura-hint { from { opacity: 0; transform: translate(8px, -50%); } to { opacity: 1; transform: translate(0, -50%); } }
.aura-hint { animation: aura-hint 0.3s ease-out both; }
@media (prefers-reduced-motion: reduce) { .aura-ring, .aura-hint { animation: none; } }
`;

/** Στις σελίδες διαχείρισης δεν εμφανίζεται. Στη σελίδα /ai δεν χρειάζεται (είναι ήδη εκεί). */
const isHidden = (p: string) => p === "/admin" || p.startsWith("/admin/") || p === "/ai" || p.startsWith("/ai/");

export default function AuraWidget() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (isHidden(pathname)) return null;
  return <WidgetInner pathname={pathname} />;
}

function WidgetInner({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(false);
  const [hint, setHint] = useState(false);
  const openRef = useRef(false);
  openRef.current = open;

  const isMobile = useMediaQuery("(max-width: 767px)");
  // η φωνή μιλά μόνο όταν το widget είναι ανοιχτό
  const chat = useAuraChat({ canSpeak: () => openRef.current });

  // στο κινητό το widget είναι πλήρης οθόνη: κλείνει όταν αλλάζει η σελίδα
  useEffect(() => {
    if (isMobile) setOpen(false);
  }, [pathname, isMobile]);

  // μικρή υπόδειξη, μία φορά ανά συνεδρία, αν δεν το έχει ανοίξει ακόμα
  useEffect(() => {
    try {
      if (sessionStorage.getItem(SEEN_KEY)) return;
    } catch {
      /* ignore */
    }
    const t1 = window.setTimeout(() => setHint(true), 5000);
    const t2 = window.setTimeout(() => setHint(false), 13000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  // κουκκίδα όταν έρχεται απάντηση ενώ το widget είναι κλειστό
  const prevCount = useRef<number | null>(null);
  useEffect(() => {
    if (!chat.ready) return;
    const n = chat.messages.length;
    if (prevCount.current === null) {
      prevCount.current = n;
      return;
    }
    const last = chat.messages[n - 1];
    if (n > prevCount.current && last?.role === "assistant" && !openRef.current) setUnread(true);
    prevCount.current = n;
  }, [chat.ready, chat.messages]);

  function openWidget() {
    setOpen(true);
    setUnread(false);
    setHint(false);
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  function closeWidget() {
    setOpen(false);
    chat.stopVoice();
  }

  const showLauncher = !(open && isMobile);

  return (
    <>
      <style>{RING_CSS}</style>

      {open && (
        <Suspense fallback={null}>
          <AuraWidgetPanel chat={chat} onClose={closeWidget} />
        </Suspense>
      )}

      {showLauncher && (
        <div className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-4 z-[80] md:right-5">
          {hint && !open && (
            <span className="aura-hint pointer-events-none absolute right-[72px] top-1/2 whitespace-nowrap rounded-full bg-white px-3 py-1.5 text-xs font-medium text-black shadow-lg">
              Ρώτα την AURA
            </span>
          )}

          <button
            type="button"
            onClick={open ? closeWidget : openWidget}
            aria-label={open ? "Κλείσιμο AURA AI" : "Άνοιγμα AURA AI"}
            aria-expanded={open}
            className="group relative block size-[60px] rounded-full bg-gradient-to-b from-zinc-100 via-zinc-400 to-zinc-700 p-[2px] shadow-[0_10px_30px_rgba(0,0,0,0.6),0_0_30px_rgba(170,190,235,0.25)] outline-none transition duration-300 hover:scale-105 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black active:scale-95"
          >
            {!open && <span aria-hidden className="aura-ring pointer-events-none absolute inset-0 rounded-full border border-white/50" />}
            <span className="relative block size-full overflow-hidden rounded-full bg-black">
              <img
                src={ICON_SRC}
                alt=""
                width={192}
                height={192}
                draggable={false}
                className="size-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
              {open && (
                <span className="absolute inset-0 grid place-items-center bg-black/70 text-white">
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </span>
              )}
            </span>

            {/* πράσινη κουκκίδα «online» */}
            <span aria-hidden className="absolute right-0 top-0 size-3.5 rounded-full bg-emerald-400 ring-2 ring-black" />

            {unread && !open && (
              <span
                aria-hidden
                className="absolute -left-1 -top-1 grid size-[18px] place-items-center rounded-full bg-white text-[10px] font-bold text-black ring-2 ring-black"
              >
                1
              </span>
            )}
          </button>
        </div>
      )}
    </>
  );
}