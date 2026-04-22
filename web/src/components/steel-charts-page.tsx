"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { IndustrialFactoryDashboard } from "@/components/dashboard/industrial-factory-dashboard";
import { KPIBox } from "@/components/dashboard/kpi-box";
import { SteelQuickActionRow, SteelStatusStrip, SteelTopPriorityCard } from "@/components/steel-summary-primitives";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildSteelDashboardData, type IndustrialDashboardData } from "@/lib/industrial-dashboard";
import { deriveDataConfidence, deriveOverallStatusSummary, deriveSteelTopPriority } from "@/lib/steel-decision";
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
            <div className="text-sm text-red-400">{sessionError || "Please sign in to continue."}</div>
            <Link href="/access">
              <Button>Open Access</Button>
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

  const topRiskOperator = overview?.anomaly_summary.highest_risk_operator?.name || "No operator signal yet";
  const topLossDay = overview?.anomaly_summary.highest_loss_day?.date || "No loss date captured";
  const chartRecordCoverage = batchCount + invoiceCount + dispatchCount;
  const outstandingInvoiceWeightKg = Number(overview?.profit_summary?.outstanding_invoice_weight_kg || 0);
  const topLowConfidenceItem = (overview?.low_confidence_items || [])
    .slice()
    .sort((left, right) => Math.abs(Number(right.last_variance_kg || 0)) - Math.abs(Number(left.last_variance_kg || 0)))[0];
  const topLossBatch = overview?.top_loss_batch || overview?.anomaly_batches?.[0] || null;
  const chartRange = dashboardData?.["7d"] || dashboardData?.today || dashboardData?.["30d"];
  const hasLiveDashboard = Boolean(overview && dashboardData);
  const overallStatus = deriveOverallStatusSummary({ overview, chartRecordCoverage, hasLiveDashboard });
  const confidenceSummary = deriveDataConfidence({ overview, chartRecordCoverage, hasLiveDashboard });
  const topPriority = deriveSteelTopPriority(overview);
  const criticalKpis = chartRange
    ? [chartRange.kpis.todayLoss, chartRange.kpis.totalStock, chartRange.kpis.todayRevenue]
    : [];
  const quickActions = [
    topPriority.primaryAction,
    ...(topPriority.secondaryAction ? [topPriority.secondaryAction] : []),
    { href: "/steel/dispatches", label: "Dispatches", variant: "secondary" as const },
    { href: "/steel/invoices", label: "Invoices", variant: "secondary" as const },
  ];

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#fafaf9_0%,#f5f5f4_52%,#fafaf9_100%)] px-4 py-8 text-[#111111] md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[2rem] border border-[#e7e5e4] bg-[linear-gradient(135deg,#ffffff,#fafaf9)] p-6 shadow-[0_22px_55px_rgba(15,23,42,0.08)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-4xl">
              <div className="text-sm uppercase tracking-[0.28em] text-[#78716c]">Steel Charts</div>
              <h1 className="mt-2 text-2xl font-semibold text-[#111111] md:text-4xl">
                Read steel signals without leaving the chart board
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#57534e]">
                Start with the key signal cards, then stay in the chart board below for the deeper operational read in {activeFactory?.name || "your factory"}.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-[#e7e5e4] bg-white px-3 py-1 text-[#57534e]">
                  Factory {activeFactory?.name || "not selected"}
                </span>
                <span className="rounded-full border border-[#e7e5e4] bg-white px-3 py-1 text-[#57534e]">
                  {chartRecordCoverage} recent records feeding charts
                </span>
                <span className="rounded-full border border-[#e7e5e4] bg-white px-3 py-1 text-[#57534e]">
                  {overview?.financial_access ? "Financial view enabled" : "Financial view restricted"}
                </span>
                <span className="rounded-full border border-[#e7e5e4] bg-white px-3 py-1 text-[#57534e]">
                  Highest loss day {topLossDay}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                className="!border-[#111111] !bg-[#111111] !text-white hover:!border-[#2f2f2f] hover:!bg-[#2f2f2f]"
                disabled={refreshing}
                onClick={() => void handleRefresh()}
              >
                {refreshing ? "Refreshing..." : "Refresh"}
              </Button>
              <details className="group w-full min-w-0 rounded-3xl border border-[#e7e5e4] bg-white sm:w-auto sm:min-w-[220px]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-[#111111]">
                  Chart tools
                  <span className="text-xs text-[#78716c] transition group-open:hidden">Open</span>
                  <span className="hidden text-xs text-[#78716c] group-open:inline">Hide</span>
                </summary>
                <div className="flex flex-wrap gap-3 border-t border-[#f5f5f4] px-4 py-4">
                  <Link href="/steel">
                    <Button variant="ghost" className="!border-[#d6d3d1] !bg-[#f5f5f4] !text-[#111111] hover:!border-[#a8a29e] hover:!bg-[#e7e5e4]">Steel hub</Button>
                  </Link>
                  <Link href="/reports">
                    <Button variant="ghost" className="!border-[#d6d3d1] !bg-[#f5f5f4] !text-[#111111] hover:!border-[#a8a29e] hover:!bg-[#e7e5e4]">Reports</Button>
                  </Link>
                  <Link href="/steel/customers">
                    <Button variant="ghost" className="!border-[#d6d3d1] !bg-[#f5f5f4] !text-[#111111] hover:!border-[#a8a29e] hover:!bg-[#e7e5e4]">Customers</Button>
                  </Link>
                </div>
              </details>
            </div>
          </div>
        </section>

        <SteelStatusStrip
          overallStatus={overallStatus}
          topPriority={topPriority}
          confidence={confidenceSummary}
          timeContext={chartRange?.rangeComparisonLabel || "vs previous 7 days"}
        />

        <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <SteelTopPriorityCard priority={topPriority} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {criticalKpis.map((kpi) => (
              <KPIBox key={kpi.label} {...kpi} />
            ))}
          </div>
        </section>

        <section className="rounded-[1.7rem] border border-[#e7e5e4] bg-white p-5 shadow-[0_16px_36px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.22em] text-[#78716c]">Quick Actions</div>
              <h2 className="mt-2 text-2xl font-semibold text-[#111111]">Move from insight to action without losing context</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#57534e]">
                What is happening: the board is highlighting the strongest risk and KPI signals first. Is it good or bad: check the status badge and comparison row. What should you do next: use the nearest workflow action below.
              </p>
            </div>
            <SteelQuickActionRow actions={quickActions} />
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <Card className="rounded-[1.6rem] !border-[#e7e5e4] !bg-white shadow-[0_14px_32px_rgba(15,23,42,0.05)]">
            <CardHeader>
              <div className="text-xs uppercase tracking-[0.18em] text-[#78716c]">Action Lane</div>
              <CardTitle className="text-xl text-[#111111]">Resolve stock mismatch</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-[#57534e]">
              {topLowConfidenceItem ? (
                <>
                  <div className="rounded-full border border-[#fed7aa] bg-[#fff7ed] px-3 py-1 text-xs font-semibold text-[#9a3412]">
                    {topLowConfidenceItem.confidence_status === "red" ? "Critical" : "Watch"}
                  </div>
                  <div className="font-semibold text-[#111111]">
                    {topLowConfidenceItem.item_code} - {topLowConfidenceItem.name}
                  </div>
                  <div>
                    {formatKg(topLowConfidenceItem.last_variance_kg)} KG variance | {formatPercent(topLowConfidenceItem.last_variance_percent)}
                  </div>
                  <div className="text-xs text-[#78716c]">
                    What should you do next: use stock review first when physical and system quantities start drifting.
                  </div>
                  <Link href="/steel/reconciliations">
                    <Button variant="outline" className="!border-[#111111] !bg-[#111111] !text-white hover:!border-[#2f2f2f] hover:!bg-[#2f2f2f]">Review</Button>
                  </Link>
                </>
              ) : (
                <div>No low-confidence stock item is flagged right now. Add stock counts to keep confidence high.</div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[1.6rem] !border-[#e7e5e4] !bg-white shadow-[0_14px_32px_rgba(15,23,42,0.05)]">
            <CardHeader>
              <div className="text-xs uppercase tracking-[0.18em] text-[#78716c]">Action Lane</div>
              <CardTitle className="text-xl text-[#111111]">Trace batch loss</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-[#57534e]">
              {topLossBatch ? (
                <>
                  <div className="rounded-full border border-[#fecaca] bg-[#fff7f7] px-3 py-1 text-xs font-semibold text-[#991b1b]">
                    {topLossBatch.severity === "critical" ? "Critical" : "Watch"}
                  </div>
                  <div className="font-semibold text-[#111111]">{topLossBatch.batch_code}</div>
                  <div>
                    {formatKg(topLossBatch.variance_kg)} KG variance | {formatPercent(topLossBatch.variance_percent)}
                  </div>
                  <div className="text-xs text-[#78716c]">
                    What should you do next: Highest-risk operator signal is {topRiskOperator}. Trace the batch before the next run closes.
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/steel/batches/${topLossBatch.id}`}>
                      <Button variant="outline" className="!border-[#111111] !bg-[#111111] !text-white hover:!border-[#2f2f2f] hover:!bg-[#2f2f2f]">Batch</Button>
                    </Link>
                    <Link href="/steel?tab=risk">
                      <Button variant="ghost" className="!border-[#d6d3d1] !bg-[#f5f5f4] !text-[#111111] hover:!border-[#a8a29e] hover:!bg-[#e7e5e4]">Risk lane</Button>
                    </Link>
                  </div>
                </>
              ) : (
                <div>Batch loss drill-down appears once production data is available. Record the first batch to activate this review lane.</div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[1.6rem] !border-[#e7e5e4] !bg-white shadow-[0_14px_32px_rgba(15,23,42,0.05)]">
            <CardHeader>
              <div className="text-xs uppercase tracking-[0.18em] text-[#78716c]">Action Lane</div>
              <CardTitle className="text-xl text-[#111111]">Close invoice-dispatch gap</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-[#57534e]">
              <div className="rounded-full border border-[#d6d3d1] bg-[#f5f5f4] px-3 py-1 text-xs font-semibold text-[#111111]">
                {outstandingInvoiceWeightKg > 0 ? "Watch" : "Stable"}
              </div>
              <div className="font-semibold text-[#111111]">{formatKg(outstandingInvoiceWeightKg)} KG pending</div>
              <div>
                {overview?.financial_access
                  ? `${formatCurrency(overview?.profit_summary?.outstanding_invoice_amount_inr)} still sitting between invoice and dispatch.`
                  : "Use this lane to move invoiced weight into actual dispatch and delivery."}
              </div>
              <div className="text-xs text-[#78716c]">
                What should you do next: match the chart signal with dispatch proof so revenue and movement stay aligned.
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/steel/invoices">
                  <Button variant="outline" className="!border-[#111111] !bg-[#111111] !text-white hover:!border-[#2f2f2f] hover:!bg-[#2f2f2f]">Invoices</Button>
                </Link>
                <Link href="/steel/dispatches">
                  <Button variant="ghost" className="!border-[#d6d3d1] !bg-[#f5f5f4] !text-[#111111] hover:!border-[#a8a29e] hover:!bg-[#e7e5e4]">Dispatches</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </section>

        {error || sessionError ? (
          <div className="rounded-2xl border border-[#fecaca] bg-[#fff7f7] px-4 py-3 text-sm text-[#991b1b]">
            {error || sessionError}
          </div>
        ) : null}

        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-sm uppercase tracking-[0.22em] text-[#78716c]">Interactive Board</div>
              <h2 className="mt-1 text-2xl font-semibold text-[#111111]">Read signals, filter patterns, and drill into action</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#57534e]">
                The chart workspace below is the main system. Use the cards above only as fast shortcuts, then stay in
                the charts for deeper decisions.
              </p>
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
            <Card className="rounded-[1.6rem] !border-[#e7e5e4] !bg-white shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
              <CardHeader>
                <div className="text-sm text-[#78716c]">Chart board</div>
                <CardTitle className="text-xl text-[#111111]">Chart data is not available yet</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-[#57534e]">
                <div>We could not build the steel chart board from live data in this session.</div>
                <div>Data confidence is low. Check factory access, steel records, or API connectivity, then refresh again.</div>
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </main>
  );
}
