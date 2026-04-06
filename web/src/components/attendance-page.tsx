"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ApiError } from "@/lib/api";
import {
  getMyAttendanceToday,
  punchAttendance,
  type AttendanceShift,
  type AttendanceStatus,
  type AttendanceToday,
} from "@/lib/attendance";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/use-session";
import { signalWorkflowRefresh, subscribeToWorkflowRefresh } from "@/lib/workflow-sync";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

const SHIFT_OPTIONS: AttendanceShift[] = ["morning", "evening", "night"];
const AUTO_REFRESH_MS = 25_000;
const TIMER_TICK_MS = 1_000;

function formatShift(value?: string | null) {
  if (!value) return "-";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatTime(value?: string | null, locale = "en-IN") {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(totalMinutes: number) {
  const safeValue = Math.max(0, totalMinutes);
  const hours = Math.floor(safeValue / 60);
  const minutes = safeValue % 60;
  return `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m`;
}

function deriveWorkedMinutes(today: AttendanceToday | null, nowMs: number) {
  if (!today) return 0;

  const punchInTime = today.punch_in_at ? new Date(today.punch_in_at).getTime() : Number.NaN;
  const punchOutTime = today.punch_out_at ? new Date(today.punch_out_at).getTime() : Number.NaN;

  if (Number.isFinite(punchInTime) && today.status === "working" && !today.punch_out_at) {
    return Math.max(today.worked_minutes || 0, Math.floor((nowMs - punchInTime) / 60_000));
  }

  if (Number.isFinite(punchInTime) && Number.isFinite(punchOutTime) && punchOutTime >= punchInTime) {
    return Math.max(today.worked_minutes || 0, Math.floor((punchOutTime - punchInTime) / 60_000));
  }

  return today.worked_minutes || 0;
}

function statusText(status?: AttendanceStatus | null) {
  switch (status) {
    case "working":
      return "Active Shift";
    case "late":
      return "Late";
    case "missed_punch":
      return "Missed Punch";
    case "completed":
      return "Shift Closed";
    case "half_day":
      return "Half Day";
    case "absent":
      return "Absent";
    default:
      return "Not Started";
  }
}

function statusTheme(status?: AttendanceStatus | null) {
  switch (status) {
    case "working":
      return {
        badge: "bg-emerald-500/15 text-emerald-100 border border-emerald-400/25",
        dot: "bg-emerald-400",
      };
    case "late":
    case "half_day":
      return {
        badge: "bg-amber-500/15 text-amber-100 border border-amber-400/25",
        dot: "bg-amber-400",
      };
    case "missed_punch":
    case "absent":
      return {
        badge: "bg-rose-500/15 text-rose-100 border border-rose-400/25",
        dot: "bg-rose-400",
      };
    case "completed":
      return {
        badge: "bg-sky-500/15 text-sky-100 border border-sky-400/25",
        dot: "bg-sky-400",
      };
    default:
      return {
        badge: "bg-white/8 text-slate-100 border border-white/10",
        dot: "bg-slate-300",
      };
  }
}

function buildMainAction(today: AttendanceToday | null) {
  if (!today) {
    return {
      label: "Loading...",
      action: null as "in" | "out" | null,
      disabled: true,
      className: "border border-white/10 bg-white/10 text-slate-200",
    };
  }

  if (today.can_punch_in) {
    return {
      label: "Punch In",
      action: "in" as const,
      disabled: false,
      className: "bg-emerald-400 text-[#08101D] hover:brightness-110",
    };
  }

  if (today.can_punch_out) {
    return {
      label: "Punch Out",
      action: "out" as const,
      disabled: false,
      className: "bg-rose-500 text-white hover:bg-rose-400",
    };
  }

  if (today.status === "missed_punch") {
    return {
      label: "Needs Review",
      action: null as "in" | "out" | null,
      disabled: true,
      className: "border border-rose-400/20 bg-rose-500/15 text-rose-100",
    };
  }

  return {
    label: "Attendance Closed",
    action: null as "in" | "out" | null,
    disabled: true,
    className: "border border-white/10 bg-white/10 text-slate-200",
  };
}

export default function AttendancePage() {
  const { locale } = useI18n();
  const { user, activeFactory, loading, error: sessionError } = useSession();
  const [today, setToday] = useState<AttendanceToday | null>(null);
  const [selectedShift, setSelectedShift] = useState<AttendanceShift>("morning");
  const [pageLoading, setPageLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const loadAttendance = useCallback(
    async (options?: { background?: boolean }) => {
      if (!user) return;

      const shouldBackground = Boolean(options?.background);
      if (shouldBackground) {
        setRefreshing(true);
      } else {
        setPageLoading(true);
      }

      setError("");

      try {
        const next = await getMyAttendanceToday();
        setToday(next);
        setSelectedShift((current) =>
          !shouldBackground || !hasLoadedOnce || !next.can_punch_in ? next.shift : current || next.shift,
        );
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Could not load attendance.");
        }
        if (!shouldBackground) {
          setToday(null);
        }
      } finally {
        setHasLoadedOnce(true);
        setPageLoading(false);
        setRefreshing(false);
      }
    },
    [hasLoadedOnce, user],
  );

  useEffect(() => {
    setStatus("");
    setError("");
    setOptionsOpen(false);
    if (!user) {
      setToday(null);
      setSelectedShift("morning");
      setHasLoadedOnce(false);
      setPageLoading(true);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const timer = window.setTimeout(() => {
      void loadAttendance();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadAttendance, user]);

  useEffect(() => {
    if (!user) return;
    const refresh = () => {
      if (!document.hidden) {
        void loadAttendance({ background: true });
      }
    };
    const timer = window.setInterval(refresh, AUTO_REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [loadAttendance, user]);

  useEffect(() => {
    if (!user) return;
    return subscribeToWorkflowRefresh(() => {
      void loadAttendance({ background: true });
    });
  }, [loadAttendance, user]);

  useEffect(() => {
    const tick = window.setInterval(() => {
      setNowMs(Date.now());
    }, TIMER_TICK_MS);
    return () => window.clearInterval(tick);
  }, []);

  const workedMinutes = useMemo(() => deriveWorkedMinutes(today, nowMs), [nowMs, today]);
  const workedTime = useMemo(() => formatDuration(workedMinutes), [workedMinutes]);
  const displayShift = today?.can_punch_in ? selectedShift : today?.shift || selectedShift;
  const factoryName = today?.factory_name || activeFactory?.name || user?.factory_name || "Factory";
  const statusMeta = statusTheme(today?.status);
  const mainAction = buildMainAction(today);
  const lastActionAt = today?.punch_out_at || today?.punch_in_at || null;

  const summaryAlert = useMemo(() => {
    if (!today) return null;
    if (today.status === "missed_punch") {
      return "This attendance record needs supervisor review.";
    }
    if (today.status === "late" && today.late_minutes > 0) {
      return `Late by ${formatDuration(today.late_minutes)}.`;
    }
    if (today.can_punch_out) {
      return "Shift is running. Punch out when work is done.";
    }
    return null;
  }, [today]);

  async function handlePunch(action: "in" | "out") {
    setBusy(true);
    setStatus("");
    setError("");
    try {
      const next = await punchAttendance({
        action,
        shift: action === "in" ? selectedShift : undefined,
      });
      setToday(next);
      setSelectedShift(next.shift);
      setStatus(action === "in" ? "Punch in recorded." : "Punch out recorded.");
      await loadAttendance({ background: true });
      signalWorkflowRefresh(`attendance-${action}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Could not update attendance.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading || (pageLoading && Boolean(user) && !hasLoadedOnce)) {
    return (
      <main className="min-h-screen bg-bg px-4 py-8 md:px-6 pb-20 md:pb-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <Skeleton className="h-96 rounded-lg" />
          <div className="hidden gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_360px]">
            <Skeleton className="h-80 rounded-lg" />
            <Skeleton className="h-80 rounded-lg" />
          </div>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Attendance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-text-muted text-sm">
              {sessionError || "Please login to open attendance."}
            </p>
            <Link href="/login" className="mt-6 inline-block">
              <Button variant="primary" className="h-11 px-6">Open Login</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-bg px-4 py-6 text-text-primary md:px-6 lg:py-8 pb-20 md:pb-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {status ? (
          <div className="rounded-lg border border-color-success/25 bg-color-success/10 px-4 py-3 text-sm text-color-success">
            {status}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-lg border border-color-danger/25 bg-color-danger/10 px-4 py-3 text-sm text-color-danger">
            {error}
          </div>
        ) : null}
        {sessionError ? (
          <div className="rounded-lg border border-color-danger/25 bg-color-danger/10 px-4 py-3 text-sm text-color-danger">
            {sessionError}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Card className="surface-stage rounded-[2rem] border-0 shadow-none">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <span className="eyebrow-chip rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em]">
                      Attendance Desk
                    </span>
                    <span className="rounded-full border border-border bg-[rgba(255,255,255,0.04)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
                      {factoryName}
                    </span>
                    <span className="rounded-full border border-border bg-[rgba(255,255,255,0.04)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
                      Auto-refresh {refreshing ? "running" : "active"}
                    </span>
                  </div>
                  <div>
                    <CardTitle className="text-xl md:text-[2.3rem]">Punch status that stays clear on mobile</CardTitle>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
                      Keep the worker focused on one action, one shift state, and the exact moment the last attendance update was recorded.
                    </p>
                  </div>
                </div>
                <div className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] ${statusMeta.badge}`}>
                  <span className={`h-2.5 w-2.5 rounded-full ${statusMeta.dot}`} />
                  {statusText(today?.status)}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="signal-note rounded-[1.4rem] px-4 py-3 text-sm text-text-secondary">
                {today?.status === "working"
                  ? "Shift is open. The main button should stay visible until punch-out."
                  : today?.status === "not_punched"
                    ? "The desk is ready for a quick shift start."
                    : "Attendance details below show the latest state for today."}
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="metric-tile rounded-[1.35rem] p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted">Shift</div>
                  <div className="mt-3 text-2xl font-semibold text-text-primary">{formatShift(displayShift)}</div>
                  <div className="mt-1 text-sm text-text-secondary">Selected for today&apos;s attendance record.</div>
                </div>
                <div className="metric-tile rounded-[1.35rem] p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted">
                    {today?.status === "working" ? "Shift running" : "Worked time"}
                  </div>
                  <div className="mt-3 text-2xl font-semibold text-text-primary md:text-3xl">{workedTime}</div>
                  <div className="mt-1 text-sm text-text-secondary">
                    {today?.status === "working" ? "Live timer for the current shift." : "Tracked against today's punches."}
                  </div>
                </div>
                <div className="metric-tile rounded-[1.35rem] p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted">Last action</div>
                  <div className="mt-3 text-2xl font-semibold text-text-primary">{formatTime(lastActionAt, locale)}</div>
                  <div className="mt-1 text-sm text-text-secondary">Most recent punch recorded for this worker.</div>
                </div>
              </div>

              <div className="metric-tile rounded-[1.55rem] p-4 md:p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                  <div className="max-w-xl">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted">Main action</div>
                    <div className="mt-2 text-lg font-semibold text-text-primary">
                      {today?.can_punch_out ? "Close the running shift" : today?.can_punch_in ? "Start today's shift" : mainAction.label}
                    </div>
                    <div className="mt-2 text-sm leading-6 text-text-secondary">
                      {summaryAlert || "The primary action stays large and visible so a worker can finish attendance without hunting through extra controls."}
                    </div>
                  </div>
                  <div className="w-full md:w-auto md:min-w-[16rem]">
                    <Button
                      variant="primary"
                      className={`h-14 w-full text-lg font-semibold ${mainAction.className}`}
                      disabled={busy || mainAction.disabled}
                      onClick={mainAction.action ? () => void handlePunch(mainAction.action!) : undefined}
                    >
                      {busy && mainAction.action === "in"
                        ? "Recording..."
                        : busy && mainAction.action === "out"
                          ? "Closing..."
                          : mainAction.label}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="rounded-full border border-border bg-[rgba(255,255,255,0.04)] px-4 py-2 text-sm font-medium text-text-secondary transition hover:border-[rgba(77,163,255,0.28)] hover:text-text-primary"
                  onClick={() => setOptionsOpen((current) => !current)}
                >
                  {optionsOpen ? "Hide Options" : "More Options"}
                </button>
                <Link href="/attendance/reports">
                  <Button variant="outline" className="h-11 px-5">
                    View History
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  className="h-11 px-5"
                  onClick={() => void loadAttendance({ background: true })}
                  disabled={busy || refreshing}
                >
                  {refreshing ? "Refreshing..." : "Refresh"}
                </Button>
              </div>

              {optionsOpen ? (
                <div className="metric-tile rounded-[1.45rem] p-4 md:p-5">
                  <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-end">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-text-primary">Shift</label>
                      <Select
                        value={selectedShift}
                        onChange={(event) => setSelectedShift(event.target.value as AttendanceShift)}
                        disabled={busy || Boolean(today && !today.can_punch_in)}
                      >
                        {SHIFT_OPTIONS.map((shift) => (
                          <option key={shift} value={shift}>
                            {formatShift(shift)}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="signal-note rounded-[1.25rem] px-4 py-3 text-sm text-text-secondary">
                      Change the shift only before punch-in. Once the day is running, the desk keeps the record stable and ready for review.
                    </div>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <aside className="hidden lg:block">
            <Card className="sticky top-6 border border-border bg-card-elevated">
              <CardHeader>
                <div className="text-xs uppercase tracking-widest text-text-muted">Today Summary</div>
              </CardHeader>

              <CardContent className="space-y-6">
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between text-text-secondary">
                    <span>Worked</span>
                    <span className="font-semibold text-text-primary">{workedTime}</span>
                  </div>
                  <div className="flex items-center justify-between text-text-secondary">
                    <span>Last punch</span>
                    <span className="font-semibold text-text-primary">{formatTime(lastActionAt, locale)}</span>
                  </div>
                  <div className="flex items-center justify-between text-text-secondary">
                    <span>Shift</span>
                    <span className="font-semibold text-text-primary">{formatShift(displayShift)}</span>
                  </div>
                  <div className="flex items-center justify-between text-text-secondary">
                    <span>Status</span>
                    <span className="font-semibold text-text-primary">{statusText(today?.status)}</span>
                  </div>
                </div>

                {summaryAlert ? (
                  <div className="signal-note rounded-[1.15rem] px-3 py-3 text-xs text-text-secondary">
                    {summaryAlert}
                  </div>
                ) : null}

                <div className="metric-tile rounded-[1.2rem] p-3">
                  <div className="text-xs uppercase tracking-widest text-text-muted">Shift Status</div>
                  <div className="mt-2 inline-flex items-center gap-2 rounded-full px-2 py-1 text-xs font-semibold uppercase tracking-widest text-text-primary">
                    <span className={`h-2 w-2 rounded-full ${statusMeta.dot}`} />
                    {statusText(today?.status)}
                  </div>
                  <div className="mt-4 text-sm text-text-secondary">
                    {today?.status === "working"
                      ? "Timer is running for the open shift."
                      : today?.status === "late"
                        ? `Late recorded: ${formatDuration(today?.late_minutes || 0)}.`
                        : today?.status === "missed_punch"
                          ? "This record now needs supervisor review."
                          : today?.status === "completed"
                            ? "Today's attendance is already closed."
                            : "Ready for the next punch action."}
                  </div>
                </div>

                <div className="metric-tile rounded-[1.2rem] p-3 text-sm">
                  <div className="flex items-center justify-between text-text-secondary">
                    <span>Factory</span>
                    <span className="font-semibold text-text-primary">{factoryName}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-text-secondary">
                    <span>Auto-refresh</span>
                    <span className="font-semibold text-text-primary">{refreshing ? "Running" : "Active"}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </main>
  );
}
