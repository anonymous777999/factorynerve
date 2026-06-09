import { forwardRef } from "react";
import { cx } from "../../../../lib/utils";
import type { ToolbarActionsProps } from "./toolbar.types";

export const ToolbarActions = forwardRef<HTMLDivElement, ToolbarActionsProps>(function ToolbarActions(
  { justify = "end", className, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={cx(
        "flex min-w-0 items-center gap-[var(--spacing-1)]",
        justify === "end" ? "justify-end" : "justify-start",
        className
      )}
      {...props}
    />
  );
});
