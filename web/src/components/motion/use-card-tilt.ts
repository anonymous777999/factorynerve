"use client";

import { useCallback, useRef } from "react";

const MAX = 4;

export function useCardTilt() {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = useCallback((e: React.MouseEvent) => {
    if (!ref.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    const r = ref.current.getBoundingClientRect();
    const rx = ((e.clientY - r.top) / r.height - 0.5) * -MAX;
    const ry = ((e.clientX - r.left) / r.width - 0.5) * MAX;
    ref.current.style.setProperty("--rx", `${rx}deg`);
    ref.current.style.setProperty("--ry", `${ry}deg`);
  }, []);

  const onLeave = useCallback(() => {
    if (!ref.current) return;
    ref.current.style.setProperty("--rx", "0deg");
    ref.current.style.setProperty("--ry", "0deg");
  }, []);

  return { ref, onMove, onLeave, className: "premium-card-tilt" };
}
