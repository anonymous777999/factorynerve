import { useMemo } from "react";
import { buildVirtualItems } from "../engine.utils";

export function useVirtualizedRows(
  keys: string[],
  rowHeight: number,
  viewportHeight: number,
  scrollTop: number,
  overscan: number
) {
  return useMemo(
    () => buildVirtualItems(keys, rowHeight, viewportHeight, scrollTop, overscan),
    [keys, overscan, rowHeight, scrollTop, viewportHeight]
  );
}
