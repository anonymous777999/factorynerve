"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { GuidanceBlock } from "@/components/ui/guidance-block";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ResponsiveScrollArea } from "@/components/ui/responsive-scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import { getAttendanceReportSummary, type AttendanceReportSummary } from "@/lib/attendance";
import { useI18n, useI18nNamespaces } from "@/lib/i18n";
import { useSession } from "@/lib/use-session";

const AUTO_REFRESH_MS = 30_000;

function todayValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function dateDaysAgo(days: number) {
  const now = new Date();
  now.setDate(now.getDate() - days);
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function canSeeReports(role?: string | null) {
  return ["supervisor", "manager", "admin", "owner", "accountant"].includes(role || "");
}

function formatDate(value?: string | null, locale = "en-IN") {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
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

export default function AttendanceReportsPage() {
  const { locale, t } = useI18n();
  useI18nNamespaces(["common", "attendance"]);

  const { user, activeFactory, loading, error: sessionError } = useSession();
  const [dateFrom, setDateFrom] = useState(dateDaysAgo(6));
  const [dateTo, setDateTo] = useState(todayValue());
  const [payload, setPayload] = useState<AttendanceReportSummary | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [error, setError] = useState("");

  const canView = canSeeReports(user?.role);

  const loadReports = useCallback(
    async (options?: { background?: boolean }) => {
      if (!user || !canView) return;
      const shouldBackground = Boolean(options?.background);
      if (shouldBackground) {
        setRefreshing(true);
      } else {
        setPageLoading(true);
      }
      setError("");
      try {
        const next = await getAttendanceReportSummary(dateFrom, dateTo);
        setPayload(next);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError(t("attendance.reports.errors.load", "Could not load attendance reports."));
        }
        if (!shouldBackground) {
          setPayload(null);
        }
      } finally {
        setLastUpdatedAt(new Date().toISOString());
        setHasLoadedOnce(true);
        setPageLoading(false);
        setRefreshing(false);
      }
    },
    [canView, dateFrom, dateTo, t, user],
  );

  useEffect(() => {
    setError("");
    setLastUpdatedAt(null);
    if (!user || !canView) {
      setPayload(null);
      setHasLoadedOnce(false);
      setPageLoading(true);
      return;
    }
    setPayload(null);
    setHasLoadedOnce(false);
  }, [canView, user]);

  useEffect(() => {
    if (!user || !canView) return;
    const timer = window.setTimeout(() => {
      void loadReports();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [canView, loadReports, user]);

  useEffect(() => {
    if (!user || !canView) return;
    const refresh = () => {
      if (!document.hidden) {
        void loadReports({ background: true });
      }
    };
    const timer = window.setInterval(refresh, AUTO_REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [canView, loadReports, user]);

  if (loading || (pageLoading && user && canView && !hasLoadedOnce)) {
    return (
      <main className="min-h-screen px-4 py-8 md:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <Skeleton className="h-36 rounded-[2rem]" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-32 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-[30rem] rounded-2xl" />
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
        <Card className="w-full">
          <CardHeader><CardTitle>{t("attendance.reports.title", "Attendance Reports")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-red-400">{sessionError || t("attendance.reports.sign_in_required", "Please sign in to continue.")}</div>
            <Link href="/access"><Button>{t("dashboard.action.open_login", "Open Access")}</Button></Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!canView) {
    return (
      <main className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-4">
        <Card className="w-full">
          <CardHeader><CardTitle>{t("attendance.reports.title", "Attendance Reports")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-[var(--muted)]">{t("attendance.reports.restricted", "Attendance reports are available to reporting and management roles.")}</div>
            <Link href="/attendance"><Button>{t("attendance.reports.open_attendance", "Open Attendance")}</Button></Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8 md:px-8" data-component="attendance-reports-page">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[2rem] border border-[var(--border)] bg-[rgba(20,24,36,0.9)] p-6 shadow-2xl backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-4xl">
              <div className="text-sm uppercase tracking-[0.3em] text-[var(--accent)]">{t("attendance.reports.title", "Attendance Reports")}</div>
              <h1 className="mt-2 text-3xl font-semibold md:text-4xl">{t("attendance.reports.hero.title", "Daily attendance signal across the selected range")}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                {t("attendance.reports.hero.subtitle", "Review attendance and exceptions for {{factory}}.", {
                  factory: payload?.factory_name || activeFactory?.name || user.factory_name,
                })}
              </p>
            </div>
            <details className="w-full min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] px-4 py-4 lg:w-auto lg:min-w-[240px]">
              <summary className="cursor-pointer list-none text-sm font-semibold text-[var(--text)]">{t("attendance.reports.tools.title", "Report tools")}</summary>
              <div className="mt-4 space-y-4">
                <div className="flex flex-wrap gap-3">
                  <Link href="/attendance/live"><Button variant="outline">{t("attendance.reports.tools.live_board", "Live Board")}</Button></Link>
                  <Link href="/attendance/review"><Button variant="outline">{t("attendance.reports.tools.review_queue", "Review Queue")}</Button></Link>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    className="px-4 py-2 text-xs"
                    onClick={() => {
                      void loadReports({ background: true });
                    }}
                    disabled={refreshing}
                  >
                    {refreshing ? t("attendance.reports.tools.refreshing", "Refreshing...") : t("common.refresh", "Refresh")}
                  </Button>
                  <span className="text-xs text-[var(--muted)]">
                    {refreshing
                      ? t("attendance.reports.tools.updating", "Updating report data...")
                      : lastUpdatedAt
                        ? t("attendance.reports.tools.updated", "Updated {{value}}", { value: formatDateTime(lastUpdatedAt, locale) })
                        : t("attendance.reports.tools.live_updates", "Live updates every 30 seconds")}
                  </span>
                </div>
              </div>
            </details>
          </div>
        </section>

        <GuidanceBlock
          surfaceKey="attendance-reports"
          title={t("attendance.reports.steps.title", "How to scan this")}
          summary={t("attendance.reports.steps.summary", "Set the range, check totals, then open daily detail.")}
          eyebrow={t("attendance.reports.steps.eyebrow", "On demand")}
          autoOpenVisits={1}
        >
          <div className="grid gap-3 xl:grid-cols-3">
            {[
              {
                label: t("attendance.reports.steps.range", "Set range"),
                detail: t("attendance.reports.steps.range_detail", "{{from}} to {{to}} is the current report window.", {
                  from: formatDate(dateFrom, locale),
                  to: formatDate(dateTo, locale),
                }),
              },
              {
                label: t("attendance.reports.steps.totals", "Check totals"),
                detail: t("attendance.reports.steps.totals_detail", "Pending review {{pending}}, late {{late}}, overtime {{overtime}}.", {
                  pending: payload?.totals.pending_review || 0,
                  late: payload?.totals.late_records || 0,
                  overtime: payload?.totals.overtime_records || 0,
                }),
              },
              {
                label: t("attendance.reports.steps.scan", "Scan days"),
                detail: t("attendance.reports.steps.scan_detail", "Use the daily breakdown after the range and totals look right."),
              },
            ].map((step) => (
              <div key={step.label} className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] px-4 py-4">
                <div className="text-sm font-semibold text-[var(--text)]">{step.label}</div>
                <div className="mt-2 text-sm text-[var(--muted)]">{step.detail}</div>
              </div>
            ))}
          </div>
        </GuidanceBlock>

        {error ? <div className="rounded-2xl border border-red-400/30 bg-[rgba(239,68,68,0.12)] px-4 py-3 text-sm text-red-100">{error}</div> : null}
        {refreshing ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] px-4 py-3 text-sm text-[var(--muted)]">
            {t("attendance.reports.refreshing_background", "Refreshing attendance reports in the background...")}
          </div>
        ) : null}
        {sessionError ? <div className="rounded-2xl border border-red-400/30 bg-[rgba(239,68,68,0.12)] px-4 py-3 text-sm text-red-100">{sessionError}</div> : null}

        <Card>
          <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div><CardTitle className="text-xl">{t("attendance.reports.range.title", "Report Range")}</CardTitle></div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm text-[var(--muted)]">{t("attendance.reports.range.from", "Date From")}</label>
                <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
              </div>
              <div>
                <label className="text-sm text-[var(--muted)]">{t("attendance.reports.range.to", "Date To")}</label>
                <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button variant="ghost" onClick={() => void loadReports({ background: true })} disabled={refreshing}>
              {refreshing ? t("attendance.reports.tools.refreshing", "Refreshing...") : t("attendance.reports.range.update", "Update report")}
            </Button>
          </CardContent>
        </Card>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card><CardHeader><div className="text-sm text-[var(--muted)]">{t("attendance.reports.cards.present", "Present Records")}</div><CardTitle>{payload?.totals.present_records || 0}</CardTitle></CardHeader><CardContent className="text-sm text-[var(--muted)]">{t("attendance.reports.cards.present_detail", "Punch-ins recorded across the selected range.")}</CardContent></Card>
          <Card><CardHeader><div className="text-sm text-[var(--muted)]">{t("attendance.reports.cards.completed", "Completed")}</div><CardTitle>{payload?.totals.completed_records || 0}</CardTitle></CardHeader><CardContent className="text-sm text-[var(--muted)]">{t("attendance.reports.cards.completed_detail", "Rows with a closed attendance record.")}</CardContent></Card>
          <Card><CardHeader><div className="text-sm text-[var(--muted)]">{t("attendance.reports.cards.pending_review", "Pending Review")}</div><CardTitle>{payload?.totals.pending_review || 0}</CardTitle></CardHeader><CardContent className="text-sm text-[var(--muted)]">{t("attendance.reports.cards.pending_review_detail", "Open review load still sitting with supervisors.")}</CardContent></Card>
          <Card><CardHeader><div className="text-sm text-[var(--muted)]">{t("attendance.reports.cards.late_overtime", "Late / Overtime")}</div><CardTitle>{(payload?.totals.late_records || 0) + (payload?.totals.overtime_records || 0)}</CardTitle></CardHeader><CardContent className="text-sm text-[var(--muted)]">{t("attendance.reports.cards.late_overtime_detail", "{{late}} late and {{overtime}} overtime rows.", { late: payload?.totals.late_records || 0, overtime: payload?.totals.overtime_records || 0 })}</CardContent></Card>
        </section>

        <Card>
          <CardHeader>
            <div className="text-sm text-[var(--muted)]">{t("attendance.reports.breakdown.title", "Daily Breakdown")}</div>
            <CardTitle className="text-xl">{t("attendance.reports.breakdown.window", "{{from}} to {{to}}", { from: formatDate(payload?.date_from, locale), to: formatDate(payload?.date_to, locale) })}</CardTitle>
          </CardHeader>
          <CardContent>
            {payload?.days.length ? (
              <ResponsiveScrollArea debugLabel="attendance-reports-breakdown">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-[var(--muted)]">
                    <tr className="border-b border-[var(--border)]">
                      <th className="px-3 py-3 font-medium">{t("attendance.reports.breakdown.table.date", "Date")}</th>
                      <th className="px-3 py-3 font-medium">{t("attendance.reports.breakdown.table.assigned", "Assigned")}</th>
                      <th className="px-3 py-3 font-medium">{t("attendance.reports.breakdown.table.punched_in", "Punched In")}</th>
                      <th className="px-3 py-3 font-medium">{t("attendance.reports.breakdown.table.completed", "Completed")}</th>
                      <th className="px-3 py-3 font-medium">{t("attendance.reports.breakdown.table.not_punched", "Not Punched")}</th>
                      <th className="px-3 py-3 font-medium">{t("attendance.reports.breakdown.table.pending_review", "Pending Review")}</th>
                      <th className="px-3 py-3 font-medium">{t("attendance.reports.breakdown.table.late", "Late")}</th>
                      <th className="px-3 py-3 font-medium">{t("attendance.reports.breakdown.table.overtime", "Overtime")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payload.days.map((day) => (
                      <tr key={day.attendance_date} className="border-b border-[var(--border)]/60">
                        <td className="px-3 py-3 font-semibold text-[var(--text)]">{formatDate(day.attendance_date, locale)}</td>
                        <td className="px-3 py-3">{day.total_people}</td>
                        <td className="px-3 py-3">{day.punched_in}</td>
                        <td className="px-3 py-3">{day.completed}</td>
                        <td className="px-3 py-3">{day.not_punched}</td>
                        <td className="px-3 py-3">{day.pending_review}</td>
                        <td className="px-3 py-3">{day.late}</td>
                        <td className="px-3 py-3">{day.overtime}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ResponsiveScrollArea>
            ) : (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
                {t("attendance.reports.breakdown.empty", "No attendance data is available for the selected range yet.")}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
