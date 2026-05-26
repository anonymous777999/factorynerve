import { forwardRef } from "react";
import { cx } from "../../../../lib/utils";
import type { PanelSectionProps } from "./panel.types";

export const PanelSection = forwardRef<HTMLElement, PanelSectionProps>(function PanelSection(
  { title, description, action, inset = false, className, children, ...props },
  ref
) {
  return (
    <section
      ref={ref}
      className={cx(
        "flex min-w-0 flex-col gap-[var(--spacing-3)]",
        inset && "rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-surface-primary)] p-[var(--spacing-4)]",
        className
      )}
      {...props}
    >
      {title || description || action ? (
        <div className="flex items-start gap-[var(--spacing-3)]">
          <div className="min-w-0 flex-1">
            {title ? (
              <div className="text-[11px] uppercase tracking-[0.06em] text-[var(--color-text-muted)]">{title}</div>
            ) : null}
            {description ? (
              <div className="mt-[2px] text-[12px] leading-[1.5] text-[var(--color-text-secondary)]">{description}</div>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
});
