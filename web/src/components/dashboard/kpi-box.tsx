"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

function trendTone(trend?: number) {
  if (trend == null) return "border-transparent bg-surface-elevated text-text-secondary";
  if (trend > 0) return "border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-fg)]";
  if (trend < 0) return "border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-fg)]";
  return "border-transparent bg-surface-elevated text-text-secondary";
}

function severityClasses(severity?: "good" | "watch" | "critical" | "stable") {
  if (severity === "critical") return "border-status-danger-border shadow-[var(--shadow-sm)]";
  if (severity === "watch") return "border-status-warning-border shadow-[var(--shadow-xs)]";
  if (severity === "good") return "border-status-success-border shadow-[var(--shadow-xs)]";
  return "border-border-subtle shadow-[var(--shadow-xs)]";
}

function trendArrow(trend?: number) {
  if (trend == null) return "->";
  if (trend > 0) return "\u2191";
  if (trend < 0) return "\u2193";
  return "\u2192";
}

function trendCopy(trend?: number) {
  if (trend == null) return "Stable";
  if (trend > 0) return "Rising";
  if (trend < 0) return "Falling";
  return "Stable";
}

export function KPIBox({
  label,
  value,
  trend,
  trendLabel,
  severity,
  comparisonLabel,
  helperText,
  action,
}: {
  label: string;
  value: string;
  trend?: number;
  trendLabel?: string;
  severity?: "good" | "watch" | "critical" | "stable";
  comparisonLabel?: string;
  helperText?: string;
  action?: {
    href: string;
    label: string;
  };
}) {
  return (
    <Card className={`rounded-[1.8rem] bg-surface-card text-text-primary ${severityClasses(severity)}`}>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="text-xs uppercase tracking-[0.22em] text-text-tertiary">{label}</div>
          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${trendTone(trend)}`}>
            <span className="font-bold">{trendArrow(trend)}</span>
            {trendCopy(trend)}
          </span>
        </div>
        <div className="text-3xl font-semibold tracking-[-0.03em] text-text-primary md:text-4xl">{value}</div>
        <div className="space-y-2">
          <div className="text-sm font-medium text-text-primary">
            {trend != null ? `${trend > 0 ? "+" : ""}${trend.toFixed(1)}%` : "0.0%"} {comparisonLabel || ""}
          </div>
          <div className="text-sm text-text-secondary">
            {trendLabel ? `${trendLabel}${comparisonLabel ? " " : ""}` : ""}
          </div>
          {helperText ? <div className="text-xs leading-6 text-text-tertiary">{helperText}</div> : null}
        </div>
        {action ? (
          <Link href={action.href}>
            <Button variant="secondary">
              {action.label}
            </Button>
          </Link>
        ) : null}
      </CardContent>
    </Card>
  );
}
