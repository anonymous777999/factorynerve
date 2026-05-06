"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { type OcrCell } from "@/lib/ocr";

export type OcrColumnType = "text" | "number" | "date";
export type ActiveGridCell = { row: number; column: number } | null;

type CellObject = { value: string; confidence: number; source?: string | null };

type DataTableGridProps = {
  headers: string[];
  rows: OcrCell[][];  // Use the shared type
  columnTypes: OcrColumnType[];
  confidenceMatrix?: number[][];
  originalRows?: OcrCell[][];
  showLowConfidence?: boolean;
  readOnly?: boolean;
  activeCell?: ActiveGridCell;
  onActiveCellChange?: (cell: ActiveGridCell) => void;
  onChangeHeaders: (headers: string[]) => void;
  onChangeRows: (rows: OcrCell[][]) => void;
  onChangeColumnTypes: (types: OcrColumnType[]) => void;
};

type CellTarget = { row: number; column: number } | null;

// Phase 2: Helper to normalize any cell format to CellObject
function normalizeCell(cell: OcrCell): CellObject {
  if (typeof cell === "string") {
    return { value: cell, confidence: 1.0, source: null };
  }
  return {
    value: cell.value,
    confidence: cell.confidence,
    source: cell.source,
  };
}

function normalizeLength(row: OcrCell[], columns: number): OcrCell[] {
  return Array.from({ length: columns }, (_, index) => row[index] || "");
}

function inferColumnType(values: OcrCell[]): OcrColumnType {
  const filled = values
    .map((cell) => normalizeCell(cell).value.trim())
    .filter(Boolean);
  if (!filled.length) return "text";
  const numberLike = filled.every((value) => /^-?\d[\d,]*(?:\.\d+)?$/.test(value));
  if (numberLike) return "number";
  const dateLike = filled.every((value) => !Number.isNaN(Date.parse(value)));
  if (dateLike) return "date";
  return "text";
}

// Phase 2: Updated confidence color mapping (uses 0-1.0 scale)
function getConfidenceClass(confidence: number): string {
  if (confidence < 0.5) return "bg-red-50 border-red-200 text-red-900";
  if (confidence < 0.7) return "bg-orange-50 border-orange-200 text-orange-900";
  if (confidence < 0.9) return "bg-yellow-50 border-yellow-200 text-yellow-900";
  return "";
}

function isAmountHeader(header: string) {
  const normalized = header.trim().toLowerCase();
  return normalized.includes("amount")
    || normalized.includes("amt")
    || normalized.includes("total")
    || normalized.includes("balance")
    || normalized.includes("inr")
    || normalized.includes("rs")
    || normalized.includes("\u20b9");
}

function alignForColumn(type: OcrColumnType, header: string) {
  if (type === "number" || isAmountHeader(header)) return "text-right";
  return "text-left";
}

export function DataTableGrid({
  headers,
  rows,
  columnTypes,
  confidenceMatrix,
  originalRows,
  showLowConfidence = false,
  readOnly = false,
  activeCell,
  onActiveCellChange,
  onChangeHeaders,
  onChangeRows,
  onChangeColumnTypes,
}: DataTableGridProps) {
  const columnCount = Math.max(headers.length, ...rows.map((row) => row.length), 1);
  const normalizedHeaders = useMemo(
    () => Array.from({ length: columnCount }, (_, index) => headers[index] || `Column ${index + 1}`),
    [columnCount, headers],
  );
  const normalizedRows = useMemo(
    () =>
      rows.length > 0
        ? rows.map((row) => normalizeLength(row, columnCount))
        : [Array.from({ length: columnCount }, () => "")],
    [columnCount, rows],
  );
  const normalizedTypes = useMemo(
    () =>
      Array.from({ length: columnCount }, (_, index) => {
        return columnTypes[index] || inferColumnType(normalizedRows.map((row) => row[index] || ""));
      }),
    [columnCount, columnTypes, normalizedRows],
  );

  const [editingCell, setEditingCell] = useState<CellTarget>(null);
  const [draftValue, setDraftValue] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const selectedCell = activeCell ?? null;

  useEffect(() => {
    if (!editingCell) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editingCell]);

  const moveSelection = (row: number, column: number) => {
    const next = {
      row: Math.max(0, Math.min(normalizedRows.length - 1, row)),
      column: Math.max(0, Math.min(columnCount - 1, column)),
    };
    onActiveCellChange?.(next);
    return next;
  };

  // Phase 2: Updated to return cell objects when edited
  const commitCell = (target: CellTarget, value: string) => {
    if (!target) return;
    const nextRows = normalizedRows.map((row, rowIndex) =>
      rowIndex === target.row
        ? row.map((cell, columnIndex) =>
          columnIndex === target.column
            ? { value, confidence: 100, source: "corrected" as const }  // User-edited = full confidence (0-100 scale) + source tag
            : cell
        )
        : row,
    );
    onChangeRows(nextRows);
  };

  const beginEdit = (target: CellTarget) => {
    if (!target || readOnly) return;
    onActiveCellChange?.(target);
    setEditingCell(target);
    const cellData = normalizedRows[target.row]?.[target.column];
    setDraftValue(normalizeCell(cellData).value);
  };

  const finishEdit = (mode: "commit" | "cancel", nextTarget?: CellTarget) => {
    if (mode === "commit" && editingCell) {
      commitCell(editingCell, draftValue);
      if (nextTarget) {
        moveSelection(nextTarget.row, nextTarget.column);
      }
    }
    setEditingCell(null);
    setDraftValue("");
  };

  const updateHeader = (columnIndex: number, value: string) => {
    const next = [...normalizedHeaders];
    next[columnIndex] = value;
    onChangeHeaders(next);
  };

  return (
    <div className="overflow-hidden rounded-[28px] border border-[#e3e8ef] bg-white shadow-[0_18px_54px_rgba(15,23,42,0.05)]">
      <div className="border-b border-[#edf1f5] px-5 py-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#667085]">
          Preview & edit
        </div>
        <div className="mt-1 text-sm text-[#667085]">Inline edits only. No popups.</div>
      </div>

      <div className="overflow-auto" onKeyDown={(event) => {
        if (!selectedCell || readOnly) return;
        if (event.key === "F2") {
          event.preventDefault();
          beginEdit(selectedCell);
          return;
        }
        if (editingCell) return;
        if (event.key === "ArrowRight") {
          event.preventDefault();
          moveSelection(selectedCell.row, selectedCell.column + 1);
        } else if (event.key === "ArrowLeft") {
          event.preventDefault();
          moveSelection(selectedCell.row, selectedCell.column - 1);
        } else if (event.key === "ArrowDown") {
          event.preventDefault();
          moveSelection(selectedCell.row + 1, selectedCell.column);
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          moveSelection(selectedCell.row - 1, selectedCell.column);
        } else if (event.key === "Enter") {
          event.preventDefault();
          beginEdit(selectedCell);
        }
      }}>
        <table className="min-w-full border-separate border-spacing-0">
          <thead className="sticky top-0 z-10 bg-white">
            <tr>
              {normalizedHeaders.map((header, columnIndex) => (
                <th
                  key={`head-${columnIndex}`}
                  className="min-w-[12rem] border-b border-[#edf1f5] bg-white px-3 py-3 text-left align-top"
                >
                  <input
                    value={header}
                    readOnly={readOnly}
                    onChange={(event) => updateHeader(columnIndex, event.target.value)}
                    className="h-10 w-full rounded-[14px] border border-[#d9e1e8] bg-[#fbfcfd] px-3 text-sm font-medium text-[#101828] outline-none transition focus:border-[#185FA5] focus:bg-white"
                  />
                  {!readOnly ? (
                    <select
                      value={normalizedTypes[columnIndex]}
                      onChange={(event) => {
                        const next = [...normalizedTypes];
                        next[columnIndex] = event.target.value as OcrColumnType;
                        onChangeColumnTypes(next);
                      }}
                      className="mt-2 h-9 w-full rounded-[12px] border border-[#e0e7ef] bg-white px-3 text-xs text-[#667085] outline-none transition focus:border-[#185FA5]"
                    >
                      <option value="text">Text</option>
                      <option value="number">Number</option>
                      <option value="date">Date</option>
                    </select>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {normalizedRows.map((row, rowIndex) => (
              <tr key={`row-${rowIndex}`}>
                {row.map((currentCell, columnIndex) => {
                  // Phase 2: Normalize cell to handle both formats
                  const cellData = normalizeCell(currentCell);
                  const isSelected =
                    selectedCell?.row === rowIndex && selectedCell?.column === columnIndex;
                  const isEditing =
                    editingCell?.row === rowIndex && editingCell?.column === columnIndex;
                  const originalCell = originalRows?.[rowIndex]?.[columnIndex];
                  const raw = originalCell ? normalizeCell(originalCell).value : "";

                  // Phase 2: Use cell object confidence if available, otherwise use legacy matrix
                  // Both sources now use 0-100 scale
                  const confidenceRaw = typeof currentCell === "object"
                    ? currentCell.confidence
                    : confidenceMatrix?.[rowIndex]?.[columnIndex];

                  const confidence = (confidenceRaw ?? 100) / 100;  // Normalize to 0-1.0 for CSS classes
                  const confidencePercent = Math.round(confidenceRaw ?? 100);
                  const title = `Confidence: ${confidencePercent}%${raw && raw !== cellData.value ? ` | Original: ${raw}` : ""}`;

                  return (
                    <td
                      key={`cell-${rowIndex}-${columnIndex}`}
                      className={cn(
                        "border-b border-[#f0f3f7] px-3 py-3 align-top",
                        getConfidenceClass(confidence),  // Phase 2: Apply to td so visible in both view and edit modes
                      )}
                    >
                      {isEditing ? (
                        <input
                          ref={inputRef}
                          value={draftValue}
                          onChange={(event) => setDraftValue(event.target.value)}
                          onBlur={() => finishEdit("commit")}
                          onKeyDown={(event) => {
                            if (event.key === "Escape") {
                              event.preventDefault();
                              finishEdit("cancel");
                            } else if (event.key === "Tab") {
                              event.preventDefault();
                              const next = {
                                row: rowIndex,
                                column: columnIndex + (event.shiftKey ? -1 : 1),
                              };
                              finishEdit("commit", next);
                            } else if (event.key === "Enter") {
                              event.preventDefault();
                              finishEdit("commit");
                            }
                          }}
                          className={cn(
                            "h-10 w-full rounded-[14px] border border-[#185FA5] bg-white px-3 text-sm text-[#101828] outline-none",
                            alignForColumn(normalizedTypes[columnIndex], normalizedHeaders[columnIndex] || ""),
                          )}
                        />
                      ) : (
                        <button
                          type="button"
                          title={title}
                          className={cn(
                            "flex h-10 w-full items-center rounded-[14px] border px-3 text-sm text-[#101828] outline-none transition duration-150",
                            alignForColumn(normalizedTypes[columnIndex], normalizedHeaders[columnIndex] || ""),
                            isSelected
                              ? "border-[#185FA5] bg-[#f4f9ff] shadow-[inset_0_0_0_1px_rgba(24,95,165,0.12)]"
                              : "border-[#eef2f6] bg-[#fbfcfd] hover:border-[#d8e1ea] hover:bg-white",
                          )}
                          onClick={() => {
                            const next = { row: rowIndex, column: columnIndex };
                            onActiveCellChange?.(next);
                          }}
                          onDoubleClick={() => beginEdit({ row: rowIndex, column: columnIndex })}
                        >
                          <span className="truncate">{cellData.value || "\u00A0"}</span>
                          {confidence < 0.5 && cellData.value && (
                            <span className="ml-auto pl-1 text-red-600" title="Very low confidence - review required">⚠️</span>
                          )}
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
