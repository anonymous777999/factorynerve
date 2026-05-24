import * as React from "react";

import { Button } from "@/components/ui/button";
import type { MetricStripItem } from "@/components/ui/metric-strip";
import { MetricStrip } from "@/components/ui/metric-strip";
import { StatusBadge, type StatusBadgeTone } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

type WorkstationShellAction = {
  id: string;
  label: string;
  onAction?: () => void;
  variant?: React.ComponentProps<typeof Button>["variant"];
};

export type WorkstationShellProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  tone?: StatusBadgeTone;
  toneLabel?: string;
  metrics?: MetricStripItem[];
  filters?: React.ReactNode;
  actions?: WorkstationShellAction[];
  rail?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export function WorkstationShell({
  actions = [],
  children,
  className,
  description,
  eyebrow,
  filters,
  metrics = [],
  rail,
  title,
  tone = "default",
  toneLabel,
}: WorkstationShellProps) {
  return (
    <main className={cn("operational-page", className)}>
      <div className="operational-page__inner">
        <section className="route-header rounded-panel">
          <div className="route-header__grid">
            <div className="route-header__copy">
              <div className="flex flex-wrap items-center gap-sm">
                {eyebrow ? <p className="route-header__eyebrow">{eyebrow}</p> : null}
                {toneLabel ? <StatusBadge tone={tone}>{toneLabel}</StatusBadge> : null}
              </div>
              <h1 className="route-header__title">{title}</h1>
              {description ? <p className="route-header__body">{description}</p> : null}
            </div>
            {actions.length ? (
              <div className="route-header__actions">
                {actions.map((action, index) => (
                  <Button
                    key={action.id}
                    size="compact"
                    variant={action.variant ?? (index === 0 ? "primary" : "outline")}
                    onClick={action.onAction}
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            ) : null}
          </div>
          {metrics.length ? (
            <div className="mt-md">
              <MetricStrip items={metrics} compact />
            </div>
          ) : null}
          {filters ? <div className="mt-md">{filters}</div> : null}
        </section>

        <div className={cn("route-grid-main", rail ? "route-grid-main--sidebar" : "")}>
          <div className="route-stack">{children}</div>
          {rail ? <aside className="route-telemetry-rail">{rail}</aside> : null}
        </div>
      </div>
    </main>
  );
}
