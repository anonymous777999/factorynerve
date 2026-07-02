"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getSteelQualityTracking,
  getSteelQualityIntelligence,
  type QualityTracking,
  type QualityIntelligence,
} from "@/lib/steel";
import { useSession } from "@/lib/use-session";
import { DashboardPageSkeleton } from "@/components/shared/page-skeletons";
import { ResponsiveScrollArea } from "@/components/ui/responsive-scroll-area";

function formatPercent(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined) return "—";
  return `${value.toFixed(digits)}%`;
}

function formatNum(value: number | null | undefined, digits = 0) {
  if (value === null || value === undefined) return "—";
  return Number(value).toFixed(digits);
}

function scoreColor(score: number) {
  if (score >= 80) return "text-emerald-400";
  if (score >= 50) return "text-amber-400";
  return "text-rose-400";
}

function badgeTone(value: string) {
  if (value === "critical" || value === "high" || value === "rejected")
    return "border-rose-400/35 bg-rose-400/12 text-rose-200";
  if (value === "watch" || value === "medium" || value === "needs_attention" || value === "boolean_only")
    return "border-amber-400/35 bg-amber-400/12 text-amber-200";
  if (value === "unavailable" || value === "no_data")
    return "border-gray-400/35 bg-gray-400/12 text-gray-300";
  return "border-emerald-400/35 bg-emerald-400/12 text-emerald-200";
}

export function SteelQualityPage() {
  const { user, loading: sessionLoading } = useSession();
  const [batchData, setBatchData] = useState<QualityTracking | null>(null);
  const [entryData, setEntryData] = useState<QualityIntelligence | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"batch" | "entry">("batch");
  const [error, setError] = useState("");
  const [days, setDays] = useState(30);

  const refresh = useCallback(async () => {
    if (!user) return;
    setPageLoading(true);
    setError("");
    try {
      const [batch, entry] = await Promise.all([
        getSteelQualityTracking(days),
        getSteelQualityIntelligence({ days }), // eslint-disable-line @typescript-eslint/no-floating-promises
      ]);
      setBatchData(batch);
      setEntryData(entry);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load quality data.");
    } finally {
      setPageLoading(false);
    }
  }, [user, days]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (sessionLoading || pageLoading) {
    return <DashboardPageSkeleton />;
  }

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4 content-fade-in">
        <Card className="w-full">
          <CardHeader><CardTitle>Quality Tracking</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-red-400">Please sign in to continue.</div>
            <Link href="/access"><Button>Open Access</Button></Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  const distro = batchData?.severity_distribution || {};
  const qualityScore = batchData?.quality_score;
  const byOperatorBatch = batchData?.rejection_rate.by_operator || [];
  const defectCategories = batchData?.defect_categories || [];
  const trendBatch = batchData?.trend || [];

  const summary = entryData?.summary;
  const defectCatAnalysis = entryData?.defect_category_analysis;
  const byOperatorEntry = entryData?.by_operator || [];
  const byShift = entryData?.by_shift?.by_shift || [];
  const byDept = entryData?.by_department?.by_department || [];
  const scrapVsRework = entryData?.scrap_vs_rework;
  const batchIntegration = entryData?.batch_quality_integration;
  const confidence = entryData?.data_confidence;
  const trendEntry = entryData?.rejection_trend || [];

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#fafaf9_0%,#f5f5f4_48%,#fafaf9_100%)] px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <section className="rounded-[2rem] border border-[#e7e5e4] bg-[linear-gradient(135deg,#ffffff,#fafaf9)] p-6 shadow-[0_22px_55px_rgba(15,23,42,0.08)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-4xl">
              <div className="text-sm uppercase tracking-prominent text-[#78716c]">Quality Intelligence</div>
              <h1 className="mt-2 text-3xl font-semibold text-[#111111] md:text-4xl">
                Batch &amp; entry quality at a glance
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#57534e]">
                Track rejection rates, defect categories, quality scores, scrap vs rework — across batches, operators, shifts, and departments.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <select
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="rounded-xl border border-[#e7e5e4] bg-white px-3 py-2 text-sm text-[#111111]"
              >
                <option value={7}>Last 7 days</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
              </select>
              <Button variant="outline" onClick={() => void refresh()} disabled={pageLoading}>
                {pageLoading ? "Loading..." : "Refresh"}
              </Button>
              {user?.role === "admin" || user?.role === "owner" ? (
                <Link href="/settings?tab=defect-reasons">
                  <Button variant="outline" className="text-xs">
                    Manage Defect Reasons
                  </Button>
                </Link>
              ) : null}
            </div>
          </div>
          {/* Tab switcher */}
          <div className="mt-4 flex gap-1 rounded-xl border border-[#e7e5e4] bg-[#f5f5f4] p-1">
            <button
              onClick={() => setActiveTab("batch")}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                activeTab === "batch" ? "bg-white text-[#111111] shadow-sm" : "text-[#78716c] hover:text-[#111111]"
              }`}
            >
              Batch Quality
            </button>
            <button
              onClick={() => setActiveTab("entry")}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                activeTab === "entry" ? "bg-white text-[#111111] shadow-sm" : "text-[#78716c] hover:text-[#111111]"
              }`}
            >
              Entry Quality (Structured)
            </button>
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-rose-400/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>
        ) : null}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* TAB 1: BATCH QUALITY (EXISTING)                              */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === "batch" && (
          <>
            {/* Score cards */}
            <section className="grid gap-4 md:grid-cols-4">
              <Card className="border border-[#e7e5e4] bg-white shadow-sm">
                <CardHeader className="pb-2">
                  <div className="text-xs uppercase tracking-wider text-[#78716c]">Quality Score</div>
                </CardHeader>
                <CardContent>
                  <div className={`text-4xl font-bold ${scoreColor(qualityScore?.overall || 0)}`}>
                    {(qualityScore?.overall || 0).toFixed(0)}
                  </div>
                  <div className="mt-1 text-xs text-[#57534e]">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs ${badgeTone(qualityScore?.label || "good")}`}>
                      {qualityScore?.label?.replace("_", " ") || "good"}
                    </span>
                  </div>
                </CardContent>
              </Card>
              <Card className="border border-[#e7e5e4] bg-white shadow-sm">
                <CardHeader className="pb-2">
                  <div className="text-xs uppercase tracking-wider text-[#78716c]">Total Batches</div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-[#111111]">{batchData?.total_batches || 0}</div>
                  <div className="mt-1 text-xs text-[#57534e]">Over {batchData?.time_period_days || days} days</div>
                </CardContent>
              </Card>
              <Card className="border border-[#e7e5e4] bg-white shadow-sm">
                <CardHeader className="pb-2">
                  <div className="text-xs uppercase tracking-wider text-[#78716c]">High / Critical</div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-[#111111]">
                    {((distro.high || 0) + (distro.critical || 0))}
                  </div>
                  <div className="mt-1 text-xs text-[#57534e]">{formatPercent(batchData?.rejection_rate.overall_high_critical_percent)} of total</div>
                </CardContent>
              </Card>
              <Card className="border border-[#e7e5e4] bg-white shadow-sm">
                <CardHeader className="pb-2">
                  <div className="text-xs uppercase tracking-wider text-[#78716c]">Avg Loss</div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-[#111111]">{formatPercent(batchData?.rejection_rate.overall_avg_loss_percent)}</div>
                  <div className="mt-1 text-xs text-[#57534e]">Overall average</div>
                </CardContent>
              </Card>
            </section>

            {/* Severity distribution + Defects */}
            <section className="grid gap-4 md:grid-cols-2">
              <Card className="border border-[#e7e5e4] bg-white shadow-sm">
                <CardHeader>
                  <div className="text-xs uppercase tracking-wider text-[#78716c]">Distribution</div>
                  <CardTitle className="text-lg text-[#111111]">Severity Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-3">
                    {["normal", "watch", "high", "critical"].map((sev) => (
                      <div key={sev} className={`rounded-2xl px-3 py-3 text-center ${badgeTone(sev === "normal" ? "good" : sev)}`}>
                        <div className="text-sm font-semibold">{distro[sev] || 0}</div>
                        <div className="mt-1 text-xs opacity-80">{sev}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-[#e7e5e4] bg-white shadow-sm">
                <CardHeader>
                  <div className="text-xs uppercase tracking-wider text-[#78716c]">Top Issues</div>
                  <CardTitle className="text-lg text-[#111111]">Defect Categories</CardTitle>
                </CardHeader>
                <CardContent>
                  {defectCategories.length === 0 ? (
                    <div className="text-sm text-[#57534e]">No high-severity defects to categorize.</div>
                  ) : (
                    <div className="space-y-3">
                      {defectCategories.map((defect, i) => (
                        <div key={i} className="flex items-center justify-between rounded-xl border border-[#e7e5e4] bg-[#f5f5f4] px-3 py-2">
                          <div className="text-sm text-[#111111]">{defect.reason}</div>
                          <div className="flex items-center gap-2 text-xs text-[#57534e]">
                            <span className="font-semibold text-[#111111]">{defect.count}</span>
                            <span>({formatPercent(defect.percent)})</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>

            {/* Operator performance */}
            <Card className="border border-[#e7e5e4] bg-white shadow-sm">
              <CardHeader>
                <div className="text-xs uppercase tracking-wider text-[#78716c]">Accountability</div>
                <CardTitle className="text-lg text-[#111111]">Operator Performance (Batch)</CardTitle>
              </CardHeader>
              <CardContent>
                {byOperatorBatch.length === 0 ? (
                  <div className="text-sm text-[#57534e]">No operator data available.</div>
                ) : (
                  <ResponsiveScrollArea className="rounded-3xl border border-[#e7e5e4]" debugLabel="quality-operator">
                    <table className="min-w-full text-left text-sm">
                      <thead className="text-[#78716c]">
                        <tr className="border-b border-[#e7e5e4]">
                          <th className="px-3 py-3 font-medium">Operator</th>
                          <th className="px-3 py-3 font-medium">Batches</th>
                          <th className="px-3 py-3 font-medium">High / Critical</th>
                          <th className="px-3 py-3 font-medium">H/C %</th>
                          <th className="px-3 py-3 font-medium">Avg Loss %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {byOperatorBatch.map((op) => (
                          <tr key={op.user_id} className="border-b border-[#e7e5e4]/60 last:border-none">
                            <td className="px-3 py-3 font-semibold text-[#111111]">{op.name}</td>
                            <td className="px-3 py-3 text-[#57534e]">{op.batch_count}</td>
                            <td className="px-3 py-3 text-[#57534e]">{op.high_critical_count}</td>
                            <td className="px-3 py-3">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs ${badgeTone(op.high_critical_percent > 20 ? "critical" : op.high_critical_percent > 10 ? "watch" : "good")}`}>
                                {formatPercent(op.high_critical_percent)}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-[#57534e]">{formatPercent(op.avg_loss_percent)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ResponsiveScrollArea>
                )}
              </CardContent>
            </Card>

            {/* Daily trend */}
            <Card className="border border-[#e7e5e4] bg-white shadow-sm">
              <CardHeader>
                <div className="text-xs uppercase tracking-wider text-[#78716c]">Trend</div>
                <CardTitle className="text-lg text-[#111111]">Quality Trend (Daily)</CardTitle>
              </CardHeader>
              <CardContent>
                {trendBatch.length === 0 ? (
                  <div className="text-sm text-[#57534e]">No trend data available.</div>
                ) : (
                  <ResponsiveScrollArea className="rounded-3xl border border-[#e7e5e4]" debugLabel="quality-trend">
                    <table className="min-w-full text-left text-sm">
                      <thead className="text-[#78716c]">
                        <tr className="border-b border-[#e7e5e4]">
                          <th className="px-3 py-3 font-medium">Date</th>
                          <th className="px-3 py-3 font-medium">Batches</th>
                          <th className="px-3 py-3 font-medium">Avg Loss %</th>
                          <th className="px-3 py-3 font-medium">H/C Count</th>
                          <th className="px-3 py-3 font-medium">Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trendBatch.map((day) => (
                          <tr key={day.date} className="border-b border-[#e7e5e4]/60 last:border-none">
                            <td className="px-3 py-3 font-semibold text-[#111111]">{day.date}</td>
                            <td className="px-3 py-3 text-[#57534e]">{day.batch_count}</td>
                            <td className="px-3 py-3 text-[#57534e]">{formatPercent(day.avg_loss_percent)}</td>
                            <td className="px-3 py-3 text-[#57534e]">{day.high_critical_count}</td>
                            <td className="px-3 py-3">
                              <span className={`font-semibold ${scoreColor(day.quality_score)}`}>
                                {day.quality_score.toFixed(1)}
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
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* TAB 2: ENTRY QUALITY (NEW STRUCTURED DATA)                    */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === "entry" && (
          <>
            {/* Summary cards */}
            <section className="grid gap-4 md:grid-cols-4">
              <Card className="border border-[#e7e5e4] bg-white shadow-sm">
                <CardHeader className="pb-2">
                  <div className="text-xs uppercase tracking-wider text-[#78716c]">Entries w/ Quality</div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-[#111111]">{summary?.entries_with_quality_data || 0}</div>
                  <div className="mt-1 text-xs text-[#57534e]">
                    of {summary?.total_entries_analyzed || 0} approved entries
                  </div>
                </CardContent>
              </Card>
              <Card className="border border-[#e7e5e4] bg-white shadow-sm">
                <CardHeader className="pb-2">
                  <div className="text-xs uppercase tracking-wider text-[#78716c]">Rejection Rate</div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-[#111111]">{formatPercent(summary?.rejection_rate_percent)}</div>
                  <div className="mt-1 text-xs text-[#57534e]">{formatNum(summary?.total_rejection_units)} rejected units</div>
                </CardContent>
              </Card>
              <Card className="border border-[#e7e5e4] bg-white shadow-sm">
                <CardHeader className="pb-2">
                  <div className="text-xs uppercase tracking-wider text-[#78716c]">Scrap Units</div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-[#111111]">{formatNum(summary?.total_scrap_units)}</div>
                  <div className="mt-1 text-xs text-[#57534e]">scrap rate {formatPercent(summary?.scrap_rate_percent)}</div>
                </CardContent>
              </Card>
              <Card className="border border-[#e7e5e4] bg-white shadow-sm">
                <CardHeader className="pb-2">
                  <div className="text-xs uppercase tracking-wider text-[#78716c]">Rework Entries</div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-[#111111]">{summary?.rework_entry_count || 0}</div>
                  <div className="mt-1 text-xs text-[#57534e]">
                    rework rate {formatPercent(summary?.rework_rate_percent, 1)}
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Data confidence banner */}
            {confidence && (
              <Card className="border border-[#e7e5e4] bg-white shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <div className="text-xs uppercase tracking-wider text-[#78716c]">Data Quality</div>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs ${badgeTone(confidence.overall_quality_data_quality)}`}>
                      {confidence.overall_quality_data_quality.replace(/_/g, " ")}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
                    {[
                      { label: "Rejection", status: confidence.entry_rejection_tracking },
                      { label: "Scrap", status: confidence.entry_scrap_tracking },
                      { label: "Rework", status: confidence.entry_rework_tracking },
                      { label: "Defect Reason", status: confidence.entry_defect_reason_tracking },
                      { label: "Batch Rejection", status: confidence.batch_rejection_tracking },
                      { label: "Batch Scrap", status: confidence.batch_scrap_tracking },
                    ].map((item) => (
                      <div key={item.label} className="rounded-xl border border-[#e7e5e4] bg-[#f5f5f4] px-3 py-2 text-center">
                        <div className="text-xs text-[#78716c]">{item.label}</div>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs ${badgeTone(item.status)}`}>
                          {item.status.replace(/_/g, " ")}
                        </span>
                      </div>
                    ))}
                  </div>
                  {confidence.missing_fields.length > 0 && (
                    <div className="mt-3 text-xs text-[#57534e]">
                      Missing: {confidence.missing_fields.join(", ")}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Defect categorization */}
            {defectCatAnalysis && (
              <Card className="border border-[#e7e5e4] bg-white shadow-sm">
                <CardHeader>
                  <div className="text-xs uppercase tracking-wider text-[#78716c]">Categorization</div>
                  <CardTitle className="text-lg text-[#111111]">
                    Defect Categories (by defect reason)
                    <span className={`ml-2 inline-flex rounded-full px-2 py-0.5 text-xs ${badgeTone(defectCatAnalysis.data_quality)}`}>
                      {defectCatAnalysis.data_quality.replace(/_/g, " ")}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {defectCatAnalysis.categories.length === 0 ? (
                    <div className="text-sm text-[#57534e]">
                      {defectCatAnalysis.uncategorized_entry_count > 0
                        ? `${defectCatAnalysis.uncategorized_entry_count} entries have quality issues but no structured defect reason assigned.`
                        : "No structured defect data recorded. Set defect_reason_id on entries to enable categorization."}
                    </div>
                  ) : (
                    <ResponsiveScrollArea className="rounded-3xl border border-[#e7e5e4]" debugLabel="quality-defect-cats">
                      <table className="min-w-full text-left text-sm">
                        <thead className="text-[#78716c]">
                          <tr className="border-b border-[#e7e5e4]">
                            <th className="px-3 py-3 font-medium">Code</th>
                            <th className="px-3 py-3 font-medium">Label</th>
                            <th className="px-3 py-3 font-medium">Entries</th>
                            <th className="px-3 py-3 font-medium">%</th>
                            <th className="px-3 py-3 font-medium">Rejection</th>
                            <th className="px-3 py-3 font-medium">Scrap</th>
                            <th className="px-3 py-3 font-medium">Rework</th>
                          </tr>
                        </thead>
                        <tbody>
                          {defectCatAnalysis.categories.map((cat) => (
                            <tr key={cat.code} className="border-b border-[#e7e5e4]/60 last:border-none">
                              <td className="px-3 py-3 font-mono text-xs text-[#78716c]">{cat.code}</td>
                              <td className="px-3 py-3 font-semibold text-[#111111]">{cat.label}</td>
                              <td className="px-3 py-3 text-[#57534e]">{cat.entry_count}</td>
                              <td className="px-3 py-3 text-[#57534e]">{formatPercent(cat.entry_percent)}</td>
                              <td className="px-3 py-3 text-[#57534e]">{formatNum(cat.total_rejection_units)}</td>
                              <td className="px-3 py-3 text-[#57534e]">{formatNum(cat.total_scrap_units)}</td>
                              <td className="px-3 py-3 text-[#57534e]">{cat.rework_count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </ResponsiveScrollArea>
                  )}
                  {defectCatAnalysis.uncategorized_entry_count > 0 && (
                    <div className="mt-2 text-xs text-[#57534e]">
                      + {defectCatAnalysis.uncategorized_entry_count} uncategorized quality entries
                    </div>
                  )}
                  <div className="mt-2 text-xs italic text-[#78716c]">{defectCatAnalysis.note}</div>
                </CardContent>
              </Card>
            )}

            {/* By operator (entry-level) */}
            {byOperatorEntry.length > 0 && (
              <Card className="border border-[#e7e5e4] bg-white shadow-sm">
                <CardHeader>
                  <div className="text-xs uppercase tracking-wider text-[#78716c]">Accountability</div>
                  <CardTitle className="text-lg text-[#111111]">Operator Quality (Entry)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveScrollArea className="rounded-3xl border border-[#e7e5e4]" debugLabel="quality-entry-operator">
                    <table className="min-w-full text-left text-sm">
                      <thead className="text-[#78716c]">
                        <tr className="border-b border-[#e7e5e4]">
                          <th className="px-3 py-3 font-medium">Operator</th>
                          <th className="px-3 py-3 font-medium">Entries</th>
                          <th className="px-3 py-3 font-medium">Rejection</th>
                          <th className="px-3 py-3 font-medium">Rejection %</th>
                          <th className="px-3 py-3 font-medium">Scrap</th>
                          <th className="px-3 py-3 font-medium">Rework</th>
                          <th className="px-3 py-3 font-medium">Top Defect Codes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {byOperatorEntry.map((op) => (
                          <tr key={op.user_id} className="border-b border-[#e7e5e4]/60 last:border-none">
                            <td className="px-3 py-3 font-semibold text-[#111111]">{op.name}</td>
                            <td className="px-3 py-3 text-[#57534e]">{op.entry_count}</td>
                            <td className="px-3 py-3 text-[#57534e]">{formatNum(op.total_rejection_units)}</td>
                            <td className="px-3 py-3 text-[#57534e]">{formatPercent(op.rejection_rate_percent)}</td>
                            <td className="px-3 py-3 text-[#57534e]">{formatNum(op.total_scrap_units)}</td>
                            <td className="px-3 py-3 text-[#57534e]">{op.rework_entry_count}</td>
                            <td className="px-3 py-3 text-xs text-[#57534e]">
                              {op.top_defect_codes.slice(0, 2).map((d) => d.label).join(", ") || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ResponsiveScrollArea>
                </CardContent>
              </Card>
            )}

            {/* By shift + By department */}
            <section className="grid gap-4 md:grid-cols-2">
              {byShift.length > 0 && (
                <Card className="border border-[#e7e5e4] bg-white shadow-sm">
                  <CardHeader>
                    <div className="text-xs uppercase tracking-wider text-[#78716c]">Breakdown</div>
                    <CardTitle className="text-lg text-[#111111]">By Shift</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveScrollArea className="rounded-3xl border border-[#e7e5e4]" debugLabel="quality-shift">
                      <table className="min-w-full text-left text-sm">
                        <thead className="text-[#78716c]">
                          <tr className="border-b border-[#e7e5e4]">
                            <th className="px-3 py-3 font-medium">Shift</th>
                            <th className="px-3 py-3 font-medium">Entries</th>
                            <th className="px-3 py-3 font-medium">Rejection</th>
                            <th className="px-3 py-3 font-medium">Rej %</th>
                            <th className="px-3 py-3 font-medium">Scrap</th>
                            <th className="px-3 py-3 font-medium">Rework</th>
                          </tr>
                        </thead>
                        <tbody>
                          {byShift.map((s) => (
                            <tr key={s.shift} className="border-b border-[#e7e5e4]/60 last:border-none">
                              <td className="px-3 py-3 font-semibold capitalize text-[#111111]">{s.shift}</td>
                              <td className="px-3 py-3 text-[#57534e]">{s.entry_count}</td>
                              <td className="px-3 py-3 text-[#57534e]">{formatNum(s.total_rejection_units)}</td>
                              <td className="px-3 py-3 text-[#57534e]">{formatPercent(s.rejection_rate_percent)}</td>
                              <td className="px-3 py-3 text-[#57534e]">{formatNum(s.total_scrap_units)}</td>
                              <td className="px-3 py-3 text-[#57534e]">{s.rework_entry_count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </ResponsiveScrollArea>
                  </CardContent>
                </Card>
              )}

              {byDept.length > 0 && (
                <Card className="border border-[#e7e5e4] bg-white shadow-sm">
                  <CardHeader>
                    <div className="text-xs uppercase tracking-wider text-[#78716c]">Breakdown</div>
                    <CardTitle className="text-lg text-[#111111]">By Department</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveScrollArea className="rounded-3xl border border-[#e7e5e4]" debugLabel="quality-dept">
                      <table className="min-w-full text-left text-sm">
                        <thead className="text-[#78716c]">
                          <tr className="border-b border-[#e7e5e4]">
                            <th className="px-3 py-3 font-medium">Department</th>
                            <th className="px-3 py-3 font-medium">Entries</th>
                            <th className="px-3 py-3 font-medium">Rejection</th>
                            <th className="px-3 py-3 font-medium">Rej %</th>
                            <th className="px-3 py-3 font-medium">Scrap</th>
                            <th className="px-3 py-3 font-medium">Rework</th>
                          </tr>
                        </thead>
                        <tbody>
                          {byDept.map((d) => (
                            <tr key={d.department} className="border-b border-[#e7e5e4]/60 last:border-none">
                              <td className="px-3 py-3 font-semibold text-[#111111]">{d.department}</td>
                              <td className="px-3 py-3 text-[#57534e]">{d.entry_count}</td>
                              <td className="px-3 py-3 text-[#57534e]">{formatNum(d.total_rejection_units)}</td>
                              <td className="px-3 py-3 text-[#57534e]">{formatPercent(d.rejection_rate_percent)}</td>
                              <td className="px-3 py-3 text-[#57534e]">{formatNum(d.total_scrap_units)}</td>
                              <td className="px-3 py-3 text-[#57534e]">{d.rework_entry_count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </ResponsiveScrollArea>
                  </CardContent>
                </Card>
              )}
            </section>

            {/* Scrap vs rework */}
            {scrapVsRework && scrapVsRework.data_quality !== "no_data" && (
              <Card className="border border-[#e7e5e4] bg-white shadow-sm">
                <CardHeader>
                  <div className="text-xs uppercase tracking-wider text-[#78716c]">Resource Allocation</div>
                  <CardTitle className="text-lg text-[#111111]">
                    Scrap vs Rework
                    {scrapVsRework.scrap_dominates && (
                      <span className="ml-2 inline-flex rounded-full border border-rose-400/35 bg-rose-400/12 px-2 py-0.5 text-xs text-rose-200">
                        scrap dominant
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-4">
                    <div className="rounded-xl border border-[#e7e5e4] bg-[#f5f5f4] px-4 py-3">
                      <div className="text-xs text-[#78716c]">Scrap Units</div>
                      <div className="text-2xl font-bold text-[#111111]">{formatNum(scrapVsRework.total_scrap_units)}</div>
                      <div className="text-xs text-[#57534e]">{scrapVsRework.entries_with_scrap_count} entries</div>
                    </div>
                    <div className="rounded-xl border border-[#e7e5e4] bg-[#f5f5f4] px-4 py-3">
                      <div className="text-xs text-[#78716c]">Rework Entries</div>
                      <div className="text-2xl font-bold text-[#111111]">{scrapVsRework.total_rework_entry_count}</div>
                      <div className="text-xs text-[#57534e]">{scrapVsRework.entries_with_rework_count} entries</div>
                    </div>
                    <div className="rounded-xl border border-[#e7e5e4] bg-[#f5f5f4] px-4 py-3">
                      <div className="text-xs text-[#78716c]">Both</div>
                      <div className="text-2xl font-bold text-[#111111]">{scrapVsRework.entries_with_both_scrap_and_rework}</div>
                      <div className="text-xs text-[#57534e]">scrap + rework entries</div>
                    </div>
                    <div className="rounded-xl border border-[#e7e5e4] bg-[#f5f5f4] px-4 py-3">
                      <div className="text-xs text-[#78716c]">Ratio (scrap/rework)</div>
                      <div className="text-2xl font-bold text-[#111111]">
                        {scrapVsRework.scrap_vs_rework_ratio !== null
                          ? scrapVsRework.scrap_vs_rework_ratio.toFixed(1)
                          : "—"}
                      </div>
                      <div className="text-xs text-[#57534e]">
                        {entryData?.financial_access
                          ? `Cost: INR ${formatNum(scrapVsRework.estimated_rework_labour_cost_inr, 0)}`
                          : "Restricted"}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 text-xs italic text-[#78716c]">{scrapVsRework.note}</div>
                </CardContent>
              </Card>
            )}

            {/* Daily rejection trend */}
            {trendEntry.length > 0 && (
              <Card className="border border-[#e7e5e4] bg-white shadow-sm">
                <CardHeader>
                  <div className="text-xs uppercase tracking-wider text-[#78716c]">Trend</div>
                  <CardTitle className="text-lg text-[#111111]">Rejection Trend (Daily)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveScrollArea className="rounded-3xl border border-[#e7e5e4]" debugLabel="quality-entry-trend">
                    <table className="min-w-full text-left text-sm">
                      <thead className="text-[#78716c]">
                        <tr className="border-b border-[#e7e5e4]">
                          <th className="px-3 py-3 font-medium">Date</th>
                          <th className="px-3 py-3 font-medium">Entries</th>
                          <th className="px-3 py-3 font-medium">Produced</th>
                          <th className="px-3 py-3 font-medium">Rejection</th>
                          <th className="px-3 py-3 font-medium">Rej %</th>
                          <th className="px-3 py-3 font-medium">Scrap</th>
                          <th className="px-3 py-3 font-medium">Rework</th>
                          <th className="px-3 py-3 font-medium">Batch Rej (kg)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trendEntry.map((day) => (
                          <tr key={day.date} className="border-b border-[#e7e5e4]/60 last:border-none">
                            <td className="px-3 py-3 font-semibold text-[#111111]">{day.date}</td>
                            <td className="px-3 py-3 text-[#57534e]">{day.approved_entry_count}</td>
                            <td className="px-3 py-3 text-[#57534e]">{formatNum(day.total_produced_units)}</td>
                            <td className="px-3 py-3 text-[#57534e]">{formatNum(day.rejection_units)}</td>
                            <td className="px-3 py-3 text-[#57534e]">{formatPercent(day.rejection_rate_percent)}</td>
                            <td className="px-3 py-3 text-[#57534e]">{formatNum(day.scrap_units)}</td>
                            <td className="px-3 py-3 text-[#57534e]">{day.rework_count}</td>
                            <td className="px-3 py-3 text-[#57534e]">{formatNum(day.batch_rejection_kg, 2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ResponsiveScrollArea>
                </CardContent>
              </Card>
            )}

            {/* Batch quality integration */}
            {batchIntegration && batchIntegration.data_quality !== "no_data" && (
              <Card className="border border-[#e7e5e4] bg-white shadow-sm">
                <CardHeader>
                  <div className="text-xs uppercase tracking-wider text-[#78716c]">Cross-Reference</div>
                  <CardTitle className="text-lg text-[#111111]">Batch Quality Integration</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-4">
                    <div className="rounded-xl border border-[#e7e5e4] bg-[#f5f5f4] px-4 py-3">
                      <div className="text-xs text-[#78716c]">Batch Rejection (kg)</div>
                      <div className="text-2xl font-bold text-[#111111]">{formatNum(batchIntegration.total_batch_rejection_kg, 2)}</div>
                    </div>
                    <div className="rounded-xl border border-[#e7e5e4] bg-[#f5f5f4] px-4 py-3">
                      <div className="text-xs text-[#78716c]">Batch Scrap (kg)</div>
                      <div className="text-2xl font-bold text-[#111111]">{formatNum(batchIntegration.total_batch_scrap_kg, 2)}</div>
                    </div>
                    <div className="rounded-xl border border-[#e7e5e4] bg-[#f5f5f4] px-4 py-3">
                      <div className="text-xs text-[#78716c]">Batch Loss %</div>
                      <div className="text-2xl font-bold text-[#111111]">{formatPercent(batchIntegration.batch_loss_percent)}</div>
                    </div>
                    <div className="rounded-xl border border-[#e7e5e4] bg-[#f5f5f4] px-4 py-3">
                      <div className="text-xs text-[#78716c]">Total Batches</div>
                      <div className="text-2xl font-bold text-[#111111]">{batchIntegration.total_batches}</div>
                    </div>
                  </div>
                  {/* Top loss batches */}
                  {batchIntegration.top_loss_batches.length > 0 && (
                    <div className="mt-4">
                      <div className="mb-2 text-xs font-medium uppercase tracking-wider text-[#78716c]">Top Loss Batches</div>
                      <ResponsiveScrollArea className="rounded-3xl border border-[#e7e5e4]" debugLabel="quality-top-loss">
                        <table className="min-w-full text-left text-sm">
                          <thead className="text-[#78716c]">
                            <tr className="border-b border-[#e7e5e4]">
                              <th className="px-3 py-3 font-medium">Batch</th>
                              <th className="px-3 py-3 font-medium">Date</th>
                              <th className="px-3 py-3 font-medium">Severity</th>
                              <th className="px-3 py-3 font-medium">Loss %</th>
                              <th className="px-3 py-3 font-medium">Loss (kg)</th>
                              <th className="px-3 py-3 font-medium">Output (kg)</th>
                              <th className="px-3 py-3 font-medium">Rejection (kg)</th>
                              <th className="px-3 py-3 font-medium">Scrap (kg)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {batchIntegration.top_loss_batches.map((b) => (
                              <tr key={b.id} className="border-b border-[#e7e5e4]/60 last:border-none">
                                <td className="px-3 py-3 font-mono text-xs text-[#111111]">{b.batch_code}</td>
                                <td className="px-3 py-3 text-[#57534e]">{b.production_date}</td>
                                <td className="px-3 py-3">
                                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs ${badgeTone(b.severity)}`}>
                                    {b.severity}
                                  </span>
                                </td>
                                <td className="px-3 py-3 text-[#57534e]">{formatPercent(b.loss_percent)}</td>
                                <td className="px-3 py-3 text-[#57534e]">{formatNum(b.loss_kg, 2)}</td>
                                <td className="px-3 py-3 text-[#57534e]">{formatNum(b.actual_output_kg, 2)}</td>
                                <td className="px-3 py-3 text-[#57534e]">{formatNum(b.rejection_qty_kg, 2)}</td>
                                <td className="px-3 py-3 text-[#57534e]">{formatNum(b.scrap_qty_kg, 2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </ResponsiveScrollArea>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Severity distribution from batches */}
            {batchIntegration && batchIntegration.data_quality !== "no_data" && (
              <section className="grid gap-4 md:grid-cols-2">
                <Card className="border border-[#e7e5e4] bg-white shadow-sm">
                  <CardHeader>
                    <div className="text-xs uppercase tracking-wider text-[#78716c]">Distribution</div>
                    <CardTitle className="text-lg text-[#111111]">Batch Severity Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-4 gap-3">
                      {["normal", "watch", "high", "critical"].map((sev) => (
                        <div key={sev} className={`rounded-2xl px-3 py-3 text-center ${badgeTone(sev === "normal" ? "good" : sev)}`}>
                          <div className="text-sm font-semibold">{batchIntegration.severity_distribution?.[sev] || 0}</div>
                          <div className="mt-1 text-xs opacity-80">{sev}</div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
