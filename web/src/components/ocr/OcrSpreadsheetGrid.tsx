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
  if (tier === "review_required") return "border-l-4 border-l-red-400";
  if (tier === "medium") return "border-l-4 border-l-amber-400";
  return "border-l-4 border-l-emerald-400";
}

function getConfidenceBadgeClass(tier: "high" | "medium" | "review_required"): string {
  if (tier === "review_required") return "border-red-200 bg-red-100 text-red-700";
  if (tier === "medium") return "border-amber-200 bg-amber-100 text-amber-700";
  return "border-emerald-200 bg-emerald-100 text-emerald-700";
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

export function OcrSpreadsheetGrid({ rows, headers, onCellEdit, isReadOnly }: OcrSpreadsheetGridProps) {
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
      header: () => <div className="font-semibold text-sm truncate text-white">{header}</div>,
      cell: (info) => {
        const rowIndex = info.row.index;
        const cell = info.getValue() as OcrCell;
        const { value, confidence } = normalizeCell(cell);
        const confidenceTier = getOcrConfidenceTier(confidence ?? undefined);
        const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.columnIndex === columnIndex;
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
              className="w-full h-full px-3 py-2 border-2 border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-[#1a1a1a]"
              style={{ fontFamily: 'Inter, "Noto Sans Devanagari", sans-serif' }}
            />
          );
        }

        return (
          <div
            className={`flex w-full h-full items-center gap-2 px-3 py-2 cursor-text truncate text-[#1a1a1a] ${getConfidenceClass(confidenceTier)} ${isNumeric ? "text-right font-variant-numeric-tabular" : ""}`}
            onClick={() => {
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
  }, [draftValue, editingCell, headers, isReadOnly, onCellEdit]);

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
    <div className="w-full h-full flex flex-col border border-[#d0d0d0] rounded-lg overflow-hidden bg-white shadow-sm">
      <div
        ref={containerRef}
        className="flex-1 overflow-auto"
        style={{ height: "600px" }}
      >
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10 shadow-md">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="border border-[#d0d0d0] bg-[#1e3a5f] px-3 py-3 text-left relative"
                    style={{
                      width: header.getSize(),
                      fontWeight: 600,
                      fontFamily: 'Inter, "Noto Sans Devanagari", sans-serif',
                      fontSize: "14px",
                    }}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    <div
                      onMouseDown={header.getResizeHandler()}
                      onTouchStart={header.getResizeHandler()}
                      className={`absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none ${header.column.getIsResizing() ? "bg-blue-400" : "bg-[#d0d0d0] hover:bg-blue-300"}`}
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
                  className={`hover:bg-[#e8f0fe] transition-colors ${isEvenRow ? "bg-white" : "bg-[#f8f9fa]"}`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="border border-[#d0d0d0]"
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
