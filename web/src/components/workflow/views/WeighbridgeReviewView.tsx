"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type OcrPreviewResult, type OcrCell } from "@/lib/ocr";
import { confidenceBadgeClass, confidenceLabel, shouldFlagConfidence, stringifyOcrCell } from "@/lib/ocr-review";

interface WeighbridgeReviewViewProps {
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

export function WeighbridgeReviewView({
  data,
  onCellChange,
  onHeaderChange,
  className,
}: WeighbridgeReviewViewProps) {
  const { headers = [], rows = [] } = data;

  return (
    <Card className={cn("border-[var(--border-strong)] max-w-2xl", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Weighbridge Slip</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        {rows.length > 0 && rows[0].map((cell, colIndex) => {
          const header = headers[colIndex] || `Field ${colIndex + 1}`;
          const value = stringifyOcrCell(cell);
          const confidence = cell && typeof cell === "object" ? cell.confidence : undefined;
          const flagConfidence = shouldFlagConfidence(confidence);

          return (
            <div key={colIndex} className="grid grid-cols-[auto_1fr] gap-4 items-center">
              <label className="text-sm font-medium text-[var(--muted)] min-w-[140px]">
                {header}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={value}
                  onChange={(e) => onCellChange(0, colIndex, e.target.value)}
                  className={cn(
                    "w-full rounded-lg border bg-[var(--card-strong)] px-3 py-2.5 text-base transition-colors",
                    "focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]",
                    flagConfidence ? confidenceBadgeClass(confidence) : "",
                    cellInputClass(value, flagConfidence ? confidence : undefined)
                  )}
                />
                {flagConfidence && (
                  <span
                    className={cn(
                      "pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]",
                      confidenceBadgeClass(confidence)
                    )}
                    title={confidenceLabel(confidence)}
                  >
                    {confidenceLabel(confidence)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
        {rows.length === 0 && (
          <div className="text-center py-8 text-[var(--muted)]">No weighbridge data</div>
        )}
      </CardContent>
    </Card>
  );
}