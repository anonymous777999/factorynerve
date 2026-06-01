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
        "flex flex-col items-center justify-center rounded-panel bg-surface-panel py-12 px-6 text-center",
        className,
      )}
      {...props}
    >
      {icon ? (
        <div className="mb-4 text-text-tertiary [&_svg]:h-12 [&_svg]:w-12">{icon}</div>
      ) : null}
      <p className="mb-2 text-lg font-medium text-text-primary">{title}</p>
      {description ? (
        <p className="mx-auto max-w-[320px] text-md leading-relaxed text-text-secondary">
          {description}
        </p>
      ) : null}
      {children ? (
        <div className="mx-auto mt-2 max-w-[320px] text-md leading-relaxed text-text-secondary">
          {children}
        </div>
      ) : null}
      {action || secondaryAction ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-sm">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}
