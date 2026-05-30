import * as React from "react";

import { cn } from "@/lib/utils";

export type FieldValidationState = "default" | "invalid" | "valid";

type FieldContextValue = {
  id?: string;
  describedById?: string;
  validationState: FieldValidationState;
  registerHelperText: (id: string) => void;
  unregisterHelperText: (id: string) => void;
};

const FieldContext = React.createContext<FieldContextValue | null>(null);

export function useFieldContext() {
  return React.useContext(FieldContext);
}

type FieldProps = React.HTMLAttributes<HTMLDivElement> & {
  /**
   * Optional explicit id to associate with the field control.
   * If omitted, a stable id is generated and forwarded through context.
   */
  id?: string;
  validationState?: FieldValidationState;
};

type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement> & {
  required?: boolean;
  validationState?: FieldValidationState;
};

type HelperTextProps = React.HTMLAttributes<HTMLParagraphElement> & {
  validationState?: FieldValidationState;
  id?: string;
};

type FieldControlClassNameOptions = {
  className?: string;
  validationState?: FieldValidationState;
  multiline?: boolean;
};

const fieldBase =
  "w-full appearance-none rounded-[8px] border-[0.5px] border-[color:var(--color-border-secondary)] bg-[var(--color-background-primary)] text-[14px] text-[var(--color-text-primary)] transition-[background-color,border-color,color,box-shadow] duration-fast ease-standard placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:border-accent disabled:cursor-not-allowed disabled:bg-surface-shell disabled:text-text-disabled";

const fieldValidationStates: Record<FieldValidationState, string> = {
  default: "",
  // Calm red error state: subtle red background + red border + maintained text contrast.
  // On focus the indigo accent ring is replaced by the red focus ring so the error stays visible.
  invalid: cn(
    "border-status-danger-border bg-status-danger-bg text-text-primary",
    "aria-[invalid=true]:border-border-danger",
    "focus:border-status-danger-border focus:ring-status-danger-border",
  ),
  valid: "border-status-success-border text-text-primary",
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

export function Field({
  className,
  id: idProp,
  validationState = "default",
  children,
  ...props
}: FieldProps) {
  const generatedId = React.useId();
  const fieldId = idProp ?? generatedId;

  const [helperIds, setHelperIds] = React.useState<string[]>([]);

  const registerHelperText = React.useCallback((helperId: string) => {
    setHelperIds((prev) => (prev.includes(helperId) ? prev : [...prev, helperId]));
  }, []);

  const unregisterHelperText = React.useCallback((helperId: string) => {
    setHelperIds((prev) => prev.filter((existing) => existing !== helperId));
  }, []);

  const describedById = helperIds.length > 0 ? helperIds.join(" ") : undefined;

  const contextValue = React.useMemo<FieldContextValue>(
    () => ({
      id: fieldId,
      describedById,
      validationState,
      registerHelperText,
      unregisterHelperText,
    }),
    [fieldId, describedById, validationState, registerHelperText, unregisterHelperText],
  );

  return (
    <FieldContext.Provider value={contextValue}>
      <div
        className={cn("field-group mb-4 min-w-0", className)}
        data-validation-state={validationState}
        {...props}
      >
        {children}
      </div>
    </FieldContext.Provider>
  );
}

export function Label({
  children,
  className,
  required = false,
  htmlFor,
  validationState,
  ...props
}: LabelProps) {
  const fieldContext = useFieldContext();
  // We deliberately do NOT auto-resolve htmlFor from FieldContext to avoid
  // creating dangling htmlFor references when sibling controls (e.g. Select)
  // do not yet participate in the FieldContext id system. Callers can still
  // pass htmlFor explicitly when they need an association.
  const resolvedValidationState =
    validationState ?? fieldContext?.validationState ?? "default";

  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        "ui-no-select ui-no-callout mb-1 block text-[11px] font-medium text-[var(--color-text-secondary)]",
        resolvedValidationState === "invalid" ? "text-status-danger-fg" : "",
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
  validationState,
  id,
  ...props
}: HelperTextProps) {
  const fieldContext = useFieldContext();
  const generatedId = React.useId();
  const helperId = id ?? `${fieldContext?.id ?? generatedId}-helper`;

  const resolvedValidationState =
    validationState ?? fieldContext?.validationState ?? "default";
  const isError = resolvedValidationState === "invalid";

  // Register this helper id with the surrounding field so the control can wire
  // up aria-describedby automatically.
  const { registerHelperText, unregisterHelperText } = fieldContext ?? {};
  React.useEffect(() => {
    if (!registerHelperText || !unregisterHelperText) {
      return;
    }
    registerHelperText(helperId);
    return () => {
      unregisterHelperText(helperId);
    };
  }, [helperId, registerHelperText, unregisterHelperText]);

  return (
    <p
      id={helperId}
      role={isError ? "alert" : undefined}
      aria-live={isError ? "polite" : undefined}
      className={cn(
        "mt-xs text-label-dense leading-snug",
        isError
          ? "text-status-danger-fg"
          : resolvedValidationState === "valid"
            ? "text-status-success-fg"
            : "text-text-tertiary",
        className,
      )}
      {...props}
    />
  );
}
