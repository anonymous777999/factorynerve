import * as React from "react";

import { Button } from "@/components/ui/button";
import { StatusBadge, type StatusBadgeTone } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

type SectionPanelAction = {
  id: string;
  label: string;
  onAction?: () => void;
  variant?: React.ComponentProps<typeof Button>["variant"];
  disabled?: boolean;
  isBusy?: boolean;
};

export type SectionPanelProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  tone?: StatusBadgeTone;
  toneLabel?: string;
  actions?: SectionPanelAction[];
  meta?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
};

export function SectionPanel({
  actions = [],
  bodyClassName,
  children,
  className,
  description,
  eyebrow,
  footer,
  meta,
  title,
  tone = "default",
  toneLabel,
}: SectionPanelProps) {
  return (
    <section className={cn("rounded-panel border border-border-default bg-surface-panel", className)}>
      <header className="border-b border-border-subtle px-md py-md">
        <div className="flex flex-col gap-md lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-sm">
            <div className="flex flex-wrap items-center gap-sm">
              {eyebrow ? (
                <p className="text-label-dense font-semibold uppercase tracking-wide text-text-secondary">
                  {eyebrow}
                </p>
              ) : null}
              {toneLabel ? <StatusBadge tone={tone}>{toneLabel}</StatusBadge> : null}
            </div>
            <div className="space-y-xs">
              <h2 className="text-panel-title font-semibold text-text-primary">{title}</h2>
              {description ? <p className="text-body text-text-secondary">{description}</p> : null}
            </div>
            {meta ? <div className="text-label-dense text-text-secondary">{meta}</div> : null}
          </div>
          {actions.length ? (
            <div className="flex flex-wrap items-center gap-sm">
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
                  {action.label}
                </Button>
              ))}
            </div>
          ) : null}
        </div>
      </header>
      <div className={cn("px-md py-md", bodyClassName)}>{children}</div>
      {footer ? <footer className="border-t border-border-subtle px-md py-sm">{footer}</footer> : null}
    </section>
  );
}
