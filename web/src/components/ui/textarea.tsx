import * as React from "react";

import {
  getFieldControlClassName,
  type FieldValidationState,
} from "@/components/ui/field";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  validationState?: FieldValidationState;
};

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    className,
    rows = 3,
    validationState = "default",
    ...props
  },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={getFieldControlClassName({
        className,
        validationState,
        multiline: true,
      })}
      {...props}
    />
  );
});
