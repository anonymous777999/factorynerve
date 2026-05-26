import { cx } from "../../../../lib/utils";
import type { FeedbackPriorityLayerProps } from "../../../../types/datatable";
import { useFeedback } from "./hooks";
import { sortFeedbackItems } from "./feedback.utils";

export function FeedbackPriorityLayer({ items, className, children, ...props }: FeedbackPriorityLayerProps) {
  const { feedbackItems } = useFeedback();
  const source = sortFeedbackItems(items ?? feedbackItems);

  return (
    <div className={cx("flex min-w-0 flex-col gap-[var(--spacing-2)]", className)} {...props}>
      {children}
      {source.map((item) => (
        <div key={item.id} data-feedback-priority={item.priority} />
      ))}
    </div>
  );
}
