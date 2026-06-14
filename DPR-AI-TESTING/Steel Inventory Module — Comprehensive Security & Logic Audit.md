# Steel Inventory Module — Comprehensive Security & Logic Audit

## 1. Transaction Types & Signed Quantity Determination

**Defined types** (from `steel_service.py:26`):
`inward`, `adjustment`, `dispatch_out`, `production_issue`, `production_output`

**Central sign logic** (`_signed_transaction_quantity` at `steel.py:1488-1502`):

| Transaction Type | Sign | Determined by |
|---|---|---|
| `inward` | `+qty` | Hardcoded |
| `production_output` | `+qty` | Hardcoded |
| `dispatch_out` | `-qty` | Hardcoded |
| `production_issue` | `-qty` | Hardcoded |
| `adjustment` | `±qty` | `direction` param (`increase`/`decrease`) |

**Observation: Sign logic is duplicated in three places.**
- `_signed_transaction_quantity()` at line 1488 — used by the POST `/inventory/transactions` endpoint
- `_create_dispatch_inventory_movements()` at line 1609 hardcodes `-float(line.weight_kg)` — bypasses the shared function
- `create_steel_batch()` at line 4284/4297 hardcodes `-float(payload.input_quantity_kg)` and `float(payload.actual_output_kg)` — bypasses the shared function

While the signs are currently correct, any future change to sign convention would need updates in three places, creating maintenance risk.

---

## 2. Race Condition: Negative Stock Check (TOCTOU)

**BUG-INV-001 — CRITICAL**

**Root Cause:** The negative stock check is a classic Time-of-Check-Time-of-Use (TOCTOU) race. The balance is read via `stock_balances_for_factory()` which issues a plain `SELECT` (no lock), the check happens in Python memory, then the transaction INSERT and COMMIT happen outside any atomic/locked scope.

**Affected endpoints:**
1. `POST /steel/inventory/transactions` (line 1893-1896)
2. `POST /steel/batches` (line 4228-4231)
3. `POST /steel/dispatches/{id}/status` — transition to dispatched/delivered (line 4119-4123)

**Reproduction:**
```python
# Two concurrent requests for the same item with balance=0:
# Request A: dispatch_out, quantity_kg=5
# Request B: dispatch_out, quantity_kg=5
#
# Both read balance=0
# Both compute projected=-5, check -5 >= -0.001 -> True
# Both INSERT their transaction
# Final balance = -10 (violates invariant)
```

**Fix:** Use a `SELECT ... FOR UPDATE` lock on a sentinel row (like the item row or a stock summary row) within the same DB transaction. For PostgreSQL, either:
- Use `with_for_update()` on the item row before reading the balance, or
- Use `SELECT SUM(quantity_kg) ... FOR UPDATE` on the transaction rows (possible but expensive), or
- Use an advisory lock (`pg_advisory_xact_lock`) keyed on `(factory_id, item_id)`.

Example fix for `create_steel_inventory_transaction`:
```python
# Lock the item row to serialize concurrent stock operations
item = db.query(SteelInventoryItem).filter(
    SteelInventoryItem.id == payload.item_id
).with_for_update().first()
balances = stock_balances_for_factory(db, factory.factory_id)
# ... rest of check ...
```

**Impact:** Ledger can silently go negative, bypassing the guardrail. A malicious or coincidental concurrent dispatch/production issue can drain more stock than exists.

---

## 3. Reconciliation Lifecycle

### 3.1 Lifecycle States

```
Manager creates    → status="pending"
Admin/Owner creates → status="approved" (auto-approved)

pending  → POST /.../approve → "approved"  + creates adjustment transaction
pending  → POST /.../reject  → "rejected"  (no adjustment created)
```

### 3.2 Auto-Approval Logic (`create_steel_stock_reconciliation`, line 1956)
```python
auto_approved = is_admin_or_owner(current_user)
```
When `auto_approved=True`, the reconciliation is created with `approved_by_user_id=current_user.id` and an `adjustment` transaction is immediately created if variance > 0.0001 kg.

**BUG-INV-002 — MEDIUM — Self-Approval Not Prevented**

**Root Cause:** The `assert_not_self_approval` function exists in `backend/rbac.py:37-39` and is used by the attendance and entries modules, but is **never called** from any steel reconciliation endpoint.

**Affected endpoints:**
- `POST /steel/inventory/reconciliations/{id}/approve` (line 2113)
- `POST /steel/inventory/reconciliations/{id}/reject` (line 2195)

An ADMIN/OWNER can always approve/reject their own reconciliation because:
- Admins/owners who create a reconciliation get auto-approved (self-approval by design, but worth flagging)
- If a MANAGER creates a pending reconciliation, then gets promoted to ADMIN/OWNER, they can approve their own record

**Fix:** Add `assert_not_self_approval(row.submitted_by_user_id, current_user.id)` in both the approve and reject endpoints before the status change.

### 3.3 Missing Halt for Already-Approved/Rejected Records on Re-approve/Re-reject

The approve/reject endpoints check `row.status != "pending"` (lines 2137, 2219), so already-approved or already-rejected records cannot be re-processed. This is correct. ✅

---

## 4. Audit Logging Completeness

**All mutations in the steel module log to `AuditLog`:**

| Action | Audit Event | Location |
|---|---|---|
| Create inventory item | `STEEL_INVENTORY_ITEM_CREATED` | line 1861 |
| Create transaction | `STEEL_LEDGER_TRANSACTION_CREATED` | line 1911 |
| Create reconciliation | `STEEL_STOCK_RECONCILIATION_APPROVED` or `_SUBMITTED` | line 2008 |
| Approve reconciliation | `STEEL_STOCK_RECONCILIATION_APPROVED` | line 2172 |
| Reject reconciliation | `STEEL_STOCK_RECONCILIATION_REJECTED` | line 2241 |
| Record batch | `STEEL_BATCH_RECORDED` | line 4305 |
| Update dispatch status | `STEEL_DISPATCH_STATUS_UPDATED` | line 4143 |

**Finding: No `previous_state` / `new_state` capture.** The `AuditLog` model supports JSON `previous_state` and `new_state` columns (report.py:28-29), but `_write_steel_audit()` only writes a text `details` string. This is a non-blocking observability gap — for forensic auditing, a text description is less useful than the actual before/after record state.

**Finding: No audit on reconciliation adjustment transaction creation.** When a reconciliation is approved (either at creation time for auto-approval or at the approve endpoint), an `adjustment` SteelInventoryTransaction is created, but no separate audit log entry is written for the adjustment itself. The audit only says `STEEL_STOCK_RECONCILIATION_APPROVED` with variance details. The adjustment transaction is implicit. This is acceptable since the audit details contain the variance, but a dedicated `STEEL_LEDGER_ADJUSTMENT_CREATED` event would be more transparent. (Minor finding.)

---

## 5. Factory ID Always from Session ✅

All steel endpoints use the following pattern:
```python
factory = require_active_steel_factory(db, current_user)  # line 38-51 of steel_service.py
```
Which calls `resolve_factory_id(db, user)` from `tenancy.py:17-28`. The factory_id comes from:
1. `user.active_factory_id` (JWT token claim) or
2. The first `UserFactoryRole` assignment for the user

**No endpoint accepts `factory_id` from user input.** All queries filter by `factory.factory_id` derived from the session. ✅

---

## 6. Role Guards on Each Endpoint

| Endpoint | Role Guard | Missing? |
|---|---|---|
| `GET /steel/overview` | **NONE** | **BUG-INV-003** |
| `GET /steel/owner-daily-pdf` | `OWNER` | ✅ |
| `GET /steel/inventory/items` | SUPERVISOR, MANAGER, ADMIN, OWNER, ACCOUNTANT | ✅ |
| `GET /steel/inventory/stock` | SUPERVISOR, MANAGER, ADMIN, OWNER, ACCOUNTANT | ✅ |
| `GET /steel/inventory/transactions` | SUPERVISOR, MANAGER, ADMIN, OWNER, ACCOUNTANT | ✅ |
| `POST /steel/inventory/items` | `MANAGER` | ✅ |
| `POST /steel/inventory/transactions` | `MANAGER` | ✅ |
| `POST /steel/inventory/reconciliations` | `MANAGER` | ✅ |
| `GET /steel/inventory/reconciliations/summary` | SUPERVISOR, MANAGER, ADMIN, OWNER | ✅ |
| `GET /steel/inventory/reconciliations` | SUPERVISOR, MANAGER, ADMIN, OWNER | ✅ |
| `POST .../reconciliations/{id}/approve` | ADMIN, OWNER | ✅ |
| `POST .../reconciliations/{id}/reject` | ADMIN, OWNER | ✅ |
| `POST /steel/batches` | OPERATOR, SUPERVISOR, MANAGER, ADMIN, OWNER | ✅ |

**BUG-INV-003 — MEDIUM — `GET /steel/overview` has no role guard** (lines 1619-1634)

Any authenticated user (even `ATTENDANCE` or `OPERATOR`) with a steel factory can access the full overview, which includes:
- Inventory totals by category (raw_material_kg, wip_kg, finished_goods_kg)
- Confidence counts (green/yellow/red)
- Batch metrics (total_batches, average_loss_percent, high_severity_batches)
- Top loss batch, operator losses, anomaly batches
- Low confidence items

Financial values are redacted for non-owners, but the operational data may still be sensitive. Compare with `GET /steel/inventory/stock` which requires `SUPERVISOR+`.

**Fix:** Add a `require_any_role` guard matching the stock endpoint:
```python
require_any_role(current_user, {UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.ADMIN, UserRole.OWNER, UserRole.ACCOUNTANT})
```

---

## 7. IDOR Vulnerability Assessment

**Verdict: No IDOR found.** ✅

All resource queries scope by `factory.factory_id`, which is always derived from the authenticated user's session. Path parameters (item IDs, reconciliation IDs, batch IDs, dispatch IDs) are validated to belong to the user's factory before any operation.

Example — item lookup (line 334-346):
```python
item = db.query(SteelInventoryItem).filter(
    SteelInventoryItem.id == item_id,
    SteelInventoryItem.factory_id == factory_id,  # <-- scope
    SteelInventoryItem.is_active.is_(True)
).first()
```

Reconciliation approve (line 2127-2134):
```python
row = db.query(SteelStockReconciliation).filter(
    SteelStockReconciliation.id == reconciliation_id,
    SteelStockReconciliation.factory_id == factory.factory_id,  # <-- scope
).first()
```

This pattern is consistently applied across all endpoints. ✅

---

## 8. Financial Value Redaction

**Redaction policy** (`_can_view_steel_financials` at line 1299-1300):
```python
def _can_view_steel_financials(user: User) -> bool:
    return user.role == UserRole.OWNER
```

Only `OWNER` role can see financial values. The redaction is implemented as post-serialization nulling in the overview endpoint and as a parameter in `serialize_stock_row`/`serialize_batch`.

### Findings:

**BUG-INV-004 — LOW — Inconsistent financial redaction across endpoints**

The `GET /steel/inventory/items` endpoint (line 1742-1746) uses a **broader** financial access check:
```python
can_view_item_financials = _can_view_steel_financials(current_user) or current_user.role in {
    UserRole.MANAGER,
    UserRole.ADMIN,
    UserRole.ACCOUNTANT,
}
```

This exposes `current_rate_per_kg` to MANAGER, ADMIN, and ACCOUNTANT on the items list, but `serialize_stock_row` (used by the stock list and overview) only exposes it to OWNER. MANAGER/ADMIN/ACCOUNTANT can see `current_rate_per_kg` by calling `/inventory/items` but not `/inventory/stock`.

Similarly, the dispatch status update response (line 4177-4181) exposes dispatch line financials to MANAGER/ADMIN/ACCOUNTANT.

**Impact:** Low — `current_rate_per_kg` is a unit price that might be considered non-sensitive in some contexts. But the inconsistency creates confusion and potential for future financial data leaks if a new endpoint copies the wrong pattern.

**Fix:** Standardize on a single `_can_view_steel_financials` call across all endpoints, or document that `current_rate_per_kg` is a non-sensitive catalog value.

**BUG-INV-005 — LOW — Fragile redaction pattern in overview**

The `build_steel_overview()` function always computes full financial data (`can_view_financials=True` at line 521). Then the router's `get_steel_overview()` redacts it post-hoc via `_redact_steel_overview_financials()`. This means any new financial field added to the overview dict that is not added to the redact function will leak to non-owner roles.

**Fix:** Pass `can_view_financials=_can_view_steel_financials(current_user)` directly to `build_steel_overview()` instead of building and then redacting.

---

## Summary of All Bugs

| ID | Severity | Title | Root Cause | Fix |
|---|---|---|---|---|
| **BUG-INV-001** | **CRITICAL** | Negative stock race condition (TOCTOU) | `stock_balances_for_factory()` reads without DB lock; check and commit are not atomic | Add `SELECT ... FOR UPDATE` on item row or use advisory lock before balance read |
| **BUG-INV-002** | **MEDIUM** | Self-approval allowed in reconciliation approve/reject | `assert_not_self_approval` exists in `rbac.py` but is never called from steel endpoints | Add `assert_not_self_approval(row.submitted_by_user_id, current_user.id)` in both approve and reject endpoints |
| **BUG-INV-003** | **MEDIUM** | `GET /steel/overview` has no role guard | No `require_role`/`require_any_role` call in the overview endpoint | Add role guard matching stock endpoint (SUPERVISOR+) |
| **BUG-INV-004** | **LOW** | Inconsistent financial redaction across endpoints | `/inventory/items` and dispatch update use broader financial access than stock/batch/overview endpoints | Standardize on `_can_view_steel_financials()` everywhere |
| **BUG-INV-005** | **LOW** | Fragile post-hoc redaction in overview | Financial data built unconditionally, then redacted — new fields can leak | Pass `can_view_financials` directly into `build_steel_overview()` |
| **BUG-INV-006** | **LOW** | Sequence number race in batch/invoice/dispatch code generation | `SELECT max → parse → increment` is not atomic | Use a DB sequence or `SELECT ... FOR UPDATE` on a counter row |

---

## Answers to Specific Questions

**Q: What transaction types exist? How is signed quantity determined?**
A: Five types: `inward`, `adjustment`, `dispatch_out`, `production_issue`, `production_output`. Sign is determined by type for all except `adjustment` (which uses a `direction` param). See table in Section 1 above.

**Q: Is there a race condition in the negative stock check?**
A: **Yes (BUG-INV-001).** The balance read in `stock_balances_for_factory()` is a plain `SELECT` with no lock. Concurrent requests can all pass the check and overshoot zero.

**Q: What is the reconciliation lifecycle? Is self-approval prevented?**
A: Create → pending (or auto-approved for admin/owner) → approve/reject. **Self-approval is NOT prevented (BUG-INV-002).** The `assert_not_self_approval` guard exists in the codebase but is never wired into the steel endpoints.

**Q: Are all mutations logged to audit?**
A: Yes — all 7 mutation endpoints write `_write_steel_audit()`. However, the audit only records a text `details` string; the `previous_state`/`new_state` JSON columns on `AuditLog` are never populated.

**Q: Is factoryId always from session?**
A: **Yes** — every endpoint uses `require_active_steel_factory()` → `resolve_factory_id()`. No factory_id is accepted from user input.

**Q: What role guards exist on each endpoint?**
A: All endpoints except `GET /steel/overview` have explicit role guards (BUG-INV-003). See table in Section 6.

**Q: Is there any IDOR vulnerability?**
A: **No** — all queries scope by `factory.factory_id` from the session, and all path/query parameters are validated against that scope before use.

**Q: Are financial values properly redacted for non-owner roles?**
A: Mostly yes, but with an inconsistency (BUG-INV-004): the `/inventory/items` endpoint exposes `current_rate_per_kg` to MANAGER/ADMIN/ACCOUNTANT while `/inventory/stock` does not. The overview redaction is also fragile (BUG-INV-005).