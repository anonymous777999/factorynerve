import * as React from "react";

import { StatusBadge, type StatusBadgeTone } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

export type MetricStripItem = {
  id: string;
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  tone?: StatusBadgeTone;
  badgeLabel?: string;
};

export type MetricStripProps = {
  items: MetricStripItem[];
  className?: string;
  compact?: boolean;
};

export function MetricStrip({ className, compact = false, items }: MetricStripProps) {
  return (
    <div className={cn("grid gap-md md:grid-cols-2 xl:grid-cols-4", className)}>
      {items.map((item) => (
        <section
          key={item.id}
          className={cn(
            "rounded-overlay border border-border-subtle bg-surface-card px-lg shadow-[var(--shadow-xs)]",
            compact ? "space-y-xs py-md" : "space-y-sm py-lg",
          )}
        >
          <div className="flex items-start justify-between gap-sm">
            <p className="text-label-dense font-semibold uppercase tracking-wide text-text-secondary">
              {item.label}
            </p>
            {item.badgeLabel ? (
              <StatusBadge tone={item.tone} size="compact">
                {item.badgeLabel}
              </StatusBadge>
            ) : null}
          </div>
          <p className="font-mono text-[var(--type-numeric-md)] text-text-primary">{item.value}</p>
          {item.detail ? <p className="text-label-dense text-text-secondary">{item.detail}</p> : null}
        </section>
      ))}
    </div>
  );
}
