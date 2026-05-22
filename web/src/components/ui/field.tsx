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
  "w-full rounded-control border border-border-default bg-surface-panel text-body text-text-primary shadow-inset transition-[background-color,border-color,color,box-shadow] duration-fast ease-standard placeholder:text-text-tertiary focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-border-focus disabled:bg-surface-shell disabled:text-text-disabled";

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
    multiline ? "mt-sm min-h-textarea px-md py-sm" : "mt-sm h-input px-md",
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
        "ui-no-select ui-no-callout block text-label font-medium text-text-secondary",
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
        "mt-xs text-label-dense",
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
