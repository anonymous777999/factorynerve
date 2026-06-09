"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { SectionPanel } from "@/components/ui/section-panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { WorkstationShell } from "@/components/ui/workstation-shell";
import { cn } from "@/lib/utils";

import type { AlertItem } from "@/lib/dashboard";
import type { Entry } from "@/lib/entries";
import type { ShiftValue } from "@/features/entry/lib/entry-helpers";

import { formatDateTime, formatShift, severityTone } from "../lib/dashboard-helpers";

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
  factoryName: string;
  online: boolean;
  status?: string | null;
  error?: string | null;
  sessionError?: string | null;
  workerStatus: WorkerStatus;
  workerPrimaryAction: WorkerPrimaryAction;
  workerQuickActions: WorkerQuickAction[];
  completedShifts: number;
  pendingShifts: number;
  queueCount: number;
  onSync: () => void;
  syncing: boolean;
  alerts: AlertItem[];
  todayShiftCards: TodayShiftCard[];
  locale: string;
  onMarkAlertRead: (alertId: number) => void;
};

function statusBannerClass(tone: "success" | "danger") {
  return tone === "success"
    ? "border-status-success-border bg-status-success-bg text-status-success-fg"
    : "border-status-danger-border bg-status-danger-bg text-status-danger-fg";
}

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
  const rail = (
    <aside className="route-rail space-y-lg">
      <SectionPanel title="Today's summary" eyebrow="Shift pulse">
        <dl className="space-y-3 text-sm text-text-secondary">
          <div className="flex items-center justify-between gap-3">
            <dt>Completed</dt>
            <dd className="font-semibold tabular-nums text-text-primary">{completedShifts}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt>Pending</dt>
            <dd className="font-semibold tabular-nums text-text-primary">{pendingShifts}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt>Offline queue</dt>
            <dd className="font-semibold tabular-nums text-text-primary">{queueCount}</dd>
          </div>
        </dl>
        {queueCount > 0 ? (
          <Button variant="outline" className="mt-4 w-full" onClick={onSync} disabled={syncing}>
            {syncing ? "Syncing..." : "Sync saved"}
          </Button>
        ) : null}
      </SectionPanel>

      <SectionPanel title="Alerts" eyebrow="Signals">
        {alerts.length ? (
          <div className="space-y-3">
            {alerts.slice(0, 2).map((alert) => (
              <div key={alert.id} className={cn("rounded-panel border px-4 py-3", severityTone(alert.severity))}>
                <p className="text-sm font-medium">{alert.message}</p>
                <p className="mt-2 text-xs text-text-tertiary">{formatDateTime(alert.created_at, locale)}</p>
                <button
                  type="button"
                  className="mt-3 text-xs font-semibold text-action-primary underline underline-offset-4"
                  onClick={() => onMarkAlertRead(alert.id)}
                >
                  Mark done
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-panel border border-status-success-border bg-status-success-bg px-4 py-3 text-sm text-status-success-fg">
            No alerts right now.
          </p>
        )}
      </SectionPanel>

      <SectionPanel title="Shift status" eyebrow="Today">
        <ul className="space-y-3">
          {todayShiftCards.map(({ shift, entry }) => (
            <li
              key={shift}
              className={cn(
                "flex items-center justify-between rounded-panel border px-4 py-3",
                entry
                  ? "border-status-success-border bg-status-success-bg"
                  : "border-border-subtle bg-surface-shell",
              )}
            >
              <span className="text-sm font-medium text-text-primary">{formatShift(shift)}</span>
              <span className={cn("text-xs font-semibold", entry ? "text-status-success-fg" : "text-text-tertiary")}>
                {entry ? "Done" : "Pending"}
              </span>
            </li>
          ))}
        </ul>
      </SectionPanel>
    </aside>
  );

  return (
    <WorkstationShell
      className="factory-workstation-scope"
      eyebrow="Operations board"
      title="Ready for shift"
      description={workerPrimaryAction.detail}
      toneLabel={workerStatus.label}
      tone={online ? "success" : "warning"}
      metrics={[
        { id: "factory", label: "Factory", value: factoryName },
        { id: "completed", label: "Completed", value: String(completedShifts) },
        { id: "pending", label: "Pending", value: String(pendingShifts) },
        { id: "queue", label: "Queue", value: String(queueCount) },
      ]}
      rail={rail}
    >
      {status ? (
        <div className={cn("rounded-panel border px-4 py-3 text-sm", statusBannerClass("success"))} role="status">
          {status}
        </div>
      ) : null}
      {error || sessionError ? (
        <div className={cn("rounded-panel border px-4 py-3 text-sm", statusBannerClass("danger"))} role="alert">
          {error || sessionError}
        </div>
      ) : null}

      <SectionPanel
        title={workerStatus.title}
        eyebrow="Current shift"
        description={workerStatus.detail}
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={online ? "success" : "warning"}>{online ? "Online" : "Offline"}</StatusBadge>
            <span className={cn("inline-flex items-center gap-2 rounded-panel px-3 py-1 text-xs font-semibold", workerStatus.tone)}>
              <span className="h-2 w-2 rounded-full bg-current opacity-80" aria-hidden />
              {workerStatus.label}
            </span>
          </div>
        }
      >
        <div className="space-y-2">
          <p className="text-label-dense text-text-tertiary">Main action</p>
          <Link
            href={workerPrimaryAction.href}
            className="inline-flex h-14 w-full items-center justify-center rounded-control border border-transparent bg-action-primary px-6 text-lg font-semibold text-action-primary-text transition hover:bg-action-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2"
          >
            {workerPrimaryAction.label}
          </Link>
        </div>
      </SectionPanel>

      <SectionPanel title="Quick actions" eyebrow="Lanes">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {workerQuickActions.map((action) => (
            <Link
              key={action.key}
              href={action.href}
              className={cn(
                "rounded-panel border border-border-default bg-surface-card px-4 py-4 text-center shadow-xs transition hover:border-border-strong hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                action.key === "tasks" && "col-span-2 sm:col-span-1",
              )}
            >
              <div className="text-sm font-semibold text-text-primary">{action.label}</div>
              <div className="mt-1 text-label-dense text-text-tertiary">{action.meta}</div>
            </Link>
          ))}
        </div>
      </SectionPanel>

    </WorkstationShell>
  );
}
