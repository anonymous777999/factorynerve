import { forwardRef } from "react";
import { cx } from "../../../../lib/utils";
import type { WorkspaceViewportProps } from "../../../../types/datatable";

const SURFACE_CLASSNAME: Record<NonNullable<WorkspaceViewportProps["surface"]>, string> = {
  ai: "bg-[var(--color-accent-ai-surface,var(--prim-blue-950))]",
  canvas: "bg-[var(--color-surface-canvas)]",
  workspace: "bg-[var(--color-surface-primary)]",
};

export const WorkspaceViewport = forwardRef<HTMLElement, WorkspaceViewportProps>(function WorkspaceViewport(
  { surface = "canvas", className, ...props },
  ref
) {
  return (
    <section
      ref={ref}
      className={cx(
        "relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
        SURFACE_CLASSNAME[surface],
        className
      )}
      {...props}
    />
  );
});
