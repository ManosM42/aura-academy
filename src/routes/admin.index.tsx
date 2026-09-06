import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import {
  getAdminOverview,
  getAllProfiles,
  getAuditLog,
  getMyProfile,
  updateUserRole,
  updateUserStatus,
} from "@/lib/queries";
import { hasAtLeastRole, isAdminRole } from "@/lib/roles";
import { useAsync } from "@/lib/useAsync";
import { ErrorState, LoadingSkeleton, LockedState } from "@/components/aura/States";
import type { AccountStatus, Profile, UserRole } from "@/lib/database.types";
import { ShieldAlert, Users as UsersIcon, Activity, BookOpen, Inbox, CheckSquare, GraduationCap, RefreshCw, AlertCircle, Shield } from "lucide-react";

export const Route = createFileRoute("/admin/")({ component: AdminPage });

const ROLES: UserRole[] = [
  "student",
  "educator",
  "senior_educator",
  "content_manager",
  "operations",
  "admin",
  "super_admin",
];

const STATUSES: AccountStatus[] = ["active", "suspended", "deleted"];

function AdminPage() {
  const profile = useAsync(getMyProfile, []);
  const role = profile.data?.role ?? null;

  const admin = isAdminRole(role);
  const superAdmin = hasAtLeastRole(role, "super_admin");

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 sm:px-6 md:px-10 pb-20 pt-28 text-white relative selection:bg-white selection:text-black">
      {/* Ambient background blur */}
      <div className="absolute top-24 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-white/[0.03] blur-[140px] pointer-events-none rounded-full" />

      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 space-y-12"
      >
        <header className="border-b border-white/10 pb-6">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-white/50 mb-2">
            <span className="h-px w-8 bg-gradient-to-r from-white/60 to-transparent" />
            Control Room
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold uppercase tracking-tight">Admin Panel</h1>
          <p className="mt-2 text-sm text-white/50 max-w-2xl leading-relaxed">
            Πρόσβαση μόνο για λογαριασμούς admin και πάνω. Οι αλλαγές ρόλων και status καταγράφονται
            στο audit log.
          </p>
        </header>

        {profile.loading && <LoadingSkeleton rows={3} />}
        {profile.error && <ErrorState message={profile.error} />}

        {profile.data && !admin && (
          <LockedState reason="Αυτή η περιοχή είναι μόνο για admins της AURA." />
        )}

        {profile.data && admin && (
          <div className="space-y-12">
            <OverviewSection />
            <UsersSection selfId={profile.data.id} canEditAdmins={superAdmin} />
            <AuditSection />
          </div>
        )}
      </motion.div>
    </main>
  );
}

/* ---------------- Overview ---------------- */

function OverviewSection() {
  const { data, error, loading } = useAsync(getAdminOverview, []);

  return (
    <section className="space-y-6">
      <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-white/60 flex items-center gap-2 px-1">
        <span className="size-1.5 rounded-full bg-white/60" />
        Επισκόπηση
      </h2>

      {loading && <LoadingSkeleton rows={1} />}
      {error && <ErrorState message={error} />}

      {data && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
          <Stat label="Χρήστες" value={data.totalUsers} icon={<UsersIcon className="size-5 text-white/70" />} />
          <Stat label="Students" value={data.students} icon={<GraduationCap className="size-5 text-white/70" />} />
          <Stat label="Team" value={data.staff} icon={<Shield className="size-5 text-white/70" />} />
          <Stat label="Εκκρεμείς reviews" value={data.pendingReviews} icon={<Activity className="size-5 text-white/70" />} />
          <Stat label="Published courses" value={data.publishedCourses} icon={<BookOpen className="size-5 text-white/70" />} />
        </div>
      )}

      <div className="flex flex-wrap gap-3 pt-2">
        <QuickLink to="/admin/courses" label="Course Management" icon={<BookOpen className="size-4" />} />
        <QuickLink to="/admin/inbox" label="Inbox" icon={<Inbox className="size-4" />} />
        <QuickLink to="/review" label="Review Queue" icon={<CheckSquare className="size-4" />} />
        <QuickLink to="/academy" label="Academy" icon={<GraduationCap className="size-4" />} />
      </div>
    </section>
  );
}

function Stat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <motion.div 
      whileHover={{ y: -3 }}
      transition={{ duration: 0.2 }}
      className="group relative overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-b from-white/[0.06] to-white/[0.01] p-6 backdrop-blur-xl shadow-[0_4px_20px_rgba(0,0,0,0.5)] transition-all hover:border-white/40 hover:shadow-[0_0_25px_rgba(255,255,255,0.06)]"
    >
      <div className="absolute top-0 right-0 p-6 opacity-40 transition-opacity group-hover:opacity-80">
        {icon}
      </div>
      <p className="text-xs uppercase tracking-[0.2em] text-white/50">{label}</p>
      <p className="mt-3 text-3xl font-bold tracking-tight text-white">{value}</p>
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
    </motion.div>
  );
}

function QuickLink({ to, label, icon }: { to: string; label: string; icon: React.ReactNode }) {
  return (
    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
      <Link
        to={to}
        className="group flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white/90 transition-all duration-300 hover:border-white/40 hover:bg-white hover:text-black hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]"
      >
        {icon}
        <span>{label}</span>
      </Link>
    </motion.div>
  );
}

/* ---------------- Users ---------------- */

function UsersSection({ selfId, canEditAdmins }: { selfId: string; canEditAdmins: boolean }) {
  const [reload, setReload] = useState(0);
  const { data, error, loading } = useAsync(getAllProfiles, [reload]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  function isLocked(user: Profile): boolean {
    if (canEditAdmins) return false;
    return isAdminRole(user.role) && user.id !== selfId;
  }

  async function changeRole(user: Profile, role: UserRole) {
    if (role === user.role) return;
    if (user.id === selfId && !window.confirm("Αλλάζεις τον ΔΙΚΟ σου ρόλο. Σίγουρα;")) return;
    if (!canEditAdmins && isAdminRole(role)) {
      setMsg("Μόνο super_admin μπορεί να δώσει admin-tier ρόλο.");
      return;
    }

    setBusyId(user.id);
    setMsg(null);
    try {
      await updateUserRole(user.id, role);
      setMsg(`Ο ρόλος του ${user.full_name ?? "χρήστη"} έγινε ${role}.`);
      setReload((n) => n + 1);
    } catch (e) {
      setMsg("Αποτυχία: " + (e instanceof Error ? e.message : "άγνωστο σφάλμα"));
    } finally {
      setBusyId(null);
    }
  }

  async function changeStatus(user: Profile, status: AccountStatus) {
    if (status === user.status) return;
    if (
      user.id === selfId &&
      status !== "active" &&
      !window.confirm("Απενεργοποιείς τον ΔΙΚΟ σου λογαριασμό. Σίγουρα;")
    ) {
      return;
    }

    setBusyId(user.id);
    setMsg(null);
    try {
      await updateUserStatus(user.id, status);
      setMsg(`Το status του ${user.full_name ?? "χρήστη"} έγινε ${status}.`);
      setReload((n) => n + 1);
    } catch (e) {
      setMsg("Αποτυχία: " + (e instanceof Error ? e.message : "άγνωστο σφάλμα"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4 px-1">
        <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-white/60 flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-white/60" />
          Χρήστες
        </h2>
        <button
          type="button"
          onClick={() => setReload((n) => n + 1)}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/15 hover:border-white/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:opacity-50 cursor-pointer shadow-inner"
        >
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Ανανέωση</span>
        </button>
      </div>

      {msg && (
        <div className="p-4 rounded-2xl bg-zinc-950/80 border border-white/10 text-zinc-300 text-sm flex items-center gap-3 backdrop-blur-xl shadow-lg" role="status">
          <AlertCircle className="w-5 h-5 text-white/70 shrink-0" />
          <span>{msg}</span>
        </div>
      )}

      {loading && <LoadingSkeleton rows={4} />}
      {error && <ErrorState message={error} />}

      {data && (
        <div className="overflow-x-auto rounded-3xl border border-white/10 bg-zinc-950/80 shadow-[0_0_40px_-10px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase tracking-wider text-white/50 border-b border-white/10">
              <tr>
                <th scope="col" className="p-4 font-semibold">
                  Χρήστης
                </th>
                <th scope="col" className="p-4 font-semibold">
                  Level
                </th>
                <th scope="col" className="p-4 font-semibold">
                  Ρόλος
                </th>
                <th scope="col" className="p-4 font-semibold">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.map((u) => {
                const locked = isLocked(u);
                const busy = busyId === u.id;
                return (
                  <tr key={u.id} className="align-middle hover:bg-white/[0.02] transition-colors">
                    <td className="p-4">
                      <p className="font-medium text-white/90">
                        {u.full_name ?? "—"}
                        {u.id === selfId && (
                          <span className="ml-2 rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/80">
                            εσύ
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-white/40 mt-0.5 font-mono">{u.country ?? "—"}</p>
                    </td>
                    <td className="p-4 text-white/70 font-mono">{u.level}</td>
                    <td className="p-4">
                      {locked ? (
                        <span className="text-white/70 font-mono text-xs">{u.role}</span>
                      ) : (
                        <>
                          <label className="sr-only" htmlFor={`role-${u.id}`}>
                            Ρόλος για {u.full_name ?? "χρήστη"}
                          </label>
                          <select
                            id={`role-${u.id}`}
                            value={u.role}
                            disabled={busy}
                            onChange={(e) => changeRole(u, e.target.value as UserRole)}
                            className="rounded-xl border border-white/15 bg-black/60 px-3 py-2 text-xs text-white/90 outline-none focus:border-white/40 focus:ring-2 focus:ring-white/10 disabled:opacity-50 transition-all"
                          >
                            {ROLES.map((r) => (
                              <option key={r} value={r} className="bg-zinc-900 text-white">
                                {r}
                              </option>
                            ))}
                          </select>
                        </>
                      )}
                    </td>
                    <td className="p-4">
                      {locked ? (
                        <StatusBadge status={u.status} />
                      ) : (
                        <>
                          <label className="sr-only" htmlFor={`status-${u.id}`}>
                            Status για {u.full_name ?? "χρήστη"}
                          </label>
                          <select
                            id={`status-${u.id}`}
                            value={u.status}
                            disabled={busy}
                            onChange={(e) => changeStatus(u, e.target.value as AccountStatus)}
                            className="rounded-xl border border-white/15 bg-black/60 px-3 py-2 text-xs text-white/90 outline-none focus:border-white/40 focus:ring-2 focus:ring-white/10 disabled:opacity-50 transition-all"
                          >
                            {STATUSES.map((s) => (
                              <option key={s} value={s} className="bg-zinc-900 text-white">
                                {s}
                              </option>
                            ))}
                          </select>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
              {data.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-white/40">
                    Κανένας χρήστης.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function StatusBadge({ status }: { status: AccountStatus }) {
  const map: Record<AccountStatus, string> = {
    active: "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300",
    suspended: "bg-amber-500/15 border border-amber-500/30 text-amber-300",
    deleted: "bg-red-500/15 border border-red-500/30 text-red-300",
  };
  return <span className={`rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wider ${map[status]}`}>{status}</span>;
}

/* ---------------- Audit log ---------------- */

function AuditSection() {
  const { data, error, loading } = useAsync(() => getAuditLog(50), []);

  return (
    <section className="space-y-4">
      <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-white/60 flex items-center gap-2 px-1">
        <span className="size-1.5 rounded-full bg-white/60" />
        Audit Log
      </h2>

      {loading && <LoadingSkeleton rows={3} />}
      {error && <ErrorState message={error} />}

      {data && data.length === 0 && <p className="text-sm text-white/40 px-1">Καμία καταγραφή ακόμη.</p>}

      {data && data.length > 0 && (
        <ul className="divide-y divide-white/5 rounded-3xl border border-white/10 bg-zinc-950/80 shadow-[0_0_40px_-10px_rgba(0,0,0,0.9)] backdrop-blur-xl overflow-hidden">
          {data.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4 text-sm hover:bg-white/[0.02] transition-colors">
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-mono font-medium text-white/80">
                {entry.action}
              </span>
              <span className="text-white/60 font-medium">{entry.entity}</span>
              <time
                dateTime={entry.created_at}
                className="ml-auto text-xs text-white/40 font-mono"
              >
                {new Date(entry.created_at).toLocaleString("el-GR")}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}