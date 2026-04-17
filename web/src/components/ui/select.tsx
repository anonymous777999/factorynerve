import * as React from "react";

import { cn } from "@/lib/utils";

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        "w-full h-11 rounded-xl border border-border bg-card-elevated px-4 py-2 text-base leading-[1.5] text-text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-fast focus:outline-none focus:border-primary/60 focus:bg-card focus:ring-2 focus:ring-primary/20 disabled:bg-bg disabled:text-text-muted disabled:cursor-not-allowed",
        className,
      )}
      {...props}
    />
  );
}
