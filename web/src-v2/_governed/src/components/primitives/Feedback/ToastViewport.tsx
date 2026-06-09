import { createPortal } from "react-dom";
import { cx } from "../../../../lib/utils";
import type { ToastViewportProps } from "../../../../types/datatable";
import { usePortalContainer } from "../shared/usePortalContainer";
import { useFeedback } from "./hooks";
import { ToastSystem } from "./ToastSystem";

export function ToastViewport({ limit = 4, className, ...props }: ToastViewportProps) {
  const container = usePortalContainer("factorynerve-feedback-layer");
  const { dismissFeedback, feedbackItems } = useFeedback();

  if (!container) {
    return null;
  }

  return createPortal(
    <div
      className={cx("pointer-events-none fixed right-[var(--spacing-4)] top-[var(--spacing-4)] z-[var(--z-top)] flex w-[420px] max-w-[calc(100vw-32px)] flex-col gap-[var(--spacing-2)]", className)}
      {...props}
    >
      {feedbackItems.slice(0, limit).map((item) => (
        <div key={item.id} className="pointer-events-auto">
          <ToastSystem item={item} onDismiss={dismissFeedback} />
        </div>
      ))}
    </div>,
    container
  );
}
