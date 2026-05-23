"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { getOcrConfidenceTier, type OcrCell, type OcrConfidenceMatrix } from "@/lib/ocr";
import { cn } from "@/lib/utils";

export type OcrColumnType = "text" | "number" | "date";
export type ActiveGridCell = { row: number; column: number } | null;

type CellObject = { value: string; confidence?: number | null; source?: string | null; reviewRequired?: boolean };

type DataTableGridProps = {
  headers: string[];
  rows: OcrCell[][];
  columnTypes: OcrColumnType[];
  confidenceMatrix?: OcrConfidenceMatrix;
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

function normalizeCell(cell: OcrCell): CellObject {
  if (typeof cell === "string") {
    return { value: cell, confidence: null, source: null };
  }
  return {
    value: cell.value,
    confidence: cell.confidence,
    source: cell.source,
    reviewRequired: cell.reviewRequired,
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

function getConfidenceClass(tier: "high" | "medium" | "review_required"): string {
  if (tier === "review_required") return "bg-status-danger-bg border-status-danger-border text-status-danger-fg";
  if (tier === "medium") return "bg-status-warning-bg border-status-warning-border text-status-warning-fg";
  return "bg-status-synced-bg border-status-synced-border text-status-synced-fg";
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

  const commitCell = (target: CellTarget, value: string) => {
    if (!target) return;
    const nextRows = normalizedRows.map((row, rowIndex) =>
      rowIndex === target.row
        ? row.map((cell, columnIndex) =>
          columnIndex === target.column
            ? { value, confidence: 0.95, reviewRequired: false, source: "corrected" as const }  // Edited cells were being re-saved as fake 100% values instead of a stable review tier.
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
    <div className="overflow-hidden rounded-panel border border-border-default bg-surface-panel shadow-xs">
      <div className="border-b border-border-subtle px-md py-sm">
        <div className="text-label-dense font-semibold uppercase tracking-[0.16em] text-text-secondary">
          Preview & edit
        </div>
        <div className="mt-1 text-label text-text-secondary">Inline edits only. No popups.</div>
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
        } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          event.preventDefault();
          onActiveCellChange?.(selectedCell);
          setEditingCell(selectedCell);
          setDraftValue(event.key);
        }
      }}>
        <table className="min-w-full border-separate border-spacing-0 text-table-density">
          <thead className="sticky top-0 z-10 bg-surface-panel">
            <tr>
              {normalizedHeaders.map((header, columnIndex) => (
                <th
                  key={`head-${columnIndex}`}
                  className="min-w-[11rem] border-b border-border-default bg-surface-panel px-cell-x py-cell-y text-left align-top"
                >
                  <input
                    value={header}
                    readOnly={readOnly}
                    onChange={(event) => updateHeader(columnIndex, event.target.value)}
                    className="h-input w-full rounded-control border border-border-default bg-surface-shell px-sm text-label font-medium text-text-primary outline-none transition focus:border-border-focus focus:bg-surface-panel"
                  />
                  {!readOnly ? (
                    <select
                      value={normalizedTypes[columnIndex]}
                      onChange={(event) => {
                        const next = [...normalizedTypes];
                        next[columnIndex] = event.target.value as OcrColumnType;
                        onChangeColumnTypes(next);
                      }}
                      className="mt-2 h-input w-full rounded-control border border-border-subtle bg-surface-panel px-sm text-label-dense text-text-secondary outline-none transition focus:border-border-focus"
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
                  const cellData = normalizeCell(currentCell);
                  const isSelected =
                    selectedCell?.row === rowIndex && selectedCell?.column === columnIndex;
                  const isEditing =
                    editingCell?.row === rowIndex && editingCell?.column === columnIndex;
                  const originalCell = originalRows?.[rowIndex]?.[columnIndex];
                  const raw = originalCell ? normalizeCell(originalCell).value : "";
                  const confidenceRaw = typeof currentCell === "object"
                    ? currentCell.confidence
                    : confidenceMatrix?.[rowIndex]?.[columnIndex];
                  const confidenceTier = getOcrConfidenceTier(confidenceRaw ?? undefined);
                  const title = `${getConfidenceLabel(confidenceTier)}${raw && raw !== cellData.value ? ` | Original: ${raw}` : ""}`;

                  return (
                    <td
                      key={`cell-${rowIndex}-${columnIndex}`}
                      className={cn(
                        "border-b border-border-subtle px-cell-x py-cell-y align-top",
                        showLowConfidence || confidenceTier === "high" ? getConfidenceClass(confidenceTier) : "",
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
                            "h-input w-full rounded-control border border-border-focus bg-surface-panel px-sm text-table-density text-text-primary outline-none",
                            alignForColumn(normalizedTypes[columnIndex], normalizedHeaders[columnIndex] || ""),
                          )}
                        />
                      ) : (
                        <button
                          type="button"
                          title={title}
                          className={cn(
                            "flex h-input w-full items-center gap-2 rounded-control border px-sm text-table-density text-text-primary outline-none transition duration-150",
                            alignForColumn(normalizedTypes[columnIndex], normalizedHeaders[columnIndex] || ""),
                            isSelected
                              ? "border-border-focus bg-surface-selected shadow-[inset_0_0_0_1px_var(--border-focus)]"
                              : "border-border-subtle bg-surface-shell hover:border-border-default hover:bg-surface-panel",
                          )}
                          onClick={() => {
                            const next = { row: rowIndex, column: columnIndex };
                            onActiveCellChange?.(next);
                          }}
                          onDoubleClick={() => beginEdit({ row: rowIndex, column: columnIndex })}
                        >
                          <span className="truncate">{cellData.value || "\u00A0"}</span>
                          <span className={cn("ml-auto rounded-badge border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]", getConfidenceBadgeClass(confidenceTier))}>
                            {getConfidenceLabel(confidenceTier)}
                          </span>
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
