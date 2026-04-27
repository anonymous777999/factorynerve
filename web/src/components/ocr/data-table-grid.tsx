"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export type OcrColumnType = "text" | "number" | "date";
export type ActiveGridCell = { row: number; column: number } | null;

type DataTableGridProps = {
  headers: string[];
  rows: string[][];
  columnTypes: OcrColumnType[];
  confidenceMatrix?: number[][];
  originalRows?: string[][];
  showLowConfidence?: boolean;
  readOnly?: boolean;
  activeCell?: ActiveGridCell;
  onActiveCellChange?: (cell: ActiveGridCell) => void;
  onChangeHeaders: (headers: string[]) => void;
  onChangeRows: (rows: string[][]) => void;
  onChangeColumnTypes: (types: OcrColumnType[]) => void;
};

type CellTarget = { row: number; column: number } | null;

function normalizeLength(row: string[], columns: number) {
  return Array.from({ length: columns }, (_, index) => row[index] || "");
}

function inferColumnType(values: string[]): OcrColumnType {
  const filled = values.map((value) => value.trim()).filter(Boolean);
  if (!filled.length) return "text";
  const numberLike = filled.every((value) => /^-?\d+(?:[.,]\d+)?$/.test(value));
  if (numberLike) return "number";
  const dateLike = filled.every((value) => !Number.isNaN(Date.parse(value)));
  if (dateLike) return "date";
  return "text";
}

function cellTone(confidence?: number, visible?: boolean) {
  if (!visible || typeof confidence !== "number") return "";
  if (confidence < 60) return "border-amber-300 bg-amber-50";
  if (confidence < 85) return "border-[#e8d8b0] bg-[#fff8e8]";
  return "";
}

function alignForType(type: OcrColumnType) {
  if (type === "number") return "text-right";
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
        ? row.map((cell, columnIndex) => (columnIndex === target.column ? value : cell))
        : row,
    );
    onChangeRows(nextRows);
  };

  const beginEdit = (target: CellTarget) => {
    if (!target || readOnly) return;
    onActiveCellChange?.(target);
    setEditingCell(target);
    setDraftValue(normalizedRows[target.row]?.[target.column] || "");
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
                {row.map((cell, columnIndex) => {
                  const isSelected =
                    selectedCell?.row === rowIndex && selectedCell?.column === columnIndex;
                  const isEditing =
                    editingCell?.row === rowIndex && editingCell?.column === columnIndex;
                  const confidence = confidenceMatrix?.[rowIndex]?.[columnIndex];
                  const raw = originalRows?.[rowIndex]?.[columnIndex] || "";
                  const title =
                    typeof confidence === "number" && confidence < 85
                      ? `Detected: ${raw || "-"} | Current: ${cell || "-"}`
                      : undefined;
                  return (
                    <td
                      key={`cell-${rowIndex}-${columnIndex}`}
                      className="border-b border-[#f0f3f7] px-3 py-3 align-top"
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
                            alignForType(normalizedTypes[columnIndex]),
                          )}
                        />
                      ) : (
                        <button
                          type="button"
                          title={title}
                          className={cn(
                            "flex h-10 w-full items-center rounded-[14px] border px-3 text-sm text-[#101828] outline-none transition duration-150",
                            alignForType(normalizedTypes[columnIndex]),
                            cellTone(confidence, showLowConfidence),
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
                          <span className="truncate">{cell || "\u00A0"}</span>
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
