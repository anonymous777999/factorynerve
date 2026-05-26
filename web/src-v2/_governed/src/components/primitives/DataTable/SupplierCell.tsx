import { forwardRef } from "react";
import type { SupplierCellProps } from "./datatable.types";
import { DataTableCell } from "./DataTableCell";

export const SupplierCell = forwardRef<HTMLTableCellElement, SupplierCellProps>(function SupplierCell(
  { name, code, location, secondary, className, ...props },
  ref
) {
  return (
    <DataTableCell ref={ref} stacked meta={secondary ?? location} className={className} {...props}>
      <div className="flex min-w-0 items-center gap-[var(--spacing-2)]">
        <span className="min-w-0 truncate">{name}</span>
        {code ? (
          <span className="shrink-0 font-[var(--font-mono)] text-[var(--text-xs)] text-[var(--color-text-muted)]">
            {code}
          </span>
        ) : null}
      </div>
    </DataTableCell>
  );
});
