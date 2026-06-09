/**
 * Entry (DPR) approval adapter.
 *
 * Routes pending shift entries through the unified approval engine.
 */

import { approveEntry, rejectEntry, type Entry } from "@/features/entry";

import type {
    ApprovalAdapter,
    ApprovalAge,
    ApprovalAgeBand,
    ApprovalItem,
    ApprovalSeverity,
} from "../types";

function getSeverity(entry: Entry): ApprovalSeverity {
    const performance =
        entry.units_target > 0 ? (entry.units_produced / entry.units_target) * 100 : null;
    if (
        entry.quality_issues ||
        (performance != null && performance < 50) ||
        entry.downtime_minutes >= 90
    ) {
        return "critical";
    }
    if ((performance != null && performance < 75) || entry.downtime_minutes >= 30) {
        return "high";
    }
    if (
        entry.downtime_minutes > 0 ||
        entry.manpower_absent > 0 ||
        (performance != null && performance < 100)
    ) {
        return "warning";
    }
    return "info";
}

function getAge(timestamp: string): ApprovalAge {
    const parsed = new Date(timestamp);
    if (Number.isNaN(parsed.getTime())) {
        return { value: 0, unit: "min", label: "Recent", band: "fresh", weight: 0 };
    }
    const ageMs = Math.max(0, Date.now() - parsed.getTime());
    const ageHours = Math.floor(ageMs / (60 * 60 * 1000));

    let band: ApprovalAgeBand = "fresh";
    if (ageHours >= 24) band = "stale";
    else if (ageHours >= 8) band = "aging";

    if (ageHours >= 24) {
        const days = Math.floor(ageHours / 24);
        return { value: days, unit: "day", label: `${days}d ago`, band, weight: 100 + ageHours };
    }
    if (ageHours >= 1) {
        return { value: ageHours, unit: "hour", label: `${ageHours}h ago`, band, weight: ageHours };
    }
    const ageMinutes = Math.floor(ageMs / (60 * 1000));
    return { value: ageMinutes, unit: "min", label: `${ageMinutes}m ago`, band, weight: 0 };
}

function formatShift(shift: string): string {
    if (!shift) return "-";
    return shift.charAt(0).toUpperCase() + shift.slice(1);
}

function formatDate(value: string | null | undefined): string {
    if (!value) return "-";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export const entryApprovalAdapter: ApprovalAdapter<Entry> = {
    kind: "entry",

    fromBackend(entry: Entry): ApprovalItem {
        const severity = getSeverity(entry);
        const timestamp = entry.updated_at || entry.created_at || `${entry.date}T00:00:00`;
        const age = getAge(timestamp);
        const performance =
            entry.units_target > 0
                ? Math.round((entry.units_produced / entry.units_target) * 100)
                : null;
        const blockers = [
            entry.quality_issues ? "quality issue raised" : null,
            entry.downtime_minutes > 0 ? `${entry.downtime_minutes} min downtime` : null,
            entry.manpower_absent > 0 ? `${entry.manpower_absent} absent` : null,
        ].filter(Boolean);

        return {
            id: entry.id,
            key: `entry:${entry.id}`,
            kind: "entry",
            typeLabel: "DPR entry",
            severity,
            title: `${formatDate(entry.date)} · ${formatShift(entry.shift)}`,
            detail:
                blockers.length > 0
                    ? blockers.join(" · ")
                    : `${performance != null ? `${performance}% performance` : `${entry.units_produced} units`} · ready for supervisor review`,
            evidence: {
                href: `/entry/${entry.id}`,
                label: "Open shift entry",
            },
            age,
            canApprove: true,
            canReject: true,
        };
    },

    async approve(id) {
        await approveEntry(Number(id));
    },

    async reject(id, payload) {
        if (!payload.reason || !payload.reason.trim()) {
            throw new Error("Entry reject requires a reason.");
        }
        await rejectEntry(Number(id), payload.reason.trim());
    },

    evidenceHref(item) {
        return `/entry/${item.id}`;
    },
};


// Helpers exported for consumers that need projection bits without the full ApprovalItem.
export { getSeverity as getEntrySeverity };
