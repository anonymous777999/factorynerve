/**
 * OCR approval adapter.
 *
 * Routes pending OCR verifications through the unified approval engine.
 * OCR is role-gated: only manager/admin/owner can approve or reject.
 */

import {
    approveOcrVerification,
    rejectOcrVerification,
    type OcrVerificationRecord,
} from "@/features/ocr";

import type {
    ApprovalAdapter,
    ApprovalAge,
    ApprovalAgeBand,
    ApprovalItem,
    ApprovalSeverity,
} from "../types";

const APPROVING_ROLES = new Set(["manager", "admin", "owner"]);

function getSeverity(record: OcrVerificationRecord): ApprovalSeverity {
    if (record.avg_confidence < 60 || record.warnings.length >= 3) return "critical";
    if (record.avg_confidence < 75 || record.warnings.length >= 1) return "high";
    if (record.avg_confidence < 88) return "warning";
    return "info";
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

export const ocrApprovalAdapter: ApprovalAdapter<OcrVerificationRecord> = {
    kind: "ocr",

    fromBackend(record: OcrVerificationRecord, viewer): ApprovalItem {
        const severity = getSeverity(record);
        const role = (viewer?.role || "").toLowerCase();
        const canDecide = APPROVING_ROLES.has(role);
        const timestamp = record.submitted_at || record.created_at || record.updated_at || null;
        const age = getAge(timestamp);

        const confidencePercent = Math.round(record.avg_confidence || 0);
        const warningCount = record.warnings?.length ?? 0;
        const detailParts = [
            `${confidencePercent}% confidence`,
            warningCount > 0 ? `${warningCount} warning${warningCount === 1 ? "" : "s"}` : null,
        ].filter(Boolean);

        return {
            id: record.id,
            key: `ocr:${record.id}`,
            kind: "ocr",
            typeLabel: "OCR review",
            severity,
            title: record.source_filename || `Verification #${record.id}`,
            detail: detailParts.join(" · "),
            evidence: {
                href: `/ocr/verify?id=${record.id}&step=4&pane=workspace`,
                label: "Open document review",
            },
            age,
            canApprove: canDecide,
            canReject: canDecide,
            restrictedReason: canDecide
                ? undefined
                : "Manager or higher role required to approve OCR documents.",
        };
    },

    async approve(id, payload) {
        await approveOcrVerification(Number(id), payload.notes || "");
    },

    async reject(id, payload) {
        if (!payload.reason || !payload.reason.trim()) {
            throw new Error("OCR reject requires a reason.");
        }
        const reason = payload.reason.trim();
        // Backend takes both a rejection_reason and reviewer_notes; reuse the
        // reason for both unless adapter consumers pass extra notes.
        await rejectOcrVerification(Number(id), reason, payload.notes || reason);
    },

    evidenceHref(item) {
        return `/ocr/verify?id=${item.id}&step=4&pane=workspace`;
    },
};


export { getSeverity as getOcrSeverity };
