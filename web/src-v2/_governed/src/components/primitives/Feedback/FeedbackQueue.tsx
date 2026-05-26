import { cx } from "../../../../lib/utils";
import type { FeedbackQueueProps } from "../../../../types/datatable";
import { useFeedback } from "./hooks";
import { filterFeedbackItems, sortFeedbackItems } from "./feedback.utils";
import { ToastSystem } from "./ToastSystem";

export function FeedbackQueue({ items, scope, className, ...props }: FeedbackQueueProps) {
  const { dismissFeedback, feedbackItems } = useFeedback();
  const source = items ?? feedbackItems;
  const queue = sortFeedbackItems(filterFeedbackItems(source, scope));

  return (
    <div className={cx("flex min-w-0 flex-col gap-[var(--spacing-2)]", className)} {...props}>
      {queue.map((item) => (
        <ToastSystem key={item.id} item={item} onDismiss={dismissFeedback} />
      ))}
    </div>
  );
}
