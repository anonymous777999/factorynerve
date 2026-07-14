"use client";

import { cn } from "@/lib/utils";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type OcrPreviewResult, type OcrCell, type OcrColumnType } from "@/lib/ocr";
import { confidenceBadgeClass, confidenceLabel, stringifyOcrCell } from "@/lib/ocr-review";

interface LedgerSheetViewProps {
  data: OcrPreviewResult;
  onCellChange: (rowIndex: number, colIndex: number, value: string) => void;
  onHeaderChange?: (colIndex: number, value: string) => void;
  className?: string;
}

function cellConfidence(cell: OcrCell | undefined | null): number | undefined {
  return cell && typeof cell === "object" ? cell.confidence ?? undefined : undefined;
}

function getOcrConfidenceTier(
  confidence: number | null | undefined
): "high" | "medium" | "review_required" {
  if (typeof confidence !== "number" || Number.isNaN(confidence)) return "medium";
  if (confidence > 1) confidence = Math.max(0, Math.min(1, confidence / 100));
  if (confidence < 0.5) return "review_required";
  if (confidence < 0.85) return "medium";
  return "high";
}

function cellInputClass(value: string, confidence?: number | null): string {
  const tier = getOcrConfidenceTier(confidence ?? undefined);
  if (tier === "review_required") {
    return "border-red-400/50 bg-[rgba(239,68,68,0.15)] text-red-50";
  }
  if (tier === "medium") {
    return "border-amber-400/40 bg-[rgba(245,158,11,0.08)] text-amber-50";
  }
  if (!value.trim()) {
    return "border-amber-400/20 bg-[rgba(245,158,11,0.05)]";
  }
  return "";
}

function alignForType(type: OcrColumnType | undefined): "left" | "right" {
  return type === "amount" || type === "quantity" ? "right" : "left";
}

// A single editable OCR cell with an optional confidence badge. Amounts are
// right-aligned so columns of numbers line up the way a ledger should read.
function CellInput({
  value,
  confidence,
  align = "left",
  onChange,
}: {
  value: string;
  confidence?: number;
  align?: "left" | "right";
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "w-full rounded border bg-[var(--card-strong)] px-2 py-1.5 text-sm transition-colors",
          "focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]",
          align === "right" ? "text-right font-mono" : "",
          confidence ? confidenceBadgeClass(confidence) : "",
          cellInputClass(value, confidence)
        )}
      />
      {confidence !== undefined && (
        <span
          className={cn(
            "pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em]",
            confidenceBadgeClass(confidence)
          )}
          title={confidenceLabel(confidence)}
        >
          {confidenceLabel(confidence)}
        </span>
      )}
    </div>
  );
}

// Key-value layout: trial balances, statements, account summaries. Renders each
// row as a label/value pair instead of forcing a fixed ledger grid. Edits map
// back to the real (rowIndex, colIndex) so nothing is fabricated or misaligned.
function KeyValueLedger({
  data,
  onCellChange,
}: {
  data: OcrPreviewResult;
  onCellChange: (rowIndex: number, colIndex: number, value: string) => void;
}) {
  const headers = data.headers ?? [];
  const rows = data.rows ?? [];
  const structure = data.structure ?? null;
  const columnTypes = structure?.column_types ?? [];
  const totalRows = new Set(structure?.total_row_indices ?? []);

  const labelCol = Math.max(0, columnTypes.indexOf("label"));
  const amountCol = columnTypes.indexOf("amount");
  const valueCol = amountCol >= 0 ? amountCol : Math.max(0, headers.length - 1);

  const labelHeader = headers[labelCol] || "Field";
  const valueHeader = headers[valueCol] || "Value";

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--border)]">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] bg-[var(--card-strong)] text-[var(--muted)] text-xs font-medium uppercase tracking-wide">
        <div className="px-3 py-2 border-b border-[var(--border)]">{labelHeader}</div>
        <div className="px-3 py-2 border-b border-[var(--border)]">{valueHeader}</div>
      </div>
      <div>
        {rows.map((row, rowIndex) => {
          const isTotal = totalRows.has(rowIndex);
          const labelCell = row[labelCol];
          const valueCell = row[valueCol];
          return (
            <div
              key={`kv-${rowIndex}`}
              className={cn(
                "grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 px-3 py-1.5 border-b border-[var(--border)]/50 last:border-0",
                isTotal && "bg-[var(--accent)]/5 font-semibold"
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                {isTotal && (
                  <span className="shrink-0 rounded bg-[var(--accent)]/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--accent)]">
                    Total
                  </span>
                )}
                <CellInput
                  value={stringifyOcrCell(labelCell)}
                  confidence={cellConfidence(labelCell)}
                  onChange={(v) => onCellChange(rowIndex, labelCol, v)}
                />
              </div>
              <CellInput
                value={stringifyOcrCell(valueCell)}
                confidence={cellConfidence(valueCell)}
                align="right"
                onChange={(v) => onCellChange(rowIndex, valueCol, v)}
              />
            </div>
          );
        })}
      </div>
      {rows.length === 0 && (
        <div className="py-8 text-center text-[var(--muted)]">No entries found.</div>
      )}
    </div>
  );
}

// Table layout: real ledgers / day books with genuine columns. Renders the
// actual OCR headers and rows faithfully. Total/subtotal rows are emphasised
// using the server-computed structure; amounts are right-aligned. No running
// balance is invented — every value shown is a real OCR value.
function TableLedger({
  data,
  onCellChange,
  onHeaderChange,
}: {
  data: OcrPreviewResult;
  onCellChange: (rowIndex: number, colIndex: number, value: string) => void;
  onHeaderChange?: (colIndex: number, value: string) => void;
}) {
  const headers = data.headers ?? [];
  const rows = data.rows ?? [];
  const structure = data.structure ?? null;
  const columnTypes = structure?.column_types ?? [];
  const totalRows = new Set(structure?.total_row_indices ?? []);
  const columnCount = Math.max(headers.length, ...rows.map((r) => r.length), 0);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-[var(--card-strong)] border-b border-[var(--border)] text-[var(--muted)] sticky top-0 z-10">
          <tr>
            <th className="px-3 py-2 font-medium w-12">#</th>
            {Array.from({ length: columnCount }).map((_, colIndex) => (
              <th key={colIndex} className="px-3 py-2 font-medium">
                <input
                  type="text"
                  value={headers[colIndex] ?? ""}
                  onChange={(e) => onHeaderChange?.(colIndex, e.target.value)}
                  className={cn(
                    "w-full bg-transparent border-none px-1 py-0.5 text-sm font-medium focus:outline-none focus:bg-[var(--accent)]/10 rounded",
                    alignForType(columnTypes[colIndex]) === "right" && "text-right"
                  )}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => {
            const isTotal = totalRows.has(rowIndex);
            return (
              <tr
                key={`row-${rowIndex}`}
                className={cn(
                  "border-b border-[var(--border)]/60 last:border-0 hover:bg-[var(--card-strong)]/50",
                  isTotal && "bg-[var(--accent)]/5 font-semibold"
                )}
              >
                <td className="px-3 py-2 font-mono text-[var(--muted)] w-12">
                  <span className="flex items-center gap-1">
                    {rowIndex + 1}
                    {isTotal && (
                      <span className="rounded bg-[var(--accent)]/15 px-1 py-0.5 text-[8px] font-semibold uppercase tracking-[0.08em] text-[var(--accent)]">
                        T
                      </span>
                    )}
                  </span>
                </td>
                {Array.from({ length: columnCount }).map((_, colIndex) => {
                  const cell = row[colIndex];
                  return (
                    <td key={colIndex} className="px-3 py-2">
                      <CellInput
                        value={stringifyOcrCell(cell)}
                        confidence={cellConfidence(cell)}
                        align={alignForType(columnTypes[colIndex])}
                        onChange={(v) => onCellChange(rowIndex, colIndex, v)}
                      />
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length === 0 && (
        <div className="py-8 text-center text-[var(--muted)]">No ledger entries found.</div>
      )}
    </div>
  );
}

export function LedgerSheetView({
  data,
  onCellChange,
  onHeaderChange,
  className,
}: LedgerSheetViewProps) {
  const headers = data.headers ?? [];
  // Prefer the server-computed layout; fall back to a simple width heuristic
  // (a two-column sheet is almost always a key/value statement).
  const layout =
    data.structure?.layout ?? (headers.length === 2 ? "key_value" : "table");

  return (
    <div className={cn("border-[var(--border-strong)]", className)}>
      <div className="space-y-3 p-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Ledger Sheet</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {layout === "key_value" ? (
            <KeyValueLedger data={data} onCellChange={onCellChange} />
          ) : (
            <TableLedger
              data={data}
              onCellChange={onCellChange}
              onHeaderChange={onHeaderChange}
            />
          )}
        </CardContent>
      </div>
    </div>
  );
}
