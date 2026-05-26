import { forwardRef } from "react";
import type { OCRConfidenceCellProps } from "./datatable.types";
import { DataTableCell } from "./DataTableCell";
import { DATA_TABLE_OCR_CONFIDENCE_TONE } from "./cell.tokens";
import { formatCellPercentage, resolveOCRConfidenceLevel } from "./cell.formatters";
import { renderCellBadge } from "./cell.utils";

export const OCRConfidenceCell = forwardRef<HTMLTableCellElement, OCRConfidenceCellProps>(function OCRConfidenceCell(
  { confidence, extractionState = "pending", label, secondary, className, ...props },
  ref
) {
  const level = resolveOCRConfidenceLevel(confidence);
  const tone = DATA_TABLE_OCR_CONFIDENCE_TONE[level];

  return (
    <DataTableCell
      ref={ref}
      align="right"
      mono
      tone={tone}
      warning={level === "low"}
      critical={level === "failed" || extractionState === "failed"}
      reviewed={extractionState === "reviewed"}
      aiActive={extractionState === "ai-assisted"}
      pending={extractionState === "pending"}
      meta={secondary ?? extractionState.replace("-", " ")}
      stacked
      className={className}
      {...props}
    >
      <span className="inline-flex items-center justify-end gap-[var(--spacing-2)]">
        <span>{label ?? formatCellPercentage(confidence)}</span>
        {renderCellBadge(level, tone)}
      </span>
    </DataTableCell>
  );
});
