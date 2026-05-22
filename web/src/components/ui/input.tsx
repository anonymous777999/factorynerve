import * as React from "react";

import {
  getFieldControlClassName,
  type FieldValidationState,
} from "@/components/ui/field";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  validationState?: FieldValidationState;
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    className,
    validationState = "default",
    ...props
  },
  ref,
) {
  return (
    <input
      ref={ref}
      className={getFieldControlClassName({ className, validationState })}
      {...props}
    />
  );
});
