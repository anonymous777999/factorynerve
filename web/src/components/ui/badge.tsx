import * as React from "react";

import { cn } from "@/lib/utils";

export type BadgeStatus =
  | "success"
  | "warning"
  | "info"
  | "secondary"
  | "destructive"
  | "processing"
  | "paused"
  | "draft"
  | "synced"
  | "error";

export type BadgeSize = "compact" | "standard";

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  status?: BadgeStatus;
  size?: BadgeSize;
  showIndicator?: boolean;
  monospace?: boolean;
};

const baseClassName =
  "ui-no-select ui-no-callout inline-flex max-w-full items-center rounded-badge border font-medium";

const sizeClassNames: Record<BadgeSize, string> = {
  compact: "px-2 py-0.5 text-[11px]",
  standard: "px-2.5 py-1 text-[12px]",
};

const statusClassNames: Record<BadgeStatus, string> = {
  success: "border-status-success-border bg-status-success-bg text-status-success-fg",
  warning: "border-status-warning-border bg-status-warning-bg text-status-warning-fg",
  info: "border-status-processing-border bg-status-processing-bg text-status-processing-fg",
  secondary: "border-status-draft-border bg-status-draft-bg text-status-draft-fg",
  destructive: "border-status-danger-border bg-status-danger-bg text-status-danger-fg",
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
  info: "bg-status-processing-icon",
  secondary: "bg-status-draft-icon",
  destructive: "bg-status-danger-icon",
  processing: "bg-status-processing-icon",
  paused: "bg-status-paused-icon",
  draft: "bg-status-draft-icon",
  synced: "bg-status-synced-icon",
  error: "bg-status-danger-icon",
};

export function Badge({
  children,
  className,
  monospace = false,
  showIndicator = false,
  size = "standard",
  status = "draft",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        baseClassName,
        sizeClassNames[size],
        statusClassNames[status],
        monospace ? "font-mono tabular-nums" : "",
        className,
      )}
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
