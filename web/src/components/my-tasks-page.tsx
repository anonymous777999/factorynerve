"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { getActiveWorkflowTemplate, type ActiveWorkflowTemplateContext } from "@/lib/auth";
import { listUnreadAlerts, type AlertItem } from "@/lib/dashboard";
import { getTodayEntries, type Entry } from "@/lib/entries";
import {
  countQueuedEntries,
  loadDraft,
  subscribeToQueueUpdates,
  type EntryDraft,
} from "@/lib/offline-entries";
import { useSession } from "@/lib/use-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const ALL_SHIFTS = ["morning", "evening", "night"] as const;
const AUTO_REFRESH_MS = 25_000;

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
          setError(firstFailure.reason instanceof Error ? firstFailure.reason.message : "Could not load your task board.");
        }
      } finally {
        setLastUpdatedAt(new Date().toISOString());
        setHasLoadedOnce(true);
        setPageLoading(false);
        setRefreshing(false);
      }
    },
    [canUseTasks, user],
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
        title: `Complete the ${nextShift} shift entry`,
        detail: `${pendingShifts} shift slot${pendingShifts === 1 ? "" : "s"} still open today.`,
        href: `/entry?date=${draft?.date || localDateValue()}&shift=${nextShift}`,
        tone: "action",
      });
    }
    if (draft) {
      items.push({
        title: "Continue your saved draft",
        detail: `${draft.shift} shift draft saved for ${formatDate(draft.date)}.`,
        href: `/entry?date=${draft.date}&shift=${draft.shift}&focus=draft`,
        tone: "watch",
      });
    }
    if (queueCount > 0) {
      items.push({
        title: "Sync the offline queue",
        detail: `${queueCount} offline item${queueCount === 1 ? "" : "s"} still waiting on this device.`,
        href: "/tasks?focus=offline",
        tone: "watch",
      });
    }
    if (alerts.length > 0) {
      items.push({
        title: "Review factory alerts",
        detail: `${alerts.length} unread alert${alerts.length === 1 ? "" : "s"} still need attention.`,
        href: "/dashboard",
        tone: "action",
      });
    }
    if (!items.length) {
      items.push({
        title: "You are clear for now",
        detail: "All shift slots, drafts, and queue items are in a healthy state.",
        href: "/dashboard",
        tone: "good",
      });
    }
    return items;
  }, [alerts.length, draft, nextShift, pendingShifts, queueCount]);

  if (loading || (pageLoading && !hasLoadedOnce)) {
    return (
      <main className="min-h-screen px-4 py-8 shell-bottom-clearance md:px-8">
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
      <main className="min-h-screen px-4 py-8 shell-bottom-clearance md:px-8">
        <div className="mx-auto max-w-4xl">
          <Card>
            <CardHeader>
              <div className="text-sm uppercase tracking-[0.26em] text-[var(--accent)]">My Tasks</div>
              <CardTitle>Please login to open your task board</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Link href="/login"><Button>Open Login</Button></Link>
              <Link href="/dashboard"><Button variant="outline">Back to Dashboard</Button></Link>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  if (!canUseTasks) {
    return (
      <main className="min-h-screen px-4 py-8 shell-bottom-clearance md:px-8">
        <div className="mx-auto max-w-4xl">
          <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.88)]">
            <CardHeader>
              <div className="text-sm uppercase tracking-[0.26em] text-[var(--accent)]">My Tasks</div>
              <CardTitle>This worker board is kept simple on purpose</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-[var(--muted)]">
              <p>
                Your current role is <span className="font-semibold text-[var(--text)]">{user.role}</span>. We keep this page for worker-first daily use so managers and owners stay on the main operations and reporting boards.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/dashboard"><Button>Open Operations Board</Button></Link>
                <Link href="/approvals"><Button variant="outline">Open Approval Inbox</Button></Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-6 shell-bottom-clearance md:px-8 md:pb-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="flex flex-col gap-4 rounded-[2rem] border border-[var(--border)] bg-[rgba(20,24,36,0.88)] p-6 shadow-2xl backdrop-blur md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <div className="text-sm uppercase tracking-[0.32em] text-[var(--accent)]">Daily Work</div>
            <h1 className="text-3xl font-semibold md:text-4xl">My Tasks</h1>
            <p className="max-w-3xl text-sm text-[var(--muted)]">
              This page keeps the day simple: what still needs entry, what is saved offline, and what factory signals need your attention.
            </p>
          </div>
          <div className="space-y-2 text-sm text-[var(--muted)]">
            <div>Active factory: <span className="font-semibold text-[var(--text)]">{activeFactory?.name || user.factory_name}</span></div>
            <div>Workflow: <span className="font-semibold text-[var(--text)]">{templateContext?.workflow_template_label || activeFactory?.workflow_template_label || "Standard"}</span></div>
            <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center">
              <Button
                variant="outline"
                className="w-full px-4 py-2 text-xs sm:w-auto"
                onClick={() => {
                  void loadTasks({ background: true });
                }}
                disabled={refreshing}
              >
                {refreshing ? "Refreshing..." : "Refresh Tasks"}
              </Button>
              <span className="text-xs text-[var(--muted)]">
                {refreshing
                  ? "Updating tasks..."
                  : lastUpdatedAt
                    ? `Updated ${formatDateTime(lastUpdatedAt)}`
                    : "Live updates every 25 seconds"}
              </span>
            </div>
          </div>
        </section>

        {error ? <div className="rounded-2xl border border-red-400/30 bg-[rgba(239,68,68,0.12)] px-4 py-3 text-sm text-red-100">{error}</div> : null}
        {refreshing ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] px-4 py-3 text-sm text-[var(--muted)]">
            Refreshing task board in the background...
          </div>
        ) : null}
        {sessionError ? <div className="rounded-2xl border border-red-400/30 bg-[rgba(239,68,68,0.12)] px-4 py-3 text-sm text-red-100">{sessionError}</div> : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className={highlightCard(focus === "today") || undefined}>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">Pending Shifts</div>
              <CardTitle>{pendingShifts}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-[var(--muted)]">
              <div>{pendingShifts > 0 ? `${nextShift} shift is next in line.` : "All shift slots have already been entered today."}</div>
              <Link href={`/entry?date=${draft?.date || localDateValue()}&shift=${nextShift}`}>
                <Button variant="outline" className="w-full px-4 py-2 text-xs sm:w-auto">Open Shift Entry</Button>
              </Link>
            </CardContent>
          </Card>
          <Card className={highlightCard(Boolean(draft) || focus === "draft") || undefined}>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">Saved Draft</div>
              <CardTitle>{draft ? `${draft.shift}` : "No draft"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-[var(--muted)]">
              <div>{draft ? `Saved for ${formatDate(draft.date)}.` : "Nothing is waiting in local draft storage right now."}</div>
              <Link href={draft ? `/entry?date=${draft.date}&shift=${draft.shift}&focus=draft` : "/entry"}>
                <Button variant="outline" className="w-full px-4 py-2 text-xs sm:w-auto">{draft ? "Continue Draft" : "Open Entry"}</Button>
              </Link>
            </CardContent>
          </Card>
          <Card className={highlightCard(focus === "offline") || undefined} id="offline">
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">Offline Queue</div>
              <CardTitle>{queueCount}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-[var(--muted)]">
              <div>{queueCount > 0 ? `${queueCount} item${queueCount === 1 ? " is" : "s are"} still waiting to sync.` : "This device has no waiting offline work."}</div>
              <Link href="/entry?focus=offline">
                <Button variant="outline" className="w-full px-4 py-2 text-xs sm:w-auto">Open Entry & Sync</Button>
              </Link>
            </CardContent>
          </Card>
          <Card className={highlightCard(focus === "alerts") || undefined}>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">Unread Alerts</div>
              <CardTitle>{alerts.length}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-[var(--muted)]">
              <div>{alerts.length ? "Factory alerts are waiting for attention on the board." : "No unread alerts right now."}</div>
              <Link href="/dashboard">
                <Button variant="outline" className="w-full px-4 py-2 text-xs sm:w-auto">Open Operations Board</Button>
              </Link>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <Card>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">Next Actions</div>
              <CardTitle className="text-xl">What to do next</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {quickTasks.map((task) => (
                <div key={`${task.title}-${task.href}`} className={`rounded-2xl border px-4 py-4 ${taskTone(task.tone)}`}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[var(--text)]">{task.title}</div>
                      <div className="mt-1 text-xs leading-5 text-[var(--muted)]">{task.detail}</div>
                    </div>
                    <Link href={task.href}>
                      <Button variant="outline" className="w-full px-4 py-2 text-xs sm:w-auto">Open</Button>
                    </Link>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">Today&apos;s Submitted Entries</div>
              <CardTitle className="text-xl">Shift progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {todayEntries.length ? todayEntries.map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[var(--text)]">{entry.shift} shift</div>
                      <div className="mt-1 text-xs text-[var(--muted)]">{entry.units_produced} units produced - {entry.status}</div>
                    </div>
                    <Link href={`/entry/${entry.id}`}>
                      <Button variant="outline" className="w-full px-4 py-2 text-xs sm:w-auto">Open</Button>
                    </Link>
                  </div>
                </div>
              )) : (
                <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-6 text-sm text-[var(--muted)]">
                  No shift entry has been submitted today yet.
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <Card>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">Attention Signals</div>
              <CardTitle className="text-xl">Current alerts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {alerts.length ? alerts.slice(0, 6).map((alert) => (
                <div key={alert.id} className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                  <div className="text-sm font-semibold text-[var(--text)]">{alert.message}</div>
                  <div className="mt-1 text-xs text-[var(--muted)]">{alert.severity} - {alert.alert_type} - {formatDate(alert.created_at)}</div>
                </div>
              )) : (
                <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-6 text-sm text-[var(--muted)]">
                  No unread alerts right now.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">Quick Jump</div>
              <CardTitle className="text-xl">Factory shortcuts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-[var(--muted)]">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                Use this page when you want the shortest path back into work instead of opening the full dashboard first.
              </div>
              <div className="grid gap-3 sm:flex sm:flex-wrap">
                <Link href="/entry"><Button variant="outline" className="w-full sm:w-auto">Shift Entry</Button></Link>
                <Link href="/ocr/scan"><Button variant="outline" className="w-full sm:w-auto">Document Capture</Button></Link>
                {isSteelFactory ? <Link href="/steel"><Button variant="outline" className="w-full sm:w-auto">Steel Operations</Button></Link> : null}
                <Link href="/dashboard"><Button variant="ghost" className="w-full sm:w-auto">Operations Board</Button></Link>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
