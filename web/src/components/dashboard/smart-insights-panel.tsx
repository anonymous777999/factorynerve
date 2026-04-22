"use client";

import Link from "next/link";

import type { SmartInsight } from "@/lib/industrial-dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

function toneClasses(tone: SmartInsight["tone"]) {
  if (tone === "good") return "border-[#bbf7d0] bg-[#f4fbf7]";
  if (tone === "warning") return "border-[#fed7aa] bg-[#fff7ed]";
  return "border-[#d6d3d1] bg-[#f5f5f4]";
}

function severityLabel(severity: SmartInsight["severity"]) {
  if (severity === "critical") return "Critical";
  if (severity === "watch") return "Watch";
  if (severity === "good") return "Good";
  return "Stable";
}

export function SmartInsightsPanel({
  insights,
  loading = false,
}: {
  insights: SmartInsight[];
  loading?: boolean;
}) {
  return (
    <Card className="rounded-[1.9rem] border border-[#e7e5e4] bg-white text-[#111111] shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
      <CardHeader>
        <div className="text-xs uppercase tracking-[0.24em] text-[#78716c]">Ranked Insights</div>
        <CardTitle className="mt-2 text-xl text-[#111111] md:text-2xl">Industrial decision prompts</CardTitle>
        <p className="mt-2 text-sm leading-6 text-[#57534e]">
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
            {insights.slice(0, 4).map((insight) => (
              <div
                key={insight.id}
                className={`rounded-[1.5rem] border p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${toneClasses(insight.tone)}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="text-xs uppercase tracking-[0.18em] text-[#78716c]">Impact {insight.impactScore}</div>
                  <div className="rounded-full border border-[#d6d3d1] bg-white/90 px-3 py-1 text-[11px] font-semibold text-[#111111]">
                    {severityLabel(insight.severity)}
                  </div>
                </div>
                <div className="mt-3 text-sm font-semibold text-[#111111]">{insight.headline}</div>
                <div className="mt-2 text-xs leading-6 text-[#57534e]">{insight.supportingText}</div>
                <div className="mt-3 text-xs font-medium leading-6 text-[#111111]">Next: {insight.nextStep}</div>
                {insight.primaryAction ? (
                  <div className="mt-4">
                    <Link href={insight.primaryAction.href}>
                      <Button variant="outline" className="border-[#111111] bg-[#111111] text-white hover:border-[#2f2f2f] hover:bg-[#2f2f2f]">
                        {insight.primaryAction.label}
                      </Button>
                    </Link>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
