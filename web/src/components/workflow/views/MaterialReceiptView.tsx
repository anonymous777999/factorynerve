"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type OcrPreviewResult, type OcrCell } from "@/lib/ocr";
import { confidenceBadgeClass, confidenceLabel, stringifyOcrCell } from "@/lib/ocr-review";

interface MaterialReceiptViewProps {
  data: OcrPreviewResult;
  onCellChange: (rowIndex: number, colIndex: number, value: string) => void;
  onHeaderChange?: (colIndex: number, value: string) => void;
  className?: string;
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

function getOcrConfidenceTier(confidence: number | null | undefined): "high" | "medium" | "review_required" {
  if (typeof confidence !== "number" || Number.isNaN(confidence)) return "medium";
  if (confidence > 1) confidence = Math.max(0, Math.min(1, confidence / 100));
  if (confidence < 0.5) return "review_required";
  if (confidence < 0.85) return "medium";
  return "high";
}

export function MaterialReceiptView({
  data,
  onCellChange,
  onHeaderChange,
  className,
}: MaterialReceiptViewProps) {
  const { headers = [], rows = [] } = data;

  return (
    <Card className={cn("border-[var(--border-strong)]", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Material Receipt</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Form fields for key metadata */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-[var(--muted)] mb-1 block">
              Receipt Number
            </label>
            <input
              type="text"
              value={stringifyOcrCell(rows[0]?.[0]) || ""}
              onChange={(e) => onCellChange(0, 0, e.target.value)}
              className="w-full rounded border bg-[var(--card-strong)] px-3 py-2 text-sm transition-colors"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-[var(--muted)] mb-1 block">
              Date
            </label>
            <input
              type="text"
              value={stringifyOcrCell(rows[0]?.[1]) || ""}
              onChange={(e) => onCellChange(0, 1, e.target.value)}
              className="w-full rounded border bg-[var(--card-strong)] px-3 py-2 text-sm transition-colors"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-[var(--muted)] mb-1 block">
              Supplier
            </label>
            <input
              type="text"
              value={stringifyOcrCell(rows[0]?.[2]) || ""}
              onChange={(e) => onCellChange(0, 2, e.target.value)}
              className="w-full rounded border bg-[var(--card-strong)] px-3 py-2 text-sm transition-colors"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-[var(--muted)] mb-1 block">
              PO Number
            </label>
            <input
              type="text"
              value={stringifyOcrCell(rows[0]?.[3]) || ""}
              onChange={(e) => onCellChange(0, 3, e.target.value)}
              className="w-full rounded border bg-[var(--card-strong)] px-3 py-2 text-sm transition-colors"
            />
          </div>
        </div>

        {/* Materials table */}
        <div className="mt-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Materials Received</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[var(--card-strong)] border-b border-[var(--border)] text-[var(--muted)]">
                  <tr>
                    <th className="px-3 py-2 font-medium w-10">#</th>
                    {headers.slice(4).map((header, localIndex) => (
                      <th key={localIndex} className="px-3 py-2 font-medium">
                        <input
                          type="text"
                          value={header}
                          onChange={(e) => onHeaderChange?.(4 + localIndex, e.target.value)}
                          className="w-full bg-transparent border-none px-1 py-0.5 text-sm font-medium focus:outline-none focus:bg-[var(--accent)]/10 rounded"
                        />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(1).map((row, rowIndex) => (
                    <tr key={`row-${rowIndex + 1}`} className="border-b border-[var(--border)]/60 last:border-0 hover:bg-[var(--card-strong)]/50">
                      <td className="px-3 py-2 font-mono text-[var(--muted)] w-10">
                        {rowIndex + 1}
                      </td>
                      {row.slice(4).map((cell, localColIndex) => {
                        const value = stringifyOcrCell(cell);
                        const confidence = cell && typeof cell === "object" ? cell.confidence : undefined;
                        const globalColIndex = 4 + localColIndex;

                        return (
                          <td key={localColIndex} className="px-3 py-2">
                            <div className="relative">
                              <input
                                type="text"
                                value={value}
                                onChange={(e) => onCellChange(rowIndex + 1, globalColIndex, e.target.value)}
                                className={cn(
                                  "w-full rounded border bg-[var(--card-strong)] px-2 py-1.5 text-sm transition-colors",
                                  "focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]",
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
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </div>
      </CardContent>
    </Card>
  );
}