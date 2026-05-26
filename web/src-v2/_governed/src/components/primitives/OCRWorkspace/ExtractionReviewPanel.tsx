import { cx } from "../../../../lib/utils";
import type { ExtractionReviewPanelProps } from "../../../../types/datatable";
import { getInteractionAttributes, getInteractionClassName } from "../Interaction";
import { Panel, PanelSection } from "../Panel";
import { ScrollRegion } from "../Viewport";
import { useOCRWorkspace } from "./hooks";

export function ExtractionReviewPanel({ fields, className, ...props }: ExtractionReviewPanelProps) {
  const workspace = useOCRWorkspace();
  const source = fields ?? workspace.extractionFields;

  return (
    <Panel variant="inspector" padding="none" className={cx("h-full min-h-0 rounded-none", className)} {...props}>
      <ScrollRegion ownerId="ocr-review-panel" className="h-full" viewportClassName="h-full">
        <div className="flex min-h-full flex-col gap-[var(--spacing-3)] p-[var(--spacing-4)]">
          {source.map((field) => {
            const selected = workspace.selectedFieldId === field.id;
            const warning = typeof field.confidence === "number" && field.confidence < 0.72;
            const critical = field.reviewState === "failed";

            return (
              <PanelSection
                key={field.id}
                inset={false}
                className={cx(
                  "rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-surface-primary)] px-[var(--spacing-3)] py-[var(--spacing-3)]",
                  getInteractionClassName({ states: ["selected", "warning", "critical"], target: "surface" }),
                  selected && "shadow-[inset_2px_0_0_var(--color-accent-operational)]"
                )}
                {...getInteractionAttributes({ selected, warning, critical })}
              >
                <button
                  type="button"
                  className="flex w-full min-w-0 flex-col items-start gap-[var(--spacing-1)] text-left"
                  onClick={() => workspace.setSelectedFieldId(selected ? null : field.id)}
                >
                  <span className="text-[11px] uppercase tracking-[var(--tracking-label)] text-[var(--color-text-muted)]">
                    {field.label}
                  </span>
                  <span className="min-w-0 truncate text-[13px] text-[var(--color-text-primary)]">{field.value}</span>
                  {field.meta ? <span className="min-w-0 truncate text-[11px] text-[var(--color-text-muted)]">{field.meta}</span> : null}
                </button>
              </PanelSection>
            );
          })}
        </div>
      </ScrollRegion>
    </Panel>
  );
}
