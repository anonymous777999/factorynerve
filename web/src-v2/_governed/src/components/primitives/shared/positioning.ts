export type ViewportSide = "top" | "right" | "bottom" | "left";

type AxisPlacement = "start" | "center" | "end";

export interface FloatingRect {
  height: number;
  width: number;
}

export interface FloatingCoordinates {
  left: number;
  placement: string;
  top: number;
}

const DEFAULT_VIEWPORT_PADDING = 12;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getViewportBounds(viewportPadding = DEFAULT_VIEWPORT_PADDING) {
  return {
    bottom: window.innerHeight - viewportPadding,
    left: viewportPadding,
    right: window.innerWidth - viewportPadding,
    top: viewportPadding,
  };
}

function splitPlacement(placement: string): [ViewportSide, AxisPlacement] {
  const [side, align] = placement.split("-");
  return [side as ViewportSide, (align as AxisPlacement | undefined) ?? "center"];
}

function getAlignedLeft(
  side: ViewportSide,
  align: AxisPlacement,
  anchorRect: DOMRect,
  floatingRect: FloatingRect
) {
  if (side === "top" || side === "bottom") {
    if (align === "start") {
      return anchorRect.left;
    }

    if (align === "end") {
      return anchorRect.right - floatingRect.width;
    }

    return anchorRect.left + (anchorRect.width - floatingRect.width) / 2;
  }

  return side === "left"
    ? anchorRect.left - floatingRect.width
    : anchorRect.right;
}

function getAlignedTop(
  side: ViewportSide,
  align: AxisPlacement,
  anchorRect: DOMRect,
  floatingRect: FloatingRect
) {
  if (side === "left" || side === "right") {
    if (align === "start") {
      return anchorRect.top;
    }

    if (align === "end") {
      return anchorRect.bottom - floatingRect.height;
    }

    return anchorRect.top + (anchorRect.height - floatingRect.height) / 2;
  }

  return side === "top"
    ? anchorRect.top - floatingRect.height
    : anchorRect.bottom;
}

function offsetForSide(side: ViewportSide, offset: number) {
  switch (side) {
    case "top":
      return { x: 0, y: -offset };
    case "bottom":
      return { x: 0, y: offset };
    case "left":
      return { x: -offset, y: 0 };
    case "right":
      return { x: offset, y: 0 };
  }
}

function getOverflowScore(left: number, top: number, floatingRect: FloatingRect, viewportPadding = DEFAULT_VIEWPORT_PADDING) {
  const bounds = getViewportBounds(viewportPadding);

  const overflowLeft = Math.max(0, bounds.left - left);
  const overflowRight = Math.max(0, left + floatingRect.width - bounds.right);
  const overflowTop = Math.max(0, bounds.top - top);
  const overflowBottom = Math.max(0, top + floatingRect.height - bounds.bottom);

  return overflowLeft + overflowRight + overflowTop + overflowBottom;
}

export function resolveFloatingPlacement(
  anchorRect: DOMRect,
  floatingRect: FloatingRect,
  placements: string[],
  offset: number,
  viewportPadding = DEFAULT_VIEWPORT_PADDING
): FloatingCoordinates {
  const bounds = getViewportBounds(viewportPadding);

  let bestPlacement = placements[0] ?? "bottom";
  let bestTop = bounds.top;
  let bestLeft = bounds.left;
  let lowestOverflow = Number.POSITIVE_INFINITY;

  for (const placement of placements) {
    const [side, align] = splitPlacement(placement);
    const baseLeft = getAlignedLeft(side, align, anchorRect, floatingRect);
    const baseTop = getAlignedTop(side, align, anchorRect, floatingRect);
    const sideOffset = offsetForSide(side, offset);
    const left = baseLeft + sideOffset.x;
    const top = baseTop + sideOffset.y;
    const overflow = getOverflowScore(left, top, floatingRect, viewportPadding);

    if (overflow < lowestOverflow) {
      lowestOverflow = overflow;
      bestPlacement = placement;
      bestLeft = left;
      bestTop = top;

      if (overflow === 0) {
        break;
      }
    }
  }

  return {
    left: clamp(bestLeft, bounds.left, Math.max(bounds.left, bounds.right - floatingRect.width)),
    placement: bestPlacement,
    top: clamp(bestTop, bounds.top, Math.max(bounds.top, bounds.bottom - floatingRect.height)),
  };
}
