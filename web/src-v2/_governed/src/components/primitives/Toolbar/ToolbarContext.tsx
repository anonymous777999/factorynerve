import { forwardRef } from "react";
import { cx } from "../../../../lib/utils";
import type { ToolbarContextProps } from "./toolbar.types";

export const ToolbarContext = forwardRef<HTMLDivElement, ToolbarContextProps>(function ToolbarContext(
  { label, title, meta, className, children, ...props },
  ref
) {
  return (
    <div ref={ref} className={cx("flex min-w-0 items-center gap-[var(--spacing-2)]", className)} {...props}>
      {children ?? (
        <>
          {label ? (
            <span className="shrink-0 text-[11px] uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
              {label}
            </span>
          ) : null}
          {title ? (
            <span className="truncate text-[12px] font-medium text-[var(--color-text-secondary)]">{title}</span>
          ) : null}
          {meta ? (
            <span className="shrink-0 font-[var(--font-mono)] text-[11px] text-[var(--color-text-muted)]">
              {meta}
            </span>
          ) : null}
        </>
      )}
    </div>
  );
});
