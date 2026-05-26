import { createContext, useContext } from "react";
import type { FeedbackContextValue } from "../../../../types/datatable";

export const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export function useFeedbackContext() {
  const context = useContext(FeedbackContext);

  if (!context) {
    throw new Error("Feedback primitives must be used within a ToastProvider.");
  }

  return context;
}
