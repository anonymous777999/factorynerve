"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveScrollArea } from "@/components/ui/responsive-scroll-area";
import {
  getSteelMachineAnalytics,
  type MachineAnalytics,
} from "@/lib/steel";

function formatMinutes(mins: number | null | undefined) {
  if (mins == null) return "—";
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return `${h}h ${m}m`;
  }
  return `${Math.round(mins)}m`;
}

function formatHours(hours: number | null | undefined) {
  if (hours == null) return "—";
  return `${hours.toFixed(1)}h`;
}

function barWidth(pct: number) {
  return `${Math.max(pct, 2)}%`;
}

const REASON_COLORS: Record<string, string> = {
  mechanical_failure: "bg-rose-500/70",
  electrical_failure: "bg-orange-500/70",
  planned_maintenance: "bg-sky-500/70",
  power_outage: "bg-amber-500/70",
  material_shortage: "bg-yellow-500/70",
  operator_error: "bg-violet-500/70",
  quality_check: "bg-teal-500/70",
  changeover: "bg-indigo-500/70",
  breakdown: "bg-red-500/70",
  unspecified: "bg-[var(--muted)]/50",
};

function reasonColor(cat: string) {
  return REASON_COLORS[cat.toLowerCase()] || "bg-[var(--muted)]/50";
}

interface Props {
  machineId: number;
  machineName: string;
  onClose: () => void;
}

export function SteelMachineAnalyticsPanel({ machineId, machineName, onClose }: Props) {
  const [analytics, setAnalytics] = useState<MachineAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getSteelMachineAnalytics(machineId, 90);
      setAnalytics(result);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load analytics.");
    } finally {
      setLoading(false);
    }
  }, [machineId]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  const s = analytics?.summary;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Machine Analytics — {machineName}</div>
          <div className="text-xs text-[var(--muted)]">90-day view · Pareto &amp; trends</div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void loadAnalytics()} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </Button>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-400/35 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</div>
      ) : null}

      {loading ? (
        <div className="py-8 text-center text-sm text-[var(--muted)]">Loading analytics...</div>
      ) : !analytics ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-6 text-center text-sm text-[var(--muted)]">
          No analytics data available.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)]">
              <CardContent className="pt-3">
                <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Total Downtime</div>
                <div className="mt-1 text-lg font-bold text-amber-400">{formatMinutes(s?.total_downtime_minutes ?? null)}</div>
              </CardContent>
            </Card>
            <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)]">
              <CardContent className="pt-3">
                <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Events</div>
                <div className="mt-1 text-lg font-bold">{s?.total_events ?? 0}</div>
              </CardContent>
            </Card>
            <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)]">
              <CardContent className="pt-3">
                <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">MTBF</div>
                <div className="mt-1 text-lg font-bold text-emerald-400">{formatHours(s?.mtbf_hours ?? null)}</div>
              </CardContent>
            </Card>
            <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)]">
              <CardContent className="pt-3">
                <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">MTTR</div>
                <div className="mt-1 text-lg font-bold text-rose-400">{formatMinutes(s?.mttr_minutes ?? null)}</div>
              </CardContent>
            </Card>
          </div>

          {/* Downtime Pareto */}
          <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-sm">Downtime Reason Pareto</CardTitle>
            </CardHeader>
            <CardContent>
              {analytics.downtime_pareto.length === 0 ? (
                <div className="text-sm text-[var(--muted)]">No downtime events recorded.</div>
              ) : (
                <div className="space-y-2">
                  {analytics.downtime_pareto.map((item, i) => (
                    <div key={item.reason_category} className="space-y-1">
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="shrink-0 w-4 text-right text-[var(--muted)]">{i + 1}.</span>
                          <span className="capitalize font-semibold text-white truncate">
                            {item.reason_category.replace(/_/g, " ")}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="font-mono text-[var(--muted)]">{formatMinutes(item.total_minutes)}</span>
                          <span className="w-10 text-right font-mono text-white">{item.percent_of_total}%</span>
                        </div>
                      </div>
                      <div className="relative h-3 w-full rounded-full bg-[rgba(12,18,28,0.72)] overflow-hidden">
                        <div
                          className={`absolute inset-y-0 left-0 rounded-full ${reasonColor(item.reason_category)}`}
                          style={{ width: barWidth(item.percent_of_total) }}
                        />
                        {/* Cumulative line */}
                        {i > 0 && (
                          <div
                            className="absolute inset-y-0 border-l border-dashed border-white/30"
                            style={{ left: `${item.cumulative_percent}%` }}
                          />
                        )}
                      </div>
                      <div className="flex justify-between text-[10px] text-[var(--muted)]">
                        <span>{item.event_count} event{item.event_count !== 1 ? "s" : ""}</span>
                        <span>Cumulative: {item.cumulative_percent}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* MTBF/MTTR Trend */}
          <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-sm">Weekly MTBF &amp; MTTR Trend</CardTitle>
            </CardHeader>
            <CardContent>
              {analytics.mtbf_trend.length === 0 ? (
                <div className="text-sm text-[var(--muted)]">No trend data available.</div>
              ) : (
                <ResponsiveScrollArea className="rounded-2xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)]" debugLabel="machine-trend-table">
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-[var(--muted)]">
                      <tr className="border-b border-[var(--border)]">
                        <th className="px-3 py-2 font-medium">Week</th>
                        <th className="px-3 py-2 font-medium">Failures</th>
                        <th className="px-3 py-2 font-medium">Downtime</th>
                        <th className="px-3 py-2 font-medium">MTBF</th>
                        <th className="px-3 py-2 font-medium">Trend</th>
                        <th className="px-3 py-2 font-medium">MTTR</th>
                        <th className="px-3 py-2 font-medium">Trend</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.mtbf_trend.map((wk, i) => {
                        const mtbfTrend = i > 0 && wk.mtbf_hours != null && analytics.mtbf_trend[i - 1].mtbf_hours != null
                          ? wk.mtbf_hours - analytics.mtbf_trend[i - 1].mtbf_hours!
                          : null;
                        const mttrItem = analytics.mttr_trend.find((m) => m.week_start === wk.week_start);
                        const mttrValue = mttrItem?.mttr_minutes ?? null;
                        const mttrTrend = i > 0 && mttrValue != null
                          ? (() => {
                              const prev = analytics.mttr_trend.find((m) => m.week_start === analytics.mtbf_trend[i - 1].week_start);
                              return prev?.mttr_minutes != null ? mttrValue - prev.mttr_minutes : null;
                            })()
                          : null;
                        return (
                          <tr key={wk.week_start} className="border-b border-[var(--border)]/60 last:border-none hover:bg-[rgba(62,166,255,0.04)]">
                            <td className="px-3 py-2 font-mono text-xs text-white">{wk.week_start}</td>
                            <td className="px-3 py-2 font-mono text-xs text-white">{wk.failure_count}</td>
                            <td className="px-3 py-2 font-mono text-xs text-[var(--muted)]">{formatMinutes(wk.downtime_minutes)}</td>
                            <td className="px-3 py-2 font-mono text-xs">{formatHours(wk.mtbf_hours)}</td>
                            <td className="px-3 py-2 text-xs">
                              {mtbfTrend != null ? (
                                <span className={mtbfTrend >= 0 ? "text-emerald-400" : "text-rose-400"}>
                                  {mtbfTrend >= 0 ? "↑" : "↓"} {Math.abs(mtbfTrend).toFixed(1)}h
                                </span>
                              ) : (
                                <span className="text-[var(--muted)]">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2 font-mono text-xs">{formatMinutes(mttrValue)}</td>
                            <td className="px-3 py-2 text-xs">
                              {mttrTrend != null ? (
                                <span className={mttrTrend <= 0 ? "text-emerald-400" : "text-rose-400"}>
                                  {mttrTrend <= 0 ? "↓" : "↑"} {Math.abs(mttrTrend).toFixed(0)}m
                                </span>
                              ) : (
                                <span className="text-[var(--muted)]">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </ResponsiveScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Daily Downtime Trend */}
          <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-sm">Daily Downtime Trend</CardTitle>
            </CardHeader>
            <CardContent>
              {analytics.daily_downtime_trend.length === 0 ? (
                <div className="text-sm text-[var(--muted)]">No daily data available.</div>
              ) : (
                <ResponsiveScrollArea className="rounded-2xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)]" debugLabel="machine-daily-trend-table">
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-[var(--muted)]">
                      <tr className="border-b border-[var(--border)]">
                        <th className="px-3 py-2 font-medium">Date</th>
                        <th className="px-3 py-2 font-medium">Downtime</th>
                        <th className="px-3 py-2 font-medium">Events</th>
                        <th className="px-3 py-2 font-medium">Top Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.daily_downtime_trend.map((day) => (
                        <tr key={day.date} className="border-b border-[var(--border)]/60 last:border-none hover:bg-[rgba(62,166,255,0.04)]">
                          <td className="px-3 py-2 font-mono text-xs text-white">{day.date}</td>
                          <td className="px-3 py-2 font-mono text-xs text-amber-400">{formatMinutes(day.downtime_minutes)}</td>
                          <td className="px-3 py-2 font-mono text-xs text-white">{day.event_count}</td>
                          <td className="px-3 py-2 text-xs capitalize text-[var(--muted)]">{day.top_reason?.replace(/_/g, " ") || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ResponsiveScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
