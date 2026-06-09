import { forwardRef, useEffect, useId } from "react";
import { cx } from "../../../../lib/utils";
import type { ViewportBoundaryProps } from "../../../../types/datatable";
import { useViewportContext } from "./ViewportContext";

export const ViewportBoundary = forwardRef<HTMLDivElement, ViewportBoundaryProps>(function ViewportBoundary(
  { ownerId, className, ...props },
  ref
) {
  const generatedId = useId();
  const regionId = ownerId ?? `fn-viewport-boundary-${generatedId}`;
  const { registerRegion, setBoundaryNode } = useViewportContext();

  useEffect(() => registerRegion({ id: regionId, role: "boundary" }), [regionId, registerRegion]);

  return (
    <div
      ref={(node) => {
        setBoundaryNode(node);

        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      }}
      data-viewport-boundary={regionId}
      className={cx("relative min-h-0 min-w-0 overflow-hidden isolate", className)}
      {...props}
    />
  );
});
