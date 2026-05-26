import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ResizeRegionProps,
  ViewportDockSide,
  ViewportResizeAxis,
} from "../../../../../types/datatable";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function readPersistedSize(key?: string) {
  if (!key || typeof window === "undefined") {
    return null;
  }

  const parsed = Number(window.localStorage.getItem(key));
  return Number.isFinite(parsed) ? parsed : null;
}

function getResizeDelta(position: ViewportDockSide, axis: ViewportResizeAxis, start: number, current: number) {
  if (axis === "vertical") {
    return position === "bottom" ? start - current : current - start;
  }

  return position === "right" ? start - current : current - start;
}

export function useViewportResize({
  axis = "horizontal",
  defaultSize = 320,
  maxSize = Number.POSITIVE_INFINITY,
  minSize = 0,
  onSizeChange,
  persistenceKey,
  position = "right",
  size: controlledSize,
}: Pick<
  ResizeRegionProps,
  "axis" | "defaultSize" | "maxSize" | "minSize" | "onSizeChange" | "persistenceKey" | "position" | "size"
>) {
  const [uncontrolledSize, setUncontrolledSize] = useState(() =>
    clamp(readPersistedSize(persistenceKey) ?? defaultSize, minSize, maxSize)
  );
  const resolvedSize = clamp(controlledSize ?? uncontrolledSize, minSize, maxSize);
  const sizeRef = useRef(resolvedSize);

  useEffect(() => {
    sizeRef.current = resolvedSize;
  }, [resolvedSize]);

  useEffect(() => {
    const persisted = readPersistedSize(persistenceKey);
    if (controlledSize !== undefined || persisted === null) {
      return;
    }

    setUncontrolledSize(clamp(persisted, minSize, maxSize));
  }, [controlledSize, maxSize, minSize, persistenceKey]);

  const setSize = useCallback(
    (nextSize: number) => {
      const clamped = clamp(nextSize, minSize, maxSize);

      if (controlledSize === undefined) {
        setUncontrolledSize(clamped);
      }

      if (persistenceKey && typeof window !== "undefined") {
        window.localStorage.setItem(persistenceKey, String(clamped));
      }

      onSizeChange?.(clamped);
    },
    [controlledSize, maxSize, minSize, onSizeChange, persistenceKey]
  );

  const handleResizeStart = useCallback<NonNullable<ResizeRegionProps["onMouseDown"]>>(
    (event) => {
      event.preventDefault();

      const startPointer = axis === "vertical" ? event.clientY : event.clientX;
      const startSize = sizeRef.current;

      const handleMove = (moveEvent: MouseEvent) => {
        const currentPointer = axis === "vertical" ? moveEvent.clientY : moveEvent.clientX;
        const delta = getResizeDelta(position, axis, startPointer, currentPointer);
        setSize(startSize + delta);
      };

      const handleUp = () => {
        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("mouseup", handleUp);
      };

      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
    },
    [axis, position, setSize]
  );

  return {
    handleResizeStart,
    setSize,
    size: resolvedSize,
  };
}
