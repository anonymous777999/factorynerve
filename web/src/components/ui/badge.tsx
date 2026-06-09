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
  "ui-no-select ui-no-callout inline-flex max-w-full items-center whitespace-nowrap rounded-[4px] border text-[length:var(--text-xs)] font-medium tracking-[var(--tracking-wide)]";

const sizeClassNames: Record<BadgeSize, string> = {
  compact: "px-[8px] py-[2px]",
  standard: "px-[8px] py-[2px]",
};

const statusClassNames: Record<BadgeStatus, string> = {
  success: "border-status-success-border bg-status-success-bg text-status-success-fg",
  warning: "border-status-warning-border bg-status-warning-bg text-status-warning-fg",
  info: "border-status-processing-border bg-status-processing-bg text-status-processing-fg",
  secondary: "border-status-inactive-border bg-status-inactive-bg text-status-inactive-fg",
  destructive: "border-status-danger-border border-l-[3px] bg-status-danger-bg pl-[6px] pr-[8px] text-status-danger-fg",
  processing:
    "border-status-processing-border bg-status-processing-bg text-status-processing-fg",
  paused: "border-status-paused-border bg-status-paused-bg text-status-paused-fg",
  draft: "border-status-inactive-border bg-status-inactive-bg text-status-inactive-fg",
  synced: "border-status-success-border bg-status-success-bg text-status-success-fg",
  error: "border-status-danger-border border-l-[3px] bg-status-danger-bg pl-[6px] pr-[8px] text-status-danger-fg",
};

const indicatorClassNames: Record<BadgeStatus, string> = {
  success: "bg-status-success-icon",
  warning: "bg-status-warning-icon",
  info: "bg-status-processing-icon",
  secondary: "bg-status-inactive-icon",
  destructive: "bg-status-danger-icon",
  processing: "bg-status-processing-icon",
  paused: "bg-status-paused-icon",
  draft: "bg-status-inactive-icon",
  synced: "bg-status-success-icon",
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
      {children ? <span className={cn("truncate", showIndicator ? "ml-1.5" : "")}>{children}</span> : null}
    </span>
  );
}
