import { createContext, useContext } from "react";
import type { OCRWorkspaceContextValue } from "../../../../types/datatable";

export const OCRWorkspaceContext = createContext<OCRWorkspaceContextValue | null>(null);

export function useOCRWorkspaceContext() {
  const context = useContext(OCRWorkspaceContext);

  if (!context) {
    throw new Error("OCR workspace primitives must be used within an OCRWorkspaceProvider.");
  }

  return context;
}
