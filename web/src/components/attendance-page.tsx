"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { SuccessBanner, MutationErrorBanner } from "@/shared/feedback";
import { ApiError } from "@/lib/api";
import {
  formatAttendanceStatusLabel,
  getMyAttendanceToday,
  punchAttendance,
  type AttendanceShift,
  type AttendanceStatus,
  type AttendanceToday,
} from "@/lib/attendance";
import { useI18n, useI18nNamespaces } from "@/lib/i18n";
import { useSession } from "@/lib/use-session";
import { signalWorkflowRefresh, subscribeToWorkflowRefresh } from "@/lib/workflow-sync";

const SHIFT_OPTIONS: AttendanceShift[] = ["morning", "evening", "night"];
const AUTO_REFRESH_MS = 25_000;
const TIMER_TICK_MS = 1_000;

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
  if (!today) {
    return 0;
  }

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

function statusTheme(status?: AttendanceStatus | null) {
  switch (status) {
    case "working":
      return {
        badge:
          "bg-[var(--status-success-bg)] text-[var(--status-success-fg)] border border-[var(--status-success-border)]",
        dot: "bg-[var(--status-success-icon)]",
      };
    case "late":
    case "half_day":
      return {
        badge:
          "bg-[var(--status-warning-bg)] text-[var(--status-warning-fg)] border border-[var(--status-warning-border)]",
        dot: "bg-[var(--status-warning-icon)]",
      };
    case "missed_punch":
    case "absent":
      return {
        badge:
          "bg-[var(--status-danger-bg)] text-[var(--status-danger-fg)] border border-[var(--status-danger-border)]",
        dot: "bg-[var(--status-danger-icon)]",
      };
    case "completed":
      return {
        badge:
          "bg-[var(--status-info-bg)] text-[var(--status-info-fg)] border border-[var(--status-info-border)]",
        dot: "bg-[var(--status-info-icon)]",
      };
    default:
      return {
        badge:
          "bg-[var(--surface-elevated)] text-text-primary border border-[var(--border-subtle)]",
        dot: "bg-text-tertiary",
      };
  }
}

export default function AttendancePage() {
  const { locale, t } = useI18n();
  useI18nNamespaces(["common", "attendance"]);

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
  const [justPunched, setJustPunched] = useState<"in" | "out" | null>(null);
  const [justPunchedAt, setJustPunchedAt] = useState<string | null>(null);
  const canOverrideShift = ["supervisor", "manager", "admin", "owner"].includes(user?.role || "");

  const shiftLabel = useCallback(
    (value?: string | null) => {
      if (!value) return "-";
      return t(`attendance.shift.${value}`, value.charAt(0).toUpperCase() + value.slice(1));
    },
    [t],
  );

  const statusLabel = useCallback(
    (value?: AttendanceStatus | null) => {
      switch (value) {
        case "working":
          return t("attendance.status.active_shift", "Shift in progress");
        case "late":
          return t("attendance.status.late", "Late arrival");
        case "missed_punch":
          return t("attendance.status.missed_punch", "Missed punch");
        case "completed":
          return t("attendance.status.shift_closed", "Attendance closed");
        case "half_day":
          return t("attendance.status.half_day", "Half day");
        case "absent":
          return t("attendance.status.absent", "Absent");
        default:
          return t("attendance.status.not_started", "Not started");
      }
    },
    [t],
  );

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
        setSelectedShift((current) => (!hasLoadedOnce || !current ? next.shift : current || next.shift));
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError(t("attendance.errors.load", "Could not load attendance."));
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
    [hasLoadedOnce, t, user],
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
  const displayShift = today?.shift || selectedShift;
  const factoryName = today?.factory_name || activeFactory?.name || user?.factory_name || "Factory";
  const statusMeta = statusTheme(today?.status);
  const lastActionAt = today?.punch_out_at || today?.punch_in_at || null;

  const mainAction = useMemo(() => {
    if (!today) {
      return {
        label: t("attendance.action.loading", "Loading..."),
        action: null as "in" | "out" | null,
        disabled: true,
        className:
          "border border-[var(--border-subtle)] bg-[var(--surface-elevated)] text-text-secondary",
      };
    }

    if (today.can_punch_in) {
      return {
        label: t("attendance.action.punch_in", "Punch in"),
        action: "in" as const,
        disabled: false,
        className:
          "bg-[var(--status-success-icon)] text-white hover:brightness-110 active:scale-[0.98] shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_4px_12px_rgba(0,0,0,0.4)]",
      };
    }

    if (today.can_punch_out) {
      return {
        label: t("attendance.action.punch_out", "Punch out"),
        action: "out" as const,
        disabled: false,
        className:
          "bg-[var(--status-danger-icon)] text-white hover:brightness-110 active:scale-[0.98] shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_4px_12px_rgba(0,0,0,0.4)]",
      };
    }

    if (today.status === "missed_punch") {
      return {
        label: t("attendance.action.needs_review", "Needs review"),
        action: null as "in" | "out" | null,
        disabled: true,
        className:
          "border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-fg)]",
      };
    }

    return {
      label: t("attendance.action.closed", "Attendance closed"),
      action: null as "in" | "out" | null,
      disabled: true,
      className:
        "border border-[var(--border-subtle)] bg-[var(--surface-elevated)] text-text-secondary",
    };
  }, [t, today]);

  const summaryAlert = useMemo(() => {
    if (!today) return null;
    if (today.status === "missed_punch") {
      return t("attendance.state.needs_review", "This attendance record needs supervisor review.");
    }
    if (today.status === "late" && today.late_minutes > 0) {
      return t("attendance.state.late_by", "Late by {{duration}}.", { duration: formatDuration(today.late_minutes) });
    }
    if (today.can_punch_out) {
      return t("attendance.state.running_notice", "Shift is running. Punch out when work is done.");
    }
    return null;
  }, [t, today]);

  const handleMainAction = () => {
    if (mainAction.action === "in" || mainAction.action === "out") {
      void handlePunch(mainAction.action);
    }
  };

  async function handlePunch(action: "in" | "out") {
    setBusy(true);
    setStatus("");
    setError("");
    try {
      const next = await punchAttendance({
        action,
        shift: action === "in" && canOverrideShift ? selectedShift : undefined,
      });
      setToday(next);
      setSelectedShift(next.shift);
      setJustPunched(action);
      setJustPunchedAt(new Date().toISOString());
      window.setTimeout(() => {
        setJustPunched(null);
        setJustPunchedAt(null);
      }, 3000);
      setStatus(action === "in" ? t("attendance.status.punch_in_recorded", "Punch in recorded.") : t("attendance.status.punch_out_recorded", "Punch out recorded."));
      await loadAttendance({ background: true });
      signalWorkflowRefresh(`attendance-${action}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(t("attendance.errors.update", "Could not update attendance."));
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading || (pageLoading && Boolean(user) && !hasLoadedOnce)) {
    return (
      <main className="min-h-screen bg-[var(--surface-app)] px-4 py-8 md:px-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <Skeleton className="h-[28rem] rounded-2xl" />
          <div className="hidden gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_360px]">
            <Skeleton className="h-[22rem] rounded-2xl" />
            <Skeleton className="h-[22rem] rounded-2xl" />
          </div>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--surface-app)] px-4">
        <div className="w-full max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 text-text-primary shadow-[var(--shadow-md)]">
          <div className="text-xl font-semibold">{t("attendance.title", "Attendance")}</div>
          <div className="mt-3 text-sm text-text-secondary">
            {sessionError || t("attendance.sign_in_required", "Please sign in to open attendance.")}
          </div>
          <Link href="/access" className="mt-6 inline-flex">
            <Button className="h-12 px-6">{t("dashboard.action.open_login", "Open access")}</Button>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--surface-app)] px-4 py-6 text-text-primary md:px-6 lg:py-8">
      {justPunched ? (
        <div
          className="animate-fade-in fixed inset-x-4 top-4 z-50 mx-auto max-w-md rounded-xl px-4 py-4 text-center text-white shadow-[var(--shadow-xl)]"
          style={{
            background:
              justPunched === "in" ? "var(--status-success-icon)" : "var(--status-danger-icon)",
          }}
          role="status"
          aria-live="polite"
        >
          <div className="text-lg font-semibold">
            {justPunched === "in"
              ? t("attendance.confirm.in", "Punched in ✓")
              : t("attendance.confirm.out", "Punched out ✓")}
          </div>
          <div className="mt-1 text-sm opacity-90 tabular-nums">
            {formatTime(justPunchedAt, locale)}
          </div>
        </div>
      ) : null}
      <div className="mx-auto max-w-6xl">
        {status ? (
          <SuccessBanner
            className="mb-4"
            message={status}
            onDismiss={() => setStatus("")}
          />
        ) : null}
        {error ? (
          <MutationErrorBanner
            className="mb-4"
            message={error}
            onDismiss={() => setError("")}
          />
        ) : null}
        {sessionError ? (
          <MutationErrorBanner className="mb-4" message={sessionError} />
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--shadow-md)]">
            <div className="text-base font-semibold text-text-primary">{factoryName}</div>

            <div className="mt-10 flex flex-col items-center text-center">
              <div className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold ${statusMeta.badge}`}>
                <span className={`h-2.5 w-2.5 rounded-full ${statusMeta.dot}`} />
                {statusLabel(today?.status)}
              </div>

              <div className="mt-5 text-2xl font-semibold md:text-3xl text-text-primary">{shiftLabel(displayShift)} {t("attendance.summary.shift", "shift")}</div>

              <div className="mt-8 text-xs font-medium text-text-tertiary">
                {today?.status === "working" ? t("attendance.main.shift_running", "Shift running") : t("attendance.main.worked_time", "Worked time")}
              </div>
              <div className="mt-3 text-5xl font-semibold tracking-tight text-text-primary md:text-6xl tabular-nums">{workedTime}</div>
              <div className="mt-2 text-sm text-text-secondary">
                {today?.status === "working"
                  ? t("attendance.main.worked", "Worked")
                  : today?.status === "not_punched"
                    ? t("attendance.main.ready", "Ready to start")
                    : t("attendance.main.today", "Today")}
              </div>
            </div>

            <div className="mt-10">
              <Button
                variant="ghost"
                className={`h-24 w-full rounded-xl text-2xl font-semibold ${mainAction.className}`}
                disabled={busy || mainAction.disabled}
                onClick={mainAction.action === "in" || mainAction.action === "out" ? handleMainAction : undefined}
              >
                {busy && mainAction.action === "in"
                  ? t("attendance.action.recording", "Recording...")
                  : busy && mainAction.action === "out"
                    ? t("attendance.action.closing", "Closing...")
                    : mainAction.label}
              </Button>
            </div>

            <div className="mt-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-shell)] px-4 py-4 text-center text-sm text-text-secondary">
              {t("attendance.main.last_action", "Last action:")} <span className="font-semibold text-text-primary tabular-nums">{formatTime(lastActionAt, locale)}</span>
            </div>

            <div className="mt-6 text-center">
              <button
                type="button"
                className="text-sm font-medium text-text-secondary hover:text-text-primary"
                onClick={() => setOptionsOpen((current) => !current)}
              >
                {optionsOpen ? t("attendance.main.hide_tools", "Hide tools") : t("attendance.main.show_tools", "Punch tools")}
              </button>
            </div>

            {optionsOpen ? (
              <div className="mt-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-shell)] p-4">
                {canOverrideShift && today?.can_punch_in ? (
                  <div>
                    <label className="text-sm text-text-secondary">{t("attendance.tools.shift", "Shift override")}</label>
                    <Select aria-label="Shift override" value={selectedShift} onChange={(event) => setSelectedShift(event.target.value as AttendanceShift)} disabled={busy}>
                      {SHIFT_OPTIONS.map((shift) => (
                        <option key={shift} value={shift}>
                          {shiftLabel(shift)}
                        </option>
                      ))}
                    </Select>
                    <div className="mt-2 text-xs text-text-tertiary">Manual shift override is kept for elevated attendance roles only.</div>
                  </div>
                ) : (
                  <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-4 py-4">
                    <div className="text-xs font-medium text-text-tertiary">{t("attendance.tools.shift", "Shift")}</div>
                    <div className="mt-2 text-sm font-semibold text-text-primary">{shiftLabel(displayShift)}</div>
                    <div className="mt-2 text-xs text-text-tertiary">Shift is assigned automatically from the employee profile or attendance rules.</div>
                  </div>
                )}

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Button
                    variant="outline"
                    className="h-11 w-full"
                    onClick={() => void loadAttendance({ background: true })}
                    disabled={busy || refreshing}
                  >
                    {refreshing ? t("common.loading", "Loading...") : t("common.refresh", "Refresh")}
                  </Button>
                  {canOverrideShift ? (
                    <Link href="/attendance/reports" className="block">
                      <Button variant="outline" className="h-11 w-full">
                        {t("attendance.tools.view_history", "View history")}
                      </Button>
                    </Link>
                  ) : (
                    <Link href="/attendance" className="block">
                      <Button variant="outline" className="h-11 w-full">
                        {t("attendance.tools.view_attendance", "My attendance")}
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            ) : null}
          </section>

          <aside className="hidden lg:block">
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--shadow-sm)]">
              <div className="text-xs font-medium text-text-tertiary">{t("attendance.summary.title", "Today's summary")}</div>

              <div className="mt-6 space-y-4 text-sm text-text-secondary">
                <div className="flex items-center justify-between">
                  <span>{t("attendance.summary.worked", "Worked")}</span>
                  <span className="font-semibold text-text-primary tabular-nums">{workedTime}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{t("attendance.summary.last_punch", "Last punch")}</span>
                  <span className="font-semibold text-text-primary tabular-nums">{formatTime(lastActionAt, locale)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{t("attendance.summary.shift", "Shift")}</span>
                  <span className="font-semibold text-text-primary">{shiftLabel(displayShift)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{t("attendance.summary.shift_status", "Shift status")}</span>
                  <span className="font-semibold text-text-primary">{statusLabel(today?.status)}</span>
                </div>
              </div>

              {summaryAlert ? (
                <div className="mt-6 rounded-lg border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-4 py-4 text-sm text-[var(--status-warning-fg)]">
                  {summaryAlert}
                </div>
              ) : null}

              {today?.late_warning ? (
                <div className="mt-4 rounded-lg border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-4 py-4 text-sm text-[var(--status-warning-fg)]">
                  {today.late_warning}
                </div>
              ) : null}

              <details className="mt-6 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-shell)] px-4 py-4">
                <summary className="cursor-pointer list-none text-sm font-semibold text-text-primary">{t("attendance.summary.shift_details", "Shift details")}</summary>
                <div className="mt-4 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-4 py-4">
                  <div className="text-xs font-medium text-text-tertiary">{t("attendance.summary.shift_status", "Shift status")}</div>
                  <div className="mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold text-text-primary">
                    <span className={`h-2.5 w-2.5 rounded-full ${statusMeta.dot}`} />
                    {formatAttendanceStatusLabel(today?.status)}
                  </div>
                  <div className="mt-4 text-sm text-text-secondary">
                    {today?.status === "working"
                      ? t("attendance.summary.timer_running", "Timer is running for the open shift.")
                      : today?.status === "late"
                        ? t("attendance.summary.late_recorded", "Late recorded: {{duration}}.", { duration: formatDuration(today?.late_minutes || 0) })
                        : today?.status === "missed_punch"
                          ? t("attendance.summary.needs_review", "This record now needs supervisor review.")
                          : today?.status === "completed"
                            ? t("attendance.summary.closed", "Today's attendance is already closed.")
                            : t("attendance.summary.ready", "Ready for the next punch action.")}
                  </div>
                </div>

                <div className="mt-4 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-4 py-4 text-sm text-text-secondary">
                  <div className="flex items-center justify-between">
                    <span>{t("attendance.summary.factory", "Factory")}</span>
                    <span className="font-semibold text-text-primary">{factoryName}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span>{t("attendance.summary.refresh", "Refresh")}</span>
                    <span className="font-semibold text-text-primary">{refreshing ? t("attendance.summary.refresh_running", "Running") : t("attendance.summary.refresh_auto", "Auto")}</span>
                  </div>
                </div>
              </details>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
