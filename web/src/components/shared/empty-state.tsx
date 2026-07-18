import * as React from "react";

import { cn } from "@/lib/utils";

type EmptyStateProps = {
  /** Short single-line message (back-compat with the local `EmptyState({message})`). */
  message?: React.ReactNode;
  title?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
};

/**
 * Shared dashed-border empty state. Replaces the 7 identical local copies. The
 * `message`-only shape matches the old signature exactly; `title`/`icon`/`action`
 * are optional enhancements.
 */
export function EmptyState({
  message,
  title,
  icon,
  action,
  className,
  children,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[var(--border)] px-4 py-8 text-center",
        className,
      )}
    >
      {icon ? <div className="text-[var(--muted)]">{icon}</div> : null}
      {title ? (
        <div className="text-base font-semibold text-[var(--text)]">{title}</div>
      ) : null}
      {message ? (
        <div className="text-sm text-[var(--muted)]">{message}</div>
      ) : null}
      {children}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
