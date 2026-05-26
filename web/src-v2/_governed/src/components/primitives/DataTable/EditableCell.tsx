import { forwardRef } from "react";
import { cx } from "../../../../lib/utils";
import type { EditableCellProps } from "./datatable.types";
import { DataTableCell } from "./DataTableCell";

export const EditableCell = forwardRef<HTMLTableCellElement, EditableCellProps>(function EditableCell(
  { editable = true, value, secondary, className, ...props },
  ref
) {
  return (
    <DataTableCell
      ref={ref}
      active={editable}
      meta={secondary}
      stacked={Boolean(secondary)}
      className={className}
      {...props}
    >
      <span className="flex min-w-0 items-center gap-[var(--spacing-2)]">
        <span className="min-w-0 truncate">{value}</span>
        <span
          aria-hidden="true"
          className={cx(
            "shrink-0 rounded-[var(--radius-sm)] border px-[var(--spacing-1)] py-px text-[10px] uppercase tracking-[0.04em]",
            editable
              ? "border-[var(--color-border-default)] text-[var(--color-text-muted)]"
              : "border-[var(--color-border-subtle)] text-[var(--color-text-disabled)]"
          )}
        >
          {editable ? "Edit" : "Locked"}
        </span>
      </span>
    </DataTableCell>
  );
});
