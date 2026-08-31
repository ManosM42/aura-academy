import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { db } from "@/lib/db";
import { useAuth } from "@/lib/useAuth";
import { isStaffRole } from "@/lib/queries";

type MessageStatus = "new" | "in_progress" | "handled" | "archived";
type MessageKind = "message" | "appointment";

interface ContactMessageRow {
  id: string;
  created_at: string;
  kind: MessageKind;
  full_name: string;
  email: string;
  phone: string | null;
  message: string;
  preferred_at: string | null;
  status: MessageStatus;
}

const STATUS_LABEL: Record<MessageStatus, string> = {
  new: "ΝΕΟ",
  in_progress: "ΣΕ ΕΞΕΛΙΞΗ",
  handled: "ΟΛΟΚΛΗΡΩΜΕΝΟ",
  archived: "ΑΡΧΕΙΟ",
};

export const Route = createFileRoute("/admin/inbox")({
  head: () => ({ meta: [{ title: "AURA Admin — Inbox" }] }),
  component: AdminInboxPage,
});

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("el-GR", { dateStyle: "short", timeStyle: "short" });
}

function AdminInboxPage() {
  const { profile, loading: authLoading } = useAuth();
  const staff = profile ? isStaffRole(profile.role) : false;

  const [rows, setRows] = useState<ContactMessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<"all" | MessageKind>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | MessageStatus>("new");
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: queryError } = await db
      .from("contact_messages")
      .select("id, created_at, kind, full_name, email, phone, message, preferred_at, status")
      .order("created_at", { ascending: false })
      .limit(200);

    if (queryError) {
      setError(queryError.message);
      setRows([]);
    } else {
      setRows((data ?? []) as ContactMessageRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!authLoading && staff) void load();
  }, [authLoading, staff, load]);

  const visible = useMemo(
    () =>
      rows.filter(
        (row) =>
          (kindFilter === "all" || row.kind === kindFilter) &&
          (statusFilter === "all" || row.status === statusFilter),
      ),
    [rows, kindFilter, statusFilter],
  );

  async function updateStatus(id: string, status: MessageStatus) {
    setSavingId(id);
    const { error: updateError } = await db
      .from("contact_messages")
      .update({ status, handled_at: new Date().toISOString() })
      .eq("id", id);

    if (updateError) setError(updateError.message);
    else setRows((prev) => prev.map((row) => (row.id === id ? { ...row, status } : row)));
    setSavingId(null);
  }

  if (authLoading) {
    return (
      <main className="mx-auto max-w-5xl px-5 pt-32" aria-busy="true">
        <div className="h-24 animate-pulse rounded-2xl bg-white/5" />
      </main>
    );
  }

  if (!staff) {
    return (
      <main className="mx-auto max-w-lg px-5 pb-24 pt-32 text-center sm:pt-40">
        <p className="text-[11px] uppercase tracking-[0.5em] text-neutral-600">403</p>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-neutral-100">
          Δεν έχεις πρόσβαση σε αυτή τη σελίδα
        </h1>
        <Link
          to="/"
          className="mt-8 inline-flex rounded-full border border-white/20 px-6 py-2.5 text-xs uppercase tracking-[0.2em] text-neutral-200 transition-colors hover:border-white/50 hover:text-white"
        >
          Αρχική
        </Link>
      </main>
    );
  }

  const selectClass =
    "rounded-lg border border-white/10 bg-[#111111] px-3 py-2 text-xs uppercase tracking-[0.15em] text-neutral-200 focus:border-white/35 focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40";

  return (
    <main className="mx-auto max-w-6xl px-5 pb-24 pt-32 sm:px-8 sm:pt-36">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.5em] text-neutral-600">ADMIN</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-neutral-100">
            Μηνύματα & Ραντεβού
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
            {visible.length} από {rows.length} καταχωρήσεις
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <label className="sr-only" htmlFor="filter-kind">
            Τύπος
          </label>
          <select
            id="filter-kind"
            className={selectClass}
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value as "all" | MessageKind)}
          >
            <option value="all">ΟΛΑ</option>
            <option value="message">ΜΗΝΥΜΑΤΑ</option>
            <option value="appointment">ΡΑΝΤΕΒΟΥ</option>
          </select>

          <label className="sr-only" htmlFor="filter-status">
            Κατάσταση
          </label>
          <select
            id="filter-status"
            className={selectClass}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "all" | MessageStatus)}
          >
            <option value="all">ΟΛΕΣ ΟΙ ΚΑΤΑΣΤΑΣΕΙΣ</option>
            <option value="new">ΝΕΑ</option>
            <option value="in_progress">ΣΕ ΕΞΕΛΙΞΗ</option>
            <option value="handled">ΟΛΟΚΛΗΡΩΜΕΝΑ</option>
            <option value="archived">ΑΡΧΕΙΟ</option>
          </select>

          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg border border-white/15 px-4 py-2 text-xs uppercase tracking-[0.15em] text-neutral-300 transition-colors hover:border-white/40 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          >
            Ανανέωση
          </button>
        </div>
      </header>

      {error && (
        <p role="alert" className="mt-6 rounded-lg border border-white/15 bg-[#111111] px-4 py-3 text-xs text-neutral-300">
          {error}
        </p>
      )}

      {loading ? (
        <div className="mt-10 space-y-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-white/10 bg-[#0A0A0A] p-10 text-center">
          <p className="text-sm text-neutral-400">Δεν υπάρχουν καταχωρήσεις με αυτά τα φίλτρα.</p>
        </div>
      ) : (
        <ul className="mt-10 space-y-3">
          {visible.map((row) => (
            <li
              key={row.id}
              className="rounded-2xl border border-white/10 bg-[#0A0A0A] p-5 transition-colors hover:border-white/20"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-white/15 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.2em] text-neutral-300">
                      {row.kind === "appointment" ? "ΡΑΝΤΕΒΟΥ" : "ΜΗΝΥΜΑ"}
                    </span>
                    <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-600">
                      {STATUS_LABEL[row.status]}
                    </span>
                  </div>
                  <p className="mt-3 text-base font-medium text-neutral-100">{row.full_name}</p>
                  <p className="mt-1 break-all text-xs text-neutral-500">
                    <a className="hover:text-neutral-300" href={`mailto:${row.email}`}>
                      {row.email}
                    </a>
                    {row.phone && (
                      <>
                        {" · "}
                        <a className="hover:text-neutral-300" href={`tel:${row.phone}`}>
                          {row.phone}
                        </a>
                      </>
                    )}
                  </p>
                </div>

                <div className="text-right text-[11px] uppercase tracking-[0.15em] text-neutral-600">
                  <p>ΕΛΗΦΘΗ {formatDate(row.created_at)}</p>
                  {row.kind === "appointment" && <p className="mt-1">ΓΙΑ {formatDate(row.preferred_at)}</p>}
                </div>
              </div>

              <p className="mt-4 whitespace-pre-wrap border-t border-white/5 pt-4 text-sm leading-relaxed text-neutral-400">
                {row.message}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {(["new", "in_progress", "handled", "archived"] as MessageStatus[])
                  .filter((status) => status !== row.status)
                  .map((status) => (
                    <button
                      key={status}
                      type="button"
                      disabled={savingId === row.id}
                      onClick={() => void updateStatus(row.id, status)}
                      className="rounded-full border border-white/10 px-4 py-1.5 text-[10px] uppercase tracking-[0.2em] text-neutral-400 transition-colors hover:border-white/35 hover:text-white disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                    >
                      {STATUS_LABEL[status]}
                    </button>
                  ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}