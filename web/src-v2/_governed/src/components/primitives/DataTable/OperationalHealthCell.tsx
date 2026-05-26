import { forwardRef } from "react";
import type { OperationalHealthCellProps } from "./datatable.types";
import { DataTableCell } from "./DataTableCell";
import { DATA_TABLE_OPERATIONAL_HEALTH_TONE } from "./cell.tokens";
import { renderCellBadge } from "./cell.utils";

export const OperationalHealthCell = forwardRef<HTMLTableCellElement, OperationalHealthCellProps>(
  function OperationalHealthCell({ state, value, secondary, className, ...props }, ref) {
    const tone = DATA_TABLE_OPERATIONAL_HEALTH_TONE[state];

    return (
      <DataTableCell
        ref={ref}
        tone={tone}
        aiActive={state === "syncing"}
        warning={state === "warning" || state === "stale" || state === "low-confidence"}
        critical={state === "critical"}
        success={state === "healthy"}
        meta={secondary}
        stacked={Boolean(secondary)}
        className={className}
        {...props}
      >
        <span className="inline-flex items-center gap-[var(--spacing-2)]">
          {renderCellBadge(state, tone)}
          {value ? <span className="min-w-0 truncate">{value}</span> : null}
        </span>
      </DataTableCell>
    );
  }
);
