"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type OcrPreviewResult, type OcrCell } from "@/lib/ocr";
import { confidenceBadgeClass, confidenceLabel, stringifyOcrCell } from "@/lib/ocr-review";

interface SplitPanelLayoutProps {
  data: OcrPreviewResult;
  onCellChange: (rowIndex: number, colIndex: number, value: string) => void;
  onHeaderChange?: (colIndex: number, value: string) => void;
  leftPanelFields?: string[];
  className?: string;
}

const DEFAULT_LEFT_FIELDS = [
  "invoice_number",
  "invoice_date",
  "supplier_name",
  "supplier_gstin",
  "buyer_name",
  "buyer_gstin",
  "place_of_supply",
  "vehicle_number",
  "challan_number",
  "challan_date",
  "ewaybill_number",
  "total_amount",
  "taxable_amount",
  "cgst_amount",
  "sgst_amount",
  "igst_amount",
  "total_tax",
  "round_off",
];

export function SplitPanelLayout({
  data,
  onCellChange,
  onHeaderChange,
  leftPanelFields = DEFAULT_LEFT_FIELDS,
  className,
}: SplitPanelLayoutProps) {
  const { headers = [], rows = [] } = data;
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);

  const { leftHeaders, rightHeaders, leftRows, rightRows } = useMemo(() => {
    const leftIndices: number[] = [];
    const rightIndices: number[] = [];

    headers.forEach((header, index) => {
      const normalizedHeader = header.toLowerCase().replace(/\s+/g, "_");
      const isLeftField = leftPanelFields.some(
        (field) =>
          normalizedHeader.includes(field.toLowerCase()) ||
          field.toLowerCase().includes(normalizedHeader)
      );
      if (isLeftField) {
        leftIndices.push(index);
      } else {
        rightIndices.push(index);
      }
    });

    // If no fields matched, default: first 8 columns to left, rest to right
    if (leftIndices.length === 0 && headers.length > 0) {
      const splitPoint = Math.min(8, Math.ceil(headers.length / 2));
      for (let i = 0; i < headers.length; i++) {
        if (i < splitPoint) leftIndices.push(i);
        else rightIndices.push(i);
      }
    }

    return {
      leftHeaders: leftIndices.map((i) => headers[i]),
      rightHeaders: rightIndices.map((i) => headers[i]),
      leftRows: rows.map((row) => leftIndices.map((i) => row[i])),
      rightRows: rows.map((row) => rightIndices.map((i) => row[i])),
    };
  }, [headers, rows, leftPanelFields]);

  const renderCell = (
    value: string,
    confidence: number | undefined,
    rowIndex: number,
    colIndex: number,
    isLeft: boolean
  ) => (
    <td className="px-3 py-2">
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            const actualColIndex = isLeft ? leftHeadersIndices[colIndex] : rightHeadersIndices[colIndex];
            if (actualColIndex !== undefined) {
              onCellChange(rowIndex, actualColIndex, e.target.value);
            }
          }}
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

  // We need to map back to original column indices
  const leftHeadersIndices = useMemo(() => {
    const indices: number[] = [];
    headers.forEach((header, index) => {
      const normalizedHeader = header.toLowerCase().replace(/\s+/g, "_");
      const isLeftField = leftPanelFields.some(
        (field) =>
          normalizedHeader.includes(field.toLowerCase()) ||
          field.toLowerCase().includes(normalizedHeader)
      );
      if (isLeftField) indices.push(index);
    });
    if (indices.length === 0 && headers.length > 0) {
      const splitPoint = Math.min(8, Math.ceil(headers.length / 2));
      for (let i = 0; i < splitPoint; i++) indices.push(i);
    }
    return indices;
  }, [headers, leftPanelFields]);

  const rightHeadersIndices = useMemo(() => {
    const indices: number[] = [];
    headers.forEach((header, index) => {
      const normalizedHeader = header.toLowerCase().replace(/\s+/g, "_");
      const isLeftField = leftPanelFields.some(
        (field) =>
          normalizedHeader.includes(field.toLowerCase()) ||
          field.toLowerCase().includes(normalizedHeader)
      );
      if (!isLeftField) indices.push(index);
    });
    if (indices.length === 0 && headers.length > 0) {
      const splitPoint = Math.min(8, Math.ceil(headers.length / 2));
      for (let i = splitPoint; i < headers.length; i++) indices.push(i);
    }
    return indices;
  }, [headers, leftPanelFields]);

  return (
    <div className={cn("flex flex-col h-full gap-4", className)}>
      <div className="flex items-center justify-between">
        <CardTitle className="text-sm font-medium">Split Panel View</CardTitle>
        <button
          onClick={() => setLeftPanelOpen(!leftPanelOpen)}
          className="text-sm text-[var(--accent)] hover:underline"
        >
          {leftPanelOpen ? "Hide Header Fields" : "Show Header Fields"}
        </button>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* Left Panel - Header Fields */}
        {leftPanelOpen && leftHeaders.length > 0 && (
          <Card className="flex-1 flex flex-col min-w-0 border-[var(--border-strong)]" style={{ maxWidth: "40%" }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Header Fields</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-0">
              <div className="space-y-3 p-4">
                {leftRows.map((row, rowIndex) => (
                  <div key={`left-row-${rowIndex}`} className="space-y-3">
                    {leftHeaders.map((header, colIndex) => {
                      const cell = row[colIndex];
                      const value = stringifyOcrCell(cell);
                      const confidence = cell && typeof cell === "object" ? cell.confidence : undefined;

                      return (
                        <div
                          key={`left-${rowIndex}-${colIndex}`}
                          className="grid grid-cols-[auto_1fr] gap-3 items-start"
                        >
                          <label
                            className="text-xs font-medium text-[var(--muted)] pt-1.5 min-w-[120px]"
                            htmlFor={`left-${rowIndex}-${colIndex}`}
                          >
                            {header}
                          </label>
                          <div className="relative">
                            <input
                              id={`left-${rowIndex}-${colIndex}`}
                              type="text"
                              value={value}
                              onChange={(e) => {
                                const actualColIndex = leftHeadersIndices[colIndex];
                                if (actualColIndex !== undefined) {
                                  onCellChange(rowIndex, actualColIndex, e.target.value);
                                }
                              }}
                              className={cn(
                                "w-full rounded border bg-[var(--card-strong)] px-3 py-2 text-sm transition-colors",
                                "focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]",
                                confidence ? confidenceBadgeClass(confidence) : "",
                                cellInputClass(value, confidence)
                              )}
                            />
                            {confidence !== undefined && (
                              <span
                                className={cn(
                                  "pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em]",
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
                ))}
              </div>
              {leftRows.length === 0 && (
                <div className="p-8 text-center text-[var(--muted)]">No header data</div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Right Panel - Items Table */}
        <Card className="flex-1 flex flex-col min-w-0 border-[var(--border-strong)]" style={{ minWidth: "60%" }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Line Items</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto p-0">
            {rightHeaders.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[var(--card-strong)] border-b border-[var(--border)] text-[var(--muted)] sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2 font-medium w-10 sticky left-0 bg-[var(--card-strong)]">#</th>
                      {rightHeaders.map((header, colIndex) => (
                        <th key={colIndex} className="px-3 py-2 font-medium sticky top-0 bg-[var(--card-strong)]">
                          <input
                            type="text"
                            value={header}
                            onChange={(e) => onHeaderChange?.(rightHeadersIndices[colIndex], e.target.value)}
                            className="w-full bg-transparent border-none px-1 py-0.5 text-sm font-medium focus:outline-none focus:bg-[var(--accent)]/10 rounded"
                          />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rightRows.map((row, rowIndex) => (
                      <tr
                        key={`right-row-${rowIndex}`}
                        className="border-b border-[var(--border)]/60 last:border-0 hover:bg-[var(--card-strong)]/50"
                      >
                        <td className="px-3 py-2 font-mono text-[var(--muted)] w-10 sticky left-0 bg-white/5">
                          {rowIndex + 1}
                        </td>
                        {rightHeaders.map((header, colIndex) => {
                          const cell = row[colIndex];
                          const value = stringifyOcrCell(cell);
                          const confidence = cell && typeof cell === "object" ? cell.confidence : undefined;

                          return (
                            <td key={colIndex} className="px-3 py-2">
                              <div className="relative">
                                <input
                                  type="text"
                                  value={value}
                                  onChange={(e) => {
                                    const actualColIndex = rightHeadersIndices[colIndex];
                                    if (actualColIndex !== undefined) {
                                      onCellChange(rowIndex, actualColIndex, e.target.value);
                                    }
                                  }}
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
            ) : (
              <div className="p-8 text-center text-[var(--muted)]">No line item columns detected</div>
            )}
          </CardContent>
        </Card>
      </div>
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