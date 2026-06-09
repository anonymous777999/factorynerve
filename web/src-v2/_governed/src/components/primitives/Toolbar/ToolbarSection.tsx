import { forwardRef } from "react";
import { cx } from "../../../../lib/utils";
import type { ToolbarSectionProps } from "./toolbar.types";
import { TOOLBAR_SECTION_ALIGNMENT } from "./toolbar.tokens";

export const ToolbarSection = forwardRef<HTMLDivElement, ToolbarSectionProps>(function ToolbarSection(
  {
    align = "start",
    grow = false,
    overflow = "visible",
    className,
    ...props
  },
  ref
) {
  return (
    <div
      ref={ref}
      className={cx(
        "flex min-w-0 items-center gap-[var(--spacing-1)]",
        grow && "flex-1",
        TOOLBAR_SECTION_ALIGNMENT[align],
        overflow === "clip" && "overflow-hidden",
        overflow === "scroll" && "overflow-x-auto overflow-y-hidden",
        className
      )}
      {...props}
    />
  );
});
