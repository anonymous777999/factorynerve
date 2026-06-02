/**
 * features/approvals — unified approval engine.
 *
 * Public surface: workspace + types + adapter map.
 */

export type {
    ApprovalKind,
    ApprovalSeverity,
    ApprovalAge,
    ApprovalAgeBand,
    ApprovalAction,
    ApprovalItem,
    ApprovalAdapter,
    ApproveDecision,
    RejectDecision,
} from "./types";

export { approvalAdapters } from "./adapters";

export * from "./workspaces";
