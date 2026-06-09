import type { RowExpansionSystemProps } from "../../../../../types/datatable";
import { useDataTableEngine } from "./hooks";

export function RowExpansionSystem({ children }: RowExpansionSystemProps) {
  const { expandedRowIds, setExpanded } = useDataTableEngine();

  const api = {
    collapseAll: () => {
      expandedRowIds.forEach((rowId) => setExpanded(rowId, false));
    },
    isExpanded: (rowId: string) => expandedRowIds.has(rowId),
    toggleExpanded: (rowId: string) => setExpanded(rowId, !expandedRowIds.has(rowId)),
  };

  return <>{typeof children === "function" ? children(api) : children}</>;
}
