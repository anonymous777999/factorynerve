import { forwardRef } from "react";
import type { PanelProps } from "./panel.types";
import { Panel } from "./Panel";

export const FloatingPanel = forwardRef<HTMLElement, Omit<PanelProps, "variant">>(function FloatingPanel(
  props,
  ref
) {
  return <Panel ref={ref} variant="floating" {...props} />;
});
