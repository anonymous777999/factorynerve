"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  getMyAttendanceToday,
  listAttendanceReview,
  type AttendanceReviewPayload,
  type AttendanceToday,
} from "@/lib/attendance";
import { listUnreadAlerts, type AlertItem } from "@/lib/dashboard";
import { getTodayEntries, listEntries, type Entry } from "@/lib/entries";
import {
  countQueuedEntries,
  loadDraft,
  subscribeToQueueUpdates,
  type EntryDraft,
} from "@/lib/offline-entries";
import { listOcrVerifications } from "@/lib/ocr";
import { subscribeToWorkflowRefresh } from "@/lib/workflow-sync";
import { useSession } from "@/lib/use-session";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type ReminderTone = "danger" | "watch" | "info";

type ReminderItem = {
  id: string;
  title: string;
  detail: string;
  href: string;
  action: string;
  tone: ReminderTone;
  priority: number;
};

type ReminderState = {
  attendanceToday: AttendanceToday | null;
  attendanceReview: AttendanceReviewPayload | null;
  todayEntries: Entry[];
  alerts: AlertItem[];
  draft: EntryDraft | null;
  queueCount: number;
  pendingEntryTotal: number;
  pendingVerificationCount: number;
};

const ALL_SHIFTS = ["morning", "evening", "night"] as const;
const AUTO_REFRESH_MS = 25_000;
const RAIL_COUNT_REFRESH_EVENT = "dpr:rail-counts-refresh";

function emptyState(): ReminderState {
  return {
    attendanceToday: null,
    attendanceReview: null,
    todayEntries: [],
    alerts: [],
    draft: null,
    queueCount: 0,
    pendingEntryTotal: 0,
    pendingVerificationCount: 0,
  };
}

function formatShift(value?: string | null) {
  if (!value) return "-";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function roleNeedsPunchReminder(role?: string | null) {
  return ["attendance", "operator", "supervisor", "manager"].includes(role || "");
}

function roleNeedsShiftEntryReminder(role?: string | null) {
  return ["operator", "supervisor", "manager"].includes(role || "");
}

function roleCanReview(role?: string | null) {
  return ["supervisor", "manager", "admin", "owner"].includes(role || "");
}

function toneClasses(tone: ReminderTone) {
  if (tone === "danger") {
    return "border-status-danger-border bg-status-danger-bg";
  }
  if (tone === "watch") {
    return "border-status-warning-border bg-status-warning-bg";
  }
  return "border-status-processing-border bg-status-processing-bg";
}

function dotClasses(tone: ReminderTone) {
  if (tone === "danger") return "bg-status-danger-icon";
  if (tone === "watch") return "bg-status-warning-icon";
  return "bg-status-processing-icon";
}

function toneBadgeStatus(tone: ReminderTone) {
  if (tone === "danger") return "error" as const;
  if (tone === "watch") return "warning" as const;
  return "processing" as const;
}

function toneLabel(tone: ReminderTone) {
  if (tone === "danger") return "Action now";
  if (tone === "watch") return "Queue next";
  return "In view";
}

export function WorkflowReminderStrip({ className }: { className?: string }) {
  const { user } = useSession();
  const [state, setState] = useState<ReminderState>(() => emptyState());

  const needsPunchReminder = roleNeedsPunchReminder(user?.role);
  const needsShiftEntryReminder = roleNeedsShiftEntryReminder(user?.role);
  const canReview = roleCanReview(user?.role);

  const loadRemote = useCallback(
    async (options?: { background?: boolean }) => {
      if (!user) return;
      const tasks: Array<Promise<unknown>> = [listUnreadAlerts()];
      const indexes = {
        alerts: 0,
        attendanceToday: -1,
        todayEntries: -1,
        attendanceReview: -1,
        pendingEntries: -1,
        pendingVerifications: -1,
      };

      if (needsPunchReminder) {
        indexes.attendanceToday = tasks.length;
        tasks.push(getMyAttendanceToday());
      }

      if (needsShiftEntryReminder) {
        if (indexes.attendanceToday < 0) {
          indexes.attendanceToday = tasks.length;
          tasks.push(getMyAttendanceToday());
        }
        indexes.todayEntries = tasks.length;
        tasks.push(getTodayEntries());
      }

      if (canReview) {
        indexes.attendanceReview = tasks.length;
        tasks.push(listAttendanceReview());
        indexes.pendingEntries = tasks.length;
        tasks.push(listEntries({ status: ["pending"], page: 1, page_size: 1 }));
        indexes.pendingVerifications = tasks.length;
        tasks.push(listOcrVerifications("pending"));
      }

      const results = await Promise.allSettled(tasks);
      setState((current) => {
        const next = options?.background ? { ...current } : emptyState();

        const alertsResult = results[indexes.alerts];
        if (alertsResult?.status === "fulfilled") {
          next.alerts = alertsResult.value as AlertItem[];
        }

        if (indexes.attendanceToday >= 0) {
          const attendanceResult = results[indexes.attendanceToday];
          if (attendanceResult?.status === "fulfilled") {
            next.attendanceToday = attendanceResult.value as AttendanceToday;
          }
        }

        if (indexes.todayEntries >= 0) {
          const todayEntriesResult = results[indexes.todayEntries];
          if (todayEntriesResult?.status === "fulfilled") {
            next.todayEntries = todayEntriesResult.value as Entry[];
          }
        }

        if (indexes.attendanceReview >= 0) {
          const attendanceReviewResult = results[indexes.attendanceReview];
          if (attendanceReviewResult?.status === "fulfilled") {
            next.attendanceReview = attendanceReviewResult.value as AttendanceReviewPayload;
          }
        }

        if (indexes.pendingEntries >= 0) {
          const pendingEntriesResult = results[indexes.pendingEntries];
          if (
            pendingEntriesResult?.status === "fulfilled" &&
            pendingEntriesResult.value &&
            typeof pendingEntriesResult.value === "object" &&
            "total" in pendingEntriesResult.value
          ) {
            next.pendingEntryTotal = Number((pendingEntriesResult.value as { total?: number }).total || 0);
          }
        }

        if (indexes.pendingVerifications >= 0) {
          const pendingVerificationsResult = results[indexes.pendingVerifications];
          if (pendingVerificationsResult?.status === "fulfilled") {
            next.pendingVerificationCount = Array.isArray(pendingVerificationsResult.value)
              ? pendingVerificationsResult.value.length
              : 0;
          }
        }

        return next;
      });
    },
    [canReview, needsPunchReminder, needsShiftEntryReminder, user],
  );

  const loadLocal = useCallback(async () => {
    if (!user || !needsShiftEntryReminder) return;
    const [queueResult, draftResult] = await Promise.allSettled([countQueuedEntries(user.id), loadDraft(user.id)]);
    setState((current) => ({
      ...current,
      queueCount: queueResult.status === "fulfilled" ? queueResult.value : current.queueCount,
      draft: draftResult.status === "fulfilled" ? draftResult.value : current.draft,
    }));
  }, [needsShiftEntryReminder, user]);

  useEffect(() => {
    if (!user) return;
    const timer = window.setTimeout(() => {
      void loadRemote();
      void loadLocal();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadLocal, loadRemote, user]);

  useEffect(() => {
    if (!user) return;
    const onVisibility = () => {
      if (!document.hidden) {
        void loadRemote({ background: true });
        void loadLocal();
      }
    };
    const interval = window.setInterval(() => {
      if (!document.hidden) {
        void loadRemote({ background: true });
      }
    }, AUTO_REFRESH_MS);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [loadLocal, loadRemote, user]);

  useEffect(() => {
    if (!user) return;
    return subscribeToQueueUpdates(() => {
      void loadLocal();
    });
  }, [loadLocal, user]);

  useEffect(() => {
    if (!user) return;
    return subscribeToWorkflowRefresh(() => {
      void loadRemote({ background: true });
      void loadLocal();
    });
  }, [loadLocal, loadRemote, user]);

  useEffect(() => {
    if (!user) return;
    const onCountsRefresh = () => {
      void loadRemote({ background: true });
    };
    window.addEventListener(RAIL_COUNT_REFRESH_EVENT, onCountsRefresh);
    return () => window.removeEventListener(RAIL_COUNT_REFRESH_EVENT, onCountsRefresh);
  }, [loadRemote, user]);

  const reminders = useMemo(() => {
    const next: ReminderItem[] = [];
    const submittedShifts = new Set(state.todayEntries.map((entry) => entry.shift));
    const draftAlreadySubmitted = state.draft && submittedShifts.has(state.draft.shift);

    if (needsPunchReminder && state.attendanceToday?.can_punch_in) {
      next.push({
        id: "punch-in",
        title: "Punch in is still open",
        detail: `${formatShift(state.attendanceToday.shift)} shift has not started in attendance yet.`,
        href: "/attendance",
        action: "Open Attendance",
        tone: "danger",
        priority: 100,
      });
    }

    if (needsPunchReminder && state.attendanceToday?.status === "missed_punch") {
      next.push({
        id: "missed-punch",
        title: "Attendance needs closure",
        detail: "A missed punch still needs supervisor review before the day can close.",
        href: "/attendance",
        action: "Check Attendance",
        tone: "danger",
        priority: 96,
      });
    }

    if (needsShiftEntryReminder && state.draft && !draftAlreadySubmitted) {
      next.push({
        id: "saved-draft",
        title: "Saved shift draft is waiting",
        detail: `${formatShift(state.draft.shift)} entry is not submitted yet.`,
        href: `/entry?date=${state.draft.date}&shift=${state.draft.shift}&focus=draft`,
        action: "Continue Draft",
        tone: "watch",
        priority: 92,
      });
    }

    if (needsShiftEntryReminder && state.queueCount > 0) {
      next.push({
        id: "offline-queue",
        title: "Offline entries still need sync",
        detail: `${state.queueCount} queued entr${state.queueCount === 1 ? "y is" : "ies are"} waiting on this device.`,
        href: "/entry?focus=offline",
        action: "Open Queue",
        tone: "info",
        priority: 84,
      });
    }

    if (needsShiftEntryReminder) {
      const nextShift = ALL_SHIFTS.find((shift) => !submittedShifts.has(shift));
      if (nextShift && (!state.draft || draftAlreadySubmitted) && !state.attendanceToday?.can_punch_in) {
        next.push({
          id: "pending-shift-entry",
          title: "Shift entry is still pending",
          detail: `${formatShift(nextShift)} shift has not been submitted today.`,
          href: `/entry?date=${state.attendanceToday?.attendance_date || ""}&shift=${nextShift}&focus=today`,
          action: "Start Entry",
          tone: "watch",
          priority: 88,
        });
      }
    }

    if (canReview && (state.attendanceReview?.totals.pending_records || 0) > 0) {
      next.push({
        id: "attendance-review",
        title: "Attendance review is waiting",
        detail: `${state.attendanceReview?.totals.pending_records || 0} attendance issue${state.attendanceReview?.totals.pending_records === 1 ? "" : "s"} need closure.`,
        href: "/attendance/review",
        action: "Review Attendance",
        tone: "danger",
        priority: 98,
      });
    }

    if (canReview && state.pendingEntryTotal > 0) {
      next.push({
        id: "pending-entry-review",
        title: "Pending entry approvals are stacking up",
        detail: `${state.pendingEntryTotal} DPR entr${state.pendingEntryTotal === 1 ? "y is" : "ies are"} waiting for review.`,
        href: "/approvals",
        action: "Open Reviews",
        tone: "watch",
        priority: 86,
      });
    }

    if (canReview && state.pendingVerificationCount > 0) {
      next.push({
        id: "ocr-review",
        title: "Scanned documents need verification",
        detail: `${state.pendingVerificationCount} OCR verification${state.pendingVerificationCount === 1 ? "" : "s"} are still pending.`,
        href: "/ocr/verify",
        action: "Verify Documents",
        tone: "info",
        priority: 78,
      });
    }

    if (state.alerts.length > 0) {
      next.push({
        id: "alerts",
        title: "Unread plant alerts are active",
        detail: `${state.alerts.length} unread alert${state.alerts.length === 1 ? "" : "s"} still need acknowledgement.`,
        href: "/work-queue",
        action: "Open Queue",
        tone: state.alerts.some((alert) => (alert.severity || "").toLowerCase() === "high") ? "danger" : "info",
        priority: 74,
      });
    }

    return next.sort((left, right) => right.priority - left.priority).slice(0, 2);
  }, [canReview, needsPunchReminder, needsShiftEntryReminder, state]);

  if (!user || !reminders.length) {
    return null;
  }

  const [primaryReminder, ...secondaryReminders] = reminders;

  return (
    <section className={cn("px-4 pt-4 lg:px-6 lg:pt-5", className)}>
      <div className="surface-panel rounded-[1.7rem] px-4 py-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
              Live Reminders
            </div>
            <div className="mt-1 text-sm text-[var(--muted)]">
              The next actions are synced across attendance, entry, scan, review, and queue.
            </div>
          </div>
          <div className="grid min-w-0 flex-1 gap-3 xl:grid-cols-[minmax(0,1fr)_17rem]">
            <div
              className={cn(
                "min-w-0 rounded-[1.35rem] border px-4 py-4 shadow-[var(--shadow-xs)]",
                toneClasses(primaryReminder.tone),
              )}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("inline-flex h-2.5 w-2.5 rounded-full", dotClasses(primaryReminder.tone))} />
                    <Badge status={toneBadgeStatus(primaryReminder.tone)} size="compact">
                      {toneLabel(primaryReminder.tone)}
                    </Badge>
                  </div>
                  <div className="mt-3 text-base font-semibold text-[var(--text)]">{primaryReminder.title}</div>
                  <div className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">{primaryReminder.detail}</div>
                </div>
                <Link href={primaryReminder.href}>
                  <Button variant="outline" className="h-10 shrink-0 px-4 text-xs">
                    {primaryReminder.action}
                  </Button>
                </Link>
              </div>
            </div>

            {secondaryReminders.length ? (
              <div className="flex min-w-0 flex-col gap-2">
                <div className="px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
                  Supporting signals
                </div>
                {secondaryReminders.map((reminder) => (
                  <div
                    key={reminder.id}
                    className={cn(
                      "min-w-0 rounded-[1.1rem] border px-3 py-3 shadow-[var(--shadow-xs)]",
                      toneClasses(reminder.tone),
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={cn("inline-flex h-2 w-2 rounded-full", dotClasses(reminder.tone))} />
                          <div className="text-sm font-semibold text-[var(--text)]">{reminder.title}</div>
                        </div>
                        <div className="mt-2 text-xs leading-5 text-[var(--muted)]">{reminder.detail}</div>
                      </div>
                      <Link href={reminder.href}>
                        <Button variant="ghost" className="h-8 shrink-0 px-2.5 text-xs">
                          {reminder.action}
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
