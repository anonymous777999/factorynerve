import { forwardRef } from "react";
import { cx } from "../../../../lib/utils";
import { getInteractionAttributes } from "../Interaction";
import type { DataTableRowProps } from "./datatable.types";
import { getDataTableRowClassName } from "./datatable.variants";
import { useDataTableRowState } from "./hooks";
import { getDataTableRowStateAttributes } from "./row-state.utils";

export const DataTableRow = forwardRef<HTMLTableRowElement, DataTableRowProps>(function DataTableRow(
  {
    active = false,
    aiActive = false,
    aiProcessing = false,
    aiReviewed = false,
    aiSuggested = false,
    anomalyDetected = false,
    approved = false,
    archived = false,
    critical = false,
    disabled = false,
    flagged = false,
    interactive = true,
    loading = false,
    locked = false,
    lowConfidence = false,
    pending = false,
    reviewed = false,
    selected = false,
    stale = false,
    state,
    success = false,
    syncing = false,
    warning = false,
    className,
    ...props
  },
  ref
) {
  const resolved = useDataTableRowState({
    active,
    aiActive,
    aiProcessing,
    aiReviewed,
    aiSuggested,
    anomalyDetected,
    approved,
    archived,
    critical,
    disabled,
    flagged,
    interactive,
    loading,
    locked,
    lowConfidence,
    pending,
    reviewed,
    selected,
    stale,
    state,
    success,
    syncing,
    warning,
  });

  return (
    <tr
      ref={ref}
      data-selected={selected ? "true" : undefined}
      {...getInteractionAttributes(resolved.interactionFlags)}
      data-row-selected={selected ? "true" : undefined}
      {...getDataTableRowStateAttributes(resolved.states)}
      className={cx(getDataTableRowClassName(interactive), resolved.className, className)}
      {...props}
    />
  );
});
