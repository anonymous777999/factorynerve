"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown } from "lucide-react";
import { type OcrPreviewResult, type OcrCell } from "@/lib/ocr";
import { confidenceBadgeClass, confidenceLabel, stringifyOcrCell } from "@/lib/ocr-review";

interface SectionedTableLayoutProps {
  data: OcrPreviewResult;
  onCellChange: (rowIndex: number, colIndex: number, value: string) => void;
  onHeaderChange?: (colIndex: number, value: string) => void;
  className?: string;
}

type Section = {
  title: string;
  startRow: number;
  endRow: number;
  summary?: string;
};

function getSections(data: OcrPreviewResult): Section[] {
  const { headers = [], rows = [] } = data;
  const sections: Section[] = [];

  if (rows.length === 0) return sections;

  // Detect common document sections based on headers/content
  const hasHeader = headers.some((h) =>
    /invoice|bill|date|number|party|customer|vendor|gstin|pan/i.test(h)
  );
  const hasItems = headers.some((h) =>
    /item|product|description|qty|quantity|rate|amount|price|hsn|sac/i.test(h)
  );
  const hasTax = headers.some((h) =>
    /tax|gst|cgst|sgst|igst|cess|total|amount/i.test(h)
  );
  const hasTotals = headers.some((h) =>
    /total|grand|net|payable|round/i.test(h)
  );

  let currentStart = 0;

  // Header section (first few rows with header-like data)
  if (hasHeader && rows.length > 0) {
    const headerRows = Math.min(3, rows.length);
    sections.push({
      title: "Header",
      startRow: 0,
      endRow: headerRows - 1,
      summary: `${headerRows} row${headerRows > 1 ? "s" : ""}`,
    });
    currentStart = headerRows;
  }

  // Items section
  if (hasItems && currentStart < rows.length) {
    const itemRows = rows.length - currentStart;
    sections.push({
      title: "Items",
      startRow: currentStart,
      endRow: rows.length - 1,
      summary: `${itemRows} row${itemRows > 1 ? "s" : ""}`,
    });
    currentStart = rows.length;
  }

  // Tax/Totals section
  if (hasTax && currentStart < rows.length) {
    const taxRows = rows.length - currentStart;
    sections.push({
      title: "Tax & Totals",
      startRow: currentStart,
      endRow: rows.length - 1,
      summary: `${taxRows} row${taxRows > 1 ? "s" : ""}`,
    });
  }

  // Fallback: single section for all rows
  if (sections.length === 0 && rows.length > 0) {
    sections.push({
      title: "Data",
      startRow: 0,
      endRow: rows.length - 1,
      summary: `${rows.length} row${rows.length > 1 ? "s" : ""}`,
    });
  }

  return sections;
}

export function SectionedTableLayout({
  data,
  onCellChange,
  onHeaderChange,
  className,
}: SectionedTableLayoutProps) {
  const { headers = [], rows = [] } = data;
  const sections = getSections(data);
  const [expandedSections, setExpandedSections] = useState<string[]>(
    sections.map((s) => s.title)
  );

  const toggleSection = (title: string) => {
    setExpandedSections((prev) =>
      prev.includes(title)
        ? prev.filter((t) => t !== title)
        : [...prev, title]
    );
  };

  return (
    <div className={cn("space-y-4", className)}>
      {sections.map((section) => {
        const isExpanded = expandedSections.includes(section.title);
        const sectionRows = rows.slice(section.startRow, section.endRow + 1);

        return (
          <Card key={section.title} className="border-[var(--border-strong)]">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-[var(--muted)] transition-transform",
                      !isExpanded && "-rotate-90"
                    )}
                  />
                  {section.title}
                  <span className="text-xs text-[var(--muted)]">
                    ({section.summary})
                  </span>
                </CardTitle>
                <button
                  onClick={() => toggleSection(section.title)}
                  className="text-xs text-[var(--accent)] hover:underline"
                >
                  {isExpanded ? "Collapse" : "Expand"}
                </button>
              </div>
            </CardHeader>
            {isExpanded && (
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-[var(--card-strong)] border-b border-[var(--border)] text-[var(--muted)]">
                      <tr>
                        <th className="px-3 py-2 font-medium w-10">#</th>
                        {headers.map((header, colIndex) => (
                          <th key={colIndex} className="px-3 py-2 font-medium">
                            <input
                              type="text"
                              value={header}
                              onChange={(e) => onHeaderChange?.(colIndex, e.target.value)}
                              className="w-full bg-transparent border-none px-1 py-0.5 text-sm font-medium focus:outline-none focus:bg-[var(--accent)]/10 rounded"
                            />
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sectionRows.map((row, localIndex) => {
                        const rowIndex = section.startRow + localIndex;
                        return (
                          <tr
                            key={`row-${rowIndex}`}
                            className="border-b border-[var(--border)]/60 last:border-0 hover:bg-[var(--card-strong)]/50"
                          >
                            <td className="px-3 py-2 font-mono text-[var(--muted)] w-10">
                              {rowIndex + 1}
                            </td>
                            {headers.map((header, colIndex) => {
                              const cell = row[colIndex];
                              const value = stringifyOcrCell(cell);
                              const confidence = cell && typeof cell === "object" ? cell.confidence : undefined;

                              return (
                                <td key={colIndex} className="px-3 py-2">
                                  <div className="relative">
                                    <input
                                      type="text"
                                      value={value}
                                      onChange={(e) => onCellChange(rowIndex, colIndex, e.target.value)}
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
              </CardContent>
            )}
          </Card>
        );
      })}

      {sections.length === 0 && rows.length === 0 && (
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