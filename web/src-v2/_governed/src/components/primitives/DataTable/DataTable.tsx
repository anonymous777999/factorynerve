import { forwardRef } from "react";
import { DataTableContext } from "./datatable.context";
import type { DataTableProps } from "./datatable.types";
import { getDataTableRootClassName, getDataTableStyle } from "./datatable.variants";

export const DataTable = forwardRef<HTMLTableElement, DataTableProps>(function DataTable(
  {
    density = "default",
    layout = "fixed",
    stickyHeader = true,
    striped = false,
    className,
    style,
    children,
    ...props
  },
  ref
) {
  return (
    <DataTableContext.Provider value={{ density, layout, stickyHeader }}>
      <table
        ref={ref}
        data-density={density}
        data-layout={layout}
        className={getDataTableRootClassName(layout, striped, className)}
        style={{ ...getDataTableStyle(density), ...style }}
        {...props}
      >
        {children}
      </table>
    </DataTableContext.Provider>
  );
});
