import * as React from "react";

import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "success" | "warning" | "danger";
type ButtonSize = "xs" | "sm" | "md" | "lg" | "xl";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const base =
  "inline-flex items-center justify-center rounded-xl border font-semibold tracking-[-0.01em] transition-all duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:cursor-not-allowed disabled:opacity-60";

const sizes: Record<ButtonSize, string> = {
  xs: "h-8 px-3 text-xs gap-2",
  sm: "h-9 px-4 text-sm gap-2",
  md: "h-10 px-5 text-sm gap-2.5",
  lg: "h-12 px-6 text-base gap-2.5",
  xl: "h-14 px-8 text-lg gap-3",
};

const variants: Record<ButtonVariant, string> = {
  primary:
    "border-primary/60 bg-[linear-gradient(135deg,#4da3ff,#2d8cf0)] text-white shadow-[0_18px_34px_rgba(29,143,255,0.3)] hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0 active:brightness-95",
  secondary:
    "border-secondary/60 bg-[linear-gradient(135deg,#14b8a6,#10988a)] text-white shadow-[0_18px_34px_rgba(20,184,166,0.22)] hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0 active:brightness-95",
  outline:
    "border-border-strong bg-[rgba(255,255,255,0.045)] text-text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:-translate-y-0.5 hover:bg-[rgba(255,255,255,0.08)] active:translate-y-0",
  ghost:
    "border-transparent bg-transparent text-text-primary hover:bg-[rgba(255,255,255,0.06)] hover:-translate-y-0.5 active:translate-y-0",
  success:
    "border-success/60 bg-[linear-gradient(135deg,#22c55e,#16a34a)] text-white shadow-[0_16px_30px_rgba(34,197,94,0.22)] hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0 active:brightness-95",
  warning:
    "border-warning/60 bg-[linear-gradient(135deg,#f59e0b,#d97706)] text-white shadow-[0_16px_30px_rgba(245,158,11,0.24)] hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0 active:brightness-95",
  danger:
    "border-danger/60 bg-[linear-gradient(135deg,#ef4444,#dc2626)] text-white shadow-[0_16px_30px_rgba(239,68,68,0.24)] hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0 active:brightness-95",
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) {
  return (
    <button className={cn(base, sizes[size], variants[variant], className)} {...props} />
  );
}
