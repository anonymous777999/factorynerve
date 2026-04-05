import * as React from "react";

import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "outline" | "ghost";
};

const base =
  "inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] disabled:cursor-not-allowed disabled:opacity-60";

const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-[var(--accent)] text-[#0b0e14] hover:brightness-110",
  secondary: "bg-[var(--card-strong)] text-[var(--text)] hover:bg-[#252b3f]",
  outline: "border border-[var(--border)] text-[var(--text)] hover:bg-[var(--card-strong)]",
  ghost: "text-[var(--text)] hover:bg-[var(--card-strong)]",
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button className={cn(base, variants[variant], className)} {...props} />
  );
}

