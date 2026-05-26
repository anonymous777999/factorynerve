import { cx } from "../../../../lib/utils";
import type {
  DataTableRowProps,
  DataTableRowState,
  DataTableRowStateFlags,
  InteractionStateFlags,
} from "../../../../types/datatable";
import { DATA_TABLE_ROW_STATE_CLASSNAME, DATA_TABLE_ROW_STATE_ORDER } from "./row-state.tokens";

export interface DataTableResolvedRowState {
  className: string;
  interactionFlags: InteractionStateFlags;
  states: DataTableRowState[];
}

function collectRowStates({
  approved,
  aiProcessing,
  aiReviewed,
  aiSuggested,
  anomalyDetected,
  archived,
  critical,
  disabled,
  flagged,
  locked,
  lowConfidence,
  pending,
  stale,
  syncing,
  warning,
}: DataTableRowStateFlags) {
  const states: DataTableRowState[] = [];

  if (disabled) states.push("disabled");
  if (archived) states.push("archived");
  if (locked) states.push("locked");
  if (critical) states.push("critical");
  if (warning) states.push("warning");
  if (pending) states.push("pending");
  if (approved) states.push("approved");
  if (aiProcessing) states.push("ai-processing");
  if (aiReviewed) states.push("ai-reviewed");
  if (aiSuggested) states.push("ai-suggested");
  if (lowConfidence) states.push("low-confidence");
  if (anomalyDetected) states.push("anomaly-detected");
  if (syncing) states.push("syncing");
  if (stale) states.push("stale");
  if (flagged) states.push("flagged");

  return states.sort(
    (left, right) => DATA_TABLE_ROW_STATE_ORDER.indexOf(left) - DATA_TABLE_ROW_STATE_ORDER.indexOf(right)
  );
}

function normalizeStateInput(state?: DataTableRowState | DataTableRowState[]) {
  if (!state) {
    return [] as DataTableRowState[];
  }

  return (Array.isArray(state) ? state : [state]).filter((value): value is DataTableRowState => value !== "default");
}

export function resolveDataTableRowStates(props: Pick<
  DataTableRowProps,
  | "approved"
  | "aiProcessing"
  | "aiReviewed"
  | "aiSuggested"
  | "anomalyDetected"
  | "archived"
  | "critical"
  | "disabled"
  | "flagged"
  | "locked"
  | "lowConfidence"
  | "pending"
  | "stale"
  | "state"
  | "syncing"
  | "warning"
>) {
  const explicitStates = normalizeStateInput(props.state);
  const flagStates = collectRowStates({
    approved: props.approved || explicitStates.includes("approved"),
    aiProcessing: props.aiProcessing || explicitStates.includes("ai-processing"),
    aiReviewed: props.aiReviewed || explicitStates.includes("ai-reviewed"),
    aiSuggested: props.aiSuggested || explicitStates.includes("ai-suggested"),
    anomalyDetected: props.anomalyDetected || explicitStates.includes("anomaly-detected"),
    archived: props.archived || explicitStates.includes("archived"),
    critical: props.critical || explicitStates.includes("critical"),
    disabled: props.disabled || explicitStates.includes("disabled"),
    flagged: props.flagged || explicitStates.includes("flagged"),
    locked: props.locked || explicitStates.includes("locked"),
    lowConfidence: props.lowConfidence || explicitStates.includes("low-confidence"),
    pending: props.pending || explicitStates.includes("pending"),
    stale: props.stale || explicitStates.includes("stale"),
    syncing: props.syncing || explicitStates.includes("syncing"),
    warning: props.warning || explicitStates.includes("warning"),
  });

  return Array.from(new Set([...flagStates, ...explicitStates])).sort(
    (left, right) => DATA_TABLE_ROW_STATE_ORDER.indexOf(left) - DATA_TABLE_ROW_STATE_ORDER.indexOf(right)
  );
}

export function getDataTableRowStateAttributes(states: DataTableRowState[]) {
  const stateString = states.join(" ");

  return {
    "data-row-state": stateString || undefined,
    "data-row-critical": states.includes("critical") || states.includes("anomaly-detected") || undefined,
    "data-row-disabled": states.includes("disabled") || undefined,
    "data-row-locked": states.includes("locked") || undefined,
  };
}

export function getDataTableRowInteractionFlags(
  states: DataTableRowState[],
  props: Pick<
    DataTableRowProps,
    "active" | "aiActive" | "disabled" | "interactive" | "loading" | "locked" | "reviewed" | "selected" | "success"
  >
): InteractionStateFlags {
  const hasAIContext =
    props.aiActive ||
    states.includes("ai-reviewed") ||
    states.includes("ai-processing") ||
    states.includes("ai-suggested");

  return {
    active: props.active,
    aiActive: hasAIContext,
    critical: states.includes("critical") || states.includes("anomaly-detected"),
    disabled: props.disabled || states.includes("disabled"),
    hover: props.interactive && !props.disabled && !states.includes("disabled"),
    loading: props.loading || states.includes("ai-processing") || states.includes("syncing"),
    locked: props.locked || states.includes("locked"),
    pending: states.includes("pending") || states.includes("syncing"),
    reviewed: props.reviewed || states.includes("ai-reviewed"),
    selected: props.selected,
    success: props.success || states.includes("approved"),
    warning:
      states.includes("warning") ||
      states.includes("low-confidence") ||
      states.includes("stale") ||
      states.includes("flagged"),
  };
}

export function getDataTableRowStateClassName(states: DataTableRowState[], className?: string) {
  return cx(
    ...states.map((state) => (state === "default" ? "" : DATA_TABLE_ROW_STATE_CLASSNAME[state] ?? "")),
    className
  );
}

export function resolveDataTableRowState(props: Pick<
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
>) {
  const states = resolveDataTableRowStates(props);

  return {
    className: getDataTableRowStateClassName(states),
    interactionFlags: getDataTableRowInteractionFlags(states, props),
    states,
  } satisfies DataTableResolvedRowState;
}
