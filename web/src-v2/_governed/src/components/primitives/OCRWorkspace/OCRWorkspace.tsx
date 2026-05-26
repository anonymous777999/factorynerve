import { cx } from "../../../../lib/utils";
import type { OCRWorkspaceProps } from "../../../../types/datatable";
import { WorkspacePanel } from "../Panel";
import { Toolbar, ToolbarSection } from "../Toolbar";
import { WorkspaceLayoutRegion, WorkspaceViewport } from "../Viewport";
import { PageNavigator } from "./PageNavigator";

export function OCRWorkspace({ title, toolbarSlot, children, className, ...props }: OCRWorkspaceProps) {
  return (
    <WorkspacePanel className={cx("h-full rounded-none border-none", className)} padding="none" {...props}>
      <WorkspaceViewport surface="workspace" className="h-full">
        <Toolbar aria-label="OCR workspace controls">
          <ToolbarSection grow>
            {title ? <div className="truncate text-[12px] font-medium text-[var(--color-text-secondary)]">{title}</div> : null}
          </ToolbarSection>
          <ToolbarSection align="end">{toolbarSlot}</ToolbarSection>
        </Toolbar>
        <div className="border-b border-[var(--color-border-default)] px-[var(--spacing-4)] py-[var(--spacing-2)]">
          <PageNavigator />
        </div>
        <WorkspaceLayoutRegion grow>{children}</WorkspaceLayoutRegion>
      </WorkspaceViewport>
    </WorkspacePanel>
  );
}
