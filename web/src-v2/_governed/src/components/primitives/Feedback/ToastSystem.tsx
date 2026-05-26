import { cx } from "../../../../lib/utils";
import type { ToastSystemProps } from "../../../../types/datatable";
import { getInteractionAttributes, getInteractionClassName } from "../Interaction";
import { ProgressIndicator } from "./ProgressIndicator";
import { getFeedbackPriorityClassName } from "./feedback.utils";

export function ToastSystem({ item, onDismiss, className, ...props }: ToastSystemProps) {
  return (
    <div
      role="status"
      aria-live={item.priority === "blocking" || item.priority === "critical" ? "assertive" : "polite"}
      {...getInteractionAttributes({
        critical: item.priority === "critical" || item.priority === "blocking",
        warning: item.priority === "warning" || item.priority === "escalation",
        reviewed: item.priority === "ai-review",
      })}
      className={cx(
        "min-w-[320px] max-w-[420px] rounded-[var(--radius-lg)] border px-[var(--spacing-4)] py-[var(--spacing-3)] shadow-[var(--shadow-lg)]",
        getInteractionClassName({ states: ["critical", "warning", "reviewed"], target: "surface" }),
        getFeedbackPriorityClassName(item.priority),
        className
      )}
      {...props}
    >
      <div className="flex items-start gap-[var(--spacing-3)]">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] uppercase tracking-[0.05em]">{item.priority}</div>
          <div className="mt-[2px] text-[12px] font-medium">{item.title}</div>
          {item.description ? <div className="mt-[4px] text-[12px] leading-[1.5] opacity-90">{item.description}</div> : null}
          {typeof item.progress === "number" ? (
            <div className="mt-[var(--spacing-3)]">
              <ProgressIndicator value={item.progress} priority={item.priority} />
            </div>
          ) : null}
          {item.meta ? <div className="mt-[var(--spacing-2)] text-[11px] opacity-75">{item.meta}</div> : null}
        </div>
        {!item.persistent && onDismiss ? (
          <button
            type="button"
            onClick={() => onDismiss(item.id)}
            {...getInteractionAttributes({ hover: true })}
            className={cx(
              "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--radius-sm)]",
              getInteractionClassName({ states: ["hover"], target: "icon-button" })
            )}
          >
            ×
          </button>
        ) : null}
      </div>
    </div>
  );
}
