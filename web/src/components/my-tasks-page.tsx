"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GuidanceBlock } from "@/components/ui/guidance-block";
import { Skeleton } from "@/components/ui/skeleton";
import { getActiveWorkflowTemplate, type ActiveWorkflowTemplateContext } from "@/lib/auth";
import { listUnreadAlerts, type AlertItem } from "@/lib/dashboard";
import { getTodayEntries, type Entry } from "@/lib/entries";
import { useI18n, useI18nNamespaces } from "@/lib/i18n";
import {
  countQueuedEntries,
  loadDraft,
  subscribeToQueueUpdates,
  type EntryDraft,
} from "@/lib/offline-entries";
import { useSession } from "@/lib/use-session";

const ALL_SHIFTS = ["morning", "evening", "night"] as const;
const AUTO_REFRESH_MS = 25_000;

function localDateValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
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

function roleEligible(role?: string | null) {
  return ["operator", "supervisor"].includes(role || "");
}

function highlightCard(enabled: boolean) {
  return enabled
    ? "border-[rgba(62,166,255,0.45)] bg-[rgba(62,166,255,0.12)] shadow-[0_0_0_1px_rgba(62,166,255,0.14)]"
    : "border-[var(--border)] bg-[rgba(20,24,36,0.88)]";
}

function taskTone(type: "good" | "watch" | "action") {
  if (type === "good") return "border-emerald-400/30 bg-[rgba(34,197,94,0.12)] text-emerald-100";
  if (type === "watch") return "border-amber-400/30 bg-[rgba(245,158,11,0.12)] text-amber-100";
  return "border-sky-400/30 bg-[rgba(56,189,248,0.12)] text-sky-100";
}

export default function MyTasksPage() {
  const { locale, t } = useI18n();
  useI18nNamespaces(["common", "tasks", "attendance"]);

  const { user, loading, activeFactory, error: sessionError } = useSession();
  const searchParams = useSearchParams();
  const [todayEntries, setTodayEntries] = useState<Entry[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [queueCount, setQueueCount] = useState(0);
  const [draft, setDraft] = useState<EntryDraft | null>(null);
  const [templateContext, setTemplateContext] = useState<ActiveWorkflowTemplateContext | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [error, setError] = useState("");

  const focus = searchParams.get("focus") || "";
  const canUseTasks = roleEligible(user?.role);
  const isSteelFactory = (activeFactory?.industry_type || "").toLowerCase() === "steel";

  const shiftLabel = useCallback(
    (value?: string | null) => {
      if (!value) return "-";
      return t(`attendance.shift.${value}`, value.charAt(0).toUpperCase() + value.slice(1));
    },
    [t],
  );

  const loadTasks = useCallback(
    async (options?: { background?: boolean }) => {
      if (!user || !canUseTasks) {
        setPageLoading(false);
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
        const [entriesResult, alertsResult, queueResult, draftResult, templateResult] = await Promise.allSettled([
          getTodayEntries(),
          listUnreadAlerts(),
          countQueuedEntries(user.id),
          loadDraft(user.id),
          getActiveWorkflowTemplate(),
        ]);

        if (entriesResult.status === "fulfilled") setTodayEntries(entriesResult.value);
        if (alertsResult.status === "fulfilled") setAlerts(alertsResult.value);
        if (queueResult.status === "fulfilled") setQueueCount(queueResult.value);
        if (draftResult.status === "fulfilled") setDraft(draftResult.value);
        if (templateResult.status === "fulfilled") setTemplateContext(templateResult.value);

        const firstFailure = [entriesResult, alertsResult, queueResult, draftResult, templateResult].find(
          (result) => result.status === "rejected",
        );
        if (firstFailure && firstFailure.status === "rejected") {
          setError(firstFailure.reason instanceof Error ? firstFailure.reason.message : t("tasks.errors.load", "Could not load your task board."));
        }
      } finally {
        setLastUpdatedAt(new Date().toISOString());
        setHasLoadedOnce(true);
        setPageLoading(false);
        setRefreshing(false);
      }
    },
    [canUseTasks, t, user],
  );

  useEffect(() => {
    setError("");
    setLastUpdatedAt(null);
    if (!user || !canUseTasks) {
      setTodayEntries([]);
      setAlerts([]);
      setQueueCount(0);
      setDraft(null);
      setTemplateContext(null);
      setHasLoadedOnce(false);
      setPageLoading(true);
      return;
    }
    setHasLoadedOnce(false);
  }, [canUseTasks, user]);

  useEffect(() => {
    if (!user || !canUseTasks) {
      setPageLoading(false);
      return;
    }
    void loadTasks();
  }, [canUseTasks, loadTasks, user]);

  useEffect(() => {
    if (!user || !canUseTasks) return;
    const refresh = () => {
      if (!document.hidden) {
        void loadTasks({ background: true });
      }
    };
    const timer = window.setInterval(refresh, AUTO_REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [canUseTasks, loadTasks, user]);

  useEffect(() => {
    if (!user || !canUseTasks) return;
    const refreshQueue = () => {
      countQueuedEntries(user.id).then(setQueueCount).catch(() => setQueueCount(0));
    };
    refreshQueue();
    return subscribeToQueueUpdates(refreshQueue);
  }, [canUseTasks, user]);

  const submittedShifts = useMemo(() => new Set(todayEntries.map((entry) => entry.shift)), [todayEntries]);
  const pendingShifts = useMemo(
    () => ALL_SHIFTS.filter((shift) => !submittedShifts.has(shift)).length,
    [submittedShifts],
  );
  const nextShift = useMemo(
    () => ALL_SHIFTS.find((shift) => !submittedShifts.has(shift)) || "morning",
    [submittedShifts],
  );
  const quickTasks = useMemo(() => {
    const items = [] as Array<{ title: string; detail: string; href: string; tone: "good" | "watch" | "action" }>;
    if (pendingShifts > 0) {
      items.push({
        title: t("tasks.task.complete_shift", "Complete the {{shift}} shift entry", { shift: shiftLabel(nextShift) }),
        detail: t("tasks.task.complete_shift_detail", "{{count}} shift slot{{suffix}} still open today.", {
          count: pendingShifts,
          suffix: pendingShifts === 1 ? "" : "s",
        }),
        href: `/entry?date=${draft?.date || localDateValue()}&shift=${nextShift}`,
        tone: "action",
      });
    }
    if (draft) {
      items.push({
        title: t("tasks.task.continue_draft", "Continue your saved draft"),
        detail: t("tasks.task.continue_draft_detail", "{{shift}} shift draft saved for {{date}}.", {
          shift: shiftLabel(draft.shift),
          date: formatDate(draft.date, locale),
        }),
        href: `/entry?date=${draft.date}&shift=${draft.shift}&focus=draft`,
        tone: "watch",
      });
    }
    if (queueCount > 0) {
      items.push({
        title: t("tasks.task.sync_queue", "Sync the offline queue"),
        detail: t("tasks.task.sync_queue_detail", "{{count}} offline item{{suffix}} still waiting on this device.", {
          count: queueCount,
          suffix: queueCount === 1 ? "" : "s",
        }),
        href: "/tasks?focus=offline",
        tone: "watch",
      });
    }
    if (alerts.length > 0) {
      items.push({
        title: t("tasks.task.review_alerts", "Review factory alerts"),
        detail: t("tasks.task.review_alerts_detail", "{{count}} unread alert{{suffix}} still need attention.", {
          count: alerts.length,
          suffix: alerts.length === 1 ? "" : "s",
        }),
        href: "/dashboard",
        tone: "action",
      });
    }
    if (!items.length) {
      items.push({
        title: t("tasks.task.clear", "You are clear for now"),
        detail: t("tasks.task.clear_detail", "All shift slots, drafts, and queue items are in a healthy state."),
        href: "/dashboard",
        tone: "good",
      });
    }
    return items;
  }, [alerts.length, draft, locale, nextShift, pendingShifts, queueCount, shiftLabel, t]);
  const primaryTask = quickTasks[0] ?? null;
  const supportingTasks = quickTasks.slice(1);
  const topAlert = alerts[0] ?? null;

  if (loading || (pageLoading && !hasLoadedOnce)) {
    return (
      <main className="min-h-screen px-4 py-8 md:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <Skeleton className="h-32 rounded-[2rem]" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-36 rounded-2xl" />
            ))}
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-64 rounded-2xl" />
            ))}
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
              <div className="text-sm uppercase tracking-[0.26em] text-[var(--accent)]">{t("tasks.title", "My Tasks")}</div>
              <CardTitle>{t("tasks.sign_in_title", "Sign in to open your task board")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Link href="/access"><Button>{t("dashboard.action.open_login", "Open Access")}</Button></Link>
              <Link href="/dashboard"><Button variant="outline">{t("common.back", "Back")} {t("navigation.nav.today_board.label", "Dashboard")}</Button></Link>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  if (!canUseTasks) {
    return (
      <main className="min-h-screen px-4 py-8 md:px-8">
        <div className="mx-auto max-w-4xl">
          <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.88)]">
            <CardHeader>
              <div className="text-sm uppercase tracking-[0.26em] text-[var(--accent)]">{t("tasks.title", "My Tasks")}</div>
              <CardTitle>{t("tasks.worker_only_title", "This worker board is kept simple on purpose")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-[var(--muted)]">
              <p>
                {t("tasks.worker_only_body", "Your current role is {{role}}. We keep this page for worker-first daily use so managers and owners stay on the main operations and reporting boards.", { role: user.role })}
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/dashboard"><Button>{t("tasks.actions.open_operations", "Open Operations Board")}</Button></Link>
                <Link href="/approvals"><Button variant="outline">{t("tasks.actions.open_approvals", "Open Approval Inbox")}</Button></Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="flex flex-col gap-4 rounded-[2rem] border border-[var(--border)] bg-[rgba(20,24,36,0.88)] p-6 shadow-2xl backdrop-blur md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <div className="text-sm uppercase tracking-[0.32em] text-[var(--accent)]">{t("tasks.hero.eyebrow", "Daily Work")}</div>
            <h1 className="text-3xl font-semibold md:text-4xl">{t("tasks.title", "My Tasks")}</h1>
            <p className="max-w-3xl text-sm text-[var(--muted)]">{t("tasks.hero.subtitle", "Start the next task and clear blockers.")}</p>
          </div>
          <div className="space-y-2 text-sm text-[var(--muted)]">
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-[var(--border)] px-3 py-1.5">
                {t("tasks.hero.active_factory", "Factory: {{value}}", { value: activeFactory?.name || user.factory_name })}
              </span>
              <span className="rounded-full border border-[var(--border)] px-3 py-1.5">
                {t("tasks.hero.workflow", "Workflow: {{value}}", { value: templateContext?.workflow_template_label || activeFactory?.workflow_template_label || "Standard" })}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                className="px-4 py-2 text-xs"
                onClick={() => {
                  void loadTasks({ background: true });
                }}
                disabled={refreshing}
              >
                {refreshing ? t("tasks.hero.refreshing", "Refreshing...") : t("tasks.hero.refresh", "Refresh Tasks")}
              </Button>
              <span className="text-xs text-[var(--muted)]">
                {refreshing
                  ? t("tasks.hero.updating", "Updating tasks...")
                  : lastUpdatedAt
                    ? t("tasks.hero.updated", "Updated {{value}}", { value: formatDateTime(lastUpdatedAt, locale) })
                    : t("tasks.hero.live_updates", "Live updates every 25 seconds")}
              </span>
            </div>
          </div>
        </section>

        <GuidanceBlock
          surfaceKey="my-tasks"
          title={t("tasks.steps.title", "Task tips")}
          summary={t("tasks.steps.summary", "Start the next task first. Open saved work or alerts only when needed.")}
          eyebrow={t("tasks.steps.eyebrow", "On demand")}
          autoOpenVisits={1}
        >
          <div className="grid gap-3 xl:grid-cols-3">
          {[
            { label: t("tasks.steps.start", "Start next"), detail: t("tasks.steps.start_detail", "{{value}}", { value: primaryTask?.title || t("tasks.task.clear", "You are clear for now") }) },
            { label: t("tasks.steps.saved", "Check saved work"), detail: draft ? t("tasks.steps.saved_with_draft", "Continue the saved draft or sync offline work.") : t("tasks.steps.saved_empty", "Nothing is waiting in local draft storage.") },
            {
              label: t("tasks.steps.clear", "Clear signals"),
              detail: alerts.length
                ? t("tasks.steps.clear_with_alerts", "{{count}} unread alert{{suffix}} still need attention.", { count: alerts.length, suffix: alerts.length === 1 ? "" : "s" })
                : t("tasks.steps.clear_empty", "No unread alerts are blocking you right now."),
            },
          ].map((step) => (
            <div key={step.label} className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] px-4 py-4">
              <div className="text-sm font-semibold text-[var(--text)]">{step.label}</div>
              <div className="mt-2 text-sm text-[var(--muted)]">{step.detail}</div>
            </div>
          ))}
          </div>
        </GuidanceBlock>

        {error ? <div className="rounded-2xl border border-red-400/30 bg-[rgba(239,68,68,0.12)] px-4 py-3 text-sm text-red-100">{error}</div> : null}
        {refreshing ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] px-4 py-3 text-sm text-[var(--muted)]">
            {t("tasks.refreshing_background", "Refreshing task board in the background...")}
          </div>
        ) : null}
        {sessionError ? <div className="rounded-2xl border border-red-400/30 bg-[rgba(239,68,68,0.12)] px-4 py-3 text-sm text-red-100">{sessionError}</div> : null}

        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <Card className={highlightCard(Boolean(primaryTask) && primaryTask.tone !== "good") || undefined}>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">{t("tasks.next_task", "Next Task")}</div>
              <CardTitle className="text-xl">{primaryTask?.title || t("tasks.clear_state", "You are clear for now")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {primaryTask ? (
                <div className={`rounded-3xl border px-5 py-5 ${taskTone(primaryTask.tone)}`}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="max-w-xl">
                      <div className="text-sm font-semibold text-[var(--text)]">{primaryTask.title}</div>
                      <div className="mt-2 text-sm leading-6 text-[var(--muted)]">{primaryTask.detail}</div>
                    </div>
                    <Link href={primaryTask.href}>
                      <Button className="px-5 py-2 text-sm">{t("tasks.start_now", "Start now")}</Button>
                    </Link>
                  </div>
                </div>
              ) : null}
              {supportingTasks.length ? (
                <details className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] px-4 py-4">
                  <summary className="cursor-pointer list-none text-sm font-semibold text-[var(--text)]">
                    {t("tasks.more_tasks", "More tasks")}
                  </summary>
                  <div className="mt-4 space-y-3">
                    {supportingTasks.map((task) => (
                      <div key={`${task.title}-${task.href}`} className={`rounded-2xl border px-4 py-4 ${taskTone(task.tone)}`}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-[var(--text)]">{task.title}</div>
                            <div className="mt-1 text-xs leading-5 text-[var(--muted)]">{task.detail}</div>
                          </div>
                          <Link href={task.href}>
                            <Button variant="outline" className="px-4 py-2 text-xs">{t("common.open", "Open")}</Button>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">{t("tasks.today_status", "Today Status")}</div>
              <CardTitle className="text-xl">{t("tasks.keep_shift_moving", "Keep the shift moving")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  {
                    label: t("tasks.tile.pending_shifts", "Pending shifts"),
                    value: pendingShifts.toString(),
                    detail: pendingShifts > 0 ? t("tasks.tile.pending_shifts_detail", "{{shift}} shift is next.", { shift: shiftLabel(nextShift) }) : t("tasks.tile.pending_shifts_clear", "All shifts are covered."),
                    active: focus === "today",
                  },
                  {
                    label: t("tasks.tile.saved_draft", "Saved draft"),
                    value: draft ? shiftLabel(draft.shift) : t("tasks.tile.saved_draft_empty", "No draft"),
                    detail: draft ? t("tasks.tile.saved_draft_detail", "Saved for {{date}}.", { date: formatDate(draft.date, locale) }) : t("tasks.tile.saved_draft_empty", "Nothing saved locally."),
                    active: Boolean(draft) || focus === "draft",
                  },
                  {
                    label: t("tasks.tile.offline_queue", "Offline queue"),
                    value: queueCount.toString(),
                    detail: queueCount > 0 ? t("tasks.tile.offline_queue_detail", "Sync is still waiting.") : t("tasks.tile.offline_queue_empty", "No queued offline work."),
                    active: focus === "offline",
                  },
                  {
                    label: t("tasks.tile.unread_alerts", "Unread alerts"),
                    value: alerts.length.toString(),
                    detail: alerts.length ? t("tasks.tile.unread_alerts_detail", "Signals are waiting.") : t("tasks.tile.unread_alerts_empty", "No unread alerts."),
                    active: focus === "alerts",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className={`rounded-2xl border px-4 py-4 ${highlightCard(item.active)}`}
                  >
                    <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">{item.label}</div>
                    <div className="mt-2 text-xl font-semibold text-[var(--text)]">{item.value}</div>
                    <div className="mt-2 text-xs leading-5 text-[var(--muted)]">{item.detail}</div>
                  </div>
                ))}
              </div>
              <details className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] px-4 py-4">
                <summary className="cursor-pointer list-none text-sm font-semibold text-[var(--text)]">
                  {t("tasks.tools.title", "Task tools")}
                </summary>
                <div className="mt-4 space-y-4">
                  <div className="rounded-2xl border border-[var(--border)] bg-[rgba(20,24,36,0.7)] p-4 text-sm text-[var(--muted)]">
                    {t("tasks.tools.subtitle", "Use this tray for direct jumps after you finish the next task.")}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Link href="/entry"><Button variant="outline">{t("tasks.tools.shift_entry", "Shift Entry")}</Button></Link>
                    <Link href="/ocr/scan"><Button variant="outline">{t("tasks.tools.capture", "Capture")}</Button></Link>
                    {isSteelFactory ? <Link href="/steel"><Button variant="outline">{t("tasks.tools.steel_ops", "Steel Ops")}</Button></Link> : null}
                    <Link href="/dashboard"><Button variant="ghost">{t("tasks.tools.operations", "Operations")}</Button></Link>
                  </div>
                </div>
              </details>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <Card>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">{t("tasks.submitted.title", "Submitted Today")}</div>
              <CardTitle className="text-xl">{t("tasks.submitted.subtitle", "Shift progress")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {todayEntries.length ? todayEntries.map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-[var(--text)]">{t("tasks.submitted.shift", "{{shift}} shift", { shift: shiftLabel(entry.shift) })}</div>
                      <div className="mt-1 text-xs text-[var(--muted)]">{t("tasks.submitted.detail", "{{units}} units produced - {{status}}", { units: entry.units_produced, status: entry.status })}</div>
                    </div>
                    <Link href={`/entry/${entry.id}`}>
                      <Button variant="outline" className="px-4 py-2 text-xs">{t("common.open", "Open")}</Button>
                    </Link>
                  </div>
                </div>
              )) : (
                <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-6 text-sm text-[var(--muted)]">
                  {t("tasks.submitted.empty", "No shift entry has been submitted today yet.")}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">{t("tasks.alerts.title", "Attention Signals")}</div>
              <CardTitle className="text-xl">{t("tasks.alerts.subtitle", "Current alerts")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {topAlert ? (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="max-w-xl">
                      <div className="text-sm font-semibold text-[var(--text)]">{topAlert.message}</div>
                      <div className="mt-1 text-xs text-[var(--muted)]">{topAlert.severity} - {topAlert.alert_type} - {formatDate(topAlert.created_at, locale)}</div>
                    </div>
                    <Link href="/dashboard">
                      <Button variant="outline" className="px-4 py-2 text-xs">{t("tasks.alerts.board", "Open board")}</Button>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-6 text-sm text-[var(--muted)]">
                  {t("tasks.alerts.empty", "No unread alerts right now.")}
                </div>
              )}
              {alerts.length > 1 ? (
                <details className="rounded-2xl border border-[var(--border)] bg-[rgba(20,24,36,0.7)] px-4 py-4">
                  <summary className="cursor-pointer list-none text-sm font-semibold text-[var(--text)]">
                    {t("tasks.alerts.more", "More alerts")}
                  </summary>
                  <div className="mt-4 space-y-3">
                    {alerts.slice(1, 6).map((alert) => (
                      <div key={alert.id} className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                        <div className="text-sm font-semibold text-[var(--text)]">{alert.message}</div>
                        <div className="mt-1 text-xs text-[var(--muted)]">{alert.severity} - {alert.alert_type} - {formatDate(alert.created_at, locale)}</div>
                      </div>
                    ))}
                  </div>
                </details>
              ) : null}
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
