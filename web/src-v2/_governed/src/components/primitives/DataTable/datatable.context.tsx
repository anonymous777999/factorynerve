import { createContext, useContext } from "react";
import type { DataTableLayoutMode, Density } from "../../../../types/datatable";

export interface DataTableContextValue {
  density: Density;
  layout: DataTableLayoutMode;
  stickyHeader: boolean;
}

export const DataTableContext = createContext<DataTableContextValue | null>(null);

export function useDataTableContext() {
  const context = useContext(DataTableContext);

  if (!context) {
    throw new Error("DataTable primitives must be used within a DataTable component.");
  }

  return context;
}
