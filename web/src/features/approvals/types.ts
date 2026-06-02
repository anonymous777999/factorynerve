/**
 * features/approvals/types — the unified approval contract.
 *
 * Every approvable thing in the product (attendance regularization,
 * shift entry edit, OCR doc, stock reconciliation, dispatch edit,
 * future credit limit, future invoice adjustment) flows through this
 * shape via a per-kind adapter.
 *
 * The queue UI never branches on `kind` — it always operates on
 * `ApprovalItem`. New kinds add an adapter and register here.
 */

export type ApprovalKind =
    | "attendance"
    | "entry"
    | "ocr"
    | "reconciliation"
    | "dispatch"
    | "batch";

export type ApprovalSeverity = "critical" | "high" | "warning" | "info";

export type ApprovalAgeBand = "fresh" | "aging" | "stale";

export type ApprovalAction = "approve" | "reject" | "send_back";

export interface ApprovalAge {
    /** Numeric age value. */
    value: number;
    unit: "min" | "hour" | "day";
    label: string;
    band: ApprovalAgeBand;
    /** Sortable weight (higher = older). */
    weight: number;
}

export interface ApprovalEvidenceLink {
    href: string;
    label: string;
}

/**
 * The shape every approval-queue card consumes.
 */
export interface ApprovalItem {
    id: number | string;
    /** Composite key for React: kind + id. */
    key: string;
    kind: ApprovalKind;
    /** Short type label e.g. "Shift entry" or "OCR doc". */
    typeLabel: string;
    severity: ApprovalSeverity;
    title: string;
    detail: string;
    /** Optional click-through to the underlying record. */
    evidence?: ApprovalEvidenceLink;
    age: ApprovalAge;
    /** Has the current viewer the right to approve? */
    canApprove: boolean;
    /** Has the current viewer the right to reject? */
    canReject: boolean;
    /** When canApprove + canReject are both false, why. */
    restrictedReason?: string;
}

/**
 * Per-kind decision payloads. Adapters handle their own shapes.
 */
export interface ApproveDecision {
    notes?: string;
    /** Adapter-specific extra fields. */
    extra?: Record<string, unknown>;
}

export interface RejectDecision {
    reason: string;
    notes?: string;
    extra?: Record<string, unknown>;
}

/**
 * Each kind ships an adapter that knows how to:
 *   1. Convert the raw backend row to ApprovalItem.
 *   2. Submit the approve/reject decision.
 *   3. Tell the queue where to click through.
 */
export interface ApprovalAdapter<TRaw> {
    kind: ApprovalKind;
    fromBackend(raw: TRaw, viewer: { role: string; userId: number }): ApprovalItem;
    approve(id: ApprovalItem["id"], payload: ApproveDecision): Promise<void>;
    reject(id: ApprovalItem["id"], payload: RejectDecision): Promise<void>;
    /** Where the queue card click-through should land. */
    evidenceHref?(item: ApprovalItem): string;
}
