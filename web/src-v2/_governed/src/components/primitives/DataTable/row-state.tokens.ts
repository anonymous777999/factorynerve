import type { DataTableRowState } from "../../../../types/datatable";

export const DATA_TABLE_ROW_STATE_ORDER: DataTableRowState[] = [
  "disabled",
  "archived",
  "locked",
  "critical",
  "warning",
  "pending",
  "approved",
  "ai-processing",
  "ai-reviewed",
  "ai-suggested",
  "low-confidence",
  "anomaly-detected",
  "syncing",
  "stale",
  "flagged",
];

export const DATA_TABLE_ROW_STATE_CLASSNAME: Record<Exclude<DataTableRowState, "default">, string> = {
  approved:
    "data-[row-state~=approved]:shadow-[inset_2px_0_0_var(--color-status-ok-border)] data-[row-state~=approved]:text-[var(--color-text-secondary)]",
  "ai-processing":
    "data-[row-state~=ai-processing]:bg-[color-mix(in_srgb,var(--color-accent-ai-surface)_36%,var(--table-row-bg))] data-[row-state~=ai-processing]:shadow-[inset_2px_0_0_var(--color-accent-ai-border)]",
  "ai-reviewed":
    "data-[row-state~=ai-reviewed]:shadow-[inset_2px_0_0_var(--color-accent-ai-border)]",
  "ai-suggested":
    "data-[row-state~=ai-suggested]:bg-[color-mix(in_srgb,var(--color-accent-ai-surface)_22%,var(--table-row-bg))] data-[row-state~=ai-suggested]:shadow-[inset_2px_0_0_var(--color-accent-ai-border)]",
  "anomaly-detected":
    "data-[row-state~=anomaly-detected]:bg-[color-mix(in_srgb,var(--color-status-critical-surface)_24%,var(--table-row-bg))] data-[row-state~=anomaly-detected]:shadow-[inset_2px_0_0_var(--color-status-critical-border)]",
  archived:
    "data-[row-state~=archived]:bg-[color-mix(in_srgb,var(--color-surface-primary)_52%,var(--table-row-bg))] data-[row-state~=archived]:text-[var(--color-text-muted)]",
  critical:
    "data-[row-state~=critical]:bg-[color-mix(in_srgb,var(--color-status-critical-surface)_34%,var(--table-row-bg))] data-[row-state~=critical]:shadow-[inset_2px_0_0_var(--color-status-critical-border)]",
  disabled:
    "data-[row-state~=disabled]:opacity-55 data-[row-state~=disabled]:text-[var(--color-text-disabled)]",
  flagged:
    "data-[row-state~=flagged]:shadow-[inset_2px_0_0_var(--color-status-warning-border)] data-[row-state~=flagged]:text-[var(--color-text-secondary)]",
  locked:
    "data-[row-state~=locked]:bg-[color-mix(in_srgb,var(--color-surface-primary)_40%,var(--table-row-bg))] data-[row-state~=locked]:text-[var(--color-text-muted)]",
  "low-confidence":
    "data-[row-state~=low-confidence]:bg-[color-mix(in_srgb,var(--color-status-warning-surface)_18%,var(--table-row-bg))] data-[row-state~=low-confidence]:shadow-[inset_2px_0_0_var(--color-status-warning-border)]",
  pending:
    "data-[row-state~=pending]:shadow-[inset_2px_0_0_var(--color-status-pending-border)]",
  stale:
    "data-[row-state~=stale]:bg-[color-mix(in_srgb,var(--color-surface-primary)_36%,var(--table-row-bg))] data-[row-state~=stale]:shadow-[inset_2px_0_0_var(--color-border-strong)]",
  syncing:
    "data-[row-state~=syncing]:bg-[color-mix(in_srgb,var(--color-accent-ai-surface)_18%,var(--table-row-bg))] data-[row-state~=syncing]:shadow-[inset_0_-1px_0_var(--color-accent-ai-border)]",
  warning:
    "data-[row-state~=warning]:bg-[color-mix(in_srgb,var(--color-status-warning-surface)_28%,var(--table-row-bg))] data-[row-state~=warning]:shadow-[inset_2px_0_0_var(--color-status-warning-border)]",
};
