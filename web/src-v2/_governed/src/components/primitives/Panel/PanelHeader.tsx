import { forwardRef } from "react";
import { cx } from "../../../../lib/utils";
import type { PanelHeaderProps } from "./panel.types";

export const PanelHeader = forwardRef<HTMLDivElement, PanelHeaderProps>(function PanelHeader(
  { title, subtitle, meta, actions, sticky, className, children, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={cx(
        "relative z-[var(--z-raised)] flex min-h-[40px] shrink-0 items-center gap-[var(--spacing-3)] border-b border-[var(--color-border-default)] bg-[var(--color-surface-primary)] px-[var(--spacing-5)] py-[10px]",
        sticky && "sticky top-0",
        className
      )}
      {...props}
    >
      {children ?? (
        <>
          <div className="min-w-0 flex-1">
            {meta ? (
              <div className="mb-[2px] text-[11px] uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
                {meta}
              </div>
            ) : null}
            {title ? (
              <div className="truncate text-[16px] font-medium leading-[1.4] tracking-[-0.01em] text-[var(--color-text-primary)]">
                {title}
              </div>
            ) : null}
            {subtitle ? (
              <div className="truncate text-[12px] text-[var(--color-text-muted)]">{subtitle}</div>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-[var(--spacing-2)]">{actions}</div> : null}
        </>
      )}
    </div>
  );
});
