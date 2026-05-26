import { cx } from "../../../../lib/utils";
import type { ConfidenceReviewLayerProps } from "../../../../types/datatable";
import { BoundingBoxSystem } from "./BoundingBoxSystem";
import { useOCRWorkspace } from "./hooks";

export function ConfidenceReviewLayer({
  boxes,
  threshold = 0.72,
  className,
  ...props
}: ConfidenceReviewLayerProps) {
  const workspace = useOCRWorkspace();
  const activePageId = workspace.activePageId;
  const source = boxes ?? workspace.boundingBoxes;
  const visibleBoxes = source.filter(
    (box) =>
      (!activePageId || box.pageId === activePageId) &&
      (box.anomaly || box.reviewState === "failed" || (typeof box.confidence === "number" && box.confidence < threshold))
  );

  return (
    <div className={cx("pointer-events-none absolute inset-0", className)} {...props}>
      <div className="relative h-full w-full pointer-events-auto">
        {visibleBoxes.map((box) => (
          <BoundingBoxSystem key={box.id} box={box} className="shadow-[inset_0_0_0_1px_var(--color-status-warning-border)]" />
        ))}
      </div>
    </div>
  );
}
