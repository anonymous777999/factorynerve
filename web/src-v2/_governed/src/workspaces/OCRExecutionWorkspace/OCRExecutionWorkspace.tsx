import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { DataTableRowState, FeedbackItem } from "../../../types/datatable";
import { cx, formatIndianNumber } from "../../../lib/utils";
import {
  AIReviewCell,
  AINotificationCenter,
  ColumnResizeSystem,
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableEngineProvider,
  DataTableHeader,
  DataTableHeaderCell,
  DataTableRow,
  DataTableSelectionRegion,
  DockRegion,
  DocumentSplitView,
  DocumentViewport,
  ExtractionReviewPanel,
  KeyboardNavigationSystem,
  MetadataCell,
  OCRConfidenceCell,
  OCRWorkspace,
  OCRWorkspaceProvider,
  OperationalAlert,
  Panel,
  PanelBody,
  PanelFooter,
  PanelHeader,
  PanelSection,
  ProgressCell,
  ProgressIndicator,
  QueueStateCell,
  ResizeRegion,
  ScrollRegion,
  TableDensitySystem,
  TimestampCell,
  ToastProvider,
  ToastViewport,
  Toolbar,
  ToolbarActions,
  ToolbarCommandRegion,
  ToolbarDivider,
  ToolbarFilters,
  ToolbarSearch,
  ToolbarSection,
  ToolbarStatusRegion,
  ToolbarViewControls,
  ViewportBoundary,
  ViewportProvider,
  WorkflowBanner,
  WorkflowFeedbackPanel,
  WorkflowStateCell,
  WorkspaceLayoutRegion,
  WorkspaceViewport,
  mapDensityToFoundationDensity,
  mapDensityToRowHeight,
  useDataTableEngine,
  useFeedback,
  useOCRWorkspace,
  useTableNavigation,
} from "../../../index";
import type {
  OCRExecutionRecord,
  OCRExecutionQueueItem,
  OCRExecutionQueueFilter,
  OCRWorkflowTimelineStep,
} from "./ocrExecutionWorkspace.contracts";
import { useOCRExecutionWorkspace } from "./hooks/useOCRExecutionWorkspace";

interface QueueColumnConfig {
  id: string;
  header: string;
  width: number;
  minWidth?: number;
  maxWidth?: number;
}

const QUEUE_COLUMNS: QueueColumnConfig[] = [
  { id: "select", header: "Select", width: 64, minWidth: 64, maxWidth: 64 },
  { id: "document", header: "Document", width: 260, minWidth: 220, maxWidth: 340 },
  { id: "queue", header: "Queue", width: 128, minWidth: 120, maxWidth: 168 },
  { id: "confidence", header: "Confidence", width: 152, minWidth: 140, maxWidth: 184 },
  { id: "ai", header: "AI Review", width: 156, minWidth: 140, maxWidth: 188 },
  { id: "progress", header: "Coverage", width: 168, minWidth: 148, maxWidth: 196 },
  { id: "updated", header: "Updated", width: 164, minWidth: 144, maxWidth: 192 },
  { id: "workflow", header: "Workflow", width: 144, minWidth: 128, maxWidth: 176 },
  { id: "actions", header: "Actions", width: 136, minWidth: 124, maxWidth: 164 },
];

interface OCRExecutionWorkspaceProps {
  bannerSlot?: ReactNode | ((record: OCRExecutionRecord) => ReactNode);
  bottomRailSlot?: (context: {
    escalationItems: FeedbackItem[];
    record: OCRExecutionRecord;
    workflowItems: FeedbackItem[];
  }) => ReactNode;
  documentSlot?: (record: OCRExecutionRecord) => ReactNode;
  loading?: boolean;
  onApplyFieldCorrection?: (recordId: string, fieldId: string) => void | Promise<void>;
  onApproveDocuments?: (recordIds: Iterable<string>) => void | Promise<void>;
  onCompleteActiveReview?: (recordId: string) => void | Promise<void>;
  onEscalateDocument?: (recordId: string) => void | Promise<void>;
  onSelectDocument?: (recordId: string) => void;
  queueSearchInputId?: string;
  records?: OCRExecutionRecord[];
  reviewSlot?: (record: OCRExecutionRecord) => ReactNode;
  sidePanelSlot?: (context: {
    aiItems: FeedbackItem[];
    escalationItems: FeedbackItem[];
    onApplyFieldCorrection: (recordId: string, fieldId: string) => void;
    onCompleteReview: () => void;
    onEscalateDocument: (recordId: string) => void;
    record: OCRExecutionRecord;
  }) => ReactNode;
  selectedDocumentId?: string;
  emptyStateSlot?: ReactNode;
}

function OCRExecutionWorkspaceInner(props: OCRExecutionWorkspaceProps) {
  const feedback = useFeedback();
  const workspace = useOCRExecutionWorkspace({
    onApplyFieldCorrection: props.onApplyFieldCorrection,
    onApproveDocuments: props.onApproveDocuments,
    onCompleteActiveReview: props.onCompleteActiveReview,
    onEscalateDocument: props.onEscalateDocument,
    onSelectDocument: props.onSelectDocument,
    pushFeedback: feedback.pushFeedback,
    records: props.records,
    selectedDocumentId: props.selectedDocumentId,
  });

  if (props.loading) {
    return (
      <ViewportProvider boundaryId="factorynerve.ocr.execution.viewport">
        <div className="flex h-screen w-full items-center justify-center bg-[var(--color-surface-canvas)] text-[var(--color-text-secondary)]">
          Loading governed OCR workspace...
        </div>
      </ViewportProvider>
    );
  }

  if (!workspace.selectedRecord) {
    return props.emptyStateSlot ?? null;
  }

  return (
    <ViewportProvider boundaryId="factorynerve.ocr.execution.viewport">
      <div className="h-screen w-full bg-[var(--color-surface-canvas)] text-[var(--color-text-secondary)]">
        <ViewportBoundary className="h-full">
          <WorkspaceViewport surface="canvas">
            <Toolbar aria-label="OCR execution workspace">
              <ToolbarSection>
                <div className="flex min-w-0 flex-col">
                  <span className="text-[11px] uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
                    OCR Execution Workspace
                  </span>
                  <span className="truncate text-[14px] font-medium text-[var(--color-text-primary)]">
                    Operational intake, extraction review, and approval lane
                  </span>
                </div>
              </ToolbarSection>
              <ToolbarSection grow />
              <ToolbarStatusRegion
                items={[
                  { id: "ready", label: "Ready", value: formatIndianNumber(workspace.kpis.ready), tone: "ok" },
                  { id: "low-confidence", label: "Low Confidence", value: formatIndianNumber(workspace.kpis.lowConfidence), tone: "warning" },
                  { id: "escalated", label: "Escalated", value: formatIndianNumber(workspace.kpis.escalated), tone: "critical" },
                  { id: "throughput", label: "Fields", value: formatIndianNumber(workspace.kpis.throughput), tone: "ai" },
                ]}
              />
            </Toolbar>

            {typeof props.bannerSlot === "function"
              ? props.bannerSlot(workspace.selectedRecord)
              : props.bannerSlot ?? (
                <WorkflowBanner
                  title={`${workspace.selectedRecord.queue.title} active in OCR execution`}
                  description={`${workspace.selectedRecord.queue.completedFields} of ${workspace.selectedRecord.queue.fieldCount} fields are operationally ready. AI confidence is ${Math.round(workspace.selectedRecord.queue.confidence * 100)}%.`}
                  priority={workspace.selectedRecord.queue.anomalyCount > 0 ? "warning" : "operational"}
                  action={
                    <button type="button" className="fn-btn fn-btn-primary fn-btn-sm" onClick={() => workspace.actions.completeActiveReview()}>
                      Complete Review
                    </button>
                  }
                />
              )}

            <OCRWorkspaceProvider
              key={workspace.selectedRecord.queue.id}
              document={workspace.selectedRecord.document}
              boundingBoxes={workspace.selectedRecord.boundingBoxes}
              extractionFields={workspace.selectedRecord.extractionFields}
            >
              <WorkspaceLayoutRegion direction="horizontal" grow>
                <ResizeRegion
                  defaultSize={360}
                  minSize={320}
                  maxSize={460}
                  position="left"
                  className="border-r border-[var(--color-border-default)] bg-[var(--color-surface-elevated)]"
                >
                  <OCRQueuePanel
                    activeDocumentId={workspace.selectedRecord.queue.id}
                    filterChips={workspace.filterChips}
                    filters={workspace.filters}
                    searchInputId={props.queueSearchInputId}
                    records={workspace.filteredRecords}
                    onApproveDocuments={workspace.actions.approveDocuments}
                    onEscalateDocument={workspace.actions.escalateDocument}
                    onQueueFilterChange={workspace.actions.setQueueFilter}
                    onQueryChange={workspace.actions.setQuery}
                    onSelectDocument={workspace.actions.selectDocument}
                    onToggleAnomaliesOnly={workspace.actions.toggleAnomaliesOnly}
                  />
                </ResizeRegion>

                <WorkspaceLayoutRegion grow direction="vertical">
                  <WorkspaceLayoutRegion grow direction="horizontal">
                    <WorkspaceLayoutRegion grow>
                      <OCROperationalCenter
                        documentSlot={props.documentSlot?.(workspace.selectedRecord)}
                        record={workspace.selectedRecord}
                        reviewSlot={props.reviewSlot?.(workspace.selectedRecord)}
                      />
                    </WorkspaceLayoutRegion>

                    <DockRegion
                      side="right"
                      defaultSize={392}
                      minSize={352}
                      maxSize={460}
                      resizable
                      className="border-l border-[var(--color-border-default)] bg-[var(--color-surface-primary)]"
                    >
                      {props.sidePanelSlot?.({
                        aiItems: workspace.panels.aiItems,
                        escalationItems: workspace.panels.escalationItems,
                        onApplyFieldCorrection: workspace.actions.applyFieldCorrection,
                        onCompleteReview: workspace.actions.completeActiveReview,
                        onEscalateDocument: workspace.actions.escalateDocument,
                        record: workspace.selectedRecord,
                      }) ?? (
                        <OCRAIReviewPanel
                          aiItems={workspace.panels.aiItems}
                          escalationItems={workspace.panels.escalationItems}
                          onApplyFieldCorrection={workspace.actions.applyFieldCorrection}
                          onCompleteReview={workspace.actions.completeActiveReview}
                          onEscalateDocument={workspace.actions.escalateDocument}
                          record={workspace.selectedRecord}
                        />
                      )}
                    </DockRegion>
                  </WorkspaceLayoutRegion>

                  <ResizeRegion
                    axis="vertical"
                    position="bottom"
                    defaultSize={240}
                    minSize={200}
                    maxSize={320}
                    className="border-t border-[var(--color-border-default)] bg-[var(--color-surface-primary)]"
                  >
                    {props.bottomRailSlot?.({
                      escalationItems: workspace.panels.escalationItems,
                      record: workspace.selectedRecord,
                      workflowItems: workspace.panels.workflowItems,
                    }) ?? (
                      <OCRBottomRail
                        escalationItems={workspace.panels.escalationItems}
                        record={workspace.selectedRecord}
                        workflowItems={workspace.panels.workflowItems}
                      />
                    )}
                  </ResizeRegion>
                </WorkspaceLayoutRegion>
              </WorkspaceLayoutRegion>
            </OCRWorkspaceProvider>

            <ToastViewport />
          </WorkspaceViewport>
        </ViewportBoundary>
      </div>
    </ViewportProvider>
  );
}

export function OCRExecutionWorkspace(props: OCRExecutionWorkspaceProps) {
  return (
    <ToastProvider>
      <OCRExecutionWorkspaceInner {...props} />
    </ToastProvider>
  );
}

function OCRQueuePanel({
  activeDocumentId,
  filterChips,
  filters,
  searchInputId,
  records,
  onApproveDocuments,
  onEscalateDocument,
  onQueueFilterChange,
  onQueryChange,
  onSelectDocument,
  onToggleAnomaliesOnly,
}: {
  activeDocumentId: string;
  filterChips: Array<{ id: string; label: string; value?: string; tone?: "default" | "active" | "ai" }>;
  filters: { anomaliesOnly: boolean; query: string; queueFilter: OCRExecutionQueueFilter };
  searchInputId?: string;
  records: OCRExecutionRecord[];
  onApproveDocuments: (recordIds: Iterable<string>) => void;
  onEscalateDocument: (recordId: string) => void;
  onQueueFilterChange: (value: OCRExecutionQueueFilter) => void;
  onQueryChange: (value: string) => void;
  onSelectDocument: (recordId: string) => void;
  onToggleAnomaliesOnly: () => void;
}) {
  return (
    <DataTableEngineProvider
      columns={QUEUE_COLUMNS.map((column) => ({
        id: column.id,
        minWidth: column.minWidth,
        maxWidth: column.maxWidth,
        width: column.width,
      }))}
      rowIds={records.map((record) => record.queue.id)}
      persistenceKey="factorynerve.ocr.execution.queue"
      defaultDensity="default"
      defaultRowPinning={{
        top: records.filter((record) => record.queue.priority === "critical").map((record) => record.queue.id),
      }}
    >
      <Panel variant="workspace" padding="none" className="h-full rounded-none border-none">
        <PanelHeader
          title="OCR intake queue"
          subtitle="Operational review lane"
          meta={`${records.length} documents in current view`}
        />
        <Toolbar aria-label="OCR queue controls">
          <ToolbarSection>
            <ToolbarSearch inputId={searchInputId} value={filters.query} onValueChange={onQueryChange} placeholder="Search OCR IDs, suppliers, or documents" />
          </ToolbarSection>
          <ToolbarSection grow overflow="clip">
            <ToolbarFilters activeFilters={filterChips}>
              <ToolbarCommandRegion>
                {(["all", "pending", "low-confidence", "escalated", "completed"] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => onQueueFilterChange(filter)}
                    className={cx(
                      "inline-flex h-7 items-center rounded-[var(--radius-md)] border px-[var(--spacing-2)] text-[11px] uppercase tracking-[0.04em]",
                      filters.queueFilter === filter
                        ? "border-[var(--color-accent-operational-border)] bg-[var(--color-accent-operational-surface)] text-[var(--color-accent-operational-muted)]"
                        : "border-[var(--color-border-default)] bg-[var(--color-surface-primary)] text-[var(--color-text-tertiary)]"
                    )}
                  >
                    {filter.replace("-", " ")}
                  </button>
                ))}
              </ToolbarCommandRegion>
            </ToolbarFilters>
          </ToolbarSection>
          <ToolbarDivider />
          <ToolbarActions justify="end">
            <button
              type="button"
              onClick={onToggleAnomaliesOnly}
              className={cx(
                "inline-flex h-7 items-center rounded-[var(--radius-md)] border px-[var(--spacing-2)] text-[11px] uppercase tracking-[0.04em]",
                filters.anomaliesOnly
                  ? "border-[var(--color-accent-ai-border)] bg-[var(--color-accent-ai-surface)] text-[var(--color-accent-ai-muted)]"
                  : "border-[var(--color-border-default)] bg-[var(--color-surface-primary)] text-[var(--color-text-tertiary)]"
              )}
            >
              Anomalies only
            </button>
          </ToolbarActions>
          <QueueDensityControls />
        </Toolbar>
        <OCRQueueTable
          activeDocumentId={activeDocumentId}
          records={records}
          onApproveDocuments={onApproveDocuments}
          onEscalateDocument={onEscalateDocument}
          onSelectDocument={onSelectDocument}
        />
      </Panel>
    </DataTableEngineProvider>
  );
}

function QueueDensityControls() {
  return (
    <TableDensitySystem>
      {({ density, setDensity }) => (
        <ToolbarViewControls density={density === "comfortable" ? "touch" : density} onDensityChange={(next) => setDensity(next === "touch" ? "comfortable" : next)} />
      )}
    </TableDensitySystem>
  );
}

function OCRQueueTable({
  activeDocumentId,
  records,
  onApproveDocuments,
  onEscalateDocument,
  onSelectDocument,
}: {
  activeDocumentId: string;
  records: OCRExecutionRecord[];
  onApproveDocuments: (recordIds: Iterable<string>) => void;
  onEscalateDocument: (recordId: string) => void;
  onSelectDocument: (recordId: string) => void;
}) {
  const engine = useDataTableEngine();
  const density = mapDensityToFoundationDensity(engine.density);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: records.length,
    estimateSize: () => mapDensityToRowHeight(engine.density),
    getScrollElement: () => scrollRef.current,
    overscan: 10,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0]?.start ?? 0 : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? totalSize - (virtualRows[virtualRows.length - 1]?.end ?? 0)
      : 0;

  return (
    <>
      {engine.selectedRowIds.size > 0 ? (
        <WorkflowBanner
          title={`${engine.selectedRowIds.size} documents selected`}
          description="Bulk approval keeps OCR throughput inside the governed execution lane."
          priority="operational"
          action={
            <div className="flex items-center gap-[var(--spacing-2)]">
              <button type="button" className="fn-btn fn-btn-primary fn-btn-sm" onClick={() => onApproveDocuments(engine.selectedRowIds)}>
                Approve Selected
              </button>
              <button
                type="button"
                className="fn-btn fn-btn-secondary fn-btn-sm"
                onClick={() => engine.setSelection(new Set())}
              >
                Clear
              </button>
            </div>
          }
        />
      ) : null}

      <KeyboardNavigationSystem className="min-h-0 flex-1">
        <ScrollRegion ref={scrollRef} ownerId="ocr-queue-scroll" className="min-h-0 flex-1" viewportClassName="h-full" contentClassName="min-w-full">
          <DataTable density={density} aria-label="OCR intake queue">
            <colgroup>
              {QUEUE_COLUMNS.map((column) => (
                <col key={column.id} style={{ width: engine.widths[column.id] ?? column.width }} />
              ))}
            </colgroup>
            <DataTableHeader>
              <DataTableRow interactive={false}>
                {QUEUE_COLUMNS.map((column) => (
                  <DataTableHeaderCell key={column.id} className="relative" style={{ width: engine.widths[column.id] ?? column.width }}>
                    {column.id === "select" ? <QueueSelectionHeader /> : column.header}
                    {column.id !== "select" ? <ColumnResizeSystem columnId={column.id} /> : null}
                  </DataTableHeaderCell>
                ))}
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody empty={records.length === 0}>
              {paddingTop > 0 ? (
                <DataTableRow interactive={false}>
                  <DataTableCell colSpan={QUEUE_COLUMNS.length} className="border-r-0 p-0" style={{ height: paddingTop }} />
                </DataTableRow>
              ) : null}

              {records.length === 0 ? (
                <DataTableRow interactive={false}>
                  <DataTableCell colSpan={QUEUE_COLUMNS.length} className="border-r-0">
                    <div className="py-[var(--spacing-6)] text-center text-[var(--color-text-muted)]">
                      No OCR records match the active operational filters.
                    </div>
                  </DataTableCell>
                </DataTableRow>
              ) : (
                virtualRows.map((virtualRow) => {
                  const record = records[virtualRow.index];
                  if (!record) {
                    return null;
                  }

                  const states = resolveQueueRowStates(record.queue);
                  const selected = engine.selectedRowIds.has(record.queue.id);
                  const pinnedTop = engine.rowPinning.top.includes(record.queue.id);

                  return (
                    <DataTableRow
                      key={record.queue.id}
                      state={states}
                      selected={selected}
                      className={cx(pinnedTop && "sticky top-[calc(var(--toolbar-height)+48px)] z-[var(--z-raised)]")}
                    >
                      <QueueSelectionCell rowId={record.queue.id} rowIndex={virtualRow.index} />
                      <QueueDocumentCell
                        active={record.queue.id === activeDocumentId}
                        onSelectDocument={onSelectDocument}
                        record={record}
                        rowIndex={virtualRow.index}
                      />
                      <QueueQueueStateCell record={record} rowIndex={virtualRow.index} />
                      <QueueConfidenceCell record={record} rowIndex={virtualRow.index} />
                      <QueueAIReviewStateCell record={record} rowIndex={virtualRow.index} />
                      <QueueCoverageCell record={record} rowIndex={virtualRow.index} />
                      <QueueTimestampCell record={record} rowIndex={virtualRow.index} />
                      <QueueWorkflowCell record={record} rowIndex={virtualRow.index} />
                      <QueueActionsCell
                        onEscalateDocument={onEscalateDocument}
                        onSelectDocument={onSelectDocument}
                        record={record}
                        rowIndex={virtualRow.index}
                      />
                    </DataTableRow>
                  );
                })
              )}

              {paddingBottom > 0 ? (
                <DataTableRow interactive={false}>
                  <DataTableCell colSpan={QUEUE_COLUMNS.length} className="border-r-0 p-0" style={{ height: paddingBottom }} />
                </DataTableRow>
              ) : null}
            </DataTableBody>
          </DataTable>
        </ScrollRegion>
      </KeyboardNavigationSystem>
    </>
  );
}

function QueueSelectionHeader() {
  const engine = useDataTableEngine();
  const selectedCount = engine.selectedRowIds.size;
  const totalCount = engine.rowIds.length;

  return (
    <button
      type="button"
      aria-label={selectedCount === totalCount && totalCount > 0 ? "Clear OCR queue selection" : "Select all OCR queue documents"}
      onClick={() => engine.setSelection(selectedCount === totalCount ? new Set() : new Set(engine.rowIds))}
      className="flex items-center justify-center"
    >
      <DataTableSelectionRegion
        mode="bulk"
        checked={selectedCount > 0 && selectedCount === totalCount}
        indeterminate={selectedCount > 0 && selectedCount < totalCount}
      />
    </button>
  );
}

function QueueSelectionCell({ rowId, rowIndex }: { rowId: string; rowIndex: number }) {
  const engine = useDataTableEngine();
  const navigation = useNavigableCell(rowId, "select", rowIndex * QUEUE_COLUMNS.length);
  const selected = engine.selectedRowIds.has(rowId);

  return (
    <DataTableCell ref={navigation.ref} tabIndex={navigation.tabIndex} onFocus={navigation.onFocus} className="w-[64px]">
      <button
        type="button"
        className="flex items-center"
        onClick={() =>
          engine.setSelection((current) => {
            const next = new Set(current);
            if (next.has(rowId)) {
              next.delete(rowId);
            } else {
              next.add(rowId);
            }
            return next;
          })
        }
      >
        <DataTableSelectionRegion checked={selected} />
      </button>
    </DataTableCell>
  );
}

function QueueDocumentCell({
  active,
  onSelectDocument,
  record,
  rowIndex,
}: {
  active: boolean;
  onSelectDocument: (recordId: string) => void;
  record: OCRExecutionRecord;
  rowIndex: number;
}) {
  const navigation = useNavigableCell(record.queue.id, "document", rowIndex * QUEUE_COLUMNS.length + 1);

  return (
    <MetadataCell
      ref={navigation.ref}
      tabIndex={navigation.tabIndex}
      onFocus={navigation.onFocus}
      value={
        <button type="button" className="min-w-0 text-left" onClick={() => onSelectDocument(record.queue.id)}>
          <span className={cx("block truncate", active && "text-[var(--color-accent-operational-muted)]")}>
            {record.queue.title}
          </span>
        </button>
      }
      label={record.queue.id}
      secondary={`${record.queue.supplier} / ${record.queue.source}`}
      active={active}
      selected={active}
    />
  );
}

function QueueQueueStateCell({ record, rowIndex }: { record: OCRExecutionRecord; rowIndex: number }) {
  const navigation = useNavigableCell(record.queue.id, "queue", rowIndex * QUEUE_COLUMNS.length + 2);

  return (
    <QueueStateCell
      ref={navigation.ref}
      tabIndex={navigation.tabIndex}
      onFocus={navigation.onFocus}
      state={record.queue.queueState}
      count={record.queue.anomalyCount}
      secondary={record.queue.priority}
    />
  );
}

function QueueConfidenceCell({ record, rowIndex }: { record: OCRExecutionRecord; rowIndex: number }) {
  const navigation = useNavigableCell(record.queue.id, "confidence", rowIndex * QUEUE_COLUMNS.length + 3);

  return (
    <OCRConfidenceCell
      ref={navigation.ref}
      tabIndex={navigation.tabIndex}
      onFocus={navigation.onFocus}
      confidence={record.queue.confidence}
      extractionState={
        record.queue.reviewState === "reviewed"
          ? "reviewed"
          : record.queue.reviewState === "suggested"
            ? "ai-assisted"
            : record.queue.reviewState === "anomaly"
              ? "failed"
              : "pending"
      }
      secondary={`${record.queue.completedFields}/${record.queue.fieldCount} fields`}
    />
  );
}

function QueueAIReviewStateCell({ record, rowIndex }: { record: OCRExecutionRecord; rowIndex: number }) {
  const navigation = useNavigableCell(record.queue.id, "ai", rowIndex * QUEUE_COLUMNS.length + 4);

  return (
    <AIReviewCell
      ref={navigation.ref}
      tabIndex={navigation.tabIndex}
      onFocus={navigation.onFocus}
      state={record.queue.reviewState}
      summary={`${record.queue.anomalyCount} anomaly checks`}
    />
  );
}

function QueueCoverageCell({ record, rowIndex }: { record: OCRExecutionRecord; rowIndex: number }) {
  const navigation = useNavigableCell(record.queue.id, "progress", rowIndex * QUEUE_COLUMNS.length + 5);

  return (
    <ProgressCell
      ref={navigation.ref}
      tabIndex={navigation.tabIndex}
      onFocus={navigation.onFocus}
      value={record.queue.completedFields}
      max={record.queue.fieldCount}
      label={`${record.queue.completedFields}/${record.queue.fieldCount}`}
    />
  );
}

function QueueTimestampCell({ record, rowIndex }: { record: OCRExecutionRecord; rowIndex: number }) {
  const navigation = useNavigableCell(record.queue.id, "updated", rowIndex * QUEUE_COLUMNS.length + 6);

  return (
    <TimestampCell
      ref={navigation.ref}
      tabIndex={navigation.tabIndex}
      onFocus={navigation.onFocus}
      value={record.queue.lastUpdated}
      format="relative"
      secondary={record.queue.assignee}
    />
  );
}

function QueueWorkflowCell({ record, rowIndex }: { record: OCRExecutionRecord; rowIndex: number }) {
  const navigation = useNavigableCell(record.queue.id, "workflow", rowIndex * QUEUE_COLUMNS.length + 7);

  return (
    <WorkflowStateCell
      ref={navigation.ref}
      tabIndex={navigation.tabIndex}
      onFocus={navigation.onFocus}
      state={record.queue.workflowState}
      owner={`${record.queue.pages} pages`}
    />
  );
}

function QueueActionsCell({
  onEscalateDocument,
  onSelectDocument,
  record,
  rowIndex,
}: {
  onEscalateDocument: (recordId: string) => void;
  onSelectDocument: (recordId: string) => void;
  record: OCRExecutionRecord;
  rowIndex: number;
}) {
  const navigation = useNavigableCell(record.queue.id, "actions", rowIndex * QUEUE_COLUMNS.length + 8);

  return (
    <DataTableCell ref={navigation.ref} tabIndex={navigation.tabIndex} onFocus={navigation.onFocus} align="right">
      <div className="flex items-center justify-end gap-[var(--spacing-1)]">
        <button type="button" className="fn-btn fn-btn-secondary fn-btn-sm" onClick={() => onSelectDocument(record.queue.id)}>
          Open
        </button>
        <button type="button" className="fn-btn fn-btn-ai fn-btn-sm" onClick={() => onEscalateDocument(record.queue.id)}>
          Escalate
        </button>
      </div>
    </DataTableCell>
  );
}

function OCROperationalCenter({
  documentSlot,
  record,
  reviewSlot,
}: {
  documentSlot?: ReactNode;
  record: OCRExecutionRecord;
  reviewSlot?: ReactNode;
}) {
  return (
    <OCRWorkspace
      title={record.document.title}
      toolbarSlot={<OCRWorkspaceToolbarMetrics record={record} />}
      className="h-full rounded-none border-none"
    >
      <DocumentSplitView
        className="h-full"
        documentSlot={documentSlot ?? <DocumentViewport />}
        reviewSlot={reviewSlot ?? <ExtractionReviewPanel />}
      />
    </OCRWorkspace>
  );
}

function OCRWorkspaceToolbarMetrics({ record }: { record: OCRExecutionRecord }) {
  const workspace = useOCRWorkspace();

  return (
    <div className="flex items-center gap-[var(--spacing-2)]">
      <ToolbarStatusRegion
        items={[
          { id: "pages", label: "Pages", value: formatIndianNumber(record.queue.pages), tone: "neutral" },
          { id: "active-page", label: "Active", value: workspace.activePageId?.split("-page-").at(-1) ?? "1", tone: "ai" },
          { id: "boxes", label: "Boxes", value: formatIndianNumber(record.boundingBoxes.length), tone: "warning" },
        ]}
      />
      <ToolbarCommandRegion emphasize="ai">
        <button type="button" className="fn-btn fn-btn-secondary fn-btn-sm" onClick={() => workspace.setSplitMode("document")}>
          Document
        </button>
        <button type="button" className="fn-btn fn-btn-secondary fn-btn-sm" onClick={() => workspace.setSplitMode("split")}>
          Split
        </button>
        <button type="button" className="fn-btn fn-btn-secondary fn-btn-sm" onClick={() => workspace.setSplitMode("review")}>
          Review
        </button>
      </ToolbarCommandRegion>
    </div>
  );
}

function OCRAIReviewPanel({
  aiItems,
  escalationItems,
  onApplyFieldCorrection,
  onCompleteReview,
  onEscalateDocument,
  record,
}: {
  aiItems: FeedbackItem[];
  escalationItems: FeedbackItem[];
  onApplyFieldCorrection: (recordId: string, fieldId: string) => void;
  onCompleteReview: () => void;
  onEscalateDocument: (recordId: string) => void;
  record: OCRExecutionRecord;
}) {
  const workspace = useOCRWorkspace();
  const selectedField = useMemo(
    () => record.extractionFields.find((field) => field.id === workspace.selectedFieldId) ?? record.extractionFields[0],
    [record.extractionFields, workspace.selectedFieldId]
  );

  return (
    <Panel variant="ai" padding="none" className="h-full rounded-none border-none">
      <PanelHeader title="AI review panel" subtitle="Embedded OCR intelligence" meta={record.queue.id} />
      <PanelBody padding="none" className="min-h-0">
        <ScrollRegion ownerId="ocr-ai-review-scroll" className="h-full" viewportClassName="h-full">
          <div className="flex min-h-full flex-col gap-[var(--spacing-4)] p-[var(--spacing-4)]">
            <PanelSection
              inset
              title="Selected extraction"
              description={selectedField?.label ?? "No field selected"}
              action={
                selectedField ? (
                  <button
                    type="button"
                    className="fn-btn fn-btn-ai fn-btn-sm"
                    onClick={() => onApplyFieldCorrection(record.queue.id, selectedField.id)}
                  >
                    Apply AI Correction
                  </button>
                ) : null
              }
            >
              {selectedField ? (
                <>
                  <div className="font-[var(--font-mono)] text-[14px] text-[var(--color-text-primary)]">{selectedField.value}</div>
                  <div className="text-[12px] text-[var(--color-text-muted)]">{selectedField.meta}</div>
                </>
              ) : (
                <div className="text-[12px] text-[var(--color-text-muted)]">
                  Focus a field in the review panel to inspect confidence and AI suggestions.
                </div>
              )}
            </PanelSection>

            <PanelSection inset title="Operational confidence" description="Extraction coverage and reviewer readiness">
              <div className="flex flex-col gap-[var(--spacing-3)]">
                <ProgressIndicator
                  label="Field completion"
                  priority="operational"
                  value={(record.queue.completedFields / record.queue.fieldCount) * 100}
                />
                <ProgressIndicator
                  label="AI confidence"
                  priority={record.queue.confidence < 0.8 ? "warning" : "ai-review"}
                  value={record.queue.confidence * 100}
                />
              </div>
            </PanelSection>

            <AINotificationCenter items={aiItems} className="min-h-[220px]" />

            <PanelSection inset title="Operational alerts" description="Escalations and blocking checks">
              <div className="flex flex-col gap-[var(--spacing-3)]">
                {escalationItems.map((item) => (
                  <OperationalAlert
                    key={item.id}
                    title={item.title}
                    description={item.description}
                    priority={item.priority}
                    action={
                      <button
                        type="button"
                        className="fn-btn fn-btn-secondary fn-btn-sm"
                        onClick={() => onEscalateDocument(record.queue.id)}
                      >
                        Escalate
                      </button>
                    }
                  />
                ))}
              </div>
            </PanelSection>
          </div>
        </ScrollRegion>
      </PanelBody>
      <PanelFooter className="justify-between">
        <div className="text-[11px] uppercase tracking-[0.05em] text-[var(--color-text-muted)]">
          {record.queue.anomalyCount} anomaly checks
        </div>
        <div className="flex items-center gap-[var(--spacing-2)]">
          <button type="button" className="fn-btn fn-btn-ai fn-btn-sm" onClick={() => onEscalateDocument(record.queue.id)}>
            Escalate
          </button>
          <button type="button" className="fn-btn fn-btn-primary fn-btn-sm" onClick={onCompleteReview}>
            Approve Extraction
          </button>
        </div>
      </PanelFooter>
    </Panel>
  );
}

function OCRBottomRail({
  escalationItems,
  record,
  workflowItems,
}: {
  escalationItems: FeedbackItem[];
  record: OCRExecutionRecord;
  workflowItems: FeedbackItem[];
}) {
  return (
    <WorkspaceLayoutRegion direction="horizontal" className="h-full">
      <ResizeRegion defaultSize={420} minSize={340} maxSize={520} position="left" className="border-r border-[var(--color-border-default)]">
        <WorkflowFeedbackPanel items={workflowItems} title="Extraction feedback" className="h-full rounded-none border-none" />
      </ResizeRegion>
      <WorkspaceLayoutRegion grow className="border-r border-[var(--color-border-default)]">
        <OCRWorkflowTimelinePanel steps={record.workflowTimeline} />
      </WorkspaceLayoutRegion>
      <ResizeRegion defaultSize={380} minSize={320} maxSize={440} position="right">
        <WorkflowFeedbackPanel items={escalationItems} title="AI escalation feedback" className="h-full rounded-none border-none" />
      </ResizeRegion>
    </WorkspaceLayoutRegion>
  );
}

function OCRWorkflowTimelinePanel({ steps }: { steps: OCRWorkflowTimelineStep[] }) {
  return (
    <Panel variant="inspector" padding="none" className="h-full rounded-none border-none">
      <PanelHeader title="Operational workflow timeline" subtitle="Extraction completion path" />
      <PanelBody padding="none" className="min-h-0">
        <ScrollRegion ownerId="ocr-timeline-scroll" className="h-full" viewportClassName="h-full">
          <div className="flex min-h-full flex-col gap-[var(--spacing-3)] p-[var(--spacing-4)]">
            {steps.map((step) => (
              <PanelSection
                key={step.id}
                inset={false}
                className={cx(
                  "rounded-[var(--radius-md)] border px-[var(--spacing-3)] py-[var(--spacing-3)]",
                  step.status === "critical" && "border-[var(--color-status-critical-border)] bg-[var(--color-status-critical-surface)] text-[var(--color-status-critical-text)]",
                  step.status === "current" && "border-[var(--color-accent-operational-border)] bg-[var(--color-accent-operational-surface)] text-[var(--color-accent-operational-muted)]",
                  step.status === "done" && "border-[var(--color-status-ok-border)] bg-[var(--color-status-ok-surface)] text-[var(--color-status-ok-text)]",
                  step.status === "pending" && "border-[var(--color-border-default)] bg-[var(--color-surface-primary)] text-[var(--color-text-secondary)]"
                )}
                title={step.label}
                description={step.detail}
                action={<span className="font-[var(--font-mono)] text-[11px]">{step.timestamp}</span>}
              />
            ))}
          </div>
        </ScrollRegion>
      </PanelBody>
    </Panel>
  );
}

function resolveQueueRowStates(queue: OCRExecutionQueueItem): DataTableRowState[] {
  const states: DataTableRowState[] = [];

  if (queue.queueState === "blocked" || queue.reviewState === "anomaly") states.push("critical");
  if (queue.workflowState === "pending") states.push("pending");
  if (queue.workflowState === "approved") states.push("approved");
  if (queue.reviewState === "reviewed") states.push("ai-reviewed");
  if (queue.reviewState === "suggested") states.push("ai-suggested");
  if (queue.reviewState === "processing") states.push("ai-processing");
  if (queue.reviewState === "low-confidence" || queue.confidence < 0.8) states.push("low-confidence");
  if (queue.anomalyCount > 0) states.push("flagged");
  if (queue.queueState === "stale") states.push("stale");

  return states;
}

function useNavigableCell(rowId: string, columnId: string, index: number) {
  const navigation = useTableNavigation();
  const ref = useRef<HTMLTableCellElement | null>(null);
  const cellId = `${rowId}:${columnId}`;

  useEffect(
    () => navigation.registerCell({ cellId, columnId, rowId, index }),
    [cellId, columnId, index, navigation, rowId]
  );

  useEffect(() => {
    if (navigation.activeCellId === cellId) {
      ref.current?.focus();
    }
  }, [cellId, navigation.activeCellId]);

  return {
    onFocus: () => navigation.focusCell(cellId),
    ref,
    tabIndex: navigation.activeCellId ? (navigation.activeCellId === cellId ? 0 : -1) : index === 0 ? 0 : -1,
  };
}
