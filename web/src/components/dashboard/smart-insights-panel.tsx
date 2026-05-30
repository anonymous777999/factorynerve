"use client";

import Link from "next/link";

import type { SmartInsight } from "@/lib/industrial-dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  ConfidenceBadge,
  truncateReasoning,
} from "@/components/ui/confidence-badge";

// Sprint 2 Task 22: Neutral insights use the calm indigo AI-processing tokens
// (bg-ai-processing-bg / border-ai-processing-border / text-ai-processing-fg).
// Status-bearing tones keep their semantic surface so operators can read state at a glance.
function toneClasses(tone: SmartInsight["tone"]) {
  if (tone === "good") return "border-[var(--status-success-border)] bg-[var(--status-success-bg)]";
  if (tone === "warning") return "border-[var(--status-warning-border)] bg-[var(--status-warning-bg)]";
  return "border-ai-processing-border bg-ai-processing-bg";
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
    <Card className="rounded-[1.9rem] bg-surface-card text-text-primary shadow-[var(--shadow-xs)]">
      <CardHeader>
        <div className="text-xs uppercase tracking-[0.24em] text-text-tertiary">Ranked Insights</div>
        <CardTitle className="mt-2 text-xl text-text-primary md:text-2xl">Industrial decision prompts</CardTitle>
        <p className="mt-2 text-sm leading-6 text-text-secondary">
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
            {insights.slice(0, 4).map((insight) => {
              const isAiTone = insight.tone !== "good" && insight.tone !== "warning";
              const reasoning = insight.reasoning
                ? truncateReasoning(insight.reasoning)
                : null;
              return (
                <div
                  key={insight.id}
                  className={`flex flex-col space-y-3 rounded-[1.5rem] border p-4 ${toneClasses(insight.tone)}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {isAiTone ? (
                        <span
                          aria-hidden="true"
                          className="h-2 w-2 rounded-full bg-ai-processing-fg"
                        />
                      ) : null}
                      <div
                        className={`text-xs uppercase tracking-[0.18em] ${isAiTone ? "text-ai-processing-fg" : "text-text-tertiary"
                          }`}
                      >
                        Impact {insight.impactScore}
                      </div>
                    </div>
                    <div className="rounded-full bg-surface-card px-3 py-1 text-[11px] font-semibold text-text-primary">
                      {severityLabel(insight.severity)}
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-text-primary">{insight.headline}</div>
                  <div className="text-xs leading-6 text-text-secondary">{insight.supportingText}</div>
                  {insight.confidence ? (
                    <div className="flex flex-col gap-1.5">
                      <ConfidenceBadge level={insight.confidence} />
                      {reasoning ? (
                        <p className="text-xs leading-5 text-text-tertiary">{reasoning}</p>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="text-xs font-medium leading-6 text-text-primary">Next: {insight.nextStep}</div>
                  {insight.primaryAction ? (
                    <div>
                      <Link href={insight.primaryAction.href}>
                        <Button variant="secondary">
                          {insight.primaryAction.label}
                        </Button>
                      </Link>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
