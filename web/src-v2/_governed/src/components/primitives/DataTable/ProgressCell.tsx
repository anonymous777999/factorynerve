import { forwardRef } from "react";
import { cx } from "../../../../lib/utils";
import type { DataTableCellTone, ProgressCellProps } from "./datatable.types";
import { DataTableCell } from "./DataTableCell";
import { formatCellNumber } from "./cell.formatters";
import { getProgressToneClassName } from "./cell.utils";

function getProgressTone(value: number, ratio: number): DataTableCellTone {
  if (ratio >= 1) return "success";
  if (ratio >= 0.75) return "ai";
  if (ratio >= 0.45) return "warning";
  if (value === 0) return "muted";
  return "critical";
}

export const ProgressCell = forwardRef<HTMLTableCellElement, ProgressCellProps>(function ProgressCell(
  { value, max = 100, label, secondary, className, ...props },
  ref
) {
  const ratio = max <= 0 ? 0 : Math.max(0, Math.min(1, value / max));
  const tone = getProgressTone(value, ratio);

  return (
    <DataTableCell
      ref={ref}
      align="right"
      mono
      tone={tone}
      warning={tone === "warning"}
      critical={tone === "critical"}
      success={tone === "success"}
      meta={secondary ?? `${Math.round(ratio * 100)}% complete`}
      stacked
      className={className}
      {...props}
    >
      <div className="flex min-w-0 items-center justify-end gap-[var(--spacing-2)]">
        <span>{label ?? `${formatCellNumber(value)} / ${formatCellNumber(max)}`}</span>
        <span className="relative h-1.5 w-14 shrink-0 overflow-hidden rounded-[var(--radius-full)] bg-[var(--color-surface-raised)]">
          <span
            className={cx("absolute inset-y-0 left-0 rounded-[var(--radius-full)]", getProgressToneClassName(tone))}
            style={{ width: `${ratio * 100}%` }}
          />
        </span>
      </div>
    </DataTableCell>
  );
});
