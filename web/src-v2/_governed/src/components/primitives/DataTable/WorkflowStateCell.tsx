import { forwardRef } from "react";
import type { WorkflowStateCellProps } from "./datatable.types";
import { DataTableCell } from "./DataTableCell";
import { DATA_TABLE_WORKFLOW_STATE_TONE } from "./cell.tokens";
import { renderCellBadge } from "./cell.utils";

export const WorkflowStateCell = forwardRef<HTMLTableCellElement, WorkflowStateCellProps>(
  function WorkflowStateCell({ state, owner, secondary, className, ...props }, ref) {
    const tone = DATA_TABLE_WORKFLOW_STATE_TONE[state];

    return (
      <DataTableCell
        ref={ref}
        tone={tone}
        pending={state === "pending" || state === "syncing"}
        success={state === "approved"}
        critical={state === "blocked" || state === "rejected"}
        warning={state === "stale"}
        disabled={state === "archived"}
        meta={secondary ?? owner}
        stacked={Boolean(secondary ?? owner)}
        className={className}
        {...props}
      >
        {renderCellBadge(state, tone)}
      </DataTableCell>
    );
  }
);
