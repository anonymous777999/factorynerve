import { cx } from "../../../../lib/utils";
import type { DocumentViewportProps } from "../../../../types/datatable";
import { useRef, useState, type PointerEvent } from "react";
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
  const { activePageId, boundingBoxes, document, scale, setScale } = useOCRWorkspace();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const dragStartRef = useRef<{ left: number; pointerX: number; pointerY: number; top: number } | null>(null);
  const [magnifierEnabled, setMagnifierEnabled] = useState(false);
  const [magnifier, setMagnifier] = useState({ x: 50, y: 50, visible: false });
  const pages = document.pages.filter((page) => (activePageId ? page.id === activePageId : true));
  const activePage = pages[0] ?? null;
  const lowConfidenceCount = boundingBoxes.filter(
    (box) =>
      (!activePageId || box.pageId === activePageId) &&
      (box.anomaly || box.reviewState === "failed" || (typeof box.confidence === "number" && box.confidence < 0.72)),
  ).length;

  const clampScale = (nextScale: number) => Math.max(0.5, Math.min(2.75, Number(nextScale.toFixed(2))));
  const updateScale = (nextScale: number) => setScale(clampScale(nextScale));

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.target instanceof HTMLButtonElement) {
      return;
    }
    const viewport = scrollRef.current;
    if (!viewport) {
      return;
    }
    dragStartRef.current = {
      left: viewport.scrollLeft,
      pointerX: event.clientX,
      pointerY: event.clientY,
      top: viewport.scrollTop,
    };
    viewport.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const viewport = scrollRef.current;
    if (magnifierEnabled && viewport) {
      const rect = viewport.getBoundingClientRect();
      setMagnifier({
        x: Math.max(0, Math.min(100, ((event.clientX - rect.left + viewport.scrollLeft) / Math.max(viewport.scrollWidth, 1)) * 100)),
        y: Math.max(0, Math.min(100, ((event.clientY - rect.top + viewport.scrollTop) / Math.max(viewport.scrollHeight, 1)) * 100)),
        visible: true,
      });
    }

    if (!dragStartRef.current || !viewport) {
      return;
    }
    viewport.scrollLeft = dragStartRef.current.left - (event.clientX - dragStartRef.current.pointerX);
    viewport.scrollTop = dragStartRef.current.top - (event.clientY - dragStartRef.current.pointerY);
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (scrollRef.current?.hasPointerCapture(event.pointerId)) {
      scrollRef.current.releasePointerCapture(event.pointerId);
    }
    dragStartRef.current = null;
  };

  return (
    <ScrollRegion
      ref={scrollRef}
      ownerId="ocr-document-viewport"
      orientation="both"
      className={cx("min-h-0 min-w-0 flex-1 bg-[var(--color-surface-canvas)]", className)}
      viewportClassName={cx("h-full cursor-grab active:cursor-grabbing", viewportClassName)}
      contentClassName={cx("min-h-full p-[var(--spacing-3)]", contentClassName)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={(event) => {
        setMagnifier((current) => ({ ...current, visible: false }));
        handlePointerUp(event);
      }}
      {...props}
    >
      <div className="sticky top-0 z-[var(--z-overlay)] mb-[var(--spacing-3)] flex flex-wrap items-center justify-between gap-[var(--spacing-2)] border-b border-[var(--color-border-default)] bg-[color-mix(in_srgb,var(--color-surface-canvas)_92%,transparent)] px-[var(--spacing-2)] py-[var(--spacing-2)] backdrop-blur">
        <div className="flex items-center gap-[var(--spacing-2)] text-[11px] uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
          <span className="font-[var(--font-mono)] text-[var(--color-text-secondary)]">{Math.round(scale * 100)}%</span>
          <span className={cx(lowConfidenceCount > 0 ? "text-[var(--color-status-warning-text)]" : "text-[var(--color-status-ok-text)]")}>
            {lowConfidenceCount > 0 ? `${lowConfidenceCount} scan focus areas` : "Scan quality stable"}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-[var(--spacing-1)]">
          <button type="button" className="fn-btn fn-btn-secondary fn-btn-sm" onClick={() => updateScale(scale - 0.15)}>
            Zoom -
          </button>
          <button type="button" className="fn-btn fn-btn-secondary fn-btn-sm" onClick={() => updateScale(scale + 0.15)}>
            Zoom +
          </button>
          <button type="button" className="fn-btn fn-btn-secondary fn-btn-sm" onClick={() => updateScale(1)}>
            Reset
          </button>
          <button type="button" className="fn-btn fn-btn-secondary fn-btn-sm" onClick={() => updateScale(0.92)}>
            Fit width
          </button>
          <button type="button" className="fn-btn fn-btn-secondary fn-btn-sm" onClick={() => updateScale(0.72)}>
            Fit height
          </button>
          <button
            type="button"
            className={cx("fn-btn fn-btn-sm", magnifierEnabled ? "fn-btn-ai" : "fn-btn-secondary")}
            onClick={() => setMagnifierEnabled((current) => !current)}
          >
            Magnifier
          </button>
        </div>
      </div>
      <div className="mx-auto flex min-h-full w-full max-w-[1080px] flex-col gap-[var(--spacing-3)]">
        {pages.map((page, index) => (
          <div
            key={page.id}
            className="relative overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-surface-primary)] shadow-[var(--shadow-md)]"
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
      {magnifierEnabled && magnifier.visible && activePage?.imageSrc ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed right-[24px] top-[160px] z-[var(--z-toast)] h-[180px] w-[180px] rounded-full border border-[var(--color-accent-operational-border)] bg-[var(--color-surface-primary)] shadow-[0_0_0_9999px_transparent,var(--shadow-lg)]"
          style={{
            backgroundImage: `url(${activePage.imageSrc})`,
            backgroundPosition: `${magnifier.x}% ${magnifier.y}%`,
            backgroundRepeat: "no-repeat",
            backgroundSize: `${Math.round(220 * scale)}% auto`,
          }}
        />
      ) : null}
    </ScrollRegion>
  );
}
