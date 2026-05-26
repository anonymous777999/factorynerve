import type { OCRSelectionSystemProps } from "../../../../types/datatable";
import { useOCRWorkspace } from "./hooks";

export function OCRSelectionSystem({ children }: OCRSelectionSystemProps) {
  const { activeSelectionId, setSelectionId } = useOCRWorkspace();

  const api = {
    isSelected: (boxId: string) => activeSelectionId === boxId,
    select: (boxId: string | null) => setSelectionId(boxId),
  };

  return <>{typeof children === "function" ? children(api) : children}</>;
}
