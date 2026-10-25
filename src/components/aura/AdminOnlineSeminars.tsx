import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BadgeCheck, Globe, Mail, Pencil, Phone, Plus, Trash2, Eye, EyeOff, X, Users } from "lucide-react";
import { useAsync } from "@/lib/useAsync";
import { ErrorState, LoadingSkeleton } from "@/components/aura/States";
import {
  deleteOnlineSeminar,
  formatPrice,
  getAdminOnlineSeminars,
  getOnlineBookings,
  saveOnlineSeminar,
  setOnlineBookingStatus,
  setOnlineSeminarPublished,
  type OnlineBooking,
  type OnlineSeminar,
} from "@/lib/onlineSeminars";

const chromeText = "bg-gradient-to-b from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent";
const inputCls =
  "w-full rounded-xl border border-white/15 bg-black/60 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-white/40 focus:ring-2 focus:ring-white/10";
const labelCls = "mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500";

type FormState = {
  title: string;
  description: string;
  starts_at: string; // datetime-local
  duration_minutes: string;
  price: string; // euros
  capacity: string;
  published: boolean;
};

const empty: FormState = {
  title: "",
  description: "",
  starts_at: "",
  duration_minutes: "90",
  price: "",
  capacity: "",
  published: true,
};

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AdminOnlineSeminars() {
  const [reload, setReload] = useState(0);
  const seminars = useAsync(getAdminOnlineSeminars, [reload]);
  const bookings = useAsync(getOnlineBookings, [reload]);

  const [editing, setEditing] = useState<OnlineSeminar | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(empty);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState<"paid" | "all">("paid");

  const refresh = () => setReload((n) => n + 1);

  function openNew() {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  }
  function openEdit(s: OnlineSeminar) {
    setEditing(s);
    setForm({
      title: s.title,
      description: s.description,
      starts_at: toLocalInput(s.starts_at),
      duration_minutes: String(s.duration_minutes),
      price: (s.price_cents / 100).toString(),
      capacity: s.capacity?.toString() ?? "",
      published: s.published,
    });
    setOpen(true);
  }

  const valid =
    form.title.trim().length >= 3 && form.starts_at && Number(form.price) >= 0 && form.price !== "" &&
    Number(form.duration_minutes) > 0;

  async function submit() {
    if (!valid || saving) return;
    setSaving(true);
    setMsg(null);
    try {
      await saveOnlineSeminar(
        {
          title: form.title.trim(),
          description: form.description.trim(),
          starts_at: new Date(form.starts_at).toISOString(),
          duration_minutes: Number(form.duration_minutes),
          price_cents: Math.round(Number(form.price) * 100),
          currency: "eur",
          capacity: form.capacity ? Number(form.capacity) : null,
          published: form.published,
        },
        editing?.id,
      );
      setOpen(false);
      setMsg(editing ? "Το σεμινάριο ενημερώθηκε." : "Το σεμινάριο δημιουργήθηκε.");
      refresh();
    } catch (e) {
      setMsg("Αποτυχία: " + (e instanceof Error ? e.message : "άγνωστο σφάλμα"));
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(s: OnlineSeminar) {
    try {
      await setOnlineSeminarPublished(s.id, !s.published);
      refresh();
    } catch (e) {
      setMsg("Αποτυχία: " + (e instanceof Error ? e.message : "άγνωστο σφάλμα"));
    }
  }

  async function changeBooking(b: OnlineBooking, status: OnlineBooking["status"]) {
    const text =
      status === "paid"
        ? `Μαρκάρισμα του ${b.full_name} ως πληρωμένου;`
        : `Αναίρεση πληρωμής για τον ${b.full_name};`;
    if (!window.confirm(text)) return;
    try {
      await setOnlineBookingStatus(b.id, status);
      setMsg(status === "paid" ? `Ο ${b.full_name} μαρκαρίστηκε ως πληρωμένος.` : "Η πληρωμή αναιρέθηκε.");
      refresh();
    } catch (e) {
      setMsg("Αποτυχία: " + (e instanceof Error ? e.message : "άγνωστο σφάλμα"));
    }
  }

  async function remove(s: OnlineSeminar) {
    if (!window.confirm(`Διαγραφή "${s.title}" και όλων των κρατήσεών του;`)) return;
    try {
      await deleteOnlineSeminar(s.id);
      refresh();
    } catch (e) {
      setMsg("Αποτυχία: " + (e instanceof Error ? e.message : "άγνωστο σφάλμα"));
    }
  }

  const rows: OnlineBooking[] = (bookings.data ?? []).filter((b) => filter === "all" || b.status === "paid");

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 px-1">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-white/60">
          <span className="size-1.5 rounded-full bg-white/60" />
          Online Σεμινάρια
        </h2>
        <motion.button
          type="button"
          onClick={openNew}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-gradient-to-b from-zinc-100 via-zinc-300 to-zinc-400 px-5 py-2.5 text-sm font-semibold text-black shadow-[0_0_24px_rgba(255,255,255,0.2)] transition-shadow before:absolute before:inset-y-0 before:-left-1/2 before:w-1/2 before:-skew-x-12 before:bg-white/70 before:blur-md before:transition-transform before:duration-700 hover:shadow-[0_0_40px_rgba(255,255,255,0.4)] hover:before:translate-x-[300%]"
        >
          <Plus className="relative size-4" />
          <span className="relative">Νέο online σεμινάριο</span>
        </motion.button>
      </div>

      {msg && (
        <div role="status" className="rounded-2xl border border-white/10 bg-zinc-950/80 p-4 text-sm text-zinc-300">
          {msg}
        </div>
      )}

      {seminars.loading && <LoadingSkeleton rows={2} />}
      {seminars.error && <ErrorState message={seminars.error} />}

      {seminars.data && (
        <div className="grid gap-4 md:grid-cols-2">
          {seminars.data.length === 0 && (
            <p className="px-1 text-sm text-white/40">Δεν υπάρχουν online σεμινάρια ακόμη.</p>
          )}
          {seminars.data.map((s) => {
            const paid = (bookings.data ?? []).filter((b) => b.seminar_id === s.id && b.status === "paid").length;
            return (
              <motion.div
                key={s.id}
                whileHover={{ y: -3 }}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-900/80 to-black/90 p-5 shadow-[0_24px_60px_-28px_rgba(0,0,0,0.95)] transition-colors hover:border-white/30"
              >
                <div className="absolute -right-10 -top-10 size-32 rounded-full bg-white/[0.06] blur-[60px]" />
                <div className="relative">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-xl border border-white/15 bg-black/60 text-zinc-200 transition group-hover:shadow-[0_0_20px_rgba(255,255,255,0.3)]">
                        <Globe className="size-5" />
                      </div>
                      <h3 className={`text-lg font-bold ${chromeText}`}>{s.title}</h3>
                    </div>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                        s.published
                          ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                          : "border-white/15 bg-white/5 text-zinc-400"
                      }`}
                    >
                      {s.published ? "Ορατό" : "Πρόχειρο"}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-zinc-400">
                    {new Date(s.starts_at).toLocaleString("el-GR", { dateStyle: "long", timeStyle: "short" })} ·{" "}
                    {s.duration_minutes}′ · {formatPrice(s.price_cents, s.currency)}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
                    <Users className="size-3.5" />
                    {paid}
                    {s.capacity ? ` / ${s.capacity}` : ""} πληρωμένες κρατήσεις
                  </p>
                  <div className="mt-4 flex gap-2">
                    <IconBtn onClick={() => openEdit(s)} label="Επεξεργασία">
                      <Pencil className="size-3.5" />
                    </IconBtn>
                    <IconBtn onClick={() => togglePublish(s)} label={s.published ? "Απόκρυψη" : "Δημοσίευση"}>
                      {s.published ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </IconBtn>
                    <IconBtn onClick={() => remove(s)} label="Διαγραφή">
                      <Trash2 className="size-3.5" />
                    </IconBtn>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Attendees */}
      <div className="space-y-3 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <h3 className="text-sm font-semibold text-white">Συμμετέχοντες</h3>
          <div className="inline-flex rounded-full border border-white/15 bg-black/60 p-1 text-xs">
            {(["paid", "all"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-full px-4 py-1.5 font-medium transition ${
                  filter === f ? "bg-gradient-to-b from-zinc-100 to-zinc-400 text-black" : "text-zinc-400 hover:text-white"
                }`}
              >
                {f === "paid" ? "Πληρωμένοι" : "Όλοι"}
              </button>
            ))}
          </div>
        </div>

        {bookings.loading && <LoadingSkeleton rows={3} />}
        {bookings.error && <ErrorState message={bookings.error} />}

        {bookings.data && (
          <div className="overflow-x-auto rounded-3xl border border-white/10 bg-zinc-950/80 shadow-[0_0_40px_-10px_rgba(0,0,0,0.9)] backdrop-blur-xl">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wider text-white/50">
                <tr>
                  {["Όνομα", "Σεμινάριο", "Email", "Τηλέφωνο", "Status", ""].map((h) => (
                    <th key={h} className="p-4 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.map((b) => (
                  <tr key={b.id} className="transition-colors hover:bg-white/[0.02]">
                    <td className="p-4 font-medium text-white/90">{b.full_name}</td>
                    <td className="p-4 text-white/60">{b.online_seminars?.title ?? "—"}</td>
                    <td className="p-4 font-mono text-xs text-white/70">{b.email}</td>
                    <td className="p-4">
                      <a href={`tel:${b.phone}`} className="inline-flex items-center gap-1.5 font-mono text-xs text-white/70 hover:text-white">
                        <Phone className="size-3" />
                        {b.phone}
                      </a>
                    </td>
                    <td className="p-4">
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                          b.status === "paid"
                            ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                            : b.status === "pending"
                              ? "border-amber-500/30 bg-amber-500/15 text-amber-300"
                              : "border-red-500/30 bg-red-500/15 text-red-300"
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                      {b.status === "paid" ? (
                        <button
                          type="button"
                          onClick={() => changeBooking(b, "pending")}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/60 transition hover:border-white/40 hover:text-white"
                        >
                          Αναίρεση
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => changeBooking(b, "paid")}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 transition hover:bg-emerald-400 hover:text-black"
                        >
                          <BadgeCheck className="size-3.5" /> Πληρώθηκε
                        </button>
                      )}
                      <a
                        href={`mailto:${b.email}?subject=${encodeURIComponent(
                          `AURA online σεμινάριο: ${b.online_seminars?.title ?? ""}`,
                        )}&body=${encodeURIComponent(`Γεια σου ${b.full_name},\n\n`)}`}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white hover:text-black"
                      >
                        <Mail className="size-3.5" /> Επικοινωνία
                      </a>
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-white/40">
                      Καμία κράτηση ακόμη.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / edit modal */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.97 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/15 bg-gradient-to-br from-zinc-900 via-black to-zinc-950 p-6 shadow-[0_0_90px_-30px_rgba(255,255,255,0.25)] sm:p-8"
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Κλείσιμο"
                className="absolute right-4 top-4 text-zinc-500 transition hover:text-white"
              >
                <X className="size-5" />
              </button>
              <h3 className={`text-xl font-bold ${chromeText}`}>
                {editing ? "Επεξεργασία σεμιναρίου" : "Νέο online σεμινάριο"}
              </h3>

              <div className="mt-6 space-y-4">
                <label className="block">
                  <span className={labelCls}>Τίτλος</span>
                  <input className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="π.χ. Master Fades Live" />
                </label>
                <label className="block">
                  <span className={labelCls}>Περιγραφή</span>
                  <textarea rows={4} className={`${inputCls} resize-none`} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Τι θα μάθουν οι συμμετέχοντες…" />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className={labelCls}>Ημερομηνία & ώρα</span>
                    <input type="datetime-local" className={`${inputCls} [color-scheme:dark]`} value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
                  </label>
                  <label className="block">
                    <span className={labelCls}>Διάρκεια (λεπτά)</span>
                    <input type="number" min={15} className={inputCls} value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} />
                  </label>
                  <label className="block">
                    <span className={labelCls}>Τιμή (€)</span>
                    <input type="number" min={0} step="0.01" className={inputCls} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="49" />
                  </label>
                  <label className="block">
                    <span className={labelCls}>Μέγ. θέσεις (προαιρετικό)</span>
                    <input type="number" min={1} className={inputCls} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
                  </label>
                </div>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-sm text-zinc-300">
                  <input type="checkbox" className="size-4 accent-white" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} />
                  Ορατό στη δημόσια σελίδα
                </label>
              </div>

              <button
                type="button"
                disabled={!valid || saving}
                onClick={submit}
                className="mt-6 w-full rounded-full bg-gradient-to-b from-zinc-100 via-zinc-300 to-zinc-400 px-6 py-3 text-sm font-semibold text-black shadow-[0_0_24px_rgba(255,255,255,0.2)] transition enabled:hover:shadow-[0_0_40px_rgba(255,255,255,0.4)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? "Αποθήκευση…" : "Αποθήκευση"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function IconBtn({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80 transition hover:border-white/40 hover:bg-white/15"
    >
      {children}
      {label}
    </button>
  );
}