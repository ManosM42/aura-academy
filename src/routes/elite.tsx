// src/routes/community.tsx
import { lazy, Suspense, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Loader2 } from "lucide-react";
import { db } from "@/lib/db";
import  EliteLocked  from "@/components/aura/elite/EliteLocked";

// Chat code (and its heavy CSS) only downloads for Elite members.
const EliteCommunity = lazy(() => import("@/components/aura/elite/EliteCommunity"));

const sb = db as unknown as SupabaseClient;

export const Route = createFileRoute("/elite")({
  head: () => ({ meta: [{ title: "AURA Elite Community" }] }),
  component: CommunityPage,
});

type Gate =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "locked" }
  | { status: "elite"; id: string; name: string };

function CommunityPage() {
  const [gate, setGate] = useState<Gate>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const { data } = await sb.auth.getSession();
      const user = data.session?.user;
      if (cancelled) return;
      if (!user) {
        setGate({ status: "signed-out" });
        return;
      }

      // Server-side truth: the same function every RLS policy uses.
      const { data: isElite, error } = await sb.rpc("is_elite_member");
      if (cancelled) return;

      if (error || isElite !== true) {
        setGate({ status: "locked" });
        return;
      }

      const meta = (user.user_metadata ?? {}) as { full_name?: string; name?: string };
      setGate({
        status: "elite",
        id: user.id,
        name: meta.full_name || meta.name || user.email?.split("@")[0] || "Member",
      });
    };

    void check();

    // Re-check on login/logout/token refresh (e.g. plan changed in another tab).
    const { data: sub } = sb.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") void check();
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (gate.status === "loading") {
    return (
      <div className="fixed inset-0 z-10 grid place-items-center bg-[#050505] text-white/60">
        <Loader2 className="size-6 animate-spin" aria-label="Loading" />
      </div>
    );
  }

  if (gate.status === "signed-out") return <EliteLocked signedOut />;
  if (gate.status === "locked") return <EliteLocked />;

  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 z-10 grid place-items-center bg-[#050505] text-white/60">
          <Loader2 className="size-6 animate-spin" aria-label="Loading" />
        </div>
      }
    >
      {/* key = user id so the chat fully resets if the account changes */}
      <EliteCommunity key={gate.id} meId={gate.id} meName={gate.name} />
    </Suspense>
  );
}