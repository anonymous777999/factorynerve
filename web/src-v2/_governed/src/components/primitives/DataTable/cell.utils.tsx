import type { ReactNode } from "react";
import { cx } from "../../../../lib/utils";
import type { DataTableCellTone } from "../../../../types/datatable";
import {
  DATA_TABLE_CELL_BADGE_CLASSNAME,
  DATA_TABLE_CELL_TONE_BADGE_CLASSNAME,
} from "./cell.tokens";

export function getSemanticCellToneClassName(tone: DataTableCellTone) {
  return DATA_TABLE_CELL_TONE_BADGE_CLASSNAME[tone];
}

export function renderCellBadge(label: ReactNode, tone: DataTableCellTone, className?: string) {
  return (
    <span className={cx(DATA_TABLE_CELL_BADGE_CLASSNAME, DATA_TABLE_CELL_TONE_BADGE_CLASSNAME[tone], className)}>
      {label}
    </span>
  );
}

export function getMetricTextClassName(tone: DataTableCellTone = "neutral") {
  switch (tone) {
    case "ai":
      return "text-[var(--color-accent-ai-muted)]";
    case "critical":
      return "text-[var(--color-status-critical-text)]";
    case "success":
      return "text-[var(--color-status-ok-text)]";
    case "warning":
      return "text-[var(--color-status-warning-text)]";
    case "muted":
      return "text-[var(--color-text-muted)]";
    case "default":
    case "neutral":
    default:
      return "text-[var(--color-text-secondary)]";
  }
}

export function getProgressToneClassName(tone: DataTableCellTone = "neutral") {
  switch (tone) {
    case "ai":
      return "bg-[var(--color-accent-ai-border)]";
    case "critical":
      return "bg-[var(--color-status-critical)]";
    case "success":
      return "bg-[var(--color-status-ok)]";
    case "warning":
      return "bg-[var(--color-status-warning)]";
    case "muted":
      return "bg-[var(--color-border-strong)]";
    case "default":
    case "neutral":
    default:
      return "bg-[var(--color-text-tertiary)]";
  }
}
