import type { FeedbackItem, FeedbackPriority } from "../../../../types/datatable";
import { FEEDBACK_PRIORITY_CLASSNAME, FEEDBACK_PRIORITY_ORDER } from "./feedback.tokens";

export function sortFeedbackItems(items: FeedbackItem[]) {
  return [...items].sort((left, right) => {
    const priorityDelta =
      FEEDBACK_PRIORITY_ORDER.indexOf(left.priority) - FEEDBACK_PRIORITY_ORDER.indexOf(right.priority);

    if (priorityDelta !== 0) {
      return priorityDelta;
    }

    return (right.timestamp ?? 0) - (left.timestamp ?? 0);
  });
}

export function getFeedbackPriorityClassName(priority: FeedbackPriority) {
  return FEEDBACK_PRIORITY_CLASSNAME[priority];
}

export function filterFeedbackItems(items: FeedbackItem[], scope?: string) {
  if (!scope) {
    return items;
  }

  return items.filter((item) => item.scope === scope);
}
