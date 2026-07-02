"use client";

import Link from "next/link";

import type { SmartInsight } from "@/lib/industrial-dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

function toneClasses(tone: SmartInsight["tone"]) {
  if (tone === "good") return "border-emerald-400/30 bg-[rgba(34,197,94,0.12)]";
  if (tone === "warning") return "border-amber-400/30 bg-[rgba(245,158,11,0.12)]";
  return "border-[var(--border)] bg-[var(--card-strong)]";
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
    <Card>
      <CardHeader>
        <div className="text-xs uppercase tracking-header text-[var(--muted)]">Ranked Insights</div>
        <CardTitle className="mt-2 text-xl md:text-2xl">Industrial decision prompts</CardTitle>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
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
                  <div className="text-xs uppercase tracking-caption text-[var(--muted)]">Impact {insight.impactScore}</div>
                  <div className="rounded-full border border-[var(--border)] bg-[var(--card-strong)] px-3 py-1 text-[11px] font-semibold text-[var(--text)]">
                    {severityLabel(insight.severity)}
                  </div>
                </div>
                <div className="mt-3 text-sm font-semibold text-[var(--text)]">{insight.headline}</div>
                <div className="mt-2 text-xs leading-6 text-[var(--muted)]">{insight.supportingText}</div>
                <div className="mt-3 text-xs font-medium leading-6 text-[var(--text)]">Next: {insight.nextStep}</div>
                {insight.primaryAction ? (
                  <div className="mt-4">
                    <Link href={insight.primaryAction.href}>
                      <Button variant="outline">
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
