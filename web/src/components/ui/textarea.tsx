import * as React from "react";

import {
  getFieldControlClassName,
  useFieldContext,
  type FieldValidationState,
} from "@/components/ui/field";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  validationState?: FieldValidationState;
};

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    className,
    id: idProp,
    rows = 3,
    validationState: validationStateProp,
    "aria-invalid": ariaInvalidProp,
    "aria-describedby": ariaDescribedByProp,
    ...props
  },
  ref,
) {
  const fieldContext = useFieldContext();
  const validationState = validationStateProp ?? fieldContext?.validationState ?? "default";
  const isInvalid = validationState === "invalid";

  const id = idProp ?? fieldContext?.id;
  const ariaDescribedBy =
    ariaDescribedByProp ?? fieldContext?.describedById ?? undefined;
  const ariaInvalid =
    ariaInvalidProp !== undefined ? ariaInvalidProp : isInvalid ? true : undefined;

  return (
    <textarea
      ref={ref}
      id={id}
      rows={rows}
      className={getFieldControlClassName({
        className,
        validationState,
        multiline: true,
      })}
      aria-invalid={ariaInvalid}
      aria-describedby={ariaDescribedBy}
      {...props}
    />
  );
});
