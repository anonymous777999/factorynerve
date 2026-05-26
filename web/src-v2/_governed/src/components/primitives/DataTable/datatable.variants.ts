import type { CSSProperties } from "react";
import type {
  DataTableAlignment,
  DataTableCellTone,
  DataTableLayoutMode,
  DataTableSectionTone,
  Density,
} from "../../../../types/datatable";
import { cx } from "../../../../lib/utils";
import { getInteractionClassName } from "../Interaction";

const DENSITY_ROW_HEIGHT: Record<Density, string> = {
  compact: "var(--table-row-compact)",
  default: "var(--table-row-default)",
  touch: "var(--table-row-touch)",
};

const DENSITY_CELL_PADDING: Record<Density, string> = {
  compact: "px-[var(--spacing-2)]",
  default: "px-[var(--spacing-3)]",
  touch: "px-[var(--spacing-4)]",
};

const ALIGNMENT_CLASSNAME: Record<DataTableAlignment, string> = {
  center: "text-center",
  left: "text-left",
  right: "text-right",
};

const SECTION_TONE_CLASSNAME: Record<DataTableSectionTone, string> = {
  ai: "data-[tone=ai]:bg-[color-mix(in_srgb,var(--color-accent-ai-surface)_72%,transparent)]",
  critical: "data-[tone=critical]:bg-[color-mix(in_srgb,var(--color-status-critical-surface)_72%,transparent)]",
  default: "",
  muted: "data-[tone=muted]:bg-[color-mix(in_srgb,var(--color-surface-primary)_72%,transparent)]",
  success: "data-[tone=success]:bg-[color-mix(in_srgb,var(--color-status-ok-surface)_72%,transparent)]",
  warning: "data-[tone=warning]:bg-[color-mix(in_srgb,var(--color-status-warning-surface)_72%,transparent)]",
};

const CELL_TONE_CLASSNAME: Record<DataTableCellTone, string> = {
  ai: "data-[cell-tone=ai]:text-[var(--color-accent-ai-muted)]",
  critical: "data-[cell-tone=critical]:text-[var(--color-status-critical-text)]",
  default: "",
  muted: "data-[cell-tone=muted]:text-[var(--color-text-muted)]",
  neutral: "data-[cell-tone=neutral]:text-[var(--color-text-secondary)]",
  success: "data-[cell-tone=success]:text-[var(--color-status-ok-text)]",
  warning: "data-[cell-tone=warning]:text-[var(--color-status-warning-text)]",
};

export function getDataTableStyle(density: Density) {
  return {
    "--table-row-height": DENSITY_ROW_HEIGHT[density],
  } as CSSProperties;
}

export function getDataTableRootClassName(layout: DataTableLayoutMode, striped: boolean, className?: string) {
  return cx(
    "fn-dt-table w-full border-collapse font-[var(--font-sans)] text-[var(--text-base)] text-[var(--table-cell-text)]",
    layout === "fixed" ? "table-fixed" : "table-auto",
    striped && "[&_tbody>tr:nth-child(even)]:bg-[color-mix(in_srgb,var(--table-row-bg)_85%,var(--color-surface-primary))]",
    className
  );
}

export function getDataTableHeaderClassName(sticky: boolean, className?: string) {
  return cx(
    "fn-dt-header [&_tr]:border-b [&_tr]:border-[var(--table-header-border)]",
    sticky && "[&_th]:sticky [&_th]:top-0 [&_th]:z-[var(--z-raised)]",
    className
  );
}

export function getDataTableBodyClassName(empty: boolean, className?: string) {
  return cx(empty && "opacity-80", className);
}

export function getDataTableRowClassName(interactive: boolean, className?: string) {
  return cx(
    "fn-dt-row h-[var(--table-row-height)] border-b border-[var(--table-row-border)] bg-[var(--table-row-bg)] text-[var(--table-cell-text)]",
    interactive && "cursor-default",
    getInteractionClassName({
      states: ["hover", "selected", "warning", "critical", "success", "ai-active", "pending", "reviewed", "disabled", "locked"],
      target: "row",
    }),
    className
  );
}

export function getDataTableCellClassName(
  density: Density,
  align: DataTableAlignment,
  mono: boolean,
  tone: DataTableCellTone,
  truncate: boolean,
  className?: string
) {
  return cx(
    "fn-dt-cell align-middle text-[var(--table-cell-text)] border-r border-[var(--color-border-subtle)] last:border-r-0",
    DENSITY_CELL_PADDING[density],
    ALIGNMENT_CLASSNAME[align],
    mono && "font-[var(--font-mono)] tabular-nums text-[var(--table-cell-text-mono)]",
    CELL_TONE_CLASSNAME[tone],
    truncate && "overflow-hidden",
    getInteractionClassName({
      states: ["hover", "selected", "warning", "critical", "focus", "active", "loading", "reviewed", "ai-active", "pending", "disabled", "success"],
      target: "cell",
    }),
    className
  );
}

export function getDataTableHeaderCellClassName(
  density: Density,
  align: DataTableAlignment,
  sticky: boolean,
  mono: boolean,
  truncate: boolean,
  className?: string
) {
  return cx(
    "fn-dt-header-cell h-[var(--table-row-height)] border-r border-[var(--color-border-subtle)] bg-[var(--table-header-bg)] text-[var(--table-header-text)] last:border-r-0",
    DENSITY_CELL_PADDING[density],
    ALIGNMENT_CLASSNAME[align],
    sticky && "top-0 z-[var(--z-raised)]",
    mono && "font-[var(--font-mono)] tabular-nums",
    truncate && "overflow-hidden",
    className
  );
}

export function getDataTableSectionClassName(tone: DataTableSectionTone, className?: string) {
  return cx(
    "fn-dt-section",
    SECTION_TONE_CLASSNAME[tone],
    className
  );
}
