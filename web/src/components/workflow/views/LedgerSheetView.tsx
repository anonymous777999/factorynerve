"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type OcrPreviewResult, type OcrCell } from "@/lib/ocr";
import { confidenceBadgeClass, confidenceLabel, stringifyOcrCell } from "@/lib/ocr-review";

interface LedgerRow {
  date: string;
  particulars: string;
  voucher: string;
  debit: number;
  credit: number;
  balance: number;
  confidence?: number;
  rawRowIndex: number;
}

function parseAmount(value: string): number {
  if (!value) return 0;
  const cleaned = value.replace(/[^\d.-]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function extractLedgerEntries(data: OcrPreviewResult): LedgerRow[] {
  const { headers = [], rows = [] } = data;
  const entries: LedgerRow[] = [];

  // Try to detect ledger columns
  const dateColIndex = headers.findIndex((h) =>
    /date|dt/i.test(h)
  );
  const particularsColIndex = headers.findIndex((h) =>
    /particulars|description|details|narration|part/i.test(h)
  );
  const voucherColIndex = headers.findIndex((h) =>
    /voucher|vno|ref|reference|doc|bill/i.test(h)
  );
  const debitColIndex = headers.findIndex((h) =>
    /debit|dr|withdrawal|withdraw|paid/i.test(h)
  );
  const creditColIndex = headers.findIndex((h) =>
    /credit|cr|deposit|received/i.test(h)
  );
  const balanceColIndex = headers.findIndex((h) =>
    /balance|bal|closing|closing bal/i.test(h)
  );

  // If we found the essential columns, use them
  if (dateColIndex >= 0 && particularsColIndex >= 0) {
    rows.forEach((row, rowIndex) => {
      const dateCell = row[dateColIndex];
      const particularsCell = row[particularsColIndex];
      const voucherCell = voucherColIndex >= 0 ? row[voucherColIndex] : null;
      const debitCell = debitColIndex >= 0 ? row[debitColIndex] : null;
      const creditCell = creditColIndex >= 0 ? row[creditColIndex] : null;
      const balanceCell = balanceColIndex >= 0 ? row[balanceColIndex] : null;

      if (particularsCell) {
        const date = dateCell ? stringifyOcrCell(dateCell) : "";
        const particulars = stringifyOcrCell(particularsCell);
        const voucher = voucherCell ? stringifyOcrCell(voucherCell) : "";
        const debit = debitCell ? parseAmount(stringifyOcrCell(debitCell)) : 0;
        const credit = creditCell ? parseAmount(stringifyOcrCell(creditCell)) : 0;
        const balance = balanceCell ? parseAmount(stringifyOcrCell(balanceCell)) : 0;
        
        // Get confidence from one of the cells (prefer amount columns)
        const confidenceCell = [debitCell, creditCell, balanceCell].find(c => c) || particularsCell;
        const confidence = confidenceCell && typeof confidenceCell === "object" ? confidenceCell.confidence : undefined;

        entries.push({
          date,
          particulars,
          voucher,
          debit,
          credit,
          balance,
          confidence,
          rawRowIndex: rowIndex,
        });
      }
    });
  } else if (headers.length >= 4) {
    // Fallback: assume standard ledger format with at least 4 columns
    // Date, Particulars, Voucher, Amount (with Dr/Cr indicator) or separate Dr/Cr columns
    rows.forEach((row, rowIndex) => {
      const dateCell = row[0];
      const particularsCell = row[1];
      const voucherCell = row[2] || "";
      const amountCell = row[3] || "";
      
      if (particularsCell) {
        const date = dateCell ? stringifyOcrCell(dateCell) : "";
        const particulars = stringifyOcrCell(particularsCell);
        const voucher = voucherCell ? stringifyOcrCell(voucherCell) : "";
        
        // Try to split amount into debit/credit
        let debit = 0;
        let credit = 0;
        const amountStr = stringifyOcrCell(amountCell);
        const amount = parseAmount(amountStr);
        
        // Simple heuristic: if there's a Dr/Cr indicator in the amount or separate columns
        const isCredit = amountStr.toLowerCase().includes('cr') || 
                        (headers.length > 4 && headers[4].toLowerCase().includes('credit'));
        
        if (isCredit) {
          credit = amount;
        } else {
          debit = amount;
        }
        
        // For simplicity, we'll calculate a running balance
        // In a real implementation, this would come from the data
        
        // Get confidence from amount cell
        const confidence = amountCell && typeof amountCell === "object" ? amountCell.confidence : undefined;

        entries.push({
          date,
          particulars,
          voucher,
          debit,
          credit,
          balance: 0, // Would need running total calculation
          confidence,
          rawRowIndex: rowIndex,
        });
      }
    });
  }

  // Calculate running balance
  let runningBalance = 0;
  return entries.map(entry => {
    runningBalance = runningBalance - entry.debit + entry.credit;
    return {
      ...entry,
      balance: runningBalance
    };
  });
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

interface LedgerSheetViewProps {
  data: OcrPreviewResult;
  onCellChange: (rowIndex: number, colIndex: number, value: string) => void;
  onHeaderChange?: (colIndex: number, value: string) => void;
  className?: string;
}

export function LedgerSheetView({
  data,
  onCellChange,
  onHeaderChange,
  className,
}: LedgerSheetViewProps) {
  const entries = useMemo(() => extractLedgerEntries(data), [data]);
  const [localEntries, setLocalEntries] = useState<LedgerRow[]>(entries);

  // Sync with props
  if (localEntries.length !== entries.length) {
    setLocalEntries(entries);
  }

  const headers = useMemo(() => {
    if (localEntries.length === 0) return ["Date", "Particulars", "Voucher No.", "Debit", "Credit", "Balance"];
    return ["Date", "Particulars", "Voucher No.", "Debit", "Credit", "Balance"];
  }, [localEntries]);

  return (
    <div className={cn("border-[var(--border-strong)]", className)}>
      <div className="space-y-3 p-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Ledger Sheet</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[var(--card-strong)] border-b border-[var(--border)] text-[var(--muted)] sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2 font-medium w-12">#</th>
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
                {localEntries.map((entry, rowIndex) => (
                  <tr
                    key={`row-${rowIndex}`}
                    className="border-b border-[var(--border)]/60 last:border-0 hover:bg-[var(--card-strong)]/50"
                  >
                    <td className="px-3 py-2 font-mono text-[var(--muted)] w-12">
                      {rowIndex + 1}
                    </td>
                    <td className="px-3 py-2">
                      <div className="relative">
                        <input
                          type="text"
                          value={entry.date}
                          onChange={(e) => onCellChange(rowIndex, 0, e.target.value)}
                          className={cn(
                            "w-full rounded border bg-[var(--card-strong)] px-2 py-1.5 text-sm transition-colors",
                            "focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]",
                            entry.confidence ? confidenceBadgeClass(entry.confidence) : "",
                            cellInputClass(entry.date, entry.confidence)
                          )}
                        />
                        {entry.confidence !== undefined && (
                          <span
                            className={cn(
                              "pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em]",
                              confidenceBadgeClass(entry.confidence)
                            )}
                            title={confidenceLabel(entry.confidence)}
                          >
                            {confidenceLabel(entry.confidence)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="relative">
                        <input
                          type="text"
                          value={entry.particulars}
                          onChange={(e) => onCellChange(rowIndex, 1, e.target.value)}
                          className={cn(
                            "w-full rounded border bg-[var(--card-strong)] px-2 py-1.5 text-sm transition-colors",
                            "focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]",
                            entry.confidence ? confidenceBadgeClass(entry.confidence) : "",
                            cellInputClass(entry.particulars, entry.confidence)
                          )}
                        />
                        {entry.confidence !== undefined && (
                          <span
                            className={cn(
                              "pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em]",
                              confidenceBadgeClass(entry.confidence)
                            )}
                            title={confidenceLabel(entry.confidence)}
                          >
                            {confidenceLabel(entry.confidence)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="relative">
                        <input
                          type="text"
                          value={entry.voucher}
                          onChange={(e) => onCellChange(rowIndex, 2, e.target.value)}
                          className={cn(
                            "w-full rounded border bg-[var(--card-strong)] px-2 py-1.5 text-sm transition-colors",
                            "focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]",
                            entry.confidence ? confidenceBadgeClass(entry.confidence) : "",
                            cellInputClass(entry.voucher, entry.confidence)
                          )}
                        />
                        {entry.confidence !== undefined && (
                          <span
                            className={cn(
                              "pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em]",
                              confidenceBadgeClass(entry.confidence)
                            )}
                            title={confidenceLabel(entry.confidence)}
                          >
                            {confidenceLabel(entry.confidence)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="relative">
                        <input
                          type="text"
                          value={entry.debit.toString()}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0;
                            onCellChange(rowIndex, 3, value.toString());
                          }}
                          className={cn(
                            "w-full rounded border bg-[var(--card-strong)] px-2 py-1.5 text-sm transition-colors",
                            "focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]",
                            entry.confidence ? confidenceBadgeClass(entry.confidence) : "",
                            cellInputClass(entry.debit.toString(), entry.confidence)
                          )}
                        />
                        {entry.confidence !== undefined && (
                          <span
                            className={cn(
                              "pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em]",
                              confidenceBadgeClass(entry.confidence)
                            )}
                            title={confidenceLabel(entry.confidence)}
                          >
                            {confidenceLabel(entry.confidence)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="relative">
                        <input
                          type="text"
                          value={entry.credit.toString()}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0;
                            onCellChange(rowIndex, 4, value.toString());
                          }}
                          className={cn(
                            "w-full rounded border bg-[var(--card-strong)] px-2 py-1.5 text-sm transition-colors",
                            "focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]",
                            entry.confidence ? confidenceBadgeClass(entry.confidence) : "",
                            cellInputClass(entry.credit.toString(), entry.confidence)
                          )}
                        />
                        {entry.confidence !== undefined && (
                          <span
                            className={cn(
                              "pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em]",
                              confidenceBadgeClass(entry.confidence)
                            )}
                            title={confidenceLabel(entry.confidence)}
                          >
                            {confidenceLabel(entry.confidence)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="relative">
                        <input
                          type="text"
                          value={entry.balance.toString()}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0;
                            onCellChange(rowIndex, 5, value.toString());
                          }}
                          className={cn(
                            "w-full rounded border bg-[var(--card-strong)] px-2 py-1.5 text-sm transition-colors",
                            "focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]",
                            entry.confidence ? confidenceBadgeClass(entry.confidence) : "",
                            cellInputClass(entry.balance.toString(), entry.confidence)
                          )}
                        />
                        {entry.confidence !== undefined && (
                          <span
                            className={cn(
                              "pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em]",
                              confidenceBadgeClass(entry.confidence)
                            )}
                            title={confidenceLabel(entry.confidence)}
                          >
                            {confidenceLabel(entry.confidence)}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {localEntries.length === 0 && (
            <div className="py-8 text-center text-[var(--muted)]">
              No ledger entries found.
            </div>
          )}
        </CardContent>
      </div>
    </div>
  );
}