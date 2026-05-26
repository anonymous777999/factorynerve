import { forwardRef, useEffect, useId } from "react";
import { cx } from "../../../../lib/utils";
import type { WorkspaceLayoutRegionProps } from "../../../../types/datatable";
import { useViewportContext } from "./ViewportContext";

export const WorkspaceLayoutRegion = forwardRef<HTMLDivElement, WorkspaceLayoutRegionProps>(function WorkspaceLayoutRegion(
  {
    direction = "vertical",
    grow = false,
    overflow = "hidden",
    className,
    ...props
  },
  ref
) {
  const generatedId = useId();
  const regionId = `fn-layout-region-${generatedId}`;
  const { registerRegion } = useViewportContext();

  useEffect(() => registerRegion({ id: regionId, role: "layout" }), [regionId, registerRegion]);

  return (
    <div
      ref={ref}
      data-layout-direction={direction}
      className={cx(
        "relative flex min-h-0 min-w-0",
        direction === "horizontal" ? "flex-row" : "flex-col",
        grow && "flex-1",
        overflow === "hidden" && "overflow-hidden",
        overflow === "clip" && "overflow-clip",
        overflow === "visible" && "overflow-visible",
        className
      )}
      {...props}
    />
  );
});
