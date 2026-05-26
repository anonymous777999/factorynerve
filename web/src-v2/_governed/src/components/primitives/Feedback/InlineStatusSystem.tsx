import { cx } from "../../../../lib/utils";
import type { InlineStatusSystemProps } from "../../../../types/datatable";
import { getFeedbackPriorityClassName } from "./feedback.utils";

export function InlineStatusSystem({
  label,
  meta,
  priority = "informational",
  className,
  ...props
}: InlineStatusSystemProps) {
  return (
    <div
      className={cx(
        "inline-flex h-6 shrink-0 items-center gap-[var(--spacing-2)] rounded-[var(--radius-sm)] border px-[var(--spacing-2)] text-[11px]",
        getFeedbackPriorityClassName(priority),
        className
      )}
      {...props}
    >
      <span className="uppercase tracking-[0.05em]">{label}</span>
      {meta ? <span className="font-[var(--font-mono)] opacity-80">{meta}</span> : null}
    </div>
  );
}
