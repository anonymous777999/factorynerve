"use client";

import { useMemo, useRef, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  type ColumnDef,
  type ColumnResizeMode,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";

import { DEFAULT_COLUMN_WIDTH, MAX_COLUMN_WIDTH, MIN_COLUMN_WIDTH } from "@/config/ocrColumns";
import { getOcrConfidenceTier, type OcrCell } from "@/lib/ocr";

interface OcrSpreadsheetGridProps {
  rows: OcrCell[][];
  headers: string[];
  activeCell?: { row: number; column: number } | null;
  onActiveCellChange?: (cell: { row: number; column: number } | null) => void;
  onCellEdit: (rowIndex: number, columnIndex: number, value: string) => void;
  isReadOnly: boolean;
}

type RowData = Record<string, OcrCell>;

function normalizeCell(cell: OcrCell): { value: string; confidence?: number | null } {
  if (typeof cell === "string") {
    return { value: cell, confidence: null };
  }
  return { value: cell.value, confidence: cell.confidence };
}

function getConfidenceClass(tier: "high" | "medium" | "review_required"): string {
  if (tier === "review_required") return "border-l-4 border-l-status-danger-border bg-status-danger-bg";
  if (tier === "medium") return "border-l-4 border-l-status-warning-border bg-status-warning-bg";
  return "border-l-4 border-l-status-synced-border bg-status-synced-bg";
}

function getConfidenceBadgeClass(tier: "high" | "medium" | "review_required"): string {
  if (tier === "review_required") return "border-status-danger-border bg-status-danger-bg text-status-danger-fg";
  if (tier === "medium") return "border-status-warning-border bg-status-warning-bg text-status-warning-fg";
  return "border-status-synced-border bg-status-synced-bg text-status-synced-fg";
}

function getConfidenceLabel(tier: "high" | "medium" | "review_required") {
  if (tier === "review_required") return "Review";
  if (tier === "medium") return "Check";
  return "Verified";
}

function isNumericValue(value: string): boolean {
  if (!value || typeof value !== "string") return false;
  const trimmed = value.trim();
  return /^[\u20b9$\u20ac\u00a3\u00a5]?\s*-?\d[\d,]*(?:\.\d+)?%?$/.test(trimmed);
}

export function OcrSpreadsheetGrid({
  rows,
  headers,
  activeCell,
  onActiveCellChange,
  onCellEdit,
  isReadOnly,
}: OcrSpreadsheetGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; columnIndex: number } | null>(null);
  const [draftValue, setDraftValue] = useState("");
  const [columnResizeMode] = useState<ColumnResizeMode>("onChange");

  const tableData = useMemo(() => {
    return rows.map((row) => {
      const rowObj: RowData = {};
      headers.forEach((_, idx) => {
        rowObj[`col_${idx}`] = row[idx] || "";
      });
      return rowObj;
    });
  }, [rows, headers]);

  const columns = useMemo<ColumnDef<RowData>[]>(() => {
    return headers.map((header, columnIndex) => ({
      id: `col_${columnIndex}`,
      accessorKey: `col_${columnIndex}`,
      header: () => <div className="truncate text-xs font-semibold uppercase tracking-[0.08em] text-text-secondary">{header}</div>,
      cell: (info) => {
        const rowIndex = info.row.index;
        const cell = info.getValue() as OcrCell;
        const { value, confidence } = normalizeCell(cell);
        const confidenceTier = getOcrConfidenceTier(confidence ?? undefined);
        const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.columnIndex === columnIndex;
        const isSelected = activeCell?.row === rowIndex && activeCell?.column === columnIndex;
        const isNumeric = isNumericValue(value);

        if (isEditing) {
          return (
            <input
              autoFocus
              value={draftValue}
              onChange={(event) => setDraftValue(event.target.value)}
              onBlur={() => {
                if (draftValue !== value) {
                  onCellEdit(rowIndex, columnIndex, draftValue);
                }
                setEditingCell(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  if (draftValue !== value) {
                    onCellEdit(rowIndex, columnIndex, draftValue);
                  }
                  setEditingCell(null);
                } else if (event.key === "Escape") {
                  setEditingCell(null);
                  setDraftValue("");
                }
              }}
              className="h-full w-full border-2 border-border-focus bg-surface-panel px-3 py-2 text-text-primary outline-none focus:ring-2 focus:ring-border-focus"
              style={{ fontFamily: 'Inter, "Noto Sans Devanagari", sans-serif' }}
            />
          );
        }

        return (
          <div
            className={`flex h-full w-full cursor-text items-center gap-2 truncate px-3 py-2 text-text-primary ${getConfidenceClass(confidenceTier)} ${isSelected ? "ring-1 ring-inset ring-border-focus" : ""} ${isNumeric ? "text-right font-variant-numeric-tabular" : ""}`}
            onClick={() => {
              onActiveCellChange?.({ row: rowIndex, column: columnIndex });
              if (!isReadOnly) {
                setEditingCell({ rowIndex, columnIndex });
                setDraftValue(value);
              }
            }}
            title={getConfidenceLabel(confidenceTier)}
            style={{
              fontFamily: 'Inter, "Noto Sans Devanagari", sans-serif',
              fontSize: "14px",
              lineHeight: "1.5",
              fontVariantNumeric: isNumeric ? "tabular-nums" : "normal",
            }}
          >
            <span className="truncate">{value || "\u00A0"}</span>
            <span className={`ml-auto rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${getConfidenceBadgeClass(confidenceTier)}`}>
              {getConfidenceLabel(confidenceTier)}
            </span>
          </div>
        );
      },
      size: DEFAULT_COLUMN_WIDTH,
      minSize: MIN_COLUMN_WIDTH,
      maxSize: MAX_COLUMN_WIDTH,
      enableResizing: true,
    }));
  }, [activeCell, draftValue, editingCell, headers, isReadOnly, onActiveCellChange, onCellEdit]);

  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode,
    enableColumnResizing: true,
  });

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 36,
    overscan: 10,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  const paddingTop = virtualRows.length > 0 ? virtualRows[0]?.start || 0 : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? totalSize - (virtualRows[virtualRows.length - 1]?.end || 0)
      : 0;

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden border border-border-default bg-surface-panel shadow-sm">
      <div
        ref={containerRef}
        className="min-h-0 flex-1 overflow-auto"
      >
        <table className="w-full border-separate border-spacing-0">
          <thead className="sticky top-0 z-10 shadow-md">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                <th className="sticky left-0 z-20 w-12 border border-border-default bg-surface-panel px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                  Row
                </th>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="relative border border-border-default bg-surface-panel px-3 py-2 text-left"
                    style={{
                      width: header.getSize(),
                      fontWeight: 600,
                      fontFamily: 'Inter, "Noto Sans Devanagari", sans-serif',
                      fontSize: "12px",
                    }}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    <div
                      onMouseDown={header.getResizeHandler()}
                      onTouchStart={header.getResizeHandler()}
                      className={`absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none ${header.column.getIsResizing() ? "bg-border-focus" : "bg-border-default hover:bg-border-focus"}`}
                    />
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {paddingTop > 0 ? (
              <tr>
                <td style={{ height: `${paddingTop}px` }} />
              </tr>
            ) : null}
            {virtualRows.map((virtualRow) => {
              const row = table.getRowModel().rows[virtualRow.index];
              const isEvenRow = virtualRow.index % 2 === 0;
              return (
                <tr
                  key={row.id}
                  className={`transition-colors hover:bg-surface-selected ${isEvenRow ? "bg-surface-shell" : "bg-surface-panel"}`}
                >
                  <td className="sticky left-0 z-10 border border-border-default bg-surface-shell px-2 text-center text-xs font-semibold text-text-tertiary">
                    {virtualRow.index + 1}
                  </td>
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="border border-border-default"
                      style={{ width: cell.column.getSize(), height: "40px" }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}
            {paddingBottom > 0 ? (
              <tr>
                <td style={{ height: `${paddingBottom}px` }} />
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
