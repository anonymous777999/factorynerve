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
  "w-full appearance-none rounded-control border-[0.5px] border-border-default bg-surface-elevated text-body text-text-primary transition-[background-color,border-color,color,box-shadow] duration-fast ease-standard placeholder:text-text-tertiary focus:border-border-focus focus:outline-none focus:ring-1 focus:ring-border-focus disabled:bg-surface-shell disabled:text-text-disabled";

const fieldValidationStates: Record<FieldValidationState, string> = {
  default: "",
  invalid:
    "border-status-danger-border text-text-primary focus:border-border-danger focus:ring-border-danger aria-[invalid=true]:border-border-danger aria-[invalid=true]:focus:ring-border-danger",
  valid:
    "border-status-success-border text-text-primary focus:border-border-success focus:ring-border-success",
};

export function getFieldControlClassName({
  className,
  validationState = "default",
  multiline = false,
}: FieldControlClassNameOptions) {
  return cn(
    fieldBase,
    multiline ? "mt-xs min-h-textarea px-sm py-sm" : "mt-xs h-input px-sm",
    fieldValidationStates[validationState],
    className,
  );
}

export function Field({ className, ...props }: FieldProps) {
  return <div className={cn("min-w-0", className)} {...props} />;
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
        "ui-no-select ui-no-callout block text-label-dense font-medium uppercase tracking-wide text-text-secondary",
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
