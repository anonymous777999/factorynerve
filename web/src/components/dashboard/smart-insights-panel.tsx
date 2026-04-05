"use client";

import type { SmartInsight } from "@/lib/industrial-dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function toneClasses(tone: SmartInsight["tone"]) {
  if (tone === "good") return "border-emerald-500/30 bg-emerald-500/10";
  if (tone === "warning") return "border-amber-500/30 bg-amber-500/10";
  return "border-sky-500/20 bg-sky-500/10";
}

export function SmartInsightsPanel({
  insights,
  loading = false,
}: {
  insights: SmartInsight[];
  loading?: boolean;
}) {
  return (
    <Card className="rounded-[1.9rem] border border-[#dce5ef] bg-white text-slate-900 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
      <CardHeader>
        <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Smart Insights</div>
        <CardTitle className="mt-2 text-xl text-slate-900 md:text-2xl">Industrial decision prompts</CardTitle>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          These messages are generated from live dashboard data so a manager can see risk, stock pressure, and revenue movement without scanning every chart manually.
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="grid gap-4 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-28 w-full" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
            {insights.map((insight) => (
              <div
                key={insight.id}
                className={`rounded-[1.5rem] border p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${toneClasses(insight.tone)}`}
              >
                <div className="text-sm font-semibold text-slate-900">{insight.headline}</div>
                <div className="mt-2 text-xs leading-6 text-slate-600">{insight.supportingText}</div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
