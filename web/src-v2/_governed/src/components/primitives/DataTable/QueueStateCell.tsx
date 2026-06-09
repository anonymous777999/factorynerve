import { forwardRef } from "react";
import type { QueueStateCellProps } from "./datatable.types";
import { DataTableCell } from "./DataTableCell";
import { DATA_TABLE_QUEUE_STATE_TONE } from "./cell.tokens";
import { formatCellNumber } from "./cell.formatters";
import { renderCellBadge } from "./cell.utils";

export const QueueStateCell = forwardRef<HTMLTableCellElement, QueueStateCellProps>(function QueueStateCell(
  { state, count, secondary, className, ...props },
  ref
) {
  const tone = DATA_TABLE_QUEUE_STATE_TONE[state];

  return (
    <DataTableCell
      ref={ref}
      tone={tone}
      pending={state === "queued" || state === "processing"}
      critical={state === "blocked"}
      warning={state === "stale"}
      success={state === "ready"}
      disabled={state === "archived"}
      meta={secondary}
      stacked={Boolean(secondary)}
      className={className}
      {...props}
    >
      <span className="inline-flex items-center gap-[var(--spacing-2)]">
        {renderCellBadge(state, tone)}
        {typeof count === "number" ? (
          <span className="font-[var(--font-mono)] text-[var(--text-xs)] text-[var(--color-text-muted)]">{formatCellNumber(count)}</span>
        ) : null}
      </span>
    </DataTableCell>
  );
});
