// src/routes/admin.notifications.tsx  ->  /admin/notifications
import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  AlertCircle,
  ArrowLeft,
  Bell,
  BellOff,
  BellRing,
  BookOpen,
  CalendarCheck,
  ClipboardCheck,
  Loader2,
  Send,
  UserPlus,
  Users,
} from "lucide-react";
import { getMyProfile } from "@/lib/queries";
import { supabase } from "@/lib/supabase";
import { ErrorState, LoadingSkeleton, LockedState } from "@/components/aura/States";
import { ChromeCTA, ChromeText, EASE, Frame, CHROME_FILL } from "@/components/aura/chrome";
import {
  disablePush,
  enablePush,
  getPushState,
  getRecentNotifications,
  sendTestNotification,
  type AdminNotification,
  type PushState,
} from "@/lib/push";

export const Route = createFileRoute("/admin/notifications")({
  head: () => ({ meta: [{ title: "AURA Admin — Ειδοποιήσεις" }] }),
  component: NotificationsPage,
});

const ADMIN_ROLES = ["admin", "super_admin", "operations"];

const EVENTS = [
  { type: "new_member", icon: UserPlus, label: "Νέο μέλος", text: "Κάποιος πληρώνει και ξεκινά συνδρομή." },
  { type: "seminar_booking", icon: CalendarCheck, label: "Κράτηση σεμιναρίου", text: "Κλείνεται μία θέση σε σεμινάριο." },
  { type: "seminar_full", icon: Users, label: "Σεμινάριο γεμάτο", text: "Ένα σεμινάριο φτάνει τη μέγιστη χωρητικότητα." },
  { type: "book_order", icon: BookOpen, label: "Παραγγελία βιβλίου", text: "Αγοράζεται ένα βιβλίο." },
  { type: "review_submission", icon: ClipboardCheck, label: "Νέο review", text: "Ένας μαθητής στέλνει εργασία στο review queue." },
];

const iconFor = (type: string) => EVENTS.find((e) => e.type === type)?.icon ?? Bell;

const dateFmt = new Intl.DateTimeFormat("el-GR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

function NotificationsPage() {
  const reduce = useReducedMotion();
  const [role, setRole] = useState<string | null | undefined>(undefined);
  const [roleError, setRoleError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getMyProfile()
      .then((p) => alive && setRole(p?.role ?? null))
      .catch((e: Error) => alive && setRoleError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  const allowed = !!role && ADMIN_ROLES.includes(role);

  return (
    <main className="relative min-h-screen overflow-x-hidden px-4 pb-24 pt-28 text-white sm:px-6 sm:pt-36 md:px-10">
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 hidden aspect-square w-[min(900px,120%)] -translate-x-1/2 -translate-y-1/3 rounded-full md:block"
        style={{ background: "radial-gradient(circle, rgba(255,255,255,0.09) 0%, rgba(170,180,190,0.04) 40%, transparent 70%)" }}
        animate={reduce ? undefined : { opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="relative mx-auto max-w-4xl">
        {role === undefined && !roleError && <LoadingSkeleton rows={3} />}
        {roleError && <ErrorState message={roleError} />}
        {role !== undefined && !allowed && (
          <Frame inner="p-8 text-center">
            <LockedState reason="Μόνο διαχειριστές έχουν πρόσβαση στις ειδοποιήσεις." />
          </Frame>
        )}
        {allowed && <Content />}
      </div>
    </main>
  );
}

function Content() {
  const reduce = useReducedMotion();
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testSent, setTestSent] = useState(false);
  const [items, setItems] = useState<AdminNotification[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const refreshState = useCallback(async () => setState(await getPushState()), []);

  useEffect(() => {
    void refreshState();
  }, [refreshState]);

  // history + live updates
  useEffect(() => {
    let alive = true;
    getRecentNotifications()
      .then((rows) => alive && setItems(rows))
      .catch((e: Error) => alive && setListError(e.message));

    const channel = supabase
      .channel("admin-notifications-feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "admin_notifications" }, (payload) => {
        setItems((list) => [payload.new as AdminNotification, ...(list ?? [])].slice(0, 30));
      })
      .subscribe();

    return () => {
      alive = false;
      void supabase.removeChannel(channel);
    };
  }, []);

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      if (state === "enabled") await disablePush();
      else await enablePush();
      await refreshState();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setError(null);
    setTestSent(false);
    try {
      await sendTestNotification();
      setTestSent(true);
      setTimeout(() => setTestSent(false), 4000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const enabled = state === "enabled";
  const blocked = state === "unsupported" || state === "insecure" || state === "denied";

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.1 } } }}
      className="space-y-10"
    >
      {/* header */}
      <motion.header
        variants={{ hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } } }}
        className="border-b border-white/10 pb-8"
      >
        <Link
          to={"/admin" as never}
          className="mb-5 inline-flex items-center gap-2 text-xs text-white/50 outline-none transition-colors hover:text-white focus-visible:text-white"
        >
          <ArrowLeft className="size-3.5" /> Πίσω στο Admin
        </Link>
        <div className="mb-3 flex items-center gap-3 text-xs uppercase tracking-[0.35em] text-white/50">
          <span className="h-px w-10 bg-gradient-to-r from-white/70 to-transparent" />
          Alerts
        </div>
        <h1 className="text-3xl font-extrabold uppercase tracking-tight sm:text-5xl">
          <ChromeText>Ειδοποιήσεις</ChromeText>
        </h1>
      </motion.header>

      {/* enable card */}
      <motion.section variants={{ hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } } }}>
        <Frame inner="p-6 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-5">
              <div className="relative shrink-0">
                {enabled && !reduce && (
                  <motion.span
                    aria-hidden
                    className="absolute inset-0 rounded-2xl border border-white/60"
                    animate={{ scale: [1, 1.5], opacity: [0.6, 0] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut" }}
                  />
                )}
                <span
                  className="relative flex size-14 items-center justify-center rounded-2xl text-neutral-950"
                  style={
                    enabled
                      ? { backgroundImage: CHROME_FILL, boxShadow: "0 0 34px rgba(255,255,255,0.5), inset 0 1px 0 rgba(255,255,255,0.95)" }
                      : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.15)" }
                  }
                >
                  {enabled ? <BellRing className="size-6" /> : blocked ? <BellOff className="size-6" /> : <Bell className="size-6" />}
                </span>
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">
                  {state === null ? "Έλεγχος…" : enabled ? "Οι ειδοποιήσεις είναι ενεργές" : "Οι ειδοποιήσεις είναι ανενεργές"}
                </h2>
                <p className="mt-1 max-w-md text-sm leading-relaxed text-white/55">
                  {state === "insecure" &&
                    "Το site τρέχει σε http. Οι ειδοποιήσεις του Chrome λειτουργούν μόνο σε https (ή localhost)."}
                  {state === "unsupported" && "Αυτός ο browser δεν υποστηρίζει push ειδοποιήσεις."}
                  {state === "denied" &&
                    "Έχεις μπλοκάρει τις ειδοποιήσεις. Επίτρεψέ τες από το εικονίδιο δίπλα στη διεύθυνση του site και ανανέωσε τη σελίδα."}
                  {(state === "enabled" || state === "disabled") &&
                    "Ενεργοποίησέ τες σε κάθε browser ή συσκευή όπου θέλεις να λαμβάνεις ειδοποιήσεις. Ο Chrome πρέπει να είναι ανοιχτός."}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 flex-col gap-3 sm:items-end">
              <ChromeCTA type="button" solid={!enabled} onClick={() => void toggle()} disabled={busy || blocked || state === null}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : enabled ? <BellOff className="size-4" /> : <BellRing className="size-4" />}
                {enabled ? "Απενεργοποίηση" : "Ενεργοποίηση"}
              </ChromeCTA>
              {enabled && (
                <ChromeCTA type="button" solid={false} onClick={() => void test()} disabled={busy}>
                  <Send className="size-4" /> Δοκιμαστική
                </ChromeCTA>
              )}
            </div>
          </div>

          <AnimatePresence>
            {testSent && (
              <motion.p
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-5 text-sm font-semibold text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.6)]"
              >
                Στάλθηκε. Η ειδοποίηση πρέπει να εμφανιστεί σε λίγα δευτερόλεπτα.
              </motion.p>
            )}
          </AnimatePresence>
          {error && (
            <p role="alert" className="mt-5 flex items-start gap-2 rounded-xl border border-white/20 bg-white/[0.05] p-3 text-sm text-white/85">
              <AlertCircle className="mt-0.5 size-4 shrink-0" /> {error}
            </p>
          )}
        </Frame>
      </motion.section>

      {/* what notifies */}
      <motion.section variants={{ hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } } }}>
        <SectionTitle>Πότε ειδοποιείσαι</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          {EVENTS.map((e, i) => (
            <motion.div
              key={e.type}
              whileHover={{ y: -4 }}
              className={`group ${i === EVENTS.length - 1 && EVENTS.length % 2 === 1 ? "sm:col-span-2" : ""}`}
            >
              <Frame inner="p-5">
                <div className="flex items-start gap-4">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-black/60 text-zinc-200 transition-all duration-300 group-hover:border-white/50 group-hover:text-white group-hover:shadow-[0_0_24px_rgba(255,255,255,0.35)]">
                    <e.icon className="size-5" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{e.label}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-white/50">{e.text}</p>
                  </div>
                </div>
              </Frame>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* history */}
      <motion.section variants={{ hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } } }}>
        <SectionTitle>Πρόσφατες ειδοποιήσεις</SectionTitle>
        {listError && <ErrorState message={listError} />}
        {!items && !listError && <LoadingSkeleton rows={3} />}
        {items && items.length === 0 && (
          <Frame inner="p-8 text-center">
            <p className="text-sm text-white/45">Δεν υπάρχουν ειδοποιήσεις ακόμη.</p>
          </Frame>
        )}
        {items && items.length > 0 && (
          <Frame inner="p-2 sm:p-3">
            <ul className="divide-y divide-white/[0.06]">
              <AnimatePresence initial={false}>
                {items.map((n) => {
                  const Icon = iconFor(n.type);
                  const row = (
                    <div className="flex items-start gap-4 rounded-xl px-3 py-3.5 transition-colors hover:bg-white/[0.04]">
                      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/[0.05] text-white/80">
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white">{n.title}</p>
                        {n.body && <p className="mt-0.5 break-words text-sm text-white/55">{n.body}</p>}
                      </div>
                      <span className="shrink-0 text-xs text-white/35">{dateFmt.format(new Date(n.created_at))}</span>
                    </div>
                  );
                  return (
                    <motion.li
                      key={n.id}
                      layout
                      initial={{ opacity: 0, y: -12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, ease: EASE }}
                    >
                      {n.url && n.type !== "test" ? <Link to={n.url as never}>{row}</Link> : row}
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          </Frame>
        )}
      </motion.section>
    </motion.div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 flex items-center gap-3 px-1 text-xs font-semibold uppercase tracking-[0.3em] text-white/65">
      <span className="size-1.5 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.9)]" />
      {children}
    </h2>
  );
}