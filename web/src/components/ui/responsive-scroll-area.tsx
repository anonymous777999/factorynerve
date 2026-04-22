"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type ResponsiveScrollAreaProps = {
  children: React.ReactNode;
  className?: string;
  viewportClassName?: string;
  innerClassName?: string;
  debugLabel?: string;
  showIndicators?: boolean;
};

export function ResponsiveScrollArea({
  children,
  className,
  viewportClassName,
  innerClassName,
  debugLabel,
  showIndicators = true,
}: ResponsiveScrollAreaProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useMemo(
    () => () => {
      const node = viewportRef.current;
      if (!node) return;
      const maxScrollLeft = Math.max(0, node.scrollWidth - node.clientWidth);
      setCanScrollLeft(node.scrollLeft > 4);
      setCanScrollRight(maxScrollLeft - node.scrollLeft > 4);
    },
    [],
  );

  useEffect(() => {
    updateScrollState();
    const node = viewportRef.current;
    if (!node) return;

    const handleScroll = () => updateScrollState();
    const resizeObserver = new ResizeObserver(() => updateScrollState());

    node.addEventListener("scroll", handleScroll, { passive: true });
    resizeObserver.observe(node);
    Array.from(node.children).forEach((child) => resizeObserver.observe(child));
    window.addEventListener("resize", updateScrollState);

    return () => {
      node.removeEventListener("scroll", handleScroll);
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateScrollState);
    };
  }, [updateScrollState]);

  return (
    <div
      className={cn("responsive-scroll-area relative w-full max-w-full", className)}
      data-overflow-scroll-area="true"
      data-approved-horizontal-scroll="true"
      data-scroll-debug-label={debugLabel || undefined}
    >
      {showIndicators ? (
        <>
          <div
            className={cn(
              "responsive-scroll-area__indicator responsive-scroll-area__indicator--left",
              canScrollLeft ? "opacity-100" : "opacity-0",
            )}
          />
          <div
            className={cn(
              "responsive-scroll-area__indicator responsive-scroll-area__indicator--right",
              canScrollRight ? "opacity-100" : "opacity-0",
            )}
          />
        </>
      ) : null}
      <div
        ref={viewportRef}
        className={cn("responsive-scroll-area__viewport overflow-x-auto overflow-y-hidden", viewportClassName)}
      >
        <div className={cn("responsive-scroll-area__inner min-w-full", innerClassName)}>{children}</div>
      </div>
    </div>
  );
}
