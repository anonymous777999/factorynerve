import { useState } from "react";
import type { PopoverPlacement } from "../../../../types/datatable";
import { resolveFloatingPlacement } from "../shared/positioning";
import { useIsomorphicLayoutEffect } from "../shared/useIsomorphicLayoutEffect";

const POPOVER_FALLBACKS: Record<PopoverPlacement, string[]> = {
  "bottom-end": ["bottom-end", "bottom-start", "top-end", "top-start"],
  "bottom-start": ["bottom-start", "bottom-end", "top-start", "top-end"],
  "top-end": ["top-end", "top-start", "bottom-end", "bottom-start"],
  "top-start": ["top-start", "top-end", "bottom-start", "bottom-end"],
};

export function usePopoverPosition(
  open: boolean,
  trigger: HTMLElement | null,
  content: HTMLDivElement | null,
  placement: PopoverPlacement,
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
        POPOVER_FALLBACKS[placement],
        offset
      );

      setPosition({
        left: nextPosition.left,
        placement: nextPosition.placement as PopoverPlacement,
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
