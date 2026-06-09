import { useMemo } from "react";
import type { ReactNode } from "react";

export function useSemanticCellMeta(primary: ReactNode, secondary?: ReactNode) {
  return useMemo(
    () => ({
      meta: secondary,
      stacked: Boolean(secondary),
      value: primary,
    }),
    [primary, secondary]
  );
}
