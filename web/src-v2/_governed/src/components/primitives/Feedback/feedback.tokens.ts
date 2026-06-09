import type { FeedbackPriority } from "../../../../types/datatable";

export const FEEDBACK_PRIORITY_ORDER: FeedbackPriority[] = [
  "blocking",
  "critical",
  "escalation",
  "warning",
  "ai-review",
  "operational",
  "informational",
];

export const FEEDBACK_PRIORITY_CLASSNAME: Record<FeedbackPriority, string> = {
  "ai-review":
    "border-[var(--color-accent-ai-border)] bg-[var(--color-accent-ai-surface)] text-[var(--color-accent-ai-muted)]",
  blocking:
    "border-[var(--color-status-critical-border)] bg-[color-mix(in_srgb,var(--color-status-critical-surface)_82%,var(--color-surface-primary))] text-[var(--color-status-critical-text)]",
  critical:
    "border-[var(--color-status-critical-border)] bg-[var(--color-status-critical-surface)] text-[var(--color-status-critical-text)]",
  escalation:
    "border-[var(--color-status-warning-border)] bg-[color-mix(in_srgb,var(--color-status-warning-surface)_72%,var(--color-surface-primary))] text-[var(--color-status-warning-text)]",
  informational:
    "border-[var(--color-border-default)] bg-[var(--color-surface-primary)] text-[var(--color-text-secondary)]",
  operational:
    "border-[var(--color-accent-operational-border)] bg-[var(--color-accent-operational-surface)] text-[var(--color-accent-operational-muted)]",
  warning:
    "border-[var(--color-status-warning-border)] bg-[var(--color-status-warning-surface)] text-[var(--color-status-warning-text)]",
};
