import { forwardRef } from "react";
import { cx } from "../../../../lib/utils";
import { getInteractionAttributes, getInteractionClassName } from "../Interaction";
import type { ToolbarProps } from "./toolbar.types";
import { TOOLBAR_SURFACE_CLASSNAME } from "./toolbar.tokens";

export const Toolbar = forwardRef<HTMLDivElement, ToolbarProps>(function Toolbar(
  {
    sticky = true,
    surface = "workspace",
    className,
    role = "toolbar",
    ...props
  },
  ref
) {
  return (
    <div
      ref={ref}
      role={role}
      {...getInteractionAttributes({ active: sticky })}
      className={cx(
        "flex min-h-[var(--toolbar-height)] shrink-0 items-center gap-[var(--spacing-2)] border-b px-[var(--spacing-4)] text-[var(--color-text-secondary)]",
        sticky && "sticky top-0 z-[var(--z-raised)]",
        getInteractionClassName({ states: ["active"], target: "toolbar", tone: surface === "ai" ? "ai" : "neutral" }),
        TOOLBAR_SURFACE_CLASSNAME[surface],
        className
      )}
      {...props}
    />
  );
});
