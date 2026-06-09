import { forwardRef } from "react";
import type { DataTableColumnProps } from "./datatable.types";

export const DataTableColumn = forwardRef<HTMLTableColElement, DataTableColumnProps>(function DataTableColumn(
  { width, minWidth, maxWidth, style, ...props },
  ref
) {
  return (
    <col
      ref={ref}
      style={{
        width,
        minWidth,
        maxWidth,
        ...style,
      }}
      {...props}
    />
  );
});
