"use client";

import type { KpiTableRow } from "@/lib/industrial-dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveScrollArea } from "@/components/ui/responsive-scroll-area";

function statusTone(status: KpiTableRow["status"], changePercent: number) {
  if (status === "up") return changePercent >= 0 ? "text-status-success-fg bg-status-success-bg" : "text-status-warning-fg bg-status-warning-bg";
  if (status === "down") return changePercent < 0 ? "text-status-danger-fg bg-status-danger-bg" : "text-status-warning-fg bg-status-warning-bg";
  return "text-text-secondary bg-surface-elevated";
}

export function IndustrialKpiTable({
  rows,
}: {
  rows: KpiTableRow[];
}) {
  return (
    <Card className="rounded-[1.8rem] bg-surface-card text-text-primary shadow-[var(--shadow-xs)]">
      <CardHeader>
        <div className="text-xs uppercase tracking-[0.22em] text-text-tertiary">Monthly KPI Review</div>
        <CardTitle className="mt-2 text-xl text-text-primary">Compact KPI table</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3 md:hidden">
          {rows.map((row) => (
            <div key={row.metric} className="rounded-2xl border border-border-subtle bg-surface-elevated p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="font-semibold text-text-primary">{row.metric}</div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(row.status, row.changePercent)}`}>
                  {row.status === "up" ? "Healthy" : row.status === "down" ? "Watch" : "Stable"}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs uppercase tracking-[0.14em] text-text-tertiary">Current</div>
                  <div className="mt-1 text-text-primary">{row.current}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.14em] text-text-tertiary">Previous</div>
                  <div className="mt-1 text-text-secondary">{row.previous}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-xs uppercase tracking-[0.14em] text-text-tertiary">Change</div>
                  <div className="mt-1 text-text-primary">
                    {row.changePercent > 0 ? "+" : ""}
                    {row.changePercent.toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <ResponsiveScrollArea className="hidden md:block" debugLabel="industrial-kpi-table">
          <table className="min-w-full text-left text-sm">
          <thead className="text-text-tertiary">
            <tr className="border-b border-border-subtle">
              <th className="px-3 py-3 font-medium">Metric</th>
              <th className="px-3 py-3 font-medium">Current</th>
              <th className="px-3 py-3 font-medium">Previous</th>
              <th className="px-3 py-3 font-medium">Change</th>
              <th className="px-3 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.metric} className="border-b border-border-subtle">
                <td className="px-3 py-3 font-semibold text-text-primary">{row.metric}</td>
                <td className="px-3 py-3 text-text-primary">{row.current}</td>
                <td className="px-3 py-3 text-text-secondary">{row.previous}</td>
                <td className="px-3 py-3 text-text-primary">
                  {row.changePercent > 0 ? "+" : ""}
                  {row.changePercent.toFixed(1)}%
                </td>
                <td className="px-3 py-3">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(row.status, row.changePercent)}`}>
                    {row.status === "up" ? "Healthy" : row.status === "down" ? "Watch" : "Stable"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          </table>
        </ResponsiveScrollArea>
      </CardContent>
    </Card>
  );
}
