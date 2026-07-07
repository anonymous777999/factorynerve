"use client";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type OcrPreviewResult, type OcrCell } from "@/lib/ocr";
import { confidenceBadgeClass, confidenceLabel, stringifyOcrCell } from "@/lib/ocr-review";

interface CardFormLayoutProps {
  data: OcrPreviewResult;
  onCellChange: (rowIndex: number, colIndex: number, value: string) => void;
  className?: string;
}

export function CardFormLayout({ data, onCellChange, className }: CardFormLayoutProps) {
  const { headers = [], rows = [] } = data;

  return (
    <div className={cn("grid gap-4", className)}>
      {rows.map((row, rowIndex) => (
        <Card key={`row-${rowIndex}`} className="border-[var(--border-strong)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {headers[0] ? stringifyOcrCell(row[0]) || `Row ${rowIndex + 1}` : `Row ${rowIndex + 1}`}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {headers.map((header, colIndex) => {
              const cell = row[colIndex];
              const value = stringifyOcrCell(cell);
              const confidence = cell && typeof cell === "object" ? cell.confidence : undefined;

              return (
                <div
                  key={colIndex}
                  className="grid grid-cols-[auto_1fr] gap-3 items-center"
                >
                  <label
                    htmlFor={`card-${rowIndex}-${colIndex}`}
                    className="text-sm font-medium text-[var(--muted)]"
                  >
                    {header}
                  </label>
                  <div className="relative">
                    <input
                      id={`card-${rowIndex}-${colIndex}`}
                      type="text"
                      value={value}
                      onChange={(e) => onCellChange(rowIndex, colIndex, e.target.value)}
                      className={cn(
                        "w-full rounded-lg border bg-[var(--card-strong)] px-3 py-2 text-sm transition-colors",
                        "focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]",
                        confidence ? confidenceBadgeClass(confidence) : "",
                        cellInputClass(value, confidence)
                      )}
                    />
                    {confidence !== undefined && (
                      <span
                        className={cn(
                          "pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]",
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
          </CardContent>
        </Card>
      ))}
      {rows.length === 0 && (
        <Card className="border-dashed border-[var(--border-strong)]">
          <CardContent className="py-12 text-center text-[var(--muted)]">
            No data rows to display
          </CardContent>
        </Card>
      )}
    </div>
  );
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