"use client";

import type { KpiTableRow } from "@/lib/industrial-dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveScrollArea } from "@/components/ui/responsive-scroll-area";

function statusTone(status: KpiTableRow["status"], changePercent: number) {
  if (status === "up") return changePercent >= 0 ? "text-emerald-600 bg-emerald-50" : "text-amber-600 bg-amber-50";
  if (status === "down") return changePercent < 0 ? "text-red-600 bg-rose-50" : "text-amber-600 bg-amber-50";
  return "text-slate-500 bg-slate-100";
}

export function IndustrialKpiTable({
  rows,
}: {
  rows: KpiTableRow[];
}) {
  return (
    <Card className="rounded-[1.8rem] border border-[#dce5ef] bg-white text-slate-900 shadow-[0_14px_30px_rgba(15,23,42,0.06)]">
      <CardHeader>
        <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Monthly KPI Review</div>
        <CardTitle className="mt-2 text-xl text-slate-900">Compact KPI table</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3 md:hidden">
          {rows.map((row) => (
            <div key={row.metric} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="font-semibold text-slate-900">{row.metric}</div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(row.status, row.changePercent)}`}>
                  {row.status === "up" ? "Healthy" : row.status === "down" ? "Watch" : "Stable"}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Current</div>
                  <div className="mt-1 text-slate-800">{row.current}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Previous</div>
                  <div className="mt-1 text-slate-600">{row.previous}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Change</div>
                  <div className="mt-1 text-slate-800">
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
