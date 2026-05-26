import { useState } from "react";
import type { TooltipPlacement } from "../../../../types/datatable";
import { resolveFloatingPlacement } from "../shared/positioning";
import { useIsomorphicLayoutEffect } from "../shared/useIsomorphicLayoutEffect";

const TOOLTIP_FALLBACKS: Record<TooltipPlacement, string[]> = {
  bottom: ["bottom", "top", "right", "left"],
  left: ["left", "right", "top", "bottom"],
  right: ["right", "left", "top", "bottom"],
  top: ["top", "bottom", "right", "left"],
};

export function useTooltipPosition(
  open: boolean,
  trigger: HTMLElement | null,
  content: HTMLDivElement | null,
  placement: TooltipPlacement,
  offset: number
) {
  const [position, setPosition] = useState({ left: 0, placement, top: 0 });

  useIsomorphicLayoutEffect(() => {
    if (!open || !trigger || !content) {
      return;
    }

    const updatePosition = () => {
      const nextPosition = resolveFloatingPlacement(
        trigger.getBoundingClientRect(),
        { height: content.offsetHeight, width: content.offsetWidth },
        TOOLTIP_FALLBACKS[placement],
        offset
      );

      setPosition({
        left: nextPosition.left,
        placement: nextPosition.placement as TooltipPlacement,
        top: nextPosition.top,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [content, offset, open, placement, trigger]);

  return position;
}
