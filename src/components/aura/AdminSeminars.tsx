import { useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  AlertCircle,
  Calendar as CalendarIcon,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Eye,
  Lock,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Unlock,
  User,
  Users,
  X,
} from "lucide-react";
import { ErrorState, LoadingSkeleton } from "@/components/aura/States";
import { useAsync } from "@/lib/useAsync";
import {
  GROUP_CAPACITY,
  type BlockedDate,
  type BookingStatus,
  type SeminarBooking,
  adminBlockDate,
  adminGetBlocked,
  adminGetBookings,
  adminSetBookingStatus,
  adminUnblock,
  fromISO,
  getDayAvailability,
  getDayStatus,
  indexAvailability,
  rowsFromBookings,
  startOfMonth,
  toISO,
} from "@/lib/seminars";

const MONTHS_EL = [
  "Ιανουάριος", "Φεβρουάριος", "Μάρτιος", "Απρίλιος", "Μάιος", "Ιούνιος",
  "Ιούλιος", "Αύγουστος", "Σεπτέμβριος", "Οκτώβριος", "Νοέμβριος", "Δεκέμβριος",
];
const WEEKDAYS_EL = ["Δ", "Τ", "Τ", "Π", "Π", "Σ", "Κ"];

const STATUS_META: Record<BookingStatus, { label: string; cls: string; icon: typeof Circle }> = {
  new: { label: "Νέο", cls: "bg-sky-500/15 border-sky-500/30 text-sky-300", icon: Circle },
  read: { label: "Διαβάστηκε", cls: "bg-amber-500/15 border-amber-500/30 text-amber-300", icon: Eye },
  verified: {
    label: "Επιβεβαιώθηκε",
    cls: "bg-emerald-500/15 border-emerald-500/30 text-emerald-300",
    icon: CheckCircle2,
  },
  cancelled: { label: "Ακυρώθηκε", cls: "bg-red-500/15 border-red-500/30 text-red-300", icon: X },
};

/* ------------------------------------------------------------------ */
/* Root                                                                */
/* ------------------------------------------------------------------ */

export function AdminSeminars({ adminId }: { adminId: string }) {
  const [reload, setReload] = useState(0);
  const bookingsQ = useAsync(adminGetBookings, [reload]);
  const blockedQ = useAsync(adminGetBlocked, [reload]);

  const [tab, setTab] = useState<"bookings" | "calendar">("bookings");
  const [statusFilter, setStatusFilter] = useState<"all" | BookingStatus>("all");
  const [selected, setSelected] = useState<SeminarBooking | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const bookings = bookingsQ.data ?? [];
  const blocked = blockedQ.data ?? [];

  const counts = useMemo(() => {
    const c: Record<BookingStatus, number> = { new: 0, read: 0, verified: 0, cancelled: 0 };
    for (const b of bookings) c[b.status]++;
    return c;
  }, [bookings]);

  const filtered = useMemo(
    () => (statusFilter === "all" ? bookings : bookings.filter((b) => b.status === statusFilter)),
    [bookings, statusFilter],
  );

  function refresh() {
    setReload((n) => n + 1);
  }

  async function setStatus(b: SeminarBooking, status: BookingStatus) {
    setBusyId(b.id);
    setMsg(null);
    try {
      await adminSetBookingStatus(b.id, status);
      setMsg(`${b.full_name}: η κράτηση μπήκε σε κατάσταση "${STATUS_META[status].label}".`);
      refresh();
      setSelected((cur) => (cur && cur.id === b.id ? { ...cur, status } : cur));
    } catch (e) {
      setMsg("Αποτυχία: " + (e instanceof Error ? e.message : "άγνωστο σφάλμα"));
    } finally {
      setBusyId(null);
    }
  }

  async function openAndMarkRead(b: SeminarBooking) {
    setSelected(b);
    if (b.status === "new") await setStatus(b, "read");
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 px-1">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-white/60">
          <span className="size-1.5 rounded-full bg-white/60" />
          Σεμινάρια
        </h2>

        <div className="inline-flex rounded-full border border-white/15 bg-black/60 p-1">
          <TabBtn active={tab === "bookings"} onClick={() => setTab("bookings")} icon={Users}>
            Κρατήσεις
          </TabBtn>
          <TabBtn active={tab === "calendar"} onClick={() => setTab("calendar")} icon={CalendarIcon}>
            Ημερολόγιο
          </TabBtn>
        </div>
      </div>

      {msg && (
        <div
          className="flex items-center gap-3 rounded-2xl border border-white/10 bg-zinc-950/80 p-4 text-sm text-zinc-300 shadow-lg backdrop-blur-xl"
          role="status"
        >
          <AlertCircle className="size-5 shrink-0 text-white/70" />
          <span>{msg}</span>
        </div>
      )}

      {(bookingsQ.loading || blockedQ.loading) && <LoadingSkeleton rows={4} />}
      {bookingsQ.error && <ErrorState message={bookingsQ.error} />}
      {blockedQ.error && <ErrorState message={blockedQ.error} />}

      {!bookingsQ.loading && !blockedQ.loading && bookingsQ.data && blockedQ.data && (
        <>
          {tab === "bookings" && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <FilterChip
                  active={statusFilter === "all"}
                  onClick={() => setStatusFilter("all")}
                  label={`Όλα (${bookings.length})`}
                />
                {(Object.keys(STATUS_META) as BookingStatus[]).map((s) => (
                  <FilterChip
                    key={s}
                    active={statusFilter === s}
                    onClick={() => setStatusFilter(s)}
                    label={`${STATUS_META[s].label} (${counts[s]})`}
                  />
                ))}
              </div>

              <BookingsTable
                bookings={filtered}
                busyId={busyId}
                onOpen={openAndMarkRead}
                onVerify={(b) => setStatus(b, "verified")}
              />
            </div>
          )}

          {tab === "calendar" && (
            <AdminCalendar
              bookings={bookings}
              blocked={blocked}
              adminId={adminId}
              onChanged={refresh}
              setMsg={setMsg}
            />
          )}
        </>
      )}

      {selected && (
        <BookingDrawer
          booking={selected}
          busy={busyId === selected.id}
          onClose={() => setSelected(null)}
          onSetStatus={(s) => setStatus(selected, s)}
        />
      )}
    </section>
  );
}

function TabBtn({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Users;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium transition-colors duration-300 ${
        active ? "bg-white text-black" : "text-zinc-400 hover:text-white"
      }`}
    >
      <Icon className="size-3.5" />
      {children}
    </button>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors duration-200 ${
        active
          ? "border-white/60 bg-white/10 text-white"
          : "border-white/10 bg-white/[0.02] text-zinc-400 hover:border-white/30 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Bookings table                                                      */
/* ------------------------------------------------------------------ */

function BookingsTable({
  bookings,
  busyId,
  onOpen,
  onVerify,
}: {
  bookings: SeminarBooking[];
  busyId: string | null;
  onOpen: (b: SeminarBooking) => void;
  onVerify: (b: SeminarBooking) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-white/10 bg-zinc-950/80 shadow-[0_0_40px_-10px_rgba(0,0,0,0.9)] backdrop-blur-xl">
      <table className="w-full min-w-[920px] text-left text-sm">
        <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wider text-white/50">
          <tr>
            <th scope="col" className="p-4 font-semibold">Πελάτης</th>
            <th scope="col" className="p-4 font-semibold">Format</th>
            <th scope="col" className="p-4 font-semibold">Ημερομηνία</th>
            <th scope="col" className="p-4 font-semibold">Επικοινωνία</th>
            <th scope="col" className="p-4 font-semibold">Status</th>
            <th scope="col" className="p-4 font-semibold text-right">Ενέργειες</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {bookings.map((b) => {
            const meta = STATUS_META[b.status];
            const busy = busyId === b.id;
            return (
              <tr key={b.id} className="align-middle transition-colors hover:bg-white/[0.02]">
                <td className="p-4">
                  <p className="font-medium text-white/90">{b.full_name}</p>
                  <p className="mt-0.5 font-mono text-xs text-white/40">{b.reference}</p>
                </td>
                <td className="p-4">
                  <span className="inline-flex items-center gap-1.5 text-zinc-300">
                    {b.format === "group" ? (
                      <Users className="size-3.5 text-zinc-500" />
                    ) : (
                      <User className="size-3.5 text-zinc-500" />
                    )}
                    {b.format === "group" ? `Group · ${b.participants}` : "Private"}
                  </span>
                </td>
                <td className="p-4 text-zinc-300">
                  {fromISO(b.seminar_date).toLocaleDateString("el-GR", {
                    day: "numeric",
                    month: "short",
                  })}
                </td>
                <td className="p-4">
                  <p className="text-zinc-300">{b.email}</p>
                  <p className="text-xs text-zinc-500">{b.phone}</p>
                </td>
                <td className="p-4">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wider ${meta.cls}`}
                  >
                    <meta.icon className="size-3.5" />
                    {meta.label}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onOpen(b)}
                      className="rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80 transition hover:border-white/30 hover:bg-white/15"
                    >
                      Λεπτομέρειες
                    </button>
                    {b.status !== "verified" && b.status !== "cancelled" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onVerify(b)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50"
                      >
                        <Check className="size-3.5" /> Verify
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
          {bookings.length === 0 && (
            <tr>
              <td colSpan={6} className="p-8 text-center text-white/40">
                Καμία κράτηση.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Detail drawer                                                      */
/* ------------------------------------------------------------------ */

function BookingDrawer({
  booking,
  busy,
  onClose,
  onSetStatus,
}: {
  booking: SeminarBooking;
  busy: boolean;
  onClose: () => void;
  onSetStatus: (s: BookingStatus) => void;
}) {
  const meta = STATUS_META[booking.status];
  const names = booking.participant_names
    ?.split("\n")
    .map((n) => n.trim())
    .filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <motion.div
        initial={{ x: 420, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 420, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 32 }}
        className="relative flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-white/15 bg-gradient-to-b from-zinc-950 to-black p-6 shadow-[0_0_60px_rgba(0,0,0,0.9)]"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="font-mono text-xs text-zinc-500">{booking.reference}</p>
            <h3 className="mt-1 text-xl font-bold text-white">{booking.full_name}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full border border-white/15 text-zinc-400 transition hover:border-white/40 hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>

        <span
          className={`mt-3 inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wider ${meta.cls}`}
        >
          <meta.icon className="size-3.5" />
          {meta.label}
        </span>

        <div className="mt-6 space-y-1 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <DetailRow icon={booking.format === "group" ? Users : User} label="Format">
            {booking.format === "group" ? `Group · ${booking.participants} άτομα` : "Private"}
          </DetailRow>
          <DetailRow icon={CalendarIcon} label="Ημερομηνία">
            {fromISO(booking.seminar_date).toLocaleDateString("el-GR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </DetailRow>
        </div>

        <div className="mt-4 space-y-1 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <DetailRow icon={Mail} label="Email">
            {booking.email}
          </DetailRow>
          <DetailRow icon={Phone} label="Τηλέφωνο">
            {booking.phone}
          </DetailRow>
          <DetailRow icon={MapPin} label="Πόλη">
            {booking.city}
          </DetailRow>
          <DetailRow icon={ShieldCheck} label="Επίπεδο">
            {booking.experience_level}
          </DetailRow>
        </div>

        {booking.format === "group" && (booking.group_name || names?.length) && (
          <div className="mt-4 space-y-2 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            {booking.group_name && (
              <p className="text-sm text-zinc-300">
                <span className="text-zinc-500">Ομάδα: </span>
                {booking.group_name}
              </p>
            )}
            {!!names?.length && (
              <div>
                <p className="text-xs uppercase tracking-wider text-zinc-500">Συμμετέχοντες</p>
                <ul className="mt-1.5 space-y-1 text-sm text-zinc-300">
                  {names.map((n, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="size-1 rounded-full bg-zinc-600" /> {n}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {booking.goals && <Note label="Στόχοι">{booking.goals}</Note>}
        {booking.notes && <Note label="Σημειώσεις">{booking.notes}</Note>}

        <p className="mt-4 text-xs text-zinc-600">
          Αποδοχή όρων: {new Date(booking.terms_accepted_at).toLocaleString("el-GR")}
        </p>

        <div className="mt-auto flex flex-col gap-2 pt-6">
          {booking.status !== "verified" && (
            <ActionBtn
              label="Σήμανση ως verified"
              icon={CheckCircle2}
              busy={busy}
              cls="border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
              onClick={() => onSetStatus("verified")}
            />
          )}
          {booking.status !== "cancelled" && (
            <ActionBtn
              label="Ακύρωση κράτησης"
              icon={X}
              busy={busy}
              cls="border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20"
              onClick={() => onSetStatus("cancelled")}
            />
          )}
        </div>
      </motion.div>
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof User;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/5 py-2.5 text-sm last:border-0">
      <span className="flex items-center gap-2 text-zinc-500">
        <Icon className="size-3.5" /> {label}
      </span>
      <span className="text-right font-medium text-zinc-200">{children}</span>
    </div>
  );
}

function Note({ label, children }: { label: string; children: string }) {
  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-zinc-300">{children}</p>
    </div>
  );
}

function ActionBtn({
  label,
  icon: Icon,
  busy,
  cls,
  onClick,
}: {
  label: string;
  icon: typeof X;
  busy: boolean;
  cls: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition disabled:opacity-50 ${cls}`}
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Calendar with day blocking                                          */
/* ------------------------------------------------------------------ */

function AdminCalendar({
  bookings,
  blocked,
  adminId,
  onChanged,
  setMsg,
}: {
  bookings: SeminarBooking[];
  blocked: BlockedDate[];
  adminId: string;
  onChanged: () => void;
  setMsg: (m: string | null) => void;
}) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");

  const avail = useMemo(
    () => indexAvailability(rowsFromBookings(bookings, blocked)),
    [bookings, blocked],
  );
  const cells = useMemo(() => buildMonthGrid(month), [month]);

  const selectedDay = selected ? avail.get(selected) : undefined;
  const dayInfo = getDayAvailability(selectedDay, "group", 1);
  const selectedBlocked = selected ? blocked.filter((b) => b.blocked_date === selected) : [];
  const selectedBookings = selected
    ? bookings.filter((b) => b.seminar_date === selected && b.status !== "cancelled")
    : [];

  async function blockDay() {
    if (!selected) return;
    setBusy(true);
    try {
      await adminBlockDate(selected, reason, adminId);
      setMsg("Η ημερομηνία μπλοκαρίστηκε.");
      setReason("");
      onChanged();
    } catch (e) {
      setMsg("Αποτυχία: " + (e instanceof Error ? e.message : "άγνωστο σφάλμα"));
    } finally {
      setBusy(false);
    }
  }

  async function unblockDay() {
    setBusy(true);
    try {
      await Promise.all(selectedBlocked.map((b) => adminUnblock(b.id)));
      setMsg("Το μπλοκάρισμα αφαιρέθηκε.");
      onChanged();
    } catch (e) {
      setMsg("Αποτυχία: " + (e instanceof Error ? e.message : "άγνωστο σφάλμα"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="rounded-2xl border border-white/10 bg-black/50 p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
            className="flex size-8 items-center justify-center rounded-full border border-white/15 text-zinc-300 transition hover:border-white/40 hover:text-white"
          >
            <ChevronLeft className="size-4" />
          </button>
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-200">
            {MONTHS_EL[month.getMonth()]} {month.getFullYear()}
          </h3>
          <button
            type="button"
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
            className="flex size-8 items-center justify-center rounded-full border border-white/15 text-zinc-300 transition hover:border-white/40 hover:text-white"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-7 gap-1.5 text-center text-[11px] uppercase tracking-wider text-zinc-600">
          {WEEKDAYS_EL.map((w, i) => (
            <div key={`${w}-${i}`}>{w}</div>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-7 gap-1.5">
          {cells.map((cell, i) => {
            if (!cell) return <div key={i} />;
            const iso = toISO(cell);
            const day = avail.get(iso);
            const status = getDayStatus(day, "group", 2);
            const isSelected = selected === iso;
            const hasBookings = bookings.some(
              (b) => b.seminar_date === iso && b.status !== "cancelled",
            );

            return (
              <button
                key={iso}
                type="button"
                onClick={() => setSelected(iso)}
                className={`relative flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg border text-xs font-medium transition-all duration-200 ${
                  isSelected
                    ? "border-white bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.4)]"
                    : status === "blocked"
                      ? "border-red-500/20 bg-red-500/[0.05] text-zinc-400 hover:border-red-500/40"
                      : status === "full"
                        ? "border-amber-500/20 bg-amber-500/[0.05] text-zinc-300 hover:border-amber-500/40"
                        : "border-white/10 bg-white/[0.02] text-zinc-200 hover:border-white/40 hover:bg-white/[0.06]"
                }`}
              >
                {cell.getDate()}
                {hasBookings && (
                  <span
                    className={`size-1 rounded-full ${isSelected ? "bg-black" : "bg-emerald-400"}`}
                  />
                )}
                {status === "blocked" && (
                  <Lock
                    className={`absolute bottom-1 right-1 size-2.5 ${isSelected ? "text-black" : "text-red-400"}`}
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-4 text-[11px] text-zinc-500">
          <Legend color="bg-emerald-400" label="Έχει κρατήσεις" />
          <Legend color="bg-amber-500/60" label="Γεμάτο" />
          <Legend color="bg-red-500/60" label="Μπλοκαρισμένο" />
        </div>
      </div>

      {/* Side panel: selected day detail */}
      <div className="rounded-2xl border border-white/10 bg-black/50 p-5">
        {!selected ? (
          <p className="text-sm text-zinc-500">
            Επίλεξε μια ημερομηνία για να δεις κρατήσεις και να διαχειριστείς μπλοκαρίσματα.
          </p>
        ) : (
          <div className="space-y-5">
            <div>
              <p className="text-xs uppercase tracking-wider text-zinc-500">Επιλεγμένη ημέρα</p>
              <h4 className="mt-1 text-lg font-semibold text-white">
                {fromISO(selected).toLocaleDateString("el-GR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </h4>
            </div>

            {/* Day availability */}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3.5 py-2.5">
              <p className="text-[11px] uppercase tracking-wider text-zinc-500">
                {dayInfo.status === "blocked"
                  ? "Μπλοκαρισμένη"
                  : dayInfo.status === "full"
                    ? "Γεμάτη"
                    : `${dayInfo.remaining}/${GROUP_CAPACITY} διαθέσιμα`}
              </p>
            </div>

            {/* Whole-day block */}
            <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-3.5">
              {selectedBlocked.length > 0 ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={unblockDay}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/5 py-2 text-xs font-medium text-zinc-300 transition hover:border-white/30 disabled:opacity-50"
                >
                  <Unlock className="size-3.5" /> Ξεμπλόκαρε όλη τη μέρα
                </button>
              ) : (
                <>
                  <input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Λόγος (προαιρετικό)"
                    className="w-full rounded-lg border border-white/15 bg-black/60 px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:border-white/40 focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={blockDay}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 py-2 text-xs font-medium text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
                  >
                    <Lock className="size-3.5" /> Μπλόκαρε όλη τη μέρα
                  </button>
                </>
              )}
            </div>

            {/* Bookings that day */}
            {selectedBookings.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wider text-zinc-500">
                  Κρατήσεις ({selectedBookings.length})
                </p>
                <ul className="mt-2 space-y-1.5">
                  {selectedBookings.map((b) => (
                    <li
                      key={b.id}
                      className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-xs"
                    >
                      <span className="text-zinc-300">{b.full_name}</span>
                      <span className="text-zinc-500">
                        {b.format === "group" ? `${b.participants}p` : "1-1"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`size-1.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function buildMonthGrid(month: Date): (Date | null)[] {
  const first = startOfMonth(month);
  const firstWeekday = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = Array(firstWeekday).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(month.getFullYear(), month.getMonth(), d));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}