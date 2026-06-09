"use client";

import { useCallback, useMemo } from "react";

import { normalizeOcrConfidence, type OcrVerificationRecord } from "@/lib/ocr";
import {
  DataTableEngineProvider,
  Panel,
  PanelBody,
  PanelHeader,
  ProductionDataTable,
  TableDensitySystem,
  Toolbar,
  ToolbarActions,
  ToolbarSection,
  ToolbarStatusRegion,
  ToolbarViewControls,
  type OCRExecutionRecord,
  useOCRWorkspace,
} from "@/v2/_governed";
import { buildGovernedFieldId, type GovernedReviewSignal } from "@/v2/workspaces/ocr-execution/ocr-governed.utils";

type CorrectionRow = {
  cells: string[];
  id: string;
  rowIndex: number;
};

type GovernedOcrCorrectionRailProps = {
  activeRecord: OcrVerificationRecord | null;
  busy: boolean;
  headers: string[];
  inputIdPrefix: string;
  onApplySafeCleanup: () => void;
  onCellChange: (rowIndex: number, columnIndex: number, value: string) => void;
  onHeaderChange: (columnIndex: number, value: string) => void;
  onOpenDocument: (recordId: string) => void;
  onRestoreRowFromSource: (rowIndex: number) => void;
  record: OCRExecutionRecord;
  reviewSignals: GovernedReviewSignal[];
  rows: string[][];
  tableRegionId: string;
};

function resolveSignalTone(signals: GovernedReviewSignal[]) {
  if (signals.some((signal) => signal.tone === "critical")) {
    return "critical";
  }
  if (signals.some((signal) => signal.tone === "warning")) {
    return "warning";
  }
  if (signals.some((signal) => signal.tone === "info")) {
    return "info";
  }
  return "default";
}

function cellInputClassName(selected: boolean, tone: "critical" | "warning" | "info" | "default") {
  if (tone === "critical") {
    return `h-7 w-full rounded-[var(--radius-sm)] border border-[var(--color-status-critical-border)] bg-[var(--color-status-critical-surface)] px-[var(--spacing-2)] py-[var(--spacing-1)] font-[var(--font-mono)] text-[12px] text-[var(--color-status-critical-text)] outline-none ${selected ? "ring-2 ring-[var(--color-status-critical-border)]/40" : ""}`;
  }
  if (tone === "warning") {
    return `h-7 w-full rounded-[var(--radius-sm)] border border-[var(--color-status-warning-border)] bg-[var(--color-status-warning-surface)] px-[var(--spacing-2)] py-[var(--spacing-1)] font-[var(--font-mono)] text-[12px] text-[var(--color-status-warning-text)] outline-none ${selected ? "ring-2 ring-[var(--color-status-warning-border)]/40" : ""}`;
  }
  if (tone === "info") {
    return `h-7 w-full rounded-[var(--radius-sm)] border border-[var(--color-accent-ai-border)] bg-[var(--color-accent-ai-surface)] px-[var(--spacing-2)] py-[var(--spacing-1)] font-[var(--font-mono)] text-[12px] text-[var(--color-accent-ai-muted)] outline-none ${selected ? "ring-2 ring-[var(--color-accent-ai-border)]/40" : ""}`;
  }
  return `h-7 w-full rounded-[var(--radius-sm)] border border-[var(--color-border-default)] bg-[var(--color-surface-elevated)] px-[var(--spacing-2)] py-[var(--spacing-1)] font-[var(--font-mono)] text-[12px] text-[var(--color-text-primary)] outline-none ${selected ? "ring-2 ring-[var(--color-accent-operational-border)]/40" : ""}`;
}

export function GovernedOcrCorrectionRail({
  activeRecord,
  busy,
  headers,
  inputIdPrefix,
  onApplySafeCleanup,
  onCellChange,
  onHeaderChange,
  onOpenDocument,
  onRestoreRowFromSource,
  record,
  reviewSignals,
  rows,
  tableRegionId,
}: GovernedOcrCorrectionRailProps) {
  const workspace = useOCRWorkspace();
  const ownsRecord = activeRecord != null && String(activeRecord.id) === record.queue.id;
  const selectField = useCallback((fieldId: string | null) => {
    if (!fieldId) {
      return;
    }
    workspace.setSelectedFieldId(fieldId);
    const field = record.extractionFields.find((item) => item.id === fieldId);
    if (field?.boundingBoxId) {
      workspace.setSelectionId(field.boundingBoxId);
    }
  }, [record.extractionFields, workspace]);

  const data = useMemo<CorrectionRow[]>(
    () => rows.map((cells, rowIndex) => ({ cells, id: `${record.queue.id}-row-${rowIndex}`, rowIndex })),
    [record.queue.id, rows],
  );

  const signalMap = useMemo(() => {
    const next = new Map<string, GovernedReviewSignal[]>();
    reviewSignals.forEach((signal) => {
      if (signal.rowIndex == null || signal.columnIndex == null) {
        return;
      }
      const key = `${signal.rowIndex}-${signal.columnIndex}`;
      next.set(key, [...(next.get(key) ?? []), signal]);
    });
    return next;
  }, [reviewSignals]);

  const rowSignalCounts = useMemo(() => {
    const next = new Map<number, number>();
    reviewSignals.forEach((signal) => {
      if (signal.rowIndex == null) {
        return;
      }
      next.set(signal.rowIndex, (next.get(signal.rowIndex) ?? 0) + 1);
    });
    return next;
  }, [reviewSignals]);

  const engineColumns = useMemo(() => {
    return [
      { id: "row", minWidth: 116, width: 116 },
      ...headers.map((header, columnIndex) => ({
        id: `column-${columnIndex}`,
        minWidth: 176,
        width: Math.max(176, Math.min(280, header.length * 12 + 120)),
      })),
      { id: "actions", minWidth: 132, width: 132 },
    ];
  }, [headers]);

  const columns = useMemo(() => {
    return [
      {
        accessorFn: (row: CorrectionRow) => row.rowIndex,
        cell: ({ row }: { row: CorrectionRow }) => {
          const signalCount = rowSignalCounts.get(row.rowIndex) ?? 0;
          const primaryFieldId = ownsRecord && activeRecord
            ? buildGovernedFieldId(activeRecord.id, row.rowIndex, 0)
            : null;

          return (
            <button
              type="button"
              className="flex w-full flex-col items-start rounded-[var(--radius-sm)] border border-transparent px-[var(--spacing-2)] py-[var(--spacing-2)] text-left transition hover:border-[var(--color-border-default)] hover:bg-[var(--color-surface-elevated)]"
              onMouseEnter={() => selectField(primaryFieldId)}
              onClick={() => {
                if (!primaryFieldId) {
                  onOpenDocument(record.queue.id);
                  return;
                }
                selectField(primaryFieldId);
                window.setTimeout(() => {
                  document.getElementById(`${inputIdPrefix}${row.rowIndex}-0`)?.focus();
                }, 40);
              }}
            >
              <span className="text-[12px] font-medium text-[var(--color-text-primary)]">Row {row.rowIndex + 1}</span>
              <span className="text-[11px] uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
                {signalCount > 0 ? `${signalCount} signal${signalCount === 1 ? "" : "s"}` : "Ready"}
              </span>
            </button>
          );
        },
        header: <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Row</span>,
        id: "row",
        size: 116,
      },
      ...headers.map((header, columnIndex) => ({
        accessorFn: (row: CorrectionRow) => row.cells[columnIndex] || "",
        cell: ({ row, value }: { row: CorrectionRow; value: unknown }) => {
          const fieldId = ownsRecord && activeRecord ? buildGovernedFieldId(activeRecord.id, row.rowIndex, columnIndex) : null;
          const cellSignals = signalMap.get(`${row.rowIndex}-${columnIndex}`) ?? [];
          const confidence = normalizeOcrConfidence(activeRecord?.cell_confidence?.[row.rowIndex]?.[columnIndex]);
          const selected = fieldId != null && workspace.selectedFieldId === fieldId;
          const tone =
            resolveSignalTone(cellSignals) === "default" && confidence != null && confidence >= 0.9
              ? "info"
              : resolveSignalTone(cellSignals);
          const stateLabel =
            tone === "critical"
              ? "Low confidence"
              : tone === "warning"
                ? "Needs verification"
                : confidence != null && confidence >= 0.9
                  ? "Verified"
                  : "Unreviewed";

          return (
            <div
              className="space-y-[var(--spacing-1)] py-[var(--spacing-1)]"
              onMouseEnter={() => selectField(fieldId)}
            >
              <input
                id={`${inputIdPrefix}${row.rowIndex}-${columnIndex}`}
                className={cellInputClassName(selected, tone)}
                value={String(value ?? "")}
                disabled={!ownsRecord || busy}
                onChange={(event) => onCellChange(row.rowIndex, columnIndex, event.target.value)}
                onFocus={() => {
                  selectField(fieldId);
                }}
                onClick={() => {
                  selectField(fieldId);
                }}
              />
              <div className="flex items-center justify-between gap-[var(--spacing-2)] text-[10px] uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
                <span>{confidence == null ? "No confidence" : `${Math.round(confidence * 100)}% confidence`}</span>
                <span>{stateLabel}</span>
              </div>
            </div>
          );
        },
        header: (
          <input
            className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border-default)] bg-[var(--color-surface-elevated)] px-[var(--spacing-2)] py-[var(--spacing-2)] text-[12px] text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-accent-operational-border)] focus:ring-2 focus:ring-[var(--color-accent-operational-border)]/30"
            value={header}
            disabled={!ownsRecord || busy}
            onChange={(event) => onHeaderChange(columnIndex, event.target.value)}
          />
        ),
        id: `column-${columnIndex}`,
        size: engineColumns[columnIndex + 1]?.width ?? 176,
      })),
      {
        accessorFn: (row: CorrectionRow) => row.rowIndex,
        cell: ({ row }: { row: CorrectionRow }) => (
          <button
            type="button"
            className="fn-btn fn-btn-secondary fn-btn-sm"
            disabled={!ownsRecord || busy}
            onClick={() => onRestoreRowFromSource(row.rowIndex)}
          >
            Restore row
          </button>
        ),
        header: <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Actions</span>,
        id: "actions",
        size: 132,
      },
    ];
  }, [
    activeRecord,
    busy,
    engineColumns,
    headers,
    inputIdPrefix,
    onCellChange,
    onHeaderChange,
    onOpenDocument,
    onRestoreRowFromSource,
    ownsRecord,
    record.queue.id,
    rowSignalCounts,
    selectField,
    signalMap,
    workspace,
  ]);

  if (!ownsRecord) {
    return (
      <Panel variant="workspace" padding="none" className="h-full rounded-none border-none">
        <PanelHeader title="Governed correction rail" subtitle="Open the route-owned draft to edit OCR cells" meta={record.queue.id} />
        <PanelBody className="flex items-center justify-center px-[var(--spacing-4)]">
          <button type="button" className="fn-btn fn-btn-primary fn-btn-sm" onClick={() => onOpenDocument(record.queue.id)}>
            Open governed draft
          </button>
        </PanelBody>
      </Panel>
    );
  }

  return (
    <DataTableEngineProvider
      columns={engineColumns}
      defaultDensity="compact"
      defaultPinnedColumns={{ actions: "right", row: "left" }}
      persistenceKey="factorynerve.ocr.execution.corrections"
      rowIds={data.map((row) => row.id)}
    >
      <Panel variant="workspace" padding="none" className="h-full rounded-none border-none">
        <PanelHeader
          title="OCR spreadsheet"
          subtitle="Inline cell editing with source-linked review focus"
          meta={`${rows.length} row${rows.length === 1 ? "" : "s"} / ${headers.length} column${headers.length === 1 ? "" : "s"}`}
        />
        <Toolbar aria-label="Governed correction tools">
          <ToolbarSection grow />
          <ToolbarStatusRegion
            items={[
              { id: "rows", label: "Rows", value: String(rows.length), tone: "neutral" },
              { id: "headers", label: "Columns", value: String(headers.length), tone: "ai" },
              { id: "signals", label: "Signals", value: String(reviewSignals.length), tone: reviewSignals.length > 0 ? "warning" : "ok" },
            ]}
          />
          <ToolbarActions justify="end">
            <button type="button" className="fn-btn fn-btn-secondary fn-btn-sm" onClick={onApplySafeCleanup} disabled={busy}>
              Safe cleanup
            </button>
          </ToolbarActions>
          <TableDensitySystem>
            {({ density, setDensity }) => (
              <ToolbarViewControls density={density === "comfortable" ? "touch" : density} onDensityChange={(next) => setDensity(next === "touch" ? "comfortable" : next)} />
            )}
          </TableDensitySystem>
        </Toolbar>
        <PanelBody padding="none" className="min-h-0">
          <div id={tableRegionId} tabIndex={-1} className="h-full outline-none">
            <ProductionDataTable columns={columns} data={data} getRowId={(row) => row.id} />
          </div>
        </PanelBody>
      </Panel>
    </DataTableEngineProvider>
  );
}
