import { useMemo } from "react";
import type { DataTableRowProps } from "../../../../../types/datatable";
import { resolveDataTableRowState } from "../row-state.utils";

export function useDataTableRowState(
  props: Pick<
    DataTableRowProps,
    | "active"
    | "aiActive"
    | "aiProcessing"
    | "aiReviewed"
    | "aiSuggested"
    | "anomalyDetected"
    | "approved"
    | "archived"
    | "critical"
    | "disabled"
    | "flagged"
    | "interactive"
    | "loading"
    | "locked"
    | "lowConfidence"
    | "pending"
    | "reviewed"
    | "selected"
    | "stale"
    | "state"
    | "success"
    | "syncing"
    | "warning"
  >
) {
  return useMemo(
    () => resolveDataTableRowState(props),
    [
      props.active,
      props.aiActive,
      props.aiProcessing,
      props.aiReviewed,
      props.aiSuggested,
      props.anomalyDetected,
      props.approved,
      props.archived,
      props.critical,
      props.disabled,
      props.flagged,
      props.interactive,
      props.loading,
      props.locked,
      props.lowConfidence,
      props.pending,
      props.reviewed,
      props.selected,
      props.stale,
      props.state,
      props.success,
      props.syncing,
      props.warning,
    ]
  );
}
