"use client";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type OcrPreviewResult } from "@/lib/ocr";
import { confidenceBadgeClass, confidenceLabel, stringifyOcrCell } from "@/lib/ocr-review";

interface KeyValueFormLayoutProps {
  data: OcrPreviewResult;
  onCellChange: (rowIndex: number, colIndex: number, value: string) => void;
  className?: string;
}

export function KeyValueFormLayout({ data, onCellChange, className }: KeyValueFormLayoutProps) {
  const { headers = [], rows = [] } = data;

  // Detect if data is key-value pairs (2 columns: Field, Value)
  const isKeyValue = headers.length === 2 && 
    (headers[0]?.toLowerCase().includes("field") || headers[0]?.toLowerCase().includes("label"));

  if (isKeyValue) {
    return (
      <Card className={cn("border-[var(--border-strong)]", className)}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Key-Value Fields</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {rows.map((row, rowIndex) => {
              const key = stringifyOcrCell(row[0]);
              const val = stringifyOcrCell(row[1]);
              const confidence = row[1] && typeof row[1] === "object" ? row[1].confidence : undefined;
              return (
                <div
                  key={`kv-${rowIndex}`}
                  className="grid grid-cols-[1fr_2fr] gap-4 items-center p-3 rounded-lg bg-[var(--card-strong)]/40 hover:bg-[var(--card-strong)]/60 transition-colors"
                >
                  <label className="text-sm font-medium text-[var(--muted)] truncate" title={key}>
                    {key}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={val}
                      onChange={(e) => onCellChange(rowIndex, 1, e.target.value)}
                      className={cn(
                        "w-full rounded-lg border bg-[var(--card-strong)] px-3 py-2 text-sm transition-colors",
                        "focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]",
                        confidence ? confidenceBadgeClass(confidence) : "",
                        val.trim() ? "" : "border-amber-400/20 bg-[rgba(245,158,11,0.05)]"
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
          </div>
          {rows.length === 0 && (
            <div className="py-8 text-center text-[var(--muted)]">
              No fields extracted
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Generic grid layout for non-key-value data
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {rows.map((row, rowIndex) => (
        <Card key={`card-${rowIndex}`} className="border-[var(--border-strong)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-[var(--muted)]">
              {stringifyOcrCell(row[0]) || `Entry ${rowIndex + 1}`}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {headers.slice(1).map((header, colIndex) => {
              const cell = row[colIndex + 1];
              const value = stringifyOcrCell(cell);
              const confidence = cell && typeof cell === "object" ? cell.confidence : undefined;
              return (
                <div key={`kv-${rowIndex}-${colIndex}`} className="space-y-1">
                  <label className="text-xs text-[var(--muted)]">{header}</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => onCellChange(rowIndex, colIndex + 1, e.target.value)}
                      className={cn(
                        "w-full rounded border bg-[var(--card-strong)] px-2 py-1.5 text-sm transition-colors",
                        "focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]",
                        confidence ? confidenceBadgeClass(confidence) : ""
                      )}
                    />
                    {confidence !== undefined && (
                      <span className={cn(
                        "absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em]",
                        confidenceBadgeClass(confidence)
                      )}>
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
        <Card className="col-span-full border-dashed border-[var(--border-strong)]">
          <CardContent className="py-12 text-center text-[var(--muted)]">
            No data extracted from this document
          </CardContent>
        </Card>
      )}
    </div>
  );
}
