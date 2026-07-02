Comprehensive Steel Sales & Billing Audit Report

### Models Read

- `D:\DPR APP\DPR.ai\backend\models\steel_sales_invoice.py` (46 lines)
- `D:\DPR APP\DPR.ai\backend\models\steel_sales_invoice_line.py` (31 lines)
- `D:\DPR APP\DPR.ai\backend\models\steel_customer.py` (66 lines)
- `D:\DPR APP\DPR.ai\backend\models\steel_customer_payment.py` (35 lines)
- `D:\DPR APP\DPR.ai\backend\models\steel_customer_payment_allocation.py` (29 lines)
- `D:\DPR APP\DPR.ai\backend\routers\steel.py` (4326 lines) - critical functions
- `D:\DPR APP\DPR.ai\backend\services\steel_service.py` (837 lines) - `generate_invoice_number`
- `D:\DPR APP\DPR.ai\backend\rbac.py` (51 lines)
- `D:\DPR APP\DPR.ai\backend\security.py` (137 lines) - `get_current_user`
- `D:\DPR APP\DPR.ai\backend\tenancy.py` (28 lines) - `resolve_factory_id`
- `D:\DPR APP\DPR.ai\backend\models\report.py` (61 lines) - `AuditLog`
- `D:\DPR APP\DPR.ai\backend\models\user.py` (124 lines) - `UserRole`

---

### Answers to Specific Questions

**1. Is GST calculated? What is the formula? Is it correct?**

**No.** GST is **not** calculated. In `create_steel_invoice` (line 3627):
```python
total_amount=round(subtotal_amount, 2),
```
`total_amount` is set **equal** to `subtotal_amount`. The formula is:
```
line_total = weight_kg * rate_per_kg
subtotal_amount = sum(line_totals)
total_amount = subtotal_amount    ✗ No GST added
```
The `SteelSalesInvoice` model has **no** `gst_amount`, `tax_rate`, `cgst`, `sgst`, `igst`, or `tax_amount` columns. This is a **legal compliance issue** for India where GST is mandatory on steel invoices.

---

**2. Can invoice be generated without confirmed sales order?**

**Yes.** There is **no sales order model, no sales_order_id field, and no sales order dependency** anywhere in the steel module. Invoices are created independently with just a customer and line items. There is no `status` flow like `quotation -> sales_order -> invoice`. Invoices go directly to `"unpaid"` status.

---

**3. Can invoice be edited after sent?**

**No edit/update endpoint exists.** There is **no** `PUT` or `PATCH /invoices/{id}` endpoint. There is also **no** cancel/void/credit-note endpoint. The only way the invoice `status` field changes is through `_refresh_invoice_payment_statuses` (called during payment allocation), which transitions: `unpaid -> partial -> paid`. Once created, an invoice cannot be modified, cancelled, or reversed in any way.

---

**4. Does outstanding balance update immediately on payment?**

**Yes, within the same transaction.** In `create_steel_customer_payment` (line 3219), `_refresh_invoice_payment_statuses` is called before `db.commit()` (line 3231), so the invoice status update is atomic with the payment creation. The outstanding balance is computed on-the-fly from queries (`total_amount - paid_by_invoice`) rather than stored as a persisted field.

---

**5. Is invoice number generation unique and collision-resistant?**

**No -- race condition exists.** `generate_invoice_number` (in `steel_service.py:229-245`):
```python
existing = db.query(SteelSalesInvoice.invoice_number) \
    .filter(SteelSalesInvoice.invoice_number.like(f"{prefix}%")) \
    .order_by(SteelSalesInvoice.id.desc()).first()
sequence = 1
if existing and existing[0]:
    tail = str(existing[0]).split("-")[-1]
    if tail.isdigit():
        sequence = int(tail) + 1
return f"{prefix}{sequence:03d}"
```
Then in `create_steel_invoice` (lines 3515-3524), there is a separate read-check-insert:
1. Generate number (reads DB)
2. Query to check if number exists (reads DB again)
3. Insert invoice (flush)
4. Commit

Between steps 1 and 4 a concurrent request can read the same "last" sequence and generate the same number. While a **unique index** exists on `invoice_number` at the DB level, the error at commit time would be an unhandled `IntegrityError` leading to a **500 Internal Server Error** (not a clean 409).

---

**6. What role guards exist?**

Role guards for each endpoint family:

| Endpoint | Allowed Roles |
|---|---|
| `GET /invoices` | MANAGER, ADMIN, OWNER, ACCOUNTANT |
| `GET /invoices/{id}` | MANAGER, ADMIN, OWNER, ACCOUNTANT |
| `POST /invoices` | MANAGER, ADMIN, OWNER, ACCOUNTANT |
| `POST /customers` | MANAGER, ADMIN, OWNER, ACCOUNTANT |
| `GET /customers` | MANAGER, ADMIN, OWNER, ACCOUNTANT |
| `POST /customers/payments` | MANAGER, ADMIN, OWNER, ACCOUNTANT |
| `POST /dispatches` | SUPERVISOR, MANAGER, ADMIN, OWNER |
| `POST /dispatches/{id}/status` | SUPERVISOR, MANAGER, ADMIN, OWNER |
| `GET /dispatches` | SUPERVISOR, MANAGER, ADMIN, OWNER, ACCOUNTANT |
| `POST /inventory/reconciliations/{id}/approve` | SUPERVISOR, MANAGER, ADMIN, OWNER |

Note: **OPERATOR** and **ATTENDANCE** roles have **no access** to any steel endpoint.

---

**7. Is factoryId from session?**

**Yes.** `factory_id` comes from the JWT token payload (set at login via factory selection). `get_current_user` (security.py:89) extracts `factory_id` from the token and sets it as `user.active_factory_id`. `resolve_factory_id` (tenancy.py:17-28) reads this attribute, falling back to the user's first assigned factory. All steel endpoints call `require_active_steel_factory` which enforces that the selected factory has `industry_type == "steel"`. Data is consistently scoped by `factory_id` on all queries and creations.

---

**8. Audit logging for each mutation?**

**Yes, with caveats.** `_write_steel_audit` (line 311-331) is called for:
- `STEEL_CUSTOMER_CREATED`
- `STEEL_INVOICE_CREATED`
- `STEEL_CUSTOMER_PAYMENT_RECORDED`
- `STEEL_DISPATCH_CREATED`
- Various other operations

**Missing features:** The `AuditLog` model has `previous_state` and `new_state` JSON columns, but `_write_steel_audit` **never populates them**. The audit trail records action text in `details` but not structured before/after snapshots. This means you cannot programmatically determine what changed (e.g., "credit limit changed from 50,000 to 100,000") -- you'd have to parse the free-text `details` column.

---

**9. Credit limit enforcement -- any race condition?**

**Yes -- TOCTOU race.** In `create_steel_invoice` (lines 3591-3612):
```python
current_invoice_total = db.query(sum(...)).filter(customer_id=...).scalar()
current_payment_total = db.query(sum(...)).filter(customer_id=...).scalar()
projected_outstanding = max(0, current_invoice_total - current_payment_total) + subtotal_amount
if projected_outstanding > credit_limit:
    raise HTTPException(...)
# ... create and commit invoice ...
```

There is **no** `SELECT ... FOR UPDATE` or row-level lock. Between computing the projected outstanding and committing the new invoice, a concurrent request for the same customer can:
1. Also compute the same (understated) outstanding
2. Both pass the credit limit check
3. Both commit, exceeding the credit limit by up to 2x the allowed margin

---

**10. Self-approval prevention?**

**Missing entirely.** The `assert_not_self_approval` function exists in `backend/rbac.py` (line 37-39) and is used in the `attendance` and `entries` modules, but it is **never imported or called** anywhere in the `steel.py` router. A user with MANAGER role (or higher) can:
- Create a customer with any credit limit (no approval workflow)
- Create an invoice for any customer
- Record a payment for any invoice they created
- Approve stock reconciliations they created

---

### Complete Bug List

---

#### BUG-SALES-001: GST/Tax Not Calculated on Invoices

**Severity:** Critical (Legal Compliance)

**File:** `D:\DPR APP\DPR.ai\backend\routers\steel.py`, line 3627

**Description:** `total_amount` is set equal to `subtotal_amount` with no addition of GST/CGST/SGST/IGST. The `SteelSalesInvoice` model has no tax-related columns whatsoever.

**Evidence:**
```python
# Line 3626-3627
subtotal_amount=round(subtotal_amount, 2),
total_amount=round(subtotal_amount, 2),  # Same value — no tax
```

**Impact:** Invoices generated are non-compliant with Indian GST law. Tax authorities require GST to be separately shown on invoices for steel transactions. This could result in:
- Inability to claim input tax credit by buyers
- Penalties for non-compliant invoicing
- Audit failures during GST assessments

**Fix:** Add GST rate configuration (per-item or per-customer), compute CGST/SGST (intra-state) or IGST (inter-state) based on the customer's GST state vs. factory state, and include `gst_amount`, `cgst_amount`, `sgst_amount`/`igst_amount` columns in the model and serialization.

---

#### BUG-SALES-002: Invoice Number Generation Race Condition (TOCTOU)

**Severity:** High

**File:** `D:\DPR APP\DPR.ai\backend\services\steel_service.py`, lines 229-245 and `D:\DPR APP\DPR.ai\backend\routers\steel.py`, lines 3515-3524

**Description:** Three separate round-trips to the database between generating the number and committing the invoice. A concurrent request can observe the same "last" sequence and generate a duplicate invoice number. The DB unique index will catch it, but only as an unhandled `IntegrityError` at commit time, resulting in a `500` instead of a clean `409`.

**Evidence:**
```python
# steel_service.py:234-245
existing = db.query(...).order_by(SteelSalesInvoice.id.desc()).first()  # Read 1
sequence = int(tail) + 1 if tail.isdigit() else 1
return f"{prefix}{sequence:03d}"

# steel.py:3515-3524
invoice_number = generate_invoice_number(db, factory)   # Read 1
existing = db.query(SteelSalesInvoice.id).filter(        # Read 2
    SteelSalesInvoice.invoice_number == invoice_number
).first()
if existing:
    raise HTTPException(status_code=409, ...)
# ...
db.add(invoice)   # Write
db.commit()       # Could raise IntegrityError here → 500
```

**Impact:** Under concurrent load (e.g., multiple users creating invoices simultaneously), users receive `500 Internal Server Error` instead of a proper duplicate error. The duplicate number is never persisted (unique index blocks it), but the user experience is broken.

**Fix:** Use a `SELECT ... FOR UPDATE` on a sequence counter table, or use a DB sequence/UUID, or wrap the generation+insert in a retry loop that catches `IntegrityError` and regenerates the number.

---

#### BUG-SALES-003: Credit Limit Enforcement Race Condition (TOCTOU)

**Severity:** High

**File:** `D:\DPR APP\DPR.ai\backend\routers\steel.py`, lines 3591-3612

**Description:** The credit limit check reads current invoice totals and payment totals without any row-level locking (`FOR UPDATE`). Two concurrent invoice creation requests for the same customer can both pass the credit limit check and both commit, exceeding the customer's credit limit by up to 2x.

**Evidence:**
```python
# Lines 3591-3612 - No FOR UPDATE
current_invoice_total = float(
    db.query(func.coalesce(func.sum(SteelSalesInvoice.total_amount), 0))
    .filter(SteelSalesInvoice.customer_id == customer.id).scalar() or 0.0
)
current_payment_total = float(
    db.query(func.coalesce(func.sum(SteelCustomerPayment.amount), 0))
    .filter(SteelCustomerPayment.customer_id == customer.id).scalar() or 0.0
)
projected_outstanding = max(0.0, current_invoice_total - current_payment_total) + float(subtotal_amount)
if projected_outstanding - float(customer.credit_limit or 0.0) > 0.01:
    raise HTTPException(...)
# ... later at line 3664: db.commit()
```

**Impact:** Customers can exceed their approved credit limit. Credit exposure is a financial risk that can result in bad debt if the customer cannot pay. In worst case, a customer with a ₹1,00,000 credit limit could have ₹2,00,000+ invoiced.

**Fix:** Use `SELECT ... FOR UPDATE` on the `steel_customumers` row for that customer, or use application-level optimistic locking with a version column on the customer record, or use PostgreSQL advisory locks.

---

#### BUG-SALES-004: No Invoice Cancellation/Void/Credit-Note Mechanism

**Severity:** High

**File:** `D:\DPR APP\DPR.ai\backend\routers\steel.py`

**Description:** There is no endpoint to cancel, void, or credit-note an invoice. Once created, an invoice is permanent. If an invoice is created with wrong data (wrong customer, wrong amounts, wrong items), there is no way to correct it. The only status transition is `unpaid -> partial -> paid` via payment allocations.

**Evidence:** Running `grep` for `@router\.(put|patch|delete)` on invoices or customers yields zero results in steel.py. The invoice status is only modified in `_refresh_invoice_payment_statuses` (lines 1237-1247).

**Impact:** Operational risk. A data entry error cannot be corrected without database-level intervention. Financial reconciliation becomes impossible if erroneous invoices exist. Accounting standards require the ability to issue credit notes for corrections.

**Fix:** Add a `POST /invoices/{id}/cancel` or `POST /invoices/{id}/credit-note` endpoint that creates a negative-value correcting invoice or marks the original as `cancelled`.

---

#### BUG-SALES-005: No Self-Approval Prevention in Steel Module

**Severity:** Medium

**File:** `D:\DPR APP\DPR.ai\backend\routers\steel.py`

**Description:** The `assert_not_self_approval` function from `backend/rbac.py` is never imported or called in the steel module (it IS used in `attendance.py` and `entries.py`). A MANAGER can create customers, set credit limits, create invoices, record payments, and approve stock reconciliations without any segregation of duties.

**Evidence:** `grep "assert_not_self_approval" steel.py` returns zero results. Compare with `attendance.py` which uses it at lines 1565 and 1690.

**Impact:** A rogue manager could:
- Create a customer for themselves with a high credit limit
- Create an invoice to that customer
- Record a fake payment to close the invoice
- No other role reviews these actions

**Fix:** Apply `assert_not_self_approval` checks on critical operations where the same user performs sequential steps (e.g., creator vs. approver for stock reconciliations, creator vs. reviewer for customer verifications).

---

#### BUG-SALES-006: Customer Auto-Creation During Invoice Bypasses Validation

**Severity:** Medium

**File:** `D:\DPR APP\DPR.ai\backend\routers\steel.py`, lines 3536-3553

**Description:** When an invoice is created with a `customer_name` that doesn't match any active customer, a bare-minimum `SteelCustomer` is auto-created with **no** contact information validation. The normal `create_steel_customer` endpoint requires at least a `phone` or `email` (line 2590-2591), but this code path creates a customer with only `name`, `org_id`, `factory_id`, `payment_terms_days`, and `created_by_user_id`.

**Evidence:**
```python
# Auto-creation (lines 3546-3553) - Only 5 fields set
customer = SteelCustomer(
    org_id=factory.org_id,
    factory_id=factory.factory_id,
    name=customer_name,
    payment_terms_days=payment_terms_days,
    created_by_user_id=current_user.id,
)
db.add(customer)

# Normal creation (lines 2617-2637) - 16 fields with validation
customer = SteelCustomer(
    org_id=..., factory_id=..., name=name,
    phone=phone, email=email, address=address, city=city, state=state,
    tax_id=tax_id, gst_number=gst_number, pan_number=pan_number,
    company_type=company_type, contact_person=contact_person,
    designation=designation, credit_limit=credit_limit,
    payment_terms_days=payment_terms_days, status=...,
    notes=notes, created_by_user_id=...,
)
```

**Impact:** Invoice-based customer creation bypasses:
- Phone/email validation (line 2590-2591: "At least one contact method is required")
- GST number format validation (line 2592)
- PAN number format validation (line 2593)
- Credit limit requirement (line 2594, `_normalize_customer_credit_limit`)
- Duplicate name case-insensitive check (lines 2605-2615, though the query at line 3539-3541 partially covers this)

**Fix:** Remove customer auto-creation from `create_steel_invoice`, or validate all required fields and call the same normalization functions as `create_steel_customer`.

---

#### BUG-SALES-007: Excess Payment Amount Silently Unallocated

**Severity:** Medium

**File:** `D:\DPR APP\DPR.ai\backend\routers\steel.py`, lines 3174-3183

**Description:** When recording a payment without specific allocations or a specific invoice (the "else" branch), the code iterates through the customer's invoices and allocates payment to outstanding amounts. If there is remaining payment after all invoices are exhausted, the excess is **silently ignored** and stored as an unallocated payment with `invoice_id=NULL`. This amount is effectively invisible to the outstanding balance computation.

**Evidence:**
```python
# Lines 3174-3183
remaining_payment = round(float(payload.amount or 0.0), 2)
for target_invoice in customer_invoices:
    outstanding_amount = float(remaining_by_invoice.get(int(target_invoice.id), 0.0))
    if outstanding_amount <= 0.01 or remaining_payment <= 0.01:
        continue
    applied_amount = round(min(remaining_payment, outstanding_amount), 2)
    requested_allocations.append((target_invoice, applied_amount))
    remaining_payment = round(remaining_payment - applied_amount, 2)
# remaining_payment > 0 is silently dropped — no allocation created for the excess
```

Also in `_build_payment_allocation_maps` (line 1065):
```python
if payment_id in explicit_payment_ids or payment.invoice_id is None:
    continue  # Unlinked payments are skipped!
```

**Impact:** A payment of ₹50,000 may only allocate ₹48,000 to invoices, with ₹2,000 disappearing from the customer's outstanding view. This creates reconciliation nightmares and potential financial loss.

**Fix:** Either (a) raise an error if remaining_payment > 0.01 after the loop, (b) create an unallocated payment record that is visible in the ledger, or (c) return the unallocated amount in the response and require the user to handle it.

---

#### BUG-SALES-008: Credit Limit Check Does Not Filter by Invoice Status

**Severity:** Medium

**File:** `D:\DPR APP\DPR.ai\backend\routers\steel.py`, lines 3592-3598

**Description:** The credit limit check sums `total_amount` for **all** invoices regardless of status. If an invoice exists in a cancelled/voided state (once such functionality is added), it would still count against the credit limit. Currently this is partially mitigated by the fact that no cancel/void endpoint exists and the only statuses are `unpaid|partial|paid`, but as soon as status-based filtering is needed, this will break.

**Evidence:**
```python
# Lines 3592-3598 - No .filter(SteelSalesInvoice.status.in_(...))
current_invoice_total = float(
    db.query(func.coalesce(func.sum(SteelSalesInvoice.total_amount), 0))
    .filter(
        SteelSalesInvoice.factory_id == factory.factory_id,
        SteelSalesInvoice.customer_id == customer.id,
        # MISSING: status filter for unpaid/partial only
    ).scalar() or 0.0
)
```

**Impact:** If a credit note or cancellation flow is added later, paid/cancelled invoices would still consume credit limit, falsely restricting the customer's purchasing power.

**Fix:** Add a filter for invoice statuses that represent actual outstanding obligations: `SteelSalesInvoice.status.in_(["unpaid", "partial"])`.

---

#### BUG-SALES-009: Payment Allocation Race Condition — Double Allocation

**Severity:** High

**File:** `D:\DPR APP\DPR.ai\backend\routers\steel.py`, lines 3139-3147 and 3149-3163

**Description:** `remaining_by_invoice` is computed at the start of the request by reading existing allocations from the database. Two concurrent payment requests can both see the same outstanding balance (e.g., ₹100) and both allocate ₹100 to the same invoice, resulting in a total allocation of ₹200 against a ₹100 invoice. There is no `FOR UPDATE` or optimistic lock.

**Evidence:**
```python
# Lines 3139-3147: Read once at request start
_, paid_by_invoice, _ = _build_payment_allocation_maps(
    payments=customer_payments,
    allocations=allocation_rows,  # Existing allocations only
    invoice_map=invoice_map,
)
remaining_by_invoice = {
    int(row.id): round(max(0.0, float(row.total_amount or 0.0) - float(paid_by_invoice.get(int(row.id), 0.0))), 2)
    for row in customer_invoices
}
# No FOR UPDATE on the invoice rows!

# Lines 3160-3163: Check against the possibly-stale remaining_by_invoice
if requested_totals_by_invoice[int(target_invoice.id)] - float(remaining_by_invoice.get(...)) > 0.01:
    raise HTTPException(...)
```

**Impact:** An invoice can be overpaid, meaning the total allocated payments exceed the invoice `total_amount`. While the invoice status would correctly show "paid" (line 1242-1243), the extra allocated amount is effectively lost — it cannot be recovered or re-allocated to another invoice.

**Fix:** Use `SELECT ... FOR UPDATE` on the affected invoice rows before computing `remaining_by_invoice`, or use a constraint at the database level (check constraint on `SteelCustomerPaymentAllocation` aggregate per invoice), or use advisory locks keyed by `(customer_id, invoice_id)`.

---

#### BUG-SALES-010: Race Condition in Customer Auto-Creation During Invoice

**Severity:** Medium

**File:** `D:\DPR APP\DPR.ai\backend\routers\steel.py`, lines 3536-3553

**Description:** When two concurrent invoice requests encounter the same non-existent customer name, both will fail the `SELECT` query (line 3537-3544), both will try to `INSERT` a new `SteelCustomer`, and the second commit will fail with an unhandled `IntegrityError` due to the unique constraint on `(factory_id, name)`.

**Evidence:**
```python
# Lines 3537-3544: Both requests see no existing customer
customer = db.query(SteelCustomer).filter(
    SteelCustomer.factory_id == factory.factory_id,
    func.lower(SteelCustomer.name) == customer_name.lower(),
    SteelCustomer.is_active.is_(True),
).first()
# Both proceed to create (line 3546-3553)

# Line 3664: The second request's commit raises IntegrityError
db.commit()  # Unhandled — results in 500
```

**Impact:** Under concurrent load, invoice creation for new customer names results in `500 Internal Server Error`.

**Fix:** Wrap the customer lookup+create in a retry loop catching `IntegrityError`, or use `INSERT ... ON CONFLICT DO NOTHING` / `ON CONFLICT DO UPDATE`, or use a `SELECT ... FOR UPDATE` on a unique constraint check.

---

### Summary Table

| Bug ID | Description | Severity | Type | File(s) |
|--------|-------------|----------|------|---------|
| **BUG-SALES-001** | GST/Tax not calculated on invoices | **Critical** | Compliance | `steel.py:3627` |
| **BUG-SALES-002** | Invoice number generation race condition (500 on collision) | **High** | Race Condition | `steel_service.py:229-245`, `steel.py:3515-3524` |
| **BUG-SALES-003** | Credit limit enforcement race condition (TOCTOU) | **High** | Race Condition | `steel.py:3591-3612` |
| **BUG-SALES-004** | No invoice cancellation/void/credit-note mechanism | **High** | Missing Feature | `steel.py` (no put/patch/delete endpoints) |
| **BUG-SALES-005** | No self-approval prevention in steel module | **Medium** | Missing Control | `steel.py` (no `assert_not_self_approval`) |
| **BUG-SALES-006** | Customer auto-creation during invoice bypasses validation | **Medium** | Missing Validation | `steel.py:3546-3553` |
| **BUG-SALES-007** | Excess payment amount silently unallocated | **Medium** | Data Loss | `steel.py:3174-3183` |
| **BUG-SALES-008** | Credit limit check not filtering by invoice status | **Medium** | Logic Error | `steel.py:3592-3598` |
| **BUG-SALES-009** | Payment allocation race condition (double allocation) | **High** | Race Condition | `steel.py:3139-3163` |
| **BUG-SALES-010** | Race condition in customer auto-creation during invoice | **Medium** | Race Condition | `steel.py:3536-3553` |