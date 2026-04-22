"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveScrollArea } from "@/components/ui/responsive-scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import {
  getManagerAnalytics,
  getMonthlyAnalytics,
  getTrendAnalytics,
  getWeeklyAnalytics,
  type ManagerAnalytics,
  type MonthlyAnalytics,
  type TrendsAnalytics,
  type WeeklyAnalyticsPoint,
} from "@/lib/analytics";
import { useI18n, useI18nNamespaces } from "@/lib/i18n";
import { getUsageSummary, type UsageSummary } from "@/lib/settings";
import { useSession } from "@/lib/use-session";

const AUTO_REFRESH_MS = 45_000;

function formatDate(value: string, locale = "en-IN") {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(locale, { day: "2-digit", month: "short" });
}

function formatDateTime(value?: string | null, locale = "en-IN") {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(locale, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AnalyticsPage() {
  const { locale, t } = useI18n();
  useI18nNamespaces(["common", "analytics"]);

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
            <CardTitle>{t("analytics.title", "Analytics")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-red-400">{sessionError || t("analytics.sign_in_required", "Please sign in to continue.")}</div>
            <Link href="/access">
              <Button>{t("dashboard.action.open_login", "Open Access")}</Button>
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
            <CardTitle>{t("analytics.title", "Analytics")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-[var(--muted)]">{t("analytics.role_restricted", "Analytics are available to supervisors, managers, admins, and owners.")}</div>
            <div className="flex gap-3">
              <Link href="/reports">
                <Button variant="outline">{t("dashboard.action.open_reports", "Open Reports")}</Button>
              </Link>
              <Link href="/dashboard">
                <Button>{t("common.back", "Back")} {t("navigation.nav.today_board.label", "Dashboard")}</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8 md:px-8" data-component="analytics-page">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="flex flex-wrap items-start justify-between gap-4 rounded-[2rem] border border-[var(--border)] bg-[rgba(20,24,36,0.88)] p-6 shadow-2xl backdrop-blur">
          <div>
            <div className="text-sm uppercase tracking-[0.28em] text-[var(--accent)]">{t("analytics.title", "Analytics")}</div>
            <h1 className="mt-2 text-3xl font-semibold">{t("analytics.hero.title", "Performance insights")}</h1>
            <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">{t("analytics.hero.subtitle", "Start with this week, then compare monthly and trend signals.")}</p>
          </div>
          <details className="w-full min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] px-4 py-4 sm:w-auto sm:min-w-[240px]">
            <summary className="cursor-pointer list-none text-sm font-semibold text-[var(--text)]">{t("analytics.tools.title", "Analytics tools")}</summary>
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap gap-3">
                <Link href="/reports">
                  <Button>{t("ai.actions.reports", "Reports")}</Button>
                </Link>
                <Link href="/dashboard">
                  <Button variant="outline">{t("navigation.nav.today_board.label", "Dashboard")}</Button>
                </Link>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  className="px-4 py-2 text-xs"
                  onClick={() => {
                    void loadAnalytics({ background: true });
                  }}
                  disabled={refreshing}
                >
                  {refreshing ? t("analytics.tools.refreshing", "Refreshing...") : t("common.refresh", "Refresh")}
                </Button>
                <span className="text-xs text-[var(--muted)]">
                  {refreshing
                    ? t("analytics.tools.updating", "Updating analytics...")
                    : lastUpdatedAt
                      ? t("analytics.tools.updated", "Updated {{value}}", { value: formatDateTime(lastUpdatedAt, locale) })
                      : t("analytics.tools.live_updates", "Live updates every 45 seconds")}
                </span>
              </div>
            </div>
          </details>
        </section>

        <section className="grid gap-3 xl:grid-cols-3">
          {[
            {
              label: t("analytics.steps.review_week", "1. Review week"),
              detail: weekly.length
                ? t("analytics.steps.review_week_ready", "{{count}} recent production points are ready.", { count: weekly.length })
                : t("analytics.steps.review_week_empty", "Weekly production will appear here first."),
            },
            {
              label: t("analytics.steps.compare_month", "2. Compare month"),
              detail: monthly
                ? t("analytics.steps.compare_month_ready", "Monthly average is {{average}}%.", { average: monthly.average.toFixed(1) })
                : t("analytics.steps.compare_month_empty", "Monthly summary follows the weekly read."),
            },
            {
              label: t("analytics.steps.check_trends", "3. Check trends"),
              detail: trends
                ? t("analytics.steps.check_trends_ready", "Trend is {{value}}.", { value: trends.production_trend })
                : t("analytics.steps.check_trends_empty", "Diagnostics appear after the core production story."),
            },
          ].map((step) => (
            <div key={step.label} className="rounded-3xl border border-[var(--border)] bg-[var(--card-strong)] px-5 py-4">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">{step.label}</div>
              <div className="mt-2 text-sm text-[var(--muted)]">{step.detail}</div>
            </div>
          ))}
        </section>

        {refreshing ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] px-4 py-3 text-sm text-[var(--muted)]">
            {t("analytics.refreshing_background", "Refreshing analytics in the background...")}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">{t("analytics.cards.plan", "Plan")}</div>
              <CardTitle>{usage?.plan || "-"}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-[var(--muted)]">{t("analytics.cards.plan_detail", "Current analytics access is controlled by your org plan.")}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">{t("analytics.cards.weekly_average", "Weekly Average")}</div>
              <CardTitle>{weeklyAverage.toFixed(1)}%</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-[var(--muted)]">{t("analytics.cards.weekly_average_detail", "Average production percentage across returned weekly points.")}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">{t("analytics.cards.trend", "Trend")}</div>
              <CardTitle>{trends?.production_trend || "stable"}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-[var(--muted)]">{t("analytics.cards.peak_shift", "Peak shift: {{value}}", { value: trends?.peak_performance_shift || "-" })}</CardContent>
          </Card>
        </section>

        {locked ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">{t("analytics.locked.title", "Plan Gate")}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-[var(--muted)]">{locked}</CardContent>
          </Card>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">{t("analytics.weekly.title", "Weekly Production")}</CardTitle>
            </CardHeader>
            <CardContent>
              {weekly.length ? (
                <>
                  <div className="space-y-3 md:hidden">
                    {weekly.map((point) => (
                      <div key={point.date} className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-[var(--text)]">{formatDate(point.date, locale)}</div>
                          <div className="text-sm font-semibold text-[var(--text)]">{point.production_percent.toFixed(0)}%</div>
                        </div>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-[linear-gradient(90deg,#3ea6ff,#2dd4bf)]"
                            style={{ width: `${Math.max(8, Math.min(100, point.production_percent))}%` }}
                          />
                        </div>
                        <div className="mt-3 text-xs text-[var(--muted)]">{t("analytics.weekly.units", "{{count}} units", { count: point.units })}</div>
                      </div>
                    ))}
                  </div>
                  <div className="hidden gap-3 md:grid md:grid-cols-7">
                    {weekly.map((point) => (
                      <div key={point.date} className="space-y-2 text-center">
                        <div className="flex h-40 items-end justify-center rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-3">
                          <div
                            className="w-full rounded-full bg-[linear-gradient(180deg,#3ea6ff,#2dd4bf)]"
                            style={{ height: `${Math.max(8, Math.min(100, point.production_percent))}%` }}
                          />
                        </div>
                        <div className="text-xs text-[var(--muted)]">{formatDate(point.date, locale)}</div>
                        <div className="text-sm font-semibold">{point.production_percent.toFixed(0)}%</div>
                        <div className="text-xs text-[var(--muted)]">{t("analytics.weekly.units", "{{count}} units", { count: point.units })}</div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
                  {t("analytics.weekly.empty", "No weekly analytics data available.")}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">{t("analytics.monthly.title", "Monthly Summary")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {monthly ? (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                      <div className="text-sm text-[var(--muted)]">{t("analytics.monthly.best_day", "Best Day")}</div>
                      <div className="mt-1 text-lg font-semibold">{monthly.best_day ? `${formatDate(monthly.best_day.date, locale)} - ${monthly.best_day.performance.toFixed(1)}%` : "-"}</div>
                    </div>
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                      <div className="text-sm text-[var(--muted)]">{t("analytics.monthly.worst_day", "Worst Day")}</div>
                      <div className="mt-1 text-lg font-semibold">{monthly.worst_day ? `${formatDate(monthly.worst_day.date, locale)} - ${monthly.worst_day.performance.toFixed(1)}%` : "-"}</div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                    <div className="text-sm text-[var(--muted)]">{t("analytics.monthly.average", "Average Performance")}</div>
                    <div className="mt-1 text-2xl font-semibold">{monthly.average.toFixed(1)}%</div>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
                  {t("analytics.monthly.empty", "Monthly analytics data unavailable.")}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4">
          <details className="rounded-3xl border border-[var(--border)] bg-[rgba(20,24,36,0.88)] px-5 py-5">
            <summary className="cursor-pointer list-none text-lg font-semibold text-[var(--text)]">{t("analytics.diagnostics.title", "Trend diagnostics")}</summary>
            <div className="mt-4 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">{t("analytics.diagnostics.card_title", "Trend Diagnostics")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  {trends ? (
                    <>
                      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                        <div className="text-[var(--muted)]">{t("analytics.diagnostics.production_trend", "Production Trend")}</div>
                        <div className="mt-1 text-lg font-semibold">{trends.production_trend}</div>
                      </div>
                      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                        <div className="text-[var(--muted)]">{t("analytics.diagnostics.common_issues", "Common Issues")}</div>
                        <div className="mt-1">{t("analytics.diagnostics.downtime", "Downtime: {{value}}", { value: trends.common_issues.downtime })}</div>
                        <div>{t("analytics.diagnostics.quality", "Quality: {{value}}", { value: trends.common_issues.quality })}</div>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-[var(--muted)]">
                      {t("analytics.diagnostics.unavailable", "Trend diagnostics are unavailable for this account or plan.")}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">{t("analytics.manager.title", "Manager Insights")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  {manager ? (
                    <>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                          <div className="text-[var(--muted)]">{t("analytics.manager.total_units", "Total Units")}</div>
                          <div className="mt-1 text-xl font-semibold">{manager.totals.total_units}</div>
                        </div>
                        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                          <div className="text-[var(--muted)]">{t("analytics.manager.average_performance", "Average Performance")}</div>
                          <div className="mt-1 text-xl font-semibold">{manager.totals.average_performance.toFixed(1)}%</div>
                        </div>
                      </div>
                      <ResponsiveScrollArea debugLabel="analytics-manager-table">
                        <table className="min-w-full text-left text-sm">
                          <thead className="text-[var(--muted)]">
                            <tr className="border-b border-[var(--border)]">
                              <th className="px-3 py-3 font-medium">{t("analytics.manager.table.supervisor", "Supervisor")}</th>
                              <th className="px-3 py-3 font-medium">{t("analytics.manager.table.production", "Production %")}</th>
                              <th className="px-3 py-3 font-medium">{t("analytics.manager.table.downtime", "Downtime")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {manager.supervisor_summary.map((row) => (
                              <tr key={row.name} className="border-b border-[var(--border)]/60">
                                <td className="px-3 py-3">{row.name}</td>
                                <td className="px-3 py-3">{row.production_percent.toFixed(1)}%</td>
                                <td className="px-3 py-3">{t("analytics.manager.table.downtime_minutes", "{{count}} min", { count: row.downtime_minutes })}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </ResponsiveScrollArea>
                    </>
                  ) : (
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-[var(--muted)]">
                      {t("analytics.manager.empty", "Manager insights appear for manager accounts using the dedicated backend endpoint.")}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </details>
        </section>

        {error || sessionError ? <div className="text-sm text-red-400">{error || sessionError}</div> : null}
      </div>
    </main>
  );
}
