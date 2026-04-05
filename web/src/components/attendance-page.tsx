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
      <main className="min-h-screen bg-[#0B0F19] px-4 py-8 md:px-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <Skeleton className="h-[28rem] rounded-[2rem]" />
          <div className="hidden gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_360px]">
            <Skeleton className="h-[22rem] rounded-[2rem]" />
            <Skeleton className="h-[22rem] rounded-[2rem]" />
          </div>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0B0F19] px-4">
        <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white/5 p-6 text-white">
          <div className="text-xl font-semibold">Attendance</div>
          <div className="mt-3 text-sm text-slate-300">
            {sessionError || "Please login to open attendance."}
          </div>
          <Link href="/login" className="mt-6 inline-flex">
            <Button className="h-12 px-6">Open Login</Button>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0B0F19] px-4 py-6 text-white md:px-6 lg:py-8">
      <div className="mx-auto max-w-6xl">
        {status ? (
          <div className="mb-4 rounded-[20px] border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {status}
          </div>
        ) : null}
        {error ? (
          <div className="mb-4 rounded-[20px] border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}
        {sessionError ? (
          <div className="mb-4 rounded-[20px] border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {sessionError}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,25,40,0.96),rgba(11,15,25,0.98))] p-6 shadow-[0_24px_80px_rgba(6,10,18,0.48)]">
            <div className="text-base font-semibold tracking-wide text-slate-100">{factoryName}</div>

            <div className="mt-10 flex flex-col items-center text-center">
              <div className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] ${statusMeta.badge}`}>
                <span className={`h-2.5 w-2.5 rounded-full ${statusMeta.dot}`} />
                {statusText(today?.status)}
              </div>

              <div className="mt-5 text-2xl font-semibold md:text-3xl">{formatShift(displayShift)} Shift</div>

              <div className="mt-8 text-sm uppercase tracking-[0.22em] text-slate-400">
                {today?.status === "working" ? "Shift running" : "Worked time"}
              </div>
              <div className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">{workedTime}</div>
              <div className="mt-2 text-sm text-slate-300">
                {today?.status === "working" ? "Worked" : today?.status === "not_punched" ? "Ready to start" : "Today"}
              </div>
            </div>

            <div className="mt-10">
              <Button
                variant="ghost"
                className={`h-20 w-full rounded-[28px] text-xl font-semibold ${mainAction.className}`}
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

            <div className="mt-8 rounded-[24px] border border-white/10 bg-white/5 px-4 py-4 text-center text-sm text-slate-300">
              Last action: <span className="font-semibold text-white">{formatTime(lastActionAt, locale)}</span>
            </div>

            <div className="mt-6 text-center">
              <button
                type="button"
                className="text-sm font-medium text-slate-300 transition hover:text-white"
                onClick={() => setOptionsOpen((current) => !current)}
              >
                {optionsOpen ? "Hide Options" : "More Options"}
              </button>
            </div>

            {optionsOpen ? (
              <div className="mt-4 rounded-[24px] border border-white/10 bg-white/5 p-4">
                <div>
                  <label className="text-sm text-slate-300">Shift</label>
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

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Button
                    variant="outline"
                    className="h-11 w-full"
                    onClick={() => void loadAttendance({ background: true })}
                    disabled={busy || refreshing}
                  >
                    {refreshing ? "Refreshing..." : "Refresh"}
                  </Button>
                  <Link href="/attendance/reports" className="block">
                    <Button variant="ghost" className="h-11 w-full rounded-[22px] border border-white/10 bg-white/5">
                      View History
                    </Button>
                  </Link>
                </div>
              </div>
            ) : null}
          </section>

          <aside className="hidden lg:block">
            <div className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(14,21,36,0.96),rgba(11,15,25,0.98))] p-6 shadow-[0_20px_70px_rgba(6,10,18,0.32)]">
              <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Today Summary</div>

              <div className="mt-6 space-y-4 text-sm text-slate-300">
                <div className="flex items-center justify-between">
                  <span>Worked</span>
                  <span className="font-semibold text-white">{workedTime}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Last punch</span>
                  <span className="font-semibold text-white">{formatTime(lastActionAt, locale)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Shift</span>
                  <span className="font-semibold text-white">{formatShift(displayShift)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Shift status</span>
                  <span className="font-semibold text-white">{statusText(today?.status)}</span>
                </div>
              </div>

              {summaryAlert ? (
                <div className="mt-6 rounded-[24px] border border-amber-400/20 bg-amber-500/10 px-4 py-4 text-sm text-amber-100">
                  {summaryAlert}
                </div>
              ) : null}

              <div className="mt-6 rounded-[24px] border border-white/10 bg-white/5 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Shift Status</div>
                <div className="mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                  <span className={`h-2.5 w-2.5 rounded-full ${statusMeta.dot}`} />
                  {statusText(today?.status)}
                </div>
                <div className="mt-4 text-sm text-slate-300">
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

              <div className="mt-6 rounded-[24px] border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-300">
                <div className="flex items-center justify-between">
                  <span>Factory</span>
                  <span className="font-semibold text-white">{factoryName}</span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span>Refresh</span>
                  <span className="font-semibold text-white">{refreshing ? "Running" : "Auto"}</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
