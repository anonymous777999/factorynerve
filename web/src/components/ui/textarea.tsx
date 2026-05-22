import * as React from "react";

import {
  getFieldControlClassName,
  type FieldValidationState,
} from "@/components/ui/field";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  validationState?: FieldValidationState;
};

export function Textarea({
  className,
  rows = 3,
  validationState = "default",
  ...props
}: TextareaProps) {
  return (
    <textarea
      rows={rows}
      className={getFieldControlClassName({
        className,
        validationState,
        multiline: true,
      })}
      {...props}
    />
  );
}
