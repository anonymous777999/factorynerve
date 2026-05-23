import * as React from "react";

import type { BadgeStatus } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type EmptyStateProps = React.HTMLAttributes<HTMLDivElement> & {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  status?: BadgeStatus;
  statusLabel?: string;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
};

export function EmptyState({
  action,
  children,
  className,
  description,
  icon,
  secondaryAction,
  title,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-panel border border-border-subtle bg-surface-panel px-lg py-16 text-center",
        className,
      )}
      {...props}
    >
      {icon ? <div className="text-text-secondary">{icon}</div> : null}
      <div className="space-y-sm">
        <p className="text-panel-title font-semibold text-text-primary">{title}</p>
        {description ? <p className="mx-auto max-w-2xl text-body text-text-secondary">{description}</p> : null}
      </div>
      {children ? <div className="max-w-2xl text-body text-text-secondary">{children}</div> : null}
      {action || secondaryAction ? (
        <div className="flex flex-wrap items-center justify-center gap-sm">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}
