"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { type OcrPreviewResult, type OcrCell } from "@/lib/ocr";
import { confidenceBadgeClass, confidenceLabel, stringifyOcrCell } from "@/lib/ocr-review";

interface PaginatedTableLayoutProps {
  data: OcrPreviewResult;
  onCellChange: (rowIndex: number, colIndex: number, value: string) => void;
  onHeaderChange?: (colIndex: number, value: string) => void;
  rowsPerPage?: number;
  className?: string;
}

const DEFAULT_ROWS_PER_PAGE = 50;

export function PaginatedTableLayout({
  data,
  onCellChange,
  onHeaderChange,
  rowsPerPage = DEFAULT_ROWS_PER_PAGE,
  className,
}: PaginatedTableLayoutProps) {
  const { headers = [], rows = [] } = data;
  const [currentPage, setCurrentPage] = useState(0);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(rows.length / rowsPerPage)),
    [rows.length, rowsPerPage]
  );

  const currentPageRows = useMemo(() => {
    const start = currentPage * rowsPerPage;
    return rows.slice(start, start + rowsPerPage);
  }, [rows, currentPage, rowsPerPage]);

  const pageStats = useMemo(() => {
    const start = currentPage * rowsPerPage + 1;
    const end = Math.min((currentPage + 1) * rowsPerPage, rows.length);
    return { start, end, total: rows.length };
  }, [currentPage, rowsPerPage, rows.length]);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(0, Math.min(page, totalPages - 1)));
  };

  const handleFirstPage = () => goToPage(0);
  const handlePrevPage = () => goToPage(currentPage - 1);
  const handleNextPage = () => goToPage(currentPage + 1);
  const handleLastPage = () => goToPage(totalPages - 1);

  return (
    <Card className={cn("border-[var(--border-strong)]", className)}>
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-sm font-medium">Paginated Table View</CardTitle>
          <div className="flex items-center gap-4 text-sm text-[var(--muted)]">
            <span>
              Showing {pageStats.start}–{pageStats.end} of {pageStats.total} rows
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleFirstPage}
                disabled={currentPage === 0}
                className="p-1 rounded hover:bg-[var(--card-strong)] disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="First page"
              >
                <ChevronsLeft className="h-4 w-4" />
              </button>
              <button
                onClick={handlePrevPage}
                disabled={currentPage === 0}
                className="p-1 rounded hover:bg-[var(--card-strong)] disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="font-mono px-2">
                {currentPage + 1} / {totalPages}
              </span>
              <button
                onClick={handleNextPage}
                disabled={currentPage === totalPages - 1}
                className="p-1 rounded hover:bg-[var(--card-strong)] disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                onClick={handleLastPage}
                disabled={currentPage === totalPages - 1}
                className="p-1 rounded hover:bg-[var(--card-strong)] disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Last page"
              >
                <ChevronsRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[var(--card-strong)] border-b border-[var(--border)] text-[var(--muted)] sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2 font-medium w-10 sticky left-0 bg-[var(--card-strong)]">#</th>
                {headers.map((header, colIndex) => (
                  <th key={colIndex} className="px-3 py-2 font-medium sticky top-0 bg-[var(--card-strong)]">
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
              {currentPageRows.map((row, localIndex) => {
                const rowIndex = currentPage * rowsPerPage + localIndex;
                return (
                  <tr
                    key={`row-${rowIndex}`}
                    className="border-b border-[var(--border)]/60 last:border-0 hover:bg-[var(--card-strong)]/50"
                  >
                    <td className="px-3 py-2 font-mono text-[var(--muted)] w-10 sticky left-0 bg-white/5">
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
        {rows.length === 0 && (
          <div className="p-8 text-center text-[var(--muted)]">
            No data rows to display
          </div>
        )}
      </CardContent>
    </Card>
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