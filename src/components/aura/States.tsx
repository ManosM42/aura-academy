import type { ReactNode } from "react";

export function LoadingSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Φόρτωση">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-24 w-full animate-pulse rounded-xl bg-white/5"
        />
      ))}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-red-500/30 bg-red-500/5 p-6 text-center"
    >
      <p className="text-sm text-red-300">Κάτι πήγε στραβά</p>
      <p className="mt-1 text-xs text-white/60">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 rounded-lg border border-white/15 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          Δοκίμασε ξανά
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-10 text-center">
      <p className="text-sm text-white/80">{title}</p>
      {hint && <p className="mt-1 text-xs text-white/50">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function LockedState({ reason }: { reason: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-10 text-center">
      <p className="text-sm text-white/70">🔒 Κλειδωμένο</p>
      <p className="mt-1 text-xs text-white/50">{reason}</p>
    </div>
  );
}