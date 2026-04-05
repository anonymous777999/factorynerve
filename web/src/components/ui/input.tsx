import * as React from "react";

import { cn } from "@/lib/utils";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--card-strong)] px-4 py-2 text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none",
        className,
      )}
      {...props}
    />
  );
}

