import type { ColumnPinningSystemProps } from "../../../../../types/datatable";
import { useDataTableEngine } from "./hooks";

export function ColumnPinningSystem({ children, columnId }: ColumnPinningSystemProps) {
  const { setColumnPin } = useDataTableEngine();

  if (typeof children === "function") {
    return children({
      pin: (side) => setColumnPin(columnId, side),
      unpin: () => setColumnPin(columnId, null),
    });
  }

  return <>{children}</>;
}
