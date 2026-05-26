import { forwardRef } from "react";
import { cx } from "../../../../lib/utils";
import type { CurrencyCellProps } from "./datatable.types";
import { DataTableCell } from "./DataTableCell";
import { formatCellCurrency } from "./cell.formatters";

export const CurrencyCell = forwardRef<HTMLTableCellElement, CurrencyCellProps>(function CurrencyCell(
  { value, currency = "INR", decimals = 0, secondary, className, ...props },
  ref
) {
  const formatted = formatCellCurrency(value, { currency, decimals });

  return (
    <DataTableCell
      ref={ref}
      align="right"
      mono
      stacked={Boolean(secondary)}
      meta={secondary}
      className={className}
      {...props}
    >
      <span className={cx(value != null && value < 0 && "text-[var(--color-status-critical-text)]")}>{formatted}</span>
    </DataTableCell>
  );
});
