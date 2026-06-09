/**
 * features/steel — steel industry module.
 *
 * Industry-specific workflows: heat numbers, grades, weight-based
 * inventory, batch traceability, weighbridge dispatch reconciliation.
 *
 * When new industries arrive (textile, food, rubber), copy this folder
 * shape and namespace under /textile, /food, /rubber. The OCR,
 * attendance, approvals, and dashboard features are industry-agnostic.
 */

export * from "./workspaces";
export * as steelApi from "./api/steel";
export * as steelHelpers from "./lib/steel-helpers";

// Direct named re-exports for cross-feature consumers (approvals adapters).
export {
    approveSteelReconciliation,
    rejectSteelReconciliation,
} from "./api/steel";

export type { SteelReconciliation } from "./api/steel";
