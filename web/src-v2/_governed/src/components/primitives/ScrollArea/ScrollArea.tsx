import { forwardRef, useState } from "react";
import type { ScrollAreaProps, ScrollAreaOrientation } from "../../../../types/datatable";
import { cx } from "../../../../lib/utils";
import { getInteractionAttributes, getInteractionClassName } from "../Interaction";
import { useScrollShadows } from "./useScrollShadows";

function getViewportOverflow(orientation: ScrollAreaOrientation) {
  switch (orientation) {
    case "horizontal":
      return "overflow-x-auto overflow-y-hidden";
    case "vertical":
      return "overflow-y-auto overflow-x-hidden";
    case "both":
    default:
      return "overflow-auto";
  }
}

export const ScrollArea = forwardRef<HTMLDivElement, ScrollAreaProps>(function ScrollArea(
  {
    children,
    className,
    contentClassName,
    maxHeight,
    orientation = "vertical",
    shadow = true,
    style,
    viewportClassName,
    ...props
  },
  ref
) {
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null);
  const shadows = useScrollShadows(viewport, !shadow);

  return (
    <div
      {...getInteractionAttributes({
        active: shadows.top || shadows.bottom || shadows.left || shadows.right,
      })}
      className={cx(
        "relative min-h-0 min-w-0 overflow-hidden bg-inherit",
        getInteractionClassName({ states: ["active"], target: "viewport" }),
        orientation === "horizontal" && "w-full",
        className
      )}
      style={{ ...style, maxHeight }}
      {...props}
    >
      <div
        ref={(node) => {
          setViewport(node);

          if (typeof ref === "function") {
            ref(node);
          } else if (ref) {
            ref.current = node;
          }
        }}
        className={cx(
          "h-full min-h-0 min-w-0 overscroll-contain [scrollbar-color:var(--prim-neutral-600)_transparent]",
          getViewportOverflow(orientation),
          viewportClassName
        )}
      >
        <div
          className={cx(
            "min-h-full min-w-0",
            orientation !== "vertical" && "w-max min-w-full",
            contentClassName
          )}
        >
          {children}
        </div>
      </div>

      {shadow ? (
        <>
          <div
            aria-hidden="true"
            className={cx(
              "pointer-events-none absolute inset-x-0 top-0 z-[var(--z-raised)] h-3 bg-gradient-to-b from-[var(--color-surface-scrim)] to-transparent transition-opacity duration-[var(--transition-fast)] ease-[var(--ease-operational)]",
              shadows.top ? "opacity-100" : "opacity-0"
            )}
          />
          <div
            aria-hidden="true"
            className={cx(
              "pointer-events-none absolute inset-x-0 bottom-0 z-[var(--z-raised)] h-3 bg-gradient-to-t from-[var(--color-surface-scrim)] to-transparent transition-opacity duration-[var(--transition-fast)] ease-[var(--ease-operational)]",
              shadows.bottom ? "opacity-100" : "opacity-0"
            )}
          />
          <div
            aria-hidden="true"
            className={cx(
              "pointer-events-none absolute inset-y-0 left-0 z-[var(--z-raised)] w-3 bg-gradient-to-r from-[var(--color-surface-scrim)] to-transparent transition-opacity duration-[var(--transition-fast)] ease-[var(--ease-operational)]",
              shadows.left ? "opacity-100" : "opacity-0"
            )}
          />
          <div
            aria-hidden="true"
            className={cx(
              "pointer-events-none absolute inset-y-0 right-0 z-[var(--z-raised)] w-3 bg-gradient-to-l from-[var(--color-surface-scrim)] to-transparent transition-opacity duration-[var(--transition-fast)] ease-[var(--ease-operational)]",
              shadows.right ? "opacity-100" : "opacity-0"
            )}
          />
        </>
      ) : null}
    </div>
  );
});
