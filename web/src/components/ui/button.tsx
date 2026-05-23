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
  "ui-no-select ui-no-callout inline-flex shrink-0 items-center justify-center gap-sm rounded-control border font-medium transition-[background-color,border-color,color,box-shadow,opacity] duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-1 focus-visible:ring-offset-surface-app disabled:cursor-not-allowed disabled:border-action-disabled disabled:bg-action-disabled disabled:text-action-disabled-text";

const variants: Record<ButtonVariant, string> = {
  primary:
    "border-action-primary bg-action-primary text-action-primary-text shadow-xs hover:bg-action-primary-hover active:bg-action-primary-active",
  secondary:
    "border-action-secondary-border bg-action-secondary text-action-secondary-text shadow-xs hover:bg-action-secondary-hover",
  outline:
    "border-border-default bg-surface-panel text-text-primary shadow-none hover:bg-surface-hover",
  ghost:
    "border-transparent bg-transparent text-text-secondary hover:bg-action-ghost-hover hover:text-text-primary",
  destructive:
    "border-action-destructive bg-action-destructive text-text-inverse shadow-xs hover:bg-action-destructive-hover active:bg-action-destructive-hover",
};

const sizes: Record<ButtonSize, string> = {
  default: "h-button px-sm text-label",
  compact: "h-input px-sm text-label-dense",
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
