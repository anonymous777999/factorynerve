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

// Get confidence class for styling - using subtle left border indicators
function getConfidenceClass(confidence: number): string {
    if (confidence < 50) return "border-l-4 border-l-red-400";
    if (confidence < 70) return "border-l-4 border-l-amber-400";
    if (confidence < 90) return "border-l-4 border-l-yellow-400";
    return "";
}

// Detect if a value is numeric for right-alignment
function isNumericValue(value: string): boolean {
    if (!value || typeof value !== "string") return false;
    const trimmed = value.trim();
    // Match numbers, currency symbols, percentages
    return /^[₹$€£¥]?\s*-?\d[\d,]*(?:\.\d+)?%?$/.test(trimmed);
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
            header: () => <div className="font-semibold text-sm truncate text-white">{header}</div>,
            cell: (info) => {
                const rowIndex = info.row.index;
                const cell = info.getValue() as OcrCell;
                const { value, confidence } = normalizeCell(cell);
                const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.columnIndex === columnIndex;
                const isNumeric = isNumericValue(value);

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
                                } else if (e.key === "Tab") {
                                    // Allow default tab behavior for now
                                }
                            }}
                            className="w-full h-full px-3 py-2 border-2 border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-[#1a1a1a]"
                            style={{ fontFamily: 'Inter, "Noto Sans Devanagari", sans-serif' }}
                        />
                    );
                }

                return (
                    <div
                        className={`w-full h-full px-3 py-2 cursor-text truncate text-[#1a1a1a] ${getConfidenceClass(confidence)} ${isNumeric ? 'text-right font-variant-numeric-tabular' : ''}`}
                        onClick={() => {
                            if (!isReadOnly) {
                                setEditingCell({ rowIndex, columnIndex });
                                setDraftValue(value);
                            }
                        }}
                        title={`Confidence: ${confidence}%${value ? `\nValue: ${value}` : ""}`}
                        style={{
                            fontFamily: 'Inter, "Noto Sans Devanagari", sans-serif',
                            fontSize: '14px',
                            lineHeight: '1.5',
                            fontVariantNumeric: isNumeric ? 'tabular-nums' : 'normal'
                        }}
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
                                            fontSize: '14px'
                                        }}
                                    >
                                        {flexRender(header.column.columnDef.header, header.getContext())}
                                        <div
                                            onMouseDown={header.getResizeHandler()}
                                            onTouchStart={header.getResizeHandler()}
                                            className={`absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none ${header.column.getIsResizing() ? "bg-blue-400" : "bg-[#d0d0d0] hover:bg-blue-300"
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
                            const isEvenRow = virtualRow.index % 2 === 0;
                            return (
                                <tr
                                    key={row.id}
                                    className={`hover:bg-[#e8f0fe] transition-colors ${isEvenRow ? 'bg-white' : 'bg-[#f8f9fa]'}`}
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
