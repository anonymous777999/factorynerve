"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ApiError } from "@/lib/api";
import { getManagerAnalytics, getMonthlyAnalytics, getTrendAnalytics, getWeeklyAnalytics, type ManagerAnalytics, type MonthlyAnalytics, type TrendsAnalytics, type WeeklyAnalyticsPoint } from "@/lib/analytics";
import { getUsageSummary, type UsageSummary } from "@/lib/settings";
import { useSession } from "@/lib/use-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const AUTO_REFRESH_MS = 45_000;

function formatDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AnalyticsPage() {
  const { user, loading, error: sessionError } = useSession();
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [weekly, setWeekly] = useState<WeeklyAnalyticsPoint[]>([]);
  const [monthly, setMonthly] = useState<MonthlyAnalytics | null>(null);
  const [trends, setTrends] = useState<TrendsAnalytics | null>(null);
  const [manager, setManager] = useState<ManagerAnalytics | null>(null);
  const [locked, setLocked] = useState<string>("");
  const [error, setError] = useState("");
  const [pageLoading, setPageLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const hasLoadedOnceRef = useRef(false);
  const refreshInFlightRef = useRef(false);
  const refreshQueuedRef = useRef(false);
  const userId = user?.id ?? null;
  const userRole = user?.role ?? null;

  const canView = Boolean(userId && userRole !== "operator" && userRole !== "accountant" && userRole !== "attendance");

  const performLoadAnalytics = useCallback(async (options?: { background?: boolean }) => {
    if (!userId || !canView) {
      setPageLoading(false);
      return;
    }
    const shouldBackground = Boolean(options?.background) && hasLoadedOnceRef.current;
    if (shouldBackground) {
      setRefreshing(true);
    } else {
      setPageLoading(true);
    }
    setError("");
    try {
      const results = await Promise.allSettled([
        getUsageSummary(),
        getWeeklyAnalytics(),
        getMonthlyAnalytics(),
        getTrendAnalytics(),
        userRole === "manager" ? getManagerAnalytics() : Promise.resolve(null),
      ]);
      const [usageResult, weeklyResult, monthlyResult, trendResult, managerResult] = results;

      if (usageResult.status === "fulfilled") {
        setUsage(usageResult.value);
      } else if (usageResult.reason instanceof Error) {
        setError(usageResult.reason.message);
      }

      if (weeklyResult.status === "fulfilled") {
        setWeekly(weeklyResult.value);
        setLocked("");
      } else if (weeklyResult.reason instanceof ApiError && weeklyResult.reason.status === 402) {
        setWeekly([]);
        setLocked(weeklyResult.reason.message);
      } else if (weeklyResult.reason instanceof Error) {
        setError(weeklyResult.reason.message);
      }

      if (monthlyResult.status === "fulfilled") {
        setMonthly(monthlyResult.value);
      }
      if (trendResult.status === "fulfilled") {
        setTrends(trendResult.value);
      }
      if (managerResult.status === "fulfilled") {
        setManager(managerResult.value);
      }
    } finally {
      setLastUpdatedAt(new Date().toISOString());
      hasLoadedOnceRef.current = true;
      setHasLoadedOnce(true);
      setPageLoading(false);
      setRefreshing(false);
    }
  }, [canView, userId, userRole]);

  const loadAnalytics = useCallback(async (options?: { background?: boolean }) => {
    if (!userId || !canView) {
      setPageLoading(false);
      return;
    }
    if (refreshInFlightRef.current) {
      refreshQueuedRef.current = true;
      return;
    }

    refreshInFlightRef.current = true;
    let nextOptions = options;
    try {
      do {
        refreshQueuedRef.current = false;
        await performLoadAnalytics(nextOptions);
        nextOptions = { background: true };
      } while (refreshQueuedRef.current && (typeof document === "undefined" || !document.hidden));
    } finally {
      refreshInFlightRef.current = false;
    }
  }, [canView, performLoadAnalytics, userId]);

  useEffect(() => {
    setError("");
    setLocked("");
    setLastUpdatedAt(null);
    hasLoadedOnceRef.current = false;
    refreshInFlightRef.current = false;
    refreshQueuedRef.current = false;
    setHasLoadedOnce(false);
    if (!userId || !canView) {
      setPageLoading(false);
      return;
    }
    setPageLoading(true);
    void loadAnalytics();
  }, [canView, loadAnalytics, userId]);

  useEffect(() => {
    if (!userId || !canView) return;
    const refresh = () => {
      if (!document.hidden) {
        void loadAnalytics({ background: true });
      }
    };
    const timer = window.setInterval(refresh, AUTO_REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [canView, loadAnalytics, userId]);

  const weeklyAverage = useMemo(() => {
    if (!weekly.length) return 0;
    return weekly.reduce((sum, point) => sum + point.production_percent, 0) / weekly.length;
  }, [weekly]);

  if (loading || (pageLoading && canView && !hasLoadedOnce)) {
    return (
      <main className="min-h-screen px-4 py-8 md:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <Skeleton className="h-36 rounded-[2rem]" />
          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-32 rounded-2xl" />
            ))}
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <Skeleton className="h-[24rem] rounded-2xl" />
            <Skeleton className="h-[24rem] rounded-2xl" />
          </div>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Analytics</CardTitle>
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

  if (!canView) {
    return (
      <main className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Analytics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-[var(--muted)]">Analytics are available to supervisors, managers, admins, and owners.</div>
            <div className="flex gap-3">
              <Link href="/reports">
                <Button variant="outline">Open Reports</Button>
              </Link>
              <Link href="/dashboard">
                <Button>Back to Dashboard</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-6 pb-24 md:px-8 md:pb-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="flex flex-col gap-4 rounded-[1.9rem] border border-[var(--border)] bg-[rgba(20,24,36,0.88)] p-5 shadow-2xl backdrop-blur sm:p-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-sm uppercase tracking-[0.28em] text-[var(--accent)]">Analytics</div>
            <h1 className="mt-2 text-3xl font-semibold">Performance insights</h1>
            <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
              Weekly production, monthly summary, trend diagnostics, and manager-level insights using the existing FastAPI analytics endpoints.
            </p>
          </div>
          <div className="grid gap-3">
            <div className="grid gap-3 sm:flex sm:flex-wrap">
              <Link href="/dashboard" className="w-full sm:w-auto">
                <Button variant="outline" className="w-full sm:w-auto">Dashboard</Button>
              </Link>
              <Link href="/reports" className="w-full sm:w-auto">
                <Button className="w-full sm:w-auto">Open Reports</Button>
              </Link>
            </div>
            <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center">
              <Button
                variant="outline"
                className="w-full px-4 py-2 text-xs sm:w-auto"
                onClick={() => {
                  void loadAnalytics({ background: true });
                }}
                disabled={refreshing}
              >
                {refreshing ? "Refreshing..." : "Refresh Analytics"}
              </Button>
              <span className="text-xs text-[var(--muted)]">
                {refreshing
                  ? "Updating analytics cards..."
                  : lastUpdatedAt
                    ? `Updated ${formatDateTime(lastUpdatedAt)}`
                    : "Live updates every 45 seconds"}
              </span>
            </div>
          </div>
        </section>

        {refreshing ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] px-4 py-3 text-sm text-[var(--muted)]">
            Refreshing analytics in the background...
          </div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Card>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">Plan</div>
              <CardTitle>{usage?.plan || "-"}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-[var(--muted)]">Current analytics access is controlled by your org plan.</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">Weekly Average</div>
              <CardTitle>{weeklyAverage.toFixed(1)}%</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-[var(--muted)]">Average production percentage across returned weekly points.</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">Trend</div>
              <CardTitle>{trends?.production_trend || "stable"}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-[var(--muted)]">Peak shift: {trends?.peak_performance_shift || "-"}</CardContent>
          </Card>
        </section>

        {locked ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Plan Gate</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-[var(--muted)]">{locked}</CardContent>
          </Card>
        ) : null}

        <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Weekly Production</CardTitle>
            </CardHeader>
            <CardContent>
              {weekly.length ? (
                <>
                  <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 md:hidden">
                    {weekly.map((point) => (
                      <div key={`mobile:${point.date}`} className="min-w-[9rem] rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                        <div className="text-xs text-[var(--muted)]">{formatDate(point.date)}</div>
                        <div className="mt-2 text-lg font-semibold">{point.production_percent.toFixed(0)}%</div>
                        <div className="mt-1 text-xs text-[var(--muted)]">{point.units} units</div>
                        <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--border)]">
                          <div
                            className="h-full rounded-full bg-[linear-gradient(90deg,#3ea6ff,#2dd4bf)]"
                            style={{ width: `${Math.max(8, Math.min(100, point.production_percent))}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="hidden grid-cols-7 gap-3 md:grid">
                    {weekly.map((point) => (
                      <div key={point.date} className="space-y-2 text-center">
                        <div className="flex h-40 items-end justify-center rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-3">
                          <div
                            className="w-full rounded-full bg-[linear-gradient(180deg,#3ea6ff,#2dd4bf)]"
                            style={{ height: `${Math.max(8, Math.min(100, point.production_percent))}%` }}
                          />
                        </div>
                        <div className="text-xs text-[var(--muted)]">{formatDate(point.date)}</div>
                        <div className="text-sm font-semibold">{point.production_percent.toFixed(0)}%</div>
                        <div className="text-xs text-[var(--muted)]">{point.units} units</div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
                  No weekly analytics data available.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Monthly Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {monthly ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                      <div className="text-sm text-[var(--muted)]">Best Day</div>
                      <div className="mt-1 text-lg font-semibold">{monthly.best_day ? `${formatDate(monthly.best_day.date)} - ${monthly.best_day.performance.toFixed(1)}%` : "-"}</div>
                    </div>
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                      <div className="text-sm text-[var(--muted)]">Worst Day</div>
                      <div className="mt-1 text-lg font-semibold">{monthly.worst_day ? `${formatDate(monthly.worst_day.date)} - ${monthly.worst_day.performance.toFixed(1)}%` : "-"}</div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                    <div className="text-sm text-[var(--muted)]">Average Performance</div>
                    <div className="mt-1 text-2xl font-semibold">{monthly.average.toFixed(1)}%</div>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
                  Monthly analytics data unavailable.
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Trend Diagnostics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {trends ? (
                <>
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                    <div className="text-[var(--muted)]">Production Trend</div>
                    <div className="mt-1 text-lg font-semibold">{trends.production_trend}</div>
                  </div>
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                    <div className="text-[var(--muted)]">Common Issues</div>
                    <div className="mt-1">Downtime: {trends.common_issues.downtime}</div>
                    <div>Quality: {trends.common_issues.quality}</div>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-[var(--muted)]">
                  Trend diagnostics are unavailable for this account or plan.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Manager Insights</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {manager ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                      <div className="text-[var(--muted)]">Total Units</div>
                      <div className="mt-1 text-xl font-semibold">{manager.totals.total_units}</div>
                    </div>
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                      <div className="text-[var(--muted)]">Average Performance</div>
                      <div className="mt-1 text-xl font-semibold">{manager.totals.average_performance.toFixed(1)}%</div>
                    </div>
                  </div>
                  <div className="space-y-3 md:hidden">
                    {manager.supervisor_summary.map((row) => (
                      <div key={`mobile:${row.name}`} className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                        <div className="text-sm font-semibold">{row.name}</div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div>
                            <div className="text-xs text-[var(--muted)]">Production</div>
                            <div className="mt-1 text-sm font-semibold">{row.production_percent.toFixed(1)}%</div>
                          </div>
                          <div>
                            <div className="text-xs text-[var(--muted)]">Downtime</div>
                            <div className="mt-1 text-sm font-semibold">{row.downtime_minutes} min</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="hidden overflow-x-auto md:block">
                    <table className="min-w-full text-left text-sm">
                      <thead className="text-[var(--muted)]">
                        <tr className="border-b border-[var(--border)]">
                          <th className="px-3 py-3 font-medium">Supervisor</th>
                          <th className="px-3 py-3 font-medium">Production %</th>
                          <th className="px-3 py-3 font-medium">Downtime</th>
                        </tr>
                      </thead>
                      <tbody>
                        {manager.supervisor_summary.map((row) => (
                          <tr key={row.name} className="border-b border-[var(--border)]/60">
                            <td className="px-3 py-3">{row.name}</td>
                            <td className="px-3 py-3">{row.production_percent.toFixed(1)}%</td>
                            <td className="px-3 py-3">{row.downtime_minutes} min</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-[var(--muted)]">
                  Manager insights appear for manager accounts using the dedicated backend endpoint.
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {error || sessionError ? <div className="text-sm text-red-400">{error || sessionError}</div> : null}
      </div>
    </main>
  );
}
