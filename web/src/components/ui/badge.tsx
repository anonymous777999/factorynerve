import * as React from "react";

import { cn } from "@/lib/utils";

export type BadgeStatus =
  | "success"
  | "warning"
  | "processing"
  | "paused"
  | "draft"
  | "synced"
  | "error";

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  status?: BadgeStatus;
  showIndicator?: boolean;
};

const baseClassName =
  "ui-no-select ui-no-callout inline-flex max-w-full items-center gap-xs rounded-badge border px-badge-x py-badge-y text-status font-medium";

const statusClassNames: Record<BadgeStatus, string> = {
  success: "border-status-success-border bg-status-success-bg text-status-success-fg",
  warning: "border-status-warning-border bg-status-warning-bg text-status-warning-fg",
  processing:
    "border-status-processing-border bg-status-processing-bg text-status-processing-fg",
  paused: "border-status-paused-border bg-status-paused-bg text-status-paused-fg",
  draft: "border-status-draft-border bg-status-draft-bg text-status-draft-fg",
  synced: "border-status-synced-border bg-status-synced-bg text-status-synced-fg",
  error: "border-status-danger-border bg-status-danger-bg text-status-danger-fg",
};

const indicatorClassNames: Record<BadgeStatus, string> = {
  success: "bg-status-success-icon",
  warning: "bg-status-warning-icon",
  processing: "bg-status-processing-icon",
  paused: "bg-status-paused-icon",
  draft: "bg-status-draft-icon",
  synced: "bg-status-synced-icon",
  error: "bg-status-danger-icon",
};

export function Badge({
  children,
  className,
  showIndicator = true,
  status = "draft",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(baseClassName, statusClassNames[status], className)}
      data-status={status}
      {...props}
    >
      {showIndicator ? (
        <span
          aria-hidden="true"
          className={cn("h-2 w-2 shrink-0 rounded-full", indicatorClassNames[status])}
        />
      ) : null}
      {children ? <span className="truncate">{children}</span> : null}
    </span>
  );
}
