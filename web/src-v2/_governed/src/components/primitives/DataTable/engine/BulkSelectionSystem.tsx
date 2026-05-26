import type { BulkSelectionSystemProps } from "../../../../../types/datatable";
import { useDataTableEngine } from "./hooks";

export function BulkSelectionSystem({ children }: BulkSelectionSystemProps) {
  const { rowIds, selectedRowIds, setSelection } = useDataTableEngine();

  const api = {
    clear: () => setSelection(new Set()),
    isSelected: (rowId: string) => selectedRowIds.has(rowId),
    selectAll: () => setSelection(new Set(rowIds)),
    toggle: (rowId: string, options?: { rangeTo?: string }) => {
      setSelection((current) => {
        const next = new Set(current);

        if (options?.rangeTo) {
          const start = rowIds.indexOf(rowId);
          const end = rowIds.indexOf(options.rangeTo);
          if (start !== -1 && end !== -1) {
            const [from, to] = start < end ? [start, end] : [end, start];
            rowIds.slice(from, to + 1).forEach((id) => next.add(id));
            return next;
          }
        }

        if (next.has(rowId)) {
          next.delete(rowId);
        } else {
          next.add(rowId);
        }

        return next;
      });
    },
  };

  return <>{typeof children === "function" ? children(api) : children}</>;
}
