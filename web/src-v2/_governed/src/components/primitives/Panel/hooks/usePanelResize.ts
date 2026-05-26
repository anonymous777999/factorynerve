import { useCallback, useEffect, useRef, useState } from "react";
import type { UsePanelResizeOptions, UsePanelResizeReturn } from "../../../../../types/datatable";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function readPersistedWidth(key?: string) {
  if (!key || typeof window === "undefined") {
    return null;
  }

  const parsed = Number(window.localStorage.getItem(key));
  return Number.isFinite(parsed) ? parsed : null;
}

export function usePanelResize({
  initialWidth = 360,
  minWidth = 280,
  maxWidth = 480,
  persistenceKey,
  position = "right",
}: UsePanelResizeOptions = {}): UsePanelResizeReturn {
  const [width, setWidthState] = useState(() => clamp(readPersistedWidth(persistenceKey) ?? initialWidth, minWidth, maxWidth));
  const widthRef = useRef(width);

  useEffect(() => {
    widthRef.current = width;
  }, [width]);

  useEffect(() => {
    const persisted = readPersistedWidth(persistenceKey);
    if (persisted !== null) {
      setWidthState(clamp(persisted, minWidth, maxWidth));
      return;
    }

    setWidthState(clamp(initialWidth, minWidth, maxWidth));
  }, [initialWidth, minWidth, maxWidth, persistenceKey]);

  const setWidth = useCallback(
    (nextWidth: number) => {
      const clamped = clamp(nextWidth, minWidth, maxWidth);
      setWidthState(clamped);
      if (persistenceKey && typeof window !== "undefined") {
        window.localStorage.setItem(persistenceKey, String(clamped));
      }
    },
    [maxWidth, minWidth, persistenceKey]
  );

  const handleDragStart = useCallback<UsePanelResizeReturn["handleDragStart"]>(
    (event) => {
      event.preventDefault();

      const startX = event.clientX;
      const startWidth = widthRef.current;

      const handleMove = (moveEvent: MouseEvent) => {
        const delta = position === "left" ? moveEvent.clientX - startX : startX - moveEvent.clientX;
        setWidth(startWidth + delta);
      };

      const handleUp = () => {
        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("mouseup", handleUp);
      };

      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
    },
    [position, setWidth]
  );

  return {
    width,
    setWidth,
    handleDragStart,
  };
}
