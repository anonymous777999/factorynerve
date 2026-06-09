import { forwardRef } from "react";
import { cx } from "../../../../lib/utils";
import { getInteractionAttributes } from "../Interaction";
import type { DataTableCellProps } from "./datatable.types";
import { useDataTableContext } from "./hooks";
import { getDataTableCellClassName } from "./datatable.variants";

export const DataTableCell = forwardRef<HTMLTableCellElement, DataTableCellProps>(function DataTableCell(
  {
    active = false,
    align = "left",
    aiActive = false,
    critical = false,
    disabled = false,
    loading = false,
    meta,
    mono = false,
    pending = false,
    reviewed = false,
    selected = false,
    stacked = false,
    success = false,
    tone = "default",
    truncate = true,
    warning = false,
    className,
    children,
    ...props
  },
  ref
) {
  const { density } = useDataTableContext();

  return (
    <td
      ref={ref}
      {...getInteractionAttributes({
        active,
        aiActive,
        critical,
        disabled,
        loading,
        pending,
        reviewed,
        selected,
        success,
        warning,
      })}
      data-cell-tone={tone}
      className={getDataTableCellClassName(density, align, mono, tone, truncate, className)}
      {...props}
    >
      {stacked || meta ? (
        <div className={cx("flex min-w-0 flex-col", density === "compact" ? "gap-px" : "gap-[2px]")}>
          <div className={cx("min-w-0", truncate && "truncate")}>{children}</div>
          {meta ? (
            <div className={cx("min-w-0 text-[var(--text-xs)] leading-[var(--leading-xs)] text-[var(--color-text-muted)]", truncate && "truncate")}>
              {meta}
            </div>
          ) : null}
        </div>
      ) : (
        <div className={cx("min-w-0", truncate && "truncate")}>{children}</div>
      )}
    </td>
  );
});
