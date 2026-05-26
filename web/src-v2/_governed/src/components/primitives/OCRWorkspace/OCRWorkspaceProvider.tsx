import { useMemo, useState } from "react";
import type { OCRWorkspaceProviderProps } from "../../../../types/datatable";
import { OCRWorkspaceContext } from "./OCRWorkspaceContext";

export function OCRWorkspaceProvider({
  children,
  defaultActivePageId,
  defaultScale = 1,
  defaultSelectedFieldId = null,
  defaultSelectionId = null,
  defaultSplitMode = "split",
  document,
  boundingBoxes = [],
  extractionFields = [],
}: OCRWorkspaceProviderProps) {
  const [activePageId, setActivePageId] = useState<string | null>(
    defaultActivePageId ?? document.pages[0]?.id ?? null
  );
  const [activeSelectionId, setSelectionId] = useState<string | null>(defaultSelectionId);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(defaultSelectedFieldId);
  const [scale, setScale] = useState(defaultScale);
  const [splitMode, setSplitMode] = useState(defaultSplitMode);

  const value = useMemo(
    () => ({
      activePageId,
      activeSelectionId,
      boundingBoxes,
      document,
      extractionFields,
      scale,
      selectedFieldId,
      splitMode,
      setActivePageId,
      setScale,
      setSelectedFieldId,
      setSelectionId,
      setSplitMode,
    }),
    [activePageId, activeSelectionId, boundingBoxes, document, extractionFields, scale, selectedFieldId, splitMode]
  );

  return <OCRWorkspaceContext.Provider value={value}>{children}</OCRWorkspaceContext.Provider>;
}
