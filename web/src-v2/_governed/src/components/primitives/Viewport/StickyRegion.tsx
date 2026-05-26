import { forwardRef, useEffect, useId } from "react";
import { cx } from "../../../../lib/utils";
import type { StickyRegionProps } from "../../../../types/datatable";
import { useViewportContext } from "./ViewportContext";

const LAYER_CLASSNAME = {
  base: "z-[var(--z-base)]",
  panel: "z-[var(--z-panel)]",
  raised: "z-[var(--z-raised)]",
} as const;

const SURFACE_CLASSNAME = {
  ai: "bg-[var(--color-accent-ai-surface,var(--prim-blue-950))]",
  workspace: "bg-[var(--color-surface-primary)]",
} as const;

export const StickyRegion = forwardRef<HTMLDivElement, StickyRegionProps>(function StickyRegion(
  {
    edge = "top",
    layer = "raised",
    offset = 0,
    surface = "workspace",
    className,
    style,
    ...props
  },
  ref
) {
    const generatedId = useId();
    const regionId = `fn-sticky-region-${generatedId}`;
    const { registerRegion } = useViewportContext();

    useEffect(() => registerRegion({ id: regionId, role: "sticky" }), [regionId, registerRegion]);

    return (
      <div
        ref={ref}
        className={cx(
          "sticky shrink-0",
          edge === "top" ? "top-0" : "bottom-0",
          LAYER_CLASSNAME[layer],
          SURFACE_CLASSNAME[surface],
          className
        )}
        style={{
          ...style,
          [edge]: typeof offset === "number" ? `${offset}px` : offset,
        }}
        {...props}
      />
    );
});
