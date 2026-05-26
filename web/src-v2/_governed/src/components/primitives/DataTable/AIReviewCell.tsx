import { forwardRef } from "react";
import type { AIReviewCellProps } from "./datatable.types";
import { DataTableCell } from "./DataTableCell";
import { DATA_TABLE_AI_REVIEW_TONE } from "./cell.tokens";
import { renderCellBadge } from "./cell.utils";

export const AIReviewCell = forwardRef<HTMLTableCellElement, AIReviewCellProps>(function AIReviewCell(
  { state, summary, secondary, className, ...props },
  ref
) {
    const tone = DATA_TABLE_AI_REVIEW_TONE[state];

    return (
      <DataTableCell
        ref={ref}
        tone={tone}
        aiActive={state === "processing" || state === "suggested"}
        reviewed={state === "reviewed"}
        warning={state === "low-confidence"}
        critical={state === "anomaly"}
        meta={secondary ?? summary}
        stacked={Boolean(secondary ?? summary)}
        className={className}
        {...props}
      >
        {renderCellBadge(state, tone)}
      </DataTableCell>
    );
  }
);
