"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type OcrPreviewResult } from "@/lib/ocr";
import { confidenceBadgeClass, confidenceLabel, shouldFlagConfidence } from "@/lib/ocr-review";

interface GenericTableReviewViewProps {
  data: OcrPreviewResult;
  onCellChange: (rowIndex: number, colIndex: number, value: string) => void;
  onHeaderChange?: (colIndex: number, value: string) => void;
  showRowNumbers?: boolean;
  className?: string;
}

function cellInputClass(value: string, confidence?: number | null): string {
  const tier = getOcrConfidenceTier(confidence ?? undefined);
  if (tier === "review_required") return "border-red-400/50 bg-[rgba(239,68,68,0.15)] text-red-50";
  if (tier === "medium") return "border-amber-400/40 bg-[rgba(245,158,11,0.08)] text-amber-50";
  if (!value.trim()) return "border-amber-400/20 bg-[rgba(245,158,11,0.05)]";
  return "";
}

function getOcrConfidenceTier(confidence: number | null | undefined): "high" | "medium" | "review_required" {
  if (typeof confidence !== "number" || Number.isNaN(confidence)) return "medium";
  if (confidence > 1) confidence = Math.max(0, Math.min(1, confidence / 100));
  if (confidence < 0.5) return "review_required";
  if (confidence < 0.85) return "medium";
  return "high";
}

const TOTAL_ROW_PATTERN = /(grand\s+)?(sub[- ]?)?total|balance\s*(b\/?f|c\/?f|forward|carried|brought)?|amount\s+due|net\s+(payable|amount)/i;

function isTotalRow(row: string[]): boolean {
  const firstFilled = row.find((value) => value && value.trim());
  if (!firstFilled) return false;
  return TOTAL_ROW_PATTERN.test(firstFilled.trim());
}

export function GenericTableReviewView({
  data,
  onCellChange,
  onHeaderChange,
  showRowNumbers = true,
  className,
}: GenericTableReviewViewProps) {
  const { headers = [], rows = [] } = data;
  // Prefer the server-computed total rows when present; fall back to the local
  // regex heuristic only when structure is unavailable (older results).
  const structureTotals = data.structure?.total_row_indices;
  const totalRowSet = useMemo(
    () => (structureTotals ? new Set(structureTotals) : null),
    [structureTotals],
  );
  const rowIsTotal = (row: string[], rowIndex: number): boolean =>
    totalRowSet ? totalRowSet.has(rowIndex) : isTotalRow(row);
  const [localHeaders, setLocalHeaders] = useState<string[]>(headers);
  const [localRows, setLocalRows] = useState<string[][]>(
    rows.map(row => row.map(cell => typeof cell === "object" ? (cell.value || "") : String(cell)))
  );

  if (localHeaders.length !== headers.length) {
    setLocalHeaders(headers);
  }
  if (localRows.length !== rows.length) {
    setLocalRows(rows.map(row =>
      row.map(cell => typeof cell === "object" ? (cell.value || "") : String(cell))
    ));
  }

  return (
    <Card className={cn("border-[var(--border-strong)]", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          {data.title && data.title !== "OCR Result" ? data.title : "Table view"}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {localHeaders.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[var(--card-strong)] border-b border-[var(--border)] text-[var(--muted)] sticky top-0 z-10">
                  <tr>
                    {showRowNumbers && (
                      <th className="px-3 py-2 font-medium w-10">#</th>
                    )}
                    {localHeaders.map((header, colIndex) => (
                      <th key={colIndex} className="px-3 py-2 font-medium">
                        <input
                          type="text"
                          value={header}
                          onChange={(e) => {
                            const next = [...localHeaders];
                            next[colIndex] = e.target.value;
                            setLocalHeaders(next);
                            onHeaderChange?.(colIndex, e.target.value);
                          }}
                          className="w-full bg-transparent border-none px-1 py-0.5 text-sm font-medium focus:outline-none focus:bg-[var(--accent)]/10 rounded"
                        />
                      </th>
                    ))}
                    <th className="px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {localRows.map((row, rowIndex) => (
                    <tr
                      key={`row-${rowIndex}`}
                      className={cn(
                        "border-b border-[var(--border)]/60 last:border-0 hover:bg-[var(--card-strong)]/50",
                        rowIsTotal(row, rowIndex) && "border-t-2 border-t-[var(--accent)]/30 bg-[var(--card-strong)]/40 font-semibold",
                      )}
                    >
                      {showRowNumbers && (
                        <td className="px-3 py-2 font-mono text-[var(--muted)] w-10">
                          {rowIndex + 1}
                        </td>
                      )}
                      {localHeaders.map((_header, colIndex) => {
                        const value = row[colIndex] || "";
                        let confidence: number | undefined;
                        const rawCell = rows[rowIndex]?.[colIndex];
                        if (rawCell && typeof rawCell === "object" && "confidence" in rawCell) {
                          confidence = (rawCell as { confidence?: number | null }).confidence ?? undefined;
                        }
                        // Tinting and badging every cell — including the
                        // ones the OCR got right — buried the handful of
                        // cells that actually need a second look under a
                        // wall of identical green "Verified" pills. Only
                        // surface the indicator once a cell's tier is
                        // below "high".
                        const needsAttention = shouldFlagConfidence(confidence);

                        return (
                          <td key={colIndex} className="px-3 py-2">
                            <div className="relative">
                              <input
                                type="text"
                                value={value}
                                onChange={(e) => {
                                  const next = [...localRows];
                                  const rowCopy = [...next[rowIndex]];
                                  rowCopy[colIndex] = e.target.value;
                                  next[rowIndex] = rowCopy;
                                  setLocalRows(next);
                                  onCellChange(rowIndex, colIndex, e.target.value);
                                }}
                                className={cn(
                                  "w-full rounded border bg-[var(--card-strong)] px-2 py-1.5 text-sm transition-colors",
                                  "focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]",
                                  needsAttention ? confidenceBadgeClass(confidence) : "",
                                  cellInputClass(value, needsAttention ? confidence : undefined)
                                )}
                              />
                              {needsAttention && (
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
                          </td>
                        );
                      })}
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              const next = [...localRows];
                              next.splice(rowIndex, 1);
                              setLocalRows(next);
                              onCellChange(rowIndex, -1, "");
                            }}
                            className="p-1 rounded hover:bg-red-500/10 text-red-400"
                            title="Remove row"
                          >
                            <span className="h-3 w-3">×</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 pt-4 border-t border-[var(--border)]">
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => {
                    const next = [...localRows];
                    next.push(Array(localHeaders.length).fill(""));
                    setLocalRows(next);
                    onCellChange(localRows.length, 0, "");
                  }}
                  className="px-3 py-2 text-sm text-[var(--accent)] hover:underline"
                  disabled={localHeaders.length === 0}
                >
                  Add Row
                </button>

                {localHeaders.length > 0 && (
                  <button
                    onClick={() => {
                      const next = [...localHeaders];
                      next.push(`Column ${next.length + 1}`);
                      setLocalHeaders(next);
                      const newRows = localRows.map(row => [...row, ""]);
                      setLocalRows(newRows);
                      onHeaderChange?.(localHeaders.length - 1, `Column ${localHeaders.length}`);
                    }}
                    className="px-3 py-2 text-sm text-[var(--accent)] hover:underline"
                  >
                    Add Column
                  </button>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="py-8 text-center text-[var(--muted)]">
            No data to display. Add columns and rows to get started.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
