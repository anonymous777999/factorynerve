"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveScrollArea } from "@/components/ui/responsive-scroll-area";
import {
  getSteelProductionIntelligence,
  getSteelMachineIntelligence,
  type ProductionIntelligence,
  type ThroughputDay,
  type ShiftKpi,
  type TopLossBatch,
  type OperatorBatchPerformance,
  type ConversionPair,
  type MachineIntelligence,
  type MachineIntelligenceItem,
} from "@/lib/steel";
import { SteelMachineAnalyticsPanel } from "@/components/workflow/steel-machine-analytics-panel";
import { useSession } from "@/lib/use-session";
import { DashboardPageSkeleton } from "@/components/shared/page-skeletons";
import { EmptyState, TabButton } from "@/components/shared";

type Tab = "overview" | "trends" | "shift_downtime" | "batch_loss" | "operators" | "machines" | "confidence";

function formatNumber(value: number | null | undefined, decimals = 1) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: decimals, minimumFractionDigits: 0 }).format(value || 0);
}

function formatPercent(value: number | null | undefined) {
  return `${(value || 0).toFixed(1)}%`;
}

function formatMinutes(value: number | null | undefined) {
  const m = value || 0;
  if (m >= 60) return `${(m / 60).toFixed(1)}h`;
  return `${m.toFixed(0)}m`;
}

function badgeTone(value: string | null | undefined) {
  if (value === "green" || value === "approved" || value === "normal" || value === "good" || value === "available" || value === "yes") return "border-emerald-400/35 bg-emerald-400/12 text-emerald-200";
  if (value === "yellow" || value === "pending" || value === "watch" || value === "warning" || value === "needs_attention" || value === "partial") return "border-amber-400/35 bg-amber-400/12 text-amber-200";
  return "border-rose-400/35 bg-rose-400/12 text-rose-200";
}

function severityBadge(severity: string) {
  if (severity === "critical") return "border-rose-400/35 bg-rose-400/12 text-rose-200";
  if (severity === "high") return "border-amber-400/35 bg-amber-400/12 text-amber-200";
  if (severity === "watch") return "border-amber-400/25 bg-amber-400/8 text-amber-200/80";
  return "border-emerald-400/25 bg-emerald-400/8 text-emerald-200/80";
}

export function SteelProductionIntelligencePage() {
  const { user, activeFactory, loading: sessionLoading } = useSession();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [intel, setIntel] = useState<ProductionIntelligence | null>(null);
  const [machineIntel, setMachineIntel] = useState<MachineIntelligence | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState("");
  const [machineLoading, setMachineLoading] = useState(false);
  const [analyticsMachineId, setAnalyticsMachineId] = useState<number | null>(null);
  const [analyticsMachineName, setAnalyticsMachineName] = useState("");

  const isSteelFactory = (activeFactory?.industry_type || "").toLowerCase() === "steel";

  const loadData = useCallback(async () => {
    if (!isSteelFactory) {
      setPageLoading(false);
      return;
    }
    setPageLoading(true);
    setError("");
    try {
      const result = await getSteelProductionIntelligence();
      setIntel(result);
      // Also load machine intelligence in parallel
      setMachineLoading(true);
      try {
        const mi = await getSteelMachineIntelligence();
        setMachineIntel(mi);
      } catch {
        // Machine intelligence is optional — don't block the page
      } finally {
        setMachineLoading(false);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load production intelligence.");
    } finally {
      setPageLoading(false);
    }
  }, [isSteelFactory]);

  useEffect(() => {
    if (!user || !isSteelFactory) {
      setPageLoading(false);
      return;
    }
    void loadData();
  }, [isSteelFactory, loadData, user]);

  if (sessionLoading || pageLoading) {
    return <DashboardPageSkeleton />;
  }

  if (!isSteelFactory) {
    return (
      <main className="min-h-screen px-4 py-8 md:px-8 content-fade-in">
        <div className="mx-auto max-w-4xl text-center">
          <Card>
            <CardHeader>
              <CardTitle>Production intelligence is factory-aware</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-[var(--muted)]">
              <div>Switch into a steel factory from the sidebar to open the production cockpit.</div>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  const s = intel?.summary;
  const shiftAnalysis = intel?.shift_analysis;
  const downtime = intel?.downtime_analysis;
  const manpower = intel?.manpower_productivity;
  const batchLoss = intel?.batch_loss_analysis;
  const operators = intel?.operator_batch_performance || [];
  const processLoss = intel?.process_loss_proxy;
  const quality = intel?.quality_signal_summary;
  const coverage = intel?.data_coverage;
  const oee = intel?.oee_readiness;
  const trends = intel?.throughput_trend || [];
  const shifts = shiftAnalysis?.by_shift || [];
  const topLoss = batchLoss?.top_loss_batches || [];

  return (
    <main className="min-h-screen px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <section className="rounded-[2rem] border border-[var(--border)] bg-[linear-gradient(135deg,rgba(20,24,36,0.96),rgba(12,18,28,0.9))] p-6 shadow-2xl backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-sm uppercase tracking-prominent text-[var(--accent)]">Production Intelligence</div>
              <h1 className="mt-2 text-3xl font-semibold md:text-4xl">Shift throughput, batch quality &amp; operator performance</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                Phase 1 analytics derived from shift records and batch data. No schema changes required.
                Labels distinguish direct, derived, and proxy metrics.
              </p>
            </div>
            <div className="flex gap-3">
              <Link href="/steel/production-record">
                <Button variant="outline">Production Entry</Button>
              </Link>
              <Button variant="outline" onClick={() => void loadData()} disabled={pageLoading}>
                {pageLoading ? "Loading..." : "Refresh"}
              </Button>
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-rose-400/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>
        ) : null}

        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2">
          <TabButton label="Overview" active={activeTab === "overview"} onClick={() => setActiveTab("overview")} />
          <TabButton label={`Trends (${trends.length}d)`} active={activeTab === "trends"} onClick={() => setActiveTab("trends")} />
          <TabButton label="Shift & Downtime" active={activeTab === "shift_downtime"} onClick={() => setActiveTab("shift_downtime")} />
          <TabButton label={`Batch Loss (${topLoss.length})`} active={activeTab === "batch_loss"} onClick={() => setActiveTab("batch_loss")} />
          <TabButton label={`Operators (${operators.length})`} active={activeTab === "operators"} onClick={() => setActiveTab("operators")} />
          <TabButton label={`Machines (${machineIntel?.machine_count ?? "..."})`} active={activeTab === "machines"} onClick={() => setActiveTab("machines")} />
          <TabButton label="Data Confidence" active={activeTab === "confidence"} onClick={() => setActiveTab("confidence")} />
        </div>

        {/* ── TAB: Overview ────────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <>
            {/* KPI Summary Cards */}
            <section className="grid gap-4 md:grid-cols-4">
              <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                <CardContent className="pt-4">
                  <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Today Produced</div>
                  <div className="mt-1 text-2xl font-bold">{formatNumber(s?.today_produced_units)}</div>
                  <div className="mt-1 text-xs text-[var(--muted)]">{s?.today_entry_count ?? 0} entry records</div>
                </CardContent>
              </Card>
              <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                <CardContent className="pt-4">
                  <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Period Attainment</div>
                  <div className={`mt-1 text-2xl font-bold ${(s?.overall_attainment_percent ?? 100) >= 90 ? "text-emerald-400" : (s?.overall_attainment_percent ?? 100) >= 70 ? "text-amber-400" : "text-rose-400"}`}>
                    {formatPercent(s?.overall_attainment_percent)}
                  </div>
                  <div className="mt-1 text-xs text-[var(--muted)]">{formatNumber(s?.total_produced_units)} / {formatNumber(s?.total_target_units)} units</div>
                </CardContent>
              </Card>
              <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                <CardContent className="pt-4">
                  <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Batch Output</div>
                  <div className="mt-1 text-2xl font-bold">{formatNumber(s?.total_batch_output_kg)} KG</div>
                  <div className="mt-1 text-xs text-[var(--muted)]">{s?.total_batch_count ?? 0} batches · avg loss {formatPercent(s?.avg_batch_loss_percent)}</div>
                </CardContent>
              </Card>
              <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                <CardContent className="pt-4">
                  <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Downtime &amp; Quality</div>
                  <div className="mt-1 text-2xl font-bold">{formatMinutes(s?.total_downtime_minutes)}</div>
                  <div className="mt-1 text-xs text-[var(--muted)]">{s?.total_quality_issue_entries ?? 0} quality issue entries</div>
                </CardContent>
              </Card>
            </section>

            {/* Shift Analysis Snapshot */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                <CardHeader>
                  <CardTitle>Shift Attainment</CardTitle>
                </CardHeader>
                <CardContent>
                  {shifts.length === 0 ? (
                    <EmptyState message="No shift data available." />
                  ) : (
                    <div className="space-y-3">
                      {shifts.map((sh) => (
                        <div key={sh.shift} className="flex items-center justify-between border-b border-[var(--border)]/60 pb-2 last:border-none last:pb-0">
                          <div>
                            <div className="font-semibold text-white capitalize">{sh.shift}</div>
                            <div className="text-xs text-[var(--muted)]">{sh.entry_count} entries · {formatNumber(sh.total_target_units)} target</div>
                          </div>
                          <div className="text-right">
                            <div className={`font-semibold ${sh.attainment_percent >= 90 ? "text-emerald-400" : sh.attainment_percent >= 70 ? "text-amber-400" : "text-rose-400"}`}>
                              {formatPercent(sh.attainment_percent)}
                            </div>
                            <div className="text-xs text-[var(--muted)]">{formatNumber(sh.total_produced_units)} produced</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {shiftAnalysis?.worst_attainment_shift && (
                <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                  <CardHeader>
                    <CardTitle>Shift Rankings</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between rounded-2xl border border-rose-400/20 bg-rose-500/8 p-3">
                        <div>
                          <div className="text-sm font-semibold text-rose-300">Worst Attainment</div>
                          <div className="text-xs text-[var(--muted)] capitalize">{shiftAnalysis.worst_attainment_shift.shift} shift</div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-rose-400">{formatPercent(shiftAnalysis.worst_attainment_shift.attainment_percent)}</div>
                          <div className="text-xs text-[var(--muted)]">{formatMinutes(shiftAnalysis.worst_attainment_shift.total_downtime_minutes)} downtime</div>
                        </div>
                      </div>
                      {shiftAnalysis.highest_downtime_shift && (
                        <div className="flex items-center justify-between rounded-2xl border border-amber-400/20 bg-amber-500/8 p-3">
                          <div>
                            <div className="text-sm font-semibold text-amber-300">Highest Downtime</div>
                            <div className="text-xs text-[var(--muted)] capitalize">{shiftAnalysis.highest_downtime_shift.shift} shift</div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-amber-400">{formatMinutes(shiftAnalysis.highest_downtime_shift.total_downtime_minutes)}</div>
                            <div className="text-xs text-[var(--muted)]">{formatPercent(shiftAnalysis.highest_downtime_shift.attainment_percent)} attainment</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Quality Signals */}
            {quality && (
              <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                <CardHeader>
                  <CardTitle>Quality Signals</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border border-[var(--border)] p-4">
                      <div className="text-xs text-[var(--muted)]">Entry Quality Issues</div>
                      <div className="mt-1 text-lg font-bold">{quality.entry_based.quality_issue_entries}</div>
                      <div className="text-xs text-[var(--muted)]">{formatPercent(quality.entry_based.quality_issue_rate_percent)} of entries</div>
                    </div>
                    <div className="rounded-2xl border border-[var(--border)] p-4">
                      <div className="text-xs text-[var(--muted)]">Normal</div>
                      <div className="mt-1 text-lg font-bold text-emerald-400">{quality.batch_based.normal_count}</div>
                      <div className="text-xs text-[var(--muted)]">Watch: {quality.batch_based.watch_count}</div>
                    </div>
                    <div className="rounded-2xl border border-[var(--border)] p-4">
                      <div className="text-xs text-[var(--muted)]">High / Critical Batches</div>
                      <div className="mt-1 text-lg font-bold text-rose-400">{quality.batch_based.high_critical_rate_percent}%</div>
                      <div className="text-xs text-[var(--muted)]">{quality.batch_based.high_count} high · {quality.batch_based.critical_count} critical</div>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-[var(--muted)] italic">{quality.note}</div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* ── TAB: Trends ───────────────────────────────────────────────── */}
        {activeTab === "trends" && (
          <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
            <CardHeader>
              <CardTitle>Daily Throughput Trend</CardTitle>
            </CardHeader>
            <CardContent>
              {trends.length === 0 ? (
                <EmptyState message="No throughput data available for this period." />
              ) : (
                <ResponsiveScrollArea
                  className="rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)]"
                  debugLabel="production-trend-table"
                >
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-[var(--muted)]">
                      <tr className="border-b border-[var(--border)]">
                        <th className="px-3 py-3 font-medium">Date</th>
                        <th className="px-3 py-3 font-medium">Target</th>
                        <th className="px-3 py-3 font-medium">Produced</th>
                        <th className="px-3 py-3 font-medium">Attainment</th>
                        <th className="px-3 py-3 font-medium">Downtime</th>
                        <th className="px-3 py-3 font-medium">Quality Issues</th>
                        <th className="px-3 py-3 font-medium">Batch Output KG</th>
                        <th className="px-3 py-3 font-medium">Batch Loss %</th>
                        <th className="px-3 py-3 font-medium">Entries</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trends.map((d: ThroughputDay) => (
                        <tr key={d.date} className="border-b border-[var(--border)]/60 last:border-none">
                          <td className="px-3 py-3 font-semibold text-white">{d.date}</td>
                          <td className="px-3 py-3 font-mono text-white">{formatNumber(d.total_target)}</td>
                          <td className="px-3 py-3 font-mono text-white">{formatNumber(d.total_produced)}</td>
                          <td className="px-3 py-3">
                            <span className={`font-semibold ${d.attainment_percent != null && d.attainment_percent >= 90 ? "text-emerald-400" : d.attainment_percent != null && d.attainment_percent >= 70 ? "text-amber-400" : "text-rose-400"}`}>
                              {d.attainment_percent != null ? formatPercent(d.attainment_percent) : "—"}
                            </span>
                          </td>
                          <td className="px-3 py-3 font-mono text-[var(--muted)]">{formatMinutes(d.total_downtime_minutes)}</td>
                          <td className="px-3 py-3">
                            <span className={d.quality_issue_count > 0 ? "text-rose-400 font-semibold" : "text-[var(--muted)]"}>
                              {d.quality_issue_count}
                            </span>
                          </td>
                          <td className="px-3 py-3 font-mono text-white">{formatNumber(d.batch_output_kg, 1)}</td>
                          <td className="px-3 py-3 font-mono text-white">{formatPercent(d.batch_loss_percent)}</td>
                          <td className="px-3 py-3 text-[var(--muted)]">{d.approved_entry_count}/{d.entry_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ResponsiveScrollArea>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── TAB: Shift & Downtime ──────────────────────────────────────── */}
        {activeTab === "shift_downtime" && (
          <section className="grid gap-6 lg:grid-cols-2">
            {/* Shift Performance Table */}
            <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
              <CardHeader>
                <CardTitle>Shift Performance</CardTitle>
              </CardHeader>
              <CardContent>
                {shifts.length === 0 ? (
                  <EmptyState message="No approved shift data available." />
                ) : (
                  <ResponsiveScrollArea
                    className="rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)]"
                    debugLabel="production-shift-table"
                  >
                    <table className="min-w-full text-left text-sm">
                      <thead className="text-[var(--muted)]">
                        <tr className="border-b border-[var(--border)]">
                          <th className="px-3 py-3 font-medium">Shift</th>
                          <th className="px-3 py-3 font-medium">Entries</th>
                          <th className="px-3 py-3 font-medium">Target</th>
                          <th className="px-3 py-3 font-medium">Produced</th>
                          <th className="px-3 py-3 font-medium">Attainment</th>
                          <th className="px-3 py-3 font-medium">Downtime</th>
                          <th className="px-3 py-3 font-medium">Quality</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shifts.map((sh: ShiftKpi) => (
                          <tr key={sh.shift} className="border-b border-[var(--border)]/60 last:border-none">
                            <td className="px-3 py-3 font-semibold text-white capitalize">{sh.shift}</td>
                            <td className="px-3 py-3 text-[var(--muted)]">{sh.entry_count}</td>
                            <td className="px-3 py-3 font-mono text-white">{formatNumber(sh.total_target_units)}</td>
                            <td className="px-3 py-3 font-mono text-white">{formatNumber(sh.total_produced_units)}</td>
                            <td className="px-3 py-3">
                              <span className={`font-semibold ${sh.attainment_percent >= 90 ? "text-emerald-400" : sh.attainment_percent >= 70 ? "text-amber-400" : "text-rose-400"}`}>
                                {formatPercent(sh.attainment_percent)}
                              </span>
                            </td>
                            <td className="px-3 py-3 font-mono text-[var(--muted)]">{formatMinutes(sh.total_downtime_minutes)}</td>
                            <td className="px-3 py-3">
                              <span className={sh.quality_issue_count > 0 ? "text-rose-400" : "text-emerald-400"}>
                                {sh.quality_issue_count > 0 ? `${sh.quality_issue_count} (${formatPercent(sh.quality_issue_rate_percent)})` : "0"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ResponsiveScrollArea>
                )}
              </CardContent>
            </Card>

            {/* Downtime by Reason */}
            <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
              <CardHeader>
                <CardTitle>Top Downtime Reasons</CardTitle>
              </CardHeader>
              <CardContent>
                {downtime && downtime.top_reasons.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] p-3">
                      <div className="text-sm font-semibold">Total downtime</div>
                      <div className="text-lg font-bold text-amber-400">{formatMinutes(downtime.total_downtime_minutes)}</div>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] p-3">
                      <div className="text-sm font-semibold">Avg per entry</div>
                      <div className="text-lg font-bold text-white">{formatMinutes(downtime.avg_downtime_per_entry_minutes)}</div>
                    </div>
                    <div className="mt-4 space-y-2">
                      {downtime.top_reasons.map((r, i) => (
                        <div key={`${r.reason}-${i}`} className="flex items-center justify-between border-b border-[var(--border)]/60 pb-2 last:border-none last:pb-0">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-white">{r.reason?.replace(/_/g, " ") || "Unspecified"}</div>
                            <div className="text-xs text-[var(--muted)]">Rank #{i + 1}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-white">{formatMinutes(r.total_downtime_minutes)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <EmptyState message="No downtime data available." />
                )}
              </CardContent>
            </Card>

            {/* Downtime by Department */}
            <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm lg:col-span-2">
              <CardHeader>
                <CardTitle>Downtime by Department</CardTitle>
              </CardHeader>
              <CardContent>
                {downtime && downtime.by_department.length > 0 ? (
                  <div className="grid gap-3 md:grid-cols-3">
                    {downtime.by_department.map((d) => (
                      <div key={d.department} className="flex items-center justify-between rounded-2xl border border-[var(--border)] p-3">
                        <div className="text-sm font-semibold text-white">{d.department}</div>
                        <div className="font-semibold text-amber-400">{formatMinutes(d.total_downtime_minutes)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState message="No department breakdown available." />
                )}
              </CardContent>
            </Card>

            {/* Manpower Productivity */}
            {manpower && (
              <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm lg:col-span-2">
                <CardHeader>
                  <CardTitle>Manpower Productivity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 grid gap-4 md:grid-cols-4">
                    <div className="rounded-2xl border border-[var(--border)] p-3">
                      <div className="text-xs text-[var(--muted)]">Total Present</div>
                      <div className="mt-1 text-lg font-bold text-white">{formatNumber(manpower.total_manpower_present)}</div>
                    </div>
                    <div className="rounded-2xl border border-[var(--border)] p-3">
                      <div className="text-xs text-[var(--muted)]">Total Absent</div>
                      <div className="mt-1 text-lg font-bold text-rose-400">{formatNumber(manpower.total_manpower_absent)}</div>
                    </div>
                    <div className="rounded-2xl border border-[var(--border)] p-3">
                      <div className="text-xs text-[var(--muted)]">Units / Worker</div>
                      <div className="mt-1 text-lg font-bold text-emerald-400">{formatNumber(manpower.avg_units_per_worker)}</div>
                    </div>
                    <div className="rounded-2xl border border-[var(--border)] p-3">
                      <div className="text-xs text-[var(--muted)]">Absenteeism</div>
                      <div className={`mt-1 text-lg font-bold ${manpower.avg_absenteeism_percent > 15 ? "text-rose-400" : "text-white"}`}>{formatPercent(manpower.avg_absenteeism_percent)}</div>
                    </div>
                  </div>
                  {manpower.by_shift.length > 0 && (
                    <ResponsiveScrollArea
                      className="rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)]"
                      debugLabel="production-manpower-table"
                    >
                      <table className="min-w-full text-left text-sm">
                        <thead className="text-[var(--muted)]">
                          <tr className="border-b border-[var(--border)]">
                            <th className="px-3 py-3 font-medium">Shift</th>
                            <th className="px-3 py-3 font-medium">Present</th>
                            <th className="px-3 py-3 font-medium">Absent</th>
                            <th className="px-3 py-3 font-medium">Units / Worker</th>
                          </tr>
                        </thead>
                        <tbody>
                          {manpower.by_shift.map((m) => (
                            <tr key={m.shift} className="border-b border-[var(--border)]/60 last:border-none">
                              <td className="px-3 py-3 font-semibold text-white capitalize">{m.shift}</td>
                              <td className="px-3 py-3 font-mono text-white">{formatNumber(m.total_manpower_present)}</td>
                              <td className="px-3 py-3 font-mono text-rose-400">{formatNumber(m.total_manpower_absent)}</td>
                              <td className="px-3 py-3 font-mono text-emerald-400">{formatNumber(m.units_per_worker)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </ResponsiveScrollArea>
                  )}
                </CardContent>
              </Card>
            )}
          </section>
        )}

        {/* ── TAB: Batch Loss & Quality ──────────────────────────────────── */}
        {activeTab === "batch_loss" && (
          <section className="space-y-6">
            {/* Severity Distribution */}
            {batchLoss && batchLoss.total_batches > 0 && (
              <div className="grid gap-4 md:grid-cols-5">
                <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                  <CardContent className="pt-4">
                    <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Total Batches</div>
                    <div className="mt-1 text-2xl font-bold">{batchLoss.total_batches}</div>
                  </CardContent>
                </Card>
                <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                  <CardContent className="pt-4">
                    <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Avg Loss %</div>
                    <div className="mt-1 text-2xl font-bold text-amber-400">{formatPercent(batchLoss.avg_loss_percent)}</div>
                  </CardContent>
                </Card>
                <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                  <CardContent className="pt-4">
                    <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Avg Variance %</div>
                    <div className="mt-1 text-2xl font-bold">{formatPercent(batchLoss.avg_variance_percent)}</div>
                  </CardContent>
                </Card>
                <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                  <CardContent className="pt-4">
                    <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Total Output KG</div>
                    <div className="mt-1 text-2xl font-bold">{formatNumber(batchLoss.total_batch_output_kg, 1)}</div>
                  </CardContent>
                </Card>
                <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                  <CardContent className="pt-4">
                    <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Normal / Watch / High / Crit</div>
                    <div className="mt-1 text-xl font-bold">
                      <span className="text-emerald-400">{batchLoss.severity_distribution["normal"] ?? 0}</span>
                      {" / "}
                      <span className="text-amber-200/80">{batchLoss.severity_distribution["watch"] ?? 0}</span>
                      {" / "}
                      <span className="text-amber-400">{batchLoss.severity_distribution["high"] ?? 0}</span>
                      {" / "}
                      <span className="text-rose-400">{batchLoss.severity_distribution["critical"] ?? 0}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Top Loss Batches */}
            <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
              <CardHeader>
                <CardTitle>Top Loss Batches</CardTitle>
              </CardHeader>
              <CardContent>
                {topLoss.length === 0 ? (
                  <EmptyState message="No batch loss data available." />
                ) : (
                  <ResponsiveScrollArea
                    className="rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)]"
                    debugLabel="production-top-loss-table"
                  >
                    <table className="min-w-full text-left text-sm">
                      <thead className="text-[var(--muted)]">
                        <tr className="border-b border-[var(--border)]">
                          <th className="px-3 py-3 font-medium">Batch Code</th>
                          <th className="px-3 py-3 font-medium">Date</th>
                          <th className="px-3 py-3 font-medium">Output KG</th>
                          <th className="px-3 py-3 font-medium">Loss KG</th>
                          <th className="px-3 py-3 font-medium">Loss %</th>
                          <th className="px-3 py-3 font-medium">Severity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topLoss.map((b: TopLossBatch) => (
                          <tr key={b.id} className="border-b border-[var(--border)]/60 last:border-none">
                            <td className="px-3 py-3 font-semibold text-white">{b.batch_code}</td>
                            <td className="px-3 py-3 text-[var(--muted)]">{b.production_date}</td>
                            <td className="px-3 py-3 font-mono text-white">{formatNumber(b.actual_output_kg, 1)}</td>
                            <td className="px-3 py-3 font-mono text-white">{formatNumber(b.loss_kg, 2)}</td>
                            <td className="px-3 py-3">
                              <span className={`font-semibold ${b.loss_percent > 10 ? "text-rose-400" : b.loss_percent > 5 ? "text-amber-400" : "text-white"}`}>
                                {formatPercent(b.loss_percent)}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] uppercase tracking-caption ${severityBadge(b.severity)}`}>
                                {b.severity}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ResponsiveScrollArea>
                )}
              </CardContent>
            </Card>
          </section>
        )}

        {/* ── TAB: Operators & Process ───────────────────────────────────── */}
        {activeTab === "operators" && (
          <section className="grid gap-6 lg:grid-cols-2">
            {/* Operator Performance */}
            <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm lg:col-span-1">
              <CardHeader>
                <CardTitle>Operator Batch Performance</CardTitle>
              </CardHeader>
              <CardContent>
                {operators.length === 0 ? (
                  <EmptyState message="No operator batch data available." />
                ) : (
                  <div className="space-y-3">
                    {operators.map((op: OperatorBatchPerformance) => (
                      <div key={op.user_id} className="flex items-center justify-between border-b border-[var(--border)]/60 pb-3 last:border-none last:pb-0">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white">{op.name}</div>
                          <div className="text-xs text-[var(--muted)]">{op.batch_count} batches · {formatNumber(op.total_actual_output_kg, 1)} KG output</div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">{formatPercent(op.avg_loss_percent)}</div>
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] uppercase tracking-caption ${op.high_critical_percent > 20 ? "border-rose-400/35 bg-rose-400/12 text-rose-200" : op.high_critical_percent > 10 ? "border-amber-400/35 bg-amber-400/12 text-amber-200" : "border-emerald-400/35 bg-emerald-400/12 text-emerald-200"}`}>
                            {op.high_critical_count} high/crit
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Process Loss Proxy */}
            <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm lg:col-span-1">
              <CardHeader>
                <CardTitle>Process Loss — Conversion Pairs</CardTitle>
              </CardHeader>
              <CardContent>
                {processLoss && processLoss.by_conversion_pair.length > 0 ? (
                  <div className="space-y-3">
                    {processLoss.by_conversion_pair.map((pair: ConversionPair, i: number) => (
                      <div key={`${pair.input_name}-${pair.output_name}-${i}`} className="flex items-center justify-between border-b border-[var(--border)]/60 pb-3 last:border-none last:pb-0">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white">{pair.input_name} → {pair.output_name}</div>
                          <div className="text-xs text-[var(--muted)]">{pair.batch_count} batches · {formatNumber(pair.total_input_kg, 1)} → {formatNumber(pair.total_output_kg, 1)} KG</div>
                        </div>
                        <div className="text-right">
                          <div className={`font-semibold ${pair.avg_loss_percent > 10 ? "text-rose-400" : pair.avg_loss_percent > 5 ? "text-amber-400" : "text-emerald-400"}`}>
                            {formatPercent(pair.avg_loss_percent)} loss
                          </div>
                          <span className="text-xs text-[var(--muted)]">{pair.high_critical_count} high/crit</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState message="No process loss data available." />
                )}
                {processLoss?.note && (
                  <div className="mt-3 text-xs text-[var(--muted)] italic">{processLoss.note}</div>
                )}
              </CardContent>
            </Card>
          </section>
        )}

        {/* ── TAB: Machine Intelligence ────────────────────────────────── */}
        {activeTab === "machines" && (
          <section className="space-y-6">
            {/* Factory Summary Cards */}
            {machineIntel && (
              <div className="grid gap-4 md:grid-cols-4">
                <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                  <CardContent className="pt-4">
                    <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Total Machines</div>
                    <div className="mt-1 text-2xl font-bold">{machineIntel.machine_count}</div>
                    <div className="mt-1 text-xs text-[var(--muted)]">In fleet</div>
                  </CardContent>
                </Card>
                <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                  <CardContent className="pt-4">
                    <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Avg Uptime</div>
                    <div className={`mt-1 text-2xl font-bold ${(machineIntel.factory_summary.avg_uptime_percent ?? 100) >= 90 ? "text-emerald-400" : (machineIntel.factory_summary.avg_uptime_percent ?? 100) >= 70 ? "text-amber-400" : "text-rose-400"}`}>
                      {machineIntel.factory_summary.avg_uptime_percent != null ? `${machineIntel.factory_summary.avg_uptime_percent.toFixed(1)}%` : "—"}
                    </div>
                    <div className="mt-1 text-xs text-[var(--muted)]">{formatMinutes(machineIntel.factory_summary.total_downtime_minutes)} downtime</div>
                  </CardContent>
                </Card>
                <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                  <CardContent className="pt-4">
                    <div className="text-xs uppercase tracking-wider text-[var(--muted)]">MTBF</div>
                    <div className="mt-1 text-2xl font-bold text-white">
                      {machineIntel.factory_summary.factory_mtbf_hours != null ? `${machineIntel.factory_summary.factory_mtbf_hours.toFixed(1)}h` : "—"}
                    </div>
                    <div className="mt-1 text-xs text-[var(--muted)]">{machineIntel.factory_summary.total_failure_count} failures</div>
                  </CardContent>
                </Card>
                <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                  <CardContent className="pt-4">
                    <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Maintenance</div>
                    <div className="mt-1 text-2xl font-bold">
                      <span className="text-amber-400">{machineIntel.factory_summary.overdue_maintenance_count}</span>
                      <span className="text-xs text-[var(--muted)]"> / {machineIntel.factory_summary.upcoming_maintenance_count}</span>
                    </div>
                    <div className="mt-1 text-xs text-[var(--muted)]">overdue / upcoming</div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Active Alerts Banner */}
            {machineIntel && machineIntel.factory_summary.active_alerts_count > 0 && (
              <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-2 w-2 rounded-full bg-rose-400 animate-pulse" />
                  <span className="font-semibold text-rose-200">
                    {machineIntel.factory_summary.active_alerts_count} active alert{machineIntel.factory_summary.active_alerts_count !== 1 ? "s" : ""}
                  </span>
                  <span className="text-[var(--muted)]">
                    — machines with low MTBF or overdue maintenance
                  </span>
                </div>
              </div>
            )}

            {/* Per-Machine Breakdown */}
            <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
              <CardHeader>
                <CardTitle>Machine Health</CardTitle>
              </CardHeader>
              <CardContent>
                {!machineIntel ? (
                  <EmptyState message="Machine intelligence data not available. Ensure machines are registered and downtime events are tracked." />
                ) : machineIntel.machines.length === 0 ? (
                  <EmptyState message="No machines registered yet. Add machines from the Machines page to enable machine-level analytics." />
                ) : (
                  <ResponsiveScrollArea
                    className="rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)]"
                    debugLabel="machine-intelligence-table"
                  >
                    <table className="min-w-full text-left text-sm">
                      <thead className="text-[var(--muted)]">
                        <tr className="border-b border-[var(--border)]">                            <th className="px-3 py-3 font-medium">Machine</th>
                          <th className="px-3 py-3 font-medium">Type</th>
                          <th className="px-3 py-3 font-medium">OEE Score</th>
                          <th className="px-3 py-3 font-medium">Avail.</th>
                          <th className="px-3 py-3 font-medium">Perf.</th>
                          <th className="px-3 py-3 font-medium">Downtime</th>
                          <th className="px-3 py-3 font-medium">Failures</th>
                          <th className="px-3 py-3 font-medium">MTBF</th>
                          <th className="px-3 py-3 font-medium">MTTR</th>
                          <th className="px-3 py-3 font-medium">Top Reason</th>
                          <th className="px-3 py-3 font-medium">Alerts</th>
                          <th className="px-3 py-3 font-medium">Maint.</th>
                          <th className="px-3 py-3 font-medium">Analytics</th>
                        </tr>
                      </thead>
                      <tbody>
                        {machineIntel.machines.map((m: MachineIntelligenceItem) => (
                          <>
                          <tr key={m.machine_id} className="border-b border-[var(--border)]/60 last:border-none hover:bg-[rgba(197,109,45,0.04)]">
                            <td className="px-3 py-3">
                              <div className="font-semibold text-white">{m.machine_name}</div>
                              <div className="text-[10px] text-[var(--muted)] font-mono">{m.machine_code}</div>
                            </td>
                            <td className="px-3 py-3 text-xs text-[var(--muted)]">{m.machine_type || "—"}</td>
                            {/* OEE Score */}
                            <td className="px-3 py-3">
                              {m.oee_score != null ? (
                                <span className={`font-bold ${m.oee_score >= 85 ? "text-emerald-400" : m.oee_score >= 60 ? "text-amber-400" : "text-rose-400"}`}>
                                  {m.oee_score.toFixed(1)}%
                                </span>
                              ) : (
                                <span className="text-xs text-[var(--muted)]">—</span>
                              )}
                            </td>
                            {/* Availability */}
                            <td className="px-3 py-3">
                              <span className={`font-semibold ${m.oee_availability_percent != null ? ((m.oee_availability_percent ?? 100) >= 90 ? "text-emerald-400" : "text-amber-400") : m.uptime_percent >= 90 ? "text-emerald-400" : m.uptime_percent >= 70 ? "text-amber-400" : "text-rose-400"}`} title={m.oee_availability_percent != null ? `True OEE availability (from planned_runtime)` : `Estimated (24h/day assumption)`}>
                                {(m.oee_availability_percent ?? m.uptime_percent).toFixed(1)}%
                              </span>
                              {m.oee_data_quality === "true_runtime" && (
                                <span className="ml-1 inline-flex rounded-full border border-emerald-400/25 bg-emerald-400/8 px-1.5 py-0.5 text-[9px] uppercase tracking-caption text-emerald-300/70">A</span>
                              )}
                            </td>
                            {/* Performance */}
                            <td className="px-3 py-3">
                              {m.oee_performance_percent != null ? (
                                <span className={`font-semibold ${m.oee_performance_percent >= 95 ? "text-emerald-400" : "text-amber-400"}`}>
                                  {m.oee_performance_percent.toFixed(1)}%
                                </span>
                              ) : (
                                <span className="text-xs text-[var(--muted)]">—</span>
                              )}
                            </td>
                            <td className="px-3 py-3 font-mono text-[var(--muted)]">{formatMinutes(m.downtime_minutes)}</td>
                            <td className="px-3 py-3 font-mono text-white">{m.failure_count}</td>
                            <td className="px-3 py-3 font-mono text-white">{m.mtbf_hours != null ? `${m.mtbf_hours.toFixed(1)}h` : "—"}</td>
                            <td className="px-3 py-3 font-mono text-white">{m.mttr_minutes != null ? `${m.mttr_minutes.toFixed(0)}m` : "—"}</td>
                            <td className="px-3 py-3">
                              {m.top_downtime_reasons.length > 0 ? (
                                <span className="text-xs text-[var(--muted)] capitalize">
                                  {m.top_downtime_reasons[0].reason_category.replace(/_/g, " ")}
                                </span>
                              ) : (
                                <span className="text-xs text-[var(--muted)]">—</span>
                              )}
                            </td>
                            <td className="px-3 py-3">
                              {m.alerts.length > 0 ? (
                                <div className="flex flex-col gap-1">
                                  {m.alerts.filter(a => a.severity === "critical" || a.severity === "high").slice(0, 2).map((alert, i) => (
                                    <span
                                      key={`alert-${i}`}
                                      title={alert.message}
                                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-caption ${
                                        alert.severity === "critical"
                                          ? "border-rose-400/35 bg-rose-400/12 text-rose-200"
                                          : alert.severity === "high"
                                          ? "border-amber-400/35 bg-amber-400/12 text-amber-200"
                                          : "border-amber-400/25 bg-amber-400/8 text-amber-200/80"
                                      }`}
                                    >
                                      <span className={`inline-flex h-1.5 w-1.5 rounded-full ${
                                        alert.severity === "critical" ? "bg-rose-400" : "bg-amber-400"
                                      }`} />
                                      {alert.type === "mtbf_low" ? "MTBF" : alert.type === "overdue_maintenance" ? "Overdue" : "Due"}
                                    </span>
                                  ))}
                                  {m.alerts.length > 2 && (
                                    <span className="text-[10px] text-[var(--muted)]">+{m.alerts.length - 2} more</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-emerald-400/60">None</span>
                              )}
                            </td>
                            <td className="px-3 py-3">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] uppercase tracking-caption ${
                                m.overdue_maintenance_count > 0
                                  ? "border-rose-400/35 bg-rose-400/12 text-rose-200"
                                  : m.upcoming_maintenance_count > 0
                                  ? "border-amber-400/35 bg-amber-400/12 text-amber-200"
                                  : "border-emerald-400/25 bg-emerald-400/8 text-emerald-200/80"
                              }`}>
                                {m.overdue_maintenance_count > 0
                                  ? `${m.overdue_maintenance_count} overdue`
                                  : m.upcoming_maintenance_count > 0
                                  ? `${m.upcoming_maintenance_count} planned`
                                  : "clear"}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <Button
                                variant="ghost"
                                onClick={() => {
                                  if (analyticsMachineId === m.machine_id) {
                                    setAnalyticsMachineId(null);
                                  } else {
                                    setAnalyticsMachineId(m.machine_id);
                                    setAnalyticsMachineName(m.machine_name);
                                  }
                                }}
                              >
                                Analytics
                              </Button>
                            </td>
                          </tr>
                          {analyticsMachineId === m.machine_id && (
                            <tr key={`analytics-${m.machine_id}`}>
                              <td colSpan={13} className="px-3 py-3">
                                <SteelMachineAnalyticsPanel
                                  machineId={m.machine_id}
                                  machineName={analyticsMachineName}
                                  onClose={() => setAnalyticsMachineId(null)}
                                />
                              </td>
                            </tr>
                          )}
                          </>
                        ))}
                      </tbody>
                    </table>
                  </ResponsiveScrollArea>
                )}
              </CardContent>
            </Card>

            {/* Data Quality Note */}
            {machineIntel && (
              <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                <CardContent className="pt-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-[var(--border)] p-3">
                      <div className="text-xs text-[var(--muted)]">Data Quality</div>
                      <div className="mt-1 text-sm font-semibold text-white capitalize">{machineIntel.data_quality.replace(/_/g, " ")}</div>
                    </div>
                    <div className="rounded-2xl border border-[var(--border)] p-3">
                      <div className="text-xs text-[var(--muted)]">Note</div>
                      <div className="mt-1 text-sm text-[var(--muted)]">{machineIntel.note}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </section>
        )}

        {/* ── TAB: Data Confidence ───────────────────────────────────────── */}
        {activeTab === "confidence" && (
          <section className="grid gap-6 lg:grid-cols-2">
            <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
              <CardHeader>
                <CardTitle>Data Coverage</CardTitle>
              </CardHeader>
              <CardContent>
                {coverage ? (
                  <div className="space-y-2">
                    {Object.entries(coverage).map(([key, val]) => (
                      <div key={key} className="flex items-center justify-between border-b border-[var(--border)]/60 pb-2 last:border-none last:pb-0">
                        <div className="text-sm font-semibold text-white">
                          {key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                        </div>
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] uppercase tracking-caption ${val ? "border-emerald-400/35 bg-emerald-400/12 text-emerald-200" : "border-rose-400/35 bg-rose-400/12 text-rose-200"}`}>
                          {val ? "Available" : "Missing"}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState message="No data coverage information." />
                )}
              </CardContent>
            </Card>

            <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
              <CardHeader>
                <CardTitle>OEE Readiness</CardTitle>
              </CardHeader>
              <CardContent>
                {oee ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] p-3">
                      <div className="text-sm font-semibold">True OEE Supported</div>
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs uppercase tracking-caption ${oee.true_oee_supported ? "border-emerald-400/35 bg-emerald-400/12 text-emerald-200" : "border-rose-400/35 bg-rose-400/12 text-rose-200"}`}>
                        {oee.true_oee_supported ? "Yes" : "No"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] p-3">
                      <div className="text-sm font-semibold">Availability Inputs</div>
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs uppercase tracking-caption ${badgeTone(oee.availability_inputs_present)}`}>
                        {oee.availability_inputs_present}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] p-3">
                      <div className="text-sm font-semibold">Performance Inputs</div>
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs uppercase tracking-caption ${badgeTone(oee.performance_inputs_present)}`}>
                        {oee.performance_inputs_present}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] p-3">
                      <div className="text-sm font-semibold">Quality Inputs</div>
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs uppercase tracking-caption ${badgeTone(oee.quality_inputs_present)}`}>
                        {oee.quality_inputs_present}
                      </span>
                    </div>
                    {oee.missing_fields.length > 0 && (
                      <div>
                        <div className="mb-2 text-xs uppercase tracking-wider text-[var(--muted)]">Missing Fields</div>
                        <div className="flex flex-wrap gap-1">
                          {oee.missing_fields.map((field) => (
                            <span key={field} className="inline-flex rounded-full border border-rose-400/25 bg-rose-500/8 px-2.5 py-1 text-[10px] text-rose-200/80">
                              {field.replace(/_/g, " ")}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <EmptyState message="No OEE readiness data." />
                )}
              </CardContent>
            </Card>

            <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm lg:col-span-2">
              <CardHeader>
                <CardTitle>What&apos;s Possible vs What&apos;s Missing</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/8 p-4">
                    <div className="text-sm font-semibold text-emerald-300">Available Now (Phase 1)</div>
                    <ul className="mt-2 space-y-1 text-xs text-emerald-200/70">
                      <li className="flex items-center gap-1.5"><span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />Shift attainment by shift type</li>
                      <li className="flex items-center gap-1.5"><span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />Daily throughput vs target</li>
                      <li className="flex items-center gap-1.5"><span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />Downtime by reason &amp; department</li>
                      <li className="flex items-center gap-1.5"><span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />Manpower productivity &amp; absenteeism</li>
                      <li className="flex items-center gap-1.5"><span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />Batch loss &amp; severity distribution</li>
                      <li className="flex items-center gap-1.5"><span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />Operator performance by batch loss</li>
                      <li className="flex items-center gap-1.5"><span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />Process loss proxy by conversion pair</li>
                    </ul>
                  </div>
                  <div className="rounded-2xl border border-amber-400/20 bg-amber-500/8 p-4">
                    <div className="text-sm font-semibold text-amber-300">Partial (available but limited)</div>
                    <ul className="mt-2 space-y-1 text-xs text-amber-200/70">
                      <li className="flex items-center gap-1.5"><span className="inline-flex h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />OEE Availability — from entry downtime (not machine runtime)</li>
                      <li className="flex items-center gap-1.5"><span className="inline-flex h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />Quality signal — boolean quality_issues flag (not rejection count)</li>
                    </ul>
                  </div>
                  <div className="rounded-2xl border border-rose-400/20 bg-rose-500/8 p-4">
                    <div className="text-sm font-semibold text-rose-300">Requires Schema Changes (Phase 2)</div>
                    <ul className="mt-2 space-y-1 text-xs text-rose-200/70">
                      <li className="flex items-center gap-1.5"><span className="inline-flex h-1.5 w-1.5 rounded-full bg-rose-400 shrink-0" />Machine-level tracking &amp; utilization</li>
                      <li className="flex items-center gap-1.5"><span className="inline-flex h-1.5 w-1.5 rounded-full bg-rose-400 shrink-0" />Line-level efficiency</li>
                      <li className="flex items-center gap-1.5"><span className="inline-flex h-1.5 w-1.5 rounded-full bg-rose-400 shrink-0" />True rejection, scrap &amp; defect counts</li>
                      <li className="flex items-center gap-1.5"><span className="inline-flex h-1.5 w-1.5 rounded-full bg-rose-400 shrink-0" />True OEE with runtime &amp; ideal rate</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        )}
      </div>
    </main>
  );
}
