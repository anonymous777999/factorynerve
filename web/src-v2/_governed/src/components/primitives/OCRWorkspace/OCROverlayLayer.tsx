import { cx } from "../../../../lib/utils";
import type { OCROverlayLayerProps } from "../../../../types/datatable";
import { BoundingBoxSystem } from "./BoundingBoxSystem";
import { useOCRWorkspace } from "./hooks";

export function OCROverlayLayer({ boxes, className, ...props }: OCROverlayLayerProps) {
  const workspace = useOCRWorkspace();
  const activePageId = workspace.activePageId;
  const source = boxes ?? workspace.boundingBoxes;
  const visibleBoxes = activePageId ? source.filter((box) => box.pageId === activePageId) : source;

  return (
    <div className={cx("pointer-events-none absolute inset-0", className)} {...props}>
      <div className="relative h-full w-full pointer-events-auto">
        {visibleBoxes.map((box) => (
          <BoundingBoxSystem key={box.id} box={box} />
        ))}
      </div>
    </div>
  );
}
