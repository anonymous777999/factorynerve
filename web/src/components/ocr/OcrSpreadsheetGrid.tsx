"use client";

import { useRef, useState, useCallback, useMemo } from "react";
import {
    useReactTable,
    getCoreRowModel,
    flexRender,
    createColumnHelper,
    type ColumnDef,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";

interface OcrSpreadsheetGridProps {
    rows: string[][];
    headers: string[];
    onCellEdit: (rowId: string, field: string, value: string) => void;
    isReadOnly: boolean;
}

type RowData = {
    id: string;
    index: number;
    cells: string[];
};

const EditableCell = ({
    value,
    rowIndex,
    columnIndex,
    onUpdate,
    isReadOnly,
}: {
    value: string;
    rowIndex: number;
    columnIndex: number;
    onUpdate: (rowIndex: number, columnIndex: number, value: string) => void;
    isReadOnly: boolean;
}) => {
    const [editValue, setEditValue] = useState(value);
    const [isEditing, setIsEditing] = useState(false);

    const handleBlur = useCallback(() => {
        setIsEditing(false);
        if (editValue !== value) {
            onUpdate(rowIndex, columnIndex, editValue);
        }
    }, [editValue, value, rowIndex, columnIndex, onUpdate]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === "Enter") {
                e.preventDefault();
                handleBlur();
            } else if (e.key === "Escape") {
                setEditValue(value);
                setIsEditing(false);
            }
        },
        [handleBlur, value]
    );

    return (
        <input
            type="text"
            value={isEditing ? editValue : value}
            onChange={(e) => setEditValue(e.target.value)}
            onFocus={() => {
                setIsEditing(true);
                setEditValue(value);
            }}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            disabled={isReadOnly}
            className="w-full border-0 bg-transparent px-3 py-2 text-sm outline-none focus:bg-[rgba(62,166,255,0.08)] disabled:cursor-not-allowed"
            style={{ minHeight: "36px" }}
        />
    );
};

export function OcrSpreadsheetGrid({
    rows,
    headers,
    onCellEdit,
    isReadOnly,
}: OcrSpreadsheetGridProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [columnSizing, setColumnSizing] = useState<Record<string, number>>({});

    const handleCellUpdate = useCallback(
        (rowIndex: number, columnIndex: number, value: string) => {
            // Map to the expected signature: onCellEdit(rowId, field, value)
            // rowId is the stringified row index, field is the column header
            const rowId = String(rowIndex);
            const field = headers[columnIndex] || `Column ${columnIndex + 1}`;
            onCellEdit(rowId, field, value);
        },
        [onCellEdit, headers]
    );

    const data = useMemo<RowData[]>(
        () =>
            rows.map((cells, index) => ({
                id: String(index),
                index,
                cells,
            })),
        [rows]
    );

    const columnHelper = createColumnHelper<RowData>();

    const columns = useMemo<ColumnDef<RowData, unknown>[]>(() => {
        const cols: ColumnDef<RowData, unknown>[] = [
            columnHelper.display({
                id: "row-number",
                header: "#",
                size: 60,
                minSize: 60,
                maxSize: 80,
                cell: (info) => (
                    <div className="px-3 py-2 text-sm font-semibold text-[var(--muted)]">
                        {info.row.original.index + 1}
                    </div>
                ),
            }),
        ];

        headers.forEach((header, columnIndex) => {
            cols.push(
                columnHelper.display({
                    id: `col-${columnIndex}`,
                    header: () => (
                        <div className="px-3 py-2 text-sm font-medium text-[var(--muted)]">
                            {header}
                        </div>
                    ),
                    size: 150,
                    minSize: 60,
                    maxSize: 400,
                    cell: (info) => (
                        <EditableCell
                            value={info.row.original.cells[columnIndex] || ""}
                            rowIndex={info.row.original.index}
                            columnIndex={columnIndex}
                            onUpdate={handleCellUpdate}
                            isReadOnly={isReadOnly}
                        />
                    ),
                })
            );
        });

        return cols;
    }, [headers, columnHelper, handleCellUpdate, isReadOnly]);

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        columnResizeMode: "onChange",
        state: {
            columnSizing,
        },
        onColumnSizingChange: setColumnSizing,
    });

    const rowVirtualizer = useVirtualizer({
        count: table.getRowModel().rows.length,
        getScrollElement: () => containerRef.current,
        estimateSize: () => 36,
        overscan: 10,
    });

    const virtualRows = rowVirtualizer.getVirtualItems();
    const totalSize = rowVirtualizer.getTotalSize();

    return (
        <div className="rounded-[1.45rem] border border-[var(--border)] bg-[rgba(8,12,20,0.82)] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            <div
                ref={containerRef}
                className="relative overflow-auto"
                style={{ height: "600px" }}
            >
                <table className="w-full border-collapse text-left text-sm">
                    <thead className="sticky top-0 z-10 bg-[rgba(15,22,35,0.98)] backdrop-blur">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <tr key={headerGroup.id} className="border-b border-[var(--border)]">
                                {headerGroup.headers.map((header) => (
                                    <th
                                        key={header.id}
                                        className="relative border-r border-[var(--border)]/40 font-medium"
                                        style={{
                                            width: header.getSize(),
                                            minWidth: header.column.columnDef.minSize,
                                            maxWidth: header.column.columnDef.maxSize,
                                        }}
                                    >
                                        {flexRender(
                                            header.column.columnDef.header,
                                            header.getContext()
                                        )}
                                        {header.column.getCanResize() && (
                                            <div
                                                onMouseDown={header.getResizeHandler()}
                                                onTouchStart={header.getResizeHandler()}
                                                className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-[var(--accent)]/30 opacity-0 hover:opacity-100"
                                            />
                                        )}
                                    </th>
                                ))}
                            </tr>
                        ))}
                    </thead>
                    <tbody
                        style={{
                            height: `${totalSize}px`,
                            position: "relative",
                        }}
                    >
                        {virtualRows.map((virtualRow) => {
                            const row = table.getRowModel().rows[virtualRow.index];
                            return (
                                <tr
                                    key={row.id}
                                    className="border-b border-[var(--border)]/60"
                                    style={{
                                        position: "absolute",
                                        top: 0,
                                        left: 0,
                                        width: "100%",
                                        height: `${virtualRow.size}px`,
                                        transform: `translateY(${virtualRow.start}px)`,
                                    }}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <td
                                            key={cell.id}
                                            className="border-r border-[var(--border)]/40 align-top"
                                            style={{
                                                width: cell.column.getSize(),
                                            }}
                                        >
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </td>
                                    ))}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
