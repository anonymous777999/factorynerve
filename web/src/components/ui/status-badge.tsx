import * as React from "react";

import { Badge, type BadgeProps, type BadgeStatus } from "@/components/ui/badge";

export type StatusBadgeTone =
  | "default"
  | "success"
  | "warning"
  | "error"
  | "processing"
  | "paused"
  | "synced"
  | "approval"
  | "reconciliation";

export type StatusBadgeProps = Omit<BadgeProps, "status"> & {
  tone?: StatusBadgeTone;
};

const toneToStatus: Record<StatusBadgeTone, BadgeStatus> = {
  default: "draft",
  success: "success",
  warning: "warning",
  error: "error",
  processing: "processing",
  paused: "paused",
  synced: "synced",
  approval: "info",
  reconciliation: "warning",
};

export function StatusBadge({
  children,
  tone = "default",
  showIndicator = true,
  ...props
}: StatusBadgeProps) {
  return (
    <Badge status={toneToStatus[tone]} showIndicator={showIndicator} {...props}>
      {children}
    </Badge>
  );
}
