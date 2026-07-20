"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsiveScrollArea } from "@/components/ui/responsive-scroll-area";

type OcrResultsGridProps = {
  headers: string[];
  rows: string[][];
  onChangeHeaders: (headers: string[]) => void;
  onChangeRows: (rows: string[][]) => void;
  readOnly?: boolean;
};

function normalizeRowLength(row: string[], columns: number) {
  const next = [...row];
  while (next.length < columns) next.push("");
  return next.slice(0, columns);
}

export function OcrResultsGrid({
  headers,
  rows,
  onChangeHeaders,
  onChangeRows,
  readOnly = false,
}: OcrResultsGridProps) {
  const columnCount = Math.max(headers.length, ...rows.map((row) => row.length), 1);
  const normalizedHeaders = Array.from({ length: columnCount }, (_, index) => headers[index] || `Column ${index + 1}`);
  const normalizedRows =
    rows.length > 0
      ? rows.map((row) => normalizeRowLength(row, columnCount))
      : [Array.from({ length: columnCount }, () => "")];

  const updateHeader = (columnIndex: number, value: string) => {
    const next = [...normalizedHeaders];
    next[columnIndex] = value;
    onChangeHeaders(next);
  };

  const updateCell = (rowIndex: number, columnIndex: number, value: string) => {
    const nextRows = normalizedRows.map((row, index) =>
      index === rowIndex ? row.map((cell, cellIndex) => (cellIndex === columnIndex ? value : cell)) : row,
    );
    onChangeRows(nextRows);
  };

  const addRow = () => {
    onChangeRows([...normalizedRows, Array.from({ length: columnCount }, () => "")]);
  };

  const removeRow = (rowIndex: number) => {
    onChangeRows(normalizedRows.filter((_, index) => index !== rowIndex));
  };

  const addColumn = () => {
    onChangeHeaders([...normalizedHeaders, `Column ${columnCount + 1}`]);
    onChangeRows(normalizedRows.map((row) => [...row, ""]));
  };

  const removeColumn = (columnIndex: number) => {
    if (columnCount <= 1) return;
    onChangeHeaders(normalizedHeaders.filter((_, index) => index !== columnIndex));
    onChangeRows(
      normalizedRows.map((row) => row.filter((_, index) => index !== columnIndex)),
    );
  };

  return (
    <div className="space-y-4 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
      <div className="flex flex-wrap gap-2">
        {!readOnly ? (
          <>
            <Button type="button" variant="outline" onClick={addRow}>
              Add Row
            </Button>
            <Button type="button" variant="outline" onClick={addColumn}>
              Add Column
            </Button>
          </>
        ) : null}
      </div>
      <ResponsiveScrollArea debugLabel="ocr-structured-grid">
        <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr>
              {normalizedHeaders.map((header, columnIndex) => (
                <th key={`header-${columnIndex}`} className="border-b border-white/10 bg-[rgba(15,23,42,0.88)] px-3 py-2 align-top">
                  <div className="flex items-center gap-2">
                    <Input
                      value={header}
                      readOnly={readOnly}
                      onChange={(event) => updateHeader(columnIndex, event.target.value)}
                      className="h-10 min-w-[10rem] border-white/10 bg-black/20 text-sm text-white"
                    />
                    {!readOnly ? (
                      <button
                        type="button"
                        className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-slate-300 transition hover:bg-white/10"
                        onClick={() => removeColumn(columnIndex)}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                </th>
              ))}
              {!readOnly ? <th className="border-b border-white/10 bg-[rgba(15,23,42,0.88)] px-3 py-2" /> : null}
            </tr>
          </thead>
          <tbody>
            {normalizedRows.map((row, rowIndex) => (
              <tr key={`row-${rowIndex}`} className="align-top">
                {row.map((cell, columnIndex) => (
                  <td key={`cell-${rowIndex}-${columnIndex}`} className="border-b border-white/6 px-3 py-2">
                    <Input
                      value={cell}
                      readOnly={readOnly}
                      onChange={(event) => updateCell(rowIndex, columnIndex, event.target.value)}
                      className="h-10 min-w-[10rem] border-white/10 bg-black/20 text-sm text-white"
                    />
                  </td>
                ))}
                {!readOnly ? (
                  <td className="border-b border-white/6 px-3 py-2">
                    <button
                      type="button"
                      className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-slate-300 transition hover:bg-white/10"
                      onClick={() => removeRow(rowIndex)}
                    >
                      Remove
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </ResponsiveScrollArea>
    </div>
  );
}
