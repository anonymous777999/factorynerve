import { cx } from "../../../../lib/utils";
import type { BoundingBoxSystemProps } from "../../../../types/datatable";
import { getInteractionAttributes, getInteractionClassName } from "../Interaction";
import { useOCRWorkspace } from "./hooks";

export function BoundingBoxSystem({ box, className, ...props }: BoundingBoxSystemProps) {
  const { activeSelectionId, extractionFields, selectedFieldId, setSelectedFieldId, setSelectionId } = useOCRWorkspace();
  const linkedField = extractionFields.find((field) => field.boundingBoxId === box.id);
  const selected = activeSelectionId === box.id;
  const fieldSelected = linkedField?.id === selectedFieldId;
  const warning = typeof box.confidence === "number" && box.confidence < 0.72;
  const critical = box.reviewState === "failed" || box.anomaly;
  const selectBox = () => {
    setSelectionId(selected ? null : box.id);
    if (linkedField) {
      setSelectedFieldId(linkedField.id);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected || fieldSelected}
      {...getInteractionAttributes({
        hover: true,
        selected: selected || fieldSelected,
        warning,
        critical,
        reviewed: box.reviewState === "reviewed",
        aiActive: box.reviewState === "corrected",
      })}
      className={cx(
        "absolute rounded-[var(--radius-sm)] border bg-transparent text-left",
        "border-[color-mix(in_srgb,var(--color-border-default)_70%,transparent)]",
        getInteractionClassName({
          states: ["hover", "selected", "warning", "critical", "reviewed", "ai-active"],
          target: "surface",
        }),
        (selected || fieldSelected) && "shadow-[inset_0_0_0_2px_var(--color-accent-operational)]",
        className
      )}
      style={{
        left: `${box.x}%`,
        top: `${box.y}%`,
        width: `${box.width}%`,
        height: `${box.height}%`,
      }}
      onClick={selectBox}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectBox();
        }
      }}
      {...props}
    >
      {box.label ? (
        <span className="absolute -top-[18px] left-0 rounded-[var(--radius-sm)] bg-[var(--color-surface-primary)] px-[var(--spacing-1)] py-px text-[10px] uppercase tracking-[0.04em] text-[var(--color-text-muted)]">
          {box.label}
        </span>
      ) : null}
    </div>
  );
}
