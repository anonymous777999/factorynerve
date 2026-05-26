import { forwardRef } from "react";
import { cx } from "../../../../lib/utils";
import type { DataTableSectionProps } from "./datatable.types";
import { getDataTableSectionClassName } from "./datatable.variants";

export const DataTableSection = forwardRef<HTMLTableSectionElement, DataTableSectionProps>(function DataTableSection(
  {
    label,
    description,
    tone = "default",
    className,
    children,
    ...props
  },
  ref
) {
  return (
    <tbody ref={ref} data-tone={tone} className={getDataTableSectionClassName(tone, className)} {...props}>
      {label ? (
        <tr className="border-b border-[var(--color-border-default)] bg-[color-mix(in_srgb,var(--color-surface-primary)_82%,transparent)]">
          <td colSpan={999} className="px-[var(--spacing-3)] py-[var(--spacing-2)]">
            <div className="flex min-w-0 flex-col gap-px">
              <div className="text-[var(--text-xs)] font-[var(--font-weight-medium)] uppercase tracking-[var(--tracking-label)] text-[var(--color-text-tertiary)]">
                {label}
              </div>
              {description ? (
                <div className={cx("min-w-0 text-[var(--text-xs)] text-[var(--color-text-muted)]", "truncate")}>
                  {description}
                </div>
              ) : null}
            </div>
          </td>
        </tr>
      ) : null}
      {children}
    </tbody>
  );
});
