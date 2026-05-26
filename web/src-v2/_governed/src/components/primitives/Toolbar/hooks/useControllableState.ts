import { useCallback, useState } from "react";

export function useControllableState<T>({
  defaultValue,
  onChange,
  value,
}: {
  defaultValue: T;
  onChange?: (nextValue: T) => void;
  value?: T;
}) {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const controlled = value !== undefined;
  const currentValue = controlled ? value : uncontrolledValue;

  const setValue = useCallback(
    (nextValue: T) => {
      if (!controlled) {
        setUncontrolledValue(nextValue);
      }

      onChange?.(nextValue);
    },
    [controlled, onChange]
  );

  return [currentValue, setValue] as const;
}
