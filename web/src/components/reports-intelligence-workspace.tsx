"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ApiError } from "@/lib/api";
import { getReportInsights, startRangeExcelJob, getReportJob, downloadReportJob, type ReportInsights, type ReportJob } from "@/lib/reports";
import { getOcrVerificationSummary, type OcrVerificationSummary } from "@/lib/ocr";
import { useSession } from "@/lib/use-session";
import { triggerBlobDownload } from "@/lib/reports";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function todayValue() {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function daysAgoValue(days: number) {
    const now = new Date();
    now.setDate(now.getDate() - days);
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function monthStartValue() {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const offset = first.getTimezoneOffset() * 60000;
    return new Date(first.getTime() - offset).toISOString().slice(0, 10);
}

function formatMinutes(minutes: number) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function ReportsIntelligenceWorkspace() {
    const { user, loading, activeFactory } = useSession();
    const [startDate, setStartDate] = useState(daysAgoValue(7));
    const [endDate, setEndDate] = useState(todayValue());
    const [selectedRange, setSelectedRange] = useState("Last 7d");

    const [insights, setInsights] = useState<ReportInsights | null>(null);
    const [ocrSummary, setOcrSummary] = useState<OcrVerificationSummary | null>(null);
    const [insightsLoading, setInsightsLoading] = useState(false);
    const [insightsError, setInsightsError] = useState("");

    const [exportJob, setExportJob] = useState<ReportJob | null>(null);
    const [exporting, setExporting] = useState(false);
    const [exportError, setExportError] = useState("");
    const [exportStatus, setExportStatus] = useState("");

    const loadInsights = useCallback(async (start: string, end: string) => {
        if (!user) return;
        setInsightsLoading(true);
        setInsightsError("");
        try {
            const [insightsResult, ocrResult] = await Promise.allSettled([
                getReportInsights({ startDate: start, endDate: end }),
                getOcrVerificationSummary(),
            ]);
            if (insightsResult.status === "fulfilled") setInsights(insightsResult.value);
            else setInsightsError(insightsResult.reason instanceof Error ? insightsResult.reason.message : "Could not load report insights.");
            if (ocrResult.status === "fulfilled") setOcrSummary(ocrResult.value);
        } finally {
            setInsightsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (user) {
            loadInsights(startDate, endDate).catch(() => { });
        }
    }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

    // Poll export job until done
    useEffect(() => {
        if (!exportJob?.job_id) return;
        if (!["queued", "running", "canceling"].includes(exportJob.status)) return;
        const timer = window.setInterval(async () => {
            try {
                const next = await getReportJob(exportJob.job_id);
                setExportJob(next);
                if (next.status === "succeeded") {
                    setExportStatus("Export ready. Downloading...");
                    const blob = await downloadReportJob(next.job_id);
                    triggerBlobDownload(blob, next.result?.file?.filename || "report.xlsx");
                    setExportStatus("Download started.");
                    setExporting(false);
                } else if (next.status === "failed" || next.status === "canceled") {
                    setExportError(next.error || "Export failed.");
                    setExporting(false);
                }
            } catch (err) {
                setExportError(err instanceof Error ? err.message : "Export polling failed.");
                setExporting(false);
            }
        }, 2500);
        return () => window.clearInterval(timer);
    }, [exportJob]);

    const handleQuickRange = useCallback((range: string) => {
        setSelectedRange(range);
        const today = todayValue();
        let start = today;
        switch (range) {
            case "Today":
                start = today;
                break;
            case "Last 7d":
                start = daysAgoValue(7);
                break;
            case "This Month":
                start = monthStartValue();
                break;
        }
        setStartDate(start);
        setEndDate(today);
    }, []);

    const handleUpdateReport = useCallback(() => {
        loadInsights(startDate, endDate).catch(() => { });
    }, [loadInsights, startDate, endDate]);

    const handleExportExcel = useCallback(async () => {
        if (!user || exporting) return;
        setExporting(true);
        setExportError("");
        setExportStatus("Queuing export...");
        try {
            const job = await startRangeExcelJob(startDate, endDate);
            setExportJob(job);
            setExportStatus("Export queued. Waiting for results...");
        } catch (err) {
            setExportError(err instanceof Error ? err.message : "Could not start export.");
            setExporting(false);
            setExportStatus("");
        }
    }, [user, exporting, startDate, endDate]);

    const totals = insights?.totals;
    const dailySeries = useMemo(() => insights?.daily_series ?? [], [insights]);
    const shiftBreakdown = useMemo(() => insights?.shift_breakdown ?? [], [insights]);

    if (loading) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-surface-app text-label-dense text-text-secondary">
                Loading reports...
            </main>
        );
    }

    if (!user) {
        return (
            <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-md">
                <Card className="w-full">
                    <CardHeader><CardTitle>Reports & Exports</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="text-sm text-status-danger-fg">Sign in to view reports.</div>
                        <Link href="/access"><Button>Open Access</Button></Link>
                    </CardContent>
                </Card>
            </main>
        );
    }

    return (
        <main className="operational-page">
            <div className="operational-page__inner mx-auto max-w-[1440px] space-y-6">

                {/* Header */}
                <section className="route-header">
                    <div className="route-header__grid">
                        <div className="route-header__copy">
                            <div className="route-header__eyebrow">Reports & Exports</div>
                            <h1 className="route-header__title">Production reports</h1>
                            <p className="route-header__body">
                                Review output, exports, and operating signals across the selected date range.
                            </p>
                        </div>
                        <div className="route-header__actions">
                            <Button onClick={handleExportExcel} disabled={exporting}>
                                {exporting ? "Exporting..." : "Export Excel"}
                            </Button>
                            <Link href="/email-summary">
                                <Button variant="outline">Email summary</Button>
                            </Link>
                        </div>
                    </div>
                </section>

                {/* Export feedback */}
                {exportStatus ? (
                    <div className="rounded-panel border border-status-success-border bg-status-success-bg px-4 py-3 text-sm text-status-success-fg">
                        {exportStatus}
                    </div>
                ) : null}
                {exportError ? (
                    <div className="rounded-panel border border-status-danger-border bg-status-danger-bg px-4 py-3 text-sm text-status-danger-fg">
                        {exportError}
                    </div>
                ) : null}

                {/* Date range controls */}
                <Card>
                    <CardHeader>
                        <CardTitle>Date range</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex flex-wrap gap-2">
                            {["Today", "Last 7d", "This Month"].map((range) => (
                                <Button
                                    key={range}
                                    size="compact"
                                    variant={selectedRange === range ? "primary" : "outline"}
                                    onClick={() => handleQuickRange(range)}
                                >
                                    {range}
                                </Button>
                            ))}
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                            <div>
                                <label className="text-label-dense font-medium text-text-secondary">Start date</label>
                                <Input
                                    aria-label="Start date"
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <label className="text-label-dense font-medium text-text-secondary">End date</label>
                                <Input
                                    aria-label="End date"
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="mt-1"
                                />
                            </div>
                            <div className="flex items-end">
                                <Button onClick={handleUpdateReport} disabled={insightsLoading} className="w-full">
                                    {insightsLoading ? "Loading..." : "Update report"}
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {insightsError ? (
                    <div className="rounded-panel border border-status-danger-border bg-status-danger-bg px-4 py-3 text-sm text-status-danger-fg">
                        {insightsError} —{" "}
                        <button type="button" className="underline" onClick={handleUpdateReport}>Retry</button>
                    </div>
                ) : null}

                {/* KPI summary row */}
                {totals ? (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {[
                            { label: "Units produced", value: totals.total_units_produced.toLocaleString("en-IN"), sub: `Target: ${totals.total_units_target.toLocaleString("en-IN")}` },
                            { label: "Performance", value: `${totals.performance_percent.toFixed(1)}%`, sub: `${totals.entry_count} entries` },
                            { label: "Downtime", value: formatMinutes(totals.total_downtime_minutes), sub: `${totals.quality_issue_entries} issue entries` },
                            { label: "Active team", value: String(totals.active_people), sub: `${totals.attendance_percent.toFixed(1)}% attendance` },
                        ].map((card) => (
                            <div key={card.label} className="rounded-panel border border-border-subtle bg-surface-card p-4 shadow-xs">
                                <div className="text-label-dense font-medium text-text-tertiary">{card.label}</div>
                                <div className="mt-2 text-2xl font-semibold tabular-nums text-text-primary">{insightsLoading ? "—" : card.value}</div>
                                <div className="mt-1 text-label-dense text-text-secondary">{card.sub}</div>
                            </div>
                        ))}
                    </div>
                ) : insightsLoading ? (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {[0, 1, 2, 3].map((i) => (
                            <div key={i} className="h-24 animate-pulse rounded-panel border border-border-subtle bg-surface-skeleton" />
                        ))}
                    </div>
                ) : null}

                {/* Daily series + Shift breakdown */}
                <div className="grid gap-6 xl:grid-cols-2">
                    {/* Daily series */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Daily output</CardTitle>
                            <p className="text-sm text-text-secondary">Production vs target per day in the selected range.</p>
                        </CardHeader>
                        <CardContent>
                            {insightsLoading ? (
                                <div className="h-48 animate-pulse rounded-panel bg-surface-skeleton" />
                            ) : dailySeries.length === 0 ? (
                                <div className="flex h-48 items-center justify-center rounded-panel border border-border-subtle bg-surface-elevated">
                                    <div className="text-center">
                                        <div className="text-sm font-semibold text-text-primary">No data for this range</div>
                                        <div className="mt-1 text-label-dense text-text-secondary">Submit shift entries to see daily output here.</div>
                                    </div>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-border-subtle text-label-dense font-medium uppercase tracking-wide text-text-tertiary">
                                                <th className="px-3 py-2 text-left">Date</th>
                                                <th className="px-3 py-2 text-right tabular-nums">Units</th>
                                                <th className="px-3 py-2 text-right tabular-nums">Target</th>
                                                <th className="px-3 py-2 text-right tabular-nums">Perf %</th>
                                                <th className="px-3 py-2 text-right tabular-nums">Downtime</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {dailySeries.map((row) => (
                                                <tr key={row.date} className="border-b border-border-subtle hover:bg-surface-panel/60 transition-colors">
                                                    <td className="px-3 py-2 text-text-primary">{row.date}</td>
                                                    <td className="px-3 py-2 text-right tabular-nums text-text-primary">{row.units_produced.toLocaleString("en-IN")}</td>
                                                    <td className="px-3 py-2 text-right tabular-nums text-text-secondary">{row.units_target.toLocaleString("en-IN")}</td>
                                                    <td className="px-3 py-2 text-right tabular-nums text-text-primary">{row.performance_percent.toFixed(1)}%</td>
                                                    <td className="px-3 py-2 text-right tabular-nums text-text-secondary">{formatMinutes(row.downtime_minutes)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Shift breakdown */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Shift breakdown</CardTitle>
                            <p className="text-sm text-text-secondary">Which shift delivered strongest in the range.</p>
                        </CardHeader>
                        <CardContent>
                            {insightsLoading ? (
                                <div className="space-y-3">
                                    {[0, 1, 2].map((i) => (
                                        <div key={i} className="h-16 animate-pulse rounded-panel bg-surface-skeleton" />
                                    ))}
                                </div>
                            ) : shiftBreakdown.length === 0 ? (
                                <div className="flex h-48 items-center justify-center rounded-panel border border-border-subtle bg-surface-elevated">
                                    <div className="text-sm text-text-secondary">No shift data for this range.</div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {shiftBreakdown.map((shift) => (
                                        <div key={shift.shift} className="rounded-panel border border-border-subtle bg-surface-shell px-4 py-3">
                                            <div className="flex items-center justify-between gap-4">
                                                <div>
                                                    <div className="text-sm font-semibold capitalize text-text-primary">{shift.shift}</div>
                                                    <div className="text-label-dense text-text-secondary">{shift.entry_count} entries</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="tabular-nums text-sm font-semibold text-text-primary">{shift.units_produced.toLocaleString("en-IN")} units</div>
                                                    <div className="tabular-nums text-label-dense text-text-secondary">{shift.performance_percent.toFixed(1)}% · {formatMinutes(shift.downtime_minutes)} downtime</div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* OCR trust section */}
                {ocrSummary ? (
                    <Card>
                        <CardHeader className="flex flex-row items-start justify-between gap-4">
                            <div>
                                <div className="text-label-dense font-semibold text-status-processing-fg">OCR trust</div>
                                <CardTitle>Only approved OCR documents count as trusted downstream data.</CardTitle>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Link href="/ocr/verify"><Button variant="outline" size="compact">Review OCR</Button></Link>
                                <Link href="/approvals"><Button variant="outline" size="compact">Review queue</Button></Link>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                {[
                                    { label: "Approved docs", value: ocrSummary.trusted_documents },
                                    { label: "Trusted rows", value: ocrSummary.trusted_rows },
                                    { label: "Pending review", value: ocrSummary.pending_documents },
                                    { label: "Approval rate", value: ocrSummary.approval_rate != null ? `${(ocrSummary.approval_rate * 100).toFixed(0)}%` : "—" },
                                ].map((card) => (
                                    <div key={card.label} className="rounded-panel border border-border-subtle bg-surface-shell px-4 py-3">
                                        <div className="text-label-dense font-medium text-text-tertiary">{card.label}</div>
                                        <div className="mt-1 tabular-nums text-xl font-semibold text-text-primary">{card.value}</div>
                                    </div>
                                ))}
                            </div>
                            {ocrSummary.trust_note ? (
                                <p className="mt-3 text-label-dense text-text-secondary">{ocrSummary.trust_note}</p>
                            ) : null}
                        </CardContent>
                    </Card>
                ) : null}

                {/* Employee leaderboard */}
                {insights?.employee_leaderboard?.length ? (
                    <Card>
                        <CardHeader>
                            <CardTitle>Top contributors</CardTitle>
                            <p className="text-sm text-text-secondary">Employees ranked by units produced in the selected range.</p>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-border-subtle text-label-dense font-medium uppercase tracking-wide text-text-tertiary">
                                            <th className="px-3 py-2 text-left">Employee</th>
                                            <th className="px-3 py-2 text-right tabular-nums">Units</th>
                                            <th className="px-3 py-2 text-right tabular-nums">Target</th>
                                            <th className="px-3 py-2 text-right tabular-nums">Perf %</th>
                                            <th className="px-3 py-2 text-right tabular-nums">Entries</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {insights.employee_leaderboard.slice(0, 10).map((emp) => (
                                            <tr key={emp.user_id} className="border-b border-border-subtle hover:bg-surface-panel/60 transition-colors">
                                                <td className="px-3 py-2 font-medium text-text-primary">{emp.name}</td>
                                                <td className="px-3 py-2 text-right tabular-nums text-text-primary">{emp.units_produced.toLocaleString("en-IN")}</td>
                                                <td className="px-3 py-2 text-right tabular-nums text-text-secondary">{emp.units_target.toLocaleString("en-IN")}</td>
                                                <td className="px-3 py-2 text-right tabular-nums text-text-primary">{emp.performance_percent.toFixed(1)}%</td>
                                                <td className="px-3 py-2 text-right tabular-nums text-text-secondary">{emp.entries_count}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                ) : null}

                {/* Export actions */}
                <div className="flex flex-wrap gap-3 border-t border-border-subtle pt-4">
                    <Button onClick={handleExportExcel} disabled={exporting}>
                        {exporting ? "Exporting..." : "Export Excel"}
                    </Button>
                    <Link href="/email-summary">
                        <Button variant="outline">Compose email summary</Button>
                    </Link>
                    <Link href="/attendance/reports">
                        <Button variant="outline">Attendance reports</Button>
                    </Link>
                </div>

            </div>
        </main>
    );
}
