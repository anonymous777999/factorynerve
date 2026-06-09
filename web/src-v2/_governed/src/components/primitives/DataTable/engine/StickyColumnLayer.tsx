import type { CSSProperties } from "react";
import type { StickyColumnLayerProps } from "../../../../../types/datatable";
import { cx } from "../../../../../lib/utils";
import { useDataTableEngine } from "./hooks";

export function StickyColumnLayer({ columnId, className, style, ...props }: StickyColumnLayerProps) {
  const { columns, hiddenColumnIds, pinnedOffsets } = useDataTableEngine();
  const column = columns.find((item) => item.id === columnId);
  const pin = hiddenColumnIds.has(columnId) ? null : column?.pinned ?? null;

  const resolvedStyle: CSSProperties = {
    ...style,
    ...(pin === "left" ? { left: pinnedOffsets[columnId] ?? 0 } : {}),
    ...(pin === "right" ? { right: pinnedOffsets[`right:${columnId}`] ?? 0 } : {}),
  };

  return (
    <div
      data-column-pin={pin ?? undefined}
      className={cx(
        pin && "sticky z-[var(--z-raised)] bg-[var(--table-bg)]",
        pin === "left" && "shadow-[1px_0_0_var(--color-border-subtle)]",
        pin === "right" && "shadow-[-1px_0_0_var(--color-border-subtle)]",
        className
      )}
      style={resolvedStyle}
      {...props}
    />
  );
}
