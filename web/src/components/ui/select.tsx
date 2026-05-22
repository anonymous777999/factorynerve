import * as React from "react";

import {
  getFieldControlClassName,
  type FieldValidationState,
} from "@/components/ui/field";

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  validationState?: FieldValidationState;
};

export function Select({
  className,
  validationState = "default",
  ...props
}: SelectProps) {
  return (
    <select
      className={getFieldControlClassName({
        className: `pr-lg ${className || ""}`,
        validationState,
      })}
      {...props}
    />
  );
}
