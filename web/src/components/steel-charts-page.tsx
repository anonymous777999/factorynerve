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

  const topLossDay = overview?.anomaly_summary.highest_loss_day?.date || "No loss date captured";
  const chartRecordCoverage = batchCount + invoiceCount + dispatchCount;

  return (
    <main className="min-h-screen bg-surface-app px-4 py-8 text-text-primary md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[2rem] border border-border-subtle bg-surface-panel p-6 shadow-[var(--shadow-sm)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-4xl">
              <div className="text-sm uppercase tracking-[0.28em] text-text-tertiary">Steel Charts</div>
              <h1 className="mt-2 text-2xl font-semibold text-text-primary md:text-4xl">
                Track steel trends without leaving the chart board
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-text-secondary">
                Use the chart board below to compare ranges, trace drift, and investigate over-time patterns in {activeFactory?.name || "your factory"}.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-surface-card px-3 py-1 text-text-secondary">
                  Factory {activeFactory?.name || "not selected"}
                </span>
                <span className="rounded-full bg-surface-card px-3 py-1 text-text-secondary">
                  {chartRecordCoverage} recent records feeding charts
                </span>
                <span className="rounded-full bg-surface-card px-3 py-1 text-text-secondary">
                  {overview?.financial_access ? "Financial view enabled" : "Financial view restricted"}
                </span>
                <span className="rounded-full bg-surface-card px-3 py-1 text-text-secondary">
                  Highest loss day {topLossDay}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="primary" disabled={refreshing} onClick={() => void handleRefresh()}>
                {refreshing ? "Refreshing..." : "Refresh"}
              </Button>
              <Link href="/steel">
                <Button variant="ghost">
                  Open steel hub
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {error || sessionError ? (
          <div className="rounded-2xl border border-status-danger-border bg-status-danger-bg px-4 py-3 text-sm text-status-danger-fg">
            {error || sessionError}
          </div>
        ) : null}

        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-sm uppercase tracking-[0.22em] text-text-tertiary">Interactive Board</div>
              <h2 className="mt-1 text-2xl font-semibold text-text-primary">Read trends, filter patterns, and investigate drift</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">
                The chart workspace below is the primary analytical surface. Stay here to compare ranges, isolate drift,
                and drill into the historical context behind steel performance.
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
              showOperationalKpis={false}
              showDecisionPrompts={false}
            />
          ) : (
            <Card className="rounded-[1.6rem] bg-surface-card shadow-[var(--shadow-xs)]">
              <CardHeader>
                <div className="text-sm text-text-tertiary">Chart board</div>
                <CardTitle className="text-xl text-text-primary">Chart data is not available yet</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-text-secondary">
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
