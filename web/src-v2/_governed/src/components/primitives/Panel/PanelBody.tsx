import { forwardRef } from "react";
import { cx } from "../../../../lib/utils";
import type { PanelBodyProps } from "./panel.types";
import { PANEL_PADDING } from "./panel.tokens";

export const PanelBody = forwardRef<HTMLDivElement, PanelBodyProps>(function PanelBody(
  { padding = "default", scrollable = false, className, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={cx(
        "relative min-h-0 min-w-0 flex-1",
        PANEL_PADDING[padding],
        scrollable &&
          "overflow-auto overscroll-contain [scrollbar-color:var(--prim-neutral-600)_transparent]",
        className
      )}
      {...props}
    />
  );
});
