import { cx } from "../../../../lib/utils";
import type { AINotificationCenterProps } from "../../../../types/datatable";
import { Panel, PanelSection } from "../Panel";
import { ScrollRegion } from "../Viewport";
import { useFeedback } from "./hooks";
import { sortFeedbackItems } from "./feedback.utils";
import { InlineStatusSystem } from "./InlineStatusSystem";

export function AINotificationCenter({ items, className, ...props }: AINotificationCenterProps) {
  const { feedbackItems } = useFeedback();
  const source = sortFeedbackItems((items ?? feedbackItems).filter((item) => item.priority === "ai-review" || item.category === "ai"));

  return (
    <Panel variant="ai" padding="none" className={cx("h-full min-h-0 rounded-none", className)} {...props}>
      <ScrollRegion ownerId="ai-notification-center" className="h-full" viewportClassName="h-full">
        <div className="flex min-h-full flex-col gap-[var(--spacing-3)] p-[var(--spacing-4)]">
          {source.map((item) => (
            <PanelSection
              key={item.id}
              inset={false}
              className="rounded-[var(--radius-md)] border border-[var(--color-accent-ai-border)] bg-[var(--color-accent-ai-surface)] px-[var(--spacing-3)] py-[var(--spacing-3)]"
              title={item.title}
              description={item.description}
              action={<InlineStatusSystem label={item.priority} priority={item.priority} />}
            >
              {item.meta ? <div className="text-[11px] text-[var(--color-text-muted)]">{item.meta}</div> : null}
            </PanelSection>
          ))}
        </div>
      </ScrollRegion>
    </Panel>
  );
}
