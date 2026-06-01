"use client";

import Link from "next/link";
import { useMemo, useState, useCallback } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/use-session";

// Mock data types for the intelligence workspace
type ReportMetrics = {
    unitsProduced: number;
    unitsTarget: number;
    performance: number;
    downtime: number;
    activeTeam: number;
    attendanceRate: number;
};

type ShiftData = {
    shift: "morning" | "evening" | "night";
    units: number;
    downtime: number;
    performance: number;
};

type SteelSignal = {
    type: "revenue" | "profit" | "outstanding" | "leakage";
    label: string;
    value: string;
    status: "restricted" | "available";
    description: string;
};

type OcrTrustMetrics = {
    approvedDocs: number;
    trustedRows: number;
    pendingReview: number;
    lastApproval: string;
    approvalRate: number;
};

// Mock data
const mockMetrics: ReportMetrics = {
    unitsProduced: 0,
    unitsTarget: 0,
    performance: 0.0,
    downtime: 0,
    activeTeam: 0,
    attendanceRate: 0.0,
};

const mockShiftData: ShiftData[] = [
    { shift: "morning", units: 0, downtime: 0, performance: 0.0 },
    { shift: "evening", units: 0, downtime: 0, performance: 0.0 },
    { shift: "night", units: 0, downtime: 0, performance: 0.0 },
];

const mockSteelSignals: SteelSignal[] = [
    {
        type: "revenue",
        label: "Realized Revenue",
        value: "Restricted",
        status: "restricted",
        description: "Revenue already backed by dispatch activity in the steel flow.",
    },
    {
        type: "profit",
        label: "Realized Profit",
        value: "Restricted",
        status: "restricted",
        description: "Visible to owner role only.",
    },
    {
        type: "outstanding",
        label: "Outstanding",
        value: "Restricted",
        status: "restricted",
        description: "Open invoice value still waiting to be dispatched or settled.",
    },
    {
        type: "leakage",
        label: "Leakage Exposure",
        value: "Restricted",
        status: "restricted",
        description: "10 KG variance across ranked anomaly batches.",
    },
];

const mockOcrTrust: OcrTrustMetrics = {
    approvedDocs: 1,
    trustedRows: 33,
    pendingReview: 0,
    lastApproval: "03 May 2026, 06:27 pm",
    approvalRate: 100,
};

function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

export default function ReportsIntelligenceWorkspace() {
    const { user, loading, activeFactory } = useSession();
    const [startDate, setStartDate] = useState("2026-05-19");
    const [endDate, setEndDate] = useState("2026-05-26");
    const [selectedRange, setSelectedRange] = useState("Last 7d");
    const [aiSummaryGenerated, setAiSummaryGenerated] = useState(false);

    const handleQuickRange = useCallback((range: string) => {
        setSelectedRange(range);
        const today = new Date();
        const todayStr = today.toISOString().slice(0, 10);

        switch (range) {
            case "Today":
                setStartDate(todayStr);
                setEndDate(todayStr);
                break;
            case "Last 7d":
                const weekAgo = new Date(today);
                weekAgo.setDate(today.getDate() - 7);
                setStartDate(weekAgo.toISOString().slice(0, 10));
                setEndDate(todayStr);
                break;
            case "This Month":
                const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
                setStartDate(monthStart.toISOString().slice(0, 10));
                setEndDate(todayStr);
                break;
        }
    }, []);

    const handleUpdateReport = useCallback(() => {
        // Update report for the selected date range
    }, [startDate, endDate]);

    const handleGenerateAiSummary = useCallback(() => {
        setAiSummaryGenerated(true);
    }, []);

    if (loading) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-surface-app text-label-dense text-text-secondary">
                Loading reports workspace...
            </main>
        );
    }

    if (!user) {
        return (
            <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-md">
                <Card className="w-full">
                    <CardHeader>
                        <CardTitle>Attendance Reports / Data Intelligence</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="text-sm text-error">Please sign in to continue.</div>
                        <Link href="/access">
                            <Button>Open Access</Button>
                        </Link>
                    </CardContent>
                </Card>
            </main>
        );
    }

    return (
        <main className="reports-intelligence-scope min-h-screen bg-surface-app">
            {/* Compact Operational Header */}
            <header className="reports-intelligence-header border-b border-border-subtle bg-surface-shell px-6 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-xl font-semibold text-text-primary">
                                Attendance Reports / Data Intelligence
                            </h1>
                            <div className="flex items-center gap-2">
                                <div className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                                    STATUS:
                                </div>
                                <Badge status="synced">CONNECTED</Badge>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                                ALERTS (0)
                            </span>
                        </div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                            Workspace
                        </div>
                    </div>
                </div>
            </header>

            {/* Live Operational Reminder Strip */}
            <section className="reports-intelligence-reminder border-b border-border-subtle bg-status-processing-bg px-6 py-3">
                <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-processing"></div>
                    <div>
                        <span className="text-sm font-medium text-processing">
                            Attendance review is waiting
                        </span>
                        <span className="ml-2 text-sm text-text-secondary">
                            1 attendance issue needs closure. Review output, exports, and operating signals across the selected range.
                        </span>
                    </div>
                    <Link href="/attendance/review">
                        <Button size="compact" className="ml-auto">
                            Review Attendance
                        </Button>
                    </Link>
                </div>
            </section>

            <div className="reports-intelligence-workspace flex min-h-0 flex-1 flex-col p-6">
                {/* Reporting Range Controls */}
                <section className="reports-range-controls mb-6">
                    <div className="grid gap-6 lg:grid-cols-2">
                        {/* Step 1: Pick Range */}
                        <Card className="operational-card">
                            <CardHeader>
                                <div className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                                    Step 1
                                </div>
                                <CardTitle className="text-lg">Pick range</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex gap-3">
                                    {["Today", "Last 7d", "This Month"].map((range) => (
                                        <Button
                                            key={range}
                                            variant={selectedRange === range ? "primary" : "outline"}
                                            size="compact"
                                            onClick={() => handleQuickRange(range)}
                                        >
                                            {range}
                                        </Button>
                                    ))}
                                </div>
                                <div className="grid gap-3 md:grid-cols-2">
                                    <div>
                                        <label className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                                            Start Date
                                        </label>
                                        <Input
                                            aria-label="Start date"
                                            type="date"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                            className="mt-1"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                                            End Date
                                        </label>
                                        <Input
                                            aria-label="End date"
                                            type="date"
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                            className="mt-1"
                                        />
                                    </div>
                                </div>
                                <Button onClick={handleUpdateReport} className="w-full">
                                    Update Report
                                </Button>
                                <div className="text-xs text-text-secondary">
                                    Applied range: {startDate} to {endDate}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Step 2: Export Report */}
                        <Card className="operational-card">
                            <CardHeader>
                                <div className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                                    Step 2
                                </div>
                                <CardTitle className="text-lg">Export report</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="text-sm text-text-secondary">
                                    Export Excel first. Use other formats only when needed.
                                </div>
                                <Button className="w-full">Export Excel</Button>
                                <Button variant="outline" className="w-full">
                                    More exports
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </section>

                {/* Manager Reporting Board */}
                <section className="manager-reporting-board mb-6">
                    <Card className="operational-card">
                        <CardHeader>
                            <CardTitle className="text-lg">Manager Reporting Board</CardTitle>
                            <p className="text-sm text-text-secondary">
                                This board converts selected range into visual production insights
                            </p>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-4 md:grid-cols-4">
                                <div className="operational-metric-card">
                                    <div className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                                        Units Produced
                                    </div>
                                    <div className="mt-2 text-3xl font-bold text-text-primary">
                                        {mockMetrics.unitsProduced}
                                    </div>
                                    <div className="mt-1 text-xs text-text-secondary">
                                        {mockMetrics.unitsTarget} target across 0 reports.
                                    </div>
                                </div>
                                <div className="operational-metric-card">
                                    <div className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                                        Performance
                                    </div>
                                    <div className="mt-2 text-3xl font-bold text-text-primary">
                                        {mockMetrics.performance.toFixed(1)}%
                                    </div>
                                    <div className="mt-1 text-xs text-text-secondary">
                                        Attendance held at {mockMetrics.attendanceRate.toFixed(1)}% in window.
                                    </div>
                                </div>
                                <div className="operational-metric-card">
                                    <div className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                                        Downtime
                                    </div>
                                    <div className="mt-2 text-3xl font-bold text-text-primary">
                                        {mockMetrics.downtime} min
                                    </div>
                                    <div className="mt-1 text-xs text-text-secondary">
                                        0 entries flagged with quality issues.
                                    </div>
                                </div>
                                <div className="operational-metric-card">
                                    <div className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                                        Active Team
                                    </div>
                                    <div className="mt-2 text-3xl font-bold text-text-primary">
                                        {mockMetrics.activeTeam}
                                    </div>
                                    <div className="mt-1 text-xs text-text-secondary">
                                        8 day window from 19 May to 26 May.
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </section>

                {/* Production Analytics Charts */}
                <section className="production-analytics mb-6">
                    <div className="grid gap-6 lg:grid-cols-2">
                        {/* Production vs Target Chart */}
                        <Card className="operational-card">
                            <CardHeader>
                                <CardTitle className="text-lg">Production vs Target: Daily Output Chart</CardTitle>
                                <p className="text-sm text-text-secondary">
                                    Bars compare actual output to target for each day
                                </p>
                            </CardHeader>
                            <CardContent>
                                <div className="flex h-48 items-center justify-center rounded-lg border border-border-subtle bg-surface-elevated">
                                    <div className="text-center">
                                        <div className="text-lg font-semibold text-text-primary">
                                            No daily output records yet
                                        </div>
                                        <div className="mt-2 text-sm text-text-secondary">
                                            Daily output bars appear after reports with units produced or target values are available in the selected range.
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Shift Mix Analysis */}
                        <Card className="operational-card">
                            <CardHeader>
                                <CardTitle className="text-lg">Shift Mix: Which shift delivered strongest</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {mockShiftData.map((shift) => (
                                        <div key={shift.shift} className="operational-shift-card">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="text-sm font-semibold capitalize text-text-primary">
                                                        {shift.shift}
                                                    </div>
                                                    <div className="text-xs text-text-secondary">
                                                        {shift.performance.toFixed(1)}%
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-sm font-medium text-text-primary">
                                                        {shift.units} units
                                                    </div>
                                                    <div className="text-xs text-text-secondary">
                                                        {shift.downtime} min downtime
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </section>

                {/* Steel Owner Signals */}
                <section className="steel-owner-signals mb-6">
                    <Card className="operational-card">
                        <CardHeader>
                            <CardTitle className="text-lg">Steel Owner Signals</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-4 md:grid-cols-4">
                                {mockSteelSignals.map((signal) => (
                                    <div key={signal.type} className="operational-signal-card">
                                        <div className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                                            {signal.label}
                                        </div>
                                        <div className="mt-2 text-lg font-bold text-warning">
                                            {signal.value}
                                        </div>
                                        <div className="mt-2 text-xs text-text-secondary">
                                            {signal.description}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </section>

                {/* OCR Trust Intelligence */}
                <section className="ocr-trust-intelligence mb-6">
                    <Card className="operational-card border-info bg-info/5">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <div className="text-xs font-semibold uppercase tracking-wide text-info">
                                    OCR Trust
                                </div>
                                <CardTitle className="text-lg">Only approved OCR documents count as trusted downstream data.</CardTitle>
                            </div>
                            <div className="flex gap-2">
                                <Link href="/ocr/verify">
                                    <Button variant="outline" size="compact">
                                        Review OCR
                                    </Button>
                                </Link>
                                <Link href="/approvals">
                                    <Button variant="outline" size="compact">
                                        Review Queue
                                    </Button>
                                </Link>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-4 md:grid-cols-4">
                                <div className="operational-metric-card">
                                    <div className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                                        Approved Docs
                                    </div>
                                    <div className="mt-2 text-2xl font-bold text-text-primary">
                                        {mockOcrTrust.approvedDocs}
                                    </div>
                                </div>
                                <div className="operational-metric-card">
                                    <div className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                                        Trusted Rows
                                    </div>
                                    <div className="mt-2 text-2xl font-bold text-text-primary">
                                        {mockOcrTrust.trustedRows}
                                    </div>
                                </div>
                                <div className="operational-metric-card">
                                    <div className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                                        Pending Review
                                    </div>
                                    <div className="mt-2 text-2xl font-bold text-text-primary">
                                        {mockOcrTrust.pendingReview}
                                    </div>
                                </div>
                                <div className="operational-metric-card">
                                    <div className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                                        Last Approval
                                    </div>
                                    <div className="mt-2 text-sm font-semibold text-text-primary">
                                        {mockOcrTrust.lastApproval}
                                    </div>
                                    <div className="mt-1 text-xs text-text-secondary">
                                        Approval rate: {mockOcrTrust.approvalRate}%
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </section>

                {/* Executive AI Summary */}
                <section className="executive-ai-summary mb-6">
                    <Card className="operational-card">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-lg">Executive Summary</CardTitle>
                            </div>
                            <Button onClick={handleGenerateAiSummary}>
                                Generate Summary
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-6 lg:grid-cols-2">
                                <div className="operational-summary-panel">
                                    <div className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                                        AI Analysis Summary
                                    </div>
                                    <div className="mt-4 text-sm text-text-secondary">
                                        {aiSummaryGenerated ? (
                                            "Executive summary generated for the selected date range. Production metrics show baseline performance with no significant quality issues detected. Attendance compliance maintained within operational parameters."
                                        ) : (
                                            "Generate a management summary for the currently selected date range."
                                        )}
                                    </div>
                                    <Button
                                        variant="outline"
                                        className="mt-4"
                                        onClick={handleGenerateAiSummary}
                                    >
                                        Run Inference
                                    </Button>
                                </div>
                                <div className="operational-metrics-panel">
                                    <div className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                                        Metrics at a Glance
                                    </div>
                                    <div className="mt-4 grid gap-3 grid-cols-2">
                                        <div>
                                            <div className="text-xs text-text-secondary">Units</div>
                                            <div className="text-lg font-semibold text-text-primary">-</div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-text-secondary">Target</div>
                                            <div className="text-lg font-semibold text-text-primary">-</div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-text-secondary">Performance</div>
                                            <div className="text-lg font-semibold text-text-primary">-</div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-text-secondary">Downtime</div>
                                            <div className="text-lg font-semibold text-text-primary">-</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </section>

                {/* Report Footer / Pagination Layer */}
                <section className="report-footer">
                    <Card className="operational-card">
                        <CardContent className="flex items-center justify-between py-4">
                            <div className="text-sm text-text-secondary">
                                0 rows on this page
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="text-sm text-text-secondary">Page 1 of 1</span>
                                <Button variant="outline" size="compact" disabled>
                                    Prev
                                </Button>
                                <Button variant="outline" size="compact" disabled>
                                    Next
                                </Button>
                                <span className="text-sm text-text-secondary">Total 0</span>
                            </div>
                        </CardContent>
                    </Card>
                </section>
            </div>
        </main>
    );
}