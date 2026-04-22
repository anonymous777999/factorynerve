"use client";

import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function trendTone(trend?: number) {
  if (trend == null) return "border-[#d6d3d1] bg-[#f5f5f4] text-[#57534e]";
  if (trend > 0) return "border-[#bbf7d0] bg-[#f4fbf7] text-[#166534]";
  if (trend < 0) return "border-[#fed7aa] bg-[#fff7ed] text-[#9a3412]";
  return "border-[#d6d3d1] bg-[#f5f5f4] text-[#57534e]";
}

function severityClasses(severity?: "good" | "watch" | "critical" | "stable") {
  if (severity === "critical") return "border-[#fecaca] shadow-[0_20px_44px_rgba(185,28,28,0.12)]";
  if (severity === "watch") return "border-[#fed7aa] shadow-[0_18px_38px_rgba(217,119,6,0.08)]";
  if (severity === "good") return "border-[#bbf7d0] shadow-[0_18px_38px_rgba(15,118,110,0.08)]";
  return "border-[#e7e5e4] shadow-[0_18px_40px_rgba(15,23,42,0.08)]";
}

function trendArrow(trend?: number) {
  if (trend == null) return "->";
  if (trend > 0) return "↑";
  if (trend < 0) return "↓";
  return "→";
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
    <Card className={`rounded-[1.8rem] !border-[#e7e5e4] !bg-white !text-[#111111] ${severityClasses(severity)}`}>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="text-xs uppercase tracking-[0.22em] text-[#78716c]">{label}</div>
          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${trendTone(trend)}`}>
            <span className="font-bold">{trendArrow(trend)}</span>
            {trendCopy(trend)}
          </span>
        </div>
        <div className="text-3xl font-semibold tracking-[-0.03em] text-[#111111] md:text-4xl">{value}</div>
        <div className="space-y-2">
          <div className="text-sm font-medium text-[#111111]">
            {trend != null ? `${trend > 0 ? "+" : ""}${trend.toFixed(1)}%` : "0.0%"} {comparisonLabel || ""}
          </div>
          <div className="text-sm text-[#57534e]">
            {trendLabel ? `${trendLabel}${comparisonLabel ? " " : ""}` : ""}
          </div>
          {helperText ? <div className="text-xs leading-6 text-[#78716c]">{helperText}</div> : null}
        </div>
        {action ? (
          <Link href={action.href}>
            <Button variant="outline" className="!border-[#111111] !bg-[#111111] !text-white hover:!border-[#2f2f2f] hover:!bg-[#2f2f2f]">
              {action.label}
            </Button>
          </Link>
        ) : null}
      </CardContent>
    </Card>
  );
}
