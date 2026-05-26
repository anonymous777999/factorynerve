import { forwardRef, useEffect, useId } from "react";
import { cx } from "../../../../lib/utils";
import type { DockRegionProps, ViewportResizeAxis } from "../../../../types/datatable";
import { getInteractionAttributes, getInteractionClassName } from "../Interaction";
import { useViewportResize } from "./hooks";
import { useViewportContext } from "./ViewportContext";
import { WorkspaceResizeHandle } from "./WorkspaceResizeHandle";

function resolveAxis(side: DockRegionProps["side"]): ViewportResizeAxis {
  return side === "top" || side === "bottom" ? "vertical" : "horizontal";
}

export const DockRegion = forwardRef<HTMLElement, DockRegionProps>(function DockRegion(
  {
    children,
    className,
    collapsed = false,
    collapsedSize = 0,
    defaultSize = 360,
    maxSize = Number.POSITIVE_INFINITY,
    minSize = 280,
    onCollapsedChange,
    onSizeChange,
    persistenceKey,
    resizable = true,
    side = "right",
    size,
    style,
    ...props
  },
  ref
) {
  const axis = resolveAxis(side);
  const generatedId = useId();
  const regionId = `fn-dock-region-${generatedId}`;
  const { registerRegion } = useViewportContext();
  const { handleResizeStart, size: resolvedSize } = useViewportResize({
    axis,
    defaultSize,
    maxSize,
    minSize,
    onSizeChange,
    persistenceKey,
    position: side,
    size,
  });

  useEffect(() => registerRegion({ id: regionId, role: "dock" }), [regionId, registerRegion]);
  useEffect(() => onCollapsedChange?.(collapsed), [collapsed, onCollapsedChange]);

  const visualSize = collapsed ? collapsedSize : resolvedSize;
  const dimensionStyle =
    axis === "horizontal"
      ? { maxWidth: maxSize, minWidth: collapsed ? collapsedSize : minSize, width: visualSize }
      : { height: visualSize, maxHeight: maxSize, minHeight: collapsed ? collapsedSize : minSize };

  return (
    <div
      {...getInteractionAttributes({
        active: !collapsed,
        aiActive: true,
        locked: !resizable,
        selected: !collapsed,
      })}
      className={cx(
        "relative flex min-h-0 min-w-0 shrink-0 overflow-hidden",
        getInteractionClassName({
          states: ["active", "selected", "locked", "ai-active"],
          target: "dock",
          tone: "ai",
        }),
        axis === "horizontal" ? "h-full" : "w-full",
        className
      )}
      style={{ ...dimensionStyle, ...style }}
      {...props}
    >
      {resizable && !collapsed ? (
        <WorkspaceResizeHandle
          axis={axis}
          onResizeStart={handleResizeStart}
          className={cx(
            "absolute z-[var(--z-panel)]",
            axis === "horizontal"
              ? side === "left"
                ? "right-0 top-0"
                : "left-0 top-0"
              : side === "top"
                ? "bottom-0 left-0"
                : "left-0 top-0"
          )}
        />
      ) : null}
      <aside
        ref={ref}
        className="flex min-h-0 min-w-0 flex-1 overflow-hidden"
      >
        {children}
      </aside>
    </div>
  );
});
