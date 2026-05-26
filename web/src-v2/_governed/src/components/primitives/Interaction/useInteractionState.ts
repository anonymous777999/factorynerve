import { useMemo } from "react";
import type { InteractionStateFlags, InteractionTarget, InteractionTone } from "../../../../types/datatable";
import {
  getInteractionAttributes,
  getInteractionClassName,
  resolveInteractionStates,
} from "./interaction.utils";

export function useInteractionState({
  className,
  flags,
  target,
  tone,
}: {
  className?: string;
  flags?: InteractionStateFlags;
  target: InteractionTarget;
  tone?: InteractionTone;
}) {
  const states = useMemo(() => resolveInteractionStates(flags), [flags]);

  return useMemo(
    () => ({
      attrs: getInteractionAttributes(flags),
      className: getInteractionClassName({
        className,
        states,
        target,
        tone,
      }),
      states,
    }),
    [className, flags, states, target, tone]
  );
}
