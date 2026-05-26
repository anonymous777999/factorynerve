import { useEffect, useId, useMemo, useState } from "react";
import type { ViewportProviderProps, ViewportRegionRegistration } from "../../../../types/datatable";
import { cx } from "../../../../lib/utils";
import { ViewportContext } from "./ViewportContext";

export function ViewportProvider({
  boundaryId,
  children,
  className,
  lockBodyScroll = true,
  ...props
}: ViewportProviderProps) {
  const generatedId = useId();
  const resolvedBoundaryId = boundaryId ?? `fn-viewport-${generatedId}`;
  const [boundaryNode, setBoundaryNode] = useState<HTMLDivElement | null>(null);
  const [activeScrollRegionId, setActiveScrollRegionId] = useState<string | null>(null);
  const [regions, setRegions] = useState<Map<string, ViewportRegionRegistration>>(new Map());

  useEffect(() => {
    if (!lockBodyScroll || typeof document === "undefined") {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [lockBodyScroll]);

  const value = useMemo(
    () => ({
      activeScrollRegionId,
      boundaryId: resolvedBoundaryId,
      boundaryNode,
      regions,
      registerRegion(region: ViewportRegionRegistration) {
        setRegions((current) => {
          const next = new Map(current);
          next.set(region.id, region);
          return next;
        });

        return () => {
          setRegions((current) => {
            const next = new Map(current);
            next.delete(region.id);

            if (activeScrollRegionId === region.id) {
              setActiveScrollRegionId(null);
            }

            return next;
          });
        };
      },
      setActiveScrollRegionId,
      setBoundaryNode,
    }),
    [activeScrollRegionId, boundaryNode, regions, resolvedBoundaryId]
  );

  return (
    <ViewportContext.Provider value={value}>
      <div className={cx("min-h-0 min-w-0", className)} {...props}>
        {children}
      </div>
    </ViewportContext.Provider>
  );
}
