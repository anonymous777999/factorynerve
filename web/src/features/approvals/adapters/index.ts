/**
 * features/approvals/adapters — one adapter per ApprovalKind.
 *
 * To add a new approvable kind:
 *   1. Add the kind to `ApprovalKind` in ../types.ts
 *   2. Implement the adapter in this folder
 *   3. Register it in the `approvalAdapters` map below
 *
 * The queue UI then handles it for free.
 */

import type { ApprovalAdapter, ApprovalKind } from "../types";

import { attendanceApprovalAdapter } from "./attendance-approval.adapter";
import { entryApprovalAdapter } from "./entry-approval.adapter";
import { ocrApprovalAdapter } from "./ocr-approval.adapter";
import { reconciliationApprovalAdapter } from "./reconciliation-approval.adapter";

export const approvalAdapters: Partial<Record<ApprovalKind, ApprovalAdapter<unknown>>> = {
    attendance: attendanceApprovalAdapter as unknown as ApprovalAdapter<unknown>,
    entry: entryApprovalAdapter as unknown as ApprovalAdapter<unknown>,
    ocr: ocrApprovalAdapter as unknown as ApprovalAdapter<unknown>,
    reconciliation: reconciliationApprovalAdapter as unknown as ApprovalAdapter<unknown>,
    // dispatch: dispatchApprovalAdapter,      // pending — needs backend endpoint
    // batch: batchApprovalAdapter,            // pending — read-only signals only
};

export {
    attendanceApprovalAdapter,
    entryApprovalAdapter,
    ocrApprovalAdapter,
    reconciliationApprovalAdapter,
};

// Re-exported helpers — projection logic lives in the adapter so consumers
// (queue UI, work queue, command palette) reuse the same severity / age math.
export {
    deriveAttendanceFinalStatus,
    getAttendanceIssueLabel,
    getAttendanceSeverity,
} from "./attendance-approval.adapter";
export { getEntrySeverity } from "./entry-approval.adapter";
export { getOcrSeverity } from "./ocr-approval.adapter";
export { getReconciliationSeverity } from "./reconciliation-approval.adapter";
