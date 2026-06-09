import { cx } from "../../../lib/utils";
import type { DataTableShellProps } from "../../../types/datatable";
import { WorkspacePanel } from "../primitives/Panel";
import {
  ViewportBoundary,
  ViewportProvider,
  WorkspaceLayoutRegion,
  WorkspaceViewport,
} from "../primitives/Viewport";
import { AIPanelContainer, AIAnalysisSummaryBar } from "../shell/AIPanel";
import { BulkActionBar } from "../shell/BulkActionBar";
import { DataTableToolbar } from "../shell/DataTableToolbar";
import { TableFooter, TableViewport } from "../shell/TableViewport";

export function DataTableShell({
  workflow,
  title,
  density = "default",
  onDensityChange,
  aiPanel,
  onAIPanelToggle,
  searchSlot,
  filterSlot,
  actionSlot,
  viewControlSlot,
  isLoading = false,
  isEmpty = false,
  selection,
  bulkActions = [],
  onClearSelection,
  totalCount,
  onSelectAllView,
  aiSummary,
  aiPanelContent,
  aiPanelContext,
  emptySlot,
  loadingSlot,
  footerSlot,
  children,
  className,
}: DataTableShellProps) {
  const aiOpen = aiPanel?.open ?? false;
  const aiMode = aiPanel?.mode ?? "docked";
  const aiPosition = aiPanel?.position ?? "right";

  return (
    <ViewportProvider boundaryId={`factorynerve.${workflow}.viewport`}>
      <WorkspacePanel
        aria-label={title ? `${title} table workspace` : `${workflow} table workspace`}
        className={cx("h-full rounded-none border-none bg-[var(--color-surface-canvas)]", className)}
        padding="none"
      >
        <ViewportBoundary className="h-full">
          <WorkspaceViewport data-workflow={workflow} data-density={density}>
            <DataTableToolbar
              searchSlot={searchSlot}
              filterSlot={filterSlot}
              actionSlot={actionSlot}
              viewControlSlot={viewControlSlot}
              density={density}
              onDensityChange={onDensityChange}
              aiPanelOpen={aiOpen}
              onAIPanelToggle={onAIPanelToggle}
            />

            {selection && selection.count > 0 ? (
              <BulkActionBar
                count={selection.count}
                actions={bulkActions}
                selectedIds={selection.ids}
                onClear={onClearSelection ?? (() => undefined)}
                allPageSelected={selection.allPageSelected}
                totalCount={totalCount}
                onSelectAllView={onSelectAllView}
              />
            ) : null}

            <WorkspaceLayoutRegion direction="horizontal" grow>
              <WorkspaceLayoutRegion grow>
                {aiSummary ? <AIAnalysisSummaryBar summary={aiSummary} /> : null}

                <TableViewport
                  density={density}
                  isLoading={isLoading}
                  isEmpty={isEmpty && !isLoading}
                  emptySlot={emptySlot}
                  loadingSlot={loadingSlot}
                >
                  {children}
                </TableViewport>
              </WorkspaceLayoutRegion>

              {aiOpen ? (
                <AIPanelContainer
                  open={aiOpen}
                  width={aiPanel?.width}
                  minWidth={aiPanel?.minWidth}
                  maxWidth={aiPanel?.maxWidth}
                  mode={aiMode}
                  position={aiPosition}
                  persistenceKey={aiPanel?.persistenceKey}
                  onClose={onAIPanelToggle}
                  context={aiPanelContext}
                >
                  {aiPanelContent}
                </AIPanelContainer>
              ) : null}
            </WorkspaceLayoutRegion>

            {footerSlot ? <TableFooter>{footerSlot}</TableFooter> : null}
          </WorkspaceViewport>
        </ViewportBoundary>
      </WorkspacePanel>
    </ViewportProvider>
  );
}
