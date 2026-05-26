import { cx } from "../../../../lib/utils";
import type {
  InteractionRecipeOptions,
  InteractionState,
  InteractionStateFlags,
} from "../../../../types/datatable";
import {
  INTERACTION_BASE_CLASSNAME,
  INTERACTION_STATE_ORDER,
  INTERACTION_TARGET_CLASSNAME,
  INTERACTION_TONE_CLASSNAME,
} from "./interaction.tokens";

export function resolveInteractionStates(flags: InteractionStateFlags = {}) {
  const states: InteractionState[] = [];

  if (flags.hover) states.push("hover");
  if (flags.focus) states.push("focus");
  if (flags.active) states.push("active");
  if (flags.pressed) states.push("pressed");
  if (flags.selected) states.push("selected");
  if (flags.disabled) states.push("disabled");
  if (flags.loading) states.push("loading");
  if (flags.warning) states.push("warning");
  if (flags.critical) states.push("critical");
  if (flags.success) states.push("success");
  if (flags.aiActive) states.push("ai-active");
  if (flags.pending) states.push("pending");
  if (flags.locked) states.push("locked");
  if (flags.reviewed) states.push("reviewed");

  return states.sort(
    (left, right) => INTERACTION_STATE_ORDER.indexOf(left) - INTERACTION_STATE_ORDER.indexOf(right)
  );
}

export function getInteractionStateString(states: InteractionState[] = []) {
  return states.join(" ");
}

export function getInteractionAttributes(flags: InteractionStateFlags = {}) {
  const states = resolveInteractionStates(flags);
  const stateString = getInteractionStateString(states);

  return {
    "data-interaction-state": stateString || undefined,
    "data-state-critical": flags.critical || undefined,
    "data-state-disabled": flags.disabled || undefined,
    "data-state-loading": flags.loading || undefined,
    "data-state-selected": flags.selected || undefined,
    "data-state-warning": flags.warning || undefined,
  };
}

export function getInteractionClassName({
  className,
  states = [],
  target,
  tone = "neutral",
}: InteractionRecipeOptions) {
  return cx(
    INTERACTION_BASE_CLASSNAME[target],
    INTERACTION_TONE_CLASSNAME[tone],
    ...states.map((state) => INTERACTION_TARGET_CLASSNAME[target][state] ?? ""),
    className
  );
}
