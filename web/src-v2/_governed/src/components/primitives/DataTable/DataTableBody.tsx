import { forwardRef } from "react";
import type { DataTableBodyProps } from "./datatable.types";
import { getDataTableBodyClassName } from "./datatable.variants";

export const DataTableBody = forwardRef<HTMLTableSectionElement, DataTableBodyProps>(function DataTableBody(
  { empty = false, className, ...props },
  ref
) {
  return <tbody ref={ref} className={getDataTableBodyClassName(empty, className)} {...props} />;
});
