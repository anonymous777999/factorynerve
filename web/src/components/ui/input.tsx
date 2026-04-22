import * as React from "react";

import { cn } from "@/lib/utils";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "mt-2 w-full rounded-2xl border border-[var(--border)] bg-[linear-gradient(180deg,rgba(26,36,54,0.94),rgba(19,27,41,0.98))] px-4 py-3 text-sm text-[var(--text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] placeholder:text-[var(--muted)] focus:border-sky-300/45 focus:bg-[linear-gradient(180deg,rgba(30,43,64,0.98),rgba(21,31,47,0.98))] focus:outline-none focus:ring-2 focus:ring-[rgba(76,176,255,0.14)]",
        className,
      )}
      {...props}
    />
  );
}
