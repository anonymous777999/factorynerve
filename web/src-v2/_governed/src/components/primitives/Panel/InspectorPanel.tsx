import { forwardRef } from "react";
import type { PanelProps } from "./panel.types";
import { Panel } from "./Panel";

export const InspectorPanel = forwardRef<HTMLElement, Omit<PanelProps, "variant">>(function InspectorPanel(
  props,
  ref
) {
  return <Panel ref={ref} variant="inspector" {...props} />;
});
