import { cx } from "../../../../lib/utils";
import type { OperationalAlertProps } from "../../../../types/datatable";
import { PanelSection } from "../Panel";
import { getFeedbackPriorityClassName } from "./feedback.utils";

export function OperationalAlert({
  title,
  description,
  action,
  priority = "critical",
  className,
  ...props
}: OperationalAlertProps) {
  return (
    <PanelSection
      inset={false}
      className={cx(
        "rounded-[var(--radius-md)] border px-[var(--spacing-4)] py-[var(--spacing-3)]",
        getFeedbackPriorityClassName(priority),
        className
      )}
      title={title}
      description={description}
      action={action}
      {...props}
    />
  );
}
