import * as React from "react";

import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "destructive";
type ButtonSize = "default" | "compact" | "icon";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isBusy?: boolean;
  busyLabel?: string;
};

const base =
  "ui-no-select ui-no-callout inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-[8px] border-[0.5px] text-[13px] font-medium transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-fast ease-standard active:scale-[0.98] focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_rgb(var(--color-border-info)/0.4)] disabled:cursor-not-allowed disabled:border-action-disabled disabled:bg-action-disabled disabled:text-action-disabled-text";

const variants: Record<ButtonVariant, string> = {
  primary:
    "border-transparent bg-[var(--color-text-primary)] text-[var(--color-background-primary)] hover:opacity-95",
  secondary:
    "border-transparent bg-[var(--color-text-primary)] text-[var(--color-background-primary)] hover:opacity-95",
  outline:
    "border-[color:var(--color-border-secondary)] bg-transparent text-[var(--color-text-secondary)] hover:bg-surface-hover",
  ghost:
    "border-[color:var(--color-border-secondary)] bg-transparent text-[var(--color-text-secondary)] hover:bg-surface-hover hover:text-[var(--color-text-primary)]",
  destructive:
    "border-[color:var(--color-border-danger)] bg-transparent text-[var(--color-text-danger)] hover:bg-status-danger-bg",
};

const sizes: Record<ButtonSize, string> = {
  default: "min-h-[38px] px-[18px] py-2",
  compact: "min-h-[34px] px-3 py-1.5",
  icon: "h-button aspect-square px-0",
};

function ButtonSpinner({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={cn("h-icon w-icon animate-spin", className)}
    >
      <circle
        cx="8"
        cy="8"
        r="6"
        className="opacity-30"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M14 8a6 6 0 0 0-6-6"
        className="opacity-100"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    children,
    className,
    disabled,
    isBusy = false,
    busyLabel,
    size = "default",
    type = "button",
    variant = "primary",
    ...props
  },
  ref,
) {
  const content = isBusy && busyLabel ? busyLabel : children;

  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        base,
        variants[variant],
        sizes[size],
        isBusy ? "pointer-events-none opacity-90" : "",
        className,
      )}
      disabled={disabled || isBusy}
      aria-busy={isBusy}
      data-busy={isBusy ? "true" : "false"}
      data-variant={variant}
      data-size={size}
      {...props}
    >
      {isBusy ? <ButtonSpinner /> : null}
      {content ? <span className="truncate">{content}</span> : null}
    </button>
  );
});
