import { useCallback, useMemo, useState } from "react";
import type { FeedbackContextValue, FeedbackItem, ToastProviderProps } from "../../../../types/datatable";
import { FeedbackContext } from "./FeedbackContext";
import { sortFeedbackItems } from "./feedback.utils";

function createFeedbackId() {
  return `fn-feedback-${Math.random().toString(36).slice(2, 10)}`;
}

export function ToastProvider({ children, initialItems = [] }: ToastProviderProps) {
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>(() => sortFeedbackItems(initialItems));

  const pushFeedback = useCallback<FeedbackContextValue["pushFeedback"]>((item) => {
    const id = item.id ?? createFeedbackId();
    const nextItem: FeedbackItem = {
      ...item,
      id,
      timestamp: item.timestamp ?? Date.now(),
    };

    setFeedbackItems((current) => sortFeedbackItems([nextItem, ...current.filter((entry) => entry.id !== id)]));
    return id;
  }, []);

  const dismissFeedback = useCallback<FeedbackContextValue["dismissFeedback"]>((id) => {
    setFeedbackItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const updateFeedback = useCallback<FeedbackContextValue["updateFeedback"]>((id, updater) => {
    setFeedbackItems((current) =>
      sortFeedbackItems(
        current.map((item) => {
          if (item.id !== id) {
            return item;
          }

          return typeof updater === "function" ? updater(item) : { ...item, ...updater };
        })
      )
    );
  }, []);

  const clearFeedback = useCallback<FeedbackContextValue["clearFeedback"]>((scope) => {
    setFeedbackItems((current) => (scope ? current.filter((item) => item.scope !== scope) : []));
  }, []);

  const value = useMemo(
    () => ({
      dismissFeedback,
      feedbackItems,
      pushFeedback,
      updateFeedback,
      clearFeedback,
    }),
    [clearFeedback, dismissFeedback, feedbackItems, pushFeedback, updateFeedback]
  );

  return <FeedbackContext.Provider value={value}>{children}</FeedbackContext.Provider>;
}
