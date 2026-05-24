# DPR.ai Frontend Operational Primitives Audit

## Completed primitives

- `WorkstationShell`: standard route header, density-aware metric band, filter zone, action zone, optional right rail.
- `SectionPanel`: unified operational panel header/body/footer structure for queue, workspace, and rail sections.
- `OperationalTable`: page-level wrapper around the existing virtualized data table with standardized panel framing.
- `ActionDock`: standardized sticky action surface for approvals, reconciliation, and bulk decision states.
- `QueueWorkspaceLayout`: shared queue-to-detail split for desktop and stacked mobile flow.
- `StatusBadge`: semantic operational badge wrapper for approval, reconciliation, processing, synced, and error states.
- `MetricStrip`: dense KPI row for queue counts, drift, sync health, and workstation throughput.
- `FilterBar`: upgraded to support title, result count, actions, and footer while remaining backward-compatible.
- `EmptyOperationalState`: standardized empty/error/idle messaging surface for route and queue gaps.
- `LoadingBoundary`: kept as the state wrapper and extended with clearer operational loading/empty labeling.

## Audit findings still visible in the app

- `ApprovalsPage` still carries custom cards, pills, tables, and mobile detail presentation instead of the new primitive layer.
- OCR scan and OCR verification continue to own workflow continuity locally, including step memory and mobile workspace state.
- Inventory, production, and reconciliation pages have not yet been migrated to the shared `WorkstationShell` and `QueueWorkspaceLayout` patterns.
- Route continuity remains fragmented where URL state and session-backed UI state diverge, especially in OCR and steel workflows.
- Action placement is still inconsistent between route headers, inline buttons, sticky footers, and modal-like overlays outside the new primitives.

## Pending tech debt before Phase 3 route refactors

- Replace one-off severity color classes in feature pages with `StatusBadge` and tokenized panel states.
- Move page-owned filter rows and queue headers onto `FilterBar`, `MetricStrip`, and `OperationalTable`.
- Normalize mobile detail behavior so browser back navigation closes workspace/detail views instead of discarding context.
- Reduce session-storage dependence in OCR and steel flow continuity so refresh-safe routing becomes URL-first.
- Audit large page components for render churn before swapping in primitives on low-end tablets.

## Refactor order

1. OCR
2. Approvals
3. Inventory
4. Production
5. Reconciliation
