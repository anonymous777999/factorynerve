# Stock Review Factory Intelligence Plan

Updated: 2026-04-03

## Purpose

Build Stock Review as a factory intelligence system, not a static inventory screen.

North-star question:

"Does physical stock match system stock at item and location level, and if not, what action closes the gap?"

## 1. Operational Reality To Encode

### Material classes

- Raw material: scrap, billets
- Semi-finished: sheets, rods, coils
- Finished goods: dispatch-ready output

### Units

- Primary valuation unit: KG (single source of truth for calculations)
- Display units: KG, ton, meter, piece
- Rule: all inbound math converts to KG before posting to ledger

### Locations

The same item can exist in multiple locations and must reconcile per location:

- Yard
- Warehouse
- Production line
- Transit staging

### Movement flow

- Purchase inward
- Storage
- Production consumption or conversion
- Finished stock posting
- Dispatch outward

### Problem modes

- Manual count mismatch
- Weight variance
- Wrong data entry
- Delayed posting
- Leakage or theft suspicion

## 2. Product Outcome And Success Metrics

### Product outcome

Stock Review becomes the operational command center for physical vs ledger truth.

### Core KPIs

- Stock accuracy percent
- Mismatch item count
- Pending review count
- Stale review count (older than SLA)
- Repeated mismatch items (rolling 30 days)
- Net variance KG and value INR

### KPI definitions

- `accuracy_percent = (matched_items / reviewed_items) * 100`
- `variance_kg = physical_kg - system_kg_snapshot`
- `variance_percent = abs(variance_kg) / max(system_kg_snapshot, 0.001) * 100`

## 3. Current DPR.ai Baseline

Already strong:

- Item master and KG ledger transactions are live.
- Reconciliation records include physical KG, system KG, variance KG, variance percent, confidence status.
- Approval and rejection workflow exists.
- Audit logging exists for reconciliation actions.

Current gaps for factory-grade intelligence:

- No location-level stock truth or location-level reconciliation.
- Reconciliation is single-item submission, not cycle-count session driven.
- No explicit variance reason taxonomy and root-cause workflow.
- No controlled adjustment workflow linked to approved reconciliation decisions.

## 4. Scope For V2 (Execution Priority)

### Capability A: Cycle count session workflow

- Start review session by factory and location scope.
- Freeze system snapshot at session start time.
- Track session state: draft, submitted, approved, rejected, closed.

### Capability B: Location-wise reconciliation

- Count item quantity by location.
- Compare physical vs frozen system snapshot at the same location.
- Show variance KG and variance percent per line and rolled up.

### Capability C: Mismatch triage and review

- Tolerance policy by category and location risk profile.
- Priority buckets: normal, watch, high, critical.
- Mandatory reason capture for out-of-tolerance lines.

### Capability D: Controlled stock adjustment

- Only approved mismatches can trigger adjustment entries.
- Adjustment must record reason code, actor, and evidence reference.
- Auto-create ledger adjustment transaction with audit linkage.

### Capability E: Audit and intelligence

- Full event trail: counted, submitted, approved or rejected, adjusted.
- Repeat mismatch detection by item, location, and shift.
- Insight prompts for probable process issues.

## 5. Data Model Additions

### New tables

1. `steel_inventory_locations`
- `id`, `org_id`, `factory_id`, `location_code`, `name`, `location_type`, `is_active`

2. `steel_stock_review_sessions`
- `id`, `org_id`, `factory_id`, `session_code`, `review_date`, `status`
- `scope_type` (full, location, category)
- `started_by_user_id`, `submitted_by_user_id`, `approved_by_user_id`, timestamps

3. `steel_stock_review_lines`
- `id`, `session_id`, `item_id`, `location_id`
- `system_qty_kg_snapshot`, `physical_qty_kg`, `variance_kg`, `variance_percent`
- `severity`, `variance_reason_code`, `notes`
- `counted_by_user_id`, `counted_at`

4. `steel_stock_adjustments`
- `id`, `session_line_id`, `item_id`, `location_id`
- `adjustment_qty_kg`, `reason_code`, `status`
- `approved_by_user_id`, `posted_transaction_id`, timestamps

### Changes to existing tables

- Add nullable `location_id` to `steel_inventory_transactions`.
- Add optional `review_session_id` and `review_line_id` to `steel_inventory_transactions` for traceability.
- Keep current `steel_stock_reconciliations` table for backward compatibility, then migrate UI to session model.

## 6. API Plan

### Keep existing endpoints

- `GET /steel/inventory/stock`
- `POST /steel/inventory/reconciliations`
- `GET /steel/inventory/reconciliations`
- `POST /steel/inventory/reconciliations/{id}/approve`
- `POST /steel/inventory/reconciliations/{id}/reject`

### Add V2 endpoints

- `GET /steel/inventory/locations`
- `POST /steel/inventory/locations`
- `POST /steel/inventory/review-sessions`
- `GET /steel/inventory/review-sessions`
- `GET /steel/inventory/review-sessions/{id}`
- `POST /steel/inventory/review-sessions/{id}/lines`
- `POST /steel/inventory/review-sessions/{id}/submit`
- `POST /steel/inventory/review-sessions/{id}/approve`
- `POST /steel/inventory/review-sessions/{id}/reject`
- `POST /steel/inventory/review-sessions/{id}/post-adjustments`

## 7. Role And Control Model

Recommended operational split:

- Operator or supervisor: capture physical counts
- Manager: submit review session
- Admin or owner: approve or reject session and authorize adjustment posting
- Accountant: read-only visibility and reporting access

Guardrails:

- No silent stock edits
- No adjustment posting without approval
- Rejection requires reason
- Every critical variance requires evidence note

## 8. UI Behavior (Backed By Workflow, Not Decoration)

Use the Stock Review tab to answer physical vs system truth with action:

- Stock Health cards: accuracy, mismatch items, pending reviews, last review
- Mismatch queue: highest variance first with review action
- Pending review queue: session-level state and owner
- Context rail: factory info, upload count sheet, export report, insight summary

V2 route remains:

- `/steel/reconciliations`

Optional future split:

- `/steel/reconciliations` for decision board
- `/steel/review-sessions/:id` for counting workspace

## 9. Execution Phases

### Phase 1: Harden current model (1 week)

- Add variance reason taxonomy and severity rules.
- Improve reconciliation summary APIs for dashboard cards.
- Add stale review and repeated mismatch metrics.
- Add tests for severity and stale logic.

Exit criteria:

- Stock Review page shows accuracy, mismatch, pending, last review from live API.

### Phase 2: Introduce locations and session model (2 weeks)

- Add location table and location-aware ledger posting.
- Build review session and line-level reconciliation APIs.
- Add migration path from item-only reconciliation to session lines.
- Add role-aware approvals at session level.

Exit criteria:

- Factory can run a location-scoped review session end to end.

### Phase 3: Controlled adjustment and intelligence (1 week)

- Post approved adjustments into ledger with trace links.
- Add audit timeline view and export payload.
- Add repeated mismatch insight signals.

Exit criteria:

- Every stock correction is traceable from mismatch to posted adjustment.

### Phase 4: Reliability and launch readiness (1 week)

- Performance testing on large item and location sets.
- Permission hardening and negative tests.
- Operational dashboard quality checks and docs.

Exit criteria:

- Ready for production rollout in steel factories with audit confidence.

## 10. Test Strategy

### Backend tests

- Unit conversion safety tests
- Variance and severity calculation tests
- Session state transition tests
- Approval and rejection permission tests
- Adjustment posting idempotency tests

### Integration tests

- Full flow: inward -> production -> dispatch -> review session -> approval -> adjustment
- Cross-role access checks for operator, manager, admin, owner
- Multi-location mismatch scenarios

### Regression tests

- Existing reconciliation endpoints continue working during migration window.

## 11. Immediate Ticket Backlog

1. Add stock review KPI payload to `GET /steel/inventory/reconciliations/summary`.
2. Define variance reason code enum and API validation.
3. Add stale-review and repeat-mismatch detection service.
4. Create `steel_inventory_locations` model and migration.
5. Add `location_id` to inventory transactions and serializers.
6. Create review session header and line models.
7. Implement session create and line upsert endpoints.
8. Implement session submit and admin approval or rejection endpoints.
9. Implement ledger adjustment posting endpoint with audit links.
10. Update `/steel/reconciliations` UI to consume summary + queue APIs.
11. Add count-sheet upload metadata support on session.
12. Add export endpoint for review report.
13. Add AI insight template for repeated mismatch causes.
14. Add role-policy tests for all new endpoints.
15. Add migration script and compatibility layer for legacy reconciliations.

Executionized tickets:

- `docs/STOCK_REVIEW_SPRINT_TICKETS.md`

## 12. Decision Log

Naming:

- Keep product tab name as "Stock Review".
- Keep domain name internally as "Inventory Intelligence and Reconciliation".

Reason:

- "Stock Review" is operationally clear for daily users.
- "Inventory Intelligence" captures product depth for roadmap and architecture.
