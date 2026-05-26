import { forwardRef } from "react";
import { cx } from "../../../../lib/utils";
import type { DataTableRowGroupProps } from "./datatable.types";

export const DataTableRowGroup = forwardRef<HTMLTableRowElement, DataTableRowGroupProps>(function DataTableRowGroup(
  {
    caption,
    colSpan = 999,
    description,
    className,
    children,
    ...props
  },
  ref
) {
  if (caption || description) {
    return (
      <tr
        ref={ref}
        className={cx("border-b border-[var(--color-border-subtle)] bg-[color-mix(in_srgb,var(--color-surface-primary)_50%,transparent)]", className)}
        {...props}
      >
        <td colSpan={colSpan} className="px-[var(--spacing-3)] py-[var(--spacing-2)]">
          <div className="flex min-w-0 flex-col gap-px">
            {caption ? (
              <div className="text-[var(--text-xs)] font-[var(--font-weight-medium)] text-[var(--color-text-secondary)]">
                {caption}
              </div>
            ) : null}
            {description ? (
              <div className="min-w-0 truncate text-[var(--text-xs)] text-[var(--color-text-muted)]">
                {description}
              </div>
            ) : null}
          </div>
          {children}
        </td>
      </tr>
    );
  }

  return <tr ref={ref} className={className} {...props}>{children}</tr>;
});
