# DPR.ai — Complete Bug Fix Order
**Source:** 17 audit files | 46 unique bugs across 11 modules
**Date:** 2026-06-13
**Verdict:** NOT RELEASE READY

---

## HOW TO READ THIS

Each bug is ordered by: **Data Loss Risk → Security Risk → Legal Risk → Operational Risk → Polish**

Fix in this exact sequence. Do not skip ahead. Each wave unblocks the next.

---

# WAVE 1 — STOP THE BLEEDING (Fix Today, Block Everything Else)
*These bugs can silently corrupt money, inventory, or access control. Nothing else matters until these are done.*

---

### FIX-01 — Negative Stock Race Condition (TOCTOU)
**Severity:** CRITICAL
**Files:** `backend/routers/steel.py:1893-1896, 3956-3961, 4119-4123, 4228-4231`
**Modules:** Steel Inventory, Dispatch, Production Batch

The stock balance check reads from DB with no lock (`SELECT`, no `FOR UPDATE`). Two concurrent requests both read balance=100, both compute 100-X is fine, both commit. Final balance goes negative — real inventory is lost on paper.

**Fix:**
```python
# Lock the item row BEFORE reading balance in all three locations:
item = db.query(SteelInventoryItem).filter(
    SteelInventoryItem.id == payload.item_id
).with_for_update().first()
balances = stock_balances_for_factory(db, factory.factory_id)
# Then proceed with check
```
Apply the same `with_for_update()` pattern at:
- `steel.py:1893` — inventory transaction creation
- `steel.py:3956` — dispatch creation
- `steel.py:4119` — dispatch status update
- `steel.py:4228` — batch creation

**Test:** Two concurrent `dispatch_out` requests for same item with balance = exact dispatch qty → only ONE should succeed.

---

### FIX-02 — Role Hierarchy Duplicate (Privilege Escalation Risk)
**Severity:** CRITICAL (logical)
**Files:** `backend/rbac.py:10-18` vs `backend/routers/settings.py:1116-1124`

Two different `ROLE_ORDER` dictionaries exist with different values:
- `rbac.py`: SUPERVISOR=3, ACCOUNTANT=2, MANAGER=4
- `settings.py`: SUPERVISOR=2, ACCOUNTANT=2, MANAGER=3

Role change authorization uses `settings.py` version. RBAC enforcement uses `rbac.py`. An ACCOUNTANT and SUPERVISOR rank the same in `settings.py` — this breaks role assignment validation.

**Fix:**
```python
# In settings.py — DELETE the local role_order dict and import:
from backend.rbac import ROLE_ORDER as role_order
```
Also found in `auth.py` — same local redefinition. Remove all duplicates. One source of truth only.

**Test:** ACCOUNTANT tries to modify SUPERVISOR's role → should get 403.

---

### FIX-03 — Auth v2 Login Breaks CSRF (Functional Login Bug)
**Severity:** CRITICAL (functional)
**File:** `backend/routers/auth_secure.py:99-117` (`_issue_legacy_access_cookie`)

After logging in via the production auth system (`/auth/v2/login`), the legacy JWT cookie is set but NO `dpr_csrf` cookie and NO `dpr_refresh` cookie are created. The first POST request after login fails the CSRF check because there is no CSRF cookie to compare against.

**Fix:** Ensure `_issue_legacy_access_cookie` also sets `dpr_csrf` and `dpr_refresh` cookies, matching the contract the legacy login established.

**Test:** Login via `/auth/v2/login` → make any authenticated POST (e.g., create entry) → must NOT get 403 CSRF failure.

---

### FIX-04 — Missing GST on Steel Invoices (Legal Compliance)
**Severity:** CRITICAL (legal)
**File:** `backend/routers/steel.py:3627`

Steel invoices in India are legally required to show GST (CGST/SGST for intra-state, IGST for inter-state). Currently:
```python
total_amount = round(subtotal_amount, 2)  # No GST added at all
```
The `SteelSalesInvoice` model has ZERO tax-related columns. Generated invoices cannot be used for tax filing and buyers cannot claim input tax credit.

**Fix:**
1. Add columns: `gst_rate`, `cgst_amount`, `sgst_amount`, `igst_amount`, `taxable_amount`, `total_amount` to `SteelSalesInvoice` model
2. Accept GST rate + supply type (intra/inter) on invoice creation
3. Compute: `taxable_amount = subtotal`, `cgst/sgst = taxable × rate/2` (intra) or `igst = taxable × rate` (inter)
4. Update PDF generation to show GST breakdown

**Test:** Create invoice with rate=18%, intra-state → CGST=9%, SGST=9%, total = subtotal × 1.18

---

### FIX-05 — Password Reset Token Expiry Not Invalidated on Password Change
**Severity:** CRITICAL (security)
**File:** `backend/routers/auth.py:1643-1664`

When a user changes their password, existing refresh tokens are NOT revoked. An attacker with a stolen refresh token can continue using it indefinitely after the victim changes their password.

**Fix:**
```python
# In change_password endpoint, after password update:
db.query(RefreshToken).filter(
    RefreshToken.user_id == current_user.id
).delete()
db.commit()
```

**Test:** Login → copy refresh token → change password → try to use old refresh token → must get 401.

---

# WAVE 2 — SECURITY FIXES (Fix This Sprint)
*These are exploitable attack vectors. Ship nothing to production until these are patched.*

---

### FIX-06 — Self-Approval Missing on Steel Reconciliation
**Severity:** HIGH
**File:** `backend/routers/steel.py:2113, 2195`

`assert_not_self_approval()` exists in `rbac.py` and works correctly for Attendance and Entries — but was never wired into the steel module. An ADMIN can create a stock reconciliation AND approve it themselves, adjusting inventory with no second pair of eyes.

**Fix:**
```python
# In approve_steel_stock_reconciliation (line 2113):
assert_not_self_approval(row.created_by_user_id, current_user.id)

# In reject_steel_stock_reconciliation (line 2195):
assert_not_self_approval(row.created_by_user_id, current_user.id)
```
Apply the same pattern to:
- `steel.py:3030` — customer verification review
- `steel.py:4079` — dispatch status update

**Test:** User creates reconciliation → same user approves → must get 403.

---

### FIX-07 — Self-Approval Missing on Dispatch Status Update
**Severity:** HIGH
**File:** `backend/routers/steel.py:4079-4087`

A supervisor can create a dispatch AND mark it as delivered. No second person required. This means one person can dispatch steel and confirm delivery — prime fraud vector.

**Fix:** Add `assert_not_self_approval(dispatch.created_by_user_id, current_user.id)` before the status update.

**Test:** Supervisor creates dispatch → same supervisor marks delivered → must get 403.

---

### FIX-08 — ADMIN Can Self-Demote (Role Manipulation)
**Severity:** HIGH
**File:** `backend/routers/settings.py:1166`

The `is_admin_or_owner` exception at line 1166 allows ADMIN users to change their own role. An ADMIN can self-demote to MANAGER, then later self-promote back (if rank checks permit). This allows bypassing audit trails or escaping responsibility post-incident.

**Fix:** Remove the `is_admin_or_owner` exception entirely:
```python
# Change line 1166 from:
if user.id == current_user.id and payload.role != current_user.role and not is_admin_or_owner(current_user):
# To:
if user.id == current_user.id and payload.role != current_user.role:
    raise HTTPException(status_code=400, detail="You cannot change your own role.")
```

**Test:** ADMIN tries to change own role to MANAGER → must get 400.

---

### FIX-09 — Global Role Leaks Across Factories (Factory-RBAC Mismatch)
**Severity:** HIGH
**File:** `backend/rbac.py`, `backend/routers/steel.py`

The system uses `current_user.role` (global/org-level role) for permission checks — it NEVER reads `UserFactoryRole.role` (factory-specific role). A user who is MANAGER in Factory A and OPERATOR in Factory B retains MANAGER permissions in Factory B.

**Fix:** In `get_current_user()` (security.py), when a `factory_id` is present in the JWT, look up the `UserFactoryRole` row and set `current_user.effective_role` to the factory-specific role. Update all permission checks to use `effective_role` when inside a factory context.

**Test:** User is MANAGER in Factory A, OPERATOR in Factory B → switch to Factory B → try to approve reconciliation → must get 403.

---

### FIX-10 — Company Code Enumeration via Error Messages
**Severity:** HIGH
**File:** `backend/routers/auth.py:688`

Three distinct error messages allow an attacker to enumerate valid company codes:
- "Invalid company code." → code doesn't exist
- "Company code does not match factory name." → code exists but name wrong
- "Public registration is limited to attendance accounts." → valid org

**Fix:** Return a single generic message: `"Registration not possible with the provided details."` for all three cases.

**Test:** Brute-force company codes → all invalid/valid responses must look identical.

---

### FIX-11 — Email Not Verified on v2 Login
**Severity:** HIGH
**File:** `backend/routers/auth_secure.py:152`

The new secure login (`/auth/v2/login`) only checks `AuthUser.is_active`. It does not verify that the user's email was confirmed. Legacy users who registered before email verification existed can log in without ever verifying their email.

**Fix:**
```python
# In auth_secure login, after user lookup:
if not user.email_verified_at:
    raise HTTPException(status_code=403, detail="Email address not verified.")
```

**Test:** Create account, do NOT verify email → try to login via v2 → must get 403.

---

### FIX-12 — Logout-All Does Not Invalidate Current JWT
**Severity:** HIGH
**File:** `backend/routers/auth.py:966-968`

`logout_all_devices` uses `getattr(current_user, "current_token", "")`. If the user was resolved via cookie (not Authorization header), `current_token` is absent and the current JWT is NOT blacklisted. The user can continue making authenticated requests with it.

**Fix:** Always blacklist the token regardless of resolution method. Store the token JTI in the request state during `get_current_user()` and always read it there.

**Test:** Login (cookie mode) → call logout-all → use old access token → must get 401.

---

# WAVE 3 — BUSINESS LOGIC FIXES (Fix Next Sprint)
*These cause incorrect data, wrong calculations, or broken workflows.*

---

### FIX-13 — Invoice Number Generation Race Condition
**Severity:** HIGH
**File:** `backend/services/steel_service.py:229-245`, `backend/routers/steel.py:3515-3524`

Three separate DB round-trips between generating an invoice number and committing. Concurrent requests generate the same number. The DB unique index catches it, but as an unhandled `IntegrityError` → 500 Internal Server Error (not a clean 409).

**Fix:** Replace the `SELECT max → parse → increment` pattern with a DB sequence or advisory lock:
```sql
CREATE SEQUENCE invoice_number_seq;
-- OR use PostgreSQL advisory lock keyed on (factory_id, 'invoice_number')
```
Alternatively, wrap in `with_for_update()` on a counter row per factory.

**Test:** 10 concurrent invoice creation requests → all must succeed with unique numbers, no 500 errors.

---

### FIX-14 — No Sales Order / Quotation Model (Missing Workflow)
**Severity:** HIGH
**File:** `backend/routers/steel.py` (missing endpoints)

Invoices are created directly without a preceding sales order or quotation. There is no order-to-cash state machine. The entire `Quotation → Sales Order → Dispatch → Invoice` flow is collapsed into just `Invoice`. This is not an ERP, it's a billing tool.

**Fix:** Build:
1. `SteelSalesOrder` model with status: `draft → confirmed → dispatched → invoiced`
2. `POST /steel/orders` endpoint
3. Link `SteelDispatch.sales_order_id` (FK)
4. Link `SteelSalesInvoice.sales_order_id` (FK)
5. Validation: dispatch requires confirmed order; invoice requires dispatched order

**Estimated effort:** 3-4 days.

---

### FIX-15 — No Purchase Workflow (Procurement Entirely Missing)
**Severity:** HIGH (feature gap)
**File:** Does not exist anywhere in codebase

The entire purchase/procurement side is not implemented:
- No vendor master
- No purchase order
- No goods receipt note (GRN)
- No purchase invoice
- No 3-way matching (PO ↔ GRN ↔ Invoice)

Raw material inward is done via manual `inward` transactions with no traceability to a supplier.

**Fix (use existing infrastructure):**
Build 4 new models (infrastructure is 70% reusable):
1. Add `party_type` + `bank_details` to `SteelCustomer` → reuse as vendor
2. `SteelPurchaseOrder` + `SteelPurchaseOrderLine` (new — ~1.5 days)
3. `SteelGoodsReceipt` + `SteelGoodsReceiptLine` (new — ~1 day, reuses `inward` transaction type)
4. `SteelPurchaseInvoice` (new — ~0.5 day, follows SteelSalesInvoice pattern)

**Estimated effort:** 8.5 days (down from 14 due to reusable infra).

---

### FIX-16 — OCR Quota Not Enforced on Preview Endpoint
**Severity:** HIGH
**File:** `backend/routers/ocr.py` (POST /logbook — no quota gate)

The `POST /logbook` (preview) endpoint calls the Anthropic API with NO quota check, NO rate limiting, NO subscription check. Any authenticated user can spam it for free, running up API costs indefinitely.

**Fix:**
```python
# Add to /logbook endpoint:
require_ocr_quota(db, current_user)
# OR add a separate cheaper rate limit for previews
```

**Test:** Exhaust OCR quota → call /logbook → must get 429.

---

### FIX-17 — Async OCR Quota Not Refunded on Background Job Failure
**Severity:** MEDIUM
**File:** `backend/routers/ocr.py` — `_run_ocr_excel_job` function

Async endpoints debit quota before queuing the background job. If the background job fails (Anthropic timeout, bad response), quota is permanently lost — no refund logic exists in `_run_ocr_excel_job`.

**Fix:**
```python
def _run_ocr_excel_job(progress, *, job_id: str) -> dict:
    try:
        # ... existing logic ...
    except Exception as e:
        refund_ocr_quota(db, org_id, reason="ocr_background_job_failed")
        raise
```

**Test:** Force Anthropic API to fail during async job → check quota counter → must be refunded.

---

### FIX-18 — Billing: Silent Data Loss on Idempotency Race Condition
**Severity:** HIGH
**File:** `backend/routers/billing.py:888-896`

When two concurrent payment orders collide on idempotency key:
1. Both create Razorpay orders (risk of double charge)
2. One fails with `IntegrityError`
3. `db.rollback()` is called but execution **continues silently** to return success
4. Loser has an orphaned Razorpay order with no DB record

**Fix:** After catching `IntegrityError`, query for the existing order and return it — do NOT continue silently:
```python
except IntegrityError:
    db.rollback()
    existing = db.query(PaymentOrder).filter(
        PaymentOrder.idempotency_key == idempotency_key
    ).first()
    if existing:
        return _format_order_response(existing)
    raise HTTPException(status_code=500, detail="Order creation conflict")
```

**Test:** Two concurrent POST /billing/orders with same user+plan → both must return the same order, no orphaned Razorpay orders.

---

### FIX-19 — No Dispatch State Machine Validation
**Severity:** MEDIUM
**File:** `backend/routers/steel.py:4079`

A dispatch can jump from `pending` directly to `delivered` — no validation that it must pass through `loaded → exited → dispatched`. A user can also move backward: `delivered → pending` (if no inventory lock).

**Fix:** Add transition graph:
```python
VALID_TRANSITIONS = {
    "pending": ["loaded", "cancelled"],
    "loaded": ["exited", "cancelled"],
    "exited": ["dispatched"],
    "dispatched": ["delivered"],
    "delivered": [],  # Terminal
    "cancelled": [],  # Terminal
}
if next_status not in VALID_TRANSITIONS.get(dispatch.status, []):
    raise HTTPException(409, f"Cannot move from {dispatch.status} to {next_status}")
```

**Test:** Create dispatch → try to set status=delivered directly → must get 409.

---

### FIX-20 — Steel Overview Has No Role Guard
**Severity:** MEDIUM
**File:** `backend/routers/steel.py:1619`

`GET /steel/overview` returns inventory totals, batch metrics, anomaly data, and operator performance — but has NO role guard. Any authenticated user (even `ATTENDANCE` role) can call it.

**Fix:**
```python
require_any_role(current_user, {
    UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.ADMIN, 
    UserRole.OWNER, UserRole.ACCOUNTANT
})
```

**Test:** ATTENDANCE role user calls GET /steel/overview → must get 403.

---

### FIX-21 — Credit Limit Check Race Condition
**Severity:** MEDIUM
**File:** `backend/routers/steel.py:3591-3612`

Two simultaneous invoices for the same customer both read the same outstanding balance, both compute `projected < credit_limit`, both pass, both commit → credit limit exceeded by 2x.

**Fix:** Add `SELECT ... FOR UPDATE` on the customer row before computing outstanding:
```python
customer = db.query(SteelCustomer).filter(
    SteelCustomer.id == customer_id
).with_for_update().first()
```

**Test:** Two concurrent invoice creations that together exceed credit limit → only one must succeed.

---

### FIX-22 — WhatsApp: Transport Errors Not Retried
**Severity:** HIGH
**File:** `backend/services/whatsapp_sender.py`

Network `TimeoutException` and `HTTPError` return `_failed_result` immediately — no retry. The `while attempt_count < 2` loop only retries on HTTP 5xx. A transient network blip permanently fails the WhatsApp notification with no retry.

**Fix:** Expand retry logic to cover:
- `TimeoutException` → retry with exponential backoff (500ms, 1000ms)
- `ConnectionError` → same
- HTTP 429 (rate limit) → retry after `Retry-After` header value

**Test:** Simulate network timeout → WhatsApp sender must retry at least once before giving up.

---

# WAVE 4 — DATA INTEGRITY FIXES
*These prevent silent drift in your database.*

---

### FIX-23 — Missing DB Indexes on audit_logs (Full Table Scans)
**Severity:** CRITICAL (performance / availability)
**File:** `backend/models/report.py` (AuditLog model)

Queries at `steel.py:2362, 3449, 3807` filter by `factory_id + details LIKE '%batch_code%'`. The `audit_logs` table has NO index on `factory_id` or `timestamp`. Every audit log lookup is a full table scan. With millions of rows this table will take down the application.

**Fix (Migration):**
```sql
CREATE INDEX idx_audit_logs_factory_id ON audit_logs(factory_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_logs_factory_action ON audit_logs(factory_id, action);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
```

Replace all `details LIKE '%batch_code%'` queries with a proper `batch_code` column or a dedicated join.

**Test:** Insert 100K audit log rows → query by factory_id + action → must complete in < 100ms.

---

### FIX-24 — No Audit Log Retention / Purging
**Severity:** CRITICAL (operational)
**File:** No purging mechanism exists anywhere

`audit_logs` grows unbounded. Every steel CRUD, every entry review, every auth event adds a row. No archival, no partitioning, no TTL. On a busy factory: ~500 events/day × 365 = 182,500 rows/year. In 3 years: 500K+ rows with no index → disk-full or OOM.

**Fix:**
1. Add `created_at` index (already has `timestamp` — ensure it's indexed, see FIX-23)
2. Implement an archival job:
```python
# Run weekly via cron / background job
def archive_old_audit_logs(db, keep_days=365):
    cutoff = datetime.now() - timedelta(days=keep_days)
    db.query(AuditLog).filter(AuditLog.timestamp < cutoff).delete()
    db.commit()
```
3. OR implement table partitioning by month in PostgreSQL

**Test:** Insert 1M rows → trigger archival → verify rows older than retention deleted, recent rows intact.

---

### FIX-25 — Audit Logs: IP Address Inconsistency (GDPR Risk)
**Severity:** HIGH
**File:** Multiple files — `steel.py`, `settings.py`, `auth.py`

Some code paths hash IPs via `hash_ip_address()`. Others store plaintext IPs. Four locations store raw plaintext IPs in `audit_logs.ip_address`. Under GDPR, IP addresses are personal data and must be protected consistently.

**Fix:**
1. Find all `_write_steel_audit` and `_write_admin_audit` calls that set `ip_address=request.client.host`
2. Replace all with `ip_address=hash_ip_address(request.client.host)` — same as `_write_admin_audit` already does in some paths
3. Add a migration note: existing plaintext IPs in `audit_logs` should be hashed or deleted

**Test:** Any mutation → check audit log row → `ip_address` must be a hash, never a raw IP.

---

### FIX-26 — Audit Logs Missing `previous_state` / `new_state`
**Severity:** MEDIUM
**File:** `backend/routers/steel.py:311-331` (`_write_steel_audit`)

The `AuditLog` model has `previous_state` (JSON) and `new_state` (JSON) columns. `_write_steel_audit()` never populates them — only writes a text `details` string. You cannot programmatically determine what changed on any record from the audit log alone.

**Fix:** For key mutations (status changes, financial edits, reconciliation approvals), capture before/after:
```python
_write_steel_audit(
    db, actor, factory_id, "STEEL_DISPATCH_STATUS_UPDATED",
    details=f"Dispatch {dispatch.dispatch_number}: {old_status} → {new_status}",
    previous_state={"status": old_status, "updated_at": str(old_updated_at)},
    new_state={"status": new_status, "updated_at": str(datetime.now())}
)
```

**Test:** Approve reconciliation → query audit log → `previous_state.status = "pending"`, `new_state.status = "approved"` must be present.

---

### FIX-27 — Stock Balance Computed in Python Loop (O(n) Per Check)
**Severity:** CRITICAL (performance)
**File:** `backend/services/steel_service.py:76`

`stock_balances_for_factory()` loads ALL transactions into Python and sums them in a loop. This is called on EVERY inventory check — every dispatch, every batch, every overview load.

**Fix:** Replace with a single SQL aggregation:
```sql
SELECT item_id, SUM(quantity_kg) as balance
FROM steel_inventory_transactions
WHERE factory_id = :factory_id AND is_active = true
GROUP BY item_id
```
```python
def stock_balances_for_factory(db, factory_id):
    rows = db.execute(text("""
        SELECT item_id, SUM(quantity_kg) as balance
        FROM steel_inventory_transactions
        WHERE factory_id = :fid AND is_active = true
        GROUP BY item_id
    """), {"fid": factory_id}).fetchall()
    return {r.item_id: float(r.balance) for r in rows}
```

**Test:** Factory with 100K transactions → call `stock_balances_for_factory()` → must complete in < 200ms.

---

### FIX-28 — Production Metrics Loads Entire Table (OOM Risk)
**Severity:** CRITICAL (performance)
**File:** `backend/services/steel_service.py:400`

`build_steel_realization_metrics()` loads ALL production batches with NO LIMIT. Called on every steel overview load. A factory with 100K batches = instant OOM crash.

**Fix:**
```python
# Add pagination or date-windowed query:
batches = db.query(SteelProductionBatch).filter(
    SteelProductionBatch.factory_id == factory_id,
    SteelProductionBatch.batch_date >= cutoff_date  # e.g., last 90 days
).limit(1000).all()  # Hard cap for metrics calculation
```
For aggregate metrics (avg_loss_percent, top_loss), use SQL aggregation instead of loading rows:
```sql
SELECT AVG(loss_percent), MAX(loss_kg), COUNT(*) FROM steel_production_batches
WHERE factory_id = :fid AND batch_date >= :cutoff
```

**Test:** Factory with 100K batches → call steel overview → must complete in < 2s, no OOM.

---

# WAVE 5 — PERMISSION & ROLE CLEANUP

### FIX-29 — Add Role Guards to AI + Intelligence Endpoints
**Severity:** MEDIUM
**Files:** `backend/routers/ai.py:585-965`, `backend/routers/intelligence.py:27-71`

8 AI endpoints and 4 intelligence endpoints are authenticated but have zero role restriction. Any ATTENDANCE-level user can call AI features meant for MANAGER+.

**Fix:** Add to each endpoint:
```python
require_any_role(current_user, {UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.ADMIN, UserRole.OWNER})
```

**Test:** ATTENDANCE role user calls `POST /ai/suggest` → must get 403.

---

### FIX-30 — Supervisor Blocked from Creating Stock Reconciliation
**Severity:** MEDIUM
**File:** `backend/routers/steel.py:1931` (POST /steel/inventory/reconciliations)

Requires `UserRole.MANAGER`. Standard SUPERVISOR (Inventory Staff) cannot record their own physical stock count. This is the person who physically counts inventory.

**Fix:** Change guard to:
```python
require_any_role(current_user, {UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.ADMIN, UserRole.OWNER})
```

**Test:** SUPERVISOR calls POST /steel/inventory/reconciliations → must succeed.

---

### FIX-31 — Operator Cannot View Dispatches
**Severity:** LOW
**File:** `backend/routers/steel.py:3691` (GET /steel/dispatches)

Operators need to view dispatches to verify loading weights against batch output. Currently blocked.

**Fix:** Add OPERATOR to the GET dispatches role list (read-only view only, not create/update).

---

### FIX-32 — Globally Unique Constraints Not Factory-Scoped
**Severity:** HIGH
**File:** `backend/models/steel_sales_invoice.py`, `steel_dispatch.py`, etc.

`invoice_number`, `dispatch_number`, `gate_pass_number`, `batch_code` all have GLOBALLY UNIQUE constraints — not scoped to `factory_id`. Two different factories (say DPR-Mumbai and DPR-Pune) can never share the same numbering sequence (e.g., INV-2026-001).

**Fix (Migration):**
```sql
ALTER TABLE steel_sales_invoices DROP CONSTRAINT uq_invoice_number;
ALTER TABLE steel_sales_invoices ADD CONSTRAINT uq_invoice_number_factory 
    UNIQUE (factory_id, invoice_number);
-- Repeat for dispatch_number, gate_pass_number, batch_code
```

**Test:** Factory A creates INV-2026-001 → Factory B also creates INV-2026-001 → must BOTH succeed.

---

### FIX-33 — Customer Has No Update/Status-Change Endpoint
**Severity:** HIGH
**File:** `backend/routers/steel.py` (missing PUT /steel/customers/{id})

`SteelCustomer.status` (active/on_hold/blocked), `credit_limit`, `payment_terms_days` are frozen on creation. There is no endpoint to modify them. You can block a customer check-at-creation but cannot change it later.

**Fix:** Add `PUT /steel/customers/{id}` endpoint with fields: `status`, `credit_limit`, `payment_terms_days`, `name`, `contact_*`

**Test:** Create customer with `status=active` → call PUT to set `status=on_hold` → subsequent invoice creation must be blocked.

---

# WAVE 6 — UX & MINOR FIXES

### FIX-34 — OCR Frontend Shows Wrong File Size Limit
**Severity:** LOW
**File:** `web/src/lib/ocr-access.ts:44-45`

Error message says "Image must be under 8 MB" but backend limit is 5 MB.

**Fix:** Change error message to "Image must be under 5 MB."

---

### FIX-35 — PDF OCR Accepted by Frontend, Rejected by Backend
**Severity:** MEDIUM
**File:** `web/src/lib/ocr-access.ts` (allowPdf: true) vs `backend/routers/ocr.py`

Frontend passes `allowPdf: true` in file picker. Backend always rejects PDFs because it checks `Content-Type starts with "image/"`. User uploads a PDF, frontend accepts it, backend rejects with a confusing error.

**Fix:** Either:
1. Add PDF support to backend (handle `application/pdf` Content-Type + pdftoimage conversion), OR
2. Remove `allowPdf: true` from frontend — stop showing PDF as an accepted format

---

### FIX-36 — Excel Export Vulnerable to Formula Injection
**Severity:** MEDIUM
**File:** `backend/routers/reports.py:138-188`

Entry fields are written directly to Excel cells without sanitization. A user who enters `=HYPERLINK("http://evil.com","Click")` in a notes field will have it execute when the manager opens the Excel export.

**Fix:**
```python
def _safe_cell_value(value: str) -> str:
    if value and str(value).startswith(('=', '+', '-', '@')):
        return "'" + value  # Prefix with single quote to force text
    return value
```
Apply to all string fields in Excel export.

---

### FIX-37 — No Confirmation Prompt Before Irreversible Dispatch Actions
**Severity:** LOW
**File:** Frontend dispatch UI

Once a dispatch posts inventory (moves to `exited`/`dispatched`/`delivered`), it cannot be cancelled. There is no warning to the user before this irreversible step.

**Fix:** Add a confirmation dialog before any status change that posts inventory: "This will deduct X kg of item Y from inventory. This cannot be undone."

---

### FIX-38 — Registration Silently Ignores Requested Role
**Severity:** MEDIUM
**File:** `backend/routers/auth.py:751`

When a user registers with an existing org and requests OPERATOR role, they are silently assigned ATTENDANCE. The user is never told their requested role was ignored.

**Fix:** Either:
1. Return the actual assigned role in the registration response so the user knows, OR
2. Do not accept a `role` parameter in public registration — always assign ATTENDANCE and document this

---

### FIX-39 — No Timeout on Report/Analytics Queries
**Severity:** MEDIUM
**File:** `backend/routers/reports.py`, `backend/services/background_jobs.py`

Large date range queries (`/excel-range`, `/insights`) run with no timeout. A factory with millions of entries can hang the 4-worker thread pool indefinitely, blocking all other export jobs.

**Fix:**
```python
# Add to DB session config:
engine = create_engine(DATABASE_URL, connect_args={"options": "-c statement_timeout=30000"})
# 30 second timeout on all statements
```
Also add per-endpoint result limits:
```python
.filter(...).limit(10000)  # Hard cap on export rows
```

---

### FIX-40 — Open Redirect on Login `next` Parameter
**Severity:** LOW
**File:** `web/src/app/login/page.tsx:176-185`

The `next` parameter sanitization only checks for `//` prefix, missing protocol-relative redirects like `\/evil.com` or encoded variants.

**Fix:**
```typescript
// Replace current check with allowlist approach:
const isAllowedRedirect = (url: string) => {
    return url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/\\');
};
```

---

# MASTER FIX SEQUENCE SUMMARY

| Wave | Fix | Severity | Module | Effort |
|------|-----|----------|--------|--------|
| 1 | FIX-01 | CRITICAL | Inventory/Dispatch/Batch | 2h |
| 1 | FIX-02 | CRITICAL | Roles | 30min |
| 1 | FIX-03 | CRITICAL | Auth | 2h |
| 1 | FIX-04 | CRITICAL | Sales/Billing | 2 days |
| 1 | FIX-05 | CRITICAL | Auth | 1h |
| 2 | FIX-06 | HIGH | Steel/Reconciliation | 30min |
| 2 | FIX-07 | HIGH | Dispatch | 30min |
| 2 | FIX-08 | HIGH | Roles | 30min |
| 2 | FIX-09 | HIGH | Auth/RBAC | 2 days |
| 2 | FIX-10 | HIGH | Auth | 30min |
| 2 | FIX-11 | HIGH | Auth | 30min |
| 2 | FIX-12 | HIGH | Auth | 1h |
| 3 | FIX-13 | HIGH | Sales | 2h |
| 3 | FIX-14 | HIGH | Sales | 4 days |
| 3 | FIX-15 | HIGH | Purchase | 8.5 days |
| 3 | FIX-16 | HIGH | OCR | 30min |
| 3 | FIX-17 | MEDIUM | OCR | 1h |
| 3 | FIX-18 | HIGH | Billing | 1h |
| 3 | FIX-19 | MEDIUM | Dispatch | 1h |
| 3 | FIX-20 | MEDIUM | Steel | 10min |
| 3 | FIX-21 | MEDIUM | Sales | 1h |
| 3 | FIX-22 | HIGH | WhatsApp | 2h |
| 4 | FIX-23 | CRITICAL | Audit/DB | 1h (migration) |
| 4 | FIX-24 | CRITICAL | Audit/DB | 2h |
| 4 | FIX-25 | HIGH | Audit | 1h |
| 4 | FIX-26 | MEDIUM | Audit | 2 days |
| 4 | FIX-27 | CRITICAL | Performance | 2h |
| 4 | FIX-28 | CRITICAL | Performance | 2h |
| 5 | FIX-29 | MEDIUM | Roles | 30min |
| 5 | FIX-30 | MEDIUM | Roles | 10min |
| 5 | FIX-31 | LOW | Roles | 10min |
| 5 | FIX-32 | HIGH | DB | 1h (migration) |
| 5 | FIX-33 | HIGH | Customers | 3h |
| 6 | FIX-34 | LOW | OCR UI | 5min |
| 6 | FIX-35 | MEDIUM | OCR | 2h |
| 6 | FIX-36 | MEDIUM | Reports | 1h |
| 6 | FIX-37 | LOW | Dispatch UI | 2h |
| 6 | FIX-38 | MEDIUM | Auth | 30min |
| 6 | FIX-39 | MEDIUM | Reports | 1h |
| 6 | FIX-40 | LOW | Auth UI | 30min |

---

## MINIMUM PATH TO STAGED PRODUCTION

Fix only FIX-01 through FIX-12 + FIX-23 + FIX-27 + FIX-28 (13 fixes) and the system is safe enough for a monitored staged rollout with real users.

**Estimated effort:** 5-6 engineering days.

**Remaining fixes** (FIX-13 through FIX-40) are required before General Availability.

---

## DO NOT SHIP UNTIL THESE 5 ARE DONE

1. **FIX-01** — Stock can go negative (inventory loss)
2. **FIX-04** — Invoices have no GST (legal non-compliance, India)
3. **FIX-23 + FIX-27 + FIX-28** — App will crash under load (OOM + full table scans)
