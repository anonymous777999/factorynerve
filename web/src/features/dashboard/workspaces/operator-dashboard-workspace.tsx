"use client";

/**
 * OperatorDashboardWorkspace — the worker-mode dashboard.
 *
 * Renders the operator's "ready for shift" home: factory + status,
 * single dominant action, quick actions, today's summary, alerts,
 * and shift status cards.
 *
 * Designed as a presentational component: all state and async loading
 * stays in the parent `DashboardHome` so the route entry can keep one
 * stable session lifecycle. A future step can convert the parent into
 * a thin selector that lazy-loads this workspace + the management
 * counterpart based on role.
 */

import Link from "next/link";

import { Button } from "@/components/ui/button";

import type { AlertItem } from "@/lib/dashboard";
import type { Entry } from "@/lib/entries";
import type { ShiftValue } from "@/features/entry/lib/entry-helpers";

import {
    attendanceStatusTone as _attendanceStatusTone,
    formatDateTime,
    formatShift,
    severityTone,
} from "../lib/dashboard-helpers";

// re-export to satisfy the lint expectation that helpers are referenced
void _attendanceStatusTone;

export type WorkerStatus = {
    label: string;
    tone: string;
    title: string;
    detail: string;
};

export type WorkerPrimaryAction = {
    href: string;
    label: string;
    detail: string;
};

export type WorkerQuickAction = {
    key: string;
    label: string;
    href: string;
    meta: string;
};

export type TodayShiftCard = {
    shift: ShiftValue;
    entry: Entry | null;
};

export type OperatorDashboardWorkspaceProps = {
    /** Active factory display name. */
    factoryName: string;
    /** Network state for the small "Online/Offline" pill. */
    online: boolean;
    /** "Punch in recorded" / "Entry saved" success message. */
    status?: string | null;
    /** Local error message. */
    error?: string | null;
    /** Session error (typically auth refresh failure). */
    sessionError?: string | null;
    /** Worker status for the hero panel. */
    workerStatus: WorkerStatus;
    /** Single dominant action. */
    workerPrimaryAction: WorkerPrimaryAction;
    /** Quick action grid. */
    workerQuickActions: WorkerQuickAction[];
    /** Number of completed shifts today. */
    completedShifts: number;
    /** Number of pending shifts today. */
    pendingShifts: number;
    /** Offline queue count for the aside. */
    queueCount: number;
    /** Sync handler when there's a queue. */
    onSync: () => void;
    /** Whether sync is in progress. */
    syncing: boolean;
    /** Top alerts for the aside. */
    alerts: AlertItem[];
    /** Today's shift status cards. */
    todayShiftCards: TodayShiftCard[];
    /** Locale for date formatting. */
    locale: string;
    /** Mark-alert-read handler. */
    onMarkAlertRead: (alertId: number) => void;
};

export function OperatorDashboardWorkspace({
    factoryName,
    online,
    status,
    error,
    sessionError,
    workerStatus,
    workerPrimaryAction,
    workerQuickActions,
    completedShifts,
    pendingShifts,
    queueCount,
    onSync,
    syncing,
    alerts,
    todayShiftCards,
    locale,
    onMarkAlertRead,
}: OperatorDashboardWorkspaceProps) {
    return (
        <main className="min-h-screen bg-[var(--surface-industrial-deep)] px-4 py-6 md:px-6 lg:py-8">
            <div className="mx-auto max-w-6xl space-y-8">
                {status ? (
                    <div className="rounded-[20px] border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-4 py-3 text-sm text-[var(--status-success-fg)]">
                        {status}
                    </div>
                ) : null}
                {error || sessionError ? (
                    <div className="rounded-[20px] border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-4 py-3 text-sm text-[var(--status-danger-fg)]">
                        {error || sessionError}
                    </div>
                ) : null}

                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
                    <section className="rounded-[32px] border border-[var(--border)] bg-[var(--surface-panel)] p-6 shadow-[0_24px_80px_rgba(6,10,18,0.48)]">
                        <div className="flex items-center justify-between gap-3">
                            <div className="text-base font-semibold text-[var(--text-primary)]">{factoryName}</div>
                            <span
                                className={`rounded-full border px-3 py-1 text-xs ${online
                                        ? "border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-fg)]"
                                        : "border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-fg)]"
                                    }`}
                            >
                                {online ? "Online" : "Offline"}
                            </span>
                        </div>

                        <div className="mt-8">
                            <div className="text-xl font-semibold md:text-2xl">Ready for shift</div>
                            <div
                                className={`mt-5 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold ${workerStatus.tone}`}
                            >
                                <span className="h-2.5 w-2.5 rounded-full bg-current opacity-80" />
                                Status: {workerStatus.label}
                            </div>
                            <div className="mt-5 text-2xl font-semibold md:text-3xl">{workerStatus.title}</div>
                            <div className="mt-2 text-sm text-[var(--text-secondary)]">{workerStatus.detail}</div>
                        </div>

                        <div className="mt-8">
                            <div className="text-xs font-medium text-[var(--text-tertiary)]">Main action</div>
                            <Link
                                href={workerPrimaryAction.href}
                                className="mt-3 inline-flex h-20 w-full items-center justify-center rounded-[28px] border border-transparent bg-[var(--action-primary)] px-6 text-xl font-semibold text-[var(--action-primary-text)] transition hover:bg-[var(--action-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-industrial-deep)]"
                            >
                                {workerPrimaryAction.label}
                            </Link>
                            <div className="mt-3 text-sm text-[var(--text-secondary)]">{workerPrimaryAction.detail}</div>
                        </div>

                        <div className="mt-8">
                            <div className="text-xs font-medium text-[var(--text-tertiary)]">Quick actions</div>
                            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                                {workerQuickActions.map((action) => (
                                    <Link
                                        key={action.key}
                                        href={action.href}
                                        className={`${action.key === "tasks" ? "col-span-2 sm:col-span-1" : ""
                                            } rounded-[24px] border border-[var(--border)] bg-[var(--surface-industrial-raised)] px-4 py-4 text-center transition hover:border-[var(--action-primary)] hover:bg-[var(--surface-overlay)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--action-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-industrial-deep)]`}
                                    >
                                        <div className="text-base font-semibold text-[var(--text-inverse)]">{action.label}</div>
                                        <div className="mt-1 text-xs text-[var(--text-tertiary)]">{action.meta}</div>
                                    </Link>
                                ))}
                            </div>
                        </div>

                        <div className="mt-8 rounded-[24px] border border-[var(--border)] bg-[var(--surface-industrial-raised)] px-4 py-4">
                            <div className="text-xs font-medium text-[var(--text-tertiary)]">Today&apos;s summary</div>
                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                <div className="rounded-[20px] border border-[var(--border)] bg-[var(--surface-industrial-raised)] px-4 py-3">
                                    <div className="text-xs text-[var(--text-tertiary)]">Completed</div>
                                    <div className="mt-2 text-2xl font-semibold tabular-nums text-[var(--text-inverse)]">
                                        {completedShifts}
                                    </div>
                                </div>
                                <div className="rounded-[20px] border border-[var(--border)] bg-[var(--surface-industrial-raised)] px-4 py-3">
                                    <div className="text-xs text-[var(--text-tertiary)]">Pending</div>
                                    <div className="mt-2 text-2xl font-semibold tabular-nums text-[var(--text-inverse)]">
                                        {pendingShifts}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <aside className="space-y-6">
                        <div className="rounded-[28px] border border-[var(--border)] bg-[var(--surface-panel)] p-5 shadow-[var(--shadow-md)]">
                            <div className="text-xs font-medium text-[var(--text-tertiary)]">Today&apos;s summary</div>
                            <div className="mt-4 space-y-6 text-sm text-[var(--text-secondary)]">
                                <div className="flex items-center justify-between">
                                    <span>Completed</span>
                                    <span className="font-semibold tabular-nums text-[var(--text-inverse)]">{completedShifts}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span>Pending</span>
                                    <span className="font-semibold tabular-nums text-[var(--text-inverse)]">{pendingShifts}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span>Offline</span>
                                    <span className="font-semibold tabular-nums text-[var(--text-inverse)]">{queueCount}</span>
                                </div>
                            </div>
                            {queueCount > 0 ? (
                                <Button variant="outline" className="mt-4 h-11 w-full" onClick={onSync} disabled={syncing}>
                                    {syncing ? "Syncing..." : "Sync saved"}
                                </Button>
                            ) : null}
                        </div>

                        <div className="rounded-[28px] border border-[var(--border)] bg-[var(--surface-industrial-raised)] p-5">
                            <div className="text-xs font-medium text-[var(--text-tertiary)]">Alerts</div>
                            {alerts.length ? (
                                <div className="mt-4 space-y-6">
                                    {alerts.slice(0, 2).map((alert) => (
                                        <div
                                            key={alert.id}
                                            className={`rounded-[20px] border px-4 py-3 ${severityTone(alert.severity)}`}
                                        >
                                            <div className="text-sm font-medium">{alert.message}</div>
                                            <div className="mt-2 text-xs opacity-70">{formatDateTime(alert.created_at, locale)}</div>
                                            <button
                                                type="button"
                                                className="mt-3 rounded-control text-xs font-semibold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                                                onClick={() => onMarkAlertRead(alert.id)}
                                            >
                                                Mark done
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="mt-4 rounded-[20px] border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-4 py-3 text-sm text-[var(--status-success-fg)]">
                                    No alerts right now.
                                </div>
                            )}
                        </div>

                        <div className="rounded-[28px] border border-[var(--border)] bg-[var(--surface-industrial-raised)] p-5">
                            <div className="text-xs font-medium text-[var(--text-tertiary)]">Shift status</div>
                            <div className="mt-4 space-y-6">
                                {todayShiftCards.map(({ shift, entry }) => (
                                    <div
                                        key={shift}
                                        className={`flex items-center justify-between rounded-[20px] border px-4 py-3 ${entry
                                                ? "border-[var(--status-success-border)] bg-[var(--status-success-bg)]"
                                                : "border-[var(--border)] bg-[var(--surface-industrial-raised)]"
                                            }`}
                                    >
                                        <span className="text-sm font-medium text-[var(--text-inverse)]">{formatShift(shift)}</span>
                                        <span
                                            className={`text-xs font-semibold ${entry ? "text-[var(--status-success-fg)]" : "text-[var(--text-tertiary)]"
                                                }`}
                                        >
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
