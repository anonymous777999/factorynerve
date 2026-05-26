import { useMemo, useState } from "react";
import type { BulkAction, BulkActionBarProps } from "../../../types/datatable";
import { cx } from "../../../lib/utils";
import { getInteractionAttributes, getInteractionClassName } from "../primitives/Interaction";

function XIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
      <path d="M8.5 2.5L2.5 8.5M2.5 2.5L8.5 8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
      <path d="M2 5.5L4.5 8L9 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BulkActionButton({
  action,
  selectedIds,
}: {
  action: BulkAction;
  selectedIds: Set<string>;
}) {
  const [confirming, setConfirming] = useState(false);

  const variantClassName = {
    primary:
      "border-[var(--prim-amber-500)] bg-[var(--prim-amber-700)] text-[var(--prim-amber-100)] hover:bg-[var(--prim-amber-600)]",
    secondary:
      "border-[var(--color-border-default)] bg-[var(--color-surface-overlay)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-raised)]",
    danger:
      "border-[var(--prim-red-700)] bg-[var(--prim-red-800)] text-[var(--prim-red-200)] hover:bg-[var(--prim-red-700)]",
    ai: "border-[var(--prim-blue-700)] bg-[var(--prim-blue-800)] text-[var(--prim-blue-100)] hover:bg-[var(--prim-blue-700)]",
  }[action.variant ?? "secondary"];

  const handleClick = () => {
    if (action.requiresConfirmation && !confirming) {
      setConfirming(true);
      return;
    }

    action.onAction(selectedIds);
    setConfirming(false);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      onMouseLeave={() => setConfirming(false)}
      {...getInteractionAttributes({
        critical: action.variant === "danger",
        hover: true,
        pending: action.requiresConfirmation && !confirming,
        pressed: confirming,
        selected: action.variant === "primary" || action.variant === "ai",
      })}
      className={cx(
        "inline-flex h-6 shrink-0 items-center gap-[4px] rounded-[var(--radius-sm)] border px-[var(--spacing-2)] text-[12px] font-medium transition-colors duration-[var(--transition-fast)] ease-[var(--ease-operational)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]",
        getInteractionClassName({
          states: ["hover", "pressed", "selected", "critical", "pending"],
          target: "button",
          tone: action.variant === "ai" ? "ai" : action.variant === "danger" ? "critical" : "neutral",
        }),
        variantClassName
      )}
    >
      {confirming ? (
        <>
          <CheckIcon />
          <span>Confirm</span>
        </>
      ) : (
        <>
          {action.icon ? <span aria-hidden="true" className="flex">{action.icon}</span> : null}
          <span>{action.label}</span>
        </>
      )}
    </button>
  );
}

export function BulkActionBar({
  count,
  actions,
  selectedIds,
  onClear,
  allPageSelected,
  totalCount,
  onSelectAllView,
  className,
}: BulkActionBarProps) {
  const primaryActions = actions.filter((action) => !action.overflow);
  const overflowActions = actions.filter((action) => action.overflow);
  const selectedIdSet = useMemo(() => new Set(selectedIds ?? []), [selectedIds]);

  if (count <= 0) {
    return null;
  }

  return (
    <>
      <div
        role="toolbar"
        aria-label={`${count} rows selected. Bulk actions.`}
        className={cx(
          "sticky top-[var(--toolbar-height)] z-[var(--z-raised)] flex h-9 shrink-0 items-center gap-[var(--spacing-2)] border-b border-[var(--prim-amber-700)] bg-[var(--prim-amber-950)] px-[var(--spacing-4)]",
          className
        )}
      >
        <div className="flex shrink-0 items-center gap-[var(--spacing-2)]">
          <span className="font-[var(--font-mono)] text-[12px] font-medium text-[var(--prim-amber-300)]">
            {count} selected
          </span>
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear selection"
            {...getInteractionAttributes({ hover: true })}
            className="inline-flex items-center gap-[4px] rounded-[var(--radius-sm)] px-[4px] py-[2px] text-[11px] text-[var(--color-text-muted)] transition-colors duration-[var(--transition-fast)] ease-[var(--ease-operational)] hover:bg-[var(--prim-amber-900)] hover:text-[var(--prim-amber-200)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]"
          >
            <XIcon />
            <span>Clear</span>
          </button>
        </div>

        <div aria-hidden="true" className="h-4 w-px shrink-0 bg-[var(--prim-amber-800)]" />

        <div className="flex min-w-0 flex-1 items-center gap-[var(--spacing-1)] overflow-x-auto">
          {primaryActions.map((action) => (
            <BulkActionButton key={action.id} action={action} selectedIds={selectedIdSet} />
          ))}
          {overflowActions.length > 0 ? (
            <button
              type="button"
              {...getInteractionAttributes({ hover: true })}
              className="inline-flex h-6 shrink-0 items-center rounded-[var(--radius-sm)] border border-[var(--color-border-default)] bg-[var(--color-surface-overlay)] px-[var(--spacing-2)] text-[12px] text-[var(--color-text-primary)]"
            >
              More
            </button>
          ) : null}
        </div>
      </div>

      {allPageSelected && totalCount && totalCount > count && onSelectAllView ? (
        <div className="flex h-8 shrink-0 items-center justify-center gap-[var(--spacing-2)] border-b border-[var(--prim-amber-800)] bg-[var(--prim-amber-900)] px-[var(--spacing-4)] text-[12px] text-[var(--prim-amber-200)]">
          <span>All {count} items on this page are selected.</span>
          <button
            type="button"
            onClick={onSelectAllView}
            {...getInteractionAttributes({ hover: true })}
            className="font-medium text-[var(--prim-amber-300)] underline underline-offset-2"
          >
            Select all {totalCount.toLocaleString("en-IN")} items in this view
          </button>
        </div>
      ) : null}
    </>
  );
}
