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

  return (
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
  );
}
