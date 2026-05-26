import type {
  AIReviewState,
  DataTableCellTone,
  OCRConfidenceLevel,
  OperationalHealthState,
  QueueStateValue,
  WorkflowStateValue,
} from "../../../../types/datatable";

export const DATA_TABLE_CELL_BADGE_CLASSNAME =
  "inline-flex h-5 max-w-full items-center gap-[var(--spacing-1)] rounded-[var(--radius-sm)] border px-[var(--spacing-2)] text-[10px] font-[var(--font-weight-medium)] uppercase tracking-[0.04em] whitespace-nowrap";

export const DATA_TABLE_CELL_TONE_BADGE_CLASSNAME: Record<DataTableCellTone, string> = {
  ai: "border-[var(--color-accent-ai-border)] bg-[var(--color-accent-ai-surface)] text-[var(--color-accent-ai-muted)]",
  critical:
    "border-[var(--color-status-critical-border)] bg-[var(--color-status-critical-surface)] text-[var(--color-status-critical-text)]",
  default: "border-[var(--color-border-default)] bg-[var(--color-surface-raised)] text-[var(--color-text-tertiary)]",
  muted: "border-[var(--color-border-subtle)] bg-[var(--color-surface-primary)] text-[var(--color-text-muted)]",
  neutral: "border-[var(--color-border-default)] bg-[var(--color-surface-raised)] text-[var(--color-text-secondary)]",
  success: "border-[var(--color-status-ok-border)] bg-[var(--color-status-ok-surface)] text-[var(--color-status-ok-text)]",
  warning:
    "border-[var(--color-status-warning-border)] bg-[var(--color-status-warning-surface)] text-[var(--color-status-warning-text)]",
};

export const DATA_TABLE_WORKFLOW_STATE_TONE: Record<WorkflowStateValue, DataTableCellTone> = {
  approved: "success",
  archived: "muted",
  blocked: "critical",
  "in-review": "ai",
  locked: "muted",
  pending: "warning",
  rejected: "critical",
  stale: "warning",
  syncing: "ai",
};

export const DATA_TABLE_QUEUE_STATE_TONE: Record<QueueStateValue, DataTableCellTone> = {
  archived: "muted",
  blocked: "critical",
  processing: "ai",
  queued: "warning",
  ready: "success",
  stale: "warning",
};

export const DATA_TABLE_AI_REVIEW_TONE: Record<AIReviewState, DataTableCellTone> = {
  anomaly: "critical",
  "low-confidence": "warning",
  processing: "ai",
  reviewed: "ai",
  suggested: "ai",
  unreviewed: "muted",
};

export const DATA_TABLE_OCR_CONFIDENCE_TONE: Record<OCRConfidenceLevel, DataTableCellTone> = {
  failed: "critical",
  high: "success",
  low: "warning",
  medium: "neutral",
};

export const DATA_TABLE_OPERATIONAL_HEALTH_TONE: Record<OperationalHealthState, DataTableCellTone> = {
  critical: "critical",
  healthy: "success",
  "low-confidence": "warning",
  stale: "warning",
  syncing: "ai",
  warning: "warning",
};
