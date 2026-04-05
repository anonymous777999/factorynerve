"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  getLiveAttendance,
  getMyAttendanceToday,
  listAttendanceReview,
  type AttendanceLive,
  type AttendanceReviewPayload,
  type AttendanceToday,
} from "@/lib/attendance";
import { type AlertItem, listUnreadAlerts, markAlertRead } from "@/lib/dashboard";
import { type Entry, getTodayEntries, listEntries } from "@/lib/entries";
import {
  countQueuedEntries,
  loadDraft,
  subscribeToQueueUpdates,
  type EntryDraft,
} from "@/lib/offline-entries";
import { listOcrVerifications, type OcrVerificationRecord } from "@/lib/ocr";
import {
  listSteelReconciliations,
  type SteelReconciliation,
} from "@/lib/steel";
import { useSession } from "@/lib/use-session";
import { subscribeToWorkflowRefresh } from "@/lib/workflow-sync";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const ALL_SHIFTS = ["morning", "evening", "night"] as const;

type QueueSection = "today" | "review" | "alerts";
type QueueTone = "action" | "watch" | "danger" | "good";
type QueueLoadErrors = Partial<Record<QueueSection, string>>;
type WorkerTaskSectionTone = "danger" | "watch" | "normal";

const AUTO_REFRESH_MS = 25_000;
const RAIL_COUNT_REFRESH_EVENT = "dpr:rail-counts-refresh";

type QueueItem = {
  id: string;
  section: QueueSection;
  title: string;
  detail: string;
  href: string;
  action: string;
  tone: QueueTone;
  meta?: string;
  priority: number;
  alertId?: number;
  isOverflow?: boolean;
};

type WorkQueueState = {
  attendanceToday: AttendanceToday | null;
  attendanceLive: AttendanceLive | null;
  attendanceReview: AttendanceReviewPayload | null;
  todayEntries: Entry[];
  alerts: AlertItem[];
  pendingEntries: Entry[];
  pendingEntryTotal: number;
  pendingVerifications: OcrVerificationRecord[];
  pendingReconciliations: SteelReconciliation[];
  queueCount: number;
  draft: EntryDraft | null;
};

function emptyState(): WorkQueueState {
  return {
    attendanceToday: null,
    attendanceLive: null,
    attendanceReview: null,
    todayEntries: [],
    alerts: [],
    pendingEntries: [],
    pendingEntryTotal: 0,
    pendingVerifications: [],
    pendingReconciliations: [],
    queueCount: 0,
    draft: null,
  };
}

function localDateValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
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

function formatShift(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "-";
}

function roleCanSubmit(role?: string | null) {
  return ["operator", "supervisor", "manager", "admin", "owner"].includes(role || "");
}

function roleCanReview(role?: string | null) {
  return ["supervisor", "manager", "admin", "owner"].includes(role || "");
}

function roleCanSeeControl(role?: string | null) {
  return ["manager", "admin", "owner"].includes(role || "");
}

function toneClass(tone: QueueTone) {
  switch (tone) {
    case "danger":
      return "border-red-400/35 bg-[rgba(239,68,68,0.12)]";
    case "watch":
      return "border-amber-400/35 bg-[rgba(245,158,11,0.12)]";
    case "good":
      return "border-emerald-400/35 bg-[rgba(34,197,94,0.12)]";
    default:
      return "border-sky-400/35 bg-[rgba(56,189,248,0.12)]";
  }
}

function toneBadgeClass(tone: QueueTone) {
  switch (tone) {
    case "danger":
      return "border-red-400/35 bg-[rgba(239,68,68,0.12)] text-red-100";
    case "watch":
      return "border-amber-400/35 bg-[rgba(245,158,11,0.12)] text-amber-100";
    case "good":
      return "border-emerald-400/35 bg-[rgba(34,197,94,0.12)] text-emerald-100";
    default:
      return "border-sky-400/35 bg-[rgba(56,189,248,0.12)] text-sky-100";
  }
}

function sectionLabel(section: QueueSection) {
  switch (section) {
    case "today":
      return "Today";
    case "review":
      return "Review";
    default:
      return "Alerts";
  }
}

function workerSectionLabel(tone: WorkerTaskSectionTone) {
  switch (tone) {
    case "danger":
      return "Action Required";
    case "watch":
      return "Continue Work";
    default:
      return "Other Tasks";
  }
}

function workerSectionAccent(tone: WorkerTaskSectionTone) {
  switch (tone) {
    case "danger":
      return {
        badge: "border-red-400/30 bg-[rgba(239,68,68,0.12)] text-red-100",
        panel: "border-red-400/18 bg-[linear-gradient(180deg,rgba(36,17,24,0.92),rgba(15,18,28,0.98))]",
      };
    case "watch":
      return {
        badge: "border-amber-400/30 bg-[rgba(245,158,11,0.12)] text-amber-100",
        panel: "border-amber-400/18 bg-[linear-gradient(180deg,rgba(34,25,12,0.92),rgba(15,18,28,0.98))]",
      };
    default:
      return {
        badge: "border-white/12 bg-white/5 text-slate-200",
        panel: "border-white/10 bg-[linear-gradient(180deg,rgba(20,24,36,0.92),rgba(11,15,25,0.98))]",
      };
  }
}

export default function WorkQueuePage() {
  const { user, loading, error: sessionError, activeFactory, organization } = useSession();
  const [state, setState] = useState<WorkQueueState>(() => emptyState());
  const [pageLoading, setPageLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [sectionErrors, setSectionErrors] = useState<QueueLoadErrors>({});
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [markingAlertIds, setMarkingAlertIds] = useState<Record<number, boolean>>({});
  const [filter, setFilter] = useState<"all" | QueueSection>("all");

  const canSubmit = roleCanSubmit(user?.role);
  const canReview = roleCanReview(user?.role);
  const canSeeControl = roleCanSeeControl(user?.role);
  const isSteelFactory = (activeFactory?.industry_type || "").toLowerCase() === "steel";
  const isWorkerQueue = user?.role === "operator";

  const loadQueue = useCallback(
    async (options?: { background?: boolean }) => {
      if (!user) {
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
        const tasks: Array<Promise<unknown>> = [listUnreadAlerts()];
        const indexes = {
          alerts: 0,
          attendanceToday: -1,
          attendanceLive: -1,
          todayEntries: -1,
          draft: -1,
          offlineQueue: -1,
          pendingEntries: -1,
          attendanceReview: -1,
          pendingVerifications: -1,
          pendingReconciliations: -1,
        };

        indexes.attendanceToday = tasks.length;
        tasks.push(getMyAttendanceToday());

        if (canSubmit) {
          indexes.todayEntries = tasks.length;
          tasks.push(getTodayEntries());
          indexes.draft = tasks.length;
          tasks.push(loadDraft(user.id));
          indexes.offlineQueue = tasks.length;
          tasks.push(countQueuedEntries(user.id));
        }

        if (canReview) {
          indexes.attendanceLive = tasks.length;
          tasks.push(getLiveAttendance());
          indexes.pendingEntries = tasks.length;
          tasks.push(listEntries({ status: ["pending"], page: 1, page_size: 6 }));
          indexes.attendanceReview = tasks.length;
          tasks.push(listAttendanceReview());
          indexes.pendingVerifications = tasks.length;
          tasks.push(listOcrVerifications("pending"));

          if (isSteelFactory) {
            indexes.pendingReconciliations = tasks.length;
            tasks.push(listSteelReconciliations({ status: "pending", limit: 6 }));
          }
        }

        const results = await Promise.allSettled(tasks);
        const nextErrors: QueueLoadErrors = {};

        const markSectionError = (
          section: QueueSection,
          fallbackMessage: string,
          reason?: unknown,
        ) => {
          if (nextErrors[section]) return;
          nextErrors[section] =
            reason instanceof Error && reason.message ? reason.message : fallbackMessage;
        };

        setState((current) => {
          const retainCurrent = shouldBackground;
          const nextState = retainCurrent ? { ...current } : emptyState();

          if (!canSubmit) {
            nextState.todayEntries = [];
            nextState.draft = null;
            nextState.queueCount = 0;
          }
          if (!canReview) {
            nextState.attendanceLive = null;
            nextState.attendanceReview = null;
            nextState.pendingEntries = [];
            nextState.pendingEntryTotal = 0;
            nextState.pendingVerifications = [];
            nextState.pendingReconciliations = [];
          }

          const alertsResult = results[indexes.alerts];
          if (alertsResult?.status === "fulfilled") {
            nextState.alerts = alertsResult.value as AlertItem[];
          } else {
            markSectionError(
              "alerts",
              "Alerts are temporarily unavailable.",
              alertsResult?.status === "rejected" ? alertsResult.reason : undefined,
            );
          }

          if (indexes.attendanceToday >= 0) {
            const attendanceTodayResult = results[indexes.attendanceToday];
            if (attendanceTodayResult?.status === "fulfilled") {
              nextState.attendanceToday = attendanceTodayResult.value as AttendanceToday;
            } else if (attendanceTodayResult?.status === "rejected") {
              markSectionError(
                "today",
                "Today status is stale. Refresh to retry.",
                attendanceTodayResult.reason,
              );
            }
          }

          if (indexes.attendanceLive >= 0) {
            const attendanceLiveResult = results[indexes.attendanceLive];
            if (attendanceLiveResult?.status === "fulfilled") {
              nextState.attendanceLive = attendanceLiveResult.value as AttendanceLive;
            } else if (attendanceLiveResult?.status === "rejected") {
              markSectionError(
                "review",
                "Review counts are delayed. Try again in a moment.",
                attendanceLiveResult.reason,
              );
            }
          }

          if (indexes.todayEntries >= 0) {
            const todayEntriesResult = results[indexes.todayEntries];
            if (todayEntriesResult?.status === "fulfilled") {
              nextState.todayEntries = todayEntriesResult.value as Entry[];
            } else if (todayEntriesResult?.status === "rejected") {
              markSectionError(
                "today",
                "Today entries could not be refreshed.",
                todayEntriesResult.reason,
              );
            }
          }

          if (indexes.draft >= 0) {
            const draftResult = results[indexes.draft];
            if (draftResult?.status === "fulfilled") {
              nextState.draft = draftResult.value as EntryDraft | null;
            } else if (draftResult?.status === "rejected") {
              markSectionError(
                "today",
                "Saved draft status is unavailable right now.",
                draftResult.reason,
              );
            }
          }

          if (indexes.offlineQueue >= 0) {
            const queueResult = results[indexes.offlineQueue];
            if (queueResult?.status === "fulfilled") {
              nextState.queueCount = queueResult.value as number;
            } else if (queueResult?.status === "rejected") {
              markSectionError(
                "today",
                "Offline sync status could not be checked.",
                queueResult.reason,
              );
            }
          }

          if (indexes.pendingEntries >= 0) {
            const pendingEntriesResult = results[indexes.pendingEntries];
            if (pendingEntriesResult?.status === "fulfilled") {
              const payload = pendingEntriesResult.value as { items: Entry[]; total: number };
              nextState.pendingEntries = payload.items || [];
              nextState.pendingEntryTotal = payload.total || 0;
            } else if (pendingEntriesResult?.status === "rejected") {
              markSectionError(
                "review",
                "Review queue is partially unavailable.",
                pendingEntriesResult.reason,
              );
            }
          }

          if (indexes.attendanceReview >= 0) {
            const attendanceReviewResult = results[indexes.attendanceReview];
            if (attendanceReviewResult?.status === "fulfilled") {
              nextState.attendanceReview = attendanceReviewResult.value as AttendanceReviewPayload;
            } else if (attendanceReviewResult?.status === "rejected") {
              markSectionError(
                "review",
                "Attendance review summary could not be loaded.",
                attendanceReviewResult.reason,
              );
            }
          }

          if (indexes.pendingVerifications >= 0) {
            const pendingVerificationsResult = results[indexes.pendingVerifications];
            if (pendingVerificationsResult?.status === "fulfilled") {
              nextState.pendingVerifications =
                pendingVerificationsResult.value as OcrVerificationRecord[];
            } else if (pendingVerificationsResult?.status === "rejected") {
              markSectionError(
                "review",
                "OCR verification list is delayed.",
                pendingVerificationsResult.reason,
              );
            }
          }

          if (indexes.pendingReconciliations >= 0) {
            const pendingReconciliationsResult = results[indexes.pendingReconciliations];
            if (pendingReconciliationsResult?.status === "fulfilled") {
              nextState.pendingReconciliations =
                (pendingReconciliationsResult.value as { items: SteelReconciliation[] }).items || [];
            } else if (pendingReconciliationsResult?.status === "rejected") {
              markSectionError(
                "review",
                "Stock review items are delayed.",
                pendingReconciliationsResult.reason,
              );
            }
          }

          return nextState;
        });

        const failedCount = results.filter((result) => result.status === "rejected").length;
        setSectionErrors(nextErrors);
        if (failedCount === results.length) {
          setError("Could not refresh the queue. Check network and retry.");
        }
        setLastUpdatedAt(new Date().toISOString());
        setHasLoadedOnce(true);
      } finally {
        setPageLoading(false);
        setRefreshing(false);
      }
    },
    [canReview, canSubmit, isSteelFactory, user],
  );

  useEffect(() => {
    setMarkingAlertIds({});
    setSectionErrors({});
    setLastUpdatedAt(null);
    setError("");
    if (!user) {
      setState(emptyState());
      setHasLoadedOnce(false);
      setPageLoading(true);
      return;
    }
    setState(emptyState());
    setHasLoadedOnce(false);
  }, [user]);

  useEffect(() => {
    if (!user) {
      return;
    }
    const timer = window.setTimeout(() => {
      void loadQueue();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadQueue, user]);

  useEffect(() => {
    if (!user) {
      return;
    }
    const onVisibility = () => {
      if (!document.hidden) {
        void loadQueue({ background: true });
      }
    };
    const timer = window.setInterval(() => {
      if (!document.hidden) {
        void loadQueue({ background: true });
      }
    }, AUTO_REFRESH_MS);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [loadQueue, user]);

  useEffect(() => {
    if (!user || !canSubmit) return;
    const refreshOffline = () => {
      Promise.allSettled([countQueuedEntries(user.id), loadDraft(user.id)]).then(
        ([queueResult, draftResult]) => {
          setState((current) => ({
            ...current,
            queueCount: queueResult.status === "fulfilled" ? queueResult.value : current.queueCount,
            draft: draftResult.status === "fulfilled" ? draftResult.value : current.draft,
          }));
        },
      );
    };
    refreshOffline();
    return subscribeToQueueUpdates(refreshOffline);
  }, [canSubmit, user]);

  useEffect(() => {
    if (!user) return;
    return subscribeToWorkflowRefresh(() => {
      void loadQueue({ background: true });
    });
  }, [loadQueue, user]);

  const markAlertAsRead = useCallback(
    async (alertId: number) => {
      if (markingAlertIds[alertId]) {
        return;
      }
      setMarkingAlertIds((current) => ({ ...current, [alertId]: true }));
      try {
        await markAlertRead(alertId);
        setState((current) => ({
          ...current,
          alerts: current.alerts.filter((alert) => alert.id !== alertId),
        }));
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event(RAIL_COUNT_REFRESH_EVENT));
        }
      } catch (actionError) {
        setError(actionError instanceof Error ? actionError.message : "Could not mark alert as read.");
      } finally {
        setMarkingAlertIds((current) => {
          const next = { ...current };
          delete next[alertId];
          return next;
        });
      }
    },
    [markingAlertIds],
  );

  const submittedShifts = useMemo(
    () => new Set(state.todayEntries.map((entry) => entry.shift)),
    [state.todayEntries],
  );

  const missingShifts = useMemo(
    () => ALL_SHIFTS.filter((shift) => !submittedShifts.has(shift)),
    [submittedShifts],
  );

  const queueItems = useMemo(() => {
    const items: QueueItem[] = [];
    const today = localDateValue();

    if (state.attendanceToday?.status === "not_punched") {
      items.push({
        id: "attendance-punch",
        section: "today",
        title: "Attendance punch is still open",
        detail: `${formatShift(state.attendanceToday.shift)} shift has not been punched in for ${formatDate(state.attendanceToday.attendance_date)}.`,
        href: "/attendance",
        action: "Punch In",
        tone: "action",
        meta: "Attendance",
        priority: 104,
      });
    }

    if (canReview && state.attendanceLive && state.attendanceLive.totals.not_punched > 0) {
      items.push({
        id: "attendance-live",
        section: "today",
        title: `${state.attendanceLive.totals.not_punched} teammate${state.attendanceLive.totals.not_punched === 1 ? "" : "s"} still need attendance`,
        detail: `Live board for ${state.attendanceLive.factory_name} shows open attendance follow-up for the current date.`,
        href: "/attendance/live",
        action: "Open Live Board",
        tone: state.attendanceLive.totals.not_punched > 3 ? "watch" : "action",
        meta: "Attendance board",
        priority: 90,
      });
    }

    if (canReview && state.attendanceReview && state.attendanceReview.totals.pending_records > 0) {
      items.push({
        id: "attendance-review",
        section: "review",
        title: `${state.attendanceReview.totals.pending_records} attendance review item${state.attendanceReview.totals.pending_records === 1 ? "" : "s"} waiting`,
        detail: `${state.attendanceReview.totals.pending_regularizations} regularization request${state.attendanceReview.totals.pending_regularizations === 1 ? "" : "s"} and ${state.attendanceReview.totals.missed_punch} missed punch case${state.attendanceReview.totals.missed_punch === 1 ? "" : "s"} are open.`,
        href: "/attendance/review",
        action: "Open Review",
        tone: state.attendanceReview.totals.missed_punch > 0 ? "danger" : "watch",
        meta: "Attendance review",
        priority: 88,
      });
    }

    if (canSubmit) {
      missingShifts.forEach((shift, index) => {
        items.push({
          id: `missing-shift-${shift}`,
          section: "today",
          title: `${formatShift(shift)} shift entry is still open`,
          detail: `No ${shift} shift entry has been recorded for ${formatDate(today)} in the active factory.`,
          href: `/entry?date=${today}&shift=${shift}`,
          action: "Open Entry",
          tone: index === 0 ? "action" : "watch",
          meta: `Shift ${formatShift(shift)}`,
          priority: index === 0 ? 100 : 92 - index,
        });
      });

      if (state.draft) {
        items.push({
          id: "saved-draft",
          section: "today",
          title: "Saved draft is waiting",
          detail: `${formatShift(state.draft.shift)} shift draft saved for ${formatDate(state.draft.date)}.`,
          href: `/entry?date=${state.draft.date}&shift=${state.draft.shift}&focus=draft`,
          action: "Continue Draft",
          tone: "watch",
          meta: "Local draft",
          priority: 89,
        });
      }

      if (state.queueCount > 0) {
        items.push({
          id: "offline-queue",
          section: "today",
          title: "Offline work still needs sync",
          detail: `${state.queueCount} offline item${state.queueCount === 1 ? "" : "s"} are still waiting on this device.`,
          href: "/entry?focus=offline",
          action: "Open Entry & Sync",
          tone: "watch",
          meta: "Offline queue",
          priority: 88,
        });
      }
    }

    const visibleAlerts = state.alerts.slice(0, 4);
    visibleAlerts.forEach((alert, index) => {
      const severity = (alert.severity || "").toLowerCase();
      items.push({
        id: `alert-${alert.id}`,
        section: "alerts",
        title: alert.message,
        detail: `${alert.alert_type || "Factory alert"}${alert.created_at ? ` | ${formatDateTime(alert.created_at)}` : ""}`,
        href: "/dashboard",
        action: "Open Board",
        tone: severity === "high" ? "danger" : severity === "medium" ? "watch" : "action",
        meta: `Alert ${index + 1}`,
        priority: severity === "high" ? 96 : severity === "medium" ? 84 : 72,
        alertId: alert.id,
      });
    });
    const hiddenAlertsCount = Math.max(0, state.alerts.length - visibleAlerts.length);
    if (hiddenAlertsCount > 0) {
      items.push({
        id: "alerts-overflow",
        section: "alerts",
        title: `${hiddenAlertsCount} more alert${hiddenAlertsCount === 1 ? "" : "s"} waiting`,
        detail: "Open dashboard alerts to clear the remaining unread items.",
        href: "/dashboard",
        action: "View All Alerts",
        tone: "watch",
        meta: "More alerts",
        priority: 62,
        isOverflow: true,
      });
    }

    state.pendingEntries.forEach((entry) => {
      items.push({
        id: `entry-${entry.id}`,
        section: "review",
        title: `${formatShift(entry.shift)} entry is waiting for review`,
        detail: `${formatDate(entry.date)} | ${entry.submitted_by || "Team member"} | ${entry.units_produced} produced / ${entry.units_target} target`,
        href: `/entry/${entry.id}`,
        action: "Review Entry",
        tone: "action",
        meta: `Entry #${entry.id}`,
        priority: 86,
      });
    });
    const hiddenPendingEntries = Math.max(0, state.pendingEntryTotal - state.pendingEntries.length);
    if (hiddenPendingEntries > 0) {
      items.push({
        id: "entries-overflow",
        section: "review",
        title: `${hiddenPendingEntries} more DPR entr${hiddenPendingEntries === 1 ? "y" : "ies"} pending`,
        detail: "Open the review queue to process all pending entries.",
        href: "/approvals",
        action: "Open Review Queue",
        tone: "watch",
        meta: "More entries",
        priority: 60,
        isOverflow: true,
      });
    }

    const visibleVerifications = state.pendingVerifications.slice(0, 4);
    visibleVerifications.forEach((record) => {
      items.push({
        id: `ocr-${record.id}`,
        section: "review",
        title: `OCR verification is waiting`,
        detail: `${record.source_filename || `Record #${record.id}`} | ${record.avg_confidence.toFixed(0)}% confidence`,
        href: "/ocr/verify",
        action: "Open OCR Review",
        tone: record.avg_confidence < 75 ? "watch" : "action",
        meta: `OCR #${record.id}`,
        priority: record.avg_confidence < 75 ? 82 : 78,
      });
    });
    const hiddenVerificationsCount = Math.max(
      0,
      state.pendingVerifications.length - visibleVerifications.length,
    );
    if (hiddenVerificationsCount > 0) {
      items.push({
        id: "ocr-overflow",
        section: "review",
        title: `${hiddenVerificationsCount} more OCR check${hiddenVerificationsCount === 1 ? "" : "s"} pending`,
        detail: "Open OCR review to clear the full verification queue.",
        href: "/ocr/verify",
        action: "Open OCR Review",
        tone: "watch",
        meta: "More OCR",
        priority: 58,
        isOverflow: true,
      });
    }

    const visibleReconciliations = state.pendingReconciliations.slice(0, 4);
    visibleReconciliations.forEach((row) => {
      items.push({
        id: `reconciliation-${row.id}`,
        section: "review",
        title: `${row.item_name || row.item_code || "Inventory item"} needs stock review`,
        detail: `${Math.abs(row.variance_kg).toFixed(2)} KG variance | confidence ${row.confidence_status}`,
        href: "/steel/reconciliations",
        action: "Open Stock Review",
        tone: row.confidence_status === "red" ? "danger" : "watch",
        meta: `Reconciliation #${row.id}`,
        priority: row.confidence_status === "red" ? 94 : 80,
      });
    });
    const hiddenReconciliationCount = Math.max(
      0,
      state.pendingReconciliations.length - visibleReconciliations.length,
    );
    if (hiddenReconciliationCount > 0) {
      items.push({
        id: "reconciliation-overflow",
        section: "review",
        title: `${hiddenReconciliationCount} more stock review item${hiddenReconciliationCount === 1 ? "" : "s"} pending`,
        detail: "Open stock review to resolve the full reconciliation list.",
        href: "/steel/reconciliations",
        action: "Open Stock Review",
        tone: "watch",
        meta: "More stock checks",
        priority: 56,
        isOverflow: true,
      });
    }

    return items.sort((left, right) => right.priority - left.priority);
  }, [canReview, canSubmit, missingShifts, state.alerts, state.attendanceLive, state.attendanceReview, state.attendanceToday, state.draft, state.pendingEntries, state.pendingEntryTotal, state.pendingReconciliations, state.pendingVerifications, state.queueCount]);

  const filteredItems = useMemo(() => {
    if (filter === "all") return queueItems;
    return queueItems.filter((item) => item.section === filter);
  }, [filter, queueItems]);

  const sectionErrorEntries = useMemo(
    () => Object.entries(sectionErrors) as Array<[QueueSection, string]>,
    [sectionErrors],
  );

  const filterCounts = useMemo(
    () => ({
      all: queueItems.length,
      today: queueItems.filter((item) => item.section === "today").length,
      review: queueItems.filter((item) => item.section === "review").length,
      alerts: queueItems.filter((item) => item.section === "alerts").length,
    }),
    [queueItems],
  );

  const quickActions = useMemo(() => {
    const actions: Array<{ label: string; href: string; variant?: "primary" | "outline" | "ghost" }> = [];

    actions.push({ label: "Attendance", href: "/attendance", variant: "outline" });

    if (canSubmit) {
      actions.push({ label: "New Shift Entry", href: `/entry?date=${localDateValue()}` });
      actions.push({ label: "Upload Document", href: "/ocr/scan", variant: "outline" });
    }

    if (canReview) {
      actions.push({ label: "Open Review Queue", href: "/approvals", variant: "outline" });
    }

    if (isSteelFactory) {
      actions.push({ label: "Open Steel Ops", href: "/steel", variant: "outline" });
    }

    actions.push({ label: "Open Reports", href: "/reports", variant: "ghost" });

    if (canSeeControl && (organization?.accessible_factories || 0) > 1) {
      actions.push({ label: "Factory Network", href: "/control-tower", variant: "ghost" });
    }

    return actions.slice(0, 3);
  }, [canReview, canSeeControl, canSubmit, isSteelFactory, organization?.accessible_factories]);

  const workerPrimaryTask = useMemo<QueueItem | null>(() => {
    if (!canSubmit) {
      return null;
    }

    if (state.attendanceToday?.status === "not_punched") {
      return {
        id: "worker-attendance-punch",
        section: "today",
        title: "Attendance punch is still open",
        detail: `${formatShift(state.attendanceToday.shift)} shift is ready to start for ${formatDate(state.attendanceToday.attendance_date)}.`,
        href: "/attendance",
        action: "Punch In",
        tone: "danger",
        priority: 110,
      };
    }

    if (!state.draft && missingShifts.length > 0) {
      const shift = missingShifts[0];
      return {
        id: `worker-open-shift-${shift}`,
        section: "today",
        title: `${formatShift(shift)} shift entry is pending`,
        detail: `No ${shift} entry has been submitted for ${formatDate(localDateValue())}.`,
        href: `/entry?date=${localDateValue()}&shift=${shift}`,
        action: "Start Entry",
        tone: "danger",
        priority: 100,
      };
    }

    return null;
  }, [canSubmit, missingShifts, state.attendanceToday, state.draft]);

  const workerContinueTasks = useMemo<QueueItem[]>(() => {
    if (!canSubmit) {
      return [];
    }

    const items: QueueItem[] = [];

    if (state.draft) {
      items.push({
        id: "worker-draft",
        section: "today",
        title: "Saved draft available",
        detail: `${formatShift(state.draft.shift)} shift draft was saved for ${formatDate(state.draft.date)}.`,
        href: `/entry?date=${state.draft.date}&shift=${state.draft.shift}&focus=draft`,
        action: "Continue",
        tone: "watch",
        priority: 94,
      });
    }

    if (state.queueCount > 0) {
      items.push({
        id: "worker-offline-queue",
        section: "today",
        title: "Saved offline work is waiting",
        detail: `${state.queueCount} item${state.queueCount === 1 ? "" : "s"} still need sync on this device.`,
        href: "/entry?focus=offline",
        action: "Open & Sync",
        tone: "watch",
        priority: 82,
      });
    }

    return items;
  }, [canSubmit, state.draft, state.queueCount]);

  const workerOtherTasks = useMemo<QueueItem[]>(() => {
    if (!canSubmit) {
      return [];
    }

    const startIndex = !state.draft && missingShifts.length > 0 ? 1 : 0;
    return missingShifts.slice(startIndex).map((shift, index) => ({
      id: `worker-other-shift-${shift}`,
      section: "today",
      title: `${formatShift(shift)} shift entry is open`,
      detail: `Start the ${shift} shift entry when current work is done.`,
      href: `/entry?date=${localDateValue()}&shift=${shift}`,
      action: "Open",
      tone: "good",
      priority: 70 - index,
    }));
  }, [canSubmit, missingShifts, state.draft]);

  const workerCriticalAlerts = useMemo(
    () => state.alerts.filter((alert) => (alert.severity || "").toLowerCase() === "high").slice(0, 2),
    [state.alerts],
  );

  const workerQueueStatus = useMemo(() => {
    if (state.attendanceToday?.status === "not_punched") {
      return {
        label: "Shift not started",
        tone: "border-red-400/30 bg-[rgba(239,68,68,0.12)] text-red-100",
      };
    }

    if (state.draft) {
      return {
        label: "Draft in progress",
        tone: "border-amber-400/30 bg-[rgba(245,158,11,0.12)] text-amber-100",
      };
    }

    if (missingShifts.length > 0) {
      return {
        label: `${missingShifts.length} shift pending`,
        tone: "border-sky-400/30 bg-[rgba(56,189,248,0.12)] text-sky-100",
      };
    }

    return {
      label: "Queue clear",
      tone: "border-emerald-400/30 bg-[rgba(34,197,94,0.12)] text-emerald-100",
    };
  }, [missingShifts.length, state.attendanceToday, state.draft]);

  const workerTaskSections = useMemo(
    () =>
      [
        {
          key: "action-required",
          tone: "danger" as const,
          items: workerPrimaryTask ? [workerPrimaryTask] : [],
        },
        {
          key: "continue-work",
          tone: "watch" as const,
          items: workerContinueTasks,
        },
        {
          key: "other-tasks",
          tone: "normal" as const,
          items: workerOtherTasks,
        },
      ].filter((section) => section.items.length > 0),
    [workerContinueTasks, workerOtherTasks, workerPrimaryTask],
  );

  const workerPendingCount = useMemo(
    () =>
      workerTaskSections.reduce((sum, section) => sum + section.items.length, 0),
    [workerTaskSections],
  );

  if (loading || (pageLoading && Boolean(user) && !hasLoadedOnce)) {
    return (
      <main className="min-h-screen px-4 py-8 md:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <Skeleton className="h-40 rounded-[2rem]" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-32 rounded-2xl" />
            ))}
          </div>
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <Skeleton className="h-[32rem] rounded-2xl" />
            <Skeleton className="h-[32rem] rounded-2xl" />
          </div>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen px-4 py-8 md:px-8">
        <div className="mx-auto max-w-4xl">
          <Card>
            <CardHeader>
              <div className="text-sm uppercase tracking-[0.26em] text-[var(--accent)]">Work Queue</div>
              <CardTitle>Please login to open the shared work queue</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Link href="/login">
                <Button>Open Login</Button>
              </Link>
              <Link href="/dashboard">
                <Button variant="outline">Back to Dashboard</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  if (isWorkerQueue) {
    return (
      <main className="min-h-screen bg-[#0B0F19] px-4 py-6 md:px-6 lg:py-8">
        <div className="mx-auto max-w-6xl space-y-4">
          {error ? (
            <div className="rounded-[20px] border border-red-400/30 bg-[rgba(239,68,68,0.12)] px-4 py-3 text-sm text-red-100">
              {error}
            </div>
          ) : null}
          {sessionError ? (
            <div className="rounded-[20px] border border-red-400/30 bg-[rgba(239,68,68,0.12)] px-4 py-3 text-sm text-red-100">
              {sessionError}
            </div>
          ) : null}
          {sectionErrorEntries.length ? (
            <section className="grid gap-2 md:grid-cols-3">
              {sectionErrorEntries.map(([section, message]) => (
                <div
                  key={section}
                  className="rounded-[20px] border border-amber-400/30 bg-[rgba(245,158,11,0.12)] px-4 py-3 text-xs text-amber-100"
                >
                  <div className="font-semibold uppercase tracking-[0.14em]">{sectionLabel(section)}</div>
                  <div className="mt-1 leading-5">{message}</div>
                </div>
              ))}
            </section>
          ) : null}

          <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,24,36,0.96),rgba(11,15,25,0.98))] p-6 shadow-[0_24px_80px_rgba(6,10,18,0.42)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[rgba(62,166,255,0.88)]">
                  {activeFactory?.name || user.factory_name || "Factory"}
                </div>
                <h1 className="mt-2 text-3xl font-semibold text-white">Work Queue</h1>
                <div className="mt-3 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/90">
                  <span className={`rounded-full border px-3 py-1 ${workerQueueStatus.tone}`}>
                    {workerQueueStatus.label}
                  </span>
                </div>
              </div>
              <div className="space-y-2 text-sm text-slate-300 sm:text-right">
                <Button
                  variant="outline"
                  className="h-11 px-5"
                  onClick={() => {
                    void loadQueue({ background: true });
                  }}
                  disabled={refreshing}
                >
                  {refreshing ? "Refreshing..." : "Refresh"}
                </Button>
                <div className="text-xs text-slate-400">
                  {refreshing
                    ? "Updating queue..."
                    : lastUpdatedAt
                      ? `Updated ${formatDateTime(lastUpdatedAt)}`
                      : "Live updates every 25 seconds"}
                </div>
              </div>
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <section className="space-y-4">
              {workerTaskSections.length ? (
                workerTaskSections.map((section) => {
                  const accent = workerSectionAccent(section.tone);
                  return (
                    <div
                      key={section.key}
                      className={`rounded-[30px] border p-5 shadow-[0_18px_50px_rgba(3,8,20,0.24)] ${accent.panel}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span
                          className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${accent.badge}`}
                        >
                          {workerSectionLabel(section.tone)}
                        </span>
                        <span className="text-xs text-slate-400">
                          {section.items.length} task{section.items.length === 1 ? "" : "s"}
                        </span>
                      </div>

                      <div className="mt-4 space-y-3">
                        {section.items.map((item) => (
                          <div
                            key={item.id}
                            className="rounded-[24px] border border-white/10 bg-[rgba(8,12,20,0.45)] px-4 py-4"
                          >
                            <div className="text-lg font-semibold text-white">{item.title}</div>
                            <div className="mt-2 text-sm leading-6 text-slate-300">{item.detail}</div>
                            <div className="mt-4">
                              <Link href={item.href}>
                                <Button
                                  variant={section.tone === "danger" ? "primary" : "outline"}
                                  className="h-11 min-w-[9rem] px-5"
                                >
                                  {item.action}
                                </Button>
                              </Link>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-[30px] border border-emerald-400/18 bg-[linear-gradient(180deg,rgba(16,32,24,0.92),rgba(11,15,25,0.98))] p-6 shadow-[0_18px_50px_rgba(3,8,20,0.24)]">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-100">
                    All Clear
                  </div>
                  <div className="mt-3 text-2xl font-semibold text-white">No tasks are waiting right now</div>
                  <div className="mt-2 text-sm text-slate-300">
                    Today&apos;s shift work looks covered in this queue.
                  </div>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link href="/dashboard">
                      <Button>Open Dashboard</Button>
                    </Link>
                    <Link href="/reports">
                      <Button variant="outline">View Report</Button>
                    </Link>
                  </div>
                </div>
              )}
            </section>

            <aside className="space-y-4">
              <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(16,22,36,0.96),rgba(11,15,25,0.98))] p-5 shadow-[0_20px_60px_rgba(6,10,18,0.32)]">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Today</div>
                <div className="mt-4 grid gap-3">
                  <div className="rounded-[20px] border border-white/10 bg-[rgba(8,12,20,0.48)] px-4 py-3">
                    <div className="text-xs text-slate-400">Pending</div>
                    <div className="mt-2 text-2xl font-semibold text-white">{workerPendingCount}</div>
                  </div>
                  <div className="rounded-[20px] border border-white/10 bg-[rgba(8,12,20,0.48)] px-4 py-3">
                    <div className="text-xs text-slate-400">Completed</div>
                    <div className="mt-2 text-2xl font-semibold text-white">{state.todayEntries.length}</div>
                  </div>
                  <div className="rounded-[20px] border border-white/10 bg-[rgba(8,12,20,0.48)] px-4 py-3">
                    <div className="text-xs text-slate-400">Critical Alerts</div>
                    <div className="mt-2 text-2xl font-semibold text-white">{workerCriticalAlerts.length}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-[rgba(255,255,255,0.04)] p-5">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Alerts</div>
                {workerCriticalAlerts.length ? (
                  <div className="mt-4 space-y-3">
                    {workerCriticalAlerts.map((alert) => (
                      <div
                        key={alert.id}
                        className="rounded-[20px] border border-red-400/30 bg-[rgba(239,68,68,0.12)] px-4 py-3"
                      >
                        <div className="text-sm font-semibold text-red-100">{alert.message}</div>
                        <div className="mt-2 text-xs text-red-100/80">
                          {alert.created_at ? formatDateTime(alert.created_at) : "Critical alert"}
                        </div>
                      </div>
                    ))}
                    <Link href="/dashboard">
                      <Button variant="outline" className="mt-1 h-11 w-full">
                        Open Alerts
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="mt-4 rounded-[20px] border border-emerald-400/20 bg-[rgba(34,197,94,0.1)] px-4 py-3 text-sm text-emerald-100">
                    No critical alerts are waiting right now.
                  </div>
                )}
              </div>
            </aside>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[2rem] border border-[var(--border)] bg-[linear-gradient(135deg,rgba(20,24,36,0.96),rgba(12,18,28,0.9))] p-6 shadow-2xl backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-4xl">
              <div className="text-sm uppercase tracking-[0.3em] text-[var(--accent)]">Daily Coordination</div>
              <h1 className="mt-2 text-3xl font-semibold md:text-4xl">Work Queue</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                One place for open work, review load, unread alerts, and the next actions your team should take in the current factory context.
              </p>
            </div>
            <div className="space-y-3 text-sm text-[var(--muted)]">
              <div>
                Active factory: <span className="font-semibold text-[var(--text)]">{activeFactory?.name || user.factory_name}</span>
              </div>
              <div className="mt-1">
                Organization: <span className="font-semibold text-[var(--text)]">{organization?.name || "Current organization"}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  className="px-4 py-2 text-xs"
                  onClick={() => {
                    void loadQueue({ background: true });
                  }}
                  disabled={refreshing}
                >
                  {refreshing ? "Refreshing..." : "Refresh Queue"}
                </Button>
                <span className="text-xs text-[var(--muted)]">
                  {refreshing
                    ? "Updating queue..."
                    : lastUpdatedAt
                      ? `Updated ${formatDateTime(lastUpdatedAt)}`
                      : "Live updates every 25 seconds"}
                </span>
              </div>
            </div>
          </div>

          {quickActions.length ? (
            <div className="mt-5 flex flex-wrap gap-3">
              {quickActions.map((action) => (
                <Link key={action.href} href={action.href}>
                  <Button variant={action.variant || "primary"}>{action.label}</Button>
                </Link>
              ))}
            </div>
          ) : null}
        </section>

        {error ? <div className="rounded-2xl border border-red-400/30 bg-[rgba(239,68,68,0.12)] px-4 py-3 text-sm text-red-100">{error}</div> : null}
        {sessionError ? <div className="rounded-2xl border border-red-400/30 bg-[rgba(239,68,68,0.12)] px-4 py-3 text-sm text-red-100">{sessionError}</div> : null}
        {refreshing ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] px-4 py-3 text-sm text-[var(--muted)]">
            Refreshing queue data in the background...
          </div>
        ) : null}
        {sectionErrorEntries.length ? (
          <section className="grid gap-2 md:grid-cols-3">
            {sectionErrorEntries.map(([section, message]) => (
              <div
                key={section}
                className="rounded-2xl border border-amber-400/30 bg-[rgba(245,158,11,0.12)] px-4 py-3 text-xs text-amber-100"
              >
                <div className="font-semibold uppercase tracking-[0.14em]">{sectionLabel(section)}</div>
                <div className="mt-1 leading-5">{message}</div>
              </div>
            ))}
          </section>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">Open Items</div>
              <CardTitle>{filterCounts.all}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-[var(--muted)]">
              Combined queue items across daily work, review, and alerts.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">Today</div>
              <CardTitle>{filterCounts.today}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-[var(--muted)]">
              Missing shifts, saved draft work, and offline queue follow-up.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">Review</div>
              <CardTitle>{filterCounts.review}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-[var(--muted)]">
              Pending entry approvals, OCR checks, and stock trust decisions.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">Unread Alerts</div>
              <CardTitle>{state.alerts.length}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-[var(--muted)]">
              Factory alerts waiting for attention on the operations board.
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm text-[var(--muted)]">Queue View</div>
                  <CardTitle className="text-xl">Open work in priority order</CardTitle>
                </div>
                <div className="flex flex-wrap gap-2">
                  {([
                    ["all", "All"],
                    ["today", "Today"],
                    ["review", "Review"],
                    ["alerts", "Alerts"],
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
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {filteredItems.length ? filteredItems.map((item) => (
                <div key={item.id} className={`rounded-2xl border p-4 ${toneClass(item.tone)}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${toneBadgeClass(item.tone)}`}>
                          {sectionLabel(item.section)}
                        </span>
                        {item.meta ? <span className="text-xs text-[var(--muted)]">{item.meta}</span> : null}
                      </div>
                      <div className="text-sm font-semibold text-[var(--text)]">{item.title}</div>
                      <div className="text-xs leading-5 text-[var(--muted)]">{item.detail}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link href={item.href}>
                        <Button variant={item.isOverflow ? "primary" : "outline"} className="px-4 py-2 text-xs">
                          {item.action}
                        </Button>
                      </Link>
                      {typeof item.alertId === "number" ? (
                        <Button
                          variant="ghost"
                          className="px-4 py-2 text-xs"
                          onClick={() => {
                            void markAlertAsRead(item.alertId!);
                          }}
                          disabled={Boolean(markingAlertIds[item.alertId!])}
                        >
                          {markingAlertIds[item.alertId!] ? "Marking..." : "Mark Read"}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              )) : (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-5 text-sm text-[var(--muted)]">
                  No items are waiting in this queue view right now.
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="text-sm text-[var(--muted)]">Queue Snapshot</div>
                <CardTitle className="text-xl">Where the work is stacking up</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-[var(--muted)]">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                  <div className="text-xs uppercase tracking-[0.16em]">Pending DPR Review</div>
                  <div className="mt-2 text-2xl font-semibold text-[var(--text)]">{state.pendingEntryTotal}</div>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                  <div className="text-xs uppercase tracking-[0.16em]">OCR Waiting</div>
                  <div className="mt-2 text-2xl font-semibold text-[var(--text)]">{state.pendingVerifications.length}</div>
                </div>
                {isSteelFactory ? (
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                    <div className="text-xs uppercase tracking-[0.16em]">Stock Reviews</div>
                    <div className="mt-2 text-2xl font-semibold text-[var(--text)]">{state.pendingReconciliations.length}</div>
                  </div>
                ) : null}
                {canSubmit ? (
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                    <div className="text-xs uppercase tracking-[0.16em]">Open Shifts Today</div>
                    <div className="mt-2 text-2xl font-semibold text-[var(--text)]">{missingShifts.length}</div>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="text-sm text-[var(--muted)]">Recent Signals</div>
                <CardTitle className="text-xl">Immediate context</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-[var(--muted)]">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                  <div className="font-semibold text-[var(--text)]">Submitted today</div>
                  <div className="mt-1">
                    {state.todayEntries.length
                      ? `${state.todayEntries.length} shift entr${state.todayEntries.length === 1 ? "y has" : "ies have"} already been recorded.`
                      : "No shift entries have been recorded in this factory today."}
                  </div>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                  <div className="font-semibold text-[var(--text)]">Latest alert time</div>
                  <div className="mt-1">
                    {state.alerts[0]?.created_at ? formatDateTime(state.alerts[0].created_at) : "No recent unread alerts."}
                  </div>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                  <div className="font-semibold text-[var(--text)]">Offline status</div>
                  <div className="mt-1">
                    {state.queueCount > 0
                      ? `${state.queueCount} item${state.queueCount === 1 ? "" : "s"} still need sync on this device.`
                      : "This device has no waiting offline work."}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}
