import * as React from "react";

import { Badge, type BadgeStatus } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type WorkflowPanelStepStatus = "complete" | "current" | "upcoming" | "blocked";

type WorkflowPanelStep = {
  id: string;
  label: string;
  description?: string;
  status: WorkflowPanelStepStatus;
};

type WorkflowPanelNote = {
  id: string;
  label: string;
  status?: BadgeStatus;
  detail?: string;
};

type WorkflowPanelAction = {
  id: string;
  label: string;
  onAction?: () => void;
  variant?: React.ComponentProps<typeof Button>["variant"];
  disabled?: boolean;
  isBusy?: boolean;
  shortcutHint?: string;
};

export type WorkflowPanelProps = {
  title: string;
  description?: string;
  stepLabel?: string;
  status?: BadgeStatus;
  statusLabel?: string;
  steps?: WorkflowPanelStep[];
  notes?: WorkflowPanelNote[];
  primaryAction?: WorkflowPanelAction;
  secondaryAction?: WorkflowPanelAction;
  tertiaryAction?: WorkflowPanelAction;
  sidebar?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  sidebarClassName?: string;
};

const stepStatusClassNames: Record<WorkflowPanelStepStatus, string> = {
  complete: "border-status-synced-border bg-status-synced-bg text-status-synced-fg",
  current: "border-workflow-active bg-workflow-active-bg text-workflow-active",
  upcoming: "border-border-default bg-surface-shell text-text-secondary",
  blocked: "border-status-danger-border bg-status-danger-bg text-status-danger-fg",
};

function WorkflowPanelStepRail({ steps = [] }: { steps?: WorkflowPanelStep[] }) {
  if (steps.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Workflow steps" className="grid gap-sm md:grid-cols-2 xl:grid-cols-1">
      {steps.map((step, index) => (
        <div
          key={step.id}
          className={cn(
            "rounded-panel border px-md py-sm",
            stepStatusClassNames[step.status],
          )}
          aria-current={step.status === "current" ? "step" : undefined}
        >
          <div className="flex items-center justify-between gap-sm">
            <span className="text-label-dense font-semibold uppercase tracking-wide">
              Step {index + 1}
            </span>
            <span className="text-label-dense font-medium">{step.label}</span>
          </div>
          {step.description ? (
            <p className="mt-xs text-label-dense text-inherit/90">{step.description}</p>
          ) : null}
        </div>
      ))}
    </nav>
  );
}

function WorkflowPanelNotes({ notes = [] }: { notes?: WorkflowPanelNote[] }) {
  if (notes.length === 0) {
    return null;
  }

  return (
    <div className="space-y-sm">
      {notes.map((note) => (
        <div
          key={note.id}
          className="rounded-panel border border-border-subtle bg-surface-shell px-md py-sm"
        >
          <div className="flex items-center gap-sm">
            <Badge status={note.status ?? "draft"}>{note.label}</Badge>
          </div>
          {note.detail ? (
            <p className="mt-xs text-label-dense text-text-secondary">{note.detail}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function WorkflowPanelActions({
  primaryAction,
  secondaryAction,
  tertiaryAction,
}: Pick<
  WorkflowPanelProps,
  "primaryAction" | "secondaryAction" | "tertiaryAction"
>) {
  if (!primaryAction && !secondaryAction && !tertiaryAction) {
    return null;
  }

  const actions = [primaryAction, secondaryAction, tertiaryAction].filter(Boolean) as WorkflowPanelAction[];

  return (
    <div className="flex flex-wrap items-center justify-start gap-sm xl:justify-end">
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

export function WorkflowPanel({
  children,
  className,
  contentClassName,
  description,
  footer,
  notes,
  primaryAction,
  secondaryAction,
  sidebar,
  sidebarClassName,
  status = "draft",
  statusLabel = "In progress",
  stepLabel = "Workflow",
  steps,
  tertiaryAction,
  title,
}: WorkflowPanelProps) {
  return (
    <section className={cn("grid gap-density-gap xl:grid-cols-[minmax(0,1fr)_20rem]", className)}>
      <Card className="border-border-default bg-surface-panel">
        <CardHeader className="border-b border-border-subtle pb-md">
          <div className="flex flex-col gap-md xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 space-y-sm">
              <div className="flex flex-wrap items-center gap-sm">
                <span className="ui-no-select ui-no-callout text-label-dense font-semibold uppercase tracking-wide text-text-secondary">
                  {stepLabel}
                </span>
                <Badge status={status}>{statusLabel}</Badge>
              </div>
              <div className="space-y-xs">
                <CardTitle>{title}</CardTitle>
                {description ? (
                  <p className="max-w-3xl text-body text-text-secondary">{description}</p>
                ) : null}
              </div>
            </div>
            <WorkflowPanelActions
              primaryAction={primaryAction}
              secondaryAction={secondaryAction}
              tertiaryAction={tertiaryAction}
            />
          </div>
        </CardHeader>
        <CardContent className={cn("space-y-md pt-md", contentClassName)}>
          {children}
          {footer ? <div className="border-t border-border-subtle pt-md">{footer}</div> : null}
        </CardContent>
      </Card>
      <aside className={cn("space-y-md xl:sticky xl:top-lg xl:self-start", sidebarClassName)}>
        <WorkflowPanelStepRail steps={steps} />
        <WorkflowPanelNotes notes={notes} />
        {sidebar}
      </aside>
    </section>
  );
}
