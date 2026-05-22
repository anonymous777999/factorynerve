import * as React from "react";

import { Badge, type BadgeStatus } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type RecoveryBannerKind = "sync-failure" | "offline" | "unsaved-draft" | "reconnecting";

type RecoveryBannerAction = {
  id: string;
  label: string;
  onAction?: () => void;
  variant?: React.ComponentProps<typeof Button>["variant"];
  disabled?: boolean;
  isBusy?: boolean;
  shortcutHint?: string;
};

export type RecoveryBannerProps = {
  kind?: RecoveryBannerKind;
  title: string;
  description?: string;
  statusLabel?: string;
  meta?: React.ReactNode;
  primaryAction?: RecoveryBannerAction;
  secondaryAction?: RecoveryBannerAction;
  tertiaryAction?: RecoveryBannerAction;
  className?: string;
  contentClassName?: string;
};

const kindStatusMap: Record<RecoveryBannerKind, BadgeStatus> = {
  "sync-failure": "error",
  offline: "paused",
  "unsaved-draft": "draft",
  reconnecting: "processing",
};

const kindLabelMap: Record<RecoveryBannerKind, string> = {
  "sync-failure": "Sync issue",
  offline: "Offline mode",
  "unsaved-draft": "Draft recovery",
  reconnecting: "Reconnecting",
};

const kindContainerClassNames: Record<RecoveryBannerKind, string> = {
  "sync-failure":
    "border-status-danger-border bg-surface-panel text-text-primary",
  offline: "border-status-paused-border bg-surface-panel text-text-primary",
  "unsaved-draft": "border-status-draft-border bg-surface-panel text-text-primary",
  reconnecting:
    "border-status-processing-border bg-surface-panel text-text-primary",
};

function RecoveryBannerActions({
  primaryAction,
  secondaryAction,
  tertiaryAction,
}: Pick<
  RecoveryBannerProps,
  "primaryAction" | "secondaryAction" | "tertiaryAction"
>) {
  const actions = [primaryAction, secondaryAction, tertiaryAction].filter(Boolean) as RecoveryBannerAction[];

  if (actions.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center justify-start gap-sm lg:justify-end">
      {actions.map((action, index) => (
        <Button
          key={action.id}
          size="compact"
          variant={action.variant ?? (index === 0 ? "primary" : "outline")}
          disabled={action.disabled}
          isBusy={action.isBusy}
          busyLabel={action.label}
          onClick={action.onAction}
        >
          {action.shortcutHint ? `${action.label} (${action.shortcutHint})` : action.label}
        </Button>
      ))}
    </div>
  );
}

export function RecoveryBanner({
  className,
  contentClassName,
  description,
  kind = "sync-failure",
  meta,
  primaryAction,
  secondaryAction,
  statusLabel,
  tertiaryAction,
  title,
}: RecoveryBannerProps) {
  const status = kindStatusMap[kind];
  const resolvedStatusLabel = statusLabel ?? kindLabelMap[kind];
  const isUrgent = kind === "sync-failure" || kind === "offline";

  return (
    <section
      className={cn(
        "rounded-panel border shadow-xs",
        kindContainerClassNames[kind],
        className,
      )}
      role={isUrgent ? "alert" : "status"}
      aria-live={isUrgent ? "assertive" : "polite"}
      data-recovery-kind={kind}
    >
      <div
        className={cn(
          "flex flex-col gap-sm border-l-2 border-current px-md py-sm lg:flex-row lg:items-start lg:justify-between",
          contentClassName,
        )}
      >
        <div className="min-w-0 space-y-xs">
          <div className="flex flex-wrap items-center gap-sm">
            <Badge status={status}>{resolvedStatusLabel}</Badge>
            <span className="text-label font-semibold text-text-primary">{title}</span>
          </div>
          {description ? <p className="text-label-dense text-text-secondary">{description}</p> : null}
          {meta ? (
            <div className="rounded-control border border-border-subtle bg-surface-shell px-sm py-xs text-label-dense text-text-secondary">
              {meta}
            </div>
          ) : null}
        </div>
        <RecoveryBannerActions
          primaryAction={primaryAction}
          secondaryAction={secondaryAction}
          tertiaryAction={tertiaryAction}
        />
      </div>
    </section>
  );
}
