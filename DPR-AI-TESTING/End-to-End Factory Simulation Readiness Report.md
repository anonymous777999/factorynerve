End-to-End Factory Simulation Readiness Report

## Overview

The codebase has two distinct operational domains:
- **General Production** (the `Entry`/shift-based module in `entries.py`, `settings.py`, `reports.py`) -- handles daily production reports, manpower, downtime tracking.
- **Steel Industry** (the `steel.py` router + 12 steel models) -- handles inventory items, batches, customers, sales invoices, dispatches, payments, stock reconciliations, and follow-up tasks.

The steel module is the most complete domain for an end-to-end simulation. The general production system lacks vendor/Purchase/PO/GRN entirely.

---

## Step-by-Step Trace

### STEP 01: Create company profile / Organization
**Grading: FULLY IMPLEMENTED**

- **Endpoint:** `POST /auth/register` (auth.py:820) -- registration flow uses `PendingRegistration` + email verification
- **Organization:** Created implicitly during `_activate_pending_registration()` -- when the first user registers, `resolve_registration_context()` creates the `Organization` row. The first user gets `OWNER` role.
- **Company code:** Accepted via `RegisterRequest.company_code`, validated against `Factory.factory_code` or `User.factory_code` in `_preview_public_registration()`.
- **Limitation:** No explicit `POST /settings/factory` for org creation during registration -- the org is auto-created. A `GET /factory-profiles` endpoint (line 470) lists available industry types.

**Risk:** Low. The flow works but the UX depends on `company_code` discovery. A user without a company code cannot self-register as owner -- they'd need an invite.

---

### STEP 02: Add factory location
**Grading: FULLY IMPLEMENTED**

- **Endpoint:** `POST /factories` (settings.py:562)
- **Validation:** Duplicate name check (`func.lower(Factory.name)` + `Factory.org_id` scoped), global `FactorySettings` name conflict, `org_id` required, plan limit check via `enforce_factory_limit()`
- **Auto-creates:** `FactorySettings` row, `UserFactoryRole` for the creator
- **Factory fields:** name, location, address, timezone, industry_type, workflow_template_key, factory_code (auto-generated via `_issue_factory_code()`)
- **RBAC:** Requires `UserRole.MANAGER` or higher
- **Audit:** `FACTORY_CREATED` written to `AuditLog`

**Risk:** Low. Well-validated with duplicate protection, plan enforcement, and audit trails.

---

### STEP 03: Create users with roles (Invite flow)
**Grading: FULLY IMPLEMENTED**

- **Invite:** `POST /users/invite` (settings.py:832)
- **Validation:** Role hierarchy (`_assert_role_assignment_allowed`), plan feature check (accountant role requires Growth plan), user limit check, duplicate email/org conflict, existing user re-activation
- **Delivery modes:** Email (via SMTP) or preview (returns temp_password + links directly)
- **Factory assignment:** Auto creates `UserFactoryRole` for the active factory
- **Role management:** `PUT /users/{user_id}/role` with rank-order enforcement (MANAGER can only assign lower roles, cannot modify >= own rank), "DOWNGRADE" confirmation for demotions, last-admin protection
- **Factory access control:** `GET/PUT /users/{user_id}/factory-access` for multi-factory assignment
- **User deactivation:** `DELETE /users/{user_id}` with last-admin protection

**Risk:** Low. Thoroughly protected role hierarchy with rank ordering. All states handled.

---

### STEP 04: Add inventory (Steel factory check)
**Grading: FULLY IMPLEMENTED**

- **Factory check:** `require_active_steel_factory()` enforces the current factory has `industry_type == "steel"` and is active
- **Create item:** `POST /steel/inventory/items` (steel.py:1820) -- item_code, name, category (`normalize_steel_category()`), display_unit, current_rate_per_kg
- **Duplicate check:** Item code unique per factory
- **Manual transactions:** `POST /steel/inventory/transactions` (steel.py:1874) -- signed quantity, negative stock guard
- **Stock balances:** `stock_balances_for_factory()` computes running balance from transaction ledger
- **Stock reconciliations:** `POST /steel/inventory/reconciliations` (steel.py:1931) -- variance calculation, auto-approve for admin/owner, mismatch cause required when variance > 0.001, ledger auto-correction on approval

**Validation:** Negative stock prevention, category normalization, mismatch cause enforcement for variances.

**Risk:** Low. Robust inventory subsystem with audit trail.

---

### STEP 05: Create vendor / PO / GRN
**Grading: NOT IMPLEMENTED -- FAILS COMPLETELY**

- **No vendor model** exists anywhere in the codebase
- **No purchase_order model**
- **No GRN (Goods Receipt Note) model**
- **No purchase router/endpoints**
- No file matching `vendor*`, `purchase*`, `po_*`, `grn_*` found in either `models/` or `routers/`
- The only "purchase"-adjacent code is in `billing.py` and `billing_manager.py`, which handle SaaS subscription purchases for the platform itself, not factory procurement

**Impact:** A factory simulation requiring procurement (buying raw materials from suppliers) cannot be run. Raw material inventory must be seeded via manual `steel/inventory/transactions` (which accepts `transaction_type="inward"`), but there is no vendor record, no PO lifecycle, no GRN/quality-check workflow.

**Severity:** CRITICAL for any simulation that needs B2B procurement.

---

### STEP 06: Production batch (input/output tracking, loss calculation, inventory impact)
**Grading: FULLY IMPLEMENTED**

- **Endpoint:** `POST /steel/batches` (steel.py:4203)
- **Validation:** Input/output items must differ; expected/actual output cannot exceed input quantity; sufficient input stock check
- **Loss calculation:**
  - `loss_kg = input_quantity_kg - actual_output_kg`
  - `loss_percent = (loss_kg / input_quantity_kg) * 100`
  - `variance_kg = max(0, expected_output_kg - actual_output_kg)`
  - `variance_percent = (variance_kg / expected_output_kg) * 100`
  - `variance_value_inr = variance_kg * output_item.current_rate_per_kg`
  - `severity = severity_from_variance(variance_percent)` (enum: `low`/`watch`/`high`/`critical`)
- **Inventory impact:** Two auto-generated `SteelInventoryTransaction` rows:
  1. `production_issue` (negative, deducts input item)
  2. `production_output` (positive, adds output item)
- **Detail view:** `GET /steel/batches/{batch_id}` (steel.py:2312) -- shows traceability, current stock balances, linked inventory movements, audit events. Includes `severity_reason` explanation.
- **Financial redaction:** Non-OWNER roles get `current_rate_per_kg`, `variance_value_inr`, etc. redacted.

**Risk:** Low. Well-designed production tracking with double-entry inventory impact.

---

### STEP 07: Customer -> Sales Order -> Invoice flow
**Grading: PARTIALLY IMPLEMENTED (no Sales Order concept, Invoice handles it)**

- **Customer management:** `POST /steel/customers` (steel.py:2572) -- full validation (phone, email, GST, PAN, credit limit). Auto-verification of PAN/GST format. Duplicate name check.
- **Invoice creation:** `POST /steel/invoices` (steel.py:3502)
  - Creates invoice with lines referencing inventory items (finished goods only) and optionally batches
  - Invoice number auto-generation via `generate_invoice_number()`
  - Customer auto-creation from invoice name if not found
  - Payment terms from customer or payload
  - Due date = invoice_date + payment_terms_days
  - Credit limit enforcement (projected outstanding vs. credit limit)
  - Status: `unpaid` / `partial` / `paid`
- **No Sales Order model** -- the invoice doubles as the sales document

**Missing:**
- No separate Sales Order / Quotation / Pro-forma invoice lifecycle
- No approval workflow for invoices
- No delivery schedule tracking before dispatch
- No order confirmation flow

**Risk:** Medium. Functional for a simple sell-direct-from-stock simulation but inadequate for build-to-order or multi-stage sales.

---

### STEP 08: Dispatch approval -> execution -> inventory reduction
**Grading: FULLY IMPLEMENTED**

- **Create dispatch:** `POST /steel/dispatches` (steel.py:3853)
  - Auto-generates dispatch number and gate pass number
  - Validates dispatch lines against invoice line remaining quantities
  - Truck capacity warning, duplicate truck check
  - Negative stock guard at time of dispatch
  - **Inventory posting:** When status = `exited`/`dispatched`/`delivered`, `_create_dispatch_inventory_movements()` creates `dispatch_out` transactions (negative), sets `inventory_posted_at`
- **Status update:** `POST /steel/dispatches/{dispatch_id}/status` (steel.py:4079)
  - State machine: `pending -> loaded -> exited -> dispatched -> delivered` (or `cancelled`)
  - Cannot cancel if inventory already posted
  - Cannot revert posted dispatch to `pending`/`loaded`
  - On transition to dispatched/delivered: creates inventory movements if not already posted
  - Sets `delivered_at` and `delivered_by_user_id` on delivery
- **Dispatch detail:** `GET /steel/dispatches/{dispatch_id}` (steel.py:3733) -- shows ledger movements and audit trail

**Risk:** Low. Dispatch lifecycle is complete with proper inventory posting guard.

---

### STEP 09: Invoice GST PDF generation
**Grading: NOT IMPLEMENTED -- FAILS COMPLETELY**

- **No GST-specific invoice PDF generation exists** anywhere in the codebase
- The `SteelSalesInvoice` model has **NO GST fields** -- no `cgst_amount`, `sgst_amount`, `igst_amount`, `gst_rate`, `hsn_code`, `sac_code`, or `taxable_value` columns
- The only PDF generation is:
  - `_render_steel_owner_daily_pdf()` in `steel.py:1382` -- an owner daily review PDF with KPIs (not an invoice)
  - `_render_pdf_bytes()` in `reports.py:97` -- a single-entry DPR report PDF
- The `SteelSalesInvoiceLine` model (`steel_sales_invoice_line.py`) has NO HSN/SAC codes, no tax rate, no taxable value
- Invoice total = subtotal = `sum(weight_kg * rate_per_kg)` -- flat amount with no tax computation
- The **gst_number** on `SteelCustomer` is used for verification only (format check, PAN-in-GSTIN matching) -- never for tax calculation on invoices

**Impact:** A GSTR-1 report cannot be generated. No GST-compliant invoice PDF exists. The entire Indian GST compliance workflow is absent.

**Severity:** CRITICAL for any Indian factory simulation.

---

### STEP 10: Payment recording / Outstanding balance update
**Grading: FULLY IMPLEMENTED**

- **Payment recording:** `POST /steel/customers/payments` (steel.py:3087)
  - Three allocation modes: (1) explicit allocations list, (2) single invoice, (3) automatic FIFO-based allocation across outstanding invoices
  - Validates allocations do not exceed invoice outstanding
  - Creates `SteelCustomerPayment` + `SteelCustomerPaymentAllocation` rows
- **Outstanding tracking:** `_refresh_invoice_payment_statuses()` updates each invoice's `status` to `unpaid`/`partial`/`paid`
- **Customer lifecycle:** `_compute_customer_lifecycle_summary()` calculates:
  - `invoice_total_inr`, `payments_total_inr`, `outstanding_amount_inr`, `advance_amount_inr`
  - `overdue_amount_inr`, `overdue_days`, `open_invoice_count`, `late_payment_count`
  - `credit_used_percentage`, `available_credit_inr`, `risk_score`, `risk_level`
- **Alerts:** `_build_customer_lifecycle_alerts()` generates warnings for overdue exposure, credit limit pressure, blocked customers, verification issues

**Risk:** Low. Comprehensive payment tracking with allocation and aging.

---

### STEP 11: Reports -- Cross-check numbers
**Grading: PARTIALLY IMPLEMENTED**

- **General reports:** `reports.py` router with:
  - PDF generation per entry
  - Excel export for multi-entry reports
  - Caching (`REPORTS_CACHE_TTL`)
  - Role-scoped queries (operator sees own entries only, supervisor sees scoped)
  - Accountant role explicitly blocked from raw report access
- **Steel overview:** `GET /steel/overview` (steel.py:1619)
  - `build_steel_overview()` returns inventory totals, batch anomalies, profit summary, loss by day/operator
  - Financial data redacted for non-OWNER roles
- **Owner daily PDF:** `GET /steel/owner-daily-pdf` (steel.py:1637) -- plan-gated
- **Reconciliation summary:** `GET /steel/inventory/reconciliations/summary` (steel.py:2034)
- **Stock balances:** `GET /steel/inventory/stock` (steel.py:1764)

**Missing:**
- No GST returns report (GSTR-1, GSTR-3B)
- No financial P&L aggregated from batch/invoice data
- No cross-validation report that ties batch production data to inventory movements to invoices to payments
- No aging report for accounts receivable/payable
- No material consumption report

**Risk:** Medium. Operational reports exist, but financial/audit cross-checks are absent.

---

### STEP 12: Audit log export
**Grading: MINIMALLY IMPLEMENTED**

- **AuditLog model** (report.py:15): captures `user_id`, `org_id`, `factory_id`, `action`, `details`, `previous_state`, `new_state`, `ip_address`, `user_agent`, `timestamp`
- **Usage:** Written extensively across steel operations, settings, and auth flows
  - Steel: `_write_steel_audit()` for inventory items, batches, invoices, dispatches, payments, customers, reconciliations
  - Settings: `_write_admin_audit()` for factory CRUD, user management, plan changes
  - Auth: `_log_auth_event()` for login/logout, password changes, registration
- **Export:** Audit logs are visible inline in `steel/batches/{batch_id}`, `steel/invoices/{invoice_id}`, `steel/dispatches/{dispatch_id}` detail views via `_serialize_steel_audit()`
- **NO dedicated audit export endpoint** -- no `GET /audit-logs` or `POST /audit-logs/export` exists

**Risk:** Medium. The data is captured comprehensively but there is no bulk export, no CSV/Excel download, and no date-range-filtered audit pull API. An operator cannot extract all audit logs for compliance review.

---

## Summary Table

| Step | Feature | Status | Risk |
|------|---------|--------|------|
| 01 | Create company / org | **FULLY IMPLEMENTED** | Low |
| 02 | Add factory location | **FULLY IMPLEMENTED** | Low |
| 03 | Create users + roles (invite) | **FULLY IMPLEMENTED** | Low |
| 04 | Add inventory (steel check) | **FULLY IMPLEMENTED** | Low |
| 05 | Create vendor / PO / GRN | **NOT IMPLEMENTED** | Critical |
| 06 | Production batch (input/output/loss) | **FULLY IMPLEMENTED** | Low |
| 07 | Customer -> Sales Order -> Invoice | **PARTIALLY IMPLEMENTED** (no Sales Order) | Medium |
| 08 | Dispatch approval -> inventory reduction | **FULLY IMPLEMENTED** | Low |
| 09 | Invoice GST PDF generation | **NOT IMPLEMENTED** | Critical |
| 10 | Payment recording -> outstanding | **FULLY IMPLEMENTED** | Low |
| 11 | Reports (cross-check numbers) | **PARTIALLY IMPLEMENTED** | Medium |
| 12 | Audit log export | **MINIMALLY IMPLEMENTED** | Medium |

---

## Data Accuracy Issues

1. **Invoice total = subtotal with no tax** -- Since `total_amount = subtotal_amount = sum(weight_kg * rate_per_kg)`, any financial report from invoices will be tax-exclusive. This means reported revenue is understated by ~18% (GST) compared to a real invoice.

2. **Post-dispatch inventory negative guard race condition** -- The `stock_balances_for_factory()` function computes balance from all past transactions. Two dispatches posted concurrently for the same item could both pass the negative check independently, resulting in negative stock. There is no row-level locking or serializable isolation.

3. **Stock reconciliation auto-correction without compensating transactions** -- When a reconciliation is auto-approved (admin/owner), a `SteelInventoryTransaction` is created with `type="adjustment"`. This creates a ledger entry but the original wrong entries remain. The adjustment corrects the running balance but distorts the transaction history (the "why" behind the adjustment is in the reconciliation, not the transaction reference).

4. **Inline customer creation on invoice** -- When an invoice is created with a `customer_name` that doesn't match any customer, a new `SteelCustomer` row is created inline with minimal fields (name only). This bypasses the normal customer creation validation (phone, email, credit limit, GST/PAN) and creates phantom customer records with no contact info.

5. **Batch loss calculation uses `current_rate_per_kg`** -- The `variance_value_inr` is computed using `output_item.current_rate_per_kg` at the time of batch creation, not the actual cost or market rate. If the rate changes over time, earlier batches' financial figures become inconsistent.

---

## Confusing UX Issues

1. **Operator creates batches but sees no financial data** -- Non-OWNER roles have `current_rate_per_kg`, `variance_value_inr`, `estimated_gross_profit_inr` redacted. An OPERATOR recording a batch sees `null` for all financial fields, making it impossible for them to understand the cost implication of their production loss.

2. **No "in transit" stock visibility** -- When a dispatch is created with status `pending`/`loaded`, no inventory movement is created. The stock only reduces when status transitions to `exited`/`dispatched`/`delivered`. Between creation and inventory posting, the stock appears available but is actually allocated. A second dispatch could theoretically claim the same stock.

3. **Missing vendor module means no supply side** -- Raw material "inward" transactions exist but there is no way to track who supplied them, at what price, on what terms. The raw material cost side of the P&L is entirely opaque.

4. **No quotation / sales order stage** -- An invoice is created directly. There is no way to record a customer's order before issuing the invoice, no way to track order fulfillment status, and no way to handle partial order delivery over multiple dispatches.

5. **GST number on customer is decorative for commerce** -- The GST number is validated for format and cross-checked against PAN, but it is never used in invoice computation. An operator would enter valid GSTINs on customer records and wonder why tax amounts are not appearing on invoices.

6. **Accountant role has confusing restrictions** -- Accountants can view customers, invoices, and payments (the financial perimeter), but `reports.py:70` explicitly blocks them from "raw report insights" via `_apply_role_filter()`. They can see individual records but no aggregated reports.

---

## E2E Simulation Readiness Score

**Overall Score: 5.5 / 10**

| Domain | Score | Rationale |
|--------|-------|-----------|
| Identity & Access (Org/Users/Factories) | **9/10** | Full feature set, role hierarchy, multi-factory |
| Inventory Management | **8/10** | Complete item/stock/transaction/reconciliation cycle |
| Procurement (Vendor/PO/GRN) | **0/10** | Entirely absent |
| Production (Batches) | **9/10** | Loss tracking, inventory impact, severity, traceability |
| Sales (Customer/Invoice) | **6/10** | No Sales Order stage, no GST on invoices |
| Dispatch & Logistics | **9/10** | Full lifecycle, gate pass, inventory posting |
| GST Compliance | **0/10** | No tax computation, no GST PDF, no GSTR reports |
| Payments & Collections | **9/10** | Allocation, aging, credit risk, follow-up tasks |
| Reporting & Cross-checks | **4/10** | Operational reports exist, no financial cross-checks |
| Audit & Export | **3/10** | Data captured well, no bulk export, no date-range filter |

### What can be simulated today (without code changes):
- Operator records a production batch with input item consumption and output item receipt
- Inventory decreases for raw material, increases for finished goods
- A sales invoice is created against finished goods stock
- A dispatch moves goods out the gate with truck/driver tracking
- A payment is recorded against the invoice
- Outstanding balance updates, overdue alerts fire
- A stock reconciliation detects variance, mismatch cause is recorded

### What CANNOT be simulated:
- Buying raw material from a vendor (no PO/GRN model)
- Generating a GST-compliant invoice PDF (no tax fields, no PDF generation)
- Running procurement-to-payment lifecycle
- Generating GSTR-1 or GSTR-3B returns
- Exporting a complete audit log for compliance review

### Simulation gap severity:
- **Showstopper (critical):** Steps 05 (Vendor/PO/GRN) and 09 (GST PDF). Any factory simulation that requires vendor interaction or tax-compliant billing will fail.
- **Blocker (medium):** Steps 07 (no Sales Order), 11 (no cross-check reports), 12 (no audit export). These impair but do not prevent basic operational simulation.
- **Operational (low):** Steps 01-04, 06, 08, 10 are production-ready and well-tested.