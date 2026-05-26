import { useEffect, useState } from "react";
import { readPersistedValue, writePersistedValue } from "../storage.utils";

export function usePersistentEngineState<T>(key: string | undefined, initialValue: T) {
  const [value, setValue] = useState<T>(() => (key ? readPersistedValue(key, initialValue) : initialValue));

  useEffect(() => {
    if (!key) {
      return;
    }

    writePersistedValue(key, value);
  }, [key, value]);

  return [value, setValue] as const;
}
