import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  getAdminOverview,
  getAllProfiles,
  getAuditLog,
  getMyProfile,
  isAdminRole,
  isStaffRole,
  updateUserRole,
  updateUserStatus,
} from "@/lib/queries";
import { useAsync } from "@/lib/useAsync";
import {
  ErrorState,
  LoadingSkeleton,
  LockedState,
} from "@/components/aura/States";
import type {
  AccountStatus,
  Profile,
  UserRole,
} from "@/lib/database.types";

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
  const staff = profile.data ? isStaffRole(profile.data.role) : false;
  const admin = profile.data ? isAdminRole(profile.data.role) : false;

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12 text-white">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-[0.3em] text-white/40">
          Control Room
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Admin Panel</h1>
        <p className="mt-1 text-sm text-white/50">
          Founders, educators & admins. Η διαχείριση ρόλων είναι διαθέσιμη μόνο
          σε admin-tier λογαριασμούς.
        </p>
      </header>

      {profile.loading && <LoadingSkeleton rows={3} />}
      {profile.error && <ErrorState message={profile.error} />}

      {profile.data && !staff && (
        <LockedState reason="Αυτή η περιοχή είναι μόνο για το team της AURA." />
      )}

      {staff && (
        <div className="space-y-12">
          <OverviewSection />
          <UsersSection canEdit={admin} selfId={profile.data!.id} />
          {admin && <AuditSection />}
        </div>
      )}
    </main>
  );
}

/* ---------------- Overview ---------------- */

function OverviewSection() {
  const { data, error, loading } = useAsync(getAdminOverview, []);

  return (
    <section>
      <h2 className="mb-4 text-sm font-medium uppercase tracking-widest text-white/50">
        Επισκόπηση
      </h2>

      {loading && <LoadingSkeleton rows={1} />}
      {error && <ErrorState message={error} />}

      {data && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Stat label="Χρήστες" value={data.totalUsers} />
          <Stat label="Students" value={data.students} />
          <Stat label="Team" value={data.staff} />
          <Stat label="Εκκρεμείς reviews" value={data.pendingReviews} />
          <Stat label="Published courses" value={data.publishedCourses} />
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          to="/review"
          className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10"
        >
          → Review Queue
        </Link>
        <Link
          to="/academy"
          className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10"
        >
          → Academy
        </Link>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
      <p className="text-xs uppercase tracking-wide text-white/40">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

/* ---------------- Users ---------------- */

function UsersSection({
  canEdit,
  selfId,
}: {
  canEdit: boolean;
  selfId: string;
}) {
  const [reload, setReload] = useState(0);
  const { data, error, loading } = useAsync(getAllProfiles, [reload]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function changeRole(user: Profile, role: UserRole) {
    if (role === user.role) return;
    if (
      user.id === selfId &&
      !confirm("Αλλάζεις τον ΔΙΚΟ σου ρόλο. Σίγουρα;")
    ) {
      return;
    }
    setBusyId(user.id);
    setMsg(null);
    try {
      await updateUserRole(user.id, role);
      setMsg(`Ο ρόλος του ${user.full_name ?? "χρήστη"} έγινε ${role}.`);
      setReload((n) => n + 1);
    } catch (e) {
      setMsg("Αποτυχία: " + (e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function changeStatus(user: Profile, status: AccountStatus) {
    if (status === user.status) return;
    setBusyId(user.id);
    setMsg(null);
    try {
      await updateUserStatus(user.id, status);
      setMsg(`Το status του ${user.full_name ?? "χρήστη"} έγινε ${status}.`);
      setReload((n) => n + 1);
    } catch (e) {
      setMsg("Αποτυχία: " + (e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium uppercase tracking-widest text-white/50">
          Χρήστες
        </h2>
        <button
          onClick={() => setReload((n) => n + 1)}
          className="rounded-lg border border-white/15 px-3 py-1 text-xs text-white/70 transition hover:bg-white/10"
        >
          Ανανέωση
        </button>
      </div>

      {msg && (
        <p className="mb-3 text-sm text-white/70" role="status">
          {msg}
        </p>
      )}

      {loading && <LoadingSkeleton rows={4} />}
      {error && <ErrorState message={error} />}

      {data && (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-white/40">
              <tr>
                <th className="p-3 font-medium">Χρήστης</th>
                <th className="p-3 font-medium">Level</th>
                <th className="p-3 font-medium">Ρόλος</th>
                <th className="p-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.map((u) => (
                <tr key={u.id} className="align-middle">
                  <td className="p-3">
                    <p className="font-medium text-white/90">
                      {u.full_name ?? "—"}
                      {u.id === selfId && (
                        <span className="ml-2 rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/50">
                          εσύ
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-white/40">
                      {u.country ?? "—"}
                    </p>
                  </td>
                  <td className="p-3 text-white/70">{u.level}</td>
                  <td className="p-3">
                    {canEdit ? (
                      <select
                        value={u.role}
                        disabled={busyId === u.id}
                        onChange={(e) =>
                          changeRole(u, e.target.value as UserRole)
                        }
                        className="rounded-lg border border-white/10 bg-black/40 p-2 text-xs text-white/90 outline-none focus:border-white/30 disabled:opacity-50"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-white/70">{u.role}</span>
                    )}
                  </td>
                  <td className="p-3">
                    {canEdit ? (
                      <select
                        value={u.status}
                        disabled={busyId === u.id}
                        onChange={(e) =>
                          changeStatus(u, e.target.value as AccountStatus)
                        }
                        className="rounded-lg border border-white/10 bg-black/40 p-2 text-xs text-white/90 outline-none focus:border-white/30 disabled:opacity-50"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <StatusBadge status={u.status} />
                    )}
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-white/40">
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
    active: "bg-emerald-500/15 text-emerald-300",
    suspended: "bg-amber-500/15 text-amber-300",
    deleted: "bg-red-500/15 text-red-300",
  };
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs ${map[status]}`}>
      {status}
    </span>
  );
}

/* ---------------- Audit log ---------------- */

function AuditSection() {
  const { data, error, loading } = useAsync(() => getAuditLog(50), []);

  return (
    <section>
      <h2 className="mb-4 text-sm font-medium uppercase tracking-widest text-white/50">
        Audit log
      </h2>

      {loading && <LoadingSkeleton rows={3} />}
      {error && <ErrorState message={error} />}

      {data && data.length === 0 && (
        <p className="text-sm text-white/40">Καμία καταγραφή ακόμη.</p>
      )}

      {data && data.length > 0 && (
        <ul className="divide-y divide-white/5 rounded-xl border border-white/10 bg-white/[0.02]">
          {data.map((entry) => (
            <li key={entry.id} className="flex items-center gap-4 p-3 text-sm">
              <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-white/70">
                {entry.action}
              </span>
              <span className="text-white/50">{entry.entity}</span>
              <span className="ml-auto text-xs text-white/30">
                {new Date(entry.created_at).toLocaleString("el-GR")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}