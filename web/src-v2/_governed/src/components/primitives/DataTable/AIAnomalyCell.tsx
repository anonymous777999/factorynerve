import { forwardRef } from "react";
import type { AIAnomalyCellProps, DataTableCellTone } from "./datatable.types";
import { DataTableCell } from "./DataTableCell";
import { DATA_TABLE_AI_REVIEW_TONE } from "./cell.tokens";
import { renderCellBadge } from "./cell.utils";

const SEVERITY_TONE: Record<AIAnomalyCellProps["severity"], DataTableCellTone> = {
  critical: "critical",
  high: "critical",
  low: "warning",
  medium: "warning",
  none: "muted",
};

export const AIAnomalyCell = forwardRef<HTMLTableCellElement, AIAnomalyCellProps>(function AIAnomalyCell(
  { severity, reviewState = "unreviewed", suggestion, secondary, className, ...props },
  ref
) {
  const tone = severity === "none" ? DATA_TABLE_AI_REVIEW_TONE[reviewState] : SEVERITY_TONE[severity];

  return (
    <DataTableCell
      ref={ref}
      tone={tone}
      aiActive={reviewState === "processing" || reviewState === "suggested"}
      reviewed={reviewState === "reviewed"}
      warning={severity === "low" || severity === "medium" || reviewState === "low-confidence"}
      critical={severity === "high" || severity === "critical" || reviewState === "anomaly"}
      meta={secondary ?? suggestion}
      stacked={Boolean(secondary ?? suggestion)}
      className={className}
      {...props}
    >
      {renderCellBadge(severity === "none" ? reviewState : severity, tone)}
    </DataTableCell>
  );
});
