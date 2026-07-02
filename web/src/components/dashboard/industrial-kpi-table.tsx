"use client";

import type { KpiTableRow } from "@/lib/industrial-dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveScrollArea } from "@/components/ui/responsive-scroll-area";

function statusTone(status: KpiTableRow["status"], changePercent: number) {
  if (status === "up") return changePercent >= 0 ? "text-emerald-300 bg-[rgba(34,197,94,0.12)]" : "text-amber-300 bg-[rgba(245,158,11,0.12)]";
  if (status === "down") return changePercent < 0 ? "text-red-300 bg-[rgba(239,68,68,0.12)]" : "text-amber-300 bg-[rgba(245,158,11,0.12)]";
  return "text-[var(--muted)] bg-[var(--card-strong)]";
}

export function IndustrialKpiTable({
  rows,
}: {
  rows: KpiTableRow[];
}) {
  return (
    <Card>
      <CardHeader>
        <div className="text-xs uppercase tracking-header text-[var(--muted)]">Monthly KPI Review</div>
        <CardTitle className="mt-2 text-xl">Compact KPI table</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3 md:hidden">
          {rows.map((row) => (
            <div key={row.metric} className="rounded-lg border border-[var(--border)] bg-[var(--card-strong)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="font-semibold text-[var(--text)]">{row.metric}</div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(row.status, row.changePercent)}`}>
                  {row.status === "up" ? "Healthy" : row.status === "down" ? "Watch" : "Stable"}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs uppercase tracking-label text-[var(--muted)]">Current</div>
                  <div className="mt-1 text-[var(--text)]">{row.current}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-label text-[var(--muted)]">Previous</div>
                  <div className="mt-1 text-[var(--muted)]">{row.previous}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-xs uppercase tracking-label text-[var(--muted)]">Change</div>
                  <div className="mt-1 text-[var(--text)]">
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
          <thead className="text-slate-500">
            <tr className="border-b border-slate-200">
              <th className="px-3 py-3 font-medium">Metric</th>
              <th className="px-3 py-3 font-medium">Current</th>
              <th className="px-3 py-3 font-medium">Previous</th>
              <th className="px-3 py-3 font-medium">Change</th>
              <th className="px-3 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.metric} className="border-b border-slate-100">
                <td className="px-3 py-3 font-semibold text-slate-800">{row.metric}</td>
                <td className="px-3 py-3 text-slate-700">{row.current}</td>
                <td className="px-3 py-3 text-slate-500">{row.previous}</td>
                <td className="px-3 py-3 text-slate-700">
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
