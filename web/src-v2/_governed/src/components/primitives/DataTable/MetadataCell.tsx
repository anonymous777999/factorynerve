import { forwardRef } from "react";
import type { MetadataCellProps } from "./datatable.types";
import { DataTableCell } from "./DataTableCell";

export const MetadataCell = forwardRef<HTMLTableCellElement, MetadataCellProps>(function MetadataCell(
  { value, secondary, label, className, ...props },
  ref
) {
  return (
    <DataTableCell
      ref={ref}
      meta={secondary}
      stacked={Boolean(secondary)}
      className={className}
      {...props}
    >
      <span className="flex min-w-0 flex-col gap-px">
        {label ? (
          <span className="min-w-0 truncate text-[var(--text-xs)] uppercase tracking-[var(--tracking-label)] text-[var(--color-text-muted)]">
            {label}
          </span>
        ) : null}
        <span className="min-w-0 truncate">{value}</span>
      </span>
    </DataTableCell>
  );
});
