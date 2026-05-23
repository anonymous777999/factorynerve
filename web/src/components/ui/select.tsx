import * as React from "react";

import {
  getFieldControlClassName,
  type FieldValidationState,
} from "@/components/ui/field";

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  validationState?: FieldValidationState;
};

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    className,
    validationState = "default",
    ...props
  },
  ref,
) {
  return (
    <select
      ref={ref}
      className={getFieldControlClassName({
        className: `pr-lg ${className || ""}`,
        validationState,
      })}
      {...props}
    />
  );
});
