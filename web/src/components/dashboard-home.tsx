"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { logout } from "@/lib/auth";
import { getAnomalyPreview, type AnomalyResponse } from "@/lib/ai";
import { ApiError, formatApiErrorMessage } from "@/lib/api";
import { getMyAttendanceToday, type AttendanceStatus, type AttendanceToday } from "@/lib/attendance";
import { listUnreadAlerts, getUsage, getWeeklyAnalytics, markAlertRead, type AlertItem, type UsageSummary, type WeeklyAnalyticsPoint } from "@/lib/dashboard";
import { createEntry, getEntryConflict, getTodayEntries, listEntries, type Entry } from "@/lib/entries";
import { countQueuedEntries, flushQueue, loadDraft, subscribeToQueueUpdates, type EntryDraft } from "@/lib/offline-entries";
import { useI18n } from "@/lib/i18n";
import { getOcrVerificationSummary, type OcrVerificationSummary } from "@/lib/ocr";
import { useSession } from "@/lib/use-session";
import { signalWorkflowRefresh, subscribeToWorkflowRefresh } from "@/lib/workflow-sync";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardPageSkeleton } from "@/components/page-skeletons";

const ALL_SHIFTS = ["morning", "evening", "night"] as const;

type DashboardState = {
  attendanceToday: AttendanceToday | null;
  draft: EntryDraft | null;
  todayEntries: Entry[];
  recentEntries: Entry[];
  usage: UsageSummary | null;
  alerts: AlertItem[];
  weekly: WeeklyAnalyticsPoint[];
  analyticsLocked: boolean;
  anomalyPreview: AnomalyResponse | null;
  anomalyLocked: boolean;
  ocrSummary: OcrVerificationSummary | null;
};

type LaunchGuideStep = {
  title: string;
  detail: string;
  href: string;
  action: string;
};

type RoleLaunchGuide = {
  eyebrow: string;
  title: string;
  detail: string;
  steps: LaunchGuideStep[];
};

type DashboardQuickLink = {
  href: string;
  label: string;
  variant: "outline" | "ghost";
};

type DashboardSnapshotCard = {
  label: string;
  value: string | number;
  detail: string;
  href: string;
  action: string;
};

function emptyState(): DashboardState {
  return {
    attendanceToday: null,
    draft: null,
    todayEntries: [],
    recentEntries: [],
    usage: null,
    alerts: [],
    weekly: [],
    analyticsLocked: false,
    anomalyPreview: null,
    anomalyLocked: false,
    ocrSummary: null,
  };
}

function formatShift(value: string) {
  return value ? value[0].toUpperCase() + value.slice(1) : "-";
}

function formatDate(value?: string, locale = "en-IN") {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value?: string, locale = "en-IN") {
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
  const safeValue = Math.max(0, value || 0);
  const hours = Math.floor(safeValue / 60);
  const minutes = safeValue % 60;
  return `${hours}h ${minutes}m`;
}

function attendanceStatusTone(status?: AttendanceStatus | null) {
  switch (status) {
    case "working":
      return "border-emerald-400/30 bg-[rgba(34,197,94,0.12)] text-emerald-100";
    case "late":
    case "half_day":
      return "border-amber-400/30 bg-[rgba(245,158,11,0.12)] text-amber-100";
    case "missed_punch":
    case "absent":
      return "border-red-400/30 bg-[rgba(239,68,68,0.12)] text-red-100";
    case "completed":
      return "border-sky-400/30 bg-[rgba(56,189,248,0.12)] text-sky-100";
    default:
      return "border-white/10 bg-[rgba(255,255,255,0.04)] text-slate-200";
  }
}

function todayValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function severityTone(severity?: string) {
  switch ((severity || "").toLowerCase()) {
    case "high":
      return "border-[var(--danger)]/40 bg-[rgba(239,68,68,0.12)] text-red-200";
    case "medium":
      return "border-[var(--warning)]/40 bg-[rgba(245,158,11,0.12)] text-amber-100";
    default:
      return "border-[var(--success)]/30 bg-[rgba(34,197,94,0.12)] text-emerald-100";
  }
}

function progressPercent(used?: number, max?: number) {
  if (!max || max <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round(((used || 0) / max) * 100)));
}

function usageWarning(used?: number, max?: number) {
  if (!max || max <= 0) return "";
  const ratio = (used || 0) / max;
  if (ratio >= 1) return "Quota reached. Upgrade now or wait for monthly reset.";
  if (ratio >= 0.9) return "Quota almost full (90%+). Plan your next upgrade.";
  if (ratio >= 0.75) return "Quota warning: over 75% consumed this month.";
  return "";
}

function signalRailCountsRefresh() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("dpr:rail-counts-refresh"));
  }
}

export default function DashboardHome() {
  const { t, locale } = useI18n();
  const { user, loading, error: sessionError, activeFactory, factories, organization } = useSession();
  const [state, setState] = useState<DashboardState>(() => emptyState());
  const [queueCount, setQueueCount] = useState(0);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [online, setOnline] = useState(true);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    if (!user) return;
    setDashboardLoading(true);
    setError("");
    const workerMode = user.role === "operator";

    const tasks: Array<Promise<unknown>> = [
      getTodayEntries(),
      workerMode ? Promise.resolve({ items: [] }) : listEntries({ page: 1, page_size: 50 }),
      workerMode ? Promise.resolve(null) : getUsage(),
      listUnreadAlerts(),
      workerMode ? Promise.resolve([]) : getWeeklyAnalytics(),
      workerMode ? Promise.resolve(null) : getAnomalyPreview(),
      workerMode ? Promise.resolve(null) : getOcrVerificationSummary(),
      countQueuedEntries(user.id),
      workerMode ? getMyAttendanceToday() : Promise.resolve(null),
      workerMode ? loadDraft(user.id) : Promise.resolve(null),
    ];
    const results = await Promise.allSettled(tasks);

    const nextState = emptyState();
    let nextQueueCount = 0;
    let nextError = "";

    const todayResult = results[0];
    if (todayResult.status === "fulfilled") {
      nextState.todayEntries = todayResult.value as Entry[];
    } else {
      nextError = todayResult.reason instanceof Error ? todayResult.reason.message : "Could not load today's entries.";
    }

    const listResult = results[1];
    if (listResult.status === "fulfilled") {
      const listPayload = listResult.value as { items: Entry[] };
      nextState.recentEntries = [...listPayload.items].sort((a, b) =>
        String(b.created_at || "").localeCompare(String(a.created_at || "")),
      );
    } else if (!nextError) {
      nextError = listResult.reason instanceof Error ? listResult.reason.message : "Could not load recent entries.";
    }

    const usageResult = results[2];
    if (usageResult.status === "fulfilled") {
      nextState.usage = usageResult.value as UsageSummary;
    }

    const alertResult = results[3];
    if (alertResult.status === "fulfilled") {
      nextState.alerts = alertResult.value as AlertItem[];
    }

    const weeklyResult = results[4];
    if (weeklyResult.status === "fulfilled") {
      nextState.weekly = weeklyResult.value as WeeklyAnalyticsPoint[];
    } else if (weeklyResult.reason instanceof ApiError && weeklyResult.reason.status === 403) {
      nextState.analyticsLocked = true;
    } else if (!nextError) {
      nextError =
        weeklyResult.reason instanceof Error
          ? weeklyResult.reason.message
          : "Could not load weekly analytics.";
    }

    const anomalyResult = results[5];
    if (anomalyResult.status === "fulfilled") {
      nextState.anomalyPreview = anomalyResult.value as AnomalyResponse;
    } else if (anomalyResult.reason instanceof ApiError && anomalyResult.reason.status === 403) {
      nextState.anomalyLocked = true;
    } else if (!nextError) {
      nextError =
        anomalyResult.reason instanceof Error
          ? anomalyResult.reason.message
          : "Could not load anomaly preview.";
    }

    const ocrSummaryResult = results[6];
    if (ocrSummaryResult.status === "fulfilled") {
      nextState.ocrSummary = ocrSummaryResult.value as OcrVerificationSummary | null;
    }

    const queueResultShifted = results[7];
    if (queueResultShifted.status === "fulfilled") {
      nextQueueCount = queueResultShifted.value as number;
    }

    const attendanceResult = results[8];
    if (attendanceResult?.status === "fulfilled") {
      nextState.attendanceToday = attendanceResult.value as AttendanceToday | null;
    }

    const draftResult = results[9];
    if (draftResult?.status === "fulfilled") {
      nextState.draft = draftResult.value as EntryDraft | null;
    }

    setState(nextState);
    setQueueCount(nextQueueCount);
    setError(nextError);
    setDashboardLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    loadDashboard().catch((err) => {
      setDashboardLoading(false);
      setError(err instanceof Error ? err.message : "Dashboard failed to load.");
    });
  }, [loadDashboard, user]);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    setOnline(navigator.onLine);
  }, []);

  useEffect(() => {
    if (!user) return;
    const refreshQueueCount = () => {
      Promise.allSettled([countQueuedEntries(user.id), loadDraft(user.id)]).then(([queueResult, draftResult]) => {
        if (queueResult.status === "fulfilled") {
          setQueueCount(queueResult.value);
        } else {
          setQueueCount(0);
        }
        if (draftResult.status === "fulfilled") {
          setState((current) => ({ ...current, draft: draftResult.value }));
        }
      });
    };
    refreshQueueCount();
    return subscribeToQueueUpdates(refreshQueueCount);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return subscribeToWorkflowRefresh(() => {
      void loadDashboard();
    });
  }, [loadDashboard, user]);

  const weeklyAverage = useMemo(() => {
    const points = state.weekly.filter((item) => item.units > 0);
    if (!points.length) return 0;
    return points.reduce((sum, item) => sum + item.production_percent, 0) / points.length;
  }, [state.weekly]);

  const monthlyUnits = useMemo(
    () => state.recentEntries.reduce((sum, entry) => sum + (entry.units_produced || 0), 0),
    [state.recentEntries],
  );

  const pendingShifts = useMemo(() => {
    const submitted = new Set(state.todayEntries.map((entry) => entry.shift));
    return ALL_SHIFTS.filter((shift) => !submitted.has(shift)).length;
  }, [state.todayEntries]);
  const completedShifts = state.todayEntries.length;
  const nextPendingShift = useMemo(() => {
    const submitted = new Set(state.todayEntries.map((entry) => entry.shift));
    return ALL_SHIFTS.find((shift) => !submitted.has(shift)) || null;
  }, [state.todayEntries]);
  const todayShiftCards = useMemo(() => {
    const entryByShift = new Map(state.todayEntries.map((entry) => [entry.shift, entry]));
    return ALL_SHIFTS.map((shift) => ({
      shift,
      entry: entryByShift.get(shift) || null,
    }));
  }, [state.todayEntries]);
  const workerAlerts = useMemo(() => state.alerts.slice(0, 3), [state.alerts]);

  const recentEntries = useMemo(() => state.recentEntries.slice(0, 5), [state.recentEntries]);
  const showInitialSkeleton =
    dashboardLoading &&
    !state.todayEntries.length &&
    !state.recentEntries.length &&
    !state.usage &&
    !state.alerts.length &&
    !state.weekly.length;
  const isOperatorHome = user?.role === "operator";
  const canReview = ["supervisor", "manager", "admin", "owner"].includes(user?.role || "");
  const canSeeControlTower = ["manager", "admin", "owner"].includes(user?.role || "");
  const canUseSteel = ["owner", "manager"].includes(user?.role || "");
  const steelCommercialMode =
    activeFactory?.industry_type === "steel" &&
    ["accountant", "manager", "admin", "owner"].includes(user?.role || "");
  const headerEyebrow =
    user?.role === "accountant"
      ? "Reporting Desk"
      : user?.role === "admin"
        ? "System Oversight"
        : user?.role === "owner"
          ? "Owner Review"
          : user?.role === "supervisor"
            ? "Review Control"
            : t("dashboard.section.operations_board", "Operations Board");
  const headerTitle =
    user?.role === "operator"
      ? `${t("dashboard.header.operator_ready", "Ready for the shift")}, ${user.name}`
      : user?.role === "supervisor"
        ? `${t("dashboard.header.supervisor_ready", "Team control is live")}, ${user.name}`
        : user?.role === "accountant"
          ? `Reporting control is ready, ${user.name}`
          : user?.role === "manager"
            ? `Decision view is ready, ${user.name}`
            : user?.role === "admin"
              ? `System control is ready, ${user.name}`
        : user?.role === "owner"
          ? `${t("dashboard.header.owner_ready", "Owner review is ready")}, ${user.name}`
          : `${t("dashboard.header.default", "Good to see you")}, ${user?.name || t("dashboard.header.there", "there")}`;
  const headerCopy =
    user?.role === "operator"
      ? t(
          "dashboard.copy.operator",
          "Open your shift entry fast, capture problems early, and keep work moving even when the network drops.",
        )
      : user?.role === "supervisor"
        ? t(
            "dashboard.copy.supervisor",
            "Watch pending work, clear approvals quickly, and stay ahead of stock, document, and loss signals.",
          )
        : user?.role === "accountant"
          ? "Use reporting as the primary desk, then move into customer, invoice, and outbound summary work without leaving trusted data."
          : user?.role === "manager"
            ? "Start from the next decision, then jump into reports, review load, and factory control without opening extra screens."
            : user?.role === "admin"
              ? "Start from settings, access, and workflow health. Use reports and approvals when live issues need proof."
        : user?.role === "owner"
          ? t(
              "dashboard.copy.owner",
              "Track profit, loss, stock trust, and dispatch exposure from one board without digging through admin screens.",
            )
          : t(
              "dashboard.copy.default",
          "Use this board as the safe jump point between daily work, approvals, and business review.",
        );
  const anomalyCount = state.anomalyPreview?.items?.length || 0;
  const topAnomaly = state.anomalyPreview?.items?.[0] || null;
  const roleFocusCards = useMemo(() => {
    if (user?.role === "operator") {
      return [
        {
          eyebrow: t("dashboard.card.eyebrow.start_work", "Start Work"),
          title: t("dashboard.card.operator.title", "Complete the next shift entry"),
          detail: `${pendingShifts} shift slot${pendingShifts === 1 ? "" : "s"} still open today.`,
          href: "/entry",
          action: t("dashboard.card.operator.action", "Open Shift Entry"),
        },
        {
          eyebrow: t("dashboard.card.eyebrow.capture", "Capture"),
          title: t("dashboard.card.capture.title", "Bring paper records in fast"),
          detail: `${queueCount} offline item${queueCount === 1 ? "" : "s"} waiting on this browser.`,
          href: "/ocr/scan",
          action: t("dashboard.card.capture.action", "Open Document Capture"),
        },
        {
          eyebrow: t("dashboard.card.eyebrow.stay_ahead", "Stay Ahead"),
          title: t("dashboard.card.alerts.title", "Check today's plant signals"),
          detail: `${state.alerts.length} unread alert${state.alerts.length === 1 ? "" : "s"} on the board.`,
          href: "/dashboard",
          action: t("dashboard.card.alerts.action", "Review Alerts"),
        },
      ];
    }

    if (user?.role === "supervisor") {
      return [
        {
          eyebrow: t("dashboard.card.eyebrow.review", "Review"),
          title: t("dashboard.card.supervisor.approval_title", "Clear the approval queue"),
          detail: `${state.alerts.length} alert${state.alerts.length === 1 ? "" : "s"} and team follow-ups waiting now.`,
          href: "/approvals",
          action: t("dashboard.card.supervisor.approval_action", "Open Approval Inbox"),
        },
        {
          eyebrow: t("dashboard.card.eyebrow.control", "Control"),
          title: t("dashboard.card.supervisor.stock_title", "Check stock trust and mismatch"),
          detail:
            activeFactory?.industry_type === "steel"
              ? t(
                  "dashboard.card.supervisor.steel_detail",
                  "Stay on top of steel reconciliation and confidence.",
                )
              : t(
                  "dashboard.card.supervisor.default_detail",
                  "Review floor signals before they become exceptions.",
                ),
          href: activeFactory?.industry_type === "steel" ? "/steel/reconciliations" : "/reports",
          action:
            activeFactory?.industry_type === "steel"
              ? t("dashboard.action.open_reconciliations", "Open Reconciliations")
              : t("dashboard.action.open_reports", "Open Reports"),
        },
        {
          eyebrow: t("dashboard.card.eyebrow.escalate", "Escalate"),
          title: t("dashboard.card.supervisor.escalate_title", "Keep steel operations moving"),
          detail:
            activeFactory?.industry_type === "steel"
              ? t(
                  "dashboard.card.supervisor.escalate_steel_detail",
                  "Jump straight into reconciliation and dispatch follow-through.",
                )
              : t(
                  "dashboard.card.supervisor.escalate_default_detail",
                  "Use the operations board to coordinate the next action.",
                ),
          href: activeFactory?.industry_type === "steel" ? "/steel/reconciliations" : "/dashboard",
          action:
            activeFactory?.industry_type === "steel"
              ? t("dashboard.action.open_reconciliations", "Open Reconciliations")
              : t("dashboard.action.open_board", "Open Board"),
        },
      ];
    }

    if (user?.role === "accountant") {
      return [
        {
          eyebrow: t("dashboard.card.eyebrow.review", "Review"),
          title: "Open reporting and revenue controls",
          detail: `${monthlyUnits.toLocaleString(locale)} recent units are ready for summary and export checks.`,
          href: "/reports",
          action: "Open Reports",
        },
        {
          eyebrow: t("dashboard.card.eyebrow.control", "Control"),
          title: steelCommercialMode ? "Track customers and receivables" : "Check attendance and summary outputs",
          detail: steelCommercialMode
            ? "Customer balances, invoice follow-through, and payments should stay close to dispatch activity."
            : "Use attendance reporting and outbound summaries to keep business reporting clean.",
          href: steelCommercialMode ? "/steel/customers" : "/attendance/reports",
          action: steelCommercialMode ? "Open Customers" : "Open Attendance Reports",
        },
        {
          eyebrow: t("dashboard.card.eyebrow.grow", "Grow"),
          title: "Send management updates without manual rewriting",
          detail: "Email summary should stay close to verified reports so the owner sees one clean story.",
          href: "/email-summary",
          action: "Open Scheduled Updates",
        },
      ];
    }

    if (user?.role === "owner") {
      const ownerHomeHref = (organization?.accessible_factories || 0) > 1 ? "/control-tower" : "/premium/dashboard";
      return [
        {
          eyebrow: t("dashboard.card.eyebrow.review", "Review"),
          title: ownerHomeHref === "/control-tower" ? "Open the factory network" : "Open the owner desk",
          detail:
            ownerHomeHref === "/control-tower"
              ? "Compare factories first, then drill into the one that is creating risk."
              : "Start from trusted risk, performance, and anomaly signals instead of raw daily screens.",
          href: ownerHomeHref,
          action: ownerHomeHref === "/control-tower" ? "Open Factory Network" : "Open Owner Desk",
        },
        {
          eyebrow: t("dashboard.card.eyebrow.control", "Control"),
          title: "Check anomaly and leakage signals",
          detail: anomalyCount
            ? `${anomalyCount} live signal${anomalyCount === 1 ? "" : "s"} need owner attention.`
            : "AI insight is quiet right now, which makes this the right time to verify reporting trust.",
          href: "/ai",
          action: "Open AI Insights",
        },
        {
          eyebrow: t("dashboard.card.eyebrow.grow", "Grow"),
          title: "Move from trusted data to owner reporting",
          detail: "Reports and scheduled updates should only reflect reviewed OCR and approved operations.",
          href: "/reports",
          action: "Open Reports",
        },
      ];
    }

    if (user?.role === "admin") {
      return [
        {
          eyebrow: t("dashboard.card.eyebrow.control", "Control"),
          title: "Open factory and access controls",
          detail: "User roles, workflow setup, and factory configuration should stay clean before operational confusion spreads.",
          href: "/settings",
          action: "Open Factory Admin",
        },
        {
          eyebrow: t("dashboard.card.eyebrow.review", "Review"),
          title: "Check reporting and review health",
          detail: "Reports and approval load are the fastest way to confirm whether the system is supporting operations properly.",
          href: "/reports",
          action: "Open Reports",
        },
        {
          eyebrow: t("dashboard.card.eyebrow.grow", "Grow"),
          title: "Manage attendance setup without entering worker flow",
          detail: "Shift rules and employee mapping should stay available, but they should not pull admin into daily worker tasks.",
          href: "/settings/attendance",
          action: "Open Attendance Admin",
        },
      ];
    }

    if (user?.role === "manager") {
      return [
        {
          eyebrow: t("dashboard.card.eyebrow.review", "Review"),
          title: "Open the next decision layer",
          detail: canReview
            ? "Review work, exceptions, and approvals should be cleared before they block downstream reporting."
            : "Use the board to coordinate the next operational decision.",
          href: canReview ? "/approvals" : "/dashboard",
          action: canReview ? "Open Review Queue" : "Open Board",
        },
        {
          eyebrow: t("dashboard.card.eyebrow.control", "Control"),
          title: steelCommercialMode ? "Move between reports and steel control" : "Open reporting with operational context",
          detail: steelCommercialMode
            ? "Keep stock, dispatch, and reporting close together so the same numbers reach management."
            : "Use reports as the main business layer, then drill into performance or factory admin only when needed.",
          href: steelCommercialMode && canUseSteel ? "/steel" : "/reports",
          action: steelCommercialMode && canUseSteel ? "Open Steel Control" : "Open Reports",
        },
        {
          eyebrow: t("dashboard.card.eyebrow.grow", "Grow"),
          title: "Open performance without losing context",
          detail:
            canSeeControlTower
              ? "Control tower and analysis stay one click away when leadership context is needed."
              : "Stay focused on the operating line unless a broader comparison is needed.",
          href: canSeeControlTower ? "/control-tower" : "/analytics",
          action: canSeeControlTower ? "Open Factory Network" : "Open Analysis",
        },
      ];
    }

    return [
      {
        eyebrow: t("dashboard.card.eyebrow.review", "Review"),
        title: t("dashboard.card.business.title", "Open the business review layer"),
        detail: `${monthlyUnits.toLocaleString(locale)} ${t("dashboard.units.recent", "recent units")} ${t("common.and", "and")} ${state.alerts.length} ${t("dashboard.alerts.unread", "unread alerts")}.`,
        href: "/reports",
        action: t("dashboard.action.open_reports", "Open Reports"),
      },
      {
        eyebrow: t("dashboard.card.eyebrow.control", "Control"),
        title: t("dashboard.card.business.control_title", "See pending decisions in one place"),
        detail: canReview
          ? t("dashboard.card.business.control_detail_review", "Supervisory work is grouped into one inbox now.")
          : t(
              "dashboard.card.business.control_detail_default",
              "Approval tools stay available when your role needs them.",
            ),
        href: canReview ? "/approvals" : "/dashboard",
        action: canReview
          ? t("dashboard.card.supervisor.approval_action", "Open Approval Inbox")
          : t("dashboard.action.open_board", "Open Board"),
      },
      {
        eyebrow: t("dashboard.card.eyebrow.grow", "Grow"),
        title: t("dashboard.card.business.grow_title", "Move between operations and company control"),
        detail: canSeeControlTower
          ? t(
              "dashboard.card.business.grow_detail_tower",
              "Jump from control tower to billing and settings without leaving the main workflow.",
            )
          : t(
              "dashboard.card.business.grow_detail_default",
              "Stay focused on operational performance and reporting.",
            ),
        href: canSeeControlTower ? "/control-tower" : "/analytics",
        action: canSeeControlTower
          ? t("dashboard.action.open_control_tower", "Open Control Tower")
          : t("dashboard.action.open_analysis", "Open Analysis"),
      },
    ];
  }, [
    activeFactory?.industry_type,
    canReview,
    canSeeControlTower,
    canUseSteel,
    locale,
    monthlyUnits,
    organization?.accessible_factories,
    pendingShifts,
    queueCount,
    steelCommercialMode,
    state.alerts.length,
    t,
    user?.role,
    anomalyCount,
  ]);
  const primaryAction = roleFocusCards[0];
  const secondaryActions = roleFocusCards.slice(1, 3);
  const roleLaunchGuide = useMemo<RoleLaunchGuide | null>(() => {
    if (user?.role === "operator") {
      return {
        eyebrow: "Operator Guide",
        title: "Three moves to finish a clean shift",
        detail: "Keep the day simple: record work, capture paper, and leave the queue cleaner than you found it.",
        steps: [
          {
            title: "Log the next shift entry",
            detail: `${pendingShifts} shift slot${pendingShifts === 1 ? "" : "s"} still need a production entry today.`,
            href: "/entry",
            action: "Open Shift Entry",
          },
          {
            title: "Capture paper only when needed",
            detail: `${queueCount} offline item${queueCount === 1 ? "" : "s"} are waiting on this browser right now.`,
            href: "/ocr/scan",
            action: "Open Document Capture",
          },
          {
            title: "End with signal awareness",
            detail: `${state.alerts.length} alert${state.alerts.length === 1 ? "" : "s"} can still affect the floor today.`,
            href: "/dashboard",
            action: "Review Alerts",
          },
        ],
      };
    }

    if (user?.role === "supervisor") {
      return {
        eyebrow: "Supervisor Guide",
        title: "Use review first, then protect the flow",
        detail: "The fastest supervisor loop is queue first, mismatch second, and reporting third.",
        steps: [
          {
            title: "Clear the mixed review inbox",
            detail: "Attendance, OCR, and stock items should stop blocking work here before they reach management.",
            href: "/approvals",
            action: "Open Approval Inbox",
          },
          {
            title: activeFactory?.industry_type === "steel" ? "Stabilize steel trust" : "Check reporting exceptions",
            detail:
              activeFactory?.industry_type === "steel"
                ? "Reconciliation and dispatch blockers are the next place hidden risk appears."
                : "Use reports to catch repeat issues before they become end-of-day surprises.",
            href: activeFactory?.industry_type === "steel" ? "/steel/reconciliations" : "/reports",
            action: activeFactory?.industry_type === "steel" ? "Open Reconciliations" : "Open Reports",
          },
          {
            title: "Finish with an escalation check",
            detail: `${anomalyCount} anomaly signal${anomalyCount === 1 ? "" : "s"} and ${state.alerts.length} alert${state.alerts.length === 1 ? "" : "s"} are visible right now.`,
            href: "/reports",
            action: "Refresh Reporting View",
          },
        ],
      };
    }

    if (user?.role === "admin") {
      return {
        eyebrow: "Admin Guide",
        title: "Keep the system clean, then check workflow health",
        detail: "Admins should lead with setup, access, and reporting stability instead of daily worker actions.",
        steps: [
          {
            title: "Review factory and access controls",
            detail: "User roles, factory setup, and template rules should stay clean before operations start drifting.",
            href: "/settings",
            action: "Open Factory Admin",
          },
          {
            title: "Check report and summary health",
            detail: "Use reports to confirm trusted outputs are moving correctly across the factory.",
            href: "/reports",
            action: "Open Reports",
          },
          {
            title: "Watch approval load only when issues appear",
            detail: "Approvals matter for admin when policy, trust, or workflow breakdown needs attention.",
            href: "/approvals",
            action: "Open Review Queue",
          },
        ],
      };
    }

    if (user?.role === "manager") {
      return {
        eyebrow: "Manager Guide",
        title: "Decide from one trusted operating view",
        detail: "Use reports and approvals as the operating truth before you drill into analytics or plant control.",
        steps: [
          {
            title: "Start with the next blocked decision",
            detail: canReview
              ? "Approvals and exceptions should clear before they distort downstream summaries."
              : "Open the main operating board and resolve the next decision there.",
            href: canReview ? "/approvals" : "/dashboard",
            action: canReview ? "Open Review Queue" : "Open Board",
          },
          {
            title: steelCommercialMode ? "Keep steel and reporting together" : "Use reports as the business desk",
            detail: steelCommercialMode
              ? "Stock, dispatch, invoice, and customer movement should stay close to the same report window."
              : `${monthlyUnits.toLocaleString(locale)} recent units are already available for reporting and trend review.`,
            href: steelCommercialMode && canUseSteel ? "/steel" : "/reports",
            action: steelCommercialMode && canUseSteel ? "Open Steel Control" : "Open Reports",
          },
          {
            title: "Close the loop with owner context",
            detail: "Owner summaries and control-tower checks should come after the numbers are already trusted.",
            href: canSeeControlTower ? "/control-tower" : "/email-summary",
            action: canSeeControlTower ? "Open Factory Network" : "Open Email Summary",
          },
        ],
      };
    }

    if (user?.role === "owner") {
      const ownerHomeHref = (organization?.accessible_factories || 0) > 1 ? "/control-tower" : "/premium/dashboard";
      return {
        eyebrow: "Owner Guide",
        title: "Move from risk to proof to action",
        detail: "Owners should not hunt through daily screens. Start from risk, verify the evidence, then send the decision-ready summary.",
        steps: [
          {
            title: ownerHomeHref === "/control-tower" ? "Compare factories first" : "Open the owner desk",
            detail:
              ownerHomeHref === "/control-tower"
                ? "Find the factory creating the biggest risk before drilling into details."
                : "Start from money at risk, stock trust, and dispatch exposure instead of raw operations.",
            href: ownerHomeHref,
            action: ownerHomeHref === "/control-tower" ? "Open Factory Network" : "Open Owner Desk",
          },
          {
            title: "Verify anomaly and leakage signals",
            detail: anomalyCount
              ? `${anomalyCount} live signal${anomalyCount === 1 ? "" : "s"} are ready for owner review.`
              : "The radar is calm, which makes this the right time to confirm reporting trust and repeated patterns.",
            href: "/ai",
            action: "Open AI Insights",
          },
          {
            title: "Finish with the outbound summary",
            detail: "Owner updates work best after reports and OCR trust are already clean.",
            href: "/email-summary",
            action: "Open Email Summary",
          },
        ],
      };
    }

    return null;
  }, [
    activeFactory?.industry_type,
    anomalyCount,
    canReview,
    canSeeControlTower,
    canUseSteel,
    locale,
    monthlyUnits,
    organization?.accessible_factories,
    pendingShifts,
    queueCount,
    state.alerts.length,
    steelCommercialMode,
    user?.role,
  ]);
  const dashboardQuickLinks = useMemo<DashboardQuickLink[]>(() => {
    if (user?.role === "operator") {
      return [
        {
          href: "/ocr/scan",
          label: t("dashboard.action.scan_docs", "Scan Docs"),
          variant: "outline",
        },
        {
          href: "/attendance",
          label: "Open Attendance",
          variant: "ghost",
        },
      ];
    }

    if (user?.role === "supervisor") {
      return [
        {
          href: "/ocr/verify",
          label: "Review Documents",
          variant: "outline",
        },
        {
          href: "/reports",
          label: "Open Reports",
          variant: "ghost",
        },
      ];
    }

    if (user?.role === "accountant") {
      return [
        {
          href: "/attendance/reports",
          label: "Attendance Reports",
          variant: "outline",
        },
        {
          href: "/email-summary",
          label: "Scheduled Updates",
          variant: "ghost",
        },
      ];
    }

    if (user?.role === "admin") {
      return [
        {
          href: "/settings",
          label: "Factory Admin",
          variant: "outline",
        },
        {
          href: "/analytics",
          label: "Open Analytics",
          variant: "ghost",
        },
      ];
    }

    if (user?.role === "owner") {
      const ownerHomeHref = (organization?.accessible_factories || 0) > 1 ? "/control-tower" : "/premium/dashboard";
      return [
        {
          href: ownerHomeHref,
          label: ownerHomeHref === "/control-tower" ? "Factory Network" : "Owner Desk",
          variant: "outline",
        },
        {
          href: "/ai",
          label: "AI Insights",
          variant: "ghost",
        },
      ];
    }

    return [
      {
        href: canUseSteel ? "/steel" : "/reports",
        label: canUseSteel ? t("dashboard.action.steel_hub", "Steel Hub") : "Open Reports",
        variant: "outline",
      },
      {
        href: "/analytics",
        label: "Open Analysis",
        variant: "ghost",
      },
    ];
  }, [canUseSteel, organization?.accessible_factories, t, user?.role]);
  const dashboardSnapshotCards = useMemo<DashboardSnapshotCard[]>(() => {
    if (user?.role === "accountant") {
      return [
        {
          label: "Reports Ready",
          value: monthlyUnits,
          detail: "Trusted production rows are ready for reporting and export review.",
          href: "/reports?preset=month&focus=production",
          action: "Open Reports",
        },
        {
          label: "Attendance Summary",
          value: completedShifts,
          detail: "Cross-check manpower and completion before finance summaries go out.",
          href: "/attendance/reports",
          action: "Open Attendance Reports",
        },
        {
          label: "Trusted OCR Docs",
          value: state.ocrSummary?.trusted_documents ?? 0,
          detail: "Only approved OCR should flow into outbound reports and commercial summaries.",
          href: "/reports",
          action: "Open Trusted Reports",
        },
        {
          label: "Updates Queue",
          value: state.alerts.length,
          detail: "Scheduled updates should tell one clean story after reports are trusted.",
          href: "/email-summary",
          action: "Open Scheduled Updates",
        },
      ];
    }

    if (user?.role === "admin") {
      return [
        {
          label: "Factories In Scope",
          value: organization?.accessible_factories || factories.length || 1,
          detail: "Keep users, roles, and workflow setup aligned across the organization.",
          href: "/settings",
          action: "Open Factory Admin",
        },
        {
          label: "Trusted OCR Docs",
          value: state.ocrSummary?.trusted_documents ?? 0,
          detail: "Approved OCR is the safest signal that reports and exports are using clean data.",
          href: "/reports",
          action: "Open Reports",
        },
        {
          label: "Pending OCR Review",
          value: state.ocrSummary?.pending_documents ?? 0,
          detail: "If this rises, workflow trust usually needs admin follow-through before it becomes a support issue.",
          href: "/approvals",
          action: "Open Review Queue",
        },
        {
          label: "Workflow Alerts",
          value: state.alerts.length,
          detail: "Use analytics only after the system, review lanes, and summary outputs are behaving cleanly.",
          href: "/analytics",
          action: "Open Analytics",
        },
      ];
    }

    if (user?.role === "owner") {
      const ownerHomeHref = (organization?.accessible_factories || 0) > 1 ? "/control-tower" : "/premium/dashboard";
      return [
        {
          label: "Risk Signals",
          value: anomalyCount,
          detail: topAnomaly ? topAnomaly.message : "No live anomaly is asking for owner attention right now.",
          href: "/ai",
          action: "Open AI Insights",
        },
        {
          label: "Trusted OCR Docs",
          value: state.ocrSummary?.trusted_documents ?? 0,
          detail: "Owner summaries are strongest when they start from approved OCR and reviewed operations.",
          href: "/reports",
          action: "Open Trusted Reports",
        },
        {
          label: "Factory Coverage",
          value: organization?.accessible_factories || factories.length || 1,
          detail: "Use factory comparison before drilling into one plant's loss or stock story.",
          href: ownerHomeHref,
          action: ownerHomeHref === "/control-tower" ? "Open Factory Network" : "Open Owner Desk",
        },
        {
          label: "Outbound Summary",
          value: state.alerts.length,
          detail: "Email summaries work best after reporting and anomaly proof are already clear.",
          href: "/email-summary",
          action: "Open Email Summary",
        },
      ];
    }

    return [
      {
        label: t("dashboard.metric.today_entries", "Today's Entries"),
        value: state.todayEntries.length,
        detail: `${t("dashboard.metric.pending_shifts_today", "Pending shifts today")}: ${pendingShifts}`,
        href: `/entry?date=${todayValue()}&focus=today`,
        action: t("dashboard.action.open_today_entry", "Open Today's Entry"),
      },
      {
        label: t("dashboard.metric.weekly_avg", "Weekly Avg Performance"),
        value: `${weeklyAverage.toFixed(1)}%`,
        detail: state.analyticsLocked
          ? t("dashboard.analytics.upgrade", "Upgrade to Factory plan for analytics.")
          : t("dashboard.analytics.last_7_days", "Based on the last 7 production days."),
        href: "/reports?preset=week&focus=performance",
        action: t("dashboard.action.open_7day_report", "Open 7 Day Report"),
      },
      {
        label: t("dashboard.metric.recent_units", "Recent Units"),
        value: monthlyUnits,
        detail: `${t("dashboard.metric.recent_units_detail_prefix", "Rolling total from the latest")} ${state.recentEntries.length} ${t("dashboard.metric.recent_units_detail_suffix", "entries.")}`,
        href: "/reports?preset=month&focus=production",
        action: t("dashboard.action.open_monthly_review", "Open Monthly Review"),
      },
      {
        label: t("dashboard.metric.offline_queue", "Offline Queue"),
        value: queueCount,
        detail: t("dashboard.offline.detail", "Entries waiting to sync from this browser."),
        href: "/tasks?focus=offline",
        action: t("dashboard.action.open_my_tasks", "Open My Tasks"),
      },
    ];
  }, [
    anomalyCount,
    completedShifts,
    factories.length,
    monthlyUnits,
    organization?.accessible_factories,
    pendingShifts,
    queueCount,
    state.alerts.length,
    state.analyticsLocked,
    state.ocrSummary?.pending_documents,
    state.ocrSummary?.trusted_documents,
    state.recentEntries.length,
    state.todayEntries.length,
    t,
    topAnomaly,
    user?.role,
    weeklyAverage,
  ]);
  const usagePrimaryAction = useMemo(() => {
    if (user?.role === "supervisor") {
      return { href: "/approvals", label: "Open Review Queue" };
    }
    if (user?.role === "accountant") {
      return { href: "/reports", label: "Open Reports" };
    }
    if (user?.role === "manager") {
      return { href: "/approvals", label: "Open Review Queue" };
    }
    if (user?.role === "admin") {
      return { href: "/settings", label: "Open Factory Admin" };
    }
    if (user?.role === "owner") {
      const ownerHomeHref = (organization?.accessible_factories || 0) > 1 ? "/control-tower" : "/premium/dashboard";
      return {
        href: ownerHomeHref,
        label: ownerHomeHref === "/control-tower" ? "Open Factory Network" : "Open Owner Desk",
      };
    }
    return {
      href: "/entry",
      label: t("dashboard.action.open_entry_form", "Open Entry Form"),
    };
  }, [organization?.accessible_factories, t, user?.role]);

  const handleSync = useCallback(async () => {
    if (!user) return;
    setSyncing(true);
    setStatus(t("dashboard.sync.starting", "Syncing offline queue and checking for duplicate shifts..."));
    setError("");
    try {
      const result = await flushQueue(user.id, async (payload) => {
        try {
          const entry = await createEntry(payload);
          return { status: "sent" as const, entryId: entry.id };
        } catch (err) {
          const conflict = getEntryConflict(err);
          if (conflict) {
            return {
              status: "duplicate" as const,
              entryId: conflict.entryId ?? null,
              message: conflict.message,
            };
          }
          throw err;
        }
      });
      setQueueCount(result.remaining);
      if (result.sent || result.duplicates || result.failed) {
        const parts = [];
        if (result.sent) parts.push(`${t("dashboard.sync.synced", "synced")} ${result.sent}`);
        if (result.duplicates) {
          parts.push(
            `${t("dashboard.sync.resolved", "resolved")} ${result.duplicates} ${t("dashboard.sync.duplicate_conflicts", "duplicate conflicts")}`,
          );
        }
        if (result.failed) parts.push(`${result.failed} ${t("dashboard.sync.still_waiting", "still waiting")}`);
        setStatus(`${t("dashboard.sync.update_prefix", "Offline queue update")}: ${parts.join(", ")}.`);
      } else {
        setStatus(t("dashboard.sync.none_ready", "No queued entries were ready to sync."));
      }
      await loadDashboard();
      signalWorkflowRefresh("dashboard-sync");
    } catch (err) {
      setError(formatApiErrorMessage(err, t("dashboard.sync.failed", "Offline sync failed.")));
    } finally {
      setSyncing(false);
    }
  }, [loadDashboard, t, user]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onOnline = () => {
      setOnline(true);
      if (queueCount > 0) {
        void handleSync();
      }
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [handleSync, queueCount]);

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      window.location.href = "/login";
    }
  };

  const handleMarkAlertRead = useCallback(
    async (alertId: number) => {
      try {
        await markAlertRead(alertId);
        setState((current) => ({
          ...current,
          alerts: current.alerts.filter((alert) => alert.id !== alertId),
        }));
        signalRailCountsRefresh();
      } catch (err) {
        setError(formatApiErrorMessage(err, t("dashboard.alert.mark_read_failed", "Could not mark alert as read.")));
      }
    },
    [t],
  );
  const workerShiftLabel = useMemo(
    () => formatShift(state.attendanceToday?.shift || state.draft?.shift || nextPendingShift || "morning"),
    [nextPendingShift, state.attendanceToday?.shift, state.draft?.shift],
  );

  const workerStatus = useMemo(() => {
    if (state.attendanceToday?.status === "working") {
      return {
        label: "ACTIVE",
        tone: attendanceStatusTone("working"),
        title: workerShiftLabel,
        detail: `${formatMinutes(state.attendanceToday.worked_minutes || 0)} worked`,
      };
    }

    if (state.attendanceToday?.status === "late") {
      return {
        label: "LATE",
        tone: attendanceStatusTone("late"),
        title: workerShiftLabel,
        detail: `Punch in for ${workerShiftLabel} shift`,
      };
    }

    if (state.attendanceToday?.status === "missed_punch" || state.attendanceToday?.status === "absent") {
      return {
        label: "MISSED",
        tone: attendanceStatusTone(state.attendanceToday.status),
        title: workerShiftLabel,
        detail: "Attendance needs attention",
      };
    }

    if (state.attendanceToday?.can_punch_in || nextPendingShift || state.draft) {
      return {
        label: "PENDING",
        tone: attendanceStatusTone(state.attendanceToday?.status === "late" ? "late" : "half_day"),
        title: workerShiftLabel,
        detail: state.draft
          ? `Saved ${formatShift(state.draft.shift)} draft is waiting`
          : `${workerShiftLabel} shift is ready`,
      };
    }

    return {
      label: "DONE",
      tone: attendanceStatusTone("completed"),
      title: "Today Complete",
      detail: "All shift work looks covered",
    };
  }, [nextPendingShift, state.attendanceToday, state.draft, workerShiftLabel]);

  const workerPrimaryAction = useMemo(() => {
    if (state.attendanceToday?.can_punch_in) {
      return {
        href: "/attendance",
        label: "Start Shift",
        detail: `${workerShiftLabel} shift is ready for punch-in.`,
      };
    }

    if (state.draft) {
      return {
        href: `/entry?date=${state.draft.date}&shift=${state.draft.shift}&focus=draft`,
        label: "Continue Shift",
        detail: `Resume the saved ${formatShift(state.draft.shift)} entry.`,
      };
    }

    if (nextPendingShift) {
      return {
        href: `/entry?date=${todayValue()}&shift=${nextPendingShift}`,
        label: completedShifts > 0 ? "Continue Shift" : "Complete Entry",
        detail: `${formatShift(nextPendingShift)} shift is still pending today.`,
      };
    }

    if (state.attendanceToday?.can_punch_out) {
      return {
        href: "/attendance",
        label: "Complete Shift",
        detail: `${workerShiftLabel} shift is ready for punch-out.`,
      };
    }

    if (queueCount > 0) {
      return {
        href: "/ocr/scan",
        label: "Scan Paper",
        detail: `${queueCount} saved item${queueCount === 1 ? "" : "s"} still need processing.`,
      };
    }

    if (workerAlerts.length > 0) {
      return {
        href: "/tasks",
        label: "Open My Tasks",
        detail: `${workerAlerts.length} follow-up item${workerAlerts.length === 1 ? "" : "s"} are waiting.`,
      };
    }

    return {
      href: "/reports?preset=day&focus=production",
      label: "View Report",
      detail: "Today is covered. Open the daily report next.",
    };
  }, [
    completedShifts,
    nextPendingShift,
    queueCount,
    state.attendanceToday?.can_punch_in,
    state.attendanceToday?.can_punch_out,
    state.draft,
    workerAlerts.length,
    workerShiftLabel,
  ]);

  const workerQuickActions = useMemo(
    () => [
      {
        key: "attendance",
        href: "/attendance",
        label: "Attendance",
        title: "Attendance",
        detail: "Open attendance and punch status.",
        action: "Open Attendance",
        meta: state.attendanceToday?.can_punch_in
          ? "Start"
          : state.attendanceToday?.can_punch_out
            ? "Open"
            : "View",
      },
      {
        key: "scan",
        href: "/ocr/scan",
        label: "Scan Paper",
        title: "Scan Paper",
        detail: queueCount > 0 ? `${queueCount} saved items are waiting.` : "Open the paper scan flow.",
        action: "Open Scan",
        meta: queueCount > 0 ? `${queueCount} saved` : "Open",
      },
      {
        key: "tasks",
        href: "/tasks",
        label: "My Tasks",
        title: "My Tasks",
        detail: workerAlerts.length > 0 ? `${workerAlerts.length} follow-ups are waiting.` : "Open your assigned work.",
        action: "Open Tasks",
        meta: workerAlerts.length > 0 ? `${workerAlerts.length} pending` : "Open",
      },
    ],
    [queueCount, state.attendanceToday, workerAlerts.length],
  );

  if (loading) {
    return <DashboardPageSkeleton />;
  }

  if (!user) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <Card className="w-full max-w-xl border border-[var(--border)] bg-[var(--card)] shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl">DPR.ai Web Frontend</CardTitle>
            <p className="text-sm text-[var(--muted)]">
              {t("dashboard.session.missing", "No active cookie session found. Continue to the login screen.")}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Link href="/login">
                <Button>{t("dashboard.action.open_login", "Open Login")}</Button>
              </Link>
              <Link href="/register">
                <Button variant="outline">{t("dashboard.action.register", "Register")}</Button>
              </Link>
            </div>
            {sessionError ? <div className="text-sm text-red-400">{sessionError}</div> : null}
          </CardContent>
        </Card>
      </main>
    );
  }

  if (showInitialSkeleton) {
    return <DashboardPageSkeleton />;
  }

  if (isOperatorHome) {
    return (
      <main className="min-h-screen bg-[#0B0F19] px-4 py-6 md:px-6 lg:py-8">
        <div className="mx-auto max-w-6xl space-y-4">
          {status ? (
            <div className="rounded-[20px] border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
              {status}
            </div>
          ) : null}
          {error || sessionError ? (
            <div className="rounded-[20px] border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {error || sessionError}
            </div>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,25,40,0.96),rgba(11,15,25,0.98))] p-6 shadow-[0_24px_80px_rgba(6,10,18,0.48)]">
              <div className="flex items-center justify-between gap-3">
                <div className="text-base font-semibold text-slate-100">
                  {activeFactory?.name || user.factory_name || "-"}
                </div>
                <span
                  className={`rounded-full border px-3 py-1 text-xs ${
                    online
                      ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
                      : "border-amber-400/20 bg-amber-500/10 text-amber-100"
                  }`}
                >
                  {online ? "Online" : "Offline"}
                </span>
              </div>

              <div className="mt-8">
                <div className="text-xl font-semibold md:text-2xl">Ready for shift</div>
                <div className={`mt-5 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] ${workerStatus.tone}`}>
                  <span className="h-2.5 w-2.5 rounded-full bg-current opacity-80" />
                  Status: {workerStatus.label}
                </div>
                <div className="mt-5 text-2xl font-semibold md:text-3xl">{workerStatus.title}</div>
                <div className="mt-2 text-sm text-slate-300">{workerStatus.detail}</div>
              </div>

              <div className="mt-8">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Main Action</div>
                <Link
                  href={workerPrimaryAction.href}
                  className="mt-3 inline-flex h-20 w-full items-center justify-center rounded-[28px] bg-[linear-gradient(90deg,#22d3ee,#60a5fa)] px-6 text-xl font-semibold text-[#08101D] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0F19]"
                >
                  {workerPrimaryAction.label}
                </Link>
                <div className="mt-3 text-sm text-slate-300">{workerPrimaryAction.detail}</div>
              </div>

              <div className="mt-8">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Quick Actions</div>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {workerQuickActions.map((action) => (
                    <Link
                      key={action.key}
                      href={action.href}
                      className={`${action.key === "tasks" ? "col-span-2 sm:col-span-1" : ""} rounded-[24px] border border-white/10 bg-white/5 px-4 py-4 text-center transition hover:border-cyan-300/25 hover:bg-white/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0F19]`}
                    >
                      <div className="text-base font-semibold text-white">{action.label}</div>
                      <div className="mt-1 text-xs text-slate-400">{action.meta}</div>
                    </Link>
                  ))}
                </div>
              </div>

              <div className="mt-8 rounded-[24px] border border-white/10 bg-white/5 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Today Summary</div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[20px] border border-white/10 bg-[#0E1524]/80 px-4 py-3">
                    <div className="text-xs text-slate-400">Completed</div>
                    <div className="mt-2 text-2xl font-semibold text-white">{completedShifts}</div>
                  </div>
                  <div className="rounded-[20px] border border-white/10 bg-[#0E1524]/80 px-4 py-3">
                    <div className="text-xs text-slate-400">Pending</div>
                    <div className="mt-2 text-2xl font-semibold text-white">{pendingShifts}</div>
                  </div>
                </div>
              </div>
            </section>

            <aside className="space-y-4">
              <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(14,21,36,0.96),rgba(11,15,25,0.98))] p-5 shadow-[0_20px_60px_rgba(6,10,18,0.32)]">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Today Summary</div>
                <div className="mt-4 space-y-3 text-sm text-slate-300">
                  <div className="flex items-center justify-between">
                    <span>Completed</span>
                    <span className="font-semibold text-white">{completedShifts}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Pending</span>
                    <span className="font-semibold text-white">{pendingShifts}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Offline</span>
                    <span className="font-semibold text-white">{queueCount}</span>
                  </div>
                </div>
                {queueCount > 0 ? (
                  <Button variant="outline" className="mt-4 h-11 w-full" onClick={handleSync} disabled={syncing}>
                    {syncing ? "Syncing..." : "Sync Saved"}
                  </Button>
                ) : null}
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/5 p-5">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Alerts</div>
                {workerAlerts.length ? (
                  <div className="mt-4 space-y-3">
                    {workerAlerts.slice(0, 2).map((alert) => (
                      <div key={alert.id} className={`rounded-[20px] border px-4 py-3 ${severityTone(alert.severity)}`}>
                        <div className="text-sm font-medium">{alert.message}</div>
                        <div className="mt-2 text-xs opacity-70">{formatDateTime(alert.created_at, locale)}</div>
                        <button
                          type="button"
                          className="mt-3 text-xs font-semibold underline underline-offset-4"
                          onClick={() => handleMarkAlertRead(alert.id)}
                        >
                          Mark done
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-[20px] border border-emerald-400/15 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                    No alerts right now.
                  </div>
                )}
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/5 p-5">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Shift Status</div>
                <div className="mt-4 space-y-3">
                  {todayShiftCards.map(({ shift, entry }) => (
                    <div
                      key={shift}
                      className={`flex items-center justify-between rounded-[20px] border px-4 py-3 ${
                        entry
                          ? "border-emerald-400/20 bg-emerald-500/10"
                          : "border-white/10 bg-[#0E1524]/80"
                      }`}
                    >
                      <span className="text-sm font-medium text-white">{formatShift(shift)}</span>
                      <span className={`text-xs font-semibold uppercase tracking-[0.18em] ${entry ? "text-emerald-100" : "text-slate-400"}`}>
                        {entry ? "Done" : "Pending"}
                      </span>
                    </div>
                  ))}
                </div>
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
        <section className="flex flex-col gap-4 rounded-[2rem] border border-[var(--border)] bg-[rgba(20,24,36,0.88)] p-6 shadow-2xl backdrop-blur md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <div className="text-sm uppercase tracking-[0.32em] text-[var(--accent)]">
              {headerEyebrow}
            </div>
            <h1 className="text-3xl font-semibold md:text-4xl">{headerTitle}</h1>
            <p className="max-w-3xl text-sm text-[var(--muted)]">
              {headerCopy}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {primaryAction ? (
              <Link href={primaryAction.href}>
                <Button>{primaryAction.action}</Button>
              </Link>
            ) : null}
            <Link href="/reports">
              <Button variant="outline">{t("dashboard.action.open_reports", "Open Reports")}</Button>
            </Link>
            <Button variant="outline" onClick={() => loadDashboard()}>
              {dashboardLoading
                ? t("dashboard.action.refreshing", "Refreshing...")
                : t("dashboard.action.refresh_board", "Refresh Board")}
            </Button>
            {queueCount > 0 ? (
              <Button variant="outline" onClick={handleSync} disabled={syncing}>
                {syncing
                  ? t("dashboard.sync.syncing", "Syncing...")
                  : `${t("dashboard.action.sync_queue", "Sync Queue")} (${queueCount})`}
              </Button>
            ) : null}
            <Button variant="ghost" onClick={handleLogout}>
              {t("shell.logout", "Logout")}
            </Button>
          </div>
        </section>

        {roleLaunchGuide ? (
          <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.88)]">
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
                  {roleLaunchGuide.eyebrow}
                </div>
                <CardTitle className="mt-1 text-xl">{roleLaunchGuide.title}</CardTitle>
                <div className="mt-2 max-w-3xl text-sm text-[var(--muted)]">{roleLaunchGuide.detail}</div>
              </div>
              <Link href={roleLaunchGuide.steps[0]?.href || "/dashboard"}>
                <Button variant="outline">{roleLaunchGuide.steps[0]?.action || "Open Workspace"}</Button>
              </Link>
            </CardHeader>
            <CardContent className="grid gap-3 lg:grid-cols-3">
              {roleLaunchGuide.steps.map((step, index) => (
                <div key={`${step.href}-${index}`} className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Step {index + 1}</div>
                  <div className="mt-2 text-sm font-semibold text-[var(--text)]">{step.title}</div>
                  <div className="mt-2 text-sm text-[var(--muted)]">{step.detail}</div>
                  <Link href={step.href} className="mt-3 inline-block text-xs text-[var(--accent)] underline underline-offset-4">
                    {step.action}
                  </Link>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr_1fr]">
          <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.88)]">
            <CardHeader>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
                {t("dashboard.section.now", "Now")}
              </div>
              <CardTitle className="text-xl">
                {primaryAction?.title || t("dashboard.primary.fallback_title", "Start the next task")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm leading-6 text-[var(--muted)]">
                {primaryAction?.detail || t("dashboard.primary.fallback_detail", "Keep the floor moving with the next best action.")}
              </div>
              {primaryAction ? (
                <Link href={primaryAction.href}>
                  <Button>{primaryAction.action}</Button>
                </Link>
              ) : null}
              <div className="text-xs text-[var(--muted)]">
                {online
                  ? t("dashboard.network.live", "Network is live. Actions will sync in real time.")
                  : t("dashboard.network.offline", "Offline mode active. Your entries save locally and sync later.")}
              </div>
            </CardContent>
          </Card>

          <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.88)]">
            <CardHeader>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
                {t("dashboard.section.attention", "Attention")}
              </div>
              <CardTitle className="text-xl">{t("dashboard.attention.title", "What needs review now")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-[var(--border)] bg-[var(--card-strong)] p-3">
                  <div className="text-xs text-[var(--muted)]">{t("dashboard.metric.alerts", "Alerts")}</div>
                  <div className="mt-1 text-lg font-semibold">{state.alerts.length}</div>
                </div>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--card-strong)] p-3">
                  <div className="text-xs text-[var(--muted)]">{t("dashboard.metric.signals", "Signals")}</div>
                  <div className="mt-1 text-lg font-semibold">{anomalyCount}</div>
                </div>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--card-strong)] p-3">
                  <div className="text-xs text-[var(--muted)]">{t("dashboard.metric.pending_shift", "Pending Shift")}</div>
                  <div className="mt-1 text-lg font-semibold">{pendingShifts}</div>
                </div>
              </div>
              {topAnomaly ? (
                <div className={`rounded-2xl border p-3 ${severityTone(topAnomaly.severity)}`}>
                  <div className="text-xs uppercase tracking-[0.2em] opacity-80">{topAnomaly.anomaly_type.replaceAll("_", " ")}</div>
                  <div className="mt-1 text-sm font-medium">{topAnomaly.message}</div>
                </div>
              ) : null}
              {state.ocrSummary ? (
                <div className="rounded-2xl border border-cyan-400/30 bg-[rgba(34,211,238,0.08)] p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-cyan-100">Trusted OCR</div>
                  <div className="mt-3 grid grid-cols-3 gap-3">
                    <div className="rounded-xl border border-cyan-400/20 bg-[rgba(8,18,28,0.42)] p-3">
                      <div className="text-[11px] text-cyan-100/80">Approved docs</div>
                      <div className="mt-1 text-lg font-semibold text-white">{state.ocrSummary.trusted_documents}</div>
                    </div>
                    <div className="rounded-xl border border-cyan-400/20 bg-[rgba(8,18,28,0.42)] p-3">
                      <div className="text-[11px] text-cyan-100/80">Trusted rows</div>
                      <div className="mt-1 text-lg font-semibold text-white">{state.ocrSummary.trusted_rows}</div>
                    </div>
                    <div className="rounded-xl border border-cyan-400/20 bg-[rgba(8,18,28,0.42)] p-3">
                      <div className="text-[11px] text-cyan-100/80">Pending docs</div>
                      <div className="mt-1 text-lg font-semibold text-white">{state.ocrSummary.pending_documents}</div>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-cyan-50/80">
                    {state.ocrSummary.trust_note} Last approved OCR update: {formatDateTime(state.ocrSummary.last_trusted_at || undefined, locale)}.
                  </div>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Link href="/dashboard">
                  <Button variant="outline" className="px-4 py-2 text-xs">
                    {t("dashboard.action.open_alert_feed", "Open Alert Feed")}
                  </Button>
                </Link>
                {canReview ? (
                  <Link href="/approvals">
                    <Button variant="ghost" className="px-4 py-2 text-xs">
                      {t("dashboard.action.open_review_queue", "Open Review Queue")}
                    </Button>
                  </Link>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.88)]">
            <CardHeader>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
                {t("dashboard.section.quick_actions", "Quick Actions")}
              </div>
              <CardTitle className="text-xl">{t("dashboard.quick.title", "No hunting, just move")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {secondaryActions.map((card) => (
                <div key={`${card.eyebrow}-${card.href}`} className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-3">
                  <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">{card.eyebrow}</div>
                  <div className="mt-1 text-sm font-semibold">{card.title}</div>
                  <div className="mt-1 text-xs text-[var(--muted)]">{card.detail}</div>
                  <Link href={card.href} className="mt-2 inline-block text-xs text-[var(--accent)] underline underline-offset-4">
                    {card.action}
                  </Link>
                </div>
              ))}
              <div className="flex flex-wrap gap-2 pt-1">
                {dashboardQuickLinks.map((link) => (
                  <Link key={`${link.href}-${link.label}`} href={link.href}>
                    <Button variant={link.variant} className="px-4 py-2 text-xs">
                      {link.label}
                    </Button>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        {activeFactory?.industry_type === "steel" && ["supervisor", "manager", "owner"].includes(user?.role || "") ? (
          <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.88)]">
            <CardHeader>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
                {t("dashboard.steel.section", "Steel Control")}
              </div>
              <CardTitle className="text-xl">
                {t("dashboard.steel.title", "Steel Control is now a separate module")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-[var(--muted)]">
              <div>
                {t(
                  "dashboard.steel.copy",
                  "Today Board stays lightweight. Full stock, production, sales, and risk controls now live in the dedicated Steel Control workspace.",
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                {canUseSteel ? (
                  <Link href="/steel">
                    <Button>{t("dashboard.action.open_steel_control", "Open Steel Control")}</Button>
                  </Link>
                ) : (
                  <div>
                    {t(
                      "dashboard.steel.restricted",
                      "Only authorized owner/manager roles can open Steel Control.",
                    )}
                  </div>
                )}
                <Link href="/steel/reconciliations">
                  <Button variant="outline">{t("dashboard.action.open_reconciliations", "Open Reconciliations")}</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {dashboardSnapshotCards.map((card, index) => (
            <Card key={`${card.label}-${card.href}`}>
              <CardHeader>
                <div className="text-sm text-[var(--muted)]">{card.label}</div>
                <CardTitle>{card.value}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-[var(--muted)]">
                <div>{card.detail}</div>
                {index === dashboardSnapshotCards.length - 1 && user?.role === "operator" ? (
                  <div className="flex flex-wrap gap-3">
                    <Button variant="outline" className="px-4 py-2 text-xs" onClick={handleSync} disabled={syncing}>
                      {syncing ? t("dashboard.sync.syncing", "Syncing...") : t("dashboard.action.sync_now", "Sync Now")}
                    </Button>
                    <Link href={card.href}>
                      <Button variant="ghost" className="px-4 py-2 text-xs">
                        {card.action}
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <Link href={card.href}>
                    <Button variant="outline" className="px-4 py-2 text-xs">
                      {card.action}
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          ))}
        </section>

        <details className="rounded-[1.5rem] border border-[var(--border)] bg-[rgba(16,20,32,0.82)] p-4">
          <summary className="cursor-pointer list-none text-sm font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
            {t("dashboard.section.advanced", "Advanced Insights and Business Context")}
          </summary>
          <div className="mt-5 space-y-6">
        {organization || activeFactory ? (
          <section className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <div className="text-sm text-[var(--muted)]">{t("dashboard.factory.active", "Active Factory")}</div>
                <CardTitle>{activeFactory?.name || user.factory_name || "-"}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-[var(--muted)]">
                {activeFactory?.industry_label || t("dashboard.factory.general", "General Manufacturing")}
                {activeFactory?.workflow_template_label ? ` - ${activeFactory.workflow_template_label}` : ""}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div className="text-sm text-[var(--muted)]">{t("dashboard.organization.title", "Organization")}</div>
                <CardTitle>{organization?.name || t("dashboard.organization.current", "Current organization")}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-[var(--muted)]">
                {t("common.plan", "Plan")} {organization?.plan || state.usage?.plan || "-"} - {t("shell.accessible_factories", "accessible factories")} {organization?.accessible_factories || factories.length || 1}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div className="text-sm text-[var(--muted)]">{t("dashboard.control_tower.title", "Control Tower")}</div>
                <CardTitle>{organization?.total_factories || factories.length || 1}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-[var(--muted)]">
                {t(
                  "dashboard.control_tower.copy",
                  "Switch factory from the left rail to move across sites without leaving the current workflow.",
                )}
              </CardContent>
            </Card>
          </section>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm text-[var(--muted)]">{t("dashboard.production_trend", "Production Trend")}</div>
                <CardTitle className="text-xl">{t("dashboard.last_7_days", "Last 7 Days")}</CardTitle>
              </div>
              {state.usage?.plan ? (
                <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  {state.usage.plan}
                </span>
              ) : null}
            </CardHeader>
            <CardContent>
              {state.analyticsLocked ? (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
                  {t(
                    "dashboard.analytics.plan_gated",
                    "Weekly analytics are plan-gated. The dashboard handles that cleanly and keeps the rest of the page live.",
                  )}
                </div>
              ) : state.weekly.length ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-7 gap-2">
                    {state.weekly.map((point) => (
                      <div key={point.date} className="space-y-2 text-center">
                        <div className="flex h-36 items-end justify-center rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-3">
                          <div
                            className="w-full rounded-full bg-[linear-gradient(180deg,#3ea6ff,#2dd4bf)]"
                            style={{ height: `${Math.max(8, Math.min(100, point.production_percent))}%` }}
                          />
                        </div>
                        <div className="text-xs text-[var(--muted)]">{formatDate(point.date, locale).split(" ").slice(0, 2).join(" ")}</div>
                        <div className="text-sm font-semibold">{point.production_percent.toFixed(0)}%</div>
                      </div>
                    ))}
                  </div>
                  <div className="text-xs text-[var(--muted)]">
                    {t(
                      "dashboard.analytics.note",
                      "Attendance and units are available too; richer charts can layer on top of this in the next migration slice.",
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
                  {t("dashboard.analytics.empty", "No weekly analytics data yet.")}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">{t("dashboard.plan_limits.title", "Plan & Limits")}</div>
              <CardTitle className="text-xl">{state.usage?.plan ? `${state.usage.plan} ${t("common.plan", "plan")}` : t("dashboard.usage_summary", "Usage summary")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                <div className="text-sm text-[var(--muted)]">{t("dashboard.current_period", "Current period")}</div>
                <div className="mt-1 text-lg font-semibold">{state.usage?.period || "-"}</div>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="text-[var(--muted)]">{t("dashboard.requests", "Requests")}</span>
                      <span>
                        {state.usage?.requests_used ?? 0}
                        {state.usage?.max_requests ? ` / ${state.usage.max_requests}` : ` / ${t("dashboard.unlimited", "Unlimited")}`}
                      </span>
                    </div>
                  <div className="h-2 rounded-full bg-[var(--card-strong)]">
                    <div
                      className="h-2 rounded-full bg-[var(--accent)]"
                      style={{ width: `${progressPercent(state.usage?.requests_used, state.usage?.max_requests)}%` }}
                    />
                  </div>
                </div>
                {usageWarning(state.usage?.requests_used, state.usage?.max_requests) ? (
                  <div className="rounded-2xl border border-amber-400/30 bg-[rgba(245,158,11,0.12)] p-3 text-xs text-amber-100">
                    {usageWarning(state.usage?.requests_used, state.usage?.max_requests)}
                  </div>
                ) : null}
                <div>
                  <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="text-[var(--muted)]">{t("dashboard.credits", "Credits")}</span>
                      <span>
                        {state.usage?.credits_used ?? 0}
                        {state.usage?.max_credits ? ` / ${state.usage.max_credits}` : ` / ${t("dashboard.unlimited", "Unlimited")}`}
                      </span>
                    </div>
                  <div className="h-2 rounded-full bg-[var(--card-strong)]">
                    <div
                      className="h-2 rounded-full bg-[linear-gradient(90deg,#3ea6ff,#2dd4bf)]"
                      style={{ width: `${progressPercent(state.usage?.credits_used, state.usage?.max_credits)}%` }}
                    />
                  </div>
                </div>
                {usageWarning(state.usage?.credits_used, state.usage?.max_credits) ? (
                  <div className="rounded-2xl border border-amber-400/30 bg-[rgba(245,158,11,0.12)] p-3 text-xs text-amber-100">
                    {usageWarning(state.usage?.credits_used, state.usage?.max_credits)}
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href={usagePrimaryAction.href}>
                  <Button variant="outline">{usagePrimaryAction.label}</Button>
                </Link>
                <Link href="/plans">
                  <Button variant="ghost">{t("dashboard.action.view_plans", "View Plans")}</Button>
                </Link>
                <Link href="/billing">
                  <Button variant="ghost">{t("dashboard.action.open_billing", "Open Billing")}</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
          <Card>
            <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm text-[var(--muted)]">{t("dashboard.ai.title", "AI Anomaly Radar")}</div>
                <CardTitle className="text-xl">{t("dashboard.ai.subtitle", "Factory drift preview")}</CardTitle>
              </div>
              <Link href="/ai">
                <Button variant="outline">{t("dashboard.action.open_ai", "Open AI Insights")}</Button>
              </Link>
            </CardHeader>
            <CardContent className="space-y-4">
              {state.anomalyLocked ? (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
                  {t(
                    "dashboard.ai.upgrade",
                    "Anomaly radar is available on Growth and higher plans. Upgrade to surface high-risk output and downtime spikes here.",
                  )}
                </div>
              ) : state.anomalyPreview ? (
                <>
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
                    {state.anomalyPreview.summary}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-[var(--border)] bg-[rgba(12,16,26,0.72)] p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                        {t("dashboard.metric.signals", "Signals")}
                      </div>
                      <div className="mt-2 text-2xl font-semibold">{state.anomalyPreview.items.length}</div>
                    </div>
                    <div className="rounded-2xl border border-[var(--border)] bg-[rgba(12,16,26,0.72)] p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                        {t("dashboard.window", "Window")}
                      </div>
                      <div className="mt-2 text-2xl font-semibold">{state.anomalyPreview.days}d</div>
                    </div>
                    <div className="rounded-2xl border border-[var(--border)] bg-[rgba(12,16,26,0.72)] p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">{t("dashboard.mode", "Mode")}</div>
                      <div className="mt-2 text-2xl font-semibold">{t("dashboard.preview", "Preview")}</div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
                  {t("dashboard.ai.empty", "No anomaly preview available yet.")}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">{t("dashboard.top_signals", "Top Signals")}</div>
              <CardTitle className="text-xl">{t("dashboard.attention.now", "What needs attention right now")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {state.anomalyPreview?.items?.length ? (
                state.anomalyPreview.items.slice(0, 4).map((item) => (
                  <div key={`${item.entry_id}-${item.anomaly_type}`} className={`rounded-2xl border p-4 ${severityTone(item.severity)}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs uppercase tracking-[0.2em] opacity-80">
                          {item.anomaly_type.replaceAll("_", " ")}
                        </div>
                        <div className="mt-1 text-sm font-medium">{item.message}</div>
                        <div className="mt-2 text-xs opacity-70">
                          {formatDate(item.date, locale)} - {formatShift(item.shift)}
                        </div>
                      </div>
                      <Link href={`/entry/${item.entry_id}`} className="text-xs underline underline-offset-4">
                        {t("common.open", "Open")}
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
                  {t("dashboard.ai.no_signals", "No anomaly signals are active in the current preview window.")}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
          </div>
        </details>

        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <div className="text-sm text-[var(--muted)]">{t("dashboard.unread_alerts", "Unread Alerts")}</div>
                <CardTitle className="text-xl">{state.alerts.length} {t("dashboard.active", "active")}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {state.alerts.length ? (
                state.alerts.slice(0, 5).map((alert) => (
                  <div
                    key={alert.id}
                    className={`rounded-2xl border p-4 ${severityTone(alert.severity)}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs uppercase tracking-[0.2em] opacity-80">{alert.alert_type}</div>
                        <div className="mt-1 text-sm font-medium">{alert.message}</div>
                        <div className="mt-2 text-xs opacity-70">{formatDateTime(alert.created_at, locale)}</div>
                      </div>
                      <Button
                        variant="ghost"
                        className="px-3 py-1 text-xs"
                        onClick={() => handleMarkAlertRead(alert.id)}
                      >
                        {t("dashboard.action.mark_read", "Mark read")}
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
                  {t("dashboard.alert.none", "No unread alerts right now.")}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">{t("dashboard.recent_entries", "Recent Entries")}</div>
              <CardTitle className="text-xl">{t("dashboard.recent_activity", "Latest production activity")}</CardTitle>
            </CardHeader>
            <CardContent>
              {recentEntries.length ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-[var(--muted)]">
                      <tr className="border-b border-[var(--border)]">
                        <th className="px-3 py-3 font-medium">{t("table.date", "Date")}</th>
                        <th className="px-3 py-3 font-medium">{t("table.shift", "Shift")}</th>
                        <th className="px-3 py-3 font-medium">{t("table.department", "Department")}</th>
                        <th className="px-3 py-3 font-medium">{t("table.units", "Units")}</th>
                        <th className="px-3 py-3 font-medium">{t("table.downtime", "Downtime")}</th>
                        <th className="px-3 py-3 font-medium">{t("table.submitted", "Submitted")}</th>
                        <th className="px-3 py-3 font-medium">{t("table.action", "Action")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentEntries.map((entry) => (
                        <tr key={entry.id} className="border-b border-[var(--border)]/60">
                          <td className="px-3 py-3">{formatDate(entry.date, locale)}</td>
                          <td className="px-3 py-3">{formatShift(entry.shift)}</td>
                          <td className="px-3 py-3">{entry.department || "-"}</td>
                          <td className="px-3 py-3">
                            {entry.units_produced} / {entry.units_target}
                          </td>
                          <td className="px-3 py-3">{entry.downtime_minutes} {t("table.min", "min")}</td>
                          <td className="px-3 py-3 text-[var(--muted)]">{formatDateTime(entry.created_at, locale)}</td>
                          <td className="px-3 py-3">
                            <Link href={`/entry/${entry.id}`} className="text-[var(--accent)] underline underline-offset-4">
                              {t("common.open", "Open")}
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
                  {t("dashboard.entries.empty", "No entries submitted yet.")}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {status ? <div className="text-sm text-green-400">{status}</div> : null}
        {error || sessionError ? <div className="text-sm text-red-400">{error || sessionError}</div> : null}
      </div>
    </main>
  );
}
