// src/routes/admin.book.tsx  ->  /admin/book
import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Check,
  ChevronDown,
  Copy,
  Euro,
  Loader2,
  Mail,
  MapPin,
  PackageCheck,
  Phone,
  RefreshCw,
  Truck,
} from "lucide-react";
import { getMyProfile } from "@/lib/queries";
import { ErrorState, LoadingSkeleton, LockedState } from "@/components/aura/States";
import {
  formatMoney,
  getBookOrders,
  getBookSettings,
  updateBookOrder,
  updateBookSettings,
  type BookOrder,
  type BookOrderStatus,
  type BookSettings,
} from "@/lib/book";
import { ChromeCTA, ChromeText, EASE, Frame, fieldClass } from "@/components/aura/chrome";

export const Route = createFileRoute("/admin/book")({
  head: () => ({ meta: [{ title: "AURA Admin — Book" }] }),
  component: AdminBookPage,
});

const ADMIN_ROLES = ["admin", "super_admin", "operations"];

const STATUS_LABEL: Record<BookOrderStatus, string> = {
  pending: "Αναμονή πληρωμής",
  paid: "Πληρώθηκε",
  shipped: "Στάλθηκε",
  delivered: "Παραδόθηκε",
  cancelled: "Ακυρώθηκε",
  refunded: "Επιστροφή χρημάτων",
};
const STATUSES = Object.keys(STATUS_LABEL) as BookOrderStatus[];
const FILTERS: { key: "all" | BookOrderStatus; label: string }[] = [
  { key: "all", label: "Όλες" },
  { key: "paid", label: "Προς αποστολή" },
  { key: "shipped", label: "Στάλθηκαν" },
  { key: "delivered", label: "Παραδόθηκαν" },
  { key: "pending", label: "Αναμονή" },
  { key: "cancelled", label: "Ακυρωμένες" },
];

const dateFmt = new Intl.DateTimeFormat("el-GR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

function AdminBookPage() {
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
      <GlowBg />
      <div className="relative mx-auto max-w-6xl">
        {role === undefined && !roleError && <LoadingSkeleton rows={3} />}
        {roleError && <ErrorState message={roleError} />}
        {role !== undefined && !allowed && (
          <Frame inner="p-8 text-center">
            <LockedState reason="Μόνο διαχειριστές έχουν πρόσβαση στη διαχείριση του βιβλίου." />
          </Frame>
        )}
        {allowed && <AdminContent />}
      </div>
    </main>
  );
}

function GlowBg() {
  const reduce = useReducedMotion();
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-0 aspect-square w-[min(900px,120%)] -translate-x-1/2 -translate-y-1/3 rounded-full"
      style={{ background: "radial-gradient(circle, rgba(255,255,255,0.09) 0%, rgba(170,180,190,0.04) 40%, transparent 70%)" }}
      animate={reduce ? undefined : { opacity: [0.4, 1, 0.4] }}
      transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

/* ------------------------------------------------------------------------ */

function AdminContent() {
  const [settings, setSettings] = useState<BookSettings | null>(null);
  const [orders, setOrders] = useState<BookOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"all" | BookOrderStatus>("all");

  const load = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const [s, o] = await Promise.all([getBookSettings(), getBookOrders()]);
      setSettings(s);
      setOrders(o);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const list = orders ?? [];
    const counted = list.filter((o) => ["paid", "shipped", "delivered"].includes(o.status));
    return {
      toShip: list.filter((o) => o.status === "paid").length,
      sold: counted.reduce((n, o) => n + o.quantity, 0),
      revenue: counted.reduce((n, o) => n + o.total_cents, 0),
      currency: list[0]?.currency ?? settings?.currency ?? "eur",
    };
  }, [orders, settings]);

  const visible = useMemo(
    () => (orders ?? []).filter((o) => filter === "all" || o.status === filter),
    [orders, filter],
  );

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
        className="flex flex-col gap-5 border-b border-white/10 pb-8 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <Link
            to={"/admin" as never}
            className="mb-5 inline-flex items-center gap-2 text-xs text-white/50 outline-none transition-colors hover:text-white focus-visible:text-white"
          >
            <ArrowLeft className="size-3.5" /> Πίσω στο Admin
          </Link>
          <div className="mb-3 flex items-center gap-3 text-xs uppercase tracking-[0.35em] text-white/50">
            <span className="h-px w-10 bg-gradient-to-r from-white/70 to-transparent" />
            Book Manager
          </div>
          <h1 className="text-3xl font-extrabold uppercase tracking-tight sm:text-5xl">
            <ChromeText>Βιβλίο &amp; Παραγγελίες</ChromeText>
          </h1>
        </div>
        <ChromeCTA type="button" solid={false} onClick={() => void load()} disabled={refreshing}>
          <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} /> Ανανέωση
        </ChromeCTA>
      </motion.header>

      {error && <ErrorState message={error} />}
      {!settings && !orders && !error && <LoadingSkeleton rows={4} />}

      {(settings || orders) && (
        <>
          {/* stats */}
          <motion.div
            variants={{ hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } } }}
            className="grid gap-5 sm:grid-cols-3"
          >
            <Stat icon={<Truck className="size-5" />} label="Προς αποστολή" value={String(stats.toShip)} highlight={stats.toShip > 0} />
            <Stat icon={<BookOpen className="size-5" />} label="Πωλημένα αντίτυπα" value={String(stats.sold)} />
            <Stat icon={<Euro className="size-5" />} label="Έσοδα" value={formatMoney(stats.revenue, stats.currency)} />
          </motion.div>

          {/* settings */}
          <motion.section variants={{ hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } } }}>
            <SectionTitle>Τιμή &amp; διαθεσιμότητα</SectionTitle>
            <SettingsForm settings={settings} onSaved={setSettings} />
          </motion.section>

          {/* orders */}
          <motion.section
            variants={{ hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } } }}
            className="space-y-5"
          >
            <SectionTitle>Παραγγελίες ({orders?.length ?? 0})</SectionTitle>

            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Φίλτρο παραγγελιών">
              {FILTERS.map((f) => {
                const on = filter === f.key;
                const count = f.key === "all" ? orders?.length ?? 0 : (orders ?? []).filter((o) => o.status === f.key).length;
                return (
                  <button
                    key={f.key}
                    role="tab"
                    aria-selected={on}
                    onClick={() => setFilter(f.key)}
                    className="relative rounded-full px-4 py-2 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-white/60"
                    style={{ color: on ? "#0a0a0a" : "rgba(255,255,255,0.6)" }}
                  >
                    {on ? (
                      <motion.span
                        layoutId="order-filter"
                        className="absolute inset-0 rounded-full"
                        style={{ backgroundImage: "linear-gradient(180deg,#fff,#c9ced4 50%,#f4f4f6)", boxShadow: "0 0 24px rgba(255,255,255,0.35)" }}
                        transition={{ type: "spring", stiffness: 380, damping: 32 }}
                      />
                    ) : (
                      <span className="absolute inset-0 rounded-full border border-white/10 bg-white/[0.03]" />
                    )}
                    <span className="relative">{f.label} · {count}</span>
                  </button>
                );
              })}
            </div>

            {orders && visible.length === 0 && (
              <Frame inner="p-10 text-center">
                <p className="text-sm text-white/50">Δεν υπάρχουν παραγγελίες σε αυτή την κατηγορία.</p>
              </Frame>
            )}

            <div className="space-y-4">
              <AnimatePresence initial={false}>
                {visible.map((o) => (
                  <OrderCard
                    key={o.id}
                    order={o}
                    onSaved={(next) => setOrders((list) => (list ?? []).map((x) => (x.id === next.id ? next : x)))}
                  />
                ))}
              </AnimatePresence>
            </div>
          </motion.section>
        </>
      )}
    </motion.div>
  );
}

/* ------------------------------ settings ------------------------------ */

function SettingsForm({ settings, onSaved }: { settings: BookSettings | null; onSaved: (s: BookSettings) => void }) {
  const [title, setTitle] = useState(settings?.title ?? "ΛURΛ — The Barbering Book");
  const [price, setPrice] = useState(settings ? (settings.price_cents / 100).toFixed(2) : "");
  const [shipping, setShipping] = useState(settings ? (settings.shipping_cents / 100).toFixed(2) : "0.00");
  const [stock, setStock] = useState(settings?.stock != null ? String(settings.stock) : "");
  const [active, setActive] = useState(settings?.is_active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const toCents = (v: string) => Math.round(parseFloat(v.replace(",", ".")) * 100);

  async function save() {
    setError(null);
    setSaved(false);
    const priceCents = toCents(price);
    const shipCents = toCents(shipping || "0");
    const stockN = stock.trim() === "" ? null : Math.floor(Number(stock));
    if (!title.trim()) return setError("Βάλε τίτλο.");
    if (!Number.isFinite(priceCents) || priceCents < 0) return setError("Μη έγκυρη τιμή.");
    if (priceCents > 0 && priceCents < 50) return setError("Η ελάχιστη τιμή για πληρωμή με κάρτα είναι 0,50.");
    if (!Number.isFinite(shipCents) || shipCents < 0) return setError("Μη έγκυρα μεταφορικά.");
    if (stockN !== null && (!Number.isFinite(stockN) || stockN < 0)) return setError("Μη έγκυρο απόθεμα.");

    setBusy(true);
    try {
      const next = await updateBookSettings({
        title: title.trim(),
        price_cents: priceCents,
        shipping_cents: shipCents,
        stock: stockN,
        is_active: active,
      });
      onSaved(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Frame inner="p-6 sm:p-8">
      <div className="grid gap-5 sm:grid-cols-2">
        <Lbl label="Τίτλος βιβλίου" className="sm:col-span-2">
          <input className={fieldClass} value={title} onChange={(e) => setTitle(e.target.value)} />
        </Lbl>
        <Lbl label="Τιμή (€)">
          <input className={fieldClass} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="30.00" />
        </Lbl>
        <Lbl label="Μεταφορικά (€)">
          <input className={fieldClass} inputMode="decimal" value={shipping} onChange={(e) => setShipping(e.target.value)} placeholder="0.00" />
        </Lbl>
        <Lbl label="Απόθεμα (κενό = απεριόριστο)">
          <input className={fieldClass} inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="π.χ. 100" />
        </Lbl>

        <div>
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">Παραγγελίες</span>
          <button
            type="button"
            role="switch"
            aria-checked={active}
            onClick={() => setActive((a) => !a)}
            className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-black/60 px-4 py-3 text-sm text-white/85 outline-none transition-all hover:border-white/30 focus-visible:ring-2 focus-visible:ring-white/50"
          >
            <span>{active ? "Ανοιχτές" : "Κλειστές"}</span>
            <span
              className="relative h-6 w-11 rounded-full transition-colors duration-300"
              style={{ background: active ? "linear-gradient(180deg,#fff,#a9afb7)" : "rgba(255,255,255,0.12)", boxShadow: active ? "0 0 20px rgba(255,255,255,0.45)" : "none" }}
            >
              <motion.span
                className="absolute top-0.5 size-5 rounded-full bg-neutral-950"
                animate={{ left: active ? 22 : 2 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            </span>
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-5 flex items-start gap-2 rounded-xl border border-white/20 bg-white/[0.05] p-3 text-sm text-white/85">
          <AlertCircle className="mt-0.5 size-4 shrink-0" /> {error}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <ChromeCTA type="button" onClick={() => void save()} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          Αποθήκευση
        </ChromeCTA>
        <AnimatePresence>
          {saved && (
            <motion.span initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="text-sm font-semibold text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.6)]">
              Αποθηκεύτηκε ✓
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </Frame>
  );
}

/* ------------------------------- orders ------------------------------- */

function OrderCard({ order, onSaved }: { order: BookOrder; onSaved: (o: BookOrder) => void }) {
  const [open, setOpen] = useState(order.status === "paid");
  const [status, setStatus] = useState<BookOrderStatus>(order.status);
  const [tracking, setTracking] = useState(order.tracking_number ?? "");
  const [note, setNote] = useState(order.admin_note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const dirty =
    status !== order.status || tracking !== (order.tracking_number ?? "") || note !== (order.admin_note ?? "");
  const needsShipping = order.status === "paid";

  const addressText = [
    order.full_name,
    order.address_line1,
    order.address_line2,
    `${order.postal_code} ${order.city}${order.region ? `, ${order.region}` : ""}`,
    order.country,
    `Τηλ: ${order.phone}`,
  ]
    .filter(Boolean)
    .join("\n");

  async function copy() {
    try {
      await navigator.clipboard.writeText(addressText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const next = await updateBookOrder(order.id, {
        status,
        tracking_number: tracking.trim() || null,
        admin_note: note.trim() || null,
        ...(status === "shipped" && order.status !== "shipped" ? { shipped_at: new Date().toISOString() } : {}),
      });
      onSaved(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.5, ease: EASE }}
    >
      <Frame inner="p-0">
        {needsShipping && (
          <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent shadow-[0_0_14px_rgba(255,255,255,0.9)]" />
        )}

        {/* summary row */}
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-4 p-5 text-left outline-none transition-colors hover:bg-white/[0.03] focus-visible:bg-white/[0.05] sm:p-6"
        >
          <div className="flex min-w-0 items-center gap-4">
            <span
              className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/[0.05] text-white"
              style={needsShipping ? { boxShadow: "0 0 22px rgba(255,255,255,0.35)" } : undefined}
            >
              {order.status === "delivered" ? <PackageCheck className="size-5" /> : order.status === "shipped" ? <Truck className="size-5" /> : <BookOpen className="size-5" />}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">{order.full_name}</p>
              <p className="mt-0.5 truncate text-xs text-white/45">
                {dateFmt.format(new Date(order.created_at))} · {order.quantity} αντίτυπο{order.quantity > 1 ? "α" : ""} · {order.city}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="hidden text-sm font-extrabold text-white sm:block">{formatMoney(order.total_cents, order.currency)}</span>
            <StatusPill status={order.status} />
            <ChevronDown className={`size-4 text-white/50 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
          </div>
        </button>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.4, ease: EASE }}
              className="overflow-hidden"
            >
              <div className="grid gap-6 border-t border-white/10 p-5 sm:p-6 lg:grid-cols-2">
                {/* shipping info */}
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/50">Στοιχεία αποστολής</h3>
                    <button
                      type="button"
                      onClick={() => void copy()}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/80 outline-none transition-all hover:border-white/60 hover:text-white hover:shadow-[0_0_20px_rgba(255,255,255,0.2)] focus-visible:ring-2 focus-visible:ring-white/60"
                    >
                      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                      {copied ? "Αντιγράφηκε" : "Αντιγραφή"}
                    </button>
                  </div>
                  <div className="space-y-3 rounded-2xl border border-white/[0.08] bg-black/40 p-4 text-sm">
                    <p className="flex items-start gap-3 text-white/90">
                      <MapPin className="mt-0.5 size-4 shrink-0 text-white/50" />
                      <span className="leading-relaxed">
                        {order.address_line1}
                        {order.address_line2 && <>, {order.address_line2}</>}
                        <br />
                        {order.postal_code} {order.city}
                        {order.region && <>, {order.region}</>}
                        <br />
                        {order.country}
                      </span>
                    </p>
                    <p className="flex items-center gap-3 text-white/85">
                      <Phone className="size-4 shrink-0 text-white/50" />
                      <a href={`tel:${order.phone}`} className="underline-offset-4 hover:underline">{order.phone}</a>
                    </p>
                    <p className="flex items-center gap-3 text-white/85">
                      <Mail className="size-4 shrink-0 text-white/50" />
                      <a href={`mailto:${order.email}`} className="break-all underline-offset-4 hover:underline">{order.email}</a>
                    </p>
                    {order.notes && (
                      <p className="border-t border-white/10 pt-3 text-xs leading-relaxed text-white/60">
                        <span className="text-white/40">Σημείωση πελάτη: </span>
                        {order.notes}
                      </p>
                    )}
                  </div>

                  <dl className="mt-4 space-y-2 text-sm">
                    <MoneyRow label={`Βιβλίο × ${order.quantity}`} value={formatMoney(order.unit_price_cents * order.quantity, order.currency)} />
                    <MoneyRow label="Μεταφορικά" value={formatMoney(order.shipping_cents, order.currency)} />
                    <MoneyRow label="Σύνολο" value={formatMoney(order.total_cents, order.currency)} strong />
                  </dl>
                </div>

                {/* fulfilment */}
                <div className="space-y-4">
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/50">Διεκπεραίωση</h3>

                  <Lbl label="Κατάσταση">
                    <select className={fieldClass} value={status} onChange={(e) => setStatus(e.target.value as BookOrderStatus)}>
                      {STATUSES.map((s) => (
                        <option key={s} value={s} className="bg-zinc-900">
                          {STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </Lbl>
                  <Lbl label="Αριθμός αποστολής (tracking)">
                    <input className={fieldClass} value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Προαιρετικό" />
                  </Lbl>
                  <Lbl label="Εσωτερική σημείωση">
                    <textarea rows={2} className={fieldClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ορατή μόνο σε διαχειριστές" />
                  </Lbl>

                  {order.paid_at && <p className="text-xs text-white/40">Πληρώθηκε: {dateFmt.format(new Date(order.paid_at))}</p>}
                  {order.shipped_at && <p className="text-xs text-white/40">Στάλθηκε: {dateFmt.format(new Date(order.shipped_at))}</p>}

                  {error && (
                    <p role="alert" className="flex items-start gap-2 rounded-xl border border-white/20 bg-white/[0.05] p-3 text-sm text-white/85">
                      <AlertCircle className="mt-0.5 size-4 shrink-0" /> {error}
                    </p>
                  )}

                  <ChromeCTA type="button" onClick={() => void save()} disabled={busy || !dirty}>
                    {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                    Αποθήκευση αλλαγών
                  </ChromeCTA>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Frame>
    </motion.article>
  );
}

/* ------------------------------- bits ------------------------------- */

function StatusPill({ status }: { status: BookOrderStatus }) {
  const bright = status === "paid" || status === "shipped" || status === "delivered";
  return (
    <span
      className="rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider"
      style={{
        borderColor: bright ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.15)",
        color: status === "paid" ? "#0a0a0a" : bright ? "#fff" : "rgba(255,255,255,0.45)",
        background: status === "paid" ? "#fff" : "transparent",
        boxShadow: status === "paid" ? "0 0 20px rgba(255,255,255,0.5)" : "none",
      }}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function Stat({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <motion.div whileHover={{ y: -5 }} transition={{ duration: 0.25 }} className="group">
      <Frame inner="p-6">
        <div className="absolute right-0 top-0 text-white/35 transition-all duration-300 group-hover:text-white group-hover:drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]">{icon}</div>
        <p className="text-xs uppercase tracking-[0.25em] text-white/50">{label}</p>
        <p
          className="mt-4 text-3xl font-extrabold tracking-tight text-white"
          style={highlight ? { textShadow: "0 0 24px rgba(255,255,255,0.7)" } : undefined}
        >
          {value}
        </p>
      </Frame>
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

function Lbl({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">{label}</span>
      {children}
    </label>
  );
}

function MoneyRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${strong ? "border-t border-white/10 pt-2" : ""}`}>
      <dt className="text-white/50">{label}</dt>
      <dd className={strong ? "font-extrabold text-white" : "text-white/85"}>{value}</dd>
    </div>
  );
}