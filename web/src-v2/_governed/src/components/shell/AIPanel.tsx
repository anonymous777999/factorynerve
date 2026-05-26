import { useState } from "react";
import type {
  AIAnalysisSummaryBarProps,
  AIPanelContainerProps,
} from "../../../types/datatable";
import { cx } from "../../../lib/utils";
import { getInteractionAttributes, getInteractionClassName } from "../primitives/Interaction";
import { PanelBody, PanelFooter, PanelHeader, PanelSection } from "../primitives/Panel";
import { DockRegion, ScrollRegion } from "../primitives/Viewport";

function AISparkle({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <path
        d="M6.5 1L7.9 5.4H12L8.5 7.9L9.9 12.3L6.5 9.8L3.1 12.3L4.5 7.9L1 5.4H5.1L6.5 1Z"
        fill="currentColor"
      />
    </svg>
  );
}

function XIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 11 11" fill="none" aria-hidden="true">
      <path d="M8.5 2.5L2.5 8.5M2.5 2.5L8.5 8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function ChevronClose({ position = "right" }: { position?: "left" | "right" }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
      className={position === "left" ? "rotate-180" : undefined}
    >
      <path d="M9 11L5 7L9 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AIAnalysisSummaryBar({ summary, className }: AIAnalysisSummaryBarProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) {
    return null;
  }

  return (
    <div
      role="status"
      aria-label="AI analysis result"
      className={cx(
        "flex h-9 shrink-0 items-center gap-[var(--spacing-3)] border-b border-[var(--prim-blue-700)] bg-[var(--color-accent-ai-surface,var(--prim-blue-950))] px-[var(--spacing-4)]",
        className
      )}
    >
      <span className="shrink-0 text-[var(--prim-blue-300)]">
        <AISparkle size={12} />
      </span>
      <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--prim-blue-300)]">{summary.message}</span>
      {summary.actions?.length ? (
        <div className="flex shrink-0 items-center gap-[var(--spacing-1)]">
          {summary.actions.map((action, index) => (
            <button
              key={action.id ?? `${action.label}-${index}`}
              type="button"
              onClick={action.onClick}
              {...getInteractionAttributes({ aiActive: true, hover: true, selected: true })}
              className={cx(
                "inline-flex h-[22px] items-center rounded-[var(--radius-sm)] border border-[var(--prim-blue-700)] bg-[var(--prim-blue-900)] px-[var(--spacing-2)] text-[11px] font-medium text-[var(--prim-blue-200)]",
                getInteractionClassName({
                  states: ["hover", "selected", "ai-active"],
                  target: "button",
                  tone: "ai",
                })
              )}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
      {summary.onDismiss ? (
        <button
          type="button"
          onClick={() => {
            summary.onDismiss?.();
            setDismissed(true);
          }}
          aria-label="Dismiss AI analysis"
          {...getInteractionAttributes({ hover: true, aiActive: true })}
          className={cx(
            "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[var(--prim-blue-400)]",
            getInteractionClassName({ states: ["hover", "ai-active"], target: "icon-button", tone: "ai" })
          )}
        >
          <XIcon />
        </button>
      ) : null}
    </div>
  );
}

export function AIPanelContainer({
  open,
  width: controlledWidth,
  minWidth = 280,
  maxWidth = 480,
  mode = "docked",
  position = "right",
  persistenceKey = "factorynerve.panel.ai.width",
  onClose,
  context,
  footerSlot,
  children,
  className,
}: AIPanelContainerProps) {
  if (!open) {
    return null;
  }

  const overlayPositionClassName =
    position === "left" ? "left-0 border-r border-l-0" : "right-0";
  const sideBorderClassName = position === "left" ? "border-r border-l-0" : "border-l";

  return (
    <DockRegion
      side={position}
      size={controlledWidth}
      defaultSize={controlledWidth ?? 360}
      minSize={minWidth}
      maxSize={maxWidth}
      persistenceKey={persistenceKey}
      resizable
      className={cx(
        "relative z-[var(--z-panel)] flex h-full shrink-0 flex-col overflow-hidden rounded-none border-[var(--prim-blue-700)] bg-[var(--ai-panel-bg,var(--prim-neutral-850))] text-[var(--color-text-secondary)]",
        sideBorderClassName,
        mode === "overlay" &&
          cx("absolute top-0 shadow-[var(--shadow-xl)]", overlayPositionClassName),
        className
      )}
      style={{ minWidth, maxWidth }}
    >
      <aside role="complementary" aria-label="AI Copilot" className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <PanelHeader
        className="border-b-[var(--prim-blue-800)] bg-[var(--ai-panel-header-bg,var(--color-surface-elevated))] text-[var(--prim-blue-200)]"
        title={<span className="text-[14px] font-medium text-[var(--prim-blue-200)]">AI Copilot</span>}
        actions={
          onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close AI panel"
              {...getInteractionAttributes({ hover: true, aiActive: true })}
              className={cx(
                "inline-flex h-6 w-6 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)]",
                getInteractionClassName({ states: ["hover", "ai-active"], target: "icon-button", tone: "ai" })
              )}
            >
              <ChevronClose position={position} />
            </button>
          ) : undefined
        }
      >
        <div className="flex min-w-0 flex-1 items-center gap-[var(--spacing-2)]">
          <span className="shrink-0 text-[var(--prim-blue-400)]">
            <AISparkle />
          </span>
          <span className="truncate text-[14px] font-medium text-[var(--prim-blue-200)]">AI Copilot</span>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close AI panel"
            {...getInteractionAttributes({ hover: true, aiActive: true })}
            className={cx(
              "inline-flex h-6 w-6 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)]",
              getInteractionClassName({ states: ["hover", "ai-active"], target: "icon-button", tone: "ai" })
            )}
          >
            <ChevronClose position={position} />
          </button>
        ) : null}
      </PanelHeader>

        {context ? (
          <PanelSection
          inset={false}
          className="shrink-0 gap-[var(--spacing-1)] border-b border-[var(--prim-blue-800)] bg-[var(--color-accent-ai-surface,var(--prim-blue-950))] px-[var(--spacing-4)] py-[10px]"
          >
          <div className="text-[11px] uppercase tracking-[0.06em] text-[var(--prim-blue-400)]">
            Context: {context.title}
          </div>
          {context.metrics ? <div className="text-[12px] text-[var(--color-text-muted)]">{context.metrics}</div> : null}
          {context.selectedLabel ? (
            <div className="pt-[var(--spacing-2)]">
              <div className="text-[11px] uppercase tracking-[0.06em] text-[var(--prim-blue-400)]">Selected row</div>
              <div className="font-[var(--font-mono)] text-[12px] text-[var(--prim-blue-200)]">{context.selectedLabel}</div>
              {context.selectedMeta ? (
                <div className="text-[11px] text-[var(--color-text-muted)]">{context.selectedMeta}</div>
              ) : null}
            </div>
          ) : null}
          </PanelSection>
        ) : null}

        <PanelBody
          padding="none"
          className="bg-[var(--ai-panel-bg,var(--prim-neutral-850))]"
        >
          <ScrollRegion
            ownerId="ai-panel-scroll"
            className="h-full"
            viewportClassName="h-full"
            contentClassName="min-h-full"
          >
            {children}
          </ScrollRegion>
        </PanelBody>

        {footerSlot ? (
          <PanelFooter className="border-t-[var(--prim-blue-800)] bg-[var(--color-surface-elevated)]">
            {footerSlot}
          </PanelFooter>
        ) : null}
      </aside>
    </DockRegion>
  );
}
