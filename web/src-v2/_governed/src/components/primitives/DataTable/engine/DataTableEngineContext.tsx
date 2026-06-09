import { createContext, useContext } from "react";
import type { DataTableEngineContextValue } from "../../../../../types/datatable";

export const DataTableEngineContext = createContext<DataTableEngineContextValue | null>(null);

export function useDataTableEngineContext() {
  const context = useContext(DataTableEngineContext);

  if (!context) {
    throw new Error("Advanced DataTable engine primitives must be used within a DataTableEngineProvider.");
  }

  return context;
}
