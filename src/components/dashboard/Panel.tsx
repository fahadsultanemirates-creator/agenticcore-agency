import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Loading, failed, empty and loaded, handled once.
 *
 * These are genuinely four different states and the one that gets
 * skipped is always `failed`, which then renders as `empty`. "Nothing
 * here yet" and "we could not load it" look identical to a client and
 * mean opposite things — one of them has to offer a retry.
 */
export function Panel({
  loading,
  failed,
  reload,
  empty,
  emptyIcon: EmptyIcon,
  emptyText,
  children,
}: {
  loading: boolean;
  failed: boolean;
  reload: () => void;
  empty: boolean;
  emptyIcon: LucideIcon;
  emptyText: ReactNode;
  children: ReactNode;
}) {
  if (loading) {
    return (
      <p className="mt-5 rounded-2xl border border-dashed border-border bg-surface p-6 text-sm text-fg-faint">
        Loading…
      </p>
    );
  }
  if (failed) {
    return (
      <div className="mt-5 rounded-2xl border border-dashed border-border bg-surface p-6">
        <p className="text-sm text-fg-muted">We couldn't load this just now.</p>
        <button
          type="button"
          onClick={reload}
          className="mt-3 text-sm font-semibold text-cyan-400 hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }
  if (empty) {
    return (
      <div className="mt-5 rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
        <EmptyIcon className="mx-auto h-8 w-8 text-fg-faint" />
        <div className="mt-3 text-sm text-fg-muted">{emptyText}</div>
      </div>
    );
  }
  return <>{children}</>;
}
