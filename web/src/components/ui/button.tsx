import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "ui-no-select ui-no-callout inline-flex items-center justify-center gap-2 rounded-full border font-semibold tracking-tight transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "border-[var(--accent-soft)] bg-[linear-gradient(135deg,var(--accent),var(--accent-strong))] text-[#fbf3ec] shadow-[0_14px_30px_rgba(197,109,45,0.28)] hover:-translate-y-0.5 hover:brightness-105 hover:shadow-[0_18px_38px_rgba(197,109,45,0.34)]",
        secondary:
          "border-white/8 bg-[linear-gradient(180deg,rgba(32,45,67,0.92),rgba(23,33,49,0.96))] text-[var(--text)] shadow-[0_10px_24px_rgba(2,6,23,0.2)] hover:-translate-y-0.5 hover:border-white/14 hover:bg-[linear-gradient(180deg,rgba(39,54,78,0.96),rgba(26,37,56,0.98))]",
        outline:
          "border-[var(--border-strong)] bg-white/[0.02] text-[var(--text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] hover:-translate-y-0.5 hover:border-[var(--accent-soft)] hover:bg-[var(--accent-quiet)]",
        ghost:
          "border-transparent bg-transparent text-[var(--text)] hover:-translate-y-0.5 hover:border-white/8 hover:bg-white/[0.05]",
        destructive:
          "border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.12)] text-red-100 shadow-[0_10px_24px_rgba(239,68,68,0.16)] hover:-translate-y-0.5 hover:bg-[rgba(239,68,68,0.18)]",
      },
      size: {
        sm: "h-9 px-4 text-[0.8125rem]",
        md: "h-11 px-5 text-sm",
        lg: "h-12 px-7 text-base",
        icon: "h-11 w-11 p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { buttonVariants };
