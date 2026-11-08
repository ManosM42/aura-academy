// src/routes/find-job.tsx
import { lazy, Suspense, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { sb } from "@/lib/jobs";
import JobsLocked from "@/components/aura/jobs/JobsLocked";

// The listings UI only downloads for users who are allowed to see it.
const FindJob = lazy(() => import("@/components/aura/jobs/FindJob"));

export const Route = createFileRoute("/find-job")({
  head: () => ({ meta: [{ title: "Find Job with ΛURΛ" }] }),
  component: FindJobPage,
});

type Gate =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "locked" }
  | { status: "ok"; id: string; name: string; email: string };

function Spinner() {
  return (
    <div className="fixed inset-0 z-10 grid place-items-center bg-[#050505] text-white/60">
      <Loader2 className="size-6 animate-spin" aria-label="Loading" />
    </div>
  );
}

function FindJobPage() {
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

      // Server-side truth: any active paid plan (or admin). The same function the RLS policy uses.
      const { data: allowed, error } = await sb.rpc("has_paid_plan");
      if (cancelled) return;
      if (error || allowed !== true) {
        setGate({ status: "locked" });
        return;
      }

      const meta = (user.user_metadata ?? {}) as { full_name?: string; name?: string };
      const email = user.email ?? "";
      setGate({
        status: "ok",
        id: user.id,
        email,
        name: meta.full_name || meta.name || email.split("@")[0] || "Student",
      });
    };

    void check();

    // Re-check on login / logout / token refresh (e.g. a plan was upgraded in another tab).
    const { data: sub } = sb.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") void check();
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (gate.status === "loading") return <Spinner />;
  if (gate.status === "signed-out") return <JobsLocked signedOut />;
  if (gate.status === "locked") return <JobsLocked />;

  return (
    <Suspense fallback={<Spinner />}>
      <FindJob key={gate.id} applicant={{ name: gate.name, email: gate.email }} />
    </Suspense>
  );
}