import { createContext, useContext } from "react";
import type { TableNavigationContextValue } from "../../../../../types/datatable";

export const TableNavigationContext = createContext<TableNavigationContextValue | null>(null);

export function useTableNavigationContext() {
  const context = useContext(TableNavigationContext);

  if (!context) {
    throw new Error("Advanced DataTable navigation primitives must be used within a DataTableEngineProvider.");
  }

  return context;
}
