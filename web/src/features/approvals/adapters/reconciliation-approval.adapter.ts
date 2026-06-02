/**
 * Reconciliation approval adapter.
 *
 * Stock count vs. system ledger variance review. Admin/owner-gated.
 */

import {
    approveSteelReconciliation,
    rejectSteelReconciliation,
    type SteelReconciliation,
} from "@/features/steel";

import type {
    ApprovalAdapter,
    ApprovalAge,
    ApprovalAgeBand,
    ApprovalItem,
    ApprovalSeverity,
} from "../types";

const APPROVING_ROLES = new Set(["admin", "owner"]);

function getSeverity(record: SteelReconciliation): ApprovalSeverity {
    switch ((record.confidence_status || "").toLowerCase()) {
        case "red":
            return "critical";
        case "yellow":
            return "high";
        default:
            return "warning";
    }
}

function getAge(timestamp: string | null | undefined): ApprovalAge {
    if (!timestamp) {
        return { value: 0, unit: "min", label: "Recent", band: "fresh", weight: 0 };
    }
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

function formatKg(value: number | null | undefined, fractionDigits = 1): string {
    if (value == null || Number.isNaN(value)) return "-";
    return value.toFixed(fractionDigits);
}

export const reconciliationApprovalAdapter: ApprovalAdapter<SteelReconciliation> = {
    kind: "reconciliation",

    fromBackend(record: SteelReconciliation, viewer): ApprovalItem {
        const severity = getSeverity(record);
        const role = (viewer?.role || "").toLowerCase();
        const canDecide = APPROVING_ROLES.has(role);
        const age = getAge(record.counted_at);

        const variance = record.variance_kg ?? 0;
        const sign = variance > 0 ? "+" : "";
        const detail = [
            `Variance ${sign}${formatKg(variance)} KG (${formatKg(record.variance_percent)}%)`,
            `${record.confidence_status} confidence`,
            record.counted_by_name ? `counted by ${record.counted_by_name}` : null,
        ]
            .filter(Boolean)
            .join(" · ");

        return {
            id: record.id,
            key: `reconciliation:${record.id}`,
            kind: "reconciliation",
            typeLabel: "Stock review",
            severity,
            title: record.item_name || record.item_code || `Item #${record.item_id}`,
            detail,
            evidence: {
                href: `/steel/reconciliations?id=${record.id}`,
                label: "Open stock review",
            },
            age,
            canApprove: canDecide,
            canReject: canDecide,
            restrictedReason: canDecide
                ? undefined
                : "Admin or owner role required to approve stock variance.",
        };
    },

    async approve(id, payload) {
        await approveSteelReconciliation(Number(id), {
            approver_notes: payload.notes || null,
        });
    },

    async reject(id, payload) {
        if (!payload.reason || !payload.reason.trim()) {
            throw new Error("Reconciliation reject requires a reason.");
        }
        const reason = payload.reason.trim();
        await rejectSteelReconciliation(Number(id), {
            rejection_reason: reason,
            approver_notes: payload.notes || reason,
        });
    },

    evidenceHref(item) {
        return `/steel/reconciliations?id=${item.id}`;
    },
};


export { getSeverity as getReconciliationSeverity };
