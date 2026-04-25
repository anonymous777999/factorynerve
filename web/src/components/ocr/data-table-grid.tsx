"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type DataTableGridProps = {
  headers: string[];
  rows: string[][];
  confidenceMatrix?: number[][];
  readOnly?: boolean;
  onChangeHeaders: (headers: string[]) => void;
  onChangeRows: (rows: string[][]) => void;
};

function normalizeLength(row: string[], columns: number) {
  return Array.from({ length: columns }, (_, index) => row[index] || "");
}

function toneForConfidence(confidence?: number) {
  if (typeof confidence !== "number") return "";
  if (confidence < 60) return "border-amber-300 bg-amber-50";
  if (confidence < 80) return "border-[#d7dde4] bg-[#fff8e8]";
  return "";
}

export function DataTableGrid({
  headers,
  rows,
  confidenceMatrix,
  readOnly = false,
  onChangeHeaders,
  onChangeRows,
}: DataTableGridProps) {
  const columnCount = Math.max(headers.length, ...rows.map((row) => row.length), 1);
  const normalizedHeaders = Array.from({ length: columnCount }, (_, index) => headers[index] || `Column ${index + 1}`);
  const normalizedRows =
    rows.length > 0
      ? rows.map((row) => normalizeLength(row, columnCount))
      : [Array.from({ length: columnCount }, () => "")];

  const updateHeader = (columnIndex: number, value: string) => {
    const next = [...normalizedHeaders];
    next[columnIndex] = value;
    onChangeHeaders(next);
  };

  const updateCell = (rowIndex: number, columnIndex: number, value: string) => {
    const next = normalizedRows.map((row, currentRowIndex) =>
      currentRowIndex === rowIndex
        ? row.map((cell, currentColumnIndex) =>
            currentColumnIndex === columnIndex ? value : cell,
          )
        : row,
    );
    onChangeRows(next);
  };

  const addRow = () => {
    onChangeRows([...normalizedRows, Array.from({ length: columnCount }, () => "")]);
  };

  const removeRow = (rowIndex: number) => {
    onChangeRows(normalizedRows.filter((_, currentRowIndex) => currentRowIndex !== rowIndex));
  };

  return (
    <div className="overflow-hidden rounded-[28px] border border-[#e7eaee] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eff2f5] px-4 py-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a93a0]">
            Extracted sheet
          </div>
          <div className="mt-1 text-sm text-[#66707c]">Edit in place before export.</div>
        </div>
        {!readOnly ? (
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-[18px] border-[#d4d9df] bg-[#f8fafc] text-[#111827] hover:bg-white"
            onClick={addRow}
          >
            Add row
          </Button>
        ) : null}
      </div>

      <div className="overflow-auto">
        <table className="min-w-full border-separate border-spacing-0">
          <thead className="sticky top-0 z-10">
            <tr>
              {normalizedHeaders.map((header, columnIndex) => (
                <th key={`head-${columnIndex}`} className="min-w-[10rem] border-b border-[#eff2f5] bg-white px-3 py-3 text-left align-top">
                  <Input
                    value={header}
                    readOnly={readOnly}
                    onChange={(event) => updateHeader(columnIndex, event.target.value)}
                    className="mt-0 h-10 rounded-[14px] border-[#e5e7eb] bg-[#fbfbfa] text-sm font-medium text-[#111827] focus:border-[#111827] focus:bg-white focus:ring-[#111827]/10"
                  />
                </th>
              ))}
              {!readOnly ? <th className="w-16 border-b border-[#eff2f5] bg-white px-3 py-3" /> : null}
            </tr>
          </thead>
          <tbody>
            {normalizedRows.map((row, rowIndex) => (
              <tr key={`row-${rowIndex}`}>
                {row.map((cell, columnIndex) => (
                  <td key={`cell-${rowIndex}-${columnIndex}`} className="border-b border-[#f1f4f7] px-3 py-3 align-top">
                    <Input
                      value={cell}
                      readOnly={readOnly}
                      onChange={(event) => updateCell(rowIndex, columnIndex, event.target.value)}
                      className={cn(
                        "mt-0 h-10 rounded-[14px] border-[#eef1f4] bg-[#fbfbfa] text-[#111827] transition duration-200 focus:border-[#111827] focus:bg-white focus:ring-[#111827]/10",
                        toneForConfidence(confidenceMatrix?.[rowIndex]?.[columnIndex]),
                      )}
                    />
                  </td>
                ))}
                {!readOnly ? (
                  <td className="border-b border-[#f1f4f7] px-3 py-3 align-top">
                    <button
                      type="button"
                      className="rounded-full border border-[#e5e7eb] px-3 py-2 text-xs font-medium text-[#66707c] transition duration-200 hover:border-[#111827] hover:text-[#111827]"
                      onClick={() => removeRow(rowIndex)}
                    >
                      Delete
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

