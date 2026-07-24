"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getSteelFinancialOverview,
  getSteelProductProfitability,
  getSteelReceivables,
  getSteelPayables,
  getSteelExpensesSummary,
  getSteelCashFlow,
  getSteelCashFlowMonthly,
  type FinancialOverview,
  type ProductProfitability,
  type ReceivablesSummary,
  type PayablesSummary,
  type ExpensesSummary,
  type CashFlowSummary,
  type CashFlowMonthlyTrend,
} from "@/lib/steel";
import { useSession } from "@/lib/use-session";
import { DashboardPageSkeleton } from "@/components/shared/page-skeletons";
import { ResponsiveScrollArea } from "@/components/ui/responsive-scroll-area";
import { TabButton } from "@/components/shared";

type Tab = "overview" | "products" | "receivables" | "payables" | "expenses" | "cashflow";

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatKg(value: number | null | undefined) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 }).format(value || 0);
}

function formatPercent(value: number | null | undefined) {
  return new Intl.NumberFormat("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value || 0);
}

function riskBadge(level: string) {
  if (level === "high" || level === "critical") return "border-rose-400/35 bg-rose-400/12 text-rose-200";
  if (level === "medium") return "border-amber-400/35 bg-amber-400/12 text-amber-200";
  return "border-emerald-400/35 bg-emerald-400/12 text-emerald-200";
}

function DataQualityBadge({ quality }: { quality: string }) {
  if (quality === "estimated") {
    return (
      <span className="inline-flex rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-caption text-amber-200">
        Estimated
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-caption text-emerald-200">
      Actual
    </span>
  );
}

export function SteelFinancialIntelligencePage() {
  const { user, loading: sessionLoading } = useSession();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [overview, setOverview] = useState<FinancialOverview | null>(null);
  const [profitability, setProfitability] = useState<ProductProfitability | null>(null);
  const [receivables, setReceivables] = useState<ReceivablesSummary | null>(null);
  const [payables, setPayables] = useState<PayablesSummary | null>(null);
  const [expenses, setExpenses] = useState<ExpensesSummary | null>(null);
  const [cashFlow, setCashFlow] = useState<CashFlowSummary | null>(null);
  const [cashFlowMonthly, setCashFlowMonthly] = useState<CashFlowMonthlyTrend | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState("");

  const refreshAll = useCallback(async () => {
    if (!user) return;
    setPageLoading(true);
    setError("");
    try {
      const [ov, prof, rec, pay, exp, cf, cfMonthly] = await Promise.all([
        getSteelFinancialOverview(),
        getSteelProductProfitability(),
        getSteelReceivables(),
        getSteelPayables(),
        getSteelExpensesSummary(),
        getSteelCashFlow(),
        getSteelCashFlowMonthly(),
      ]);
      setOverview(ov);
      setProfitability(prof);
      setReceivables(rec);
      setPayables(pay);
      setExpenses(exp);
      setCashFlow(cf);
      setCashFlowMonthly(cfMonthly);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load financial intelligence.");
    } finally {
      setPageLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  if (sessionLoading || pageLoading) {
    return <DashboardPageSkeleton />;
  }

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4 content-fade-in">
        <Card className="w-full">
          <CardHeader><CardTitle>Financial Intelligence</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-red-400">Please sign in to continue.</div>
            <Link href="/access"><Button>Open Access</Button></Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  const rev = overview?.revenue;
  const collected = overview?.collected_cash;
  const realized = overview?.realized_metrics;
  const recv = overview?.receivables;

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#fafaf9_0%,#f5f5f4_48%,#fafaf9_100%)] px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <section className="rounded-[2rem] border border-[#e7e5e4] bg-[linear-gradient(135deg,#ffffff,#fafaf9)] p-6 shadow-[0_22px_55px_rgba(15,23,42,0.08)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-4xl">
              <div className="text-sm uppercase tracking-prominent text-[#78716c]">Financial Intelligence</div>
              <h1 className="mt-2 text-3xl font-semibold text-[#111111] md:text-4xl">
                Revenue, margins, receivables &amp; cash
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#57534e]">
                Track financial health from invoiced revenue through realized margins to collection.
                All figures are <strong>operational estimates</strong> — see per-section labels.
              </p>
            </div>
            <Button variant="outline" onClick={() => void refreshAll()} disabled={pageLoading}>
              {pageLoading ? "Loading..." : "Refresh"}
            </Button>
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-rose-400/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>
        ) : null}

        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2">
          <TabButton label="Financial Overview" active={activeTab === "overview"} onClick={() => setActiveTab("overview")} />
          <TabButton label="Product Profitability" active={activeTab === "products"} onClick={() => setActiveTab("products")} />
          <TabButton label="Receivables" active={activeTab === "receivables"} onClick={() => setActiveTab("receivables")} />
          <TabButton label="Payables" active={activeTab === "payables"} onClick={() => setActiveTab("payables")} />
          <TabButton label="Expenses" active={activeTab === "expenses"} onClick={() => setActiveTab("expenses")} />
          <TabButton label="Cash Flow" active={activeTab === "cashflow"} onClick={() => setActiveTab("cashflow")} />
        </div>

        {/* ── TAB: Overview ─────────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <>
            {/* Revenue + Cash Summary Cards */}
            <section className="grid gap-4 md:grid-cols-4">
              <Card className="border border-[#e7e5e4] bg-white shadow-sm">
                <CardHeader className="pb-2">
                  <div className="text-xs uppercase tracking-wider text-[#78716c]">Revenue Today</div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-[#111111]">{formatCurrency(rev?.today.revenue_inr)}</div>
                  <div className="mt-1 text-xs text-[#57534e]">{rev?.today.invoice_count ?? 0} invoices</div>
                </CardContent>
              </Card>
              <Card className="border border-[#e7e5e4] bg-white shadow-sm">
                <CardHeader className="pb-2">
                  <div className="text-xs uppercase tracking-wider text-[#78716c]">Revenue This Week</div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-[#111111]">{formatCurrency(rev?.this_week.revenue_inr)}</div>
                  <div className="mt-1 text-xs text-[#57534e]">{rev?.this_week.invoice_count ?? 0} invoices</div>
                </CardContent>
              </Card>
              <Card className="border border-[#e7e5e4] bg-white shadow-sm">
                <CardHeader className="pb-2">
                  <div className="text-xs uppercase tracking-wider text-[#78716c]">Revenue This Month</div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-[#111111]">{formatCurrency(rev?.this_month.revenue_inr)}</div>
                  <div className="mt-1 text-xs text-[#57534e]">{rev?.this_month.invoice_count ?? 0} invoices</div>
                </CardContent>
              </Card>
              <Card className="border border-[#e7e5e4] bg-white shadow-sm">
                <CardHeader className="pb-2">
                  <div className="text-xs uppercase tracking-wider text-[#78716c]">Collected Cash</div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-[#111111]">{formatCurrency(collected?.last_n_days)}</div>
                  <div className="mt-1 text-xs text-[#57534e]">{overview?.period_days ?? 30}-day collected</div>
                </CardContent>
              </Card>
            </section>

            {/* Realized Metrics */}
            <Card className="border border-[#e7e5e4] bg-white shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-[#78716c]">Realised Metrics</div>
                    <CardTitle className="text-xl text-[#111111]">Dispatched Revenue &amp; Margin</CardTitle>
                  </div>
                  <DataQualityBadge quality={realized?.data_quality || "estimated"} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="rounded-2xl border border-[#e7e5e4] p-4">
                    <div className="text-xs text-[#78716c]">Revenue</div>
                    <div className="mt-1 text-2xl font-bold text-[#111111]">{formatCurrency(realized?.dispatched_revenue_inr)}</div>
                  </div>
                  <div className="rounded-2xl border border-[#e7e5e4] p-4">
                    <div className="text-xs text-[#78716c]">Cost</div>
                    <div className="mt-1 text-2xl font-bold text-[#111111]">{formatCurrency(realized?.dispatched_cost_inr)}</div>
                  </div>
                  <div className="rounded-2xl border border-[#e7e5e4] p-4">
                    <div className="text-xs text-[#78716c]">Profit</div>
                    <div className={`mt-1 text-2xl font-bold ${(realized?.dispatched_profit_inr ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {formatCurrency(realized?.dispatched_profit_inr)}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-[#e7e5e4] p-4">
                    <div className="text-xs text-[#78716c]">Margin</div>
                    <div className={`mt-1 text-2xl font-bold ${(realized?.margin_percent ?? 0) >= 15 ? "text-emerald-600" : (realized?.margin_percent ?? 0) >= 5 ? "text-amber-600" : "text-rose-600"}`}>
                      {formatPercent(realized?.margin_percent)}%
                    </div>
                    <div className="mt-1 text-xs text-[#57534e]">{formatKg(realized?.dispatch_weight_kg)} KG dispatched</div>
                  </div>
                </div>
                <div className="mt-3 text-xs text-[#78716c]">
                  Cost basis: <span className="font-medium">{realized?.cost_basis || "current_batch_rate"}</span>
                </div>
              </CardContent>
            </Card>

            {/* Receivables Snapshot */}
            <Card className="border border-[#e7e5e4] bg-white shadow-sm">
              <CardHeader>
                <div className="text-xs uppercase tracking-wider text-[#78716c]">Receivables Snapshot</div>
                <CardTitle className="text-xl text-[#111111]">Outstanding &amp; Overdue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-[#e7e5e4] p-4">
                    <div className="text-xs text-[#78716c]">Total Outstanding</div>
                    <div className="mt-1 text-2xl font-bold text-[#111111]">{formatCurrency(recv?.total_outstanding_inr)}</div>
                    <div className="mt-1 text-xs text-[#57534e]">{recv?.outstanding_invoice_count ?? 0} unpaid invoices</div>
                  </div>
                  <div className="rounded-2xl border border-[#e7e5e4] p-4">
                    <div className="text-xs text-[#78716c]">Overdue</div>
                    <div className={`mt-1 text-2xl font-bold ${(recv?.overdue_count ?? 0) > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                      {formatCurrency(recv?.overdue_amount_inr)}
                    </div>
                    <div className="mt-1 text-xs text-[#57534e]">{recv?.overdue_count ?? 0} overdue invoices</div>
                  </div>
                  <div className="rounded-2xl border border-[#e7e5e4] p-4">
                    <div className="text-xs text-[#78716c]">Customers</div>
                    <div className="mt-1 text-2xl font-bold text-[#111111]">{overview?.context.active_customers ?? 0}</div>
                    <div className="mt-1 text-xs text-[#57534e]">Total invoices: {overview?.context.total_invoices_all_time ?? 0}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* ── TAB: Product Profitability ────────────────────────────────── */}
        {activeTab === "products" && (
          <>
            <Card className="border border-[#e7e5e4] bg-white shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-[#78716c]">Product Profitability</div>
                    <CardTitle className="text-xl text-[#111111]">Margin by Product</CardTitle>
                  </div>
                  <DataQualityBadge quality={profitability?.data_quality || "estimated"} />
                </div>
                {profitability?.cost_basis_summary ? (
                  <p className="mt-2 text-xs leading-5 text-[#57534e]">{profitability.cost_basis_summary}</p>
                ) : null}
              </CardHeader>
              <CardContent>
                {/* Summary cards */}
                <div className="mb-6 grid gap-4 md:grid-cols-4">
                  <div className="rounded-2xl border border-[#e7e5e4] p-4">
                    <div className="text-xs text-[#78716c]">Total Revenue</div>
                    <div className="mt-1 text-xl font-bold text-[#111111]">{formatCurrency(profitability?.summary.total_revenue_inr)}</div>
                  </div>
                  <div className="rounded-2xl border border-[#e7e5e4] p-4">
                    <div className="text-xs text-[#78716c]">Total Cost</div>
                    <div className="mt-1 text-xl font-bold text-[#111111]">{formatCurrency(profitability?.summary.total_cost_inr)}</div>
                  </div>
                  <div className="rounded-2xl border border-[#e7e5e4] p-4">
                    <div className="text-xs text-[#78716c]">Total Profit</div>
                    <div className="mt-1 text-xl font-bold text-[#111111]">{formatCurrency(profitability?.summary.total_profit_inr)}</div>
                  </div>
                  <div className="rounded-2xl border border-[#e7e5e4] p-4">
                    <div className="text-xs text-[#78716c]">Avg Margin</div>
                    <div className="mt-1 text-xl font-bold text-[#111111]">{formatPercent(profitability?.summary.avg_margin_percent)}%</div>
                    <div className="mt-1 text-xs text-[#57534e]">{profitability?.time_period_days ?? 90} days</div>
                  </div>
                </div>

                {!profitability || profitability.products.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#e7e5e4] px-4 py-8 text-center text-sm text-[#57534e]">
                    No product data available for this period.
                  </div>
                ) : (
                  <>
                    {/* Top/Bottom Margin */}
                    <section className="mb-6 grid gap-6 md:grid-cols-2">
                      <Card className="border border-[#e7e5e4] bg-white/80 shadow-sm">
                        <CardHeader className="pb-2">
                          <div className="text-xs uppercase tracking-wider text-emerald-600">Highest Margin</div>
                        </CardHeader>
                        <CardContent>
                          {profitability.top_by_margin.length === 0 ? (
                            <div className="text-sm text-[#57534e]">N/A</div>
                          ) : (
                            <div className="space-y-2">
                              {profitability.top_by_margin.map((p) => (
                                <div key={p.item_id} className="flex items-center justify-between border-b border-[#e7e5e4]/60 pb-2 last:border-none last:pb-0">
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-semibold text-[#111111]">{p.item_name}</div>
                                    <div className="text-xs text-[#78716c]">{p.category}</div>
                                  </div>
                                  <div className="text-right">
                                    <div className="font-semibold text-emerald-600">{formatPercent(p.margin_percent)}%</div>
                                    <div className="text-xs text-[#78716c]">{formatCurrency(p.gross_profit_inr)}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                      <Card className="border border-[#e7e5e4] bg-white/80 shadow-sm">
                        <CardHeader className="pb-2">
                          <div className="text-xs uppercase tracking-wider text-rose-600">Lowest Margin</div>
                        </CardHeader>
                        <CardContent>
                          {profitability.bottom_by_margin.length === 0 ? (
                            <div className="text-sm text-[#57534e]">N/A</div>
                          ) : (
                            <div className="space-y-2">
                              {profitability.bottom_by_margin.map((p) => (
                                <div key={p.item_id} className="flex items-center justify-between border-b border-[#e7e5e4]/60 pb-2 last:border-none last:pb-0">
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-semibold text-[#111111]">{p.item_name}</div>
                                    <div className="text-xs text-[#78716c]">{p.category}</div>
                                  </div>
                                  <div className="text-right">
                                    <div className="font-semibold text-rose-600">{formatPercent(p.margin_percent)}%</div>
                                    <div className="text-xs text-[#78716c]">{formatCurrency(p.gross_profit_inr)}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </section>

                    {/* Full product table */}
                    <Card className="border border-[#e7e5e4] bg-white/80 shadow-sm">
                      <CardHeader>
                        <CardTitle className="text-lg text-[#111111]">All Products</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveScrollArea
                          className="rounded-3xl border border-[#e7e5e4]"
                          debugLabel="finance-product-table"
                        >
                          <table className="min-w-full text-left text-sm">
                            <thead className="text-[#78716c]">
                              <tr className="border-b border-[#e7e5e4]">
                                <th className="px-3 py-3 font-medium">Product</th>
                                <th className="px-3 py-3 font-medium">Category</th>
                                <th className="px-3 py-3 font-medium">Revenue</th>
                                <th className="px-3 py-3 font-medium">Cost</th>
                                <th className="px-3 py-3 font-medium">Profit</th>
                                <th className="px-3 py-3 font-medium">Margin</th>
                                <th className="px-3 py-3 font-medium">Volume KG</th>
                                <th className="px-3 py-3 font-medium">Invoices</th>
                              </tr>
                            </thead>
                            <tbody>
                              {profitability.products.map((p) => (
                                <tr key={p.item_id} className="border-b border-[#e7e5e4]/60 last:border-none hover:bg-[#f5f5f4]/60">
                                  <td className="px-3 py-3 font-semibold text-[#111111]">{p.item_name}</td>
                                  <td className="px-3 py-3 text-[#57534e]">{p.category}</td>
                                  <td className="px-3 py-3 text-[#111111]">{formatCurrency(p.total_revenue_inr)}</td>
                                  <td className="px-3 py-3 text-[#57534e]">{formatCurrency(p.total_cost_inr)}</td>
                                  <td className={`px-3 py-3 font-semibold ${p.gross_profit_inr >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                    {formatCurrency(p.gross_profit_inr)}
                                  </td>
                                  <td className={`px-3 py-3 font-semibold ${p.margin_percent >= 15 ? "text-emerald-600" : p.margin_percent >= 5 ? "text-amber-600" : "text-rose-600"}`}>
                                    {formatPercent(p.margin_percent)}%
                                  </td>
                                  <td className="px-3 py-3 text-[#57534e]">{formatKg(p.total_weight_kg)}</td>
                                  <td className="px-3 py-3 text-[#57534e]">{p.invoice_count}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </ResponsiveScrollArea>
                      </CardContent>
                    </Card>
                  </>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* ── TAB: Receivables ──────────────────────────────────────────── */}
        {activeTab === "receivables" && (
          <>
            <Card className="border border-[#e7e5e4] bg-white shadow-sm">
              <CardHeader>
                <div className="text-xs uppercase tracking-wider text-[#78716c]">Accounts Receivable</div>
                <CardTitle className="text-xl text-[#111111]">Outstanding &amp; Aging</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-6 grid gap-4 md:grid-cols-4">
                  <div className="rounded-2xl border border-[#e7e5e4] p-4">
                    <div className="text-xs text-[#78716c]">Total Outstanding</div>
                    <div className="mt-1 text-2xl font-bold text-[#111111]">{formatCurrency(receivables?.total_outstanding_inr)}</div>
                  </div>
                  <div className="rounded-2xl border border-[#e7e5e4] p-4">
                    <div className="text-xs text-[#78716c]">Total Overdue</div>
                    <div className={`mt-1 text-2xl font-bold ${(receivables?.total_overdue_inr ?? 0) > 0 ? "text-rose-600" : "text-emerald-600"}`}>{formatCurrency(receivables?.total_overdue_inr)}</div>
                  </div>
                  <div className="rounded-2xl border border-[#e7e5e4] p-4">
                    <div className="text-xs text-[#78716c]">Collection Efficiency</div>
                    <div className={`mt-1 text-2xl font-bold ${(receivables?.summary.collection_efficiency_percent ?? 100) >= 80 ? "text-emerald-600" : "text-amber-600"}`}>{formatPercent(receivables?.summary.collection_efficiency_percent)}%</div>
                  </div>
                  <div className="rounded-2xl border border-[#e7e5e4] p-4">
                    <div className="text-xs text-[#78716c]">Open Invoices</div>
                    <div className="mt-1 text-2xl font-bold text-[#111111]">{receivables?.summary.outstanding_invoices ?? 0}</div>
                    <div className="mt-1 text-xs text-[#57534e]">of {receivables?.summary.total_invoices ?? 0} total</div>
                  </div>
                </div>
                {receivables && receivables.aging_buckets.length > 0 ? (
                  <>
                    <Card className="mb-6 border border-[#e7e5e4] bg-white/80 shadow-sm">
                      <CardHeader><CardTitle className="text-lg text-[#111111]">Aging Buckets</CardTitle></CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {receivables.aging_buckets.map((bucket) => {
                            const pct = receivables.total_outstanding_inr > 0 ? (bucket.amount_inr / receivables.total_outstanding_inr) * 100 : 0;
                            const isBad = bucket.key === "90_plus" || bucket.key === "61_90";
                            return (
                              <div key={bucket.key}>
                                <div className="mb-1 flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className={`inline-flex h-2.5 w-2.5 rounded-full ${isBad ? "bg-rose-500" : bucket.key === "31_60" ? "bg-amber-500" : "bg-emerald-500"}`} />
                                    <span className="text-sm font-semibold text-[#111111]">{bucket.label}</span>
                                  </div>
                                  <div className="text-right">
                                    <span className="font-semibold text-[#111111]">{formatCurrency(bucket.amount_inr)}</span>
                                    <span className="ml-2 text-xs text-[#57534e]">({bucket.invoice_count} invoices)</span>
                                  </div>
                                </div>
                                <div className="h-2.5 rounded-full bg-[#e7e5e4]">
                                  <div className={`h-full rounded-full ${isBad ? "bg-rose-500" : bucket.key === "31_60" ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                    {receivables.top_overdue_customers.length > 0 && (
                      <Card className="border border-[#e7e5e4] bg-white/80 shadow-sm">
                        <CardHeader><CardTitle className="text-lg text-[#111111]">Top Overdue Customers</CardTitle></CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {receivables.top_overdue_customers.map((c) => (
                              <div key={c.customer_id} className="flex items-center justify-between border-b border-[#e7e5e4]/60 pb-3 last:border-none last:pb-0">
                                <div>
                                  <div className="font-semibold text-[#111111]">{c.customer_name}</div>
                                  <div className="flex items-center gap-2 text-xs text-[#57534e]"><span>{c.max_overdue_days} days overdue</span><span>&middot;</span><span>{c.invoice_count} invoices</span></div>
                                </div>
                                <div className="text-right">
                                  <div className="font-semibold text-rose-600">{formatCurrency(c.overdue_inr)}</div>
                                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs uppercase tracking-caption ${riskBadge(c.risk_level)}`}>{c.risk_level}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </>
                ) : (
                  <div className="rounded-2xl border border-dashed border-[#e7e5e4] px-4 py-8 text-center text-sm text-[#57534e]">No receivables data available. All invoices appear fully paid.</div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* ── TAB: Payables ─────────────────────────────────────────────── */}
        {activeTab === "payables" && (
          <>
            <Card className="border border-[#e7e5e4] bg-white shadow-sm">
              <CardHeader>
                <div className="text-xs uppercase tracking-wider text-[#78716c]">Accounts Payable</div>
                <CardTitle className="text-xl text-[#111111]">Outstanding Vendor Bills &amp; Aging</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-6 grid gap-4 md:grid-cols-4">
                  <div className="rounded-2xl border border-[#e7e5e4] p-4">
                    <div className="text-xs text-[#78716c]">Total Outstanding</div>
                    <div className="mt-1 text-2xl font-bold text-[#111111]">{formatCurrency(payables?.total_outstanding_inr)}</div>
                  </div>
                  <div className="rounded-2xl border border-[#e7e5e4] p-4">
                    <div className="text-xs text-[#78716c]">Total Overdue</div>
                    <div className={`mt-1 text-2xl font-bold ${(payables?.total_overdue_inr ?? 0) > 0 ? "text-rose-600" : "text-emerald-600"}`}>{formatCurrency(payables?.total_overdue_inr)}</div>
                  </div>
                  <div className="rounded-2xl border border-[#e7e5e4] p-4">
                    <div className="text-xs text-[#78716c]">Payment Efficiency</div>
                    <div className={`mt-1 text-2xl font-bold ${(payables?.summary.payment_efficiency_percent ?? 100) >= 80 ? "text-emerald-600" : "text-amber-600"}`}>{formatPercent(payables?.summary.payment_efficiency_percent)}%</div>
                  </div>
                  <div className="rounded-2xl border border-[#e7e5e4] p-4">
                    <div className="text-xs text-[#78716c]">Open Bills</div>
                    <div className="mt-1 text-2xl font-bold text-[#111111]">{payables?.summary.outstanding_bills ?? 0}</div>
                    <div className="mt-1 text-xs text-[#57534e]">of {payables?.summary.total_bills ?? 0} total</div>
                  </div>
                </div>
                {payables && payables.aging_buckets.length > 0 ? (
                  <>
                    <Card className="mb-6 border border-[#e7e5e4] bg-white/80 shadow-sm">
                      <CardHeader><CardTitle className="text-lg text-[#111111]">Aging Buckets</CardTitle></CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {payables.aging_buckets.map((bucket) => {
                            const pct = payables.total_outstanding_inr > 0 ? (bucket.amount_inr / payables.total_outstanding_inr) * 100 : 0;
                            const isBad = bucket.key === "90_plus" || bucket.key === "61_90";
                            return (
                              <div key={bucket.key}>
                                <div className="mb-1 flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className={`inline-flex h-2.5 w-2.5 rounded-full ${isBad ? "bg-rose-500" : bucket.key === "31_60" ? "bg-amber-500" : "bg-emerald-500"}`} />
                                    <span className="text-sm font-semibold text-[#111111]">{bucket.label}</span>
                                  </div>
                                  <div className="text-right">
                                    <span className="font-semibold text-[#111111]">{formatCurrency(bucket.amount_inr)}</span>
                                    <span className="ml-2 text-xs text-[#57534e]">({bucket.bill_count} bills)</span>
                                  </div>
                                </div>
                                <div className="h-2.5 rounded-full bg-[#e7e5e4]">
                                  <div className={`h-full rounded-full ${isBad ? "bg-rose-500" : bucket.key === "31_60" ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                    {payables.top_overdue_vendors.length > 0 && (
                      <Card className="border border-[#e7e5e4] bg-white/80 shadow-sm">
                        <CardHeader><CardTitle className="text-lg text-[#111111]">Top Overdue Vendors</CardTitle></CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {payables.top_overdue_vendors.map((v) => (
                              <div key={v.vendor_id} className="flex items-center justify-between border-b border-[#e7e5e4]/60 pb-3 last:border-none last:pb-0">
                                <div>
                                  <div className="font-semibold text-[#111111]">{v.vendor_name}</div>
                                  <div className="text-xs text-[#57534e]">{v.max_overdue_days} days overdue &middot; {v.bill_count} bills</div>
                                </div>
                                <div className="font-semibold text-rose-600">{formatCurrency(v.overdue_inr)}</div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </>
                ) : (
                  <div className="rounded-2xl border border-dashed border-[#e7e5e4] px-4 py-8 text-center text-sm text-[#57534e]">No payables data available. All bills appear fully paid.</div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* ── TAB: Cash Flow ───────────────────────────────────────────── */}
        {activeTab === "cashflow" && (
          <>
            <Card className="border border-[#e7e5e4] bg-white shadow-sm">
              <CardHeader>
                <div className="text-xs uppercase tracking-wider text-[#78716c]">Cash Flow</div>
                <CardTitle className="text-xl text-[#111111]">Cash Position &amp; Accounts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-6 grid gap-4 md:grid-cols-4">
                  <div className="rounded-2xl border border-[#e7e5e4] p-4">
                    <div className="text-xs text-[#78716c]">Total Balance</div>
                    <div className="mt-1 text-2xl font-bold text-[#111111]">{formatCurrency(cashFlow?.total_balance_inr)}</div>
                  </div>
                  <div className="rounded-2xl border border-[#e7e5e4] p-4">
                    <div className="text-xs text-[#78716c]">Cash in Hand</div>
                    <div className="mt-1 text-2xl font-bold text-emerald-600">{formatCurrency(cashFlow?.cash_balance_inr)}</div>
                  </div>
                  <div className="rounded-2xl border border-[#e7e5e4] p-4">
                    <div className="text-xs text-[#78716c]">Bank Balance</div>
                    <div className="mt-1 text-2xl font-bold text-[#111111]">{formatCurrency(cashFlow?.bank_balance_inr)}</div>
                  </div>
                  <div className="rounded-2xl border border-[#e7e5e4] p-4">
                    <div className="text-xs text-[#78716c]">Accounts</div>
                    <div className="mt-1 text-2xl font-bold text-[#111111]">{cashFlow?.account_count ?? 0}</div>
                    <div className="mt-1 text-xs text-[#57534e]">Active cash/bank accounts</div>
                  </div>
                </div>

                {cashFlow && cashFlow.account_count > 0 ? (
                  <div className="grid gap-6 md:grid-cols-2">
                    <Card className="border border-[#e7e5e4] bg-white/80 shadow-sm">
                      <CardHeader><CardTitle className="text-lg text-[#111111]">Accounts</CardTitle></CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {cashFlow.accounts.map((acc) => (
                            <div key={acc.id} className="flex items-center justify-between border-b border-[#e7e5e4]/60 pb-2 last:border-none last:pb-0">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-[#111111]">{acc.account_name}</div>
                                <div className="text-xs text-[#57534e]">{acc.account_type.replace(/_/g, " ")}{acc.bank_name ? ` - ${acc.bank_name}` : ""}</div>
                              </div>
                              <div className="text-right">
                                <div className="font-semibold text-[#111111]">{formatCurrency(acc.current_balance)}</div>
                                <div className="text-xs text-[#57534e]">{acc.currency}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="border border-[#e7e5e4] bg-white/80 shadow-sm">
                      <CardHeader><CardTitle className="text-lg text-[#111111]">Recent Transactions</CardTitle></CardHeader>
                      <CardContent>
                        {cashFlow.recent_entries.length > 0 ? (
                          <div className="space-y-2">
                            {cashFlow.recent_entries.slice(0, 10).map((e) => (
                              <div key={e.id} className="flex items-center justify-between border-b border-[#e7e5e4]/60 pb-2 last:border-none last:pb-0">
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-[#111111]">{e.description}</div>
                                  <div className="text-xs text-[#57534e]">{e.account_name} &middot; {e.entry_date}</div>
                                </div>
                                <div className="text-right">
                                  <div className={`font-semibold ${e.entry_type === "debit" ? "text-emerald-600" : "text-rose-600"}`}>
                                    {e.entry_type === "debit" ? "+" : "-"}{formatCurrency(e.amount)}
                                  </div>
                                  <div className="text-xs text-[#57534e]">{e.category || "uncategorised"}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-[#57534e]">No recent transactions.</div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-[#e7e5e4] px-4 py-8 text-center text-sm text-[#57534e]">
                    No cash accounts configured. Create a cash/bank account to start tracking cash flow.
                  </div>
                )}
              </CardContent>
            </Card>

            {cashFlowMonthly && cashFlowMonthly.monthly_data.length > 0 && (
              <Card className="border border-[#e7e5e4] bg-white shadow-sm">
                <CardHeader>
                  <div className="text-xs uppercase tracking-wider text-[#78716c]">Monthly Cash Flow</div>
                  <CardTitle className="text-xl text-[#111111]">Inflow vs Outflow</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border border-[#e7e5e4] p-4">
                      <div className="text-xs text-[#78716c]">Total Inflow</div>
                      <div className="mt-1 text-xl font-bold text-emerald-600">{formatCurrency(cashFlowMonthly.total_inflow_inr)}</div>
                    </div>
                    <div className="rounded-2xl border border-[#e7e5e4] p-4">
                      <div className="text-xs text-[#78716c]">Total Outflow</div>
                      <div className="mt-1 text-xl font-bold text-rose-600">{formatCurrency(cashFlowMonthly.total_outflow_inr)}</div>
                    </div>
                    <div className="rounded-2xl border border-[#e7e5e4] p-4">
                      <div className="text-xs text-[#78716c]">Net Cash Flow</div>
                      <div className={`mt-1 text-xl font-bold ${cashFlowMonthly.net_inr >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{formatCurrency(cashFlowMonthly.net_inr)}</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {cashFlowMonthly.monthly_data.map((m) => (
                      <div key={m.month} className="flex items-center justify-between border-b border-[#e7e5e4]/60 pb-2 last:border-none last:pb-0">
                        <div className="text-sm font-semibold text-[#111111]">{m.month}</div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-xs text-[#57534e]">In</div>
                            <div className="font-semibold text-emerald-600">{formatCurrency(m.inflow_inr)}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-[#57534e]">Out</div>
                            <div className="font-semibold text-rose-600">{formatCurrency(m.outflow_inr)}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-[#57534e]">Net</div>
                            <div className={`font-semibold ${m.net_inr >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{formatCurrency(m.net_inr)}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* ── TAB: Expenses ─────────────────────────────────────────────── */}
        {activeTab === "expenses" && (
          <>
            <Card className="border border-[#e7e5e4] bg-white shadow-sm">
              <CardHeader>
                <div className="text-xs uppercase tracking-wider text-[#78716c]">Expenses</div>
                <CardTitle className="text-xl text-[#111111]">Operational Expenses &amp; Vendor Bills</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-6 grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-[#e7e5e4] p-4">
                    <div className="text-xs text-[#78716c]">Total Expenses</div>
                    <div className="mt-1 text-2xl font-bold text-[#111111]">{formatCurrency(expenses?.total_expenses_inr)}</div>
                    <div className="mt-1 text-xs text-[#57534e]">{expenses?.time_period_days ?? 90} days</div>
                  </div>
                </div>

                {expenses && expenses.categories.length > 0 ? (
                  <div className="grid gap-6 md:grid-cols-2">
                    <Card className="border border-[#e7e5e4] bg-white/80 shadow-sm">
                      <CardHeader><CardTitle className="text-lg text-[#111111]">By Category</CardTitle></CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {expenses.categories.map((cat) => {
                            const pct = expenses.total_expenses_inr > 0 ? (cat.total_amount_inr / expenses.total_expenses_inr) * 100 : 0;
                            return (
                              <div key={cat.category} className="flex items-center justify-between border-b border-[#e7e5e4]/60 pb-2 last:border-none last:pb-0">
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-[#111111]">{cat.category.replace(/_/g, " ")}</div>
                                  <div className="text-xs text-[#57534e]">{cat.count} entries</div>
                                </div>
                                <div className="text-right">
                                  <div className="font-semibold text-[#111111]">{formatCurrency(cat.total_amount_inr)}</div>
                                  <div className="text-xs text-[#57534e]">{formatPercent(pct)}%</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="border border-[#e7e5e4] bg-white/80 shadow-sm">
                      <CardHeader><CardTitle className="text-lg text-[#111111]">Monthly Trend</CardTitle></CardHeader>
                      <CardContent>
                        {expenses.monthly_trend.length > 0 ? (
                          <div className="space-y-2">
                            {expenses.monthly_trend.map((m) => (
                              <div key={m.month} className="flex items-center justify-between border-b border-[#e7e5e4]/60 pb-2 last:border-none last:pb-0">
                                <div className="text-sm font-semibold text-[#111111]">{m.month}</div>
                                <div className="text-right">
                                  <div className="font-semibold text-[#111111]">{formatCurrency(m.total_inr)}</div>
                                  <div className="text-xs text-[#57534e]">{m.count} entries</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-[#57534e]">No monthly data available.</div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-[#e7e5e4] px-4 py-8 text-center text-sm text-[#57534e]">No expense data available for this period.</div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </main>
  );
}
