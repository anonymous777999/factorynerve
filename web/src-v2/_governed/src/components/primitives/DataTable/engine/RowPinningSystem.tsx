import type { ReactNode } from "react";
import { useDataTableEngine } from "./hooks";

export function RowPinningSystem({
  rowId,
  children,
}: {
  rowId: string;
  children?: ReactNode | ((api: { pinBottom: () => void; pinTop: () => void; unpin: () => void }) => ReactNode);
}) {
  const { pinRow } = useDataTableEngine();

  const api = {
    pinBottom: () => pinRow(rowId, "bottom"),
    pinTop: () => pinRow(rowId, "top"),
    unpin: () => pinRow(rowId, null),
  };

  return <>{typeof children === "function" ? children(api) : children}</>;
}
