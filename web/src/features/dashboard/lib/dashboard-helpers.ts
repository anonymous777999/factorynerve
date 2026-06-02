/**
 * features/dashboard/lib — pure helper functions and types for the
 * role-aware dashboard workspace.
 *
 * Extracted from dashboard-home.tsx so the giant workspace stays focused
 * on rendering. Anything stateless and side-effect-free that the
 * workspace uses lives here.
 */

import type { AlertItem, UsageSummary, WeeklyAnalyticsPoint } from "@/lib/dashboard";
import type { AnomalyResponse } from "@/lib/ai";
import type { AttendanceStatus, AttendanceToday } from "@/lib/attendance";
import type { Entry } from "@/lib/entries";
import type { EntryDraft } from "@/lib/offline-entries";
import type { OcrVerificationSummary } from "@/lib/ocr";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const ALL_SHIFTS = ["morning", "evening", "night"] as const;

export type DashboardState = {
    attendanceToday: AttendanceToday | null;
    draft: EntryDraft | null;
    todayEntries: Entry[];
    recentEntries: Entry[];
    usage: UsageSummary | null;
    alerts: AlertItem[];
    weekly: WeeklyAnalyticsPoint[];
    analyticsLocked: boolean;
    anomalyPreview: AnomalyResponse | null;
    anomalyLocked: boolean;
    ocrSummary: OcrVerificationSummary | null;
};

export type LaunchGuideStep = {
    title: string;
    detail: string;
    href: string;
    action: string;
};

export type RoleLaunchGuide = {
    eyebrow: string;
    title: string;
    detail: string;
    steps: LaunchGuideStep[];
};

export type DashboardQuickLink = {
    href: string;
    label: string;
    variant: "outline" | "ghost";
};

export type DashboardSnapshotCard = {
    label: string;
    value: string | number;
    detail: string;
    href: string;
    action: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function emptyState(): DashboardState {
    return {
        attendanceToday: null,
        draft: null,
        todayEntries: [],
        recentEntries: [],
        usage: null,
        alerts: [],
        weekly: [],
        analyticsLocked: false,
        anomalyPreview: null,
        anomalyLocked: false,
        ocrSummary: null,
    };
}

export function formatShift(value: string) {
    return value ? value[0].toUpperCase() + value.slice(1) : "-";
}

export function formatDate(value?: string, locale = "en-IN") {
    if (!value) return "-";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString(locale, {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

export function formatDateTime(value?: string, locale = "en-IN") {
    if (!value) return "-";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString(locale, {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export function formatMinutes(value: number) {
    const safeValue = Math.max(0, value || 0);
    const hours = Math.floor(safeValue / 60);
    const minutes = safeValue % 60;
    return `${hours}h ${minutes}m`;
}

export function attendanceStatusTone(status?: AttendanceStatus | null) {
    switch (status) {
        case "working":
            return "border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-fg)]";
        case "late":
        case "half_day":
            return "border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-fg)]";
        case "missed_punch":
        case "absent":
            return "border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-fg)]";
        case "completed":
            return "border-[var(--status-info-border)] bg-[var(--status-info-bg)] text-[var(--status-info-fg)]";
        default:
            return "border-[var(--border-subtle)] bg-[var(--surface-hover)] text-[var(--text-secondary)]";
    }
}

export function todayValue() {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export function severityTone(severity?: string) {
    switch ((severity || "").toLowerCase()) {
        case "high":
            return "border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-fg)]";
        case "medium":
            return "border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-fg)]";
        default:
            return "border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-fg)]";
    }
}

export function progressPercent(used?: number, max?: number) {
    if (!max || max <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round(((used || 0) / max) * 100)));
}

export function usageWarning(used?: number, max?: number) {
    if (!max || max <= 0) return "";
    const ratio = (used || 0) / max;
    if (ratio >= 1) return "Quota reached. Upgrade now or wait for monthly reset.";
    if (ratio >= 0.9) return "Quota almost full (90%+). Plan your next upgrade.";
    if (ratio >= 0.75) return "Quota warning: over 75% consumed this month.";
    return "";
}

export function signalRailCountsRefresh() {
    if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("dpr:rail-counts-refresh"));
    }
}
