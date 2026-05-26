import { forwardRef } from "react";
import { cx } from "../../../../lib/utils";
import type { PanelFooterProps } from "./panel.types";

export const PanelFooter = forwardRef<HTMLDivElement, PanelFooterProps>(function PanelFooter(
  { sticky, className, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={cx(
        "relative z-[var(--z-raised)] flex min-h-[40px] shrink-0 items-center gap-[var(--spacing-3)] border-t border-[var(--color-border-default)] bg-[var(--color-surface-primary)] px-[var(--spacing-5)] py-[10px]",
        sticky && "sticky bottom-0",
        className
      )}
      {...props}
    />
  );
});
