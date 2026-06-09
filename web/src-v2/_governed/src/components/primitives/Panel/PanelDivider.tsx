import type { ComponentPropsWithoutRef } from "react";
import { cx } from "../../../../lib/utils";

export function PanelDivider({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return <div className={cx("h-px w-full bg-[var(--color-border-default)]", className)} {...props} />;
}
