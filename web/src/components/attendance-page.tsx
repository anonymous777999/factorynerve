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
import { useMobileRouteFunnel } from "@/lib/mobile-route-funnel";
import { useOnlineStatus } from "@/lib/use-online-status";
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
  const trackPrimaryAction = useMobileRouteFunnel("/attendance", user?.role, Boolean(user));
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
  const online = useOnlineStatus();

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
  const resolvedMainAction = online
    ? mainAction
    : {
        label: "Reconnect to Punch",
        action: null,
        disabled: true,
        className: "border border-amber-400/24 bg-amber-500/15 text-amber-100",
      };
  const lastActionAt = today?.punch_out_at || today?.punch_in_at || null;
  const canEditShift = Boolean(today?.can_punch_in);
  const offlineNotice = !online
    ? "Attendance punch actions need a live connection. Reconnect before recording punch in or punch out."
    : null;

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
      trackPrimaryAction("mark_attendance");
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
      <main className="min-h-screen bg-bg px-4 py-8 shell-bottom-clearance md:px-6 md:pb-8">
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
              {sessionError || "Login required."}
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
    <main className="min-h-screen bg-bg px-4 py-6 text-text-primary shell-bottom-clearance md:px-6 md:pb-8 lg:py-8">
      <div className="mx-auto max-w-6xl">
        {status ? (
          <div className="mb-4 rounded-lg border border-color-success/25 bg-color-success/10 px-4 py-3 text-sm text-color-success">
            {status}
          </div>
        ) : null}
        {error ? (
          <div className="mb-4 rounded-lg border border-color-danger/25 bg-color-danger/10 px-4 py-3 text-sm text-color-danger">
            {error}
          </div>
        ) : null}
        {sessionError ? (
          <div className="mb-4 rounded-lg border border-color-danger/25 bg-color-danger/10 px-4 py-3 text-sm text-color-danger">
            {sessionError}
          </div>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6">
          <Card className="border border-border bg-card-elevated">
            <CardHeader>
              <div className="space-y-2">
                <div className="text-[0.68rem] uppercase tracking-[0.28em] text-text-muted">Attendance Desk</div>
                <CardTitle className="text-lg md:text-xl">{factoryName}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 sm:space-y-8">
              <div className="flex flex-col items-center text-center">
                <div className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-widest ${statusMeta.badge}`}>
                  <span className={`h-2.5 w-2.5 rounded-full ${statusMeta.dot}`} />
                  {statusText(today?.status)}
                </div>

                <div className="mt-5 text-[1.75rem] font-bold leading-tight sm:mt-6 md:text-4xl">{formatShift(displayShift)} Shift</div>

                <div className="mt-6 text-[0.68rem] uppercase tracking-[0.28em] text-text-muted sm:mt-8">
                  {today?.status === "working" ? "Shift running" : "Worked time"}
                </div>
                <div className="mt-2 text-[2.35rem] font-bold tracking-tight sm:mt-3 sm:text-4xl md:text-5xl">{workedTime}</div>
                <div className="mt-2 text-sm text-text-secondary">
                  {today?.status === "working" ? "Worked" : today?.status === "not_punched" ? "Ready to start" : "Today"}
                </div>
              </div>

              <Button
                variant="primary"
                className={`h-[3.25rem] w-full text-base font-semibold sm:h-14 sm:text-lg ${resolvedMainAction.className}`}
                disabled={busy || resolvedMainAction.disabled}
                onClick={resolvedMainAction.action ? () => void handlePunch(resolvedMainAction.action!) : undefined}
              >
                {busy && resolvedMainAction.action === "in"
                  ? "Recording..."
                  : busy && resolvedMainAction.action === "out"
                    ? "Closing..."
                    : resolvedMainAction.label}
              </Button>

              <div className="rounded-md border border-border bg-card-elevated px-4 py-3 text-center text-sm text-text-secondary">
                Last action: <span className="font-semibold text-text-primary">{formatTime(lastActionAt, locale)}</span>
              </div>

              {offlineNotice ? (
                <div className="rounded-xl border border-amber-400/24 bg-amber-500/12 px-4 py-3 text-sm text-amber-100">
                  {offlineNotice}
                </div>
              ) : null}

              <div className="grid gap-3 lg:hidden sm:grid-cols-2">
                <div className="rounded-xl border border-border bg-card px-4 py-3">
                  <div className="text-[0.68rem] uppercase tracking-[0.24em] text-text-muted">Worked</div>
                  <div className="mt-2 text-lg font-semibold text-text-primary">{workedTime}</div>
                </div>
                <div className="rounded-xl border border-border bg-card px-4 py-3">
                  <div className="text-[0.68rem] uppercase tracking-[0.24em] text-text-muted">Last punch</div>
                  <div className="mt-2 text-lg font-semibold text-text-primary">{formatTime(lastActionAt, locale)}</div>
                </div>
                <div className="rounded-xl border border-border bg-card px-4 py-3">
                  <div className="text-[0.68rem] uppercase tracking-[0.24em] text-text-muted">Shift</div>
                  <div className="mt-2 text-lg font-semibold text-text-primary">{formatShift(displayShift)}</div>
                </div>
                <div className="rounded-xl border border-border bg-card px-4 py-3">
                  <div className="text-[0.68rem] uppercase tracking-[0.24em] text-text-muted">Status</div>
                  <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-text-primary">
                    <span className={`h-2 w-2 rounded-full ${statusMeta.dot}`} />
                    {statusText(today?.status)}
                  </div>
                </div>
              </div>

              {summaryAlert ? (
                <div className="rounded-xl border border-color-warning/25 bg-color-warning/10 px-4 py-3 text-sm text-color-warning lg:hidden">
                  {summaryAlert}
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <Button
                  variant="outline"
                  className="h-11 w-full"
                  onClick={() => void loadAttendance({ background: true })}
                  disabled={busy || refreshing || !online}
                >
                  {!online ? "Offline" : refreshing ? "Refreshing..." : "Refresh"}
                </Button>
                <Link href="/attendance/reports" className="block">
                  <Button variant="outline" className="h-11 w-full">
                    View History
                  </Button>
                </Link>
              </div>

              {canEditShift ? (
                <div className="space-y-3">
                  <div className="text-center">
                    <button
                      type="button"
                      className="text-sm font-medium text-text-secondary transition hover:text-text-primary"
                      onClick={() => setOptionsOpen((current) => !current)}
                    >
                      {optionsOpen ? "Hide Shift Picker" : `Change Shift (${formatShift(selectedShift)})`}
                    </button>
                  </div>
                </div>
              ) : null}

              {canEditShift && optionsOpen ? (
                <Card className="bg-card-elevated border border-border">
                  <CardContent className="space-y-4 pt-5 sm:pt-6">
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">Shift</label>
                      <Select
                        value={selectedShift}
                        onChange={(event) => setSelectedShift(event.target.value as AttendanceShift)}
                        disabled={busy || !canEditShift}
                      >
                        {SHIFT_OPTIONS.map((shift) => (
                          <option key={shift} value={shift}>
                            {formatShift(shift)}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </CardContent>
          </Card>

          <aside className="hidden lg:block">
            <Card className="border border-border bg-card-elevated sticky top-6">
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
                  <div className="rounded-md border border-color-warning/25 bg-color-warning/10 px-3 py-2 text-xs text-color-warning">
                    {summaryAlert}
                  </div>
                ) : null}

                <div className="rounded-md border border-border bg-card p-3">
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

                <div className="rounded-md border border-border bg-card p-3 text-sm">
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
