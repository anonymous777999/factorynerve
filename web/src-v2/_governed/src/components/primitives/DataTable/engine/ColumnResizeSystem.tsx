import { useRef } from "react";
import type { ColumnResizeSystemProps } from "../../../../../types/datatable";
import { cx } from "../../../../../lib/utils";
import { getInteractionAttributes, getInteractionClassName } from "../../Interaction";
import { useDataTableEngine } from "./hooks";

export function ColumnResizeSystem({ columnId, className, ...props }: ColumnResizeSystemProps) {
  const startXRef = useRef(0);
  const widthRef = useRef(0);
  const { columns, updateColumnWidth, widths } = useDataTableEngine();

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      {...getInteractionAttributes({ hover: true, active: false })}
      className={cx(
        "absolute inset-y-0 right-0 z-[var(--z-raised)] w-[6px] cursor-col-resize touch-none opacity-0",
        getInteractionClassName({ states: ["hover", "active"], target: "resize-handle" }),
        className
      )}
      onPointerDown={(event) => {
        const column = columns.find((item) => item.id === columnId);
        startXRef.current = event.clientX;
        widthRef.current = widths[columnId] ?? column?.width ?? 160;

        const handleMove = (moveEvent: PointerEvent) => {
          const delta = moveEvent.clientX - startXRef.current;
          updateColumnWidth(columnId, widthRef.current + delta);
        };

        const handleUp = () => {
          window.removeEventListener("pointermove", handleMove);
          window.removeEventListener("pointerup", handleUp);
        };

        window.addEventListener("pointermove", handleMove);
        window.addEventListener("pointerup", handleUp);
      }}
      {...props}
    />
  );
}
