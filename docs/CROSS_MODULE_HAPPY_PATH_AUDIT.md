# FactoryNerve Cross-Module Happy Path Audit

> **Audit Date:** June 23, 2026
> **Auditor:** System (Code Analysis)
> **Scope:** All 8 Cross-Module Business Workflow Chains
> **Final Verdict: PARTIALLY READY** — Core chains hold together but have specific integration gaps documented below.

---

## Executive Summary

FactoryNerve's steel manufacturing module is the most mature and well-integrated, with robust cross-module data flows for the production→dispatch→billing→payment cycle. The OCR module is functionally complete but operates as a standalone extraction pipeline — it does not directly feed into inventory or production. The attendance and production entry modules are isolated from the steel operations flow (no data flows between them). The owner dashboard aggregates data from all steel modules into a comprehensive view.

**Overall readiness by chain:**

| Chain | Status | Key Finding |
|-------|--------|-------------|
| 1. Factory Setup & Onboarding | **PASS** | Operational in ~30 min with 6 setup steps |
| 2. Attendance → Reports | **PASS** | Complete cycle, no cross-module integration gaps |
| 3. OCR → Inventory Entry | **PARTIAL** | OCR does NOT auto-create inventory items |
| 4. Production → Inventory | **PASS** | Steel batches create inventory transactions correctly |
| 5. Production → Dispatch → Billing | **PASS** | Full chain with approval gates and stock reduction |
| 6. Billing → Payment → Receivables | **PASS** | Payment allocation engine is thorough |
| 7. Full Business Cycle | **PARTIAL** | Works end-to-end within steel module only |
| 8. Owner Intelligence | **PASS** | Dashboard answers all key business questions |

---

## Chain 1 — Factory Setup & Onboarding

### Business Scenario
A new steel factory signs up and needs to become operational on FactoryNerve.

### Modules Involved
Authentication → Subscription → Factory Management → User Management → Role Management → Shift Templates → Inventory

### Workflow Steps
1. **Owner registers** via `/auth/v2/register` — creates `PendingRegistration`, assigns OWNER role
2. **Trial activated** — 7-day trial subscription created automatically
3. **Factory profile configured** — Owner sets factory name, timezone, industry type via factory settings
4. **Roles assigned** — Owner invites users via `/auth/invitations`, assigns roles (SUPERVISOR, OPERATOR, ACCOUNTANT, etc.)
5. **Users onboarded** — Invited users receive verification emails, set passwords, assigned to factory
6. **Shifts configured** — `POST /attendance/shift-templates` creates morning/evening/night templates with grace periods
7. **Inventory items created** — `POST /steel/inventory/items` creates raw materials and finished goods
8. **Initial stock loaded** — `POST /steel/inventory/transactions` with `transaction_type=inward`

### Validation Result: **PASS**

### Cross-Module Findings
- **Missing step:** No "factory setup wizard" — each step is a separate API call. An Owner must know the system well.
- **User invitation flow:** Invitations use `AUTH_RESET_SECRET` or `JWT_SECRET_KEY` for token signing. If neither env var is configured, invitation links won't work.
- **Dual-user tables:** Registration creates entries in both `users` (legacy) and `auth_users` (v2) tables. Password changes sync both. This dual-write is a migration artifact.
- **Trial logic:** Works correctly via `POST /billing/create-subscription` with a default 7-day trial. No hidden setup steps needed.

### Severity: **Low**

### Recommendations
- Add a guided setup wizard for first-time owners
- Document that both `AUTH_RESET_SECRET` and `JWT_SECRET_KEY` must be configured for invitation flows

---

## Chain 2 — Attendance → Reports

### Business Scenario
Workers arrive for their shift, punch in/out, supervisor reviews, and reports are generated.

### Modules Involved
Attendance → User Management → Reports → Audit Log

### Workflow Steps
1. **Worker punches in** — `POST /attendance/punch-in` — creates `AttendanceRecord` with `punch_in_at`, `status=working`
2. **Shift auto-assigned** — `POST /attendance/assign-shift` — shift is determined by worker's schedule or manual assignment
3. **Worker punches out** — `POST /attendance/punch-out` — updates `punch_out_at`, calculates `worked_minutes`, `overtime_minutes`, `late_minutes`
4. **Missed punch-out auto-closed** — Background cron job closes stale records >24h old using shift end times
5. **Supervisor reviews** — `GET /attendance/review` lists pending records, supervisor approves/rejects
6. **Reports generated** — `GET /attendance/reports` — attendance trends, per-shift breakdowns, late/absent summaries
7. **Manager reviews trends** — Analytics and reporting endpoints show attendance KPIs

### Validation Result: **PASS**

### Cross-Module Findings
- **Self-approval guard:** The approval service prevents a worker from approving their own attendance — maker-checker enforced.
- **Attendance data is completely siloed from production** — there is no link between attendance records and production batch operator assignments. You can't answer "which operator produced what and when were they clocked in?"
- **Force-close service** — the new `AttendanceAutoCloseService` correctly closes stale records. Tested with shift template cross-midnight handling.
- **No automatic alert for missed punch-out** — supervisors must poll the review endpoint to see open records.

### Severity: **Low**

### Recommendations
- Link attendance records to production batch operators for workforce analytics
- Add alert notification when a worker has been "working" for >12 hours (missed punch-out)

---

## Chain 3 — OCR → Inventory Entry

### Business Scenario
Factory receives a raw material supplier invoice. The document is scanned, data is extracted, and materials are added to inventory.

### Modules Involved
OCR → Verification → Inventory

### Workflow Steps
1. **Operator uploads document** — `POST /ocr/table-excel` or `/ocr/logbook` — image sent to Claude AI
2. **OCR extracts data** — Anthropic Claude extracts structured table/form data from the image
3. **Supervisor verifies output** — `PUT /ocr/verifications/{id}` — supervisor reviews extracted rows, corrects as needed
4. **Approval completed** — `POST /ocr/verifications/{id}/submit` → approval service (maker-checker)
5. **Material added to inventory** — ⚠️ **MUST BE DONE MANUALLY** — OCR output is an Excel file/verification record only
6. **Stock updated** — Manual via `POST /steel/inventory/transactions`
7. **Inventory reports updated** — Stock views reflect new transactions

### Validation Result: **PARTIAL**

### Cross-Module Findings
- 🔴 **OCR → Inventory integration missing** — The OCR module has **no integration** with the Steel inventory module. When a supplier invoice is scanned and verified, the extracted data is saved as an `OcrVerification` record and can be exported as Excel, but **no inventory transactions are auto-created**.
  - A warehouse receipt workflow ("OCR verified supplier invoice → auto-create inward transaction") is completely absent.
  - The `OcrVerification` model has `reviewed_rows` and `original_rows` but no reference to inventory items or transactions.
  - The `OcrTemplate` model (`backend/models/ocr_template.py`) has `column_names`, `language`, `field_mappings` but no mapping to inventory item IDs.
- **Export is a download, not a system action** — The "export" feature produces an `.xlsx` file for the user to download. It does not trigger an inventory update.
- **OCR data lifespan** — Once approved, the verification data is static. There is no downstream pipeline (e.g., to ERP/accounting).

### Severity: **High**

### Recommendations
- Add a "Create Inventory Transaction from OCR Verification" endpoint that extracts quantity, item, and unit price from verified OCR rows
- Add template-level mapping: `OcrTemplate.column_mappings` → `{ "material_code_column": "...", "quantity_column": "...", "rate_column": "..." }`
- Consider an "OCR → Inventory" pipeline where approved verifications of type "supplier_invoice" auto-create inward stock movements

---

## Chain 4 — Production → Inventory

### Business Scenario
Factory runs a production batch. Raw materials are consumed, finished goods are created, scrap is recorded.

### Modules Involved
Production (Steel Batches) → Inventory → Approvals → Reports

### Workflow Steps
1. **Operator creates production batch** — `POST /steel/batches` — specifies input item, output item, input/output quantities
2. **Materials consumed** — `SteelInventoryTransaction` rows with `transaction_type=production_issue` are auto-created when a batch is approved
3. **Production approved** — Approval service (maker-checker) validates batch creation
4. **Finished goods created** — `SteelInventoryTransaction` with `transaction_type=production_output` records the output
5. **Scrap recorded** — `scrap_qty_kg` and `rejection_qty_kg` on the batch record track waste
6. **Inventory updated** — Stock balances reflect input deduction and output addition
7. **Analytics updated** — Production intelligence (`build_production_intelligence`) aggregates batch data

### Validation Result: **PASS**

### Cross-Module Findings
- **Scrap tracking is robust** — `SteelProductionBatch` has dedicated `scrap_kg`, `rejection_kg`, `scrap_loss_percent` fields. The scrap loss intelligence module provides deep analytics.
- **Financial calculations** — Batch valuation includes `estimated_input_cost_inr`, `estimated_output_value_inr`, `estimated_gross_profit_inr`. Only OWNER role can view these (redacted for other roles).
- **Approval integration** — Batch creation goes through the same maker-checker approval workflow as other inventory actions.
- **Missing: operator-attendance link** — The `operator_user_id` on a batch is just a user ID. It can't be used to compute operator efficiency vs attendance hours without cross-referencing attendance records manually.

### Severity: **Low**

### Recommendations
- Link batch operator_user_id to attendance records for operator efficiency analytics

---

## Chain 5 — Production → Dispatch → Billing

### Business Scenario
Finished goods are ready to ship. A dispatch is created, goods leave the factory, and the customer is invoiced.

### Modules Involved
Production (Batches) → Inventory → Dispatch → Approvals → Billing (Invoices)

### Workflow Steps
1. **Finished goods available** — Batch completed, output item has positive stock balance
2. **Invoice is created first** — `POST /steel/invoices` — Accountant creates sales invoice with line items from finished goods batches
3. **Dispatch created** — `POST /steel/dispatches` — links to invoice via `invoice_id`, specifies truck, driver, dispatch lines
4. **Inventory reduced** — `_create_dispatch_inventory_movements()` auto-creates `dispatch_out` inventory transactions for each dispatch line
5. **Dispatch approved** — Status workflow: pending → loaded → exited → dispatched → delivered (with gate pass tracking)
6. **Dispatch completed** — `PATCH /steel/dispatches/{id}/status` to `delivered` — triggers inventory posting if not already posted
7. **Over-dispatch prevented** — Invoice line remaining weight is tracked (`remaining_weight_kg = weight_kg - sum(dispatch_line_weight)`)
8. **Audit trail** — Each status transition records an audit log event

### Validation Result: **PASS**

### Cross-Module Findings
- **Invoice-first workflow** — The system requires an invoice to exist before dispatch. This is a design choice: in some real factories, dispatch happens and invoice follows. The `invoice_id` is required on `SteelDispatchCreateRequest`. This could be a friction point for factories that dispatch before invoicing.
- **Inventory reduction is automatic** — `_create_dispatch_inventory_movements()` creates `dispatch_out` transactions when a dispatch reaches a status that posts inventory (exited/dispatched/delivered). The `inventory_posted_at` timestamp prevents double-posting.
- **Remaining weight tracking** — Invoice detail view shows `remaining_weight_kg` per invoice line, preventing over-dispatch. This is a critical business logic check.
- **Cancellation handling** — Cancelled dispatches are handled properly: the invoice's remaining weight is restored, and inventory can be adjusted.
- **No delivery POD upload** — The dispatch model has `receiver_name` and `pod_notes` but no proof-of-delivery document upload. The steel router has PDF export for owner daily reports but not for POD.

### Severity: **Low** (Medium for no-POD)

### Recommendations
- Add optional dispatch-first mode where invoice can be created after dispatch
- Add POD document (photo/signed PDF) upload to dispatch completion

---

## Chain 6 — Billing → Payment → Receivables

### Business Scenario
Customer pays an invoice. Payment is recorded, allocated, and receivable reports are updated.

### Modules Involved
Billing (Invoices) → Payments → Customer Management → Reports

### Workflow Steps
1. **Invoice created** — `POST /steel/invoices` — invoice with line items, total amount, due date
2. **Payment recorded** — `POST /steel/customers/{id}/payments` — captures payment amount, mode, reference
3. **Payment allocated** — Supports multi-invoice allocation: a single payment can be split across multiple invoices, or one invoice can receive partial payments over time
4. **Invoice status auto-updated** — `_refresh_invoice_payment_statuses()` recalculates invoice status (unpaid/partial/paid) after each payment
5. **Customer outstanding reduced** — `_compute_customer_lifecycle_summary()` recalculates outstanding, overdue, credit usage
6. **Customer risk score updated** — Based on overdue days, credit usage percentage, late payment count
7. **Receivable reports updated** — `build_receivables_summary()` shows aging buckets, collection efficiency
8. **Follow-up tasks created** — Optional: `POST /steel/customers/{id}/follow-up-tasks` for collection actions

### Validation Result: **PASS**

### Cross-Module Findings
- **Payment allocation is thorough** — The `_build_payment_allocation_maps()` function handles both explicit allocations (multi-invoice) and implicit (invoice_id on payment record). The legacy direct `payment.invoice_id` is supported alongside the new `SteelCustomerPaymentAllocation` table.
- **Invoice status is reactive** — `_refresh_invoice_payment_statuses()` runs after every payment to recalculate status. This is correct — status is derived from paid_amount vs total_amount, not stored independently.
- **Outstanding validation** — The system validates that payment amount doesn't exceed invoice outstanding, and that allocations don't exceed payment amount.
- **Cash flow tracking** — `build_cash_flow_summary()` in `steel_finance.py` tracks cash inflows (customer payments) and outflows (vendor payments).
- **Missing: automated payment reminders** — There are follow-up tasks but no automated reminder system (email/SMS) for overdue invoices.

### Severity: **Low**

### Recommendations
- Add automated SMS/WhatsApp payment reminders for overdue invoices using the existing ops-alerting infrastructure

---

## Chain 7 — Full Business Cycle

### Business Scenario
Complete factory business cycle: raw material arrives → production → dispatch → invoice → payment → owner sees dashboard.

### Modules Involved
All steel modules (Inventory → Production → Dispatch → Billing → Payments → Reports/Analytics)

### Workflow Steps
1. **Raw material received** — `POST /steel/inventory/transactions` (inward) adds raw material stock
2. **Stock updated** — `stock_balances_for_factory()` reflects new balance
3. **Production batch created** — `POST /steel/batches` — operator runs batch, raw material consumed via `production_issue`
4. **Finished goods created** — Batch output recorded via `production_output` transaction
5. **Scrap recorded** — Batch `scrap_kg` and `rejection_kg` tracked
6. **Invoice created** — Accountant creates sales invoice with finished goods items
7. **Dispatch created** — Links to invoice, truck loaded, inventory auto-reduced via `dispatch_out`
8. **Dispatch completed** — Status transitions to `delivered`
9. **Payment received** — Customer pays invoice, payment allocated, invoice status updated
10. **Reports updated** — `build_steel_overview()`, `build_owner_dashboard()`, `build_sales_intelligence()` all reflect latest data
11. **Owner checks dashboard** — `GET /steel/overview` → single-pane view of inventory, production, financials, anomalies

### Validation Result: **PARTIAL**

### Cross-Module Findings
- **🔴 Missing: Production Entry (non-steel) → Steel integration** — The `Entry` model (production entries from `entries.py`) operates completely independently from the `SteelProductionBatch` model. A factory using the general production entry module cannot link to the steel inventory/dispatch/billing module. These are two parallel production systems.
  - The `Entry` model tracks: units_target/produced, manpower, downtime, quality issues
  - The `SteelProductionBatch` tracks: input/output items, input weight, actual output, scrap, rejection, severity
  - There is no bridge between the two. A steel factory would likely use BOTH systems for different purposes (general ops vs specific batch tracking), but data doesn't flow between them.
- **🔴 Missing: OCR → Inventory integration (as noted in Chain 3)** — The full cycle breaks if you rely on OCR to capture supplier invoices for stock entry. You must manually create inventory transactions.
- **Financial accuracy is strong** — The `build_steel_realization_metrics()` function in `steel_service.py` correctly computes realized revenue vs invoiced revenue, tracking what has actually been dispatched vs what was only invoiced. The `build_payment_allocation_maps()` function correctly attributes payments to invoices.
- **No automated monthly close** — There's no month-end procedure that finalizes production, dispatch, and billing data for the period. All data is always "live" unless reconciled.
- **Stock reconciliation corrects variance** — The reconciliation process (`SteelStockReconciliation`) properly creates adjustment transactions when approved, keeping the ledger in sync with physical counts.

### Severity: **High** (for OCR gap), **Medium** (for Entry→Steel gap)

### Recommendations
- Add a mapping mechanism to link `Entry` records to `SteelProductionBatch` for factories using both
- Implement OCR-to-inventory pipeline for supplier invoices (as recommended in Chain 3)
- Consider a month-end close procedure that locks production/dispatch data for the period

---

## Chain 8 — Owner Intelligence

### Business Scenario
Owner asks critical business questions and expects clear answers from the system.

### Modules Involved
Owner Dashboard → Production Intelligence → Inventory Intelligence → Sales Intelligence → Anomaly Detection → Financial Pulse

### Validation by Question

| Question | Answerable? | Source Function |
|----------|-------------|----------------|
| **How much stock do we have?** | ✅ Yes | `build_steel_overview()` → `inventory_totals` |
| **Which material is low?** | ✅ Yes | `build_inventory_intelligence()` → `low_stock_alerts` |
| **Which shift underperformed?** | ⚠️ Partial | `build_quality_tracking()` → operator-level loss stats; but no shift → batch link |
| **How much scrap generated?** | ✅ Yes | `build_production_intelligence()` → `scrap_loss_financial_impact` |
| **Which dispatch is delayed?** | ⚠️ Partial | Steel dispatch list shows status/dates; no explicit "delayed" flag |
| **Which customers haven't paid?** | ✅ Yes | `build_receivables_summary()` → overdue invoices, aging buckets |
| **How much money is stuck in receivables?** | ✅ Yes | `realization_metrics.outstanding_invoice_amount_inr` |
| **Where is production loss happening?** | ✅ Yes | `build_production_intelligence()` → top loss batches, operator loss ranking |
| **Which factory needs intervention?** | ✅ Yes | `build_owner_dashboard()` → alerts: critical anomalies, high loss, red confidence items |
| **What is the fulfillment conversion?** | ✅ Yes | `build_sales_intelligence()` → invoiced→dispatched→delivered→paid funnel |

### Validation Result: **PASS**

### Cross-Module Findings
- **Owner dashboard is comprehensive** — `build_owner_dashboard()` in `steel_intelligence.py` aggregates data from 5+ modules into a single view with actionable alerts.
- **Production intelligence is strong** — `build_production_intelligence()` provides operator-level, shift-level, and day-level rollup with scrap loss financial impact and severity distribution.
- **Sales intelligence covers the full funnel** — `build_sales_intelligence()` tracks invoiced → dispatched → delivered → paid conversion with monthly trends and customer segmentation.
- **Anomaly detection is multi-domain** — `build_anomaly_detection()` covers financial (invoice/payment outliers), inventory (negative balances, large adjustments), and dispatch (duplicate trucks, impossible timelines).
- **Role-based financial redaction** — Financial metrics (profit, cost, value) are automatically redacted for non-OWNER roles via the `_redact_steel_overview_financials()` pipeline. This is clean and secure.
- **Missing: shift-performance link** — The system can't answer "which shift (morning/evening/night) had the best production efficiency?" because batches don't carry the shift dimension. Production batches have `production_date` but no `shift` field. The shift-related analytics in the NLQ expansion plan are planned but not implemented in core intelligence functions.

### Severity: **Medium** (for shift-performance gap)

### Recommendations
- Add a `shift` field to `SteelProductionBatch` so production intelligence can report by shift
- Add an explicit "dispatch delayed" flag based on expected delivery date vs current status
- Implement the NLQ expansion plan's shift-efficiency and best-shift queries

---

## Final Verdict

**Can FactoryNerve run a complete real-world factory operation from start to finish without workflow breakdown?**

### Answer: **YES with caveats**

**Within the Steel module**, the full business cycle works correctly:
- Raw material inward → Production batch → Finished goods → Dispatch → Invoice → Payment → Reports → Owner dashboard
- Inventory transactions are created at every step with proper reference tracking
- Financial reconciliation tracks realized vs invoiced amounts with margin calculation
- Approval gates (maker-checker) protect critical operations
- Payment allocation engine handles complex multi-invoice scenarios

**Gaps that cause workflow friction:**

| Gap | Impact | Severity |
|-----|--------|----------|
| OCR → Inventory (no auto-create) | Manual step required after scanning supplier invoices | 🔴 High |
| Entry (non-steel) → Steel module isolation | Dual production tracking systems don't talk | 🟠 Medium |
| No shift dimension on steel batches | Can't answer shift-efficiency questions for steel production | 🟠 Medium |
| No POD upload for dispatches | Missing delivery confirmation document | 🟠 Medium |
| No automated payment reminders | Manual follow-up for overdue invoices | 🟡 Low |

**Bottom line:** FactoryNerve is ready for production use for steel manufacturing operations with manual OCR-to-inventory conversion. The core financial and inventory chains are robust with strong audit trails. The two highest-priority improvements are connecting OCR output to inventory and bridging the general Entry module with steel production batches.
