import * as React from "react";

import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "destructive";
type ButtonSize = "default" | "compact" | "icon";
type ResolvedButtonVariant = "primary" | "secondary" | "ghost";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isBusy?: boolean;
  busyLabel?: string;
};

const base =
  "ui-no-select ui-no-callout inline-flex h-[36px] shrink-0 cursor-pointer items-center justify-center gap-2 rounded-control border text-[length:var(--text-base)] font-medium transition-colors duration-[80ms] ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366f1] focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:border-transparent disabled:bg-[var(--action-disabled)] disabled:text-[var(--action-disabled-text)]";

const variants: Record<ButtonVariant, string> = {
  primary:
    "border-transparent bg-[var(--action-primary)] text-[var(--action-primary-text)] hover:bg-[var(--action-primary-hover)] active:bg-[var(--action-primary-active)]",
  secondary:
    "border-[color:var(--action-secondary-border)] bg-[var(--action-secondary)] text-[var(--action-secondary-text)] hover:bg-[var(--action-secondary-hover)]",
  outline:
    "border-[color:var(--action-secondary-border)] bg-[var(--action-secondary)] text-[var(--action-secondary-text)] hover:bg-[var(--action-secondary-hover)]",
  ghost:
    "border-transparent bg-transparent text-[var(--text-link)] hover:bg-[var(--action-ghost-hover)] hover:text-[var(--text-link-hover)]",
  destructive:
    "border-transparent bg-[var(--action-primary)] text-[var(--action-primary-text)] hover:bg-[var(--action-primary-hover)] active:bg-[var(--action-primary-active)]",
};

const sizes: Record<ButtonSize, string> = {
  default: "px-[var(--space-4)] text-[length:var(--text-base)]",
  compact: "px-[var(--space-4)] text-[length:var(--text-sm)]",
  icon: "aspect-square px-0 text-[length:var(--text-sm)]",
};

function resolveVariant(variant: ButtonVariant): ResolvedButtonVariant {
  if (variant === "outline") return "secondary";
  if (variant === "destructive") return "primary";
  return variant;
}

function ButtonSpinner({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={cn("h-icon w-icon animate-spin", className)}
      style={{ color: 'var(--spinner-color)' }}
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
  const resolvedVariant = resolveVariant(variant);

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
      data-variant={resolvedVariant}
      data-size={size}
      {...props}
    >
      {isBusy ? <ButtonSpinner /> : null}
      {content ? <span className="truncate">{content}</span> : null}
    </button>
  );
});
