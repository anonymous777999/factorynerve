"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ApiError } from "@/lib/api";
import { getLiveAttendance, type AttendanceLive, type AttendanceLiveRow } from "@/lib/attendance";
import { useSession } from "@/lib/use-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

type AttendanceFilter = "all" | "working" | "not_punched" | "completed" | "missed_punch";
const AUTO_REFRESH_MS = 25_000;

function todayValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function formatShift(value?: string | null) {
  if (!value) return "-";
  return value.charAt(0).toUpperCase() + value.slice(1);
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
          setError("Could not load the attendance board.");
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
    [attendanceDate, canReview, user],
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

  if (loading || (pageLoading && user && canReview && !hasLoadedOnce)) {
    return (
      <main className="min-h-screen px-4 py-6 pb-28 sm:px-6 sm:py-8 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-5 sm:space-y-6">
          <Skeleton className="h-36 rounded-[2rem]" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
            <CardTitle>Attendance Board</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-red-400">{sessionError || "Login required."}</div>
            <Link href="/login">
              <Button>Open Login</Button>
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
            <CardTitle>Attendance Board</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-[var(--muted)]">
              Live attendance is available to supervisor, manager, admin, and owner roles.
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/attendance" className="w-full sm:w-auto">
                <Button className="w-full sm:w-auto">Open My Attendance</Button>
              </Link>
              <Link href="/work-queue" className="w-full sm:w-auto">
                <Button variant="outline" className="w-full sm:w-auto">Work Queue</Button>
              </Link>
            </div>
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
              <div className="text-sm uppercase tracking-[0.3em] text-[var(--accent)]">Attendance Board</div>
              <h1 className="mt-2 text-2xl font-semibold sm:text-3xl md:text-4xl">Live attendance across the active factory</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                Watch who is working, who has already closed attendance, and who still needs a punch update before the shift moves on.
              </p>
            </div>
            <div className="w-full space-y-3 lg:w-auto">
              <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
                <Link href="/attendance" className="w-full sm:w-auto">
                  <Button variant="outline" className="w-full sm:w-auto">My Attendance</Button>
                </Link>
                <Link href="/attendance/review" className="w-full sm:w-auto">
                  <Button variant="outline" className="w-full sm:w-auto">Attendance Review</Button>
                </Link>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button
                  variant="outline"
                  className="w-full px-4 py-2 text-xs sm:w-auto"
                  onClick={() => {
                    void loadBoard({ background: true });
                  }}
                  disabled={refreshing}
                >
                  {refreshing ? "Refreshing..." : "Refresh Board"}
                </Button>
                <span className="text-xs text-[var(--muted)]">
                  {refreshing
                    ? "Updating attendance..."
                    : lastUpdatedAt
                      ? `Updated ${formatDateTime(lastUpdatedAt)}`
                      : "Live updates every 25 seconds"}
                </span>
              </div>
            </div>
          </div>
        </section>

        {error ? <div className="rounded-2xl border border-red-400/30 bg-[rgba(239,68,68,0.12)] px-4 py-3 text-sm text-red-100">{error}</div> : null}
        {refreshing ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] px-4 py-3 text-sm text-[var(--muted)]">
            Refreshing live attendance in the background...
          </div>
        ) : null}
        {sessionError ? <div className="rounded-2xl border border-red-400/30 bg-[rgba(239,68,68,0.12)] px-4 py-3 text-sm text-red-100">{sessionError}</div> : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">Factory</div>
              <CardTitle>{payload?.factory_name || activeFactory?.name || user.factory_name}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-[var(--muted)]">
              Date {payload?.attendance_date || attendanceDate}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">Working</div>
              <CardTitle>{payload?.totals.working || 0}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-[var(--muted)]">
              Team members with an open punch.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">Closed</div>
              <CardTitle>{payload?.totals.completed || 0}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-[var(--muted)]">
              Attendance already closed for the selected date.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">Not Punched</div>
              <CardTitle>{payload?.totals.not_punched || 0}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-[var(--muted)]">
              People still missing a punch update.
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr] xl:items-start">
          <div className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Board Filters</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm text-[var(--muted)]">Attendance Date</label>
                  <Input type="date" value={attendanceDate} onChange={(event) => setAttendanceDate(event.target.value)} />
                </div>
                <div className="-mx-1 overflow-x-auto pb-1">
                  <div className="flex min-w-max gap-2 px-1">
                    {([
                      ["all", "All"],
                      ["working", "Working"],
                      ["missed_punch", "Missed Punch"],
                      ["not_punched", "Not Punched"],
                      ["completed", "Closed"],
                    ] as const).map(([key, label]) => (
                      <Button
                        key={key}
                        variant={filter === key ? "primary" : "outline"}
                        className="shrink-0 px-4 py-2 text-xs"
                        onClick={() => setFilter(key)}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>
                <Button variant="ghost" className="w-full sm:w-auto" onClick={() => void loadBoard({ background: true })} disabled={refreshing}>
                  {refreshing ? "Refreshing..." : "Refresh Board"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Shift Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(payload?.shift_summary || []).map((shift) => (
                  <div key={shift.shift} className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-[var(--text)]">{formatShift(shift.shift)}</div>
                      <div className="text-xs text-[var(--muted)]">{shift.punched_count} punched</div>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-[var(--border)]/80 bg-[rgba(12,16,26,0.72)] p-3 text-sm">
                        Working <span className="font-semibold text-[var(--text)]">{shift.working_count}</span>
                      </div>
                      <div className="rounded-2xl border border-[var(--border)]/80 bg-[rgba(12,16,26,0.72)] p-3 text-sm">
                        Closed <span className="font-semibold text-[var(--text)]">{shift.completed_count}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm text-[var(--muted)]">Live Rows</div>
                <CardTitle className="text-xl">{filteredRows.length} people in this view</CardTitle>
              </div>
              <div className="text-sm text-[var(--muted)]">
                Total people {payload?.totals.total_people || 0}
              </div>
            </CardHeader>
            <CardContent>
              {filteredRows.length ? (
                <>
                  <div className="space-y-3 md:hidden">
                    {filteredRows.map((row) => (
                      <div key={row.user_id} className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-semibold text-[var(--text)]">{row.name}</div>
                            <div className="text-xs text-[var(--muted)]">ID {row.user_code} - {row.role}</div>
                          </div>
                          <span className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${statusTone(row.status)}`}>
                            {row.status.replace("_", " ")}
                          </span>
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-2xl border border-[var(--border)]/80 bg-[rgba(12,16,26,0.72)] p-3 text-sm">
                            <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">Department</div>
                            <div className="mt-1 font-medium text-[var(--text)]">{row.department || "-"}</div>
                          </div>
                          <div className="rounded-2xl border border-[var(--border)]/80 bg-[rgba(12,16,26,0.72)] p-3 text-sm">
                            <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">Shift</div>
                            <div className="mt-1 font-medium text-[var(--text)]">{formatShift(row.shift)}</div>
                          </div>
                          <div className="rounded-2xl border border-[var(--border)]/80 bg-[rgba(12,16,26,0.72)] p-3 text-sm">
                            <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">Punch In</div>
                            <div className="mt-1 font-medium text-[var(--text)]">{formatDateTime(row.punch_in_at)}</div>
                          </div>
                          <div className="rounded-2xl border border-[var(--border)]/80 bg-[rgba(12,16,26,0.72)] p-3 text-sm">
                            <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">Punch Out</div>
                            <div className="mt-1 font-medium text-[var(--text)]">{formatDateTime(row.punch_out_at)}</div>
                          </div>
                        </div>
                        <div className="mt-3 rounded-2xl border border-[var(--border)]/80 bg-[rgba(12,16,26,0.72)] p-3 text-sm">
                          <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">Worked</div>
                          <div className="mt-1 font-medium text-[var(--text)]">{formatMinutes(row.worked_minutes)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="hidden overflow-x-auto md:block">
                    <table className="min-w-full text-left text-sm">
                      <thead className="text-[var(--muted)]">
                        <tr className="border-b border-[var(--border)]">
                          <th className="px-3 py-3 font-medium">User</th>
                          <th className="px-3 py-3 font-medium">Role</th>
                          <th className="px-3 py-3 font-medium">Department</th>
                          <th className="px-3 py-3 font-medium">Shift</th>
                          <th className="px-3 py-3 font-medium">Status</th>
                          <th className="px-3 py-3 font-medium">Punch In</th>
                          <th className="px-3 py-3 font-medium">Punch Out</th>
                          <th className="px-3 py-3 font-medium">Worked</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRows.map((row) => (
                          <tr key={row.user_id} className="border-b border-[var(--border)]/60">
                            <td className="px-3 py-3">
                              <div className="font-semibold text-[var(--text)]">{row.name}</div>
                              <div className="text-xs text-[var(--muted)]">ID {row.user_code}</div>
                            </td>
                            <td className="px-3 py-3">{row.role}</td>
                            <td className="px-3 py-3">{row.department || "-"}</td>
                            <td className="px-3 py-3">{formatShift(row.shift)}</td>
                            <td className="px-3 py-3">
                              <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${statusTone(row.status)}`}>
                                {row.status.replace("_", " ")}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-[var(--muted)]">{formatDateTime(row.punch_in_at)}</td>
                            <td className="px-3 py-3 text-[var(--muted)]">{formatDateTime(row.punch_out_at)}</td>
                            <td className="px-3 py-3">{formatMinutes(row.worked_minutes)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
                  No attendance rows match this filter yet.
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
