import type { UsePanelResizeOptions } from "../types/datatable";
import { usePanelResize } from "../src/components/primitives/Panel/hooks";

export function useAIPanelResize(options: UsePanelResizeOptions = {}) {
  return usePanelResize(options);
}
