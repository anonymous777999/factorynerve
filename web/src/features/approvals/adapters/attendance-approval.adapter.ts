/**
 * Attendance approval adapter.
 *
 * Converts the raw `AttendanceReviewItem` from the backend into the
 * unified `ApprovalItem` shape, and submits the kind-specific
 * approve/reject decisions to the attendance API.
 *
 * This is the worked example for the approval engine. New approvable
 * kinds follow the same shape:
 *   1. `fromBackend` — pure projection from raw → ApprovalItem
 *   2. `approve` / `reject` — wrap the kind-specific endpoint
 *   3. `evidenceHref` — where the queue card click-through lands
 */

import {
    approveAttendanceReview,
    rejectAttendanceReview,
    type AttendanceReviewFinalStatus,
    type AttendanceReviewItem,
} from "@/features/attendance";

import type {
    ApprovalAdapter,
    ApprovalAge,
    ApprovalAgeBand,
    ApprovalItem,
    ApprovalSeverity,
    ApproveDecision,
    RejectDecision,
} from "../types";

// ------------------------------------------------------------------
// Internal helpers — projection logic carved out of approvals-page.tsx
// ------------------------------------------------------------------

function getIssueLabel(item: AttendanceReviewItem): string {
    const requestType = item.regularization?.request_type || "";
    if (requestType === "missed_punch") return "Missed punch";
    if (requestType === "status_correction") return "Status correction";
    if (requestType === "shift_correction") return "Shift correction";
    if (requestType === "timing_correction") return "Timing correction";
    if (!item.punch_in_at || !item.punch_out_at || item.status === "missed_punch") return "Missed punch";
    if (item.status === "absent") return "Absent status";
    if (item.late_minutes > 0) return "Late entry";
    if (item.overtime_minutes > 0) return "Overtime check";
    return "Attendance review";
}

function getSeverity(item: AttendanceReviewItem): ApprovalSeverity {
    const issueLabel = getIssueLabel(item);
    if (item.status === "absent" || issueLabel === "Missed punch" || issueLabel === "Status correction") {
        return "critical";
    }
    if (issueLabel === "Shift correction" || issueLabel === "Late entry" || issueLabel === "Timing correction") {
        return "high";
    }
    if (item.overtime_minutes > 0 || (item.review_reason || "").trim().length > 0) {
        return "warning";
    }
    return "info";
}

function deriveFinalStatus(item: AttendanceReviewItem): AttendanceReviewFinalStatus {
    if (item.status === "absent") return "absent";
    if (item.punch_out_at) return "completed";
    return "working";
}

function getAge(timestamp: string): ApprovalAge {
    const parsed = new Date(timestamp);
    if (Number.isNaN(parsed.getTime())) {
        return { value: 0, unit: "min", label: "Recent", band: "fresh", weight: 0 };
    }
    const ageMs = Math.max(0, Date.now() - parsed.getTime());
    const ageHours = Math.floor(ageMs / (60 * 60 * 1000));
    const ageMinutes = Math.floor(ageMs / (60 * 1000));

    let band: ApprovalAgeBand = "fresh";
    if (ageHours >= 24) band = "stale";
    else if (ageHours >= 4) band = "aging";

    if (ageHours >= 24) {
        const days = Math.floor(ageHours / 24);
        return { value: days, unit: "day", label: `${days}d ago`, band, weight: 100 + ageHours };
    }
    if (ageHours >= 1) {
        return { value: ageHours, unit: "hour", label: `${ageHours}h ago`, band, weight: ageHours };
    }
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

// ------------------------------------------------------------------
// Adapter
// ------------------------------------------------------------------

export const attendanceApprovalAdapter: ApprovalAdapter<AttendanceReviewItem> = {
    kind: "attendance",

    fromBackend(raw: AttendanceReviewItem): ApprovalItem {
        const severity = getSeverity(raw);
        const issueLabel = getIssueLabel(raw);
        const timestamp = raw.regularization?.created_at || `${raw.attendance_date}T00:00:00`;
        const age = getAge(timestamp);

        return {
            id: raw.attendance_id,
            key: `attendance:${raw.attendance_id}`,
            kind: "attendance",
            typeLabel: "Attendance review",
            severity,
            title: `${raw.name} · ${formatDate(raw.attendance_date)} · ${formatShift(raw.shift)}`,
            detail:
                raw.review_reason ||
                `${issueLabel} · status ${raw.status}. Needs supervisor decision before payroll closes.`,
            evidence: {
                href: "/attendance/review",
                label: "Open attendance review",
            },
            age,
            canApprove: true,
            canReject: true,
        };
    },

    async approve(id, payload: ApproveDecision) {
        const regularizationId = payload.extra?.regularizationId as number | null | undefined;
        const finalStatus = payload.extra?.finalStatus as AttendanceReviewFinalStatus | undefined;
        if (!finalStatus) {
            throw new Error("Attendance approve requires `finalStatus` in payload.extra.");
        }
        await approveAttendanceReview(Number(id), {
            regularization_id: regularizationId ?? null,
            final_status: finalStatus,
            note: payload.notes || null,
        });
    },

    async reject(id, payload: RejectDecision) {
        const regularizationId = payload.extra?.regularizationId as number | null | undefined;
        if (!payload.reason || !payload.reason.trim()) {
            throw new Error("Attendance reject requires a reason.");
        }
        await rejectAttendanceReview(Number(id), {
            regularization_id: regularizationId ?? null,
            note: payload.reason.trim(),
        });
    },

    evidenceHref() {
        return "/attendance/review";
    },
};

export { deriveFinalStatus as deriveAttendanceFinalStatus, getIssueLabel as getAttendanceIssueLabel, getSeverity as getAttendanceSeverity };
