"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveScrollArea } from "@/components/ui/responsive-scroll-area";
import { DashboardPageSkeleton } from "@/components/shared/page-skeletons";
import {
  getWorkforceOverview,
  getWorkforceWorkers,
  getWorkforceCostSummary,
  type WorkforceOverview,
  type WorkerSummary,
} from "@/lib/workforce";
import { useSession } from "@/lib/use-session";

// ── Types ──────────────────────────────────────────────────────────────────

type Tab = "overview" | "workers" | "shifts" | "cost";

// ── Helpers ────────────────────────────────────────────────────────────────

function formatNumber(value: number | null | undefined, decimals = 1) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: decimals, minimumFractionDigits: 0 }).format(value || 0);
}

function formatPercent(value: number | null | undefined) {
  if (value == null) return "—";
  return `${value.toFixed(1)}%`;
}

function formatMinutes(value: number | null | undefined) {
  const m = value || 0;
  if (m >= 60) return `${(m / 60).toFixed(1)}h`;
  return `${m.toFixed(0)}m`;
}

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);
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

// ── Main Component ─────────────────────────────────────────────────────────

export function WorkforceIntelligencePage() {
  const { user, activeFactory, loading: sessionLoading } = useSession();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [overview, setOverview] = useState<WorkforceOverview | null>(null);
  const [workers, setWorkers] = useState<WorkerSummary[]>([]);
  const [costData, setCostData] = useState<Record<string, unknown> | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState("");
  const [days, setDays] = useState(30);
  const [sortBy, setSortBy] = useState<string>("worked_minutes");
  const [hasFinancialAccess, setHasFinancialAccess] = useState(false);

  const isSteelFactory = (activeFactory?.industry_type || "").toLowerCase() === "steel";

  const loadData = useCallback(async () => {
    setPageLoading(true);
    setError("");
    try {
      const [overviewData, workersData, costSummary] = await Promise.all([
        getWorkforceOverview(days),
        getWorkforceWorkers(days, sortBy, 100),
        getWorkforceCostSummary(days).catch(() => null),
      ]);
      setOverview(overviewData);
      setWorkers(workersData.workers || []);
      setHasFinancialAccess(workersData.financial_access);
      if (costSummary) {
        setCostData(costSummary as unknown as Record<string, unknown>);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load workforce intelligence.");
    } finally {
      setPageLoading(false);
    }
  }, [days, sortBy]);

  useEffect(() => {
    if (!user) {
      setPageLoading(false);
      return;
    }
    void loadData();
  }, [loadData, user]);

  if (sessionLoading || pageLoading) {
    return <DashboardPageSkeleton />;
  }

  if (!user) {
    return (
      <main className="min-h-screen px-4 py-8 md:px-8 content-fade-in">
        <div className="mx-auto max-w-4xl text-center">
          <Card>
            <CardHeader>
              <CardTitle>Workforce Intelligence</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-[var(--muted)]">
              <div>Please sign in to continue.</div>
              <Link href="/access">
                <Button>Open Access</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  const today = overview?.today;
  const period = overview?.period;
  const shifts = overview?.shift_comparison?.shifts || [];
  const bestShift = overview?.shift_comparison?.best_performing_shift;
  const cost = overview?.cost_summary;

  return (
    <main className="min-h-screen px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <section className="rounded-[2rem] border border-[var(--border)] bg-[linear-gradient(135deg,rgba(20,24,36,0.96),rgba(12,18,28,0.9))] p-6 shadow-2xl backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-sm uppercase tracking-prominent text-[var(--accent)]">Workforce Intelligence</div>
              <h1 className="mt-2 text-3xl font-semibold md:text-4xl">Attendance analytics, worker ranking &amp; labour cost</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                Phase 1 analytics derived from attendance records and employee profiles.
                Productivity scores are estimated (weighted by worked minutes). Cost fields
                visible to financial roles only.
              </p>
            </div>
            <div className="flex gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs text-[var(--muted)]">Period</label>
                <select
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                  className="rounded-xl border border-[var(--border)] bg-[rgba(20,24,36,0.7)] px-3 py-2 text-sm text-white"
                >
                  <option value={7}>7 days</option>
                  <option value={14}>14 days</option>
                  <option value={30}>30 days</option>
                  <option value={60}>60 days</option>
                  <option value={90}>90 days</option>
                </select>
              </div>
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
          <TabButton label={`Workers (${workers.length})`} active={activeTab === "workers"} onClick={() => setActiveTab("workers")} />
          <TabButton label={`Shifts (${shifts.length})`} active={activeTab === "shifts"} onClick={() => setActiveTab("shifts")} />
          {hasFinancialAccess && (
            <TabButton label="Labour Cost" active={activeTab === "cost"} onClick={() => setActiveTab("cost")} />
          )}
        </div>

        {/* ── TAB: Overview ──────────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <>
            {/* Today's KPIs */}
            <section className="grid gap-4 md:grid-cols-4">
              <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                <CardContent className="pt-4">
                  <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Present Today</div>
                  <div className="mt-1 text-2xl font-bold text-emerald-400">{formatNumber(today?.working)}</div>
                  <div className="mt-1 text-xs text-[var(--muted)]">of {formatNumber(today?.total_workers)} total workers</div>
                </CardContent>
              </Card>
              <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                <CardContent className="pt-4">
                  <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Completed</div>
                  <div className="mt-1 text-2xl font-bold text-sky-400">{formatNumber(today?.completed)}</div>
                  <div className="mt-1 text-xs text-[var(--muted)]">Closed attendance</div>
                </CardContent>
              </Card>
              <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                <CardContent className="pt-4">
                  <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Absent</div>
                  <div className="mt-1 text-2xl font-bold text-rose-400">{formatNumber(today?.absent)}</div>
                  <div className="mt-1 text-xs text-[var(--muted)]">Not punched in</div>
                </CardContent>
              </Card>
              <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                <CardContent className="pt-4">
                  <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Overtime Today</div>
                  <div className="mt-1 text-2xl font-bold text-amber-400">{formatMinutes(today?.total_overtime_minutes)}</div>
                  <div className="mt-1 text-xs text-[var(--muted)]">{today?.overtime_earners_count ?? 0} earners</div>
                </CardContent>
              </Card>
            </section>

            {/* Period KPIs */}
            <section className="grid gap-4 md:grid-cols-4">
              <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                <CardContent className="pt-4">
                  <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Worked (period)</div>
                  <div className="mt-1 text-2xl font-bold">{formatNumber(period?.total_worked_hours)}h</div>
                  <div className="mt-1 text-xs text-[var(--muted)]">Avg {formatMinutes(period?.avg_worked_minutes_per_day)}/day</div>
                </CardContent>
              </Card>
              <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                <CardContent className="pt-4">
                  <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Overtime</div>
                  <div className={`mt-1 text-2xl font-bold ${severityColor(period?.total_overtime_hours)}`}>
                    {formatNumber(period?.total_overtime_hours)}h
                  </div>
                  <div className="mt-1 text-xs text-[var(--muted)]">Avg {formatMinutes(period?.avg_overtime_minutes_per_day)}/day</div>
                </CardContent>
              </Card>
              <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                <CardContent className="pt-4">
                  <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Late Hours</div>
                  <div className="mt-1 text-2xl font-bold text-rose-400">{formatNumber(period?.total_late_hours)}h</div>
                  <div className="mt-1 text-xs text-[var(--muted)]">Over {period?.days_punched ?? 0} days tracked</div>
                </CardContent>
              </Card>
              <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                <CardContent className="pt-4">
                  <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Presence Rate</div>
                  <div className={`mt-1 text-2xl font-bold ${(period?.presence_rate_percent ?? 100) >= 90 ? "text-emerald-400" : (period?.presence_rate_percent ?? 0) >= 75 ? "text-amber-400" : "text-rose-400"}`}>
                    {formatPercent(period?.presence_rate_percent)}
                  </div>
                  <div className="mt-1 text-xs text-[var(--muted)]">Attendance adherence</div>
                </CardContent>
              </Card>
            </section>

            {/* Best Performing Shift */}
            {bestShift && (
              <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                <CardHeader>
                  <CardTitle>Best Performing Shift</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between rounded-2xl border border-emerald-400/20 bg-emerald-500/8 p-4">
                    <div>
                      <div className="text-sm font-semibold text-emerald-300 capitalize">{bestShift}</div>
                      <div className="text-xs text-[var(--muted)]">Highest avg worked minutes per shift</div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-emerald-400">{formatMinutes(overview?.shift_comparison?.best_avg_worked_minutes)}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Cost Snapshot (if financial access) */}
            {cost && hasFinancialAccess && (
              <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                <CardHeader>
                  <CardTitle>Labour Cost Snapshot</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-4">
                    <DataChip label="Total Cost" value={formatCurrency(cost.total_cost_inr)} color="text-amber-300" />
                    <DataChip label="Regular Cost" value={formatCurrency(cost.regular_cost_inr)} />
                    <DataChip label="Overtime Cost" value={formatCurrency(cost.overtime_cost_inr)} />
                    <DataChip label="Effective Rate" value={`₹${formatNumber(cost.effective_hourly_rate_inr)}/hr`} />
                  </div>
                  <div className="mt-3 text-xs text-[var(--muted)] italic">{cost.valuation_note}</div>
                </CardContent>
              </Card>
            )}

            {/* Data Confidence Note */}
            <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
              <CardHeader>
                <CardTitle>Data Confidence</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/8 p-4">
                    <div className="text-sm font-semibold text-emerald-300">Available Now (Direct)</div>
                    <ul className="mt-2 space-y-1 text-xs text-emerald-200/70">
                      <li className="flex items-center gap-1.5"><span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />Attendance punch in/out records</li>
                      <li className="flex items-center gap-1.5"><span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />Worked / overtime / late minutes</li>
                      <li className="flex items-center gap-1.5"><span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />Shift-level breakdown</li>
                      <li className="flex items-center gap-1.5"><span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />Cost valuation with configured rates</li>
                    </ul>
                  </div>
                  <div className="rounded-2xl border border-amber-400/20 bg-amber-500/8 p-4">
                    <div className="text-sm font-semibold text-amber-300">Estimated / Inferred</div>
                    <ul className="mt-2 space-y-1 text-xs text-amber-200/70">
                      <li className="flex items-center gap-1.5"><span className="inline-flex h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />Productivity score — estimated from worked minutes</li>
                      <li className="flex items-center gap-1.5"><span className="inline-flex h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />Cost with factory-default rate (accurate per-worker rates improve precision)</li>
                    </ul>
                  </div>
                  <div className="rounded-2xl border border-rose-400/20 bg-rose-500/8 p-4">
                    <div className="text-sm font-semibold text-rose-300">Requires Phase 2</div>
                    <ul className="mt-2 space-y-1 text-xs text-rose-200/70">
                      <li className="flex items-center gap-1.5"><span className="inline-flex h-1.5 w-1.5 rounded-full bg-rose-400 shrink-0" />Per-worker production attribution</li>
                      <li className="flex items-center gap-1.5"><span className="inline-flex h-1.5 w-1.5 rounded-full bg-rose-400 shrink-0" />True best/worst performer ranking</li>
                      <li className="flex items-center gap-1.5"><span className="inline-flex h-1.5 w-1.5 rounded-full bg-rose-400 shrink-0" />Workforce cost vs production output</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* ── TAB: Workers ────────────────────────────────────────────────── */}
        {activeTab === "workers" && (
          <section className="space-y-4">
            {/* Sort Controls */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-[var(--muted)]">Sort by:</span>
              {[
                { key: "worked_minutes", label: "Most Worked" },
                { key: "overtime", label: "Most Overtime" },
                { key: "late", label: "Most Late" },
                { key: "attendance_days", label: "Attendance Days" },
                { key: "name", label: "Name" },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setSortBy(opt.key)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                    sortBy === opt.key
                      ? "border border-[rgba(62,166,255,0.45)] bg-[rgba(62,166,255,0.14)] text-sky-100"
                      : "border border-[var(--border)] bg-[rgba(20,24,36,0.7)] text-[var(--muted)] hover:border-[rgba(62,166,255,0.28)]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Worker Table */}
            <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
              <CardHeader>
                <CardTitle>Worker Attendance &amp; Estimated Productivity</CardTitle>
              </CardHeader>
              <CardContent>
                {workers.length === 0 ? (
                  <EmptyState message="No worker attendance data available for this period." />
                ) : (
                  <ResponsiveScrollArea
                    className="rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)]"
                    debugLabel="workforce-worker-table"
                  >
                    <table className="min-w-full text-left text-sm">
                      <thead className="text-[var(--muted)]">
                        <tr className="border-b border-[var(--border)]">
                          <th className="px-3 py-3 font-medium">Worker</th>
                          <th className="px-3 py-3 font-medium">Dept</th>
                          <th className="px-3 py-3 font-medium">Days</th>
                          <th className="px-3 py-3 font-medium">Worked</th>
                          <th className="px-3 py-3 font-medium">Avg/Day</th>
                          <th className="px-3 py-3 font-medium">Overtime</th>
                          <th className="px-3 py-3 font-medium">Late</th>
                          <th className="px-3 py-3 font-medium">Est. Score</th>
                          {hasFinancialAccess && <th className="px-3 py-3 font-medium">Labour Cost</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {workers.map((w) => (
                          <tr key={w.user_id} className="border-b border-[var(--border)]/60 last:border-none">
                            <td className="px-3 py-3">
                              <div className="font-semibold text-white">{w.name}</div>
                              <div className="text-xs text-[var(--muted)]">{w.role} {w.employee_code ? `· ${w.employee_code}` : ""}</div>
                            </td>
                            <td className="px-3 py-3 text-[var(--muted)]">{w.department || "—"}</td>
                            <td className="px-3 py-3 font-mono text-white">{w.attendance_days}</td>
                            <td className="px-3 py-3 font-mono text-white">{formatMinutes(w.total_worked_minutes)}</td>
                            <td className="px-3 py-3 font-mono text-white">{formatMinutes(w.avg_worked_minutes)}</td>
                            <td className="px-3 py-3">
                              <span className={`font-mono font-semibold ${w.total_overtime_minutes > 0 ? "text-amber-400" : "text-[var(--muted)]"}`}>
                                {formatMinutes(w.total_overtime_minutes)}
                              </span>
                              {w.overtime_days > 0 && (
                                <div className="text-[10px] text-[var(--muted)]">{w.overtime_days}d</div>
                              )}
                            </td>
                            <td className="px-3 py-3">
                              <span className={`font-mono ${w.total_late_minutes > 30 ? "text-rose-400" : "text-[var(--muted)]"}`}>
                                {formatMinutes(w.total_late_minutes)}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <span className="font-mono text-emerald-400">{w.estimated_productivity_score.toFixed(1)}</span>
                            </td>
                            {hasFinancialAccess && (
                              <td className="px-3 py-3 font-mono text-white">
                                {w.total_cost_inr != null ? formatCurrency(w.total_cost_inr) : "—"}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ResponsiveScrollArea>
                )}
              </CardContent>
            </Card>

            {workers.length > 0 && (
              <div className="text-xs text-[var(--muted)] italic">
                Productivity score is estimated from worked minutes. True attribution requires Phase 2 worker-entry mapping.
              </div>
            )}
          </section>
        )}

        {/* ── TAB: Shifts ────────────────────────────────────────────────── */}
        {activeTab === "shifts" && (
          <section className="grid gap-6 lg:grid-cols-2">
            <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm lg:col-span-2">
              <CardHeader>
                <CardTitle>Shift Comparison — Attendance Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                {shifts.length === 0 ? (
                  <EmptyState message="No shift data available for this period." />
                ) : (
                  <ResponsiveScrollArea
                    className="rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)]"
                    debugLabel="workforce-shift-table"
                  >
                    <table className="min-w-full text-left text-sm">
                      <thead className="text-[var(--muted)]">
                        <tr className="border-b border-[var(--border)]">
                          <th className="px-3 py-3 font-medium">Shift</th>
                          <th className="px-3 py-3 font-medium">Records</th>
                          <th className="px-3 py-3 font-medium">Working</th>
                          <th className="px-3 py-3 font-medium">Completed</th>
                          <th className="px-3 py-3 font-medium">Absent</th>
                          <th className="px-3 py-3 font-medium">Worked (h)</th>
                          <th className="px-3 py-3 font-medium">Avg (min)</th>
                          <th className="px-3 py-3 font-medium">Overtime (h)</th>
                          <th className="px-3 py-3 font-medium">Late (h)</th>
                          <th className="px-3 py-3 font-medium">OT Workers</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shifts.map((s) => (
                          <tr key={s.shift} className={`border-b border-[var(--border)]/60 last:border-none ${s.shift === bestShift ? "bg-emerald-500/5" : ""}`}>
                            <td className="px-3 py-3 font-semibold text-white capitalize">{s.shift}</td>
                            <td className="px-3 py-3 font-mono text-white">{s.total_records}</td>
                            <td className="px-3 py-3 font-mono text-emerald-400">{s.working}</td>
                            <td className="px-3 py-3 font-mono text-sky-400">{s.completed}</td>
                            <td className="px-3 py-3 font-mono text-rose-400">{s.absent}</td>
                            <td className="px-3 py-3 font-mono text-white">{formatNumber(s.total_worked_hours)}</td>
                            <td className="px-3 py-3">
                              <span className={`font-mono font-semibold ${s.shift === bestShift ? "text-emerald-400" : "text-white"}`}>
                                {formatMinutes(s.avg_worked_minutes)}
                              </span>
                            </td>
                            <td className="px-3 py-3 font-mono text-amber-400">{formatNumber(s.total_overtime_hours)}</td>
                            <td className="px-3 py-3 font-mono text-rose-400">{formatNumber(s.total_late_hours)}</td>
                            <td className="px-3 py-3 font-mono text-white">{s.overtime_count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ResponsiveScrollArea>
                )}
                {bestShift && shifts.length > 0 && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-emerald-400">
                    <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Best performing shift: <span className="font-semibold capitalize">{bestShift}</span>
                    <span className="text-[var(--muted)]"> — highest avg worked minutes</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        )}

        {/* ── TAB: Labour Cost ────────────────────────────────────────────── */}
        {activeTab === "cost" && hasFinancialAccess && (
          <section className="space-y-6">
            {!cost ? (
              <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                <CardContent className="py-8 text-center text-sm text-[var(--muted)]">
                  Configure cost rates under Settings &gt; Cost Rates to enable labour cost analytics.
                </CardContent>
              </Card>
            ) : (
              <>
                <section className="grid gap-4 md:grid-cols-4">
                  <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                    <CardContent className="pt-4">
                      <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Total Labour Cost</div>
                      <div className="mt-1 text-2xl font-bold text-amber-300">{formatCurrency(cost.total_cost_inr)}</div>
                    </CardContent>
                  </Card>
                  <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                    <CardContent className="pt-4">
                      <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Regular Wages</div>
                      <div className="mt-1 text-2xl font-bold">{formatCurrency(cost.regular_cost_inr)}</div>
                      <div className="mt-1 text-xs text-[var(--muted)]">{formatNumber(cost.total_regular_hours)} regular hours</div>
                    </CardContent>
                  </Card>
                  <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                    <CardContent className="pt-4">
                      <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Overtime Cost</div>
                      <div className="mt-1 text-2xl font-bold text-rose-400">{formatCurrency(cost.overtime_cost_inr)}</div>
                      <div className="mt-1 text-xs text-[var(--muted)]">{formatNumber(cost.total_overtime_hours)} overtime hours</div>
                    </CardContent>
                  </Card>
                  <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                    <CardContent className="pt-4">
                      <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Workers</div>
                      <div className="mt-1 text-2xl font-bold">{cost.worker_count}</div>
                      <div className="mt-1 text-xs text-[var(--muted)]">
                        Rate: ₹{formatNumber(cost.effective_hourly_rate_inr)}/hr × {cost.overtime_multiplier}x OT
                      </div>
                    </CardContent>
                  </Card>
                </section>

                <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                  <CardHeader>
                    <CardTitle>Cost Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] p-3">
                        <div>
                          <div className="text-sm font-semibold text-white">Regular Hours</div>
                          <div className="text-xs text-[var(--muted)]">{formatNumber(cost.total_regular_hours)}h at ₹{formatNumber(cost.effective_hourly_rate_inr)}/hr</div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-white">{formatCurrency(cost.regular_cost_inr)}</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] p-3">
                        <div>
                          <div className="text-sm font-semibold text-white">Overtime Hours</div>
                          <div className="text-xs text-[var(--muted)]">{formatNumber(cost.total_overtime_hours)}h at {cost.overtime_multiplier}x rate</div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-rose-400">{formatCurrency(cost.overtime_cost_inr)}</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between rounded-2xl border border-amber-400/20 bg-amber-500/8 p-3">
                        <div>
                          <div className="text-sm font-semibold text-amber-300">Total Labour Cost</div>
                          <div className="text-xs text-[var(--muted)]">{cost.worker_count} workers · {formatNumber(cost.total_regular_hours + cost.total_overtime_hours)} total hours</div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-amber-300">{formatCurrency(cost.total_cost_inr)}</div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 text-xs text-[var(--muted)] italic">{cost.valuation_note}</div>
                  </CardContent>
                </Card>
              </>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
