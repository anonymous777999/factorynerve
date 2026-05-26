import { cx } from "../../../../lib/utils";
import type { ProgressIndicatorProps } from "../../../../types/datatable";
import { getFeedbackPriorityClassName } from "./feedback.utils";

export function ProgressIndicator({
  label,
  priority = "operational",
  value,
  className,
  ...props
}: ProgressIndicatorProps) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div className={cx("flex min-w-0 flex-col gap-[var(--spacing-1)]", className)} {...props}>
      {label ? <div className="text-[11px] uppercase tracking-[0.05em] text-[var(--color-text-muted)]">{label}</div> : null}
      <div className="relative h-2 overflow-hidden rounded-[var(--radius-full)] border border-[var(--color-border-default)] bg-[var(--color-surface-primary)]">
        <div
          className={cx("h-full rounded-[var(--radius-full)]", getFeedbackPriorityClassName(priority))}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
