// src/components/aura/OnlineUsersPanel.tsx
import { useMemo, useState } from "react";
import { Circle, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { useOnlinePresence, type PresenceUser } from "@/lib/usePresence";
import { isAdminRole } from "@/lib/roles";
import UserProfileModal from "@/components/aura/UserProfileModal";

export default function OnlineUsersPanel() {
  const { profile } = useAuth();
  const onlineUsers = useOnlinePresence(
    profile
      ? {
          id: profile.id,
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
          role: profile.role,
        }
      : null,
  );
  const [openUserId, setOpenUserId] = useState<string | null>(null);

  const { admins, students } = useMemo(() => {
    const admins = onlineUsers.filter((u) => isAdminRole(u.role));
    const students = onlineUsers.filter((u) => !isAdminRole(u.role));
    return { admins, students };
  }, [onlineUsers]);

  return (
    <>
      <aside className="hidden lg:sticky lg:top-28 lg:flex lg:h-[calc(100vh-8rem)] w-72 shrink-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-xl">
        <div className="border-b border-white/10 px-5 py-4">
          <p className="text-xs uppercase tracking-[0.25em] text-white/50">
            Online τώρα
          </p>
          <p className="mt-1 text-sm text-white/40">
            {onlineUsers.length} συνδεδεμένοι
          </p>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
          {admins.length > 0 && (
            <div>
              <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
                Admins
              </p>
              <div className="space-y-1">
                {admins.map((u) => (
                  <UserRow
                    key={u.id}
                    user={u}
                    isAdmin
                    onClick={() => setOpenUserId(u.id)}
                  />
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
              Μαθητές
            </p>
            <div className="space-y-1">
              {students.length === 0 && (
                <p className="px-2 text-xs text-white/30">Κανείς online.</p>
              )}
              {students.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  isAdmin={false}
                  onClick={() => setOpenUserId(u.id)}
                />
              ))}
            </div>
          </div>
        </div>
      </aside>

      {openUserId && (
        <UserProfileModal
          userId={openUserId}
          onClose={() => setOpenUserId(null)}
        />
      )}
    </>
  );
}

function UserRow({
  user,
  isAdmin,
  onClick,
}: {
  user: PresenceUser;
  isAdmin: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-white/[0.06]"
    >
      <div className="relative shrink-0">
        {user.avatar_url ? (
          <img
            src={user.avatar_url}
            alt=""
            className="h-9 w-9 rounded-full object-cover ring-1 ring-white/15"
          />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white/70">
            {user.full_name?.[0]?.toUpperCase() ?? "?"}
          </div>
        )}
        <Circle
          size={10}
          className="absolute -bottom-0.5 -right-0.5 rounded-full fill-emerald-400 text-emerald-400 ring-2 ring-[#070707]"
        />
      </div>
      <span className="min-w-0 flex-1 truncate text-sm text-white/85">
        {user.full_name ?? "Χρήστης"}
      </span>
      {isAdmin && <ShieldCheck size={15} className="shrink-0 text-white/70" />}
    </button>
  );
}