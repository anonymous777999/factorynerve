"use client";

import { Card, CardContent } from "@/components/ui/card";

function trendTone(trend?: number) {
  if (trend == null) return "text-slate-500";
  if (trend > 0) return "text-emerald-600";
  if (trend < 0) return "text-amber-600";
  return "text-slate-500";
}

export function KPIBox({
  label,
  value,
  trend,
  trendLabel,
}: {
  label: string;
  value: string;
  trend?: number;
  trendLabel?: string;
}) {
  return (
    <Card className="rounded-[1.8rem] border border-[#dce5ef] bg-white text-slate-900 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
      <CardContent className="space-y-3 p-5">
        <div className="text-xs uppercase tracking-[0.22em] text-slate-500">{label}</div>
        <div className="text-2xl font-semibold text-slate-900 md:text-3xl">{value}</div>
        <div className={`text-sm ${trendTone(trend)}`}>
          {trend != null ? `${trend > 0 ? "+" : ""}${trend.toFixed(1)}%` : "No change"} {trendLabel || ""}
        </div>
      </CardContent>
    </Card>
  );
}
