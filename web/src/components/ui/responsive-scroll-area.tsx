"use client";

import { useCallback, useEffect, useRef, useState, type Ref } from "react";

import { cn } from "@/lib/utils";

type ResponsiveScrollAreaProps = {
  children: React.ReactNode;
  className?: string;
  viewportClassName?: string;
  innerClassName?: string;
  debugLabel?: string;
  showIndicators?: boolean;
  viewportRef?: Ref<HTMLDivElement | null>;
  scrollableY?: boolean;
};

function assignRef<TValue>(ref: Ref<TValue | null> | undefined, value: TValue | null) {
  if (!ref) {
    return;
  }

  if (typeof ref === "function") {
    ref(value);
    return;
  }

  ref.current = value;
}

export function ResponsiveScrollArea({
  children,
  className,
  viewportClassName,
  innerClassName,
  debugLabel,
  showIndicators = true,
  viewportRef,
  scrollableY = true,
}: ResponsiveScrollAreaProps) {
  const internalViewportRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const node = internalViewportRef.current;
    if (!node) return;
    const maxScrollLeft = Math.max(0, node.scrollWidth - node.clientWidth);
    setCanScrollLeft(node.scrollLeft > 4);
    setCanScrollRight(maxScrollLeft - node.scrollLeft > 4);
  }, []);

  useEffect(() => {
    updateScrollState();
    const node = internalViewportRef.current;
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
        ref={(node) => {
          internalViewportRef.current = node;
          assignRef(viewportRef, node);
        }}
        className={cn(
          "responsive-scroll-area__viewport overflow-x-auto",
          scrollableY ? "overflow-y-auto" : "overflow-y-hidden",
          viewportClassName
        )}
      >
        <div className={cn("responsive-scroll-area__inner min-w-full", innerClassName)}>{children}</div>
      </div>
    </div>
  );
}
