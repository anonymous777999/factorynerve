"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ResponsiveScrollArea } from "@/components/ui/responsive-scroll-area";
import { listSteelBatches, listSteelItems, type SteelBatch, type SteelItem } from "@/lib/steel";
import { useSession } from "@/lib/use-session";
import { DashboardPageSkeleton } from "@/components/shared/page-skeletons";

const BATCH_LIST_LIMIT = 100;

type BatchListRow = {
  batch: SteelBatch;
  batchId: string;
  itemCode: string;
  itemLabel: string;
  skuCode: string;
};

function formatKg(value: number | null | undefined) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value || 0);
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function normalizeDateParam(value: string | null) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function statusBadgeClass(status: string) {
  if (status === "recorded" || status === "completed") {
    return "border-emerald-400/35 bg-emerald-400/12 text-emerald-200";
  }
  if (status === "watch" || status === "pending") {
    return "border-amber-400/35 bg-amber-400/12 text-amber-200";
  }
  return "border-slate-400/35 bg-slate-500/12 text-slate-200";
}

function highlightMatches(row: BatchListRow, normalizedHighlight: string) {
  if (!normalizedHighlight) return false;
  const batchId = row.batchId.toLowerCase();
  if (batchId === normalizedHighlight) return true;
  const skuCode = row.skuCode.toLowerCase();
  if (skuCode && skuCode === normalizedHighlight) return true;
  const itemCode = row.itemCode.toLowerCase();
  return itemCode ? itemCode === normalizedHighlight : false;
}

export function SteelBatchesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, activeFactory, loading, error: sessionError } = useSession();
  const [batches, setBatches] = useState<SteelBatch[]>([]);
  const [items, setItems] = useState<SteelItem[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchValue, setSearchValue] = useState(() => searchParams.get("filter")?.trim() || "");
  const [dateValue, setDateValue] = useState(() => normalizeDateParam(searchParams.get("date")));

  const hasAutoScrolled = useRef(false);
  const rowRefs = useRef(new Map<number, HTMLTableRowElement | null>());

  const source = searchParams.get("source")?.trim() || "";
  const highlight = searchParams.get("highlight")?.trim() || "";
  const isSteelFactory = (activeFactory?.industry_type || "").toLowerCase() === "steel";

  const loadData = useCallback(async () => {
    setPageLoading(true);
    try {
      const [batchesPayload, itemsPayload] = await Promise.all([
        listSteelBatches(BATCH_LIST_LIMIT),
        listSteelItems(),
      ]);
      setBatches(batchesPayload.items || []);
      setItems(itemsPayload.items || []);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load steel batches.");
    } finally {
      setPageLoading(false);
    }
  }, [isSteelFactory]);

  useEffect(() => {
    if (!user || !isSteelFactory) return;
    void loadData();
  }, [isSteelFactory, loadData, user]);

  const itemById = useMemo(() => {
    const map = new Map<number, SteelItem>();
    for (const item of items) {
      map.set(item.id, item);
    }
    return map;
  }, [items]);

  const rows = useMemo<BatchListRow[]>(() => {
    return batches.map((batch) => {
      const outputItem = itemById.get(batch.output_item_id);
      const itemCode = outputItem?.item_code || "";
      const itemName = outputItem?.name || batch.output_item_name || "";
      return {
        batch,
        batchId: batch.batch_code || String(batch.id),
        itemCode,
        skuCode: itemCode,
        itemLabel: itemCode && itemName ? `${itemCode} - ${itemName}` : itemCode || itemName || `Item #${batch.output_item_id}`,
      };
    });
  }, [batches, itemById]);

  const normalizedSearch = searchValue.trim().toLowerCase();
  const normalizedHighlight = highlight.toLowerCase();

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const matchesSearch =
        !normalizedSearch ||
        row.batchId.toLowerCase().includes(normalizedSearch) ||
        row.skuCode.toLowerCase().includes(normalizedSearch) ||
        row.itemCode.toLowerCase().includes(normalizedSearch);
      const matchesDate = !dateValue || row.batch.production_date === dateValue;
      return matchesSearch && matchesDate;
    });
  }, [dateValue, normalizedSearch, rows]);

  const highlightedRowId = useMemo(() => {
    if (!normalizedHighlight) return null;
    const match = filteredRows.find((row) => highlightMatches(row, normalizedHighlight)) || null;
    return match ? match.batch.id : null;
  }, [filteredRows, normalizedHighlight]);

  useEffect(() => {
    if (hasAutoScrolled.current || pageLoading) return;
    if (!highlight) {
      hasAutoScrolled.current = true;
      return;
    }
    const node = highlightedRowId ? rowRefs.current.get(highlightedRowId) : null;
    if (node) {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    hasAutoScrolled.current = true;
  }, [highlight, highlightedRowId, pageLoading]);

  if (loading || pageLoading) {
    return <DashboardPageSkeleton />;
  }

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4 content-fade-in">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Steel Batches</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-red-400">{sessionError || "Please sign in to continue."}</div>
            <Link href="/access">
              <Button>Open Access</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!isSteelFactory) {
    return (
      <main className="min-h-screen px-4 py-8 md:px-8">
        <div className="mx-auto max-w-4xl">
          <Card>
            <CardHeader>
              <CardTitle>Steel batches are factory-aware</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-[var(--muted)]">
              <div>
                Your active factory is <span className="font-semibold text-[var(--text)]">{activeFactory?.name || "not selected"}</span>.
              </div>
              <div>Switch into a steel factory from the sidebar, or update the factory profile in Settings first.</div>
              <div className="flex gap-3">
                <Link href="/steel">
                  <Button>Open Steel Module</Button>
                </Link>
                <Link href="/settings">
                  <Button variant="outline">Open Settings</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[2rem] border border-[var(--border)] bg-[linear-gradient(135deg,rgba(20,24,36,0.96),rgba(12,18,28,0.9))] p-6 shadow-2xl backdrop-blur">
          <div className="max-w-4xl">
            <div className="text-sm uppercase tracking-prominent text-[var(--accent)]">Steel Batches</div>
            <h1 className="mt-2 text-3xl font-semibold md:text-4xl">Investigate production batches</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Continue from batch signals into a read-only production list, then open the batch trace that needs attention.
            </p>
          </div>
        </section>

        {source === "charts" ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] px-4 py-3 text-sm text-[var(--muted)]">
            Showing batches from steel performance overview
          </div>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Batch list</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-[1fr_220px]">
              <div>
                <label className="text-sm text-[var(--muted)]">Search</label>
                <Input
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder="Search by batch ID or item code"
                />
              </div>
              <div>
                <label className="text-sm text-[var(--muted)]">Production date</label>
                <Input
                  type="date"
                  value={dateValue}
                  onChange={(event) => setDateValue(normalizeDateParam(event.target.value))}
                />
              </div>
            </div>

            <ResponsiveScrollArea className="rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)]" debugLabel="steel-batches-list">
              <table className="min-w-full text-left text-sm">
                <thead className="text-[var(--muted)]">
                  <tr className="border-b border-[var(--border)]">
                    <th className="px-3 py-3 font-medium">Batch ID</th>
                    <th className="px-3 py-3 font-medium">SKU / Item Code</th>
                    <th className="px-3 py-3 font-medium">Production Date</th>
                    <th className="px-3 py-3 font-medium">Actual Output</th>
                    <th className="px-3 py-3 font-medium">Loss</th>
                    <th className="px-3 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => {
                    const isHighlighted = row.batch.id === highlightedRowId;
                    return (
                      <tr
                        key={row.batch.id}
                        ref={(node) => {
                          if (node) {
                            rowRefs.current.set(row.batch.id, node);
                          } else {
                            rowRefs.current.delete(row.batch.id);
                          }
                        }}
                        className={`cursor-pointer border-b border-[var(--border)]/60 transition last:border-none ${
                          isHighlighted
                            ? "bg-[rgba(197,109,45,0.16)] shadow-[inset_0_0_0_1px_rgba(197,109,45,0.45)]"
                            : "hover:bg-[rgba(20,24,36,0.52)]"
                        }`}
                        onClick={() => router.push(`/steel/batches/${row.batch.id}`)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            router.push(`/steel/batches/${row.batch.id}`);
                          }
                        }}
                        role="link"
                        tabIndex={0}
                      >
                        <td className="px-3 py-3">
                          <div className="font-semibold text-white">{row.batchId}</div>
                          <div className="text-xs text-[var(--muted)]">Record #{row.batch.id}</div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-medium text-white">{row.itemLabel}</div>
                        </td>
                        <td className="px-3 py-3 text-[var(--text)]">{formatDate(row.batch.production_date)}</td>
                        <td className="px-3 py-3 text-[var(--text)]">{formatKg(row.batch.actual_output_kg)} KG</td>
                        <td className="px-3 py-3 text-[var(--text)]">{formatKg(row.batch.loss_kg)} KG</td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] uppercase tracking-caption ${statusBadgeClass(row.batch.status)}`}>
                            {row.batch.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {!filteredRows.length ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-[var(--muted)]">
                        No steel batches match the current filters.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </ResponsiveScrollArea>

            <div className="text-xs text-[var(--muted)]">
              Review a row to continue into the batch detail trace.
            </div>
          </CardContent>
        </Card>

        {error || sessionError ? <div className="text-sm text-red-400">{error || sessionError}</div> : null}
      </div>
    </main>
  );
}
