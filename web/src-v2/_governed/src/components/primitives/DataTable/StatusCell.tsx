import { forwardRef } from "react";
import type { StatusCellProps } from "./datatable.types";
import { DataTableCell } from "./DataTableCell";
import { DATA_TABLE_WORKFLOW_STATE_TONE } from "./cell.tokens";
import { renderCellBadge } from "./cell.utils";

export const StatusCell = forwardRef<HTMLTableCellElement, StatusCellProps>(function StatusCell(
  { state, value, secondary, className, ...props },
  ref
) {
  const tone = DATA_TABLE_WORKFLOW_STATE_TONE[state];

  return (
    <DataTableCell
      ref={ref}
      tone={tone}
      pending={state === "pending" || state === "syncing"}
      success={state === "approved"}
      critical={state === "blocked" || state === "rejected"}
      warning={state === "stale"}
      reviewed={state === "in-review"}
      disabled={state === "archived"}
      meta={secondary}
      stacked={Boolean(secondary)}
      className={className}
      {...props}
    >
      {renderCellBadge(value ?? state, tone)}
    </DataTableCell>
  );
});
