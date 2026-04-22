import * as React from "react";

import { cn } from "@/lib/utils";

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        "mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--card-strong)] px-4 py-2 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none",
        className,
      )}
      {...props}
    />
  );
}
