import { forwardRef } from "react";
import { cx } from "../../../../lib/utils";
import type { ToolbarCommandRegionProps } from "./toolbar.types";

export const ToolbarCommandRegion = forwardRef<HTMLDivElement, ToolbarCommandRegionProps>(function ToolbarCommandRegion(
  { emphasize = "default", className, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={cx(
        "flex min-w-0 items-center gap-[var(--spacing-1)]",
        emphasize === "ai" && "text-[var(--color-accent-ai-muted)]",
        className
      )}
      {...props}
    />
  );
});
