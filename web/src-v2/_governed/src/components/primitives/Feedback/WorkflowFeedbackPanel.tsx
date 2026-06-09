import { cx } from "../../../../lib/utils";
import type { WorkflowFeedbackPanelProps } from "../../../../types/datatable";
import { Panel, PanelHeader } from "../Panel";
import { ScrollRegion } from "../Viewport";
import { FeedbackQueue } from "./FeedbackQueue";

export function WorkflowFeedbackPanel({
  items,
  title = "Operational feedback",
  className,
  ...props
}: WorkflowFeedbackPanelProps) {
  return (
    <Panel
      variant="inspector"
      padding="none"
      className={cx("h-full min-h-0 rounded-none", className)}
      header={<PanelHeader title={title} />}
      {...props}
    >
      <ScrollRegion ownerId="workflow-feedback-panel" className="h-full" viewportClassName="h-full">
        <div className="p-[var(--spacing-4)]">
          <FeedbackQueue items={items} />
        </div>
      </ScrollRegion>
    </Panel>
  );
}
