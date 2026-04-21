"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { IndustrialFactoryDashboard } from "@/components/dashboard/industrial-factory-dashboard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildSteelDashboardData, type IndustrialDashboardData } from "@/lib/industrial-dashboard";
import {
  getSteelOverview,
  listSteelBatches,
  listSteelDispatches,
  listSteelInvoices,
  type SteelBatch,
  type SteelDispatch,
  type SteelInvoice,
  type SteelOverview,
} from "@/lib/steel";
import { useSession } from "@/lib/use-session";

function formatKg(value: number | null | undefined) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value || 0);
}

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatPercent(value: number | null | undefined, digits = 1) {
  return `${Number(value || 0).toFixed(digits)}%`;
}

const CHART_ACCESS_ROLES = ["supervisor", "accountant", "manager", "admin", "owner"] as const;

export function SteelChartsPage() {
  const { user, activeFactory, loading, error: sessionError } = useSession();
  const [overview, setOverview] = useState<SteelOverview | null>(null);
  const [dashboardData, setDashboardData] = useState<Partial<Record<"today" | "7d" | "30d", IndustrialDashboardData>>>();
  const [batchCount, setBatchCount] = useState(0);
  const [invoiceCount, setInvoiceCount] = useState(0);
  const [dispatchCount, setDispatchCount] = useState(0);
  const [pageLoading, setPageLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const isSteelFactory = (activeFactory?.industry_type || "").toLowerCase() === "steel";
  const canAccessCharts = Boolean(user && CHART_ACCESS_ROLES.includes(user.role as (typeof CHART_ACCESS_ROLES)[number]));

  const refreshCharts = useCallback(async () => {
    if (!user || !canAccessCharts || !isSteelFactory) {
      setPageLoading(false);
      return;
    }
    setPageLoading(true);
    try {
      const [nextOverview, nextBatches, nextInvoices, nextDispatches] = await Promise.all([
        getSteelOverview(),
        listSteelBatches(60),
        listSteelInvoices(60),
        listSteelDispatches(60),
      ]);
      const batches = (nextBatches.items || []) as SteelBatch[];
      const invoices = (nextInvoices.items || []) as SteelInvoice[];
      const dispatches = (nextDispatches.items || []) as SteelDispatch[];

      setOverview(nextOverview);
      setBatchCount(batches.length);
      setInvoiceCount(invoices.length);
      setDispatchCount(dispatches.length);
      setDashboardData(
        buildSteelDashboardData({
          overview: nextOverview,
          batches,
          invoices,
          dispatches,
        }),
      );
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load steel charts.");
    } finally {
      setPageLoading(false);
    }
  }, [canAccessCharts, isSteelFactory, user]);

  useEffect(() => {
    void refreshCharts();
  }, [refreshCharts]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshCharts();
    } finally {
      setRefreshing(false);
    }
  };

  if (loading || pageLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-[var(--muted)]">
        Loading steel charts...
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Steel Charts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-red-400">{sessionError || "Login required."}</div>
            <Link href="/access">
              <Button>Open Login</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!canAccessCharts) {
    return (
      <main className="min-h-screen px-4 py-8 md:px-8">
        <div className="mx-auto max-w-4xl">
          <Card>
            <CardHeader>
              <CardTitle>Steel Charts access is role-based</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-[var(--muted)]">
              <div>
                Your current role is <span className="font-semibold text-[var(--text)]">{user.role}</span>.
              </div>
              <div>Supervisor, accountant, manager, admin, or owner access is required to open steel charts.</div>
              <Link href="/work-queue">
                <Button variant="outline">Open Work Queue</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  if (!isSteelFactory) {
    return (
      <main className="min-h-screen px-4 py-8 md:px-8">
        <div className="mx-auto max-w-4xl">
          <Card>
            <CardHeader>
              <CardTitle>Steel charts need a steel factory</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-[var(--muted)]">
              <div>
                Your active factory is <span className="font-semibold text-[var(--text)]">{activeFactory?.name || "not selected"}</span>.
              </div>
              <div>Switch into a steel factory from the sidebar, then reopen this chart board for live steel KPIs.</div>
              <div className="flex flex-wrap gap-3">
                <Link href="/settings">
                  <Button variant="outline">Open Settings</Button>
                </Link>
                <Link href="/analytics">
                  <Button variant="ghost">Open Analytics</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  const highRiskBatchCount = Number(overview?.anomaly_summary.high_batches || 0) + Number(overview?.anomaly_summary.critical_batches || 0);
  const confidenceTotal =
    Number(overview?.confidence_counts.green || 0) +
    Number(overview?.confidence_counts.yellow || 0) +
    Number(overview?.confidence_counts.red || 0);
  const greenConfidencePercent = confidenceTotal ? (Number(overview?.confidence_counts.green || 0) * 100) / confidenceTotal : 0;
  const watchConfidenceCount = Number(overview?.confidence_counts.yellow || 0);
  const criticalConfidenceCount = Number(overview?.confidence_counts.red || 0);
  const topRiskOperator = overview?.anomaly_summary.highest_risk_operator?.name || "No operator signal yet";
  const topLossDay = overview?.anomaly_summary.highest_loss_day?.date || "No loss date captured";
  const totalLeakageValue = overview?.anomaly_summary.total_estimated_leakage_value_inr;
  const chartRecordCoverage = batchCount + invoiceCount + dispatchCount;
  const outstandingInvoiceWeightKg = Number(overview?.profit_summary?.outstanding_invoice_weight_kg || 0);
  const topLowConfidenceItem = (overview?.low_confidence_items || [])
    .slice()
    .sort((left, right) => Math.abs(Number(right.last_variance_kg || 0)) - Math.abs(Number(left.last_variance_kg || 0)))[0];
  const topLossBatch = overview?.top_loss_batch || overview?.anomaly_batches?.[0] || null;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.14),transparent_32%),linear-gradient(180deg,#ecf4fa_0%,#f8fbfd_48%,#eef3f8_100%)] px-4 py-6 pb-24 text-slate-900 md:px-8 md:pb-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="rounded-[2rem] border border-slate-200 bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(239,248,255,0.92))] p-6 shadow-[0_22px_55px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-4xl">
              <div className="text-sm uppercase tracking-[0.28em] text-sky-700">Steel Charts</div>
              <h1 className="mt-2 text-2xl font-semibold text-slate-900 md:text-4xl">
                Chart workspace for stock trust, batch loss, dispatch, and revenue
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                Read the key steel signals first, jump into the right action lane, then use the chart board below for
                deeper pattern and drill-down work in {activeFactory?.name || "your factory"}.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600">
                  Factory {activeFactory?.name || "not selected"}
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600">
                  {chartRecordCoverage} recent records feeding charts
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600">
                  {overview?.financial_access ? "Financial view enabled" : "Financial view restricted"}
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600">
                  Highest loss day {topLossDay}
                </span>
              </div>
            </div>
            <div className="grid gap-3 sm:flex sm:flex-wrap">
              <Button variant="outline" className="w-full sm:w-auto" disabled={refreshing} onClick={() => void handleRefresh()}>
                {refreshing ? "Refreshing..." : "Refresh Charts"}
              </Button>
              <Link href="/steel">
                <Button variant="ghost" className="w-full sm:w-auto">Steel Hub</Button>
              </Link>
              <Link href="/reports">
                <Button variant="ghost" className="w-full sm:w-auto">Reports</Button>
              </Link>
            </div>
          </div>
        </section>

        {error || sessionError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error || sessionError}
          </div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="rounded-[1.6rem] border border-emerald-200 bg-[linear-gradient(180deg,#ffffff,#f4fbf6)] shadow-[0_14px_32px_rgba(15,23,42,0.05)]">
            <CardHeader>
              <div className="text-xs uppercase tracking-[0.18em] text-emerald-700">Signal</div>
              <CardTitle className="text-base text-slate-900">Stock trust</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-slate-600">
              <div className="text-3xl font-semibold text-slate-900">{formatPercent(greenConfidencePercent)}</div>
              <div className="text-xs">
                {confidenceTotal} tracked positions | Watch {watchConfidenceCount} | Critical {criticalConfidenceCount}
              </div>
              <Link href="/steel/reconciliations">
                <Button variant="outline" className="w-full sm:w-auto">Open Stock Review</Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="rounded-[1.6rem] border border-amber-200 bg-[linear-gradient(180deg,#ffffff,#fff8f1)] shadow-[0_14px_32px_rgba(15,23,42,0.05)]">
            <CardHeader>
              <div className="text-xs uppercase tracking-[0.18em] text-amber-700">Signal</div>
              <CardTitle className="text-base text-slate-900">Production risk</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-slate-600">
              <div className="text-3xl font-semibold text-slate-900">{highRiskBatchCount}</div>
              <div className="text-xs">
                Avg loss {formatPercent(overview?.batch_metrics.average_loss_percent)} across {Number(overview?.batch_metrics.total_batches || 0)} batches
              </div>
              <Link href="/steel?tab=risk">
                <Button variant="outline" className="w-full sm:w-auto">Open Risk Review</Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="rounded-[1.6rem] border border-sky-200 bg-[linear-gradient(180deg,#ffffff,#f3f9ff)] shadow-[0_14px_32px_rgba(15,23,42,0.05)]">
            <CardHeader>
              <div className="text-xs uppercase tracking-[0.18em] text-sky-700">Signal</div>
              <CardTitle className="text-base text-slate-900">Dispatch gap</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-slate-600">
              <div className="text-3xl font-semibold text-slate-900">{formatKg(outstandingInvoiceWeightKg)} KG</div>
              <div className="text-xs">
                {dispatchCount} recent dispatches with invoice closure and truck movement context.
              </div>
              <Link href="/steel/dispatches">
                <Button variant="outline" className="w-full sm:w-auto">Open Dispatch</Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="rounded-[1.6rem] border border-slate-200 bg-white shadow-[0_14px_32px_rgba(15,23,42,0.05)]">
            <CardHeader>
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Signal</div>
              <CardTitle className="text-base text-slate-900">Commercial snapshot</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-slate-600">
              <div className="text-3xl font-semibold text-slate-900">
                {overview?.financial_access ? formatCurrency(overview?.profit_summary?.realized_invoiced_amount_inr) : "Restricted"}
              </div>
              <div className="text-xs">
                {overview?.financial_access
                  ? `Estimated leakage exposure ${formatCurrency(totalLeakageValue)}`
                  : "Financial values stay hidden for your current role."}
              </div>
              <Link href="/steel/invoices">
                <Button variant="outline" className="w-full sm:w-auto">Open Invoices</Button>
              </Link>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <Card className="rounded-[1.6rem] border border-slate-200 bg-white shadow-[0_14px_32px_rgba(15,23,42,0.05)]">
            <CardHeader>
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Action Lane</div>
              <CardTitle className="text-xl text-slate-900">Resolve stock mismatch</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              {topLowConfidenceItem ? (
                <>
                  <div className="font-semibold text-slate-900">
                    {topLowConfidenceItem.item_code} - {topLowConfidenceItem.name}
                  </div>
                  <div>
                    {formatKg(topLowConfidenceItem.last_variance_kg)} KG variance | {formatPercent(topLowConfidenceItem.last_variance_percent)}
                  </div>
                  <div className="text-xs text-slate-500">
                    Use stock review first when physical and system quantities start drifting.
                  </div>
                  <Link href="/steel/reconciliations">
                    <Button variant="outline" className="w-full sm:w-auto">Open mismatch review</Button>
                  </Link>
                </>
              ) : (
                <div>No low-confidence stock item is flagged right now.</div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[1.6rem] border border-slate-200 bg-white shadow-[0_14px_32px_rgba(15,23,42,0.05)]">
            <CardHeader>
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Action Lane</div>
              <CardTitle className="text-xl text-slate-900">Trace batch loss</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              {topLossBatch ? (
                <>
                  <div className="font-semibold text-slate-900">{topLossBatch.batch_code}</div>
                  <div>
                    {formatKg(topLossBatch.variance_kg)} KG variance | {formatPercent(topLossBatch.variance_percent)}
                  </div>
                  <div className="text-xs text-slate-500">
                    Highest-risk operator signal: {topRiskOperator}
                  </div>
                  <div className="grid gap-2 sm:flex sm:flex-wrap">
                    <Link href={`/steel/batches/${topLossBatch.id}`}>
                      <Button variant="outline" className="w-full sm:w-auto">Open batch</Button>
                    </Link>
                    <Link href="/steel?tab=risk">
                      <Button variant="ghost" className="w-full sm:w-auto">Risk lane</Button>
                    </Link>
                  </div>
                </>
              ) : (
                <div>Batch loss drill-down appears once production data is available.</div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[1.6rem] border border-slate-200 bg-white shadow-[0_14px_32px_rgba(15,23,42,0.05)]">
            <CardHeader>
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Action Lane</div>
              <CardTitle className="text-xl text-slate-900">Close invoice-dispatch gap</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              <div className="font-semibold text-slate-900">{formatKg(outstandingInvoiceWeightKg)} KG pending</div>
              <div>
                {overview?.financial_access
                  ? `${formatCurrency(overview?.profit_summary?.outstanding_invoice_amount_inr)} still sitting between invoice and dispatch.`
                  : "Use this lane to move invoiced weight into actual dispatch and delivery."}
              </div>
              <div className="text-xs text-slate-500">
                Customer and invoice follow-through is strongest when the chart signal is matched with dispatch proof.
              </div>
              <div className="grid gap-2 sm:flex sm:flex-wrap">
                <Link href="/steel/invoices">
                  <Button variant="outline" className="w-full sm:w-auto">Open invoices</Button>
                </Link>
                <Link href="/steel/dispatches">
                  <Button variant="ghost" className="w-full sm:w-auto">Dispatch desk</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-sm uppercase tracking-[0.22em] text-slate-500">Interactive Board</div>
              <h2 className="mt-1 text-2xl font-semibold text-slate-900">Read signals, filter patterns, and drill into action</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                The chart workspace below is the main system. Use the cards above only as fast shortcuts, then stay in
                the charts for deeper decisions.
              </p>
            </div>
            <div className="grid gap-2 sm:flex sm:flex-wrap">
              <Link href="/steel/customers">
                <Button variant="outline" className="w-full sm:w-auto">Customer Ledger</Button>
              </Link>
              <Link href="/reports">
                <Button variant="ghost" className="w-full sm:w-auto">Reports</Button>
              </Link>
            </div>
          </div>

          {dashboardData ? (
            <IndustrialFactoryDashboard
              loading={refreshing}
              industryType="steel"
              dataByRange={dashboardData}
              initialRange="7d"
              embedded
            />
          ) : (
            <Card className="rounded-[1.6rem] border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
              <CardHeader>
                <div className="text-sm text-slate-500">Chart board</div>
                <CardTitle className="text-xl text-slate-900">Chart data is not available yet</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-600">
                <div>We could not build the steel chart board from live data in this session.</div>
                <div>Check factory access, steel records, or API connectivity, then refresh again.</div>
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </main>
  );
}
