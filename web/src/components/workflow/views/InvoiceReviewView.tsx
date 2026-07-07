"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type OcrPreviewResult, type OcrCell } from "@/lib/ocr";
import { confidenceBadgeClass, confidenceLabel, stringifyOcrCell } from "@/lib/ocr-review";

interface InvoiceReviewViewProps {
  data: OcrPreviewResult;
  onCellChange: (rowIndex: number, colIndex: number, value: string) => void;
  onHeaderChange?: (colIndex: number, value: string) => void;
  className?: string;
}

function getInvoiceSections(data: OcrPreviewResult) {
  const { headers = [], rows = [] } = data;
  
  const headerIndices: number[] = [];
  const itemIndices: number[] = [];
  const taxIndices: number[] = [];
  const totalIndices: number[] = [];

  headers.forEach((header, index) => {
    const h = header.toLowerCase();
    if (/invoice|date|number|party|customer|vendor|gstin|pan|place|supply|vehicle|challan|eway|bill/i.test(h)) {
      headerIndices.push(index);
    } else if (/item|product|description|qty|quantity|rate|amount|price|hsn|sac|unit|uom/i.test(h)) {
      itemIndices.push(index);
    } else if (/tax|gst|cgst|sgst|igst|cess/i.test(h)) {
      taxIndices.push(index);
    } else if (/total|grand|net|payable|round|discount|balance/i.test(h)) {
      totalIndices.push(index);
    } else {
      // Default to items for unclassified columns
      itemIndices.push(index);
    }
  });

  return {
    header: {
      headers: headerIndices.map(i => headers[i]),
      rows: rows.map(row => headerIndices.map(i => row[i])),
    },
    items: {
      headers: itemIndices.map(i => headers[i]),
      rows: rows.map(row => itemIndices.map(i => row[i])),
    },
    tax: {
      headers: taxIndices.map(i => headers[i]),
      rows: rows.map(row => taxIndices.map(i => row[i])),
    },
    totals: {
      headers: totalIndices.map(i => headers[i]),
      rows: rows.map(row => totalIndices.map(i => row[i])),
    },
  };
}

function renderSectionTable(
  section: { headers: string[]; rows: (string | OcrCell)[][] },
  baseRowOffset: number,
  onCellChange: (rowIndex: number, colIndex: number, value: string) => void,
  onHeaderChange: ((colIndex: number, value: string) => void) | undefined,
  globalColIndices: number[],
  showRowNumbers: boolean
) {
  if (section.headers.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[var(--card-strong)] border-b border-[var(--border)] text-[var(--muted)]">
            <tr>
              {showRowNumbers && <th className="px-3 py-2 font-medium w-10">#</th>}
              {section.headers.map((header, localIndex) => (
                <th key={localIndex} className="px-3 py-2 font-medium">
                  <input
                    type="text"
                    value={header}
                    onChange={(e) => onHeaderChange?.(globalColIndices[localIndex], e.target.value)}
                    className="w-full bg-transparent border-none px-1 py-0.5 text-sm font-medium focus:outline-none focus:bg-[var(--accent)]/10 rounded"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {section.rows.map((row, localRowIndex) => {
              const globalRowIndex = baseRowOffset + localRowIndex;
              return (
                <tr key={`row-${globalRowIndex}`} className="border-b border-[var(--border)]/60 last:border-0 hover:bg-[var(--card-strong)]/50">
                  {showRowNumbers && (
                    <td className="px-3 py-2 font-mono text-[var(--muted)] w-10">
                      {globalRowIndex + 1}
                    </td>
                  )}
                  {section.headers.map((header, localColIndex) => {
                    const cell = row[localColIndex];
                    const value = stringifyOcrCell(cell);
                    const confidence = cell && typeof cell === "object" ? cell.confidence : undefined;
                    const globalColIndex = globalColIndices[localColIndex];

                    return (
                      <td key={localColIndex} className="px-3 py-2">
                        <div className="relative">
                          <input
                            type="text"
                            value={value}
                            onChange={(e) => onCellChange(globalRowIndex, globalColIndex, e.target.value)}
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
              );
            })}
          </tbody>
        </table>
      </div>
      {section.rows.length === 0 && (
        <div className="text-center py-4 text-[var(--muted)]">No data in this section</div>
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

export function InvoiceReviewView({
  data,
  onCellChange,
  onHeaderChange,
  className,
}: InvoiceReviewViewProps) {
  const sections = useMemo(() => getInvoiceSections(data), [data]);
  const [activeTab, setActiveTab] = useState("header");

  const tabs = [
    { id: "header", label: "Header", count: sections.header.rows.length },
    { id: "items", label: "Line Items", count: sections.items.rows.length },
    { id: "tax", label: "Tax Breakdown", count: sections.tax.rows.length },
    { id: "totals", label: "Totals", count: sections.totals.rows.length },
  ].filter(t => t.count > 0 || t.id === "header");

  const renderTabContent = (tabId: string) => {
    switch (tabId) {
      case "header":
        return renderSectionTable(
          sections.header,
          0,
          onCellChange,
          onHeaderChange,
          sections.header.headers.map((_, i) => i), // simplified
          true
        );
      case "items":
        return renderSectionTable(
          sections.items,
          0,
          onCellChange,
          onHeaderChange,
          sections.items.headers.map((_, i) => i),
          true
        );
      case "tax":
        return renderSectionTable(
          sections.tax,
          0,
          onCellChange,
          onHeaderChange,
          sections.tax.headers.map((_, i) => i),
          false
        );
      case "totals":
        return renderSectionTable(
          sections.totals,
          0,
          onCellChange,
          onHeaderChange,
          sections.totals.headers.map((_, i) => i),
          false
        );
      default:
        return null;
    }
  };

  return (
    <Card className={cn("border-[var(--border-strong)]", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Invoice Review</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="border-b border-[var(--border)] p-1 bg-[var(--card-strong)]">
            {tabs.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id} className="data-[state=active]:bg-[var(--accent)]/10">
                {tab.label}
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-[var(--border)] text-[var(--muted)]">
                  {tab.count}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value={activeTab} className="p-4">
            {renderTabContent(activeTab)}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}