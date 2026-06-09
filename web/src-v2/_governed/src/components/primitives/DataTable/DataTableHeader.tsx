import { forwardRef } from "react";
import type { DataTableHeaderProps } from "./datatable.types";
import { useDataTableContext } from "./hooks";
import { getDataTableHeaderClassName } from "./datatable.variants";

export const DataTableHeader = forwardRef<HTMLTableSectionElement, DataTableHeaderProps>(function DataTableHeader(
  { sticky, className, ...props },
  ref
) {
  const context = useDataTableContext();

  return (
    <thead
      ref={ref}
      className={getDataTableHeaderClassName(sticky ?? context.stickyHeader, className)}
      {...props}
    />
  );
});
