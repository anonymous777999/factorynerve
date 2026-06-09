import * as React from "react";

import { StickyActionBar, type StickyActionBarProps } from "@/components/ui/sticky-action-bar";
import type { StatusBadgeTone } from "@/components/ui/status-badge";

type ActionDockStatusTone = Exclude<StatusBadgeTone, "approval" | "reconciliation">;

export type ActionDockProps = Omit<StickyActionBarProps, "status"> & {
  tone?: ActionDockStatusTone;
};

const toneToStatus: Record<ActionDockStatusTone, NonNullable<StickyActionBarProps["status"]>> = {
  default: "draft",
  success: "success",
  warning: "warning",
  error: "error",
  processing: "processing",
  paused: "paused",
  synced: "synced",
};

export function ActionDock({ tone = "default", ...props }: ActionDockProps) {
  return <StickyActionBar status={toneToStatus[tone]} {...props} />;
}
