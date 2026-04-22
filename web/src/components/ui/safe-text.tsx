import type { ElementType, HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

type SafeTextProps<T extends ElementType> = {
  as?: T;
  children: ReactNode;
  className?: string;
} & Omit<HTMLAttributes<HTMLElement>, "className" | "children">;

export function SafeText<T extends ElementType = "span">({
  as,
  children,
  className,
  ...props
}: SafeTextProps<T>) {
  const Component = (as || "span") as ElementType;
  return (
    <Component className={cn("overflow-safe-text", className)} {...props}>
      {children}
    </Component>
  );
}
