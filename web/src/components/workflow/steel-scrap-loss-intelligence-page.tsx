"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveScrollArea } from "@/components/ui/responsive-scroll-area";
import {
  getSteelScrapLossIntelligence,
  type ScrapLossIntelligence,
  type ScrapTrendDay,
  type ScrapMachineItem,
  type ScrapLineItem,
  type ScrapOperatorItem,
  type ScrapShiftItem,
  type ScrapTeamItem,
  type ScrapDriverItem,
} from "@/lib/steel";
import { useSession } from "@/lib/use-session";
import { DashboardPageSkeleton } from "@/components/shared/page-skeletons";

type Tab = "overview" | "trends" | "machines_lines" | "operators_shifts" | "financial" | "drivers_confidence";

function formatNumber(value: number | null | undefined, decimals = 1) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: decimals, minimumFractionDigits: 0 }).format(value || 0);
}

function formatPercent(value: number | null | undefined) {
  if (value == null) return "—";
  return `${value.toFixed(1)}%`;
}

function formatKg(value: number | null | undefined) {
  const v = value || 0;
  if (v >= 1000) return `${(v / 1000).toFixed(2)} T`;
  return `${v.toFixed(1)} KG`;
}

function formatInr(value: number | null | undefined) {
  if (value == null) return "—";
  return `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(Math.round(value))}`;
}

function badgeTone(value: string | null | undefined) {
  if (value === "green" || value === "good" || value === "direct" || value === "available") return "border-emerald-400/35 bg-emerald-400/12 text-emerald-200";
  if (value === "yellow" || value === "warning" || value === "partial" || value === "inferred" || value === "proxy") return "border-amber-400/35 bg-amber-400/12 text-amber-200";
  return "border-rose-400/35 bg-rose-400/12 text-rose-200";
}

function severityColor(value: number | null | undefined) {
  if (value == null) return "text-white";
  if (value > 10) return "text-rose-400";
  if (value > 5) return "text-amber-400";
  return "text-emerald-400";
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
        active
          ? "border border-[rgba(62,166,255,0.45)] bg-[rgba(62,166,255,0.14)] text-sky-100 shadow-[0_0_0_1px_rgba(62,166,255,0.15)]"
          : "border border-[var(--border)] bg-[rgba(20,24,36,0.7)] text-[var(--muted)] hover:border-[rgba(62,166,255,0.28)] hover:bg-[rgba(28,34,51,0.82)]"
      }`}
    >
      {label}
    </button>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--muted)]">
      {message}
    </div>
  );
}

function DataChip({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] p-3">
      <div className="text-xs text-[var(--muted)]">{label}</div>
      <div className={`mt-1 text-lg font-bold ${color || "text-white"}`}>{value}</div>
    </div>
  );
}

function ConfBadge({ status }: { status: boolean | string }) {
  const isOk = typeof status === "string"
    ? status === "available" || status === "direct" || status.startsWith("inferred") || status.startsWith("proxy")
    : status === true;
  const label = typeof status === "string" ? status.replace(/_/g, " ") : status ? "Available" : "Unavailable";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] uppercase tracking-caption ${
      isOk ? "border-emerald-400/35 bg-emerald-400/12 text-emerald-200" : "border-rose-400/35 bg-rose-400/12 text-rose-200"
    }`}>
      {label}
    </span>
  );
}

export function SteelScrapLossIntelligencePage() {
  const { user, activeFactory, loading: sessionLoading } = useSession();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [intel, setIntel] = useState<ScrapLossIntelligence | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState("");

  const isSteelFactory = (activeFactory?.industry_type || "").toLowerCase() === "steel";

  const loadData = useCallback(async () => {
    if (!isSteelFactory) {
      setPageLoading(false);
      return;
    }
    setPageLoading(true);
    setError("");
    try {
      const result = await getSteelScrapLossIntelligence();
      setIntel(result);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load scrap & loss intelligence.");
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
              <CardTitle>Scrap &amp; Loss Intelligence is factory-aware</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-[var(--muted)]">
              <div>Switch into a steel factory from the sidebar to open the scrap &amp; loss cockpit.</div>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  const summary = intel?.summary;
  const trends = intel?.daily_trend || [];
  const byMachine = intel?.by_machine || [];
  const byLine = intel?.by_line || [];
  const byOperator = intel?.by_operator || [];
  const byShift = intel?.by_shift;
  const byTeam = intel?.by_team;
  const financial = intel?.financial_impact;
  const drivers = intel?.increase_drivers;
  const confidence = intel?.data_confidence;

  return (
    <main className="min-h-screen px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <section className="rounded-[2rem] border border-[var(--border)] bg-[linear-gradient(135deg,rgba(20,24,36,0.96),rgba(12,18,28,0.9))] p-6 shadow-2xl backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-sm uppercase tracking-prominent text-[var(--accent)]">Scrap &amp; Loss Intelligence</div>
              <h1 className="mt-2 text-3xl font-semibold md:text-4xl">Waste tracking, cost impact &amp; reduction drivers</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                Phase A+B analytics from batch scrap/rejection fields. Shift and team attribution inferred from operator Entry records.
                Cost fields visible to manager+ roles only.
              </p>
            </div>
            <div className="flex gap-3">
              <Link href="/steel/production/record">
                <Button variant="outline">Record Batch</Button>
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
          <TabButton label={`Machines & Lines (${byMachine.length + byLine.length})`} active={activeTab === "machines_lines"} onClick={() => setActiveTab("machines_lines")} />
          <TabButton label={`Operators & Shifts (${byOperator.length})`} active={activeTab === "operators_shifts"} onClick={() => setActiveTab("operators_shifts")} />
          <TabButton label="Financial Impact" active={activeTab === "financial"} onClick={() => setActiveTab("financial")} />
          <TabButton label="Drivers & Confidence" active={activeTab === "drivers_confidence"} onClick={() => setActiveTab("drivers_confidence")} />
        </div>

        {/* ── TAB 1: Overview ───────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <>
            {/* KPI Summary Cards */}
            <section className="grid gap-4 md:grid-cols-4">
              <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                <CardContent className="pt-4">
                  <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Scrap Today</div>
                  <div className="mt-1 text-2xl font-bold text-rose-300">{formatKg(summary?.total_scrap_today_kg)}</div>
                  <div className="mt-1 text-xs text-[var(--muted)]">{intel?.financial_access ? formatInr(summary?.scrap_cost_today_inr) : "Cost hidden"}</div>
                </CardContent>
              </Card>
              <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                <CardContent className="pt-4">
                  <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Scrap MTD</div>
                  <div className="mt-1 text-2xl font-bold text-amber-300">{formatKg(summary?.total_scrap_mtd_kg)}</div>
                  <div className="mt-1 text-xs text-[var(--muted)]">{intel?.financial_access ? formatInr(summary?.scrap_cost_mtd_inr) : "Cost hidden"}</div>
                </CardContent>
              </Card>
              <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                <CardContent className="pt-4">
                  <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Period Scrap</div>
                  <div className="mt-1 text-2xl font-bold">{formatKg(summary?.total_scrap_period_kg)}</div>
                  <div className="mt-1 text-xs text-[var(--muted)]">{formatNumber(summary?.total_scrap_batch_count)} scrap batches</div>
                </CardContent>
              </Card>
              <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                <CardContent className="pt-4">
                  <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Scrap Rate</div>
                  <div className={`mt-1 text-2xl font-bold ${severityColor(summary?.scrap_rate_percent)}`}>
                    {formatPercent(summary?.scrap_rate_percent)}
                  </div>
                  <div className="mt-1 text-xs text-[var(--muted)]">Rejection: {formatKg(summary?.total_rejection_period_kg)}</div>
                </CardContent>
              </Card>
            </section>

            {/* Highest Contributors */}  
            <section className="grid gap-6 lg:grid-cols-3">
              <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                <CardHeader>
                  <CardTitle>Highest Scrap Machine</CardTitle>
                </CardHeader>
                <CardContent>
                  {summary?.highest_scrap_machine_kg ? (
                    <div>
                      <div className="text-3xl font-bold text-rose-400">{formatKg(summary.highest_scrap_machine_kg)}</div>
                    </div>
                  ) : (
                    <EmptyState message="No machine data." />
                  )}
                </CardContent>
              </Card>
              <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                <CardHeader>
                  <CardTitle>Highest Scrap Line</CardTitle>
                </CardHeader>
                <CardContent>
                  {summary?.highest_scrap_line_kg ? (
                    <div>
                      <div className="text-3xl font-bold text-amber-400">{formatKg(summary.highest_scrap_line_kg)}</div>
                    </div>
                  ) : (
                    <EmptyState message="No line data." />
                  )}
                </CardContent>
              </Card>
              <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                <CardHeader>
                  <CardTitle>Highest Scrap Operator</CardTitle>
                </CardHeader>
                <CardContent>
                  {summary?.highest_scrap_operator_kg ? (
                    <div>
                      <div className="text-3xl font-bold text-rose-400">{formatKg(summary.highest_scrap_operator_kg)}</div>
                    </div>
                  ) : (
                    <EmptyState message="No operator data." />
                  )}
                </CardContent>
              </Card>
            </section>

            {/* Data Quality Overview */}  
            <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
              <CardHeader>
                <CardTitle>Data Quality &amp; Attribution Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] p-3">
                    <span className="text-sm font-semibold text-white">Batch Data</span>
                    <ConfBadge status={summary?.data_quality === "direct" || summary?.data_quality === "none_recorded"} />
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] p-3">
                    <span className="text-sm font-semibold text-white">Shift Attribution</span>
                    <ConfBadge status={confidence?.shift_attribution || "unavailable"} />
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] p-3">
                    <span className="text-sm font-semibold text-white">Team Attribution</span>
                    <ConfBadge status={confidence?.team_attribution || "unavailable"} />
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] p-3">
                    <span className="text-sm font-semibold text-white">Financial Valuation</span>
                    <ConfBadge status={confidence?.financial_valuation || "no_data"} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* ── TAB 2: Trends ─────────────────────────────────────────────── */}
        {activeTab === "trends" && (
          <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
            <CardHeader>
              <CardTitle>Daily Scrap, Rejection &amp; Loss Trend</CardTitle>
            </CardHeader>
            <CardContent>
              {trends.length === 0 ? (
                <EmptyState message="No scrap data available for this period." />
              ) : (
                <ResponsiveScrollArea
                  className="rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)]"
                  debugLabel="scrap-trend-table"
                >
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-[var(--muted)]">
                      <tr className="border-b border-[var(--border)]">
                        <th className="px-3 py-3 font-medium">Date</th>
                        <th className="px-3 py-3 font-medium">Output KG</th>
                        <th className="px-3 py-3 font-medium">Scrap KG</th>
                        <th className="px-3 py-3 font-medium">Scrap Rate</th>
                        <th className="px-3 py-3 font-medium">Rejection KG</th>
                        <th className="px-3 py-3 font-medium">Loss KG</th>
                        <th className="px-3 py-3 font-medium">Scrap Cost</th>
                        <th className="px-3 py-3 font-medium">Batches</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trends.map((d: ScrapTrendDay) => (
                        <tr key={d.date} className="border-b border-[var(--border)]/60 last:border-none">
                          <td className="px-3 py-3 font-semibold text-white">{d.date}</td>
                          <td className="px-3 py-3 font-mono text-white">{formatNumber(d.output_kg, 1)}</td>
                          <td className="px-3 py-3">
                            <span className={`font-mono font-semibold ${d.scrap_kg > 0 ? "text-rose-400" : "text-[var(--muted)]"}`}>
                              {formatNumber(d.scrap_kg, 1)}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <span className={`font-semibold ${severityColor(d.scrap_rate_percent)}`}>
                              {d.scrap_rate_percent != null ? formatPercent(d.scrap_rate_percent) : "—"}
                            </span>
                          </td>
                          <td className="px-3 py-3 font-mono text-[var(--muted)]">{formatNumber(d.rejection_kg, 1)}</td>
                          <td className="px-3 py-3 font-mono text-amber-300">{formatNumber(d.loss_kg, 1)}</td>
                          <td className="px-3 py-3 font-mono text-white">
                            {intel?.financial_access ? formatInr(d.scrap_cost_inr) : "—"}
                          </td>
                          <td className="px-3 py-3 text-[var(--muted)]">{d.batch_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ResponsiveScrollArea>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── TAB 3: Machines & Lines ───────────────────────────────────── */}
        {activeTab === "machines_lines" && (
          <section className="grid gap-6 lg:grid-cols-2">
            {/* By Machine */}
            <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
              <CardHeader>
                <CardTitle>Scrap by Machine</CardTitle>
              </CardHeader>
              <CardContent>
                {byMachine.length === 0 ? (
                  <EmptyState message="Assign machine_id on batches to enable machine-level scrap tracking." />
                ) : (
                  <ResponsiveScrollArea
                    className="rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)]"
                    debugLabel="scrap-machine-table"
                  >
                    <table className="min-w-full text-left text-sm">
                      <thead className="text-[var(--muted)]">
                        <tr className="border-b border-[var(--border)]">
                          <th className="px-3 py-3 font-medium">Machine</th>
                          <th className="px-3 py-3 font-medium">Batches</th>
                          <th className="px-3 py-3 font-medium">Scrap KG</th>
                          <th className="px-3 py-3 font-medium">Scrap Rate</th>
                          <th className="px-3 py-3 font-medium">Rejection KG</th>
                          <th className="px-3 py-3 font-medium">Output KG</th>
                          {intel?.financial_access && <th className="px-3 py-3 font-medium">Cost</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {byMachine.map((m: ScrapMachineItem) => (
                          <tr key={m.machine_id} className="border-b border-[var(--border)]/60 last:border-none">
                            <td className="px-3 py-3 font-semibold text-white">{m.machine_name}</td>
                            <td className="px-3 py-3 text-[var(--muted)]">{m.batch_count}</td>
                            <td className="px-3 py-3 font-mono text-rose-400">{formatNumber(m.scrap_kg, 1)}</td>
                            <td className="px-3 py-3">
                              <span className={`font-semibold ${severityColor(m.scrap_rate_percent)}`}>
                                {formatPercent(m.scrap_rate_percent)}
                              </span>
                            </td>
                            <td className="px-3 py-3 font-mono text-[var(--muted)]">{formatNumber(m.rejection_kg, 1)}</td>
                            <td className="px-3 py-3 font-mono text-white">{formatNumber(m.output_kg, 1)}</td>
                            {intel?.financial_access && (
                              <td className="px-3 py-3 font-mono text-white">{formatInr(m.scrap_cost_inr)}</td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ResponsiveScrollArea>
                )}
              </CardContent>
            </Card>

            {/* By Line */}
            <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
              <CardHeader>
                <CardTitle>Scrap by Line</CardTitle>
              </CardHeader>
              <CardContent>
                {byLine.length === 0 ? (
                  <EmptyState message="Assign line_id on batches to enable line-level scrap tracking." />
                ) : (
                  <ResponsiveScrollArea
                    className="rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)]"
                    debugLabel="scrap-line-table"
                  >
                    <table className="min-w-full text-left text-sm">
                      <thead className="text-[var(--muted)]">
                        <tr className="border-b border-[var(--border)]">
                          <th className="px-3 py-3 font-medium">Line</th>
                          <th className="px-3 py-3 font-medium">Batches</th>
                          <th className="px-3 py-3 font-medium">Scrap KG</th>
                          <th className="px-3 py-3 font-medium">Scrap Rate</th>
                          <th className="px-3 py-3 font-medium">Rejection KG</th>
                          <th className="px-3 py-3 font-medium">Output KG</th>
                          {intel?.financial_access && <th className="px-3 py-3 font-medium">Cost</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {byLine.map((l: ScrapLineItem) => (
                          <tr key={l.line_id} className="border-b border-[var(--border)]/60 last:border-none">
                            <td className="px-3 py-3 font-semibold text-white">{l.line_name}</td>
                            <td className="px-3 py-3 text-[var(--muted)]">{l.batch_count}</td>
                            <td className="px-3 py-3 font-mono text-rose-400">{formatNumber(l.scrap_kg, 1)}</td>
                            <td className="px-3 py-3">
                              <span className={`font-semibold ${severityColor(l.scrap_rate_percent)}`}>
                                {formatPercent(l.scrap_rate_percent)}
                              </span>
                            </td>
                            <td className="px-3 py-3 font-mono text-[var(--muted)]">{formatNumber(l.rejection_kg, 1)}</td>
                            <td className="px-3 py-3 font-mono text-white">{formatNumber(l.output_kg, 1)}</td>
                            {intel?.financial_access && (
                              <td className="px-3 py-3 font-mono text-white">{formatInr(l.scrap_cost_inr)}</td>
                            )}
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

        {/* ── TAB 4: Operators & Shifts ─────────────────────────────────── */}
        {activeTab === "operators_shifts" && (
          <section className="space-y-6">
            {/* By Operator */}
            <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
              <CardHeader>
                <CardTitle>Scrap by Operator</CardTitle>
              </CardHeader>
              <CardContent>
                {byOperator.length === 0 ? (
                  <EmptyState message="Assign operator_user_id on batches to enable operator-level scrap tracking." />
                ) : (
                  <ResponsiveScrollArea
                    className="rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)]"
                    debugLabel="scrap-operator-table"
                  >
                    <table className="min-w-full text-left text-sm">
                      <thead className="text-[var(--muted)]">
                        <tr className="border-b border-[var(--border)]">
                          <th className="px-3 py-3 font-medium">Operator</th>
                          <th className="px-3 py-3 font-medium">Batches</th>
                          <th className="px-3 py-3 font-medium">Scrap KG</th>
                          <th className="px-3 py-3 font-medium">Scrap Rate</th>
                          <th className="px-3 py-3 font-medium">Rejection KG</th>
                          <th className="px-3 py-3 font-medium">Output KG</th>
                          {intel?.financial_access && <th className="px-3 py-3 font-medium">Cost</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {byOperator.map((o: ScrapOperatorItem) => (
                          <tr key={o.user_id} className="border-b border-[var(--border)]/60 last:border-none">
                            <td className="px-3 py-3 font-semibold text-white">{o.name}</td>
                            <td className="px-3 py-3 text-[var(--muted)]">{o.batch_count}</td>
                            <td className="px-3 py-3 font-mono text-rose-400">{formatNumber(o.scrap_kg, 1)}</td>
                            <td className="px-3 py-3">
                              <span className={`font-semibold ${severityColor(o.scrap_rate_percent)}`}>
                                {formatPercent(o.scrap_rate_percent)}
                              </span>
                            </td>
                            <td className="px-3 py-3 font-mono text-[var(--muted)]">{formatNumber(o.rejection_kg, 1)}</td>
                            <td className="px-3 py-3 font-mono text-white">{formatNumber(o.output_kg, 1)}</td>
                            {intel?.financial_access && (
                              <td className="px-3 py-3 font-mono text-white">{formatInr(o.scrap_cost_inr)}</td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ResponsiveScrollArea>
                )}
              </CardContent>
            </Card>

            {/* By Shift (inferred) + By Team (proxy) */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                <CardHeader>
                  <CardTitle>Scrap by Shift (inferred)</CardTitle>
                </CardHeader>
                <CardContent>
                  {byShift && byShift.by_shift.length > 0 ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] px-3 py-2 text-xs text-[var(--muted)]">
                        <span>Coverage: {(byShift.coverage_percent || 0).toFixed(0)}% of operator batches</span>
                        <span>{byShift.ambiguous_count || 0} ambiguous</span>
                      </div>
                      {byShift.by_shift.map((s: ScrapShiftItem) => (
                        <div key={s.shift} className="flex items-center justify-between border-b border-[var(--border)]/60 pb-3 last:border-none last:pb-0">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-white capitalize">{s.shift}</div>
                            <div className="text-xs text-[var(--muted)]">{s.batch_count} batches</div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-rose-400">{formatKg(s.scrap_kg)}</div>
                            <div className={`text-xs ${severityColor(s.scrap_rate_percent)}`}>
                              {formatPercent(s.scrap_rate_percent)}
                            </div>
                          </div>
                        </div>
                      ))}
                      <div className="text-xs text-[var(--muted)] italic">{byShift.note}</div>
                    </div>
                  ) : (
                    <EmptyState message="No shift attribution available. Requires operator entries." />
                  )}
                </CardContent>
              </Card>

              <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                <CardHeader>
                  <CardTitle>Scrap by Team / Department (proxy)</CardTitle>
                </CardHeader>
                <CardContent>
                  {byTeam && byTeam.by_team.length > 0 ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] px-3 py-2 text-xs text-[var(--muted)]">
                        <span>Coverage: {(byTeam.coverage_percent || 0).toFixed(0)}% of operator batches</span>
                      </div>
                      {byTeam.by_team.map((t: ScrapTeamItem) => (
                        <div key={t.department} className="flex items-center justify-between border-b border-[var(--border)]/60 pb-3 last:border-none last:pb-0">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-white">{t.department}</div>
                            <div className="text-xs text-[var(--muted)]">{t.batch_count} batches</div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-amber-400">{formatKg(t.scrap_kg)}</div>
                            <div className={`text-xs ${severityColor(t.scrap_rate_percent)}`}>
                              {formatPercent(t.scrap_rate_percent)}
                            </div>
                          </div>
                        </div>
                      ))}
                      <div className="text-xs text-[var(--muted)] italic">{byTeam.note}</div>
                    </div>
                  ) : (
                    <EmptyState message="No team attribution available. Requires department data on entries." />
                  )}
                </CardContent>
              </Card>
            </div>
          </section>
        )}

        {/* ── TAB 5: Financial Impact ───────────────────────────────────── */}
        {activeTab === "financial" && (
          <section className="space-y-6">
            {!intel?.financial_access ? (
              <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                <CardContent className="py-8 text-center text-sm text-[var(--muted)]">
                  Financial data is restricted. Contact a manager or admin to request access.
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Cost KPIs */}
                <section className="grid gap-4 md:grid-cols-4">
                  <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                    <CardContent className="pt-4">
                      <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Total Scrap Cost</div>
                      <div className="mt-1 text-2xl font-bold text-rose-300">{formatInr(financial?.total_scrap_cost_inr)}</div>
                    </CardContent>
                  </Card>
                  <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                    <CardContent className="pt-4">
                      <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Today's Cost</div>
                      <div className="mt-1 text-2xl font-bold text-amber-300">{formatInr(financial?.today_scrap_cost_inr)}</div>
                    </CardContent>
                  </Card>
                  <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                    <CardContent className="pt-4">
                      <div className="text-xs uppercase tracking-wider text-[var(--muted)]">MTD Cost</div>
                      <div className="mt-1 text-2xl font-bold">{formatInr(financial?.mtd_scrap_cost_inr)}</div>
                    </CardContent>
                  </Card>
                  <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                    <CardContent className="pt-4">
                      <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Valuation Mode</div>
                      <div className="mt-1 text-lg font-bold text-white">{financial?.valuation_mode || "—"}</div>
                      <div className="mt-1 text-xs text-[var(--muted)]">Based on current output item rate</div>
                    </CardContent>
                  </Card>
                </section>

                {/* Top Cost Entities */}
                <div className="grid gap-6 lg:grid-cols-2">
                  <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                    <CardHeader>
                      <CardTitle>Top Cost Machines</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {financial && financial.top_cost_machines.length > 0 ? (
                        <div className="space-y-2">
                          {financial.top_cost_machines.map((m, i) => (
                            <div key={`mc-${i}`} className="flex items-center justify-between border-b border-[var(--border)]/60 pb-2 last:border-none last:pb-0">
                              <div className="text-sm font-semibold text-white">{m.entity}</div>
                              <div className="font-mono text-rose-300">{formatInr(m.scrap_cost_inr)}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <EmptyState message="No machine cost data." />
                      )}
                    </CardContent>
                  </Card>
                  <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                    <CardHeader>
                      <CardTitle>Top Cost Lines</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {financial && financial.top_cost_lines.length > 0 ? (
                        <div className="space-y-2">
                          {financial.top_cost_lines.map((l, i) => (
                            <div key={`lc-${i}`} className="flex items-center justify-between border-b border-[var(--border)]/60 pb-2 last:border-none last:pb-0">
                              <div className="text-sm font-semibold text-white">{l.entity}</div>
                              <div className="font-mono text-amber-300">{formatInr(l.scrap_cost_inr)}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <EmptyState message="No line cost data." />
                      )}
                    </CardContent>
                  </Card>
                  <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                    <CardHeader>
                      <CardTitle>Top Cost Operators</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {financial && financial.top_cost_operators.length > 0 ? (
                        <div className="space-y-2">
                          {financial.top_cost_operators.map((o, i) => (
                            <div key={`oc-${i}`} className="flex items-center justify-between border-b border-[var(--border)]/60 pb-2 last:border-none last:pb-0">
                              <div className="text-sm font-semibold text-white">{o.entity}</div>
                              <div className="font-mono text-rose-300">{formatInr(o.scrap_cost_inr)}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <EmptyState message="No operator cost data." />
                      )}
                    </CardContent>
                  </Card>
                  <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                    <CardHeader>
                      <CardTitle>Top Cost Processes</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {financial && financial.top_cost_processes.length > 0 ? (
                        <div className="space-y-2">
                          {financial.top_cost_processes.map((p, i) => (
                            <div key={`pc-${i}`} className="flex items-center justify-between border-b border-[var(--border)]/60 pb-2 last:border-none last:pb-0">
                              <div className="min-w-0 text-sm font-semibold text-white">{p.entity}</div>
                              <div className="font-mono text-amber-300 whitespace-nowrap">{formatInr(p.scrap_cost_inr)}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <EmptyState message="No process cost data." />
                      )}
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </section>
        )}

        {/* ── TAB 6: Drivers & Confidence ───────────────────────────────── */}
        {activeTab === "drivers_confidence" && (
          <section className="space-y-6">
            {/* Increase Drivers */}
            <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
              <CardHeader>
                <CardTitle>Scrap Increase Drivers</CardTitle>
              </CardHeader>
              <CardContent>
                {drivers && drivers.top_drivers.length > 0 ? (
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                      <DataChip
                        label="Current Period"
                        value={`${drivers.current_period_days}d`}
                      />
                      <DataChip
                        label="Baseline Period"
                        value={`${drivers.baseline_period_days}d`}
                      />
                      <DataChip
                        label="Total Change"
                        value={`${drivers.total_scrap_delta_kg >= 0 ? "+" : ""}${formatNumber(drivers.total_scrap_delta_kg, 1)} KG`}
                        color={drivers.total_scrap_delta_kg > 0 ? "text-rose-400" : "text-emerald-400"}
                      />
                    </div>
                    <ResponsiveScrollArea
                      className="rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)]"
                      debugLabel="scrap-drivers-table"
                    >
                      <table className="min-w-full text-left text-sm">
                        <thead className="text-[var(--muted)]">
                          <tr className="border-b border-[var(--border)]">
                            <th className="px-3 py-3 font-medium">Dimension</th>
                            <th className="px-3 py-3 font-medium">Entity</th>
                            <th className="px-3 py-3 font-medium">Current KG</th>
                            <th className="px-3 py-3 font-medium">Baseline KG</th>
                            <th className="px-3 py-3 font-medium">Delta KG</th>
                            <th className="px-3 py-3 font-medium">Delta %</th>
                            <th className="px-3 py-3 font-medium">Confidence</th>
                          </tr>
                        </thead>
                        <tbody>
                          {drivers.top_drivers.map((d: ScrapDriverItem, i: number) => (
                            <tr key={`driver-${d.dimension}-${d.entity_key}-${i}`} className="border-b border-[var(--border)]/60 last:border-none">
                              <td className="px-3 py-3 font-semibold text-white capitalize">{d.dimension}</td>
                              <td className="px-3 py-3 text-[var(--muted)]">{d.entity_label}</td>
                              <td className="px-3 py-3 font-mono text-white">{formatNumber(d.current_scrap_kg, 1)}</td>
                              <td className="px-3 py-3 font-mono text-[var(--muted)]">{formatNumber(d.baseline_scrap_kg, 1)}</td>
                              <td className={`px-3 py-3 font-mono font-semibold ${d.delta_kg > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                                {d.delta_kg > 0 ? "+" : ""}{formatNumber(d.delta_kg, 1)}
                              </td>
                              <td className="px-3 py-3">
                                <span className={`font-semibold ${(d.delta_percent ?? 0) > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                                  {d.delta_percent != null ? `${d.delta_percent > 0 ? "+" : ""}${formatPercent(d.delta_percent)}` : "—"}
                                </span>
                              </td>
                              <td className="px-3 py-3">
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] uppercase tracking-caption ${d.confidence === "direct" ? "border-emerald-400/35 bg-emerald-400/12 text-emerald-200" : "border-amber-400/35 bg-amber-400/12 text-amber-200"}`}>
                                  {d.confidence}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </ResponsiveScrollArea>
                    <div className="flex items-center gap-1 text-xs text-[var(--muted)]">
                      <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" /> Direct batch field
                      <span className="ml-3 inline-flex h-1.5 w-1.5 rounded-full bg-amber-400" /> Inferred / proxy
                    </div>
                  </div>
                ) : (
                  <EmptyState message="No baseline comparison data available. Try again when more data is recorded." />
                )}
              </CardContent>
            </Card>

            {/* Data Confidence Report */}
            <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
              <CardHeader>
                <CardTitle>Data Confidence Report</CardTitle>
              </CardHeader>
              <CardContent>
                {confidence ? (
                  <div className="grid gap-6 lg:grid-cols-2">
                    <div className="space-y-2">
                      {[
                        ["Batch Scrap Tracking", confidence.batch_scrap_tracking],
                        ["Batch Rejection Tracking", confidence.batch_rejection_tracking],
                        ["Machine Tracking", confidence.machine_tracking],
                        ["Line Tracking", confidence.line_tracking],
                        ["Operator Tracking", confidence.operator_tracking],
                      ].map(([label, val]) => (
                        <div key={String(label)} className="flex items-center justify-between border-b border-[var(--border)]/60 pb-2 last:border-none last:pb-0">
                          <div className="text-sm font-semibold text-white">{String(label)}</div>
                          <ConfBadge status={!!val} />
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2">
                      {[
                        ["Shift Attribution", confidence.shift_attribution],
                        ["Team Attribution", confidence.team_attribution],
                        ["Financial Valuation", confidence.financial_valuation],
                      ].map(([label, val]) => (
                        <div key={String(label)} className="flex items-center justify-between border-b border-[var(--border)]/60 pb-2 last:border-none last:pb-0">
                          <div className="text-sm font-semibold text-white">{String(label)}</div>
                          <ConfBadge status={String(val)} />
                        </div>
                      ))}
                      {confidence.missing_fields.length > 0 && (
                        <div className="pt-3">
                          <div className="mb-2 text-xs uppercase tracking-wider text-[var(--muted)]">Missing Fields</div>
                          <div className="flex flex-wrap gap-1">
                            {confidence.missing_fields.map((field) => (
                              <span key={field} className="inline-flex rounded-full border border-rose-400/25 bg-rose-500/8 px-2.5 py-1 text-[10px] text-rose-200/80">
                                {field.replace(/_/g, " ")}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <EmptyState message="No confidence data available." />
                )}
              </CardContent>
            </Card>

            {/* What's Possible vs Missing */}
            <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
              <CardHeader>
                <CardTitle>What's Available vs What's Missing</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/8 p-4">
                    <div className="text-sm font-semibold text-emerald-300">Available Now (Direct)</div>
                    <ul className="mt-2 space-y-1 text-xs text-emerald-200/70">
                      <li className="flex items-center gap-1.5"><span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />Scrap &amp; rejection tracking per batch</li>
                      <li className="flex items-center gap-1.5"><span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />Scrap by machine, line, operator</li>
                      <li className="flex items-center gap-1.5"><span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />Scrap by conversion pair (process proxy)</li>
                      <li className="flex items-center gap-1.5"><span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />Financial impact with cost valuation</li>
                      <li className="flex items-center gap-1.5"><span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />Period-over-period increase drivers</li>
                    </ul>
                  </div>
                  <div className="rounded-2xl border border-amber-400/20 bg-amber-500/8 p-4">
                    <div className="text-sm font-semibold text-amber-300">Inferred / Proxy</div>
                    <ul className="mt-2 space-y-1 text-xs text-amber-200/70">
                      <li className="flex items-center gap-1.5"><span className="inline-flex h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />Shift attribution — from Entry records ({confidence?.shift_attribution || "N/A"})</li>
                      <li className="flex items-center gap-1.5"><span className="inline-flex h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />Team/department attribution — proxied from Entry ({confidence?.team_attribution || "N/A"})</li>
                    </ul>
                  </div>
                  <div className="rounded-2xl border border-rose-400/20 bg-rose-500/8 p-4">
                    <div className="text-sm font-semibold text-rose-300">Requires Schema Changes</div>
                    <ul className="mt-2 space-y-1 text-xs text-rose-200/70">
                      <li className="flex items-center gap-1.5"><span className="inline-flex h-1.5 w-1.5 rounded-full bg-rose-400 shrink-0" />Batch-level shift &amp; team fields</li>
                      <li className="flex items-center gap-1.5"><span className="inline-flex h-1.5 w-1.5 rounded-full bg-rose-400 shrink-0" />Scrap reason / defect codes</li>
                      <li className="flex items-center gap-1.5"><span className="inline-flex h-1.5 w-1.5 rounded-full bg-rose-400 shrink-0" />Historical rate snapshots for accurate costing</li>
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
