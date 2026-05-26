import { forwardRef } from "react";
import { cx } from "../../../../lib/utils";
import { Tooltip } from "../Tooltip";
import type { ToolbarStatusRegionProps } from "./toolbar.types";
import { TOOLBAR_STATUS_TONE_CLASSNAME } from "./toolbar.tokens";

export const ToolbarStatusRegion = forwardRef<HTMLDivElement, ToolbarStatusRegionProps>(function ToolbarStatusRegion(
  { items = [], className, children, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      role="status"
      aria-live="polite"
      className={cx("flex min-w-0 items-center gap-[var(--spacing-1)]", className)}
      {...props}
    >
      {children ??
        items.map((item) => {
          const statusPill = (
            <div
              key={item.id}
              className={cx(
                "inline-flex h-6 shrink-0 items-center gap-[6px] rounded-[var(--radius-sm)] border px-[var(--spacing-2)] text-[11px]",
                TOOLBAR_STATUS_TONE_CLASSNAME[item.tone ?? "neutral"]
              )}
            >
              <span className="uppercase tracking-[0.05em]">{item.label}</span>
              {item.value ? (
                <span className="font-[var(--font-mono)] text-[11px]">{item.value}</span>
              ) : null}
            </div>
          );

          return item.tooltip ? <Tooltip key={item.id} content={item.tooltip}>{statusPill}</Tooltip> : statusPill;
        })}
    </div>
  );
});
