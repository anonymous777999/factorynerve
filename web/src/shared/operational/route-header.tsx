import * as React from "react";

import { Button } from "@/components/ui/button";
import type { MetricStripItem } from "@/components/ui/metric-strip";
import { MetricStrip } from "@/components/ui/metric-strip";
import { StatusBadge, type StatusBadgeTone } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

export type RouteHeaderAction = {
  id: string;
  label: string;
  onAction?: () => void;
  variant?: React.ComponentProps<typeof Button>["variant"];
};

export type RouteHeaderMetaItem = {
  id: string;
  label: string;
  value: React.ReactNode;
};

export type RouteHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  tone?: StatusBadgeTone;
  toneLabel?: string;
  liveIndicator?: boolean;
  liveLabel?: string;
  meta?: RouteHeaderMetaItem[];
  actions?: RouteHeaderAction[];
  metrics?: MetricStripItem[];
  filters?: React.ReactNode;
  className?: string;
};

export function RouteHeader({
  actions = [],
  className,
  description,
  eyebrow,
  filters,
  liveIndicator = false,
  liveLabel = "Live",
  meta = [],
  metrics = [],
  title,
  tone = "default",
  toneLabel,
}: RouteHeaderProps) {
  return (
    <section className={cn("route-header rounded-panel", className)}>
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
            {toneLabel ? <StatusBadge tone={tone}>{toneLabel}</StatusBadge> : null}
          </div>
          <h1 className="route-header__title">{title}</h1>
          {description ? <p className="route-header__body">{description}</p> : null}
          {meta.length ? (
            <div className="route-header__meta">
              {meta.map((item) => (
                <div key={item.id} className="route-header__meta-item">
                  {item.label} <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          ) : null}
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
  );
}
