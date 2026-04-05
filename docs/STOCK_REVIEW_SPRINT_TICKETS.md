# Stock Review Sprint Tickets

Updated: 2026-04-03

Source plan:

- `docs/STOCK_REVIEW_FACTORY_INTELLIGENCE_PLAN.md`

## Planning Assumptions

- Sprint length: 1 week
- Estimation unit: ideal engineering days
- Team lanes:
- Backend = API, schema, service logic, migration
- Frontend = route UI, interaction flows
- QA = contract tests, role tests, regression checks

## Ticket List

### SR-001: Reconciliation Summary KPI Endpoint

- Owner: Backend
- Estimate: 2 days
- Dependencies: None
- Scope: Add `GET /steel/inventory/reconciliations/summary` with stock accuracy, mismatch count, pending count, stale count, last review timestamp.
- Acceptance criteria:
- Endpoint returns KPI payload for active steel factory.
- Accuracy and mismatch calculations are deterministic and tested.
- Response is permission-scoped to valid steel roles.

### SR-002: Variance Reason Taxonomy + Validation

- Owner: Backend
- Estimate: 1.5 days
- Dependencies: None
- Scope: Define reason code enum (count_error, moisture, scrap_loss, posting_delay, unknown), validate in create or review payloads.
- Acceptance criteria:
- Invalid reason codes are rejected with 422.
- Reason code persists and is returned in reconciliation payloads.
- Unit tests cover enum and validation errors.

### SR-003: Stale Review + Repeat Mismatch Detection Service

- Owner: Backend
- Estimate: 2 days
- Dependencies: SR-001
- Scope: Service logic for stale reviews by SLA window and rolling 30-day repeated mismatch detector by item.
- Acceptance criteria:
- Service outputs stale and repeat counts with consistent thresholds.
- KPI endpoint includes stale and repeat values.
- Tests cover edge dates and rolling-window behavior.

### SR-004: Location Model + Migration

- Owner: Backend
- Estimate: 2.5 days
- Dependencies: None
- Scope: Create `steel_inventory_locations` model with indexed `factory_id`, unique `location_code` per factory, active flag.
- Acceptance criteria:
- Migration applies on existing DB without data loss.
- Model is registered and queryable in router/service layers.
- Duplicate location codes in same factory are blocked.

### SR-005: Location Linkage In Inventory Transactions

- Owner: Backend
- Estimate: 2 days
- Dependencies: SR-004
- Scope: Add nullable `location_id` on `steel_inventory_transactions`, update serializers and creation logic.
- Acceptance criteria:
- Existing transactions remain readable with null `location_id`.
- New transactions can optionally persist valid `location_id`.
- API rejects location IDs from other factories.

### SR-006: Review Session + Session Line Models

- Owner: Backend
- Estimate: 3 days
- Dependencies: SR-004
- Scope: Add `steel_stock_review_sessions` and `steel_stock_review_lines` with statuses, snapshots, severity, and actor metadata.
- Acceptance criteria:
- Session and line tables migrate cleanly.
- Session status values are constrained and validated.
- Snapshot fields store system quantity at count time.

### SR-007: Session Create + Line Upsert APIs

- Owner: Backend
- Estimate: 3 days
- Dependencies: SR-006
- Scope: Implement create session, fetch session detail, upsert line count endpoints.
- Acceptance criteria:
- Manager can create draft session with scope.
- Line upsert computes variance KG and percent from snapshot.
- API prevents writes to submitted or closed sessions.

### SR-008: Session Submit + Approval or Rejection APIs

- Owner: Backend
- Estimate: 2.5 days
- Dependencies: SR-007
- Scope: Implement submit, approve, reject session transitions with notes and rejection reason guardrails.
- Acceptance criteria:
- Valid state transitions only (draft -> submitted -> approved or rejected).
- Approval and rejection role gates are enforced.
- Audit events are emitted for submit, approve, reject actions.

### SR-009: Ledger Adjustment Posting Endpoint

- Owner: Backend
- Estimate: 3 days
- Dependencies: SR-005, SR-008
- Scope: Implement `post-adjustments` for approved sessions and create trace-linked ledger transactions.
- Acceptance criteria:
- Adjustment posting is idempotent per line.
- Posted ledger entries include reason code and session linkage.
- Posting is blocked for non-approved sessions.

### SR-010: Stock Review UI Upgrade To Summary + Queue APIs

- Owner: Frontend
- Estimate: 3 days
- Dependencies: SR-001, SR-007, SR-008
- Scope: Update `/steel/reconciliations` to show KPI cards, mismatch queue, pending review queue, and session actions.
- Acceptance criteria:
- UI shows live summary values from API.
- Queue filters for status and item or location work correctly.
- Action states and errors are visible and role-aware.

### SR-011: Count-Sheet Upload Metadata On Session

- Owner: Backend
- Estimate: 2 days
- Dependencies: SR-007
- Scope: Add count-sheet attachment metadata fields on sessions and include in session detail payload.
- Acceptance criteria:
- Session stores metadata for uploaded sheet reference.
- Upload metadata is optional and version-safe.
- Audit entry records upload metadata changes.

### SR-012: Review Report Export Endpoint

- Owner: Backend
- Estimate: 2 days
- Dependencies: SR-008, SR-011
- Scope: Export review session report with summary and line-level variances.
- Acceptance criteria:
- Export includes header metrics and detailed line rows.
- Only authorized roles can export.
- Export respects factory and session scoping.

### SR-013: AI Insight Template For Repeated Mismatch

- Owner: Backend
- Estimate: 1.5 days
- Dependencies: SR-003, SR-008
- Scope: Add insight generation template for repeated mismatch patterns by item and location.
- Acceptance criteria:
- Insight payload includes reason, confidence hint, and suggested action.
- No insight is emitted when signal threshold is not met.
- Template output is deterministic for same inputs.

### SR-014: Role-Policy And Contract Test Coverage

- Owner: QA + Backend
- Estimate: 3 days
- Dependencies: SR-007, SR-008, SR-009
- Scope: Add endpoint role tests and contract tests across operator, supervisor, manager, admin, owner.
- Acceptance criteria:
- All new endpoints have permission tests for allow and deny cases.
- Session state transition tests cover invalid paths.
- CI includes these tests in steel module suite.

### SR-015: Migration Script + Legacy Compatibility Layer

- Owner: Backend
- Estimate: 2.5 days
- Dependencies: SR-006, SR-007, SR-010
- Scope: Add compatibility path so old reconciliation flows remain readable while session model rolls out.
- Acceptance criteria:
- Legacy reconciliation list still works during migration period.
- New UI reads session model without breaking old data visibility.
- Backfill or compatibility script can run repeatedly without corruption.

## Sprint Packaging

### Sprint 1: KPI + Rules Foundation

- SR-001
- SR-002
- SR-003

### Sprint 2: Schema Foundation

- SR-004
- SR-005
- SR-006

### Sprint 3: Core Workflow + UI

- SR-007
- SR-008
- SR-010
- SR-011

### Sprint 4: Control, Export, Intelligence, Hardening

- SR-009
- SR-012
- SR-013
- SR-014
- SR-015

## Critical Path

- SR-004 -> SR-006 -> SR-007 -> SR-008 -> SR-009

## Definition Of Done (Release Gate)

- All critical-path tickets merged and tested.
- No unauthorized role can submit, approve, reject, or post adjustments.
- Every posted stock correction has trace linkage to review session and actor.
- Dashboard KPI values match backend calculations for sampled factories.
