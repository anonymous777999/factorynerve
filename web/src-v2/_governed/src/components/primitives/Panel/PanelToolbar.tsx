import { forwardRef } from "react";
import { cx } from "../../../../lib/utils";
import type { PanelToolbarProps } from "./panel.types";

export const PanelToolbar = forwardRef<HTMLDivElement, PanelToolbarProps>(function PanelToolbar(
  { startSlot, centerSlot, endSlot, sticky, className, children, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={cx(
        "relative z-[var(--z-raised)] flex min-h-[40px] shrink-0 items-center gap-[var(--spacing-3)] border-b border-[var(--color-border-default)] bg-[var(--color-surface-primary)] px-[var(--spacing-4)]",
        sticky && "sticky top-0",
        className
      )}
      {...props}
    >
      {children ?? (
        <>
          <div className="flex min-w-0 flex-1 items-center gap-[var(--spacing-2)]">{startSlot}</div>
          {centerSlot ? <div className="flex shrink-0 items-center gap-[var(--spacing-2)]">{centerSlot}</div> : null}
          <div className="flex min-w-0 items-center justify-end gap-[var(--spacing-2)]">{endSlot}</div>
        </>
      )}
    </div>
  );
});
