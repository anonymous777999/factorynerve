import { forwardRef } from "react";
import { cx } from "../../../../lib/utils";
import type { DataTableHeaderCellProps } from "./datatable.types";
import { useDataTableContext } from "./hooks";
import { getDataTableHeaderCellClassName } from "./datatable.variants";

function SortIndicator({ sorted }: { sorted: "asc" | "desc" | false }) {
  if (!sorted) {
    return <span aria-hidden="true" className="h-3 w-3 shrink-0 opacity-30">•</span>;
  }

  return (
    <span aria-hidden="true" className="h-3 w-3 shrink-0 text-[var(--color-accent-operational-muted)]">
      {sorted === "asc" ? "↑" : "↓"}
    </span>
  );
}

export const DataTableHeaderCell = forwardRef<HTMLTableCellElement, DataTableHeaderCellProps>(
  function DataTableHeaderCell(
    {
      align = "left",
      auxiliary,
      mono = false,
      sortable = false,
      sorted = false,
      truncate = true,
      scope = "col",
      className,
      children,
      ...props
    },
    ref
  ) {
    const { density, stickyHeader } = useDataTableContext();
    const sortValue = sorted === false ? (sortable ? "none" : undefined) : sorted === "asc" ? "ascending" : "descending";

    return (
      <th
        ref={ref}
        scope={scope}
        aria-sort={sortValue}
        className={getDataTableHeaderCellClassName(density, align, stickyHeader, mono, truncate, className)}
        {...props}
      >
        <div className={cx("flex min-w-0 items-center gap-[var(--spacing-1)]", align === "right" && "justify-end", align === "center" && "justify-center")}>
          <span className={cx("min-w-0 truncate text-[var(--text-xs)] font-[var(--font-weight-medium)] uppercase tracking-[var(--tracking-label)]", mono && "font-[var(--font-mono)]")}>
            {children}
          </span>
          {auxiliary ? (
            <span className="shrink-0 text-[var(--color-text-muted)]">{auxiliary}</span>
          ) : sortable ? (
            <SortIndicator sorted={sorted} />
          ) : null}
        </div>
      </th>
    );
  }
);
