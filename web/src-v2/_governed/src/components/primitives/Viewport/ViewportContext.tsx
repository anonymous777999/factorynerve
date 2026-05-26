import { createContext, useContext } from "react";
import type { ViewportContextValue } from "../../../../types/datatable";

export const ViewportContext = createContext<ViewportContextValue | null>(null);

export function useViewportContext() {
  const context = useContext(ViewportContext);

  if (!context) {
    throw new Error("Viewport primitives must be used within a ViewportProvider.");
  }

  return context;
}
