import { forwardRef } from "react";
import type { PanelProps } from "./panel.types";
import { Panel } from "./Panel";

export const WorkspacePanel = forwardRef<HTMLElement, Omit<PanelProps, "variant">>(function WorkspacePanel(
  props,
  ref
) {
  return <Panel ref={ref} variant="workspace" {...props} />;
});
