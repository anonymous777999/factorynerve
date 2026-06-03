"use client";

import { useEffect, useState } from "react";

import { useInViewOnce } from "./use-in-view-once";

type AnimatedMetricProps = {
  value: number;
  format: (n: number) => string;
  className?: string;
  durationMs?: number;
};

export function AnimatedMetric({
  value,
  format,
  className,
  durationMs = 400,
}: AnimatedMetricProps) {
  const [display, setDisplay] = useState(0);
  const { ref, inView } = useInViewOnce("-10%");

  useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      setDisplay(Math.round(value * t));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView, value, durationMs]);

  return (
    <span ref={ref} className={className}>
      {format(display)}
    </span>
  );
}
