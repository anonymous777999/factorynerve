"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

function trendTone(trend?: number) {
  if (trend == null) return "border-[var(--border)] bg-[var(--card-strong)] text-[var(--muted)]";
  if (trend > 0) return "border-emerald-400/30 bg-[rgba(34,197,94,0.12)] text-emerald-100";
  if (trend < 0) return "border-amber-400/30 bg-[rgba(245,158,11,0.12)] text-amber-100";
  return "border-[var(--border)] bg-[var(--card-strong)] text-[var(--muted)]";
}

function severityClasses(severity?: "good" | "watch" | "critical" | "stable") {
  if (severity === "critical") return "border-red-400/30 shadow-[0_20px_44px_rgba(239,68,68,0.12)]";
  if (severity === "watch") return "border-amber-400/30 shadow-[0_18px_38px_rgba(245,158,11,0.08)]";
  if (severity === "good") return "border-emerald-400/30 shadow-[0_18px_38px_rgba(34,197,94,0.08)]";
  return "border-[var(--border)] shadow-[var(--shadow-md)]";
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
    <Card className={`rounded-card ${severityClasses(severity)}`}>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="text-xs uppercase tracking-header text-[var(--muted)]">{label}</div>
          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${trendTone(trend)}`}>
            <span className="font-bold">{trendArrow(trend)}</span>
            {trendCopy(trend)}
          </span>
        </div>
        <div className="text-3xl font-semibold tracking-tight text-[var(--text)] md:text-4xl">{value}</div>
        <div className="space-y-2">
          <div className="text-sm font-medium text-[var(--text)]">
            {trend != null ? `${trend > 0 ? "+" : ""}${trend.toFixed(1)}%` : "0.0%"} {comparisonLabel || ""}
          </div>
          <div className="text-sm text-[var(--muted)]">
            {trendLabel ? `${trendLabel}${comparisonLabel ? " " : ""}` : ""}
          </div>
          {helperText ? <div className="text-xs leading-6 text-[var(--muted)]">{helperText}</div> : null}
        </div>
        {action ? (
          <Link href={action.href}>
            <Button variant="outline">
              {action.label}
            </Button>
          </Link>
        ) : null}
      </CardContent>
    </Card>
  );
}
