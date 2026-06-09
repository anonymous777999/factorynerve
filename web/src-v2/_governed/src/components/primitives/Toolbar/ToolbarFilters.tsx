import { forwardRef } from "react";
import { cx } from "../../../../lib/utils";
import { ScrollArea } from "../ScrollArea";
import { Tooltip } from "../Tooltip";
import type { ToolbarFiltersProps } from "./toolbar.types";
import { TOOLBAR_FILTER_TONE_CLASSNAME } from "./toolbar.tokens";

function XIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path d="M7.5 2.5L2.5 7.5M2.5 2.5L7.5 7.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export const ToolbarFilters = forwardRef<HTMLDivElement, ToolbarFiltersProps>(function ToolbarFilters(
  {
    activeFilters = [],
    children,
    className,
    clearLabel = "Clear all filters",
    onClearAll,
    ...props
  },
  ref
) {
  return (
    <div ref={ref} className={cx("flex min-w-0 flex-1 items-center gap-[var(--spacing-2)]", className)} {...props}>
      {activeFilters.length > 0 ? (
        <ScrollArea
          orientation="horizontal"
          shadow={false}
          className="min-w-0 flex-1"
          viewportClassName="h-full"
          contentClassName="flex min-w-max items-center gap-[var(--spacing-1)] pr-[var(--spacing-1)]"
        >
          {activeFilters.map((filter) => {
            const chip = (
              <div
                key={filter.id}
                className={cx(
                  "inline-flex h-6 shrink-0 items-center gap-[6px] rounded-[var(--radius-sm)] border px-[var(--spacing-2)] font-[var(--font-mono)] text-[11px] uppercase tracking-[0.04em]",
                  TOOLBAR_FILTER_TONE_CLASSNAME[filter.tone ?? "active"]
                )}
              >
                <span className="truncate">{filter.label}{filter.value ? `: ${filter.value}` : ""}</span>
                {filter.onRemove ? (
                  <button
                    type="button"
                    aria-label={`Remove ${filter.label} filter`}
                    onClick={filter.onRemove}
                    className="inline-flex h-4 w-4 items-center justify-center rounded-[var(--radius-sm)] text-current opacity-80 transition-opacity hover:opacity-100 focus-visible:outline-none"
                  >
                    <XIcon />
                  </button>
                ) : null}
              </div>
            );

            return filter.tooltip ? <Tooltip key={filter.id} content={filter.tooltip}>{chip}</Tooltip> : chip;
          })}
        </ScrollArea>
      ) : null}

      {children ? <div className="flex shrink-0 items-center gap-[var(--spacing-1)]">{children}</div> : null}

      {activeFilters.length > 0 && onClearAll ? (
        <button
          type="button"
          onClick={onClearAll}
          className="inline-flex h-6 shrink-0 items-center rounded-[var(--radius-sm)] px-[var(--spacing-2)] text-[11px] text-[var(--color-text-muted)] transition-colors duration-[var(--transition-fast)] ease-[var(--ease-operational)] hover:bg-[var(--color-surface-overlay)] hover:text-[var(--color-text-secondary)] focus-visible:outline-none"
        >
          {clearLabel}
        </button>
      ) : null}
    </div>
  );
});
