import { useState } from "react";
import type { CSSProperties } from "react";
import type { VirtualizedTableViewportProps } from "../../../../../types/datatable";
import { cx } from "../../../../../lib/utils";
import { ScrollRegion } from "../../Viewport";
import { mapDensityToRowHeight } from "./engine.utils";
import { useDataTableEngine } from "./hooks";
import { useVirtualizedRows } from "./hooks";

export function VirtualizedTableViewport<TData>({
  className,
  emptySlot,
  estimatedRowHeight,
  header,
  overscan = 8,
  renderRow,
  rowHeight,
  rowKey,
  rows,
  viewportClassName,
  contentClassName,
  ...props
}: VirtualizedTableViewportProps<TData>) {
  const { density } = useDataTableEngine();
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const resolvedRowHeight = rowHeight ?? estimatedRowHeight ?? mapDensityToRowHeight(density);
  const keys = rows.map((row, index) => rowKey(row, index));
  const { items, totalSize } = useVirtualizedRows(keys, resolvedRowHeight, viewportHeight, scrollTop, overscan);

  return (
    <ScrollRegion
      ownerId="factorynerve.virtualized-table"
      orientation="both"
      className={cx("min-h-0 min-w-0 flex-1 bg-[var(--table-bg)]", className)}
      viewportClassName={cx("h-full", viewportClassName)}
      contentClassName={cx("h-full min-w-full", contentClassName)}
      onScrollCapture={(event) => {
        const target = event.target as HTMLDivElement;
        setScrollTop(target.scrollTop);
        setViewportHeight(target.clientHeight);
      }}
      onMouseEnter={(event) => {
        const target = event.currentTarget;
        setViewportHeight(target.clientHeight);
        props.onMouseEnter?.(event);
      }}
      {...props}
    >
      <div className="relative min-h-full min-w-full">
        {header ? <div className="sticky top-0 z-[var(--z-raised)]">{header}</div> : null}
        {rows.length === 0 ? (
          emptySlot ?? null
        ) : (
          <div className="relative min-w-full" style={{ height: totalSize } satisfies CSSProperties}>
            {items.map((item) => (
              <div
                key={item.key}
                className="absolute inset-x-0"
                style={{ transform: `translateY(${item.offset}px)`, height: item.size } satisfies CSSProperties}
              >
                {renderRow(rows[item.index] as TData, item.index)}
              </div>
            ))}
          </div>
        )}
      </div>
    </ScrollRegion>
  );
}
