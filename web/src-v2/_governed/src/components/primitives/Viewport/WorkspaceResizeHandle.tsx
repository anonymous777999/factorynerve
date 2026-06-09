import { forwardRef } from "react";
import { cx } from "../../../../lib/utils";
import type { WorkspaceResizeHandleProps } from "../../../../types/datatable";
import { getInteractionAttributes, getInteractionClassName } from "../Interaction";

export const WorkspaceResizeHandle = forwardRef<HTMLDivElement, WorkspaceResizeHandleProps>(function WorkspaceResizeHandle(
  { axis = "horizontal", className, onResizeStart, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      role="separator"
      aria-orientation={axis}
      aria-hidden="true"
      onMouseDown={onResizeStart}
      {...getInteractionAttributes({ active: Boolean(onResizeStart), hover: Boolean(onResizeStart) })}
      className={cx(
        "relative shrink-0 select-none",
        getInteractionClassName({ states: ["hover", "active"], target: "resize-handle" }),
        axis === "horizontal"
          ? "h-full w-1 cursor-col-resize"
          : "h-1 w-full cursor-row-resize",
        className
      )}
      {...props}
    >
      <div
        className={cx(
          "absolute bg-[var(--color-border-default)] transition-colors duration-[var(--transition-fast)] ease-[var(--ease-operational)]",
          axis === "horizontal"
            ? "left-1/2 top-0 h-full w-px -translate-x-1/2"
            : "left-0 top-1/2 h-px w-full -translate-y-1/2"
        )}
      />
    </div>
  );
});
