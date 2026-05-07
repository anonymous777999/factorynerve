"use client";

import { useRef, useState, useMemo, useEffect } from "react";
import {
    useReactTable,
    getCoreRowModel,
    flexRender,
    type ColumnDef,
    type ColumnResizeMode,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { type OcrCell } from "@/lib/ocr";
import { MIN_COLUMN_WIDTH, MAX_COLUMN_WIDTH, DEFAULT_COLUMN_WIDTH } from "@/config/ocrColumns";

interface OcrSpreadsheetGridProps {
    rows: OcrCell[][];
    headers: string[];
    onCellEdit: (rowIndex: number, columnIndex: number, value: string) => void;
    isReadOnly: boolean;
}

type RowData = Record<string, OcrCell>;

// Helper to normalize OcrCell to get display value and confidence
function normalizeCell(cell: OcrCell): { value: string; confidence: number } {
    if (typeof cell === "string") {
        return { value: cell, confidence: 100 };
    }
    return { value: cell.value, confidence: cell.confidence };
}

// Get confidence class for styling
function getConfidenceClass(confidence: number): string {
    if (confidence < 50) return "bg-red-50 border-red-200";
    if (confidence < 70) return "bg-orange-50 border-orange-200";
    if (confidence < 90) return "bg-yellow-50 border-yellow-200";
    return "";
}

export function OcrSpreadsheetGrid({ rows, headers, onCellEdit, isReadOnly }: OcrSpreadsheetGridProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [editingCell, setEditingCell] = useState<{ rowIndex: number; columnIndex: number } | null>(null);
    const [draftValue, setDraftValue] = useState("");
    const [columnResizeMode] = useState<ColumnResizeMode>("onChange");

    // Convert rows to table data format
    const tableData = useMemo(() => {
        return rows.map((row) => {
            const rowObj: RowData = {};
            headers.forEach((header, idx) => {
                rowObj[`col_${idx}`] = row[idx] || "";
            });
            return rowObj;
        });
    }, [rows, headers]);

    // Memoized column definitions
    const columns = useMemo<ColumnDef<RowData>[]>(() => {
        return headers.map((header, columnIndex) => ({
            id: `col_${columnIndex}`,
            accessorKey: `col_${columnIndex}`,
            header: () => <div className="font-semibold text-sm truncate">{header}</div>,
            cell: (info) => {
                const rowIndex = info.row.index;
                const cell = info.getValue() as OcrCell;
                const { value, confidence } = normalizeCell(cell);
                const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.columnIndex === columnIndex;

                if (isEditing) {
                    return (
                        <input
                            autoFocus
                            value={draftValue}
                            onChange={(e) => setDraftValue(e.target.value)}
                            onBlur={() => {
                                if (draftValue !== value) {
                                    onCellEdit(rowIndex, columnIndex, draftValue);
                                }
                                setEditingCell(null);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    if (draftValue !== value) {
                                        onCellEdit(rowIndex, columnIndex, draftValue);
                                    }
                                    setEditingCell(null);
                                } else if (e.key === "Escape") {
                                    setEditingCell(null);
                                    setDraftValue("");
                                }
                            }}
                            className="w-full h-full px-2 py-1 border border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    );
                }

                return (
                    <div
                        className={`w-full h-full px-2 py-1 cursor-text truncate ${getConfidenceClass(confidence)}`}
                        onClick={() => {
                            if (!isReadOnly) {
                                setEditingCell({ rowIndex, columnIndex });
                                setDraftValue(value);
                            }
                        }}
                        title={`Confidence: ${confidence}%${value ? `\nValue: ${value}` : ""}`}
                    >
                        {value || "\u00A0"}
                    </div>
                );
            },
            size: DEFAULT_COLUMN_WIDTH,
            minSize: MIN_COLUMN_WIDTH,
            maxSize: MAX_COLUMN_WIDTH,
            enableResizing: true,
        }));
    }, [headers, editingCell, draftValue, onCellEdit, isReadOnly]);

    const table = useReactTable({
        data: tableData,
        columns,
        getCoreRowModel: getCoreRowModel(),
        columnResizeMode,
        enableColumnResizing: true,
    });

    // Row virtualizer
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
        <div className="w-full h-full flex flex-col border border-gray-200 rounded-lg overflow-hidden bg-white">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                <h3 className="text-sm font-semibold text-gray-700">OCR Spreadsheet Grid</h3>
                <p className="text-xs text-gray-500 mt-1">
                    Click any cell to edit. Press Enter to save, Escape to cancel.
                </p>
            </div>

            <div
                ref={containerRef}
                className="flex-1 overflow-auto"
                style={{ height: "600px" }}
            >
                <table className="w-full border-collapse">
                    <thead className="sticky top-0 z-10 bg-white shadow-sm">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <tr key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <th
                                        key={header.id}
                                        className="border-b border-r border-gray-300 bg-gray-100 px-2 py-2 text-left relative"
                                        style={{ width: header.getSize() }}
                                    >
                                        {flexRender(header.column.columnDef.header, header.getContext())}
                                        <div
                                            onMouseDown={header.getResizeHandler()}
                                            onTouchStart={header.getResizeHandler()}
                                            className={`absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none ${header.column.getIsResizing() ? "bg-blue-500" : "bg-gray-300 hover:bg-gray-400"
                                                }`}
                                        />
                                    </th>
                                ))}
                            </tr>
                        ))}
                    </thead>
                    <tbody>
                        {paddingTop > 0 && (
                            <tr>
                                <td style={{ height: `${paddingTop}px` }} />
                            </tr>
                        )}
                        {virtualRows.map((virtualRow) => {
                            const row = table.getRowModel().rows[virtualRow.index];
                            return (
                                <tr key={row.id} className="hover:bg-gray-50">
                                    {row.getVisibleCells().map((cell) => (
                                        <td
                                            key={cell.id}
                                            className="border-b border-r border-gray-200"
                                            style={{ width: cell.column.getSize(), height: "36px" }}
                                        >
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </td>
                                    ))}
                                </tr>
                            );
                        })}
                        {paddingBottom > 0 && (
                            <tr>
                                <td style={{ height: `${paddingBottom}px` }} />
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
