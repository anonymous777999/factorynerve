import type { ColumnVisibilitySystemProps } from "../../../../../types/datatable";
import { useDataTableEngine } from "./hooks";

export function ColumnVisibilitySystem({ children }: ColumnVisibilitySystemProps) {
  const { hiddenColumnIds, setColumnVisibility } = useDataTableEngine();

  const api = {
    hiddenColumnIds,
    isVisible: (columnId: string) => !hiddenColumnIds.has(columnId),
    toggleColumn: (columnId: string) => setColumnVisibility(columnId, hiddenColumnIds.has(columnId)),
  };

  return <>{typeof children === "function" ? children(api) : children}</>;
}
