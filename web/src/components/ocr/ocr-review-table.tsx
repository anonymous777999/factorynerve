"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/data-table/data-table";
import {
  createDataTableColumnHelper,
  type DataTableColumnDef,
} from "@/components/ui/data-table/data-table-types";

type OcrReviewRow = {
  id: string;
  cells: string[];
};

type OcrReviewTableProps = {
  headers: string[];
  rows: string[][];
  onHeaderChange: (columnIndex: number, value: string) => void;
  onCellChange: (rowIndex: number, columnIndex: number, value: string) => void;
};

const columnHelper = createDataTableColumnHelper<OcrReviewRow>();

export function OcrReviewTable({
  headers,
  rows,
  onCellChange,
  onHeaderChange,
}: OcrReviewTableProps) {
  const data = React.useMemo<OcrReviewRow[]>(
    () =>
      rows.map((cells, rowIndex) => ({
        id: `row-${rowIndex + 1}`,
        cells,
      })),
    [rows],
  );

  const columns = React.useMemo(() => {
    return headers.map((header, columnIndex) =>
      columnHelper.accessor((row) => row.cells[columnIndex] || "", {
        id: `column-${columnIndex}`,
        header: () => (
          <Input
            value={header}
            onChange={(event) => onHeaderChange(columnIndex, event.target.value)}
            className="mt-0"
            aria-label={`Column ${columnIndex + 1} header`}
          />
        ),
        cell: (info) => (
          <Input
            value={(info.getValue() as string) || ""}
            onChange={(event) => onCellChange(info.row.index, columnIndex, event.target.value)}
            className="mt-0"
            aria-label={`Row ${info.row.index + 1}, ${header || `column ${columnIndex + 1}`}`}
          />
        ),
        meta: {
          isRowHeader: columnIndex === 0,
          sticky: columnIndex === 0 ? "left" : undefined,
          wrap: true,
          cellClassName: "min-w-[12rem]",
        },
      }),
    ) as DataTableColumnDef<OcrReviewRow>[];
  }, [headers, onCellChange, onHeaderChange]);

  // Sprint 2 Task 24: Calm indigo header banner marks the table as AI-extracted
  // content. 16px padding (p-4) and 12px internal spacing (space-y-3) follow the
  // visual doctrine for AI surfaces. Operators see immediately that values came
  // from OCR and any cell they edit becomes "their" data on save.
  return (
    <div className="space-y-3">
      <div
        className="flex flex-wrap items-center gap-3 rounded-md border border-ai-processing-border bg-ai-processing-bg p-4"
        role="note"
        aria-label="AI-extracted content notice"
      >
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="h-2 w-2 rounded-full bg-ai-processing-fg"
          />
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-ai-processing-fg">
            AI extracted
          </span>
        </div>
        <span className="text-xs text-text-secondary">
          Review headers and cell values. Edits become trusted user data on save.
        </span>
      </div>
      <DataTable<OcrReviewRow>
        ariaLabel="OCR review table"
        columns={columns}
        data={data}
        enableStickyFirstColumn
        enableVirtualization={rows.length > 100}
        emptyTitle="No OCR rows available"
        emptyMessage="Create or reopen a draft to continue reviewing OCR output."
        viewportSize="lg"
      />
    </div>
  );
}
