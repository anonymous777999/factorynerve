import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-[var(--accent)] text-[#fbf3ec]",
        secondary:
          "border-[var(--border)] bg-[var(--card-strong)] text-[var(--text)]",
        outline: "border-[var(--border)] text-[var(--muted)]",
        success:
          "border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.12)] text-[#8ef0b0]",
        warning:
          "border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.12)] text-[#f7cb73]",
        danger:
          "border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.12)] text-[#f4a3a3]",
        destructive:
          "border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.12)] text-[#f4a3a3]",
        signal:
          "border-[rgba(31,138,120,0.35)] bg-[rgba(31,138,120,0.14)] text-[#7fd8c6]",
        neutral:
          "border-[var(--border)] bg-[var(--card)] text-[var(--muted)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { badgeVariants };
