"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { ApiError } from "@/lib/api";
import { getAttendanceReportSummary, type AttendanceReportSummary } from "@/lib/attendance";
import { useSession } from "@/lib/use-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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

export default function AttendanceReportsPage() {
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
          setError("Could not load attendance reports.");
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
    [canView, dateFrom, dateTo, user],
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
      <main className="min-h-screen px-4 py-6 pb-28 sm:px-6 sm:py-8 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-5 sm:space-y-6">
          <Skeleton className="h-36 rounded-[2rem]" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
          <CardHeader><CardTitle>Attendance Reports</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-red-400">{sessionError || "Please login to continue."}</div>
            <Link href="/login"><Button>Open Login</Button></Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!canView) {
    return (
      <main className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-4">
        <Card className="w-full">
          <CardHeader><CardTitle>Attendance Reports</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-[var(--muted)]">Attendance reports are available to reporting and management roles.</div>
            <Link href="/attendance" className="w-full sm:w-auto"><Button className="w-full sm:w-auto">Open Attendance</Button></Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-6 pb-28 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5 sm:space-y-6">
        <section className="rounded-[1.75rem] border border-[var(--border)] bg-[rgba(20,24,36,0.9)] p-5 shadow-2xl backdrop-blur sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-4xl">
              <div className="text-sm uppercase tracking-[0.3em] text-[var(--accent)]">Attendance Reports</div>
              <h1 className="mt-2 text-2xl font-semibold sm:text-3xl md:text-4xl">Daily attendance signal across the selected range</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                Watch attendance completion, pending review load, late arrivals, and overtime from one reporting surface for {payload?.factory_name || activeFactory?.name || user.factory_name}.
              </p>
            </div>
            <div className="w-full space-y-3 lg:w-auto">
              <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
                <Link href="/attendance/live" className="w-full sm:w-auto"><Button variant="outline" className="w-full sm:w-auto">Live Board</Button></Link>
                <Link href="/attendance/review" className="w-full sm:w-auto"><Button variant="outline" className="w-full sm:w-auto">Review Queue</Button></Link>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button
                  variant="outline"
                  className="w-full px-4 py-2 text-xs sm:w-auto"
                  onClick={() => {
                    void loadReports({ background: true });
                  }}
                  disabled={refreshing}
                >
                  {refreshing ? "Refreshing..." : "Refresh Reports"}
                </Button>
                <span className="text-xs text-[var(--muted)]">
                  {refreshing
                    ? "Updating report data..."
                    : lastUpdatedAt
                      ? `Updated ${formatDateTime(lastUpdatedAt)}`
                      : "Live updates every 30 seconds"}
                </span>
              </div>
            </div>
          </div>
        </section>

        {error ? <div className="rounded-2xl border border-red-400/30 bg-[rgba(239,68,68,0.12)] px-4 py-3 text-sm text-red-100">{error}</div> : null}
        {refreshing ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] px-4 py-3 text-sm text-[var(--muted)]">
            Refreshing attendance reports in the background...
          </div>
        ) : null}
        {sessionError ? <div className="rounded-2xl border border-red-400/30 bg-[rgba(239,68,68,0.12)] px-4 py-3 text-sm text-red-100">{sessionError}</div> : null}

        <Card>
          <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div><CardTitle className="text-xl">Report Range</CardTitle></div>
            <div className="grid w-full gap-4 sm:grid-cols-2 lg:w-auto">
              <div>
                <label className="text-sm text-[var(--muted)]">Date From</label>
                <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
              </div>
              <div>
                <label className="text-sm text-[var(--muted)]">Date To</label>
                <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
              </div>
            </div>
          </CardHeader>
          <CardContent><Button variant="ghost" className="w-full sm:w-auto" onClick={() => void loadReports({ background: true })} disabled={refreshing}>{refreshing ? "Refreshing..." : "Refresh Report"}</Button></CardContent>
        </Card>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card><CardHeader><div className="text-sm text-[var(--muted)]">Present Records</div><CardTitle>{payload?.totals.present_records || 0}</CardTitle></CardHeader><CardContent className="text-sm text-[var(--muted)]">Punch-ins recorded across the selected range.</CardContent></Card>
          <Card><CardHeader><div className="text-sm text-[var(--muted)]">Completed</div><CardTitle>{payload?.totals.completed_records || 0}</CardTitle></CardHeader><CardContent className="text-sm text-[var(--muted)]">Rows with a closed attendance record.</CardContent></Card>
          <Card><CardHeader><div className="text-sm text-[var(--muted)]">Pending Review</div><CardTitle>{payload?.totals.pending_review || 0}</CardTitle></CardHeader><CardContent className="text-sm text-[var(--muted)]">Open review load still sitting with supervisors.</CardContent></Card>
          <Card><CardHeader><div className="text-sm text-[var(--muted)]">Late / Overtime</div><CardTitle>{(payload?.totals.late_records || 0) + (payload?.totals.overtime_records || 0)}</CardTitle></CardHeader><CardContent className="text-sm text-[var(--muted)]">{payload?.totals.late_records || 0} late and {payload?.totals.overtime_records || 0} overtime rows.</CardContent></Card>
        </section>

        <Card>
          <CardHeader>
            <div className="text-sm text-[var(--muted)]">Daily Breakdown</div>
            <CardTitle className="text-xl">{formatDate(payload?.date_from)} to {formatDate(payload?.date_to)}</CardTitle>
          </CardHeader>
          <CardContent>
            {payload?.days.length ? (
              <>
                <div className="space-y-3 md:hidden">
                  {payload.days.map((day) => (
                    <div key={day.attendance_date} className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                      <div className="font-semibold text-[var(--text)]">{formatDate(day.attendance_date)}</div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-[var(--border)]/80 bg-[rgba(12,16,26,0.72)] p-3 text-sm">
                          <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">Assigned</div>
                          <div className="mt-1 font-medium text-[var(--text)]">{day.total_people}</div>
                        </div>
                        <div className="rounded-2xl border border-[var(--border)]/80 bg-[rgba(12,16,26,0.72)] p-3 text-sm">
                          <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">Punched In</div>
                          <div className="mt-1 font-medium text-[var(--text)]">{day.punched_in}</div>
                        </div>
                        <div className="rounded-2xl border border-[var(--border)]/80 bg-[rgba(12,16,26,0.72)] p-3 text-sm">
                          <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">Completed</div>
                          <div className="mt-1 font-medium text-[var(--text)]">{day.completed}</div>
                        </div>
                        <div className="rounded-2xl border border-[var(--border)]/80 bg-[rgba(12,16,26,0.72)] p-3 text-sm">
                          <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">Not Punched</div>
                          <div className="mt-1 font-medium text-[var(--text)]">{day.not_punched}</div>
                        </div>
                        <div className="rounded-2xl border border-[var(--border)]/80 bg-[rgba(12,16,26,0.72)] p-3 text-sm">
                          <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">Pending Review</div>
                          <div className="mt-1 font-medium text-[var(--text)]">{day.pending_review}</div>
                        </div>
                        <div className="rounded-2xl border border-[var(--border)]/80 bg-[rgba(12,16,26,0.72)] p-3 text-sm">
                          <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">Late / Overtime</div>
                          <div className="mt-1 font-medium text-[var(--text)]">{day.late} / {day.overtime}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="hidden overflow-x-auto md:block">
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-[var(--muted)]">
                      <tr className="border-b border-[var(--border)]">
                        <th className="px-3 py-3 font-medium">Date</th>
                        <th className="px-3 py-3 font-medium">Assigned</th>
                        <th className="px-3 py-3 font-medium">Punched In</th>
                        <th className="px-3 py-3 font-medium">Completed</th>
                        <th className="px-3 py-3 font-medium">Not Punched</th>
                        <th className="px-3 py-3 font-medium">Pending Review</th>
                        <th className="px-3 py-3 font-medium">Late</th>
                        <th className="px-3 py-3 font-medium">Overtime</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payload.days.map((day) => (
                        <tr key={day.attendance_date} className="border-b border-[var(--border)]/60">
                          <td className="px-3 py-3 font-semibold text-[var(--text)]">{formatDate(day.attendance_date)}</td>
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
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
                No attendance data is available for the selected range yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
