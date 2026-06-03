import * as React from "react";

import { Button } from "@/components/ui/button";
import { LoadingBoundary } from "@/components/ui/loading-boundary";
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
  liveIndicator?: boolean;
  liveLabel?: string;
  metrics?: MetricStripItem[];
  filters?: React.ReactNode;
  actions?: WorkstationShellAction[];
  rail?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  isLoading?: boolean;
  loadingTitle?: string;
};

export function WorkstationShell({
  actions = [],
  children,
  className,
  description,
  eyebrow,
  filters,
  isLoading = false,
  liveIndicator = false,
  liveLabel = "Live",
  loadingTitle = "Loading",
  metrics = [],
  rail,
  title,
  tone = "default",
  toneLabel,
}: WorkstationShellProps) {
  const headerTone = liveIndicator ? "success" : tone;
  const headerToneLabel = liveIndicator ? liveLabel : toneLabel;

  return (
    <main className={cn("operational-page", className)}>
      <div className="operational-page__inner">
        <section className="route-header rounded-panel">
          <div className="route-header__grid">
            <div className="route-header__copy">
              <div className="flex flex-wrap items-center gap-sm">
                {eyebrow ? <p className="route-header__eyebrow">{eyebrow}</p> : null}
                {liveIndicator ? (
                  <span className="inline-flex items-center gap-xs text-label-dense text-status-success-fg">
                    <span className="live-pulse-dot h-2 w-2 rounded-full bg-status-success-icon" aria-hidden />
                    {liveLabel}
                  </span>
                ) : null}
                {headerToneLabel ? <StatusBadge tone={headerTone}>{headerToneLabel}</StatusBadge> : null}
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
          <div className="route-stack">
            {isLoading ? (
              <LoadingBoundary isLoading loadingTitle={loadingTitle} loadingRows={8}>
                <div />
              </LoadingBoundary>
            ) : (
              children
            )}
          </div>
          {rail ? <aside className="route-telemetry-rail">{rail}</aside> : null}
        </div>
      </div>
    </main>
  );
}
