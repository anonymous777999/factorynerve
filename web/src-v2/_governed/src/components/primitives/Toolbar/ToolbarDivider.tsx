import type { ComponentPropsWithoutRef } from "react";
import { cx } from "../../../../lib/utils";

export function ToolbarDivider({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      aria-hidden="true"
      className={cx("h-4 w-px shrink-0 bg-[var(--color-border-default)]", className)}
      {...props}
    />
  );
}
