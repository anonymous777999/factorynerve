"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type OcrPreviewResult, type OcrCell, type OcrColumnType } from "@/lib/ocr";
import { confidenceBadgeClass, confidenceLabel, shouldFlagConfidence, stringifyOcrCell } from "@/lib/ocr-review";
import { formatByColumnType, alignForColumnType, parseAmountValue, formatIndianCurrency } from "@/lib/ocr-format";

interface InvoiceReviewViewProps {
  data: OcrPreviewResult;
  onCellChange: (rowIndex: number, colIndex: number, value: string) => void;
  onHeaderChange?: (colIndex: number, value: string) => void;
  className?: string;
}

type Section = {
  headers: string[];
  rows: (string | OcrCell)[][];
  colIndices: number[];
};

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
      itemIndices.push(index);
    }
  });

  const build = (indices: number[]): Section => ({
    headers: indices.map((i) => headers[i]),
    rows: rows.map((row) => indices.map((i) => row[i])),
    colIndices: indices,
  });

  return {
    header: build(headerIndices),
    items: build(itemIndices),
    tax: build(taxIndices),
    totals: build(totalIndices),
  };
}

// Column semantic type from the server structure analysis, by original index.
function colType(data: OcrPreviewResult, originalIndex: number): OcrColumnType | undefined {
  return data.structure?.column_types?.[originalIndex];
}

function getOcrConfidenceTier(confidence: number | null | undefined): "high" | "medium" | "review_required" {
  if (typeof confidence !== "number" || Number.isNaN(confidence)) return "medium";
  if (confidence > 1) confidence = Math.max(0, Math.min(1, confidence / 100));
  if (confidence < 0.5) return "review_required";
  if (confidence < 0.85) return "medium";
  return "high";
}

function cellInputClass(value: string, confidence?: number | null): string {
  const tier = getOcrConfidenceTier(confidence ?? undefined);
  if (tier === "review_required") return "border-red-400/50 bg-[rgba(239,68,68,0.15)] text-red-50";
  if (tier === "medium") return "border-amber-400/40 bg-[rgba(245,158,11,0.08)] text-amber-50";
  if (!value.trim()) return "border-amber-400/20 bg-[rgba(245,158,11,0.05)]";
  return "";
}

// ── EDIT MODE: the raw editable grid (unchanged behaviour) ───────────────────
function EditableSection({
  section,
  data,
  onCellChange,
  onHeaderChange,
  showRowNumbers,
}: {
  section: Section;
  data: OcrPreviewResult;
  onCellChange: (rowIndex: number, colIndex: number, value: string) => void;
  onHeaderChange?: (colIndex: number, value: string) => void;
  showRowNumbers: boolean;
}) {
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
                    onChange={(e) => onHeaderChange?.(section.colIndices[localIndex], e.target.value)}
                    className="w-full bg-transparent border-none px-1 py-0.5 text-sm font-medium focus:outline-none focus:bg-[var(--accent)]/10 rounded"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {section.rows.map((row, localRowIndex) => (
              <tr key={`row-${localRowIndex}`} className="border-b border-[var(--border)]/60 last:border-0 hover:bg-[var(--card-strong)]/50">
                {showRowNumbers && (
                  <td className="px-3 py-2 font-mono text-[var(--muted)] w-10">{localRowIndex + 1}</td>
                )}
                {section.headers.map((_header, localColIndex) => {
                  const cell = row[localColIndex];
                  const value = stringifyOcrCell(cell);
                  const confidence = cell && typeof cell === "object" ? cell.confidence : undefined;
                  const flag = shouldFlagConfidence(confidence);
                  const globalColIndex = section.colIndices[localColIndex];
                  return (
                    <td key={localColIndex} className="px-3 py-2">
                      <div className="relative">
                        <input
                          type="text"
                          value={value}
                          onChange={(e) => onCellChange(localRowIndex, globalColIndex, e.target.value)}
                          className={cn(
                            "w-full rounded border bg-[var(--card-strong)] px-2 py-1.5 text-sm transition-colors",
                            "focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]",
                            flag ? confidenceBadgeClass(confidence) : "",
                            cellInputClass(value, flag ? confidence : undefined)
                          )}
                        />
                        {flag && (
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
      {section.rows.length === 0 && (
        <div className="text-center py-4 text-[var(--muted)]">No data in this section</div>
      )}
    </div>
  );
}

// A confidence dot shown only when a value needs a second look — quiet by default.
function AttentionDot({ confidence }: { confidence?: number | null }) {
  if (!shouldFlagConfidence(confidence)) return null;
  return (
    <span
      className={cn("ml-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle", confidenceBadgeClass(confidence))}
      title={confidenceLabel(confidence)}
    />
  );
}

// ── READ MODE: document header block (invoice no / party / date / GSTIN …) ───
// Renders the single-row header section as labelled fields, the way the top of
// a real invoice reads — not as a one-row spreadsheet.
function HeaderBlock({ section, data }: { section: Section; data: OcrPreviewResult }) {
  if (section.headers.length === 0) return null;
  const row = section.rows[0] ?? [];
  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3">
      {section.headers.map((header, i) => {
        const cell = row[i];
        const raw = stringifyOcrCell(cell);
        const type = colType(data, section.colIndices[i]);
        const confidence = cell && typeof cell === "object" ? cell.confidence : undefined;
        if (!raw.trim()) return null;
        return (
          <div key={i} className="min-w-0">
            <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--muted)]">
              {header}
            </div>
            <div className="mt-0.5 truncate text-sm font-semibold text-[var(--text)]">
              {formatByColumnType(raw, type)}
              <AttentionDot confidence={confidence} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── READ MODE: a formatted, read-only table for line items / tax ─────────────
function ReadTable({ section, data }: { section: Section; data: OcrPreviewResult }) {
  if (section.headers.length === 0 || section.rows.length === 0) return null;
  const totalRows = new Set(data.structure?.total_row_indices ?? []);
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-[var(--card-strong)] text-[var(--muted)]">
          <tr>
            <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] w-10">#</th>
            {section.headers.map((header, i) => (
              <th
                key={i}
                className={cn(
                  "px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em]",
                  alignForColumnType(colType(data, section.colIndices[i])) === "right" && "text-right"
                )}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {section.rows.map((row, r) => {
            const isTotal = totalRows.has(r);
            return (
              <tr
                key={r}
                className={cn(
                  "border-t border-[var(--border)]/60",
                  isTotal ? "bg-[var(--accent)]/5 font-semibold" : "hover:bg-[var(--card-strong)]/40"
                )}
              >
                <td className="px-3 py-2 font-mono text-xs text-[var(--muted)]">{r + 1}</td>
                {section.headers.map((_h, i) => {
                  const cell = row[i];
                  const raw = stringifyOcrCell(cell);
                  const type = colType(data, section.colIndices[i]);
                  const confidence = cell && typeof cell === "object" ? cell.confidence : undefined;
                  return (
                    <td
                      key={i}
                      className={cn(
                        "px-3 py-2 text-[var(--text)]",
                        alignForColumnType(type) === "right" && "text-right font-mono tabular-nums"
                      )}
                    >
                      {formatByColumnType(raw, type)}
                      <AttentionDot confidence={confidence} />
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── READ MODE: prominent totals panel ────────────────────────────────────────
// Surfaces the grand total (largest amount in the totals section) big and the
// rest as a small breakdown — the number a factory owner actually looks for.
function TotalsPanel({ section, data }: { section: Section; data: OcrPreviewResult }) {
  const pairs: { label: string; raw: string; type: OcrColumnType | undefined; amount: number | null }[] = [];
  const lastRow = section.rows[section.rows.length - 1] ?? [];
  section.headers.forEach((header, i) => {
    const raw = stringifyOcrCell(lastRow[i]);
    if (!raw.trim()) return;
    const type = colType(data, section.colIndices[i]);
    pairs.push({ label: header, raw, type, amount: parseAmountValue(raw) });
  });
  if (pairs.length === 0) return null;

  // Grand total = the pair whose header says grand/net/payable, else max amount.
  const grandIdx = pairs.findIndex((p) => /grand|net|payable|total/i.test(p.label));
  const grand = grandIdx >= 0 ? pairs[grandIdx] : null;
  const rest = pairs.filter((_p, i) => i !== grandIdx);

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card-strong)]/40 p-4">
      {rest.length > 0 && (
        <div className="space-y-1.5">
          {rest.map((p, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-[var(--muted)]">{p.label}</span>
              <span className="font-mono tabular-nums text-[var(--text)]">
                {formatByColumnType(p.raw, p.type)}
              </span>
            </div>
          ))}
        </div>
      )}
      {grand && (
        <div className={cn("flex items-center justify-between", rest.length > 0 && "mt-3 border-t border-[var(--border)] pt-3")}>
          <span className="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
            {grand.label}
          </span>
          <span className="font-mono text-xl font-bold tabular-nums text-[var(--text)]">
            {grand.amount !== null ? formatIndianCurrency(grand.amount) : grand.raw}
          </span>
        </div>
      )}
    </div>
  );
}

export function InvoiceReviewView({
  data,
  onCellChange,
  onHeaderChange,
  className,
}: InvoiceReviewViewProps) {
  const sections = useMemo(() => getInvoiceSections(data), [data]);
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [activeTab, setActiveTab] = useState("items");

  const editTabs = [
    { id: "header", label: "Header", section: sections.header },
    { id: "items", label: "Line Items", section: sections.items },
    { id: "tax", label: "Tax Breakdown", section: sections.tax },
    { id: "totals", label: "Totals", section: sections.totals },
  ].filter((t) => t.section.rows.length > 0 || t.id === "header");

  return (
    <Card className={cn("border-[var(--border-strong)]", className)}>
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
        <CardTitle className="text-sm font-medium">Invoice</CardTitle>
        <div className="inline-flex rounded-full border border-[var(--border)] bg-[var(--card-strong)] p-0.5 text-xs">
          <button
            onClick={() => setMode("view")}
            className={cn(
              "rounded-full px-3 py-1 font-medium transition-colors",
              mode === "view" ? "bg-[var(--accent)]/15 text-[var(--accent)]" : "text-[var(--muted)] hover:text-[var(--text)]"
            )}
          >
            View
          </button>
          <button
            onClick={() => setMode("edit")}
            className={cn(
              "rounded-full px-3 py-1 font-medium transition-colors",
              mode === "edit" ? "bg-[var(--accent)]/15 text-[var(--accent)]" : "text-[var(--muted)] hover:text-[var(--text)]"
            )}
          >
            Edit
          </button>
        </div>
      </CardHeader>

      <CardContent className={cn(mode === "view" ? "space-y-5 p-5" : "p-0")}>
        {mode === "view" ? (
          <>
            <HeaderBlock section={sections.header} data={data} />
            {sections.items.rows.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Line Items</div>
                <ReadTable section={sections.items} data={data} />
              </div>
            )}
            {sections.tax.rows.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Tax Breakdown</div>
                <ReadTable section={sections.tax} data={data} />
              </div>
            )}
            {sections.totals.rows.length > 0 && (
              <div className="sm:ml-auto sm:max-w-sm">
                <TotalsPanel section={sections.totals} data={data} />
              </div>
            )}
          </>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="border-b border-[var(--border)] p-1 bg-[var(--card-strong)]">
              {editTabs.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id} className="data-[state=active]:bg-[var(--accent)]/10">
                  {tab.label}
                  <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-[var(--border)] text-[var(--muted)]">
                    {tab.section.rows.length}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value={activeTab} className="p-4">
              {editTabs.map((tab) =>
                tab.id === activeTab ? (
                  <EditableSection
                    key={tab.id}
                    section={tab.section}
                    data={data}
                    onCellChange={onCellChange}
                    onHeaderChange={onHeaderChange}
                    showRowNumbers={tab.id === "header" || tab.id === "items"}
                  />
                ) : null
              )}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
