import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "secondary" | "destructive" | "outline";
};

export function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
        variant === "default" &&
          "border-transparent bg-[var(--accent)] text-white",
        variant === "secondary" &&
          "border-[var(--border)] bg-[var(--card-strong)] text-[var(--text)]",
        variant === "destructive" &&
          "border-red-400/30 bg-[rgba(239,68,68,0.12)] text-red-100",
        variant === "outline" &&
          "border-[var(--border)] text-[var(--muted)]",
        className,
      )}
      {...props}
    />
  );
}
