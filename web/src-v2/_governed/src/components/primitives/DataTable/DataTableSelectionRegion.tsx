import { forwardRef } from "react";
import { cx } from "../../../../lib/utils";
import { getInteractionAttributes, getInteractionClassName } from "../Interaction";
import type { DataTableSelectionRegionProps } from "./datatable.types";

export const DataTableSelectionRegion = forwardRef<HTMLDivElement, DataTableSelectionRegionProps>(
  function DataTableSelectionRegion(
    {
      checked = false,
      disabled = false,
      indeterminate = false,
      mode = "row",
      className,
      children,
      ...props
    },
    ref
  ) {
    return (
      <div
        ref={ref}
        {...getInteractionAttributes({
          disabled,
          hover: !disabled,
          selected: checked || indeterminate,
        })}
        className={cx(
          "flex min-w-0 items-center gap-[var(--spacing-2)]",
          mode === "bulk" && "justify-center",
          className
        )}
        {...props}
      >
        <span
          aria-hidden="true"
          className={cx(
            "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] text-[10px] text-[var(--color-accent-operational-muted)]",
            getInteractionClassName({
              states: ["hover", "selected", "disabled"],
              target: "icon-button",
            })
          )}
        >
          {indeterminate ? "−" : checked ? "✓" : null}
        </span>
        {children ? <span className="min-w-0 truncate">{children}</span> : null}
      </div>
    );
  }
);
