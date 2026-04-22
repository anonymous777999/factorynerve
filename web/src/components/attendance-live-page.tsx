"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ResponsiveScrollArea } from "@/components/ui/responsive-scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import { getLiveAttendance, type AttendanceLive, type AttendanceLiveRow } from "@/lib/attendance";
import { useI18n, useI18nNamespaces } from "@/lib/i18n";
import { useSession } from "@/lib/use-session";

type AttendanceFilter = "all" | "working" | "not_punched" | "completed" | "missed_punch";
const AUTO_REFRESH_MS = 25_000;

function todayValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
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

function formatMinutes(value: number) {
  if (!value) return "0h 0m";
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${hours}h ${minutes}m`;
}

function statusTone(status: AttendanceLiveRow["status"]) {
  switch (status) {
    case "missed_punch":
      return "border-red-400/35 bg-[rgba(239,68,68,0.12)] text-red-100";
    case "working":
      return "border-emerald-400/35 bg-[rgba(34,197,94,0.12)] text-emerald-100";
    case "completed":
      return "border-sky-400/35 bg-[rgba(56,189,248,0.12)] text-sky-100";
    default:
      return "border-amber-400/35 bg-[rgba(245,158,11,0.12)] text-amber-100";
  }
}

function canReviewAttendance(role?: string | null) {
  return ["supervisor", "manager", "admin", "owner"].includes(role || "");
}

export default function AttendanceLivePage() {
  const { locale, t } = useI18n();
  useI18nNamespaces(["common", "attendance"]);

  const { user, activeFactory, loading, error: sessionError } = useSession();
  const [attendanceDate, setAttendanceDate] = useState(todayValue());
  const [filter, setFilter] = useState<AttendanceFilter>("all");
  const [payload, setPayload] = useState<AttendanceLive | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [error, setError] = useState("");

  const canReview = canReviewAttendance(user?.role);

  const shiftLabel = useCallback(
    (value?: string | null) => {
      if (!value) return "-";
      return t(`attendance.shift.${value}`, value.charAt(0).toUpperCase() + value.slice(1));
    },
    [t],
  );

  const loadBoard = useCallback(
    async (options?: { background?: boolean }) => {
      if (!user || !canReview) {
        return;
      }
      const shouldBackground = Boolean(options?.background);
      if (shouldBackground) {
        setRefreshing(true);
      } else {
        setPageLoading(true);
      }
      setError("");
      try {
        const next = await getLiveAttendance(attendanceDate);
        setPayload(next);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError(t("attendance.errors.load", "Could not load attendance."));
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
    [attendanceDate, canReview, t, user],
  );

  useEffect(() => {
    setError("");
    setLastUpdatedAt(null);
    if (!user || !canReview) {
      setPayload(null);
      setHasLoadedOnce(false);
      setPageLoading(true);
      return;
    }
    setPayload(null);
    setHasLoadedOnce(false);
  }, [canReview, user]);

  useEffect(() => {
    if (!user || !canReview) {
      return;
    }
    const timer = window.setTimeout(() => {
      void loadBoard();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadBoard, user, canReview]);

  useEffect(() => {
    if (!user || !canReview) {
      return;
    }
    const refresh = () => {
      if (!document.hidden) {
        void loadBoard({ background: true });
      }
    };
    const timer = window.setInterval(refresh, AUTO_REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [canReview, loadBoard, user]);

  const filteredRows = useMemo(() => {
    if (!payload) return [];
    if (filter === "all") return payload.rows;
    return payload.rows.filter((row) => row.status === filter);
  }, [filter, payload]);

  const nextAttentionRow = useMemo(
    () =>
      filteredRows.find((row) => row.status === "missed_punch") ||
      filteredRows.find((row) => row.status === "not_punched") ||
      filteredRows.find((row) => row.status === "working") ||
      filteredRows[0] ||
      null,
    [filteredRows],
  );

  const remainingRows = useMemo(
    () => filteredRows.filter((row) => row.user_id !== nextAttentionRow?.user_id),
    [filteredRows, nextAttentionRow],
  );

  if (loading || (pageLoading && user && canReview && !hasLoadedOnce)) {
    return (
      <main className="min-h-screen px-4 py-8 md:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <Skeleton className="h-36 rounded-[2rem]" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-32 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-[34rem] rounded-2xl" />
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>{t("attendance.live.title", "Attendance Board")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-red-400">{sessionError || t("attendance.live.sign_in_required", "Please sign in to continue.")}</div>
            <Link href="/access">
              <Button>{t("dashboard.action.open_login", "Open Access")}</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!canReview) {
    return (
      <main className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>{t("attendance.live.title", "Attendance Board")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-[var(--muted)]">
              {t("attendance.live.restricted", "Live attendance is available to supervisor, manager, admin, and owner roles.")}
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/attendance">
                <Button>{t("attendance.live.open_my_attendance", "Open My Attendance")}</Button>
              </Link>
              <Link href="/work-queue">
                <Button variant="outline">{t("attendance.live.work_queue", "Work Queue")}</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[2rem] border border-[var(--border)] bg-[rgba(20,24,36,0.9)] p-6 shadow-2xl backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-4xl">
              <div className="text-sm uppercase tracking-[0.3em] text-[var(--accent)]">{t("attendance.live.title", "Attendance Board")}</div>
              <h1 className="mt-2 text-3xl font-semibold md:text-4xl">{t("attendance.live.hero.title", "Live attendance across the active factory")}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">{t("attendance.live.hero.subtitle", "Start with the next attendance signal, then scan the full board.")}</p>
            </div>
            <details className="w-full min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] px-4 py-4 sm:w-auto sm:min-w-[240px]">
              <summary className="cursor-pointer list-none text-sm font-semibold text-[var(--text)]">{t("attendance.live.tools.title", "Board tools")}</summary>
              <div className="mt-4 space-y-4">
                <div className="flex flex-wrap gap-3">
                  <Link href="/attendance">
                    <Button variant="outline">{t("attendance.live.open_my_attendance", "Open My Attendance")}</Button>
                  </Link>
                  <Link href="/attendance/review">
                    <Button variant="outline">{t("attendance.live.tools.review_queue", "Review Queue")}</Button>
                  </Link>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    className="px-4 py-2 text-xs"
                    onClick={() => {
                      void loadBoard({ background: true });
                    }}
                    disabled={refreshing}
                  >
                    {refreshing ? t("attendance.live.tools.refreshing", "Refreshing...") : t("common.refresh", "Refresh")}
                  </Button>
                  <span className="text-xs text-[var(--muted)]">
                    {refreshing
                      ? t("attendance.live.tools.updating", "Updating attendance...")
                      : lastUpdatedAt
                        ? t("attendance.live.tools.updated", "Updated {{value}}", { value: formatDateTime(lastUpdatedAt, locale) })
                        : t("attendance.live.tools.live_updates", "Live updates every 25 seconds")}
                  </span>
                </div>
              </div>
            </details>
          </div>
        </section>

        <section className="grid gap-3 xl:grid-cols-3">
          {[
            {
              label: t("attendance.live.steps.signal", "1. Review next signal"),
              detail: nextAttentionRow
                ? t("attendance.live.steps.signal_ready", "{{name}} is the first row in focus.", { name: nextAttentionRow.name })
                : t("attendance.live.steps.signal_empty", "No urgent attendance signal is open right now."),
            },
            {
              label: t("attendance.live.steps.totals", "2. Scan totals"),
              detail: t("attendance.live.steps.totals_detail", "Working {{working}}, closed {{closed}}, not punched {{notPunched}}.", {
                working: payload?.totals.working || 0,
                closed: payload?.totals.completed || 0,
                notPunched: payload?.totals.not_punched || 0,
              }),
            },
            {
              label: t("attendance.live.steps.filter", "3. Filter the board"),
              detail: t("attendance.live.steps.filter_detail", "Use board tools only when you need a date or status slice."),
            },
          ].map((step) => (
            <div key={step.label} className="rounded-3xl border border-[var(--border)] bg-[var(--card-strong)] px-5 py-4">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">{step.label}</div>
              <div className="mt-2 text-sm text-[var(--muted)]">{step.detail}</div>
            </div>
          ))}
        </section>

        {error ? <div className="rounded-2xl border border-red-400/30 bg-[rgba(239,68,68,0.12)] px-4 py-3 text-sm text-red-100">{error}</div> : null}
        {refreshing ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] px-4 py-3 text-sm text-[var(--muted)]">
            {t("attendance.live.refreshing_background", "Refreshing live attendance in the background...")}
          </div>
        ) : null}
        {sessionError ? <div className="rounded-2xl border border-red-400/30 bg-[rgba(239,68,68,0.12)] px-4 py-3 text-sm text-red-100">{sessionError}</div> : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">{t("attendance.live.cards.factory", "Factory")}</div>
              <CardTitle>{payload?.factory_name || activeFactory?.name || user.factory_name}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-[var(--muted)]">
              {t("attendance.live.cards.date", "Date {{value}}", { value: payload?.attendance_date || attendanceDate })}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">{t("attendance.live.cards.working", "Working")}</div>
              <CardTitle>{payload?.totals.working || 0}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-[var(--muted)]">
              {t("attendance.live.cards.working_detail", "Team members with an open punch.")}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">{t("attendance.live.cards.closed", "Closed")}</div>
              <CardTitle>{payload?.totals.completed || 0}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-[var(--muted)]">
              {t("attendance.live.cards.closed_detail", "Attendance already closed for the selected date.")}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">{t("attendance.live.cards.not_punched", "Not Punched")}</div>
              <CardTitle>{payload?.totals.not_punched || 0}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-[var(--muted)]">
              {t("attendance.live.cards.not_punched_detail", "People still missing a punch update.")}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-6">
            <details className="rounded-3xl border border-[var(--border)] bg-[rgba(20,24,36,0.9)] px-5 py-5">
              <summary className="cursor-pointer list-none text-lg font-semibold text-[var(--text)]">{t("attendance.live.filters.title", "Board filters")}</summary>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="text-sm text-[var(--muted)]">{t("attendance.live.filters.date", "Attendance Date")}</label>
                  <Input type="date" value={attendanceDate} onChange={(event) => setAttendanceDate(event.target.value)} />
                </div>
                <div className="flex flex-wrap gap-2">
                  {([
                    ["all", t("attendance.live.filters.all", "All")],
                    ["working", t("attendance.live.filters.working", "Working")],
                    ["missed_punch", t("attendance.live.filters.missed_punch", "Missed Punch")],
                    ["not_punched", t("attendance.live.filters.not_punched", "Not Punched")],
                    ["completed", t("attendance.live.filters.completed", "Closed")],
                  ] as const).map(([key, label]) => (
                    <Button
                      key={key}
                      variant={filter === key ? "primary" : "outline"}
                      className="px-4 py-2 text-xs"
                      onClick={() => setFilter(key)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                <Button variant="ghost" onClick={() => void loadBoard({ background: true })} disabled={refreshing}>
                  {refreshing ? t("attendance.live.tools.refreshing", "Refreshing...") : t("common.refresh", "Refresh")}
                </Button>
              </div>
            </details>

            <details className="rounded-3xl border border-[var(--border)] bg-[rgba(20,24,36,0.9)] px-5 py-5">
              <summary className="cursor-pointer list-none text-lg font-semibold text-[var(--text)]">{t("attendance.live.shift_summary", "Shift summary")}</summary>
              <div className="mt-4 space-y-3">
                {(payload?.shift_summary || []).map((shift) => (
                  <div key={shift.shift} className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-[var(--text)]">{shiftLabel(shift.shift)}</div>
                      <div className="text-xs text-[var(--muted)]">{t("attendance.live.shift_punched", "{{count}} punched", { count: shift.punched_count })}</div>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-[var(--border)]/80 bg-[rgba(12,16,26,0.72)] p-3 text-sm">
                        {t("attendance.live.shift_working", "Working")} <span className="font-semibold text-[var(--text)]">{shift.working_count}</span>
                      </div>
                      <div className="rounded-2xl border border-[var(--border)]/80 bg-[rgba(12,16,26,0.72)] p-3 text-sm">
                        {t("attendance.live.shift_closed", "Closed")} <span className="font-semibold text-[var(--text)]">{shift.completed_count}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          </div>

          <Card>
            <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm text-[var(--muted)]">{t("attendance.live.rows.title", "Live Rows")}</div>
                <CardTitle className="text-xl">{t("attendance.live.rows.people_in_view", "{{count}} people in this view", { count: filteredRows.length })}</CardTitle>
              </div>
              <div className="text-sm text-[var(--muted)]">
                {t("attendance.live.rows.total_people", "Total people {{count}}", { count: payload?.totals.total_people || 0 })}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {nextAttentionRow ? (
                <div className={`rounded-2xl border p-4 ${statusTone(nextAttentionRow.status)}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">{t("attendance.live.rows.next_signal", "Next signal")}</div>
                      <div className="mt-2 text-sm font-semibold text-[var(--text)]">{nextAttentionRow.name}</div>
                      <div className="mt-1 text-xs text-[var(--muted)]">
                        {nextAttentionRow.role} • {nextAttentionRow.department || t("attendance.live.rows.no_department", "No department")} • {shiftLabel(nextAttentionRow.shift)}
                      </div>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${statusTone(nextAttentionRow.status)}`}>
                      {nextAttentionRow.status.replace("_", " ")}
                    </span>
                  </div>
                </div>
              ) : null}
              {filteredRows.length ? (
                <ResponsiveScrollArea debugLabel="attendance-live-table">
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-[var(--muted)]">
                      <tr className="border-b border-[var(--border)]">
                        <th className="px-3 py-3 font-medium">{t("attendance.live.table.user", "User")}</th>
                        <th className="px-3 py-3 font-medium">{t("attendance.live.table.role", "Role")}</th>
                        <th className="px-3 py-3 font-medium">{t("attendance.live.table.department", "Department")}</th>
                        <th className="px-3 py-3 font-medium">{t("attendance.live.table.shift", "Shift")}</th>
                        <th className="px-3 py-3 font-medium">{t("attendance.live.table.status", "Status")}</th>
                        <th className="px-3 py-3 font-medium">{t("attendance.live.table.punch_in", "Punch In")}</th>
                        <th className="px-3 py-3 font-medium">{t("attendance.live.table.punch_out", "Punch Out")}</th>
                        <th className="px-3 py-3 font-medium">{t("attendance.live.table.worked", "Worked")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(nextAttentionRow ? [nextAttentionRow, ...remainingRows] : filteredRows).map((row) => (
                        <tr key={row.user_id} className="border-b border-[var(--border)]/60">
                          <td className="px-3 py-3">
                            <div className="font-semibold text-[var(--text)]">{row.name}</div>
                            <div className="text-xs text-[var(--muted)]">{t("attendance.live.table.id", "ID {{value}}", { value: row.user_code })}</div>
                          </td>
                          <td className="px-3 py-3">{row.role}</td>
                          <td className="px-3 py-3">{row.department || "-"}</td>
                          <td className="px-3 py-3">{shiftLabel(row.shift)}</td>
                          <td className="px-3 py-3">
                            <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${statusTone(row.status)}`}>
                              {row.status.replace("_", " ")}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-[var(--muted)]">{formatDateTime(row.punch_in_at, locale)}</td>
                          <td className="px-3 py-3 text-[var(--muted)]">{formatDateTime(row.punch_out_at, locale)}</td>
                          <td className="px-3 py-3">{formatMinutes(row.worked_minutes)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ResponsiveScrollArea>
              ) : (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
                  {t("attendance.live.table.no_rows", "No attendance rows match this filter yet.")}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
