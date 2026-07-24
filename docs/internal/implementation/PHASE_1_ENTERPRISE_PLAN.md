# Phase 1 — "Stop The Bleeding" Enterprise Master Plan
## FactoryNerve Production Readiness — 2026-07-04

---

## Executive Summary

**Goal**: Make FactoryNerve *survive* real factory conditions. After Phase 1, the system should pass the Week 3 chaos test without data corruption, and the owner should see enough value to continue another 30-day trial.

**Timeline**: 2-3 weeks for 7 workstreams running in parallel where possible.

**ROI Ranking** (effort × impact):

| Rank | ID | Fix | Effort | Impact | ROI |
|------|-----|-----|--------|--------|-----|
| 1 | P0-5 | Night shift cross-midnight attendance | Low | Critical | ★★★★★ |
| 2 | P0-6 | Idempotency middleware + client keys | Medium | Critical | ★★★★★ |
| 3 | P0-3 | DB-level stock non-negative constraint | Medium | Critical | ★★★★★ |
| 4 | P0-2 | Dispatch state machine with role gates | Medium | Critical | ★★★★★ |
| 5 | P0-1 | OCR preprocessing + async queue foundation | High | Critical | ★★★★★ |
| 6 | P1-1 | CSV bulk import (workers) | Low | High | ★★★★★ |
| 7 | P0-7 | Owner decision dashboard cards | Medium | High | ★★★★☆ |

---

## Workstream 1: P0-5 — Night Shift Cross-Midnight Attendance Fix
### Estimate: 4-6 hours | Dependencies: None

**Root Cause**: `_open_record_for_local_day_and_shift()` queries for `attendance_date == current_date` exclusively. Night shift records have `attendance_date = previous_day` because the shift starts at 22:00 and ends at 06:00 next day. When a worker punches out at 06:10 AM, the system finds no open record.

**Fix**:
1. **Punch-out query**: Search `attendance_date IN (current_date, current_date - 1 day)` for cross-midnight shifts
2. **Store shift bounds**: Add `shift_start_datetime` and `shift_end_datetime` to `AttendanceRecord` for unambiguous cross-midnight lookup
3. **Unit tests**: 3 test scenarios
   - Night shift punch-out at 06:10 AM (finds previous day's record)
   - Morning shift punch-out (not affected)
   - Double punch-out protection (idempotent)

**Files affected**:
- `backend/routers/attendance.py` — `_open_record_for_local_day_and_shift()`, `_record_for_local_day_and_shift()`, `punch_attendance()` punch-out logic
- `backend/models/attendance_record.py` — Optional: add `shift_start_utc` field
- `tests/test_attendance.py` — New test cases

---

## Workstream 2: P0-6 — Idempotency Middleware
### Estimate: 2-3 days | Dependencies: None (base service exists)

**Root Cause**: No `Idempotency-Key` handling on any mutation endpoint. Double-click, network retry, browser back → duplicate records.

**Current State**: `backend/services/idempotency_service.py` exists with `check_idempotency()` and `store_idempotency()` but only used in `create_steel_dispatch`.

**Fix**:
1. **FastAPI middleware**: Global middleware that intercepts `Idempotency-Key` header, checks cache, returns cached response or proceeds
2. **Apply to all POST/PUT/PATCH endpoints**: Add decorator or middleware-based injection
3. **Client-side key generation**: Frontend generates `uuid + action + timestamp` per user action
4. **TTL + pruning**: 24h TTL, sampled pruning (already implemented)

**Endpoints requiring idempotency**:
- `POST /attendance/punch` — Double-tap creates duplicate records
- `POST /steel/inventory/transactions` — Double deduction
- `POST /steel/dispatches` — Already done, verify coverage
- `POST /steel/inventory/items` — Duplicate items
- `POST /steel/.../batches` — Duplicate batches
- `POST /auth/register` — Double registration
- `POST /auth/users/invite` — Double invite
- All POST/PUT/PATCH in auth.py, steel.py, attendance.py

**Files affected**:
- `backend/middleware/idempotency.py` — New FastAPI middleware
- `backend/main.py` — Register middleware
- `backend/services/idempotency_service.py` — Extend if needed
- Individual router files — Add middleware registration

---

## Workstream 3: P0-3 — DB-Level Stock Non-Negative Constraint
### Estimate: 1-2 days | Dependencies: None

**Root Cause**: Application-level check only (`if balance < qty: error`) — race condition under concurrency allows negative stock.

**Fix**:
1. **Check constraint on balance_kg**: Not directly possible on a computed column, so:
   - Add `CHECK (quantity_kg >= 0)` on `SteelInventoryTransaction` for inward types
   - Add `version` column to `SteelInventoryItem` for optimistic locking
   - Add inventory reservation system: `reserve(qty)` → `confirm()` / `release()`
2. **Optimistic locking**: `version` column on `SteelInventoryItem`, check before update
3. **Application-level guard**: Audit and strengthen all `stock_balances_for_factory()` usage points

**Files affected**:
- `backend/models/steel_inventory_item.py` — Add `version` column
- `backend/services/steel_service.py` — Add reservation functions
- `backend/routers/steel.py` — Add reservation check before dispatch/production
- Alembic migration — New columns

---

## Workstream 4: P0-2 — Dispatch State Machine with Role-Gated Transitions
### Estimate: 3-5 days | Dependencies: Authorization system exists

**Root Cause**: Status transitions unguarded (`dispatched` → `delivered` posts inventory instantly). No required fields per transition. Same user can create AND approve.

**Fix**:
1. **State machine enforcement**: Add required fields per transition
   - `pending` → `loaded`: Requires gate_pass_number, entry_time
   - `loaded` → `exited`: Requires exit_time, weighbridge slip photo
   - `exited` → `delivered`: Requires POD photo, receiver_name, GPS coordinates
2. **Role separation**: 
   - Creator (ANY) → `pending`
   - Gate Security → `loaded` (requires weighbridge verified)
   - Gate Security → `exited` (requires exit gate scan)
   - Receiver → `delivered` (requires POD)
3. **POD enforcement**: Mandatory photo upload before `delivered` status
4. **Gate pass auto-generation**: Sequence per factory + QR code

**Files affected**:
- `backend/models/steel_dispatch.py` — Add fields for transition requirements
- `backend/routers/steel.py` — Add state validation in `update_steel_dispatch_status()`
- `backend/services/steel_service.py` — Add state machine validation
- Alembic migration — New columns

---

## Workstream 5: P0-1 — OCR Reliability Foundation
### Estimate: 3-5 days | Dependencies: None

**Root Cause**: Single-pass Tesseract → Anthropic fallback. No image preprocessing. No queue/retry. No offline.

**Phase 1 Fix** (foundation only — full solution in Phase 2):
1. **Image preprocessing**: Add OpenCV preprocessing pipeline
   - Deskew (auto-rotate correction)
   - Adaptive threshold (for stained/dark docs)
   - CLAHE (contrast enhancement for faded text)
   - Denoise (remove speckles from scanned docs)
2. **Async queue**: Add in-memory task queue with exponential backoff
   - Staged processing: upload → preprocess → OCR → validate → return
   - Webhook/callback for async completion
3. **Low-confidence routing**: If confidence < 0.6, route to `pending_review` UI
4. **Timeout guard**: Max 10s per OCR attempt, fall back to human review

**Files affected**:
- `backend/ai/services/ocr_service.py` — Add preprocessing step
- `backend/ai/pipelines/ocr_pipeline.py` — Add preprocessing hook, timeout
- `backend/ai/processors/` — New module for image processing
- `backend/routers/ocr_router.py` — Add async processing endpoint
- `requirements.txt` — Add opencv-python, scikit-image

---

## Workstream 6: P1-1 — CSV Bulk Import for Workers
### Estimate: 1-2 days | Dependencies: User model, Factory model

**Root Cause**: 120 workers × 5 fields = 600 form submissions. 6 hours manual entry vs 30 min.

**Fix**:
1. **CSV template**: Standard format with validation rules
   - Required: name, email, role, factory_name
   - Optional: employee_code, department, designation, phone_number, default_shift
   - Validation: email uniqueness, role validity, factory existence
2. **Upload endpoint**: POST /attendance/employees/bulk-import
   - Parse CSV → Validate each row → Preview (show errors) → Confirm → Process
   - Transactional: all-or-nothing, rollback on any row failure
   - Row limit: 500 per batch
3. **Error reporting**: Return per-row errors with row number and field

**Files affected**:
- `backend/routers/attendance.py` — New bulk import endpoint
- `backend/services/bulk_import_service.py` — New service for CSV processing
- `backend/models/user.py` — May need helper methods

---

## Workstream 7: P0-7 — Owner Decision Dashboard Cards
### Estimate: 2-3 days | Dependencies: Data models exist

**Root Cause**: Dashboard shows metric cards (Production: 142 MT) but no actionable decisions. Owner opens WhatsApp instead.

**Phase 1 Fix** (3 actionable widgets — not a full dashboard rewrite):
1. **Estimated cash position**: 
   - Bank balance (manual entry or integration) + expected receipts (dispatches) - expected payables (vendor bills due)
   - Show as: "INR 4.2Cr estimated cash position" with trend arrow
2. **Receivables aging**:
   - Auto-calc from invoices + payments
   - Current: ₹X | 1-30d: ₹X | 31-45d: ₹X | 46-60d: ₹X | >60d: ₹X
   - Alert if any bucket >45 days with amount
3. **Production variance alert**:
   - Yesterday's yield % vs target
   - Alert if >2% drop: "Yield dropped 3.2% — check furnace #1"
4. **Dispatch vs Invoice reconciliation**:
   - Shipped vs invoiced quantity
   - Alert on mismatch: "Invoiced 45MT but only 42MT dispatched"

**Files affected**:
- `backend/services/dashboard_service.py` — New service for decision data
- `backend/routers/dashboard.py` — New or extended dashboard endpoint
- `web/app/dashboard/` — Frontend components for decision cards

---

## Dependency Graph

```
P0-5 (Night Shift) ──→ No deps, can start immediately
P0-3 (Stock Constraint) ──→ No deps, can start immediately
P0-6 (Idempotency) ──→ Requires idempotency_service.py (exists)
P0-2 (Dispatch) ──→ Requires authorization system (exists)
P0-1 (OCR) ──→ No deps, can start immediately
P1-1 (CSV Import) ──→ Requires user/factory models
P0-7 (Dashboard) ──→ Requires invoice/payment data models (exist)

Parallel workstreams:
- Stream A: P0-5 + P0-6 + P0-3 (backend infra — 3 engineers)
- Stream B: P0-2 + P0-1 (workflow — 2 engineers)
- Stream C: P1-1 + P0-7 (productivity — 2 engineers)
```

---

## Rollout Sequence

### Day 1-2: Quick Wins
1. **P0-5**: Night shift fix + unit tests (4-6 hours)
2. **P1-1**: CSV import endpoint (8-10 hours)
3. **P0-3**: Stock constraint migration + optimistic locking (6-8 hours)

### Day 3-5: Core Infrastructure
4. **P0-6**: Idempotency middleware on all endpoints (2 days)
5. **P0-2**: Dispatch state machine + role gates (3 days)

### Day 6-8: Remaining Items
6. **P0-1**: OCR preprocessing + async queue (3 days)
7. **P0-7**: Dashboard decision cards (2 days)

### Day 9-10: Testing & Validation
8. Run full test suite
9. Manual chaos test (Week 3 scenarios)
10. Fix any regressions

---

## Success Criteria

After Phase 1:

1. **Chaos test pass**: No data corruption under double-click, network failure, server restart
2. **Night shift workers**: 100% can punch out at 06:00-06:30 without "record not found"
3. **No negative stock**: System enforces `balance_kg >= 0` at DB level, not just app level
4. **Dispatch integrity**: Security cannot mark "delivered" without POD photo and receiver sign
5. **Idempotency**: All mutation endpoints return same response for duplicate requests within 24h
6. **Owner dashboard**: Shows cash position, aging, variance — replaces WhatsApp for daily check
7. **CSV import**: 120 workers onboarded in 30 minutes, not 6 hours

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| OCR changes break existing happy path | Medium | High | Add integration tests first, then refactor |
| Idempotency middleware introduces latency | Low | Medium | In-memory cache with Redis fallback, benchmark before/after |
| Dispatch state machine too strict for real ops | Medium | High | Add configurable bypass with owner override |
| Stock constraint migration blocks writes | Low | Critical | Run migration during maintenance window, add NOT VALID first |
| CSV import error handling too complex | Low | Medium | Start with basic validation, add complexity iteratively |
