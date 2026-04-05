import * as React from "react";

import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "outline" | "ghost";
};

const base =
  "inline-flex items-center justify-center rounded-full border px-5 py-2.5 text-sm font-semibold tracking-[-0.01em] transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0";

const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "border-sky-300/20 bg-[linear-gradient(135deg,var(--accent),var(--accent-strong))] text-[#06111c] shadow-[0_14px_30px_rgba(47,125,255,0.28)] hover:-translate-y-0.5 hover:brightness-105 hover:shadow-[0_18px_38px_rgba(47,125,255,0.34)]",
  secondary:
    "border-white/8 bg-[linear-gradient(180deg,rgba(32,45,67,0.92),rgba(23,33,49,0.96))] text-[var(--text)] shadow-[0_10px_24px_rgba(2,6,23,0.2)] hover:-translate-y-0.5 hover:border-white/14 hover:bg-[linear-gradient(180deg,rgba(39,54,78,0.96),rgba(26,37,56,0.98))]",
  outline:
    "border-[var(--border-strong)] bg-white/[0.02] text-[var(--text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] hover:-translate-y-0.5 hover:border-sky-300/30 hover:bg-[rgba(76,176,255,0.08)]",
  ghost:
    "border-transparent bg-transparent text-[var(--text)] hover:-translate-y-0.5 hover:border-white/8 hover:bg-white/[0.05]",
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button className={cn(base, variants[variant], className)} {...props} />
  );
}
