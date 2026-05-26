import { forwardRef, useEffect, useId } from "react";
import { cx } from "../../../../lib/utils";
import type { ScrollRegionProps } from "../../../../types/datatable";
import { getInteractionAttributes, getInteractionClassName } from "../Interaction";
import { ScrollArea } from "../ScrollArea";
import { useViewportContext } from "./ViewportContext";

export const ScrollRegion = forwardRef<HTMLDivElement, ScrollRegionProps>(function ScrollRegion(
  { ownerId, className, onScroll, onMouseEnter, onFocusCapture, ...props },
  ref
) {
  const generatedId = useId();
  const regionId = ownerId ?? `fn-scroll-region-${generatedId}`;
  const { activeScrollRegionId, registerRegion, setActiveScrollRegionId } = useViewportContext();

  useEffect(() => registerRegion({ id: regionId, owner: true, role: "scroll" }), [regionId, registerRegion]);

  return (
    <ScrollArea
      ref={ref}
      data-scroll-owner={activeScrollRegionId === regionId ? "active" : "idle"}
      {...getInteractionAttributes({ active: activeScrollRegionId === regionId })}
      className={cx(
        "min-h-0 min-w-0 flex-1",
        getInteractionClassName({ states: ["active"], target: "viewport" }),
        className
      )}
      onMouseEnter={(event) => {
        setActiveScrollRegionId(regionId);
        onMouseEnter?.(event);
      }}
      onFocusCapture={(event) => {
        setActiveScrollRegionId(regionId);
        onFocusCapture?.(event);
      }}
      onScroll={(event) => {
        setActiveScrollRegionId(regionId);
        onScroll?.(event);
      }}
      {...props}
    />
  );
});
