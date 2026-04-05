"use client";

import { useMemo } from "react";

import type { ReportInsights } from "@/lib/reports";
import type { SteelOverview } from "@/lib/steel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function formatDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function formatWeekLabel(start: string, end: string) {
  return `${formatDate(start)} - ${formatDate(end)}`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}

function formatCurrency(value: number | null | undefined) {
  if (value == null) return "Restricted";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function clampPercent(value: number, fallback = 4) {
  return `${Math.max(fallback, Math.min(100, Number.isFinite(value) ? value : 0))}%`;
}

function severityTone(score: number) {
  if (score >= 80) return "text-red-300";
  if (score >= 55) return "text-amber-300";
  return "text-emerald-300";
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--card-strong)] p-4">
      <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-[var(--text)]">{value}</div>
      <div className="mt-2 text-xs leading-5 text-[var(--muted)]">{hint}</div>
    </div>
  );
}

function EmptyCard({ title, message }: { title: string; message: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">{message}</div>
      </CardContent>
    </Card>
  );
}

export default function ReportInsightsBoard({
  insights,
  loading,
  role,
  steelOverview,
}: {
  insights: ReportInsights | null;
  loading: boolean;
  role?: string;
  steelOverview?: SteelOverview | null;
}) {
  const canSeeCharts = Boolean(role && ["supervisor", "manager", "admin", "owner"].includes(role));

  const maxDailyUnits = useMemo(
    () => Math.max(...(insights?.daily_series.map((point) => Math.max(point.units_produced, point.units_target)) || [1])),
    [insights],
  );
  const maxEmployeeUnits = useMemo(
    () => Math.max(...(insights?.employee_leaderboard.map((row) => row.units_produced) || [1])),
    [insights],
  );
  const maxSupportScore = useMemo(
    () => Math.max(...(insights?.support_signals.map((row) => row.attention_score) || [1])),
    [insights],
  );
  const maxTrendPerformance = useMemo(() => {
    const values =
      insights?.employee_trend.flatMap((row) => row.points.map((point) => point.performance_percent)) || [1];
    return Math.max(...values, 1);
  }, [insights]);

  if (!canSeeCharts) {
    return (
      <EmptyCard
        title="Manager Reporting Board"
        message="Chart-heavy performance reporting is available to supervisors, managers, admins, and owners so leadership can compare output, downtime, and team delivery clearly."
      />
    );
  }

  if (loading && !insights) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Manager Reporting Board</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-28 w-full" />
            ))}
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <Skeleton className="h-80 w-full" />
            <Skeleton className="h-80 w-full" />
          </div>
          <Skeleton className="h-96 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!insights) {
    return (
      <EmptyCard
        title="Manager Reporting Board"
        message="We could not build the reporting charts right now. The export tools still work, and we can reload the insights once the backend responds."
      />
    );
  }

  return (
    <section className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm uppercase tracking-[0.28em] text-[var(--accent)]">Charts & Rankings</div>
              <CardTitle className="mt-2 text-2xl">Manager Reporting Board</CardTitle>
            </div>
            <div className="max-w-md text-right text-sm text-[var(--muted)]">
              This board converts the selected report range into visual production, downtime, weekly winner, and support charts so the manager or boss can read the situation fast.
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Units Produced"
              value={formatNumber(insights.totals.total_units_produced)}
              hint={`${formatNumber(insights.totals.total_units_target)} target across ${insights.totals.entry_count} reports.`}
            />
            <MetricCard
              label="Performance"
              value={`${insights.totals.performance_percent.toFixed(1)}%`}
              hint={`Attendance held at ${insights.totals.attendance_percent.toFixed(1)}% in the same window.`}
            />
            <MetricCard
              label="Downtime"
              value={`${formatNumber(insights.totals.total_downtime_minutes)} min`}
              hint={`${formatNumber(insights.totals.quality_issue_entries)} entries flagged with quality issues.`}
            />
            <MetricCard
              label="Active Team"
              value={formatNumber(insights.totals.active_people)}
              hint={`${insights.range.days} day window from ${formatDate(insights.range.start_date)} to ${formatDate(insights.range.end_date)}.`}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-[1.75rem] border border-[var(--border)] bg-[rgba(12,16,26,0.72)] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Production vs Target</div>
                  <div className="mt-1 text-lg font-semibold">Daily output chart</div>
                </div>
                <div className="text-xs text-[var(--muted)]">Bars compare actual output to target for each day.</div>
              </div>
              <div className="mt-6 grid grid-cols-7 gap-3 md:grid-cols-10 xl:grid-cols-14">
                {insights.daily_series.slice(-14).map((point) => (
                  <div key={point.date} className="space-y-2 text-center">
                    <div className="flex h-44 items-end justify-center gap-1 rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-3">
                      <div
                        className="w-full rounded-full bg-[linear-gradient(180deg,#3ea6ff,#60a5fa)]"
                        style={{ height: clampPercent((point.units_target / maxDailyUnits) * 100) }}
                        title={`Target: ${point.units_target}`}
                      />
                      <div
                        className="w-full rounded-full bg-[linear-gradient(180deg,#2dd4bf,#10b981)]"
                        style={{ height: clampPercent((point.units_produced / maxDailyUnits) * 100) }}
                        title={`Produced: ${point.units_produced}`}
                      />
                    </div>
                    <div className="text-[11px] text-[var(--muted)]">{formatDate(point.date)}</div>
                    <div className="text-xs font-semibold text-[var(--text)]">{point.performance_percent.toFixed(0)}%</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-[var(--border)] bg-[rgba(12,16,26,0.72)] p-5">
              <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Shift Mix</div>
              <div className="mt-1 text-lg font-semibold">Which shift delivered strongest</div>
              <div className="mt-5 space-y-4">
                {insights.shift_breakdown.map((shift) => (
                  <div key={shift.shift} className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="text-sm font-semibold capitalize text-[var(--text)]">{shift.shift}</div>
                      <div className="text-sm text-[var(--muted)]">{shift.performance_percent.toFixed(1)}%</div>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-[linear-gradient(90deg,#60a5fa,#2dd4bf)]" style={{ width: clampPercent(shift.performance_percent) }} />
                    </div>
                    <div className="mt-3 flex flex-wrap justify-between gap-3 text-xs text-[var(--muted)]">
                      <span>{formatNumber(shift.units_produced)} units</span>
                      <span>{formatNumber(shift.downtime_minutes)} min downtime</span>
                      <span>{formatNumber(shift.entry_count)} reports</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-[1.75rem] border border-[var(--border)] bg-[rgba(12,16,26,0.72)] p-5">
              <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Employee Output</div>
              <div className="mt-1 text-lg font-semibold">Who carried the best production load</div>
              <div className="mt-5 space-y-3">
                {insights.employee_leaderboard.map((employee, index) => (
                  <div key={employee.user_id} className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">#{index + 1}</div>
                        <div className="mt-1 text-base font-semibold text-[var(--text)]">{employee.name}</div>
                      </div>
                      <div className="text-right text-sm text-[var(--muted)]">
                        <div>{employee.performance_percent.toFixed(1)}%</div>
                        <div>{formatNumber(employee.units_produced)} units</div>
                      </div>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-[linear-gradient(90deg,#22c55e,#2dd4bf)]" style={{ width: clampPercent((employee.units_produced / maxEmployeeUnits) * 100) }} />
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-[var(--muted)] md:grid-cols-4">
                      <span>{formatNumber(employee.entries_count)} reports</span>
                      <span>{formatNumber(employee.downtime_minutes)} min downtime</span>
                      <span>{formatNumber(employee.quality_issue_entries)} quality flags</span>
                      <span>{employee.attendance_percent?.toFixed(1) ?? "0.0"}% attendance</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-[var(--border)] bg-[rgba(12,16,26,0.72)] p-5">
              <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Support Signals</div>
              <div className="mt-1 text-lg font-semibold">Who may need tightening or support</div>
              <div className="mt-5 space-y-3">
                {insights.support_signals.map((employee) => (
                  <div key={employee.user_id} className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-base font-semibold text-[var(--text)]">{employee.name}</div>
                        <div className="mt-1 text-xs leading-5 text-[var(--muted)]">{employee.reason}</div>
                      </div>
                      <div className={`text-sm font-semibold ${severityTone(employee.attention_score)}`}>{employee.attention_score.toFixed(0)}</div>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-[linear-gradient(90deg,#f59e0b,#ef4444)]"
                        style={{ width: clampPercent((employee.attention_score / maxSupportScore) * 100) }}
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-[var(--muted)]">
                      <span>{employee.performance_percent.toFixed(1)}% performance</span>
                      <span>{formatNumber(employee.downtime_minutes)} min downtime</span>
                      <span>{formatNumber(employee.quality_issue_entries)} quality issues</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[1.75rem] border border-[var(--border)] bg-[rgba(12,16,26,0.72)] p-5">
              <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Weekly Winners</div>
              <div className="mt-1 text-lg font-semibold">Which employee did great in which week</div>
              <div className="mt-5 space-y-3">
                {insights.weekly_snapshots.length ? (
                  insights.weekly_snapshots.map((week) => (
                    <div key={week.week_start} className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">{formatWeekLabel(week.week_start, week.week_end)}</div>
                          <div className="mt-1 text-base font-semibold text-[var(--text)]">{week.total_units_produced.toLocaleString("en-IN")} units</div>
                        </div>
                        <div className="text-sm text-[var(--muted)]">{week.performance_percent.toFixed(1)}% team performance</div>
                      </div>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                          <div className="text-xs uppercase tracking-[0.18em] text-emerald-300">Best Employee</div>
                          <div className="mt-2 text-base font-semibold text-[var(--text)]">{week.best_employee?.name || "No data"}</div>
                          <div className="mt-1 text-xs text-[var(--muted)]">
                            {week.best_employee
                              ? `${week.best_employee.performance_percent.toFixed(1)}% performance - ${formatNumber(week.best_employee.units_produced)} units`
                              : "No winner recorded for this week."}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
                          <div className="text-xs uppercase tracking-[0.18em] text-amber-300">Needs Support</div>
                          <div className="mt-2 text-base font-semibold text-[var(--text)]">{week.needs_support_employee?.name || "No data"}</div>
                          <div className="mt-1 text-xs text-[var(--muted)]">
                            {week.needs_support_employee?.reason || "No support signal triggered for this week."}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
                    Weekly employee comparisons appear when the date range includes report history.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-[var(--border)] bg-[rgba(12,16,26,0.72)] p-5">
              <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Weekly Trend Matrix</div>
              <div className="mt-1 text-lg font-semibold">Top employee momentum across weeks</div>
              <div className="mt-5 space-y-4">
                {insights.employee_trend.length ? (
                  insights.employee_trend.map((employee) => (
                    <div key={employee.user_id} className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                      <div className="mb-3 text-sm font-semibold text-[var(--text)]">{employee.name}</div>
                      <div className="grid grid-cols-4 gap-2 md:grid-cols-6">
                        {employee.points.map((point) => (
                          <div key={`${employee.user_id}-${point.week_start}`} className="space-y-2 text-center">
                            <div
                              className="flex h-20 items-end justify-center rounded-xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-2"
                              title={`${formatWeekLabel(point.week_start, point.week_end)} - ${point.performance_percent.toFixed(1)}%`}
                            >
                              <div
                                className="w-full rounded-full bg-[linear-gradient(180deg,#60a5fa,#c084fc)]"
                                style={{ height: clampPercent((point.performance_percent / maxTrendPerformance) * 100) }}
                              />
                            </div>
                            <div className="text-[11px] text-[var(--muted)]">{formatDate(point.week_start)}</div>
                            <div className="text-[11px] font-semibold text-[var(--text)]">{point.performance_percent.toFixed(0)}%</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
                    As soon as more than one week of report data is available, this matrix will show employee performance momentum.
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {steelOverview ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Steel Owner Signals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Realized Revenue"
                value={formatCurrency(steelOverview.profit_summary?.realized_dispatched_revenue_inr)}
                hint="Revenue already backed by dispatch activity in the steel flow."
              />
              <MetricCard
                label="Realized Profit"
                value={formatCurrency(steelOverview.profit_summary?.realized_dispatched_profit_inr)}
                hint={steelOverview.financial_access ? "Gross-profit view from dispatch-linked steel activity." : "Visible to owner role only."}
              />
              <MetricCard
                label="Outstanding"
                value={formatCurrency(steelOverview.profit_summary?.outstanding_invoice_amount_inr)}
                hint="Open invoice value still waiting to be dispatched or settled."
              />
              <MetricCard
                label="Leakage Exposure"
                value={formatCurrency(steelOverview.anomaly_summary.total_estimated_leakage_value_inr)}
                hint={`${formatNumber(steelOverview.anomaly_summary.total_variance_kg)} KG variance across ranked anomaly batches.`}
              />
            </div>

            <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
              <div className="rounded-[1.75rem] border border-[var(--border)] bg-[rgba(12,16,26,0.72)] p-5">
                <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Loss By Operator</div>
                <div className="mt-1 text-lg font-semibold">Steel responsibility ranking</div>
                <div className="mt-5 space-y-3">
                  {steelOverview.responsibility_analytics.by_operator.map((row) => (
                    <div key={row.user_id} className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-base font-semibold text-[var(--text)]">{row.name}</div>
                          <div className="mt-1 text-xs text-[var(--muted)]">
                            {row.batch_count} batches - {row.high_risk_batches} high-risk - {row.critical_batches} critical
                          </div>
                        </div>
                        <div className="text-right text-sm text-[var(--muted)]">
                          <div>{formatNumber(Math.round(row.total_variance_kg))} KG variance</div>
                          <div>{formatCurrency(row.total_variance_value_inr)}</div>
                        </div>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-[linear-gradient(90deg,#f97316,#ef4444)]"
                          style={{ width: clampPercent((row.highest_anomaly_score / Math.max(steelOverview.anomaly_summary.highest_anomaly_score, 1)) * 100) }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-[var(--border)] bg-[rgba(12,16,26,0.72)] p-5">
                <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Ranked Anomalies</div>
                <div className="mt-1 text-lg font-semibold">Which steel batches lost the most</div>
                <div className="mt-5 space-y-3">
                  {steelOverview.ranked_anomalies.map((row) => (
                    <div key={`${row.rank}-${row.batch.id}`} className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Rank #{row.rank}</div>
                          <div className="mt-1 text-base font-semibold text-[var(--text)]">{row.batch.batch_code}</div>
                          <div className="mt-1 text-xs text-[var(--muted)]">{row.reason}</div>
                        </div>
                        <div className="text-right text-sm text-[var(--muted)]">
                          <div>{formatNumber(Math.round(row.batch.variance_kg))} KG variance</div>
                          <div>{formatCurrency(row.estimated_leakage_value_inr)}</div>
                        </div>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-[linear-gradient(90deg,#fb7185,#ef4444)]" style={{ width: clampPercent(row.anomaly_score) }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
