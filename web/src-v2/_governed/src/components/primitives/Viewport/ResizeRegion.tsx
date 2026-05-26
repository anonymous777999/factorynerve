import { forwardRef, useMemo } from "react";
import { cx } from "../../../../lib/utils";
import type { ResizeRegionProps } from "../../../../types/datatable";
import { useViewportResize } from "./hooks";

export const ResizeRegion = forwardRef<HTMLDivElement, ResizeRegionProps>(function ResizeRegion(
  {
    axis = "horizontal",
    className,
    defaultSize = 320,
    maxSize = Number.POSITIVE_INFINITY,
    minSize = 0,
    onSizeChange,
    persistenceKey,
    position = "right",
    size,
    style,
    ...props
  },
  ref
) {
  const { size: resolvedSize } = useViewportResize({
    axis,
    defaultSize,
    maxSize,
    minSize,
    onSizeChange,
    persistenceKey,
    position,
    size,
  });

  const dimensionStyle = useMemo(
    () =>
      axis === "horizontal"
        ? { maxWidth: maxSize, minWidth: minSize, width: resolvedSize }
        : { height: resolvedSize, maxHeight: maxSize, minHeight: minSize },
    [axis, maxSize, minSize, resolvedSize]
  );

  return (
    <div
      ref={ref}
      className={cx("relative min-h-0 min-w-0 shrink-0", className)}
      style={{ ...dimensionStyle, ...style }}
      {...props}
    />
  );
});
