import { cx } from "../../../../lib/utils";
import type { WorkflowBannerProps } from "../../../../types/datatable";
import { getInteractionAttributes, getInteractionClassName } from "../Interaction";
import { getFeedbackPriorityClassName } from "./feedback.utils";

export function WorkflowBanner({
  title,
  description,
  action,
  priority = "operational",
  className,
  ...props
}: WorkflowBannerProps) {
  return (
    <div
      role="status"
      {...getInteractionAttributes({
        critical: priority === "critical" || priority === "blocking",
        warning: priority === "warning" || priority === "escalation",
        reviewed: priority === "ai-review",
      })}
      className={cx(
        "flex items-start gap-[var(--spacing-3)] border-b px-[var(--spacing-4)] py-[var(--spacing-3)]",
        getInteractionClassName({ states: ["critical", "warning", "reviewed"], target: "toolbar" }),
        getFeedbackPriorityClassName(priority),
        className
      )}
      {...props}
    >
      <div className="min-w-0 flex-1">
        <div className="text-[11px] uppercase tracking-[0.05em]">{title}</div>
        {description ? <div className="mt-[2px] text-[12px] leading-[1.5] opacity-90">{description}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
