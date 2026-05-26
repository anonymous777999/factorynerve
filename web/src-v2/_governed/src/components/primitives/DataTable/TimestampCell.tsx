import { forwardRef } from "react";
import type { TimestampCellProps } from "./datatable.types";
import { DataTableCell } from "./DataTableCell";
import { formatCellTimestamp } from "./cell.formatters";

export const TimestampCell = forwardRef<HTMLTableCellElement, TimestampCellProps>(function TimestampCell(
  { value, format = "datetime", secondary, className, ...props },
  ref
) {
  const formatted = formatCellTimestamp(value, format);

  return (
    <DataTableCell
      ref={ref}
      mono
      stacked={Boolean(secondary ?? formatted.meta)}
      meta={secondary ?? formatted.meta}
      tone={formatted.label === "—" ? "muted" : "default"}
      className={className}
      {...props}
    >
      {formatted.label}
    </DataTableCell>
  );
});
