import * as React from "react";

import { cn } from "@/lib/utils";

export type FieldValidationState = "default" | "invalid" | "valid";

type FieldProps = React.HTMLAttributes<HTMLDivElement>;

type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement> & {
  required?: boolean;
  validationState?: FieldValidationState;
};

type HelperTextProps = React.HTMLAttributes<HTMLParagraphElement> & {
  validationState?: FieldValidationState;
};

type FieldControlClassNameOptions = {
  className?: string;
  validationState?: FieldValidationState;
  multiline?: boolean;
};

const fieldBase =
  "w-full appearance-none rounded-[8px] border-[0.5px] border-[color:var(--color-border-secondary)] bg-[var(--color-background-primary)] text-[14px] text-[var(--color-text-primary)] transition-[background-color,border-color,color,box-shadow] duration-fast ease-standard placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:shadow-[0_0_0_2px_rgb(var(--color-border-info)/0.4)] disabled:cursor-not-allowed disabled:bg-surface-shell disabled:text-text-disabled";

const fieldValidationStates: Record<FieldValidationState, string> = {
  default: "",
  invalid:
    "border-status-danger-border text-text-primary aria-[invalid=true]:border-border-danger",
  valid:
    "border-status-success-border text-text-primary",
};

export function getFieldControlClassName({
  className,
  validationState = "default",
  multiline = false,
}: FieldControlClassNameOptions) {
  return cn(
    fieldBase,
    multiline ? "min-h-[96px] px-3 py-2" : "min-h-[38px] px-3 py-2",
    fieldValidationStates[validationState],
    className,
  );
}

export function Field({ className, ...props }: FieldProps) {
  return <div className={cn("field-group mb-4 min-w-0", className)} {...props} />;
}

export function Label({
  children,
  className,
  required = false,
  validationState = "default",
  ...props
}: LabelProps) {
  return (
    <label
      className={cn(
        "ui-no-select ui-no-callout mb-1 block text-[11px] font-medium text-[var(--color-text-secondary)]",
        validationState === "invalid" ? "text-status-danger-fg" : "",
        className,
      )}
      {...props}
    >
      <span>{children}</span>
      {required ? (
        <span aria-hidden="true" className="ml-xs text-status-danger-fg">
          *
        </span>
      ) : null}
    </label>
  );
}

export function HelperText({
  className,
  validationState = "default",
  ...props
}: HelperTextProps) {
  return (
    <p
      className={cn(
        "mt-xs text-label-dense leading-snug",
        validationState === "invalid"
          ? "text-status-danger-fg"
          : validationState === "valid"
            ? "text-status-success-fg"
            : "text-text-tertiary",
        className,
      )}
      {...props}
    />
  );
}
