// src/lib/usePresence.ts
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/database.types";

export interface PresenceUser {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
}

const CHANNEL_NAME = "academy-online-users";

/**
 * Δείχνει ποιοι είναι online ΤΩΡΑ, μέσω Supabase Realtime Presence.
 * Δεν γράφει τίποτα στη βάση — μηδενικό storage cost, καθαρίζεται
 * αυτόματα μόλις κάποιος κλείσει το tab / αποσυνδεθεί.
 */
export function useOnlinePresence(
  me: Pick<Profile, "id" | "full_name" | "avatar_url" | "role"> | null,
): PresenceUser[] {
  const [users, setUsers] = useState<PresenceUser[]>([]);

  useEffect(() => {
    if (!me) {
      setUsers([]);
      return;
    }

    const channel = supabase.channel(CHANNEL_NAME, {
      config: { presence: { key: me.id } },
    });

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<PresenceUser>();
      const flat = Object.values(state)
        .map((presences) => presences[0])
        .filter(Boolean) as unknown as PresenceUser[];
      setUsers(flat);
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          id: me.id,
          full_name: me.full_name,
          avatar_url: me.avatar_url,
          role: me.role,
        });
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id, me?.full_name, me?.avatar_url, me?.role]);

  return users;
}