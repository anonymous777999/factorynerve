import * as React from "react";

import { cn } from "@/lib/utils";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "w-full h-11 rounded-xl border border-border bg-[rgba(255,255,255,0.05)] px-4 py-2 text-base text-text-primary placeholder:text-text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-fast focus:outline-none focus:border-primary/60 focus:bg-[rgba(255,255,255,0.07)] focus:ring-2 focus:ring-primary/20 disabled:bg-bg disabled:text-text-muted disabled:cursor-not-allowed",
        className,
      )}
      {...props}
    />
  );
}
