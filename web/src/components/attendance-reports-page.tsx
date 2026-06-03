"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { OperationalPageShell } from "@/components/ui/operational-page-shell";
import { ResponsiveScrollArea } from "@/components/ui/responsive-scroll-area";
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

  const router = useRouter();
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

  const reportMetrics = [
    {
      id: "present",
      label: t("attendance.reports.cards.present", "Present"),
      value: payload?.totals.present_records || 0,
      detail: t("attendance.reports.cards.present_detail", "Punch-ins in range."),
    },
    {
      id: "completed",
      label: t("attendance.reports.cards.completed", "Closed"),
      value: payload?.totals.completed_records || 0,
      detail: t("attendance.reports.cards.completed_detail", "Closed rows."),
      tone: "synced" as const,
    },
    {
      id: "pending",
      label: t("attendance.reports.cards.pending_review", "Pending"),
      value: payload?.totals.pending_review || 0,
      detail: t("attendance.reports.cards.pending_review_detail", "Needs review."),
      tone: "warning" as const,
    },
    {
      id: "late-overtime",
      label: t("attendance.reports.cards.late_overtime", "Late / Overtime"),
      value: (payload?.totals.late_records || 0) + (payload?.totals.overtime_records || 0),
      detail: t("attendance.reports.cards.late_overtime_detail", "{{late}} late and {{overtime}} overtime rows.", {
        late: payload?.totals.late_records || 0,
        overtime: payload?.totals.overtime_records || 0,
      }),
    },
  ];

  const reportFilters = (
    <Card>
      <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <CardTitle className="text-xl">{t("attendance.reports.range.title", "Report Range")}</CardTitle>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm text-text-secondary">{t("attendance.reports.range.from", "Date From")}</label>
            <Input aria-label="Date from" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          </div>
          <div>
            <label className="text-sm text-text-secondary">{t("attendance.reports.range.to", "Date To")}</label>
            <Input aria-label="Date to" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Button variant="ghost" onClick={() => void loadReports({ background: true })} disabled={refreshing}>
          {refreshing ? t("attendance.reports.tools.refreshing", "Refreshing...") : t("attendance.reports.range.update", "Update report")}
        </Button>
      </CardContent>
    </Card>
  );

  if (loading || (pageLoading && user && canView && !hasLoadedOnce)) {
    return (
      <OperationalPageShell
        eyebrow={t("attendance.reports.title", "Attendance Reports")}
        title={t("attendance.reports.hero.title", "Attendance reports")}
        description={t("attendance.reports.hero.subtitle", "Range view for factory attendance.")}
        isLoading
        loadingTitle="Loading attendance reports"
        metrics={[]}
      >
        <div />
      </OperationalPageShell>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
        <Card className="w-full">
          <CardHeader><CardTitle>{t("attendance.reports.title", "Attendance Reports")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-[var(--status-danger-fg)]">{sessionError || t("attendance.reports.sign_in_required", "Please sign in to continue.")}</div>
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
            <div className="text-sm text-text-secondary">{t("attendance.reports.restricted", "Attendance reports are available to reporting and management roles.")}</div>
            <Link href="/attendance"><Button>{t("attendance.reports.open_attendance", "Open Attendance")}</Button></Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <OperationalPageShell
      className="attendance-reports-page"
      eyebrow={t("attendance.reports.title", "Attendance Reports")}
      title={t("attendance.reports.hero.title", "Attendance reports")}
      description={t("attendance.reports.hero.subtitle", "{{factory}} range view.", {
        factory: payload?.factory_name || activeFactory?.name || user.factory_name,
      })}
      toneLabel={
        refreshing
          ? t("attendance.reports.tools.updating", "Updating report data...")
          : lastUpdatedAt
            ? t("attendance.reports.tools.updated", "Updated {{value}}", { value: formatDateTime(lastUpdatedAt, locale) })
            : t("attendance.reports.tools.live_updates", "Live updates every 30 seconds")
      }
      metrics={reportMetrics}
      filters={reportFilters}
      actions={[
        {
          id: "live-board",
          label: t("attendance.reports.tools.live_board", "Live Board"),
          variant: "outline",
          onAction: () => router.push("/attendance/live"),
        },
        {
          id: "review-queue",
          label: t("attendance.reports.tools.review_queue", "Review Queue"),
          variant: "outline",
          onAction: () => router.push("/attendance/review"),
        },
        {
          id: "refresh-reports",
          label: refreshing ? t("attendance.reports.tools.refreshing", "Refreshing...") : t("common.refresh", "Refresh"),
          onAction: () => {
            void loadReports({ background: true });
          },
        },
      ]}
    >
      {error ? <div className="rounded-2xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-4 py-3 text-sm text-[var(--status-danger-fg)]">{error}</div> : null}
      {refreshing ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] px-4 py-3 text-sm text-text-secondary">
          {t("attendance.reports.refreshing_background", "Refreshing reports...")}
        </div>
      ) : null}
      {sessionError ? <div className="rounded-2xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-4 py-3 text-sm text-[var(--status-danger-fg)]">{sessionError}</div> : null}

      <Card>
        <CardHeader>
          <div className="text-sm text-text-secondary">{t("attendance.reports.breakdown.title", "Daily Breakdown")}</div>
          <CardTitle className="text-xl">{t("attendance.reports.breakdown.window", "{{from}} to {{to}}", { from: formatDate(payload?.date_from, locale), to: formatDate(payload?.date_to, locale) })}</CardTitle>
        </CardHeader>
        <CardContent>
          {payload?.days.length ? (
            <ResponsiveScrollArea debugLabel="attendance-reports-breakdown">
              <table className="min-w-full text-left text-sm">
                <thead className="text-text-secondary">
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
                      <td className="px-3 py-3 font-semibold text-text-primary">{formatDate(day.attendance_date, locale)}</td>
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
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-text-secondary">
              {t("attendance.reports.breakdown.empty", "No attendance data is available for the selected range yet.")}
            </div>
          )}
        </CardContent>
      </Card>
    </OperationalPageShell>
  );
}
