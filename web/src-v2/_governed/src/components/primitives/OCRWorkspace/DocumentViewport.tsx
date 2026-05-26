import { cx } from "../../../../lib/utils";
import type { DocumentViewportProps } from "../../../../types/datatable";
import { ScrollRegion } from "../Viewport";
import { useOCRWorkspace } from "./hooks";
import { ConfidenceReviewLayer } from "./ConfidenceReviewLayer";
import { OCROverlayLayer } from "./OCROverlayLayer";

export function DocumentViewport({
  children,
  pageSlot,
  className,
  viewportClassName,
  contentClassName,
  ...props
}: DocumentViewportProps) {
  const { activePageId, document, scale } = useOCRWorkspace();
  const pages = document.pages.filter((page) => (activePageId ? page.id === activePageId : true));

  return (
    <ScrollRegion
      ownerId="ocr-document-viewport"
      orientation="both"
      className={cx("min-h-0 min-w-0 flex-1 bg-[var(--color-surface-canvas)]", className)}
      viewportClassName={cx("h-full", viewportClassName)}
      contentClassName={cx("min-h-full p-[var(--spacing-4)]", contentClassName)}
      {...props}
    >
      <div className="mx-auto flex min-h-full w-full max-w-[920px] flex-col gap-[var(--spacing-4)]">
        {pages.map((page, index) => (
          <div
            key={page.id}
            className="relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-surface-primary)] shadow-[var(--shadow-md)]"
            style={{ transform: `scale(${scale})`, transformOrigin: "top center" }}
          >
            {pageSlot ? (
              pageSlot(page, index)
            ) : page.imageSrc ? (
              <img src={page.imageSrc} alt={page.title ?? `Page ${page.pageNumber}`} className="block w-full" />
            ) : (
              <div className="aspect-[1/1.414] w-full bg-[linear-gradient(180deg,var(--color-surface-primary),var(--color-surface-elevated))]" />
            )}
            <OCROverlayLayer />
            <ConfidenceReviewLayer />
          </div>
        ))}
        {children}
      </div>
    </ScrollRegion>
  );
}
