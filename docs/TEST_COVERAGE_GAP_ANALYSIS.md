# Factory Nerve — Test Coverage Gap Analysis

> **Comparing existing test files** (`tests/*.py`, 76 files, ~22,000+ lines)  
> **Against requirements** (`docs/TEST_DATA_REQUIREMENTS.md`, 7 roles, ~70 edge cases, ~60 daily tasks)  
> **Date:** 2026-06-22  
> **Methodology:** Source-code analysis of every test file, mapped to each role's task checklist and edge cases

---

## Coverage Summary

| Role | Tasks Tested | Tasks Missing | Edge Cases Tested | Edge Cases Missing | Overall Coverage |
|------|:-----------:|:------------:|:-----------------:|:-----------------:|:----------------:|
| **1. Attendance Officer** | 3/6 | 3 | 2/10 | 8 | **~35%** 🔶 |
| **2. Operator** | 3/8 | 5 | 1/10 | 9 | **~22%** 🔴 |
| **3. Supervisor** | 3/12 | 9 | 2/10 | 8 | **~23%** 🔴 |
| **4. Accountant** | 4/10 | 6 | 4/10 | 6 | **~40%** 🔶 |
| **5. Manager** | 3/10 | 7 | 2/10 | 8 | **~25%** 🔴 |
| **6. Admin** | 5/10 | 5 | 5/10 | 5 | **~50%** 🟡 |
| **7. Owner** | 2/10 | 8 | 1/10 | 9 | **~15%** 🔴 |

> **Legend:** 🟢 >75% | 🟡 50-75% | 🔶 25-50% | 🔴 <25%

---

## 1. Attendance Officer — Gap Analysis

### Existing Test Coverage ✅

| Test File | Tests Found | What They Cover |
|-----------|------------|-----------------|
| `test_attendance.py` | 9 tests | Punch flow, live board, regularization, role isolation, settings bootstrap |
| `test_p0_role_checks.py` | 24 tests | Permission checks for AI, intelligence, reports, steel endpoints |

**Specific tests mapping to tasks:**
- ✅ `test_attendance_punch_flow_and_live_board` — Covers **Task 1** (Punch In) and **Task 3** (Punch Out) for Operator role (not Attendance role)
- ✅ `test_attendance_role_is_self_service_only` — Verifies Attendance role can punch but **cannot** access entries (FORBIDDEN)
- ✅ `test_attendance_regularization_review_flow` — Covers **Task 5** (Submit regularization) for Operator role
- ✅ `test_attendance_regularization_rejects_unknown_request_type` — Input validation edge case

### What's MISSING 🔴

#### Tasks Not Tested (3 of 6)
| # | Task | Missing Because |
|---|------|----------------|
| **2** | **Punch In (late)** — After grace period with late flag, late mark incremented | No test creates a late punch and checks the late-mark accumulator |
| **4** | **View own attendance** — Calendar view with punch history | No test verifies the `/attendance/me/today` or historical attendance display for the Attendance role specifically |
| **6** | **View personal report** — Downloadable attendance summary | No test hits the attendance report endpoint for self-service |

#### Edge Cases Not Tested (8 of 10)
| Edge Case | Missing Because |
|-----------|----------------|
| **Cross-midnight shift** — Night shift punch-out next day | No test punches in at 22:00 and out at 06:00+1 |
| **Duplicate punch-in** — Double-click within 1 minute | No test sends 2 rapid-fire punch-in requests |
| **Missing shift assignment** — No shift template configured | No test creates a user with no shift and attempts punch |
| **Back-date punch** — Punch for yesterday's date | No test sends a backdated punch request |
| **Holiday punch** — Sunday/public holiday with OT flag | No test punts on a weekend with OT marking |
| **Regularization limit** — 3+ regularization requests in one day | Only 1 regularization created per test |
| **Regularization type** — Timing correction vs status correction | Only `missed_punch` request_type tested |
| **First-ever punch** — Brand new user's first attendance | User already has registration context |
| **Concurrent punch** — Two employees punch simultaneously | No concurrency test |
| **Auto-missed punch** — No punch-out by midnight | No overnight auto-marking test |

---

## 2. Operator — Gap Analysis

### Existing Test Coverage ✅

| Test File | Tests Found | What They Cover |
|-----------|------------|-----------------|
| `test_steel_module.py` | 20+ tests | Inventory, batches, invoices, dispatches, customers, reconciliations |
| `test_steel_dispatch_batch_workflow.py` | 8 tests | Detailed batch/dispatch lifecycle |
| `test_entry_offline_sync.py` | 2 tests | Idempotency, duplicate prevention |
| `test_ocr_verification.py` | 10 tests | OCR lifecycle |
| `test_ocr_warp_guardrails.py` | 2 tests | Image warping |

**Specific mapping:**
- ✅ `test_entry_create_is_idempotent` — Covers offline sync / idempotency
- ✅ `test_entry_duplicate_prevention` — Covers duplicate factory-shift guard
- ✅ `test_steel_inventory_and_batch_flow` — Covers stock view + batch creation
- ✅ `test_operator_can_submit_own_ocr_verification` — OCR scan task (but as Operator role)

### What's MISSING 🔴

#### Tasks Not Tested (5 of 8)
| # | Task | Missing Because |
|---|------|----------------|
| **1** | **Start shift & punch in** — Operator-specific punch-in flow | All punch tests use Operator fixture, but no test verifies "at shift start" flow |
| **2** | **View work queue** — Show pending batches for shift | No test checks `/entries` or work queue endpoint for pending items |
| **4** | **Log gate entry** — Truck entry with pending status | Gate entry logging is not tested outside of full dispatch flow (which uses higher roles) |
| **5** | **Log gate exit** — Exit with net weight calculation | No standalone gate exit test |
| **7** | **View stock levels** — Real-time stock quantities | Stock check only done as assertion in steel flow, not as Operator-specific task |

#### Edge Cases Not Tested (9 of 10)
| Edge Case | Missing Because |
|-----------|----------------|
| **Negative stock check** — Dispatch more than available | Only tested for batch creation, not for Operator dispatch |
| **Smart parse correction** — AI suggests wrong values | No smart parse input test (`parse_smart_input`) |
| **Downtime > shift hours** — 500 min downtime (480 min shift) | No validation boundary test for downtime |
| **Zero production entry** — Machine breakdown, 0 output | No entry with 0 units_produced tested |
| **Duplicate truck entry** — Same truck # twice within 5 min | No duplicate gate entry test |
| **Inter-shift handoff** — Shift A→B continues same batch | No batch continuation test |
| **OCR poor quality image** — Blurry photo, low confidence | OCR tests use clean images, no low-quality test |
| **Offline queue** — Network drop during entry | Only idempotency tested, not actual offline persistence |
| **Multiple machines per shift** — Runs Rebar + Furnace | Single machine per test |

---

## 3. Supervisor — Gap Analysis

### Existing Test Coverage ✅

| Test File | Tests Found | What They Cover |
|-----------|------------|-----------------|
| `test_attendance.py` | 9 tests | Regularization review, approval, live board |
| `test_ocr_verification.py` | 10 tests | OCR approval/rejection, role-based access |
| `test_steel_module.py` | 20+ tests | Dispatch status updates |

**Specific mapping:**
- ✅ `test_attendance_regularization_review_flow` — **Tasks 4-6** (review/approve attendance regularization)
- ✅ `test_attendance_review_queue_allows_manager_role` — Approval queue visibility
- ✅ `test_ocr_verification_draft_submit_approve` — **Task 8** (approve OCR)
- ✅ `test_steel_dispatch_draft_progression` — **Task 9** (update dispatch status)
- ✅ `test_steel_reconciliation_approval_workflow` — Stock reconciliation (Manager context)

### What's MISSING 🔴

#### Tasks Not Tested (9 of 12)
| # | Task | Missing Because |
|---|------|----------------|
| **1** | **Review approval queue** — View pending entries with creator/age | No standalone "view pending queue" test for Supervisor |
| **2** | **Approve valid entry** — Entry status→approved | Entry approval tests exist but as Manager, not Supervisor |
| **3** | **Reject with reason** — Rejection requires reason | No entry rejection with reason validation test |
| **7** | **Review OCR verifications** — View pending OCR docs | OCR list tested, but not specifically as Supervisor |
| **10** | **Generate gate pass** — For outgoing truck | No gate pass generation standalone test |
| **11** | **View team live board** — Team members + status | Live board tested, but not team-scoped |
| **12** | **Acknowledge alert** — Mark alert read | No alert acknowledgement test in Supervisor context |

#### Edge Cases Not Tested (8 of 10)
| Edge Case | Missing Because |
|-----------|----------------|
| **Self-approval prevention** — Approve own entry | `assert_not_self_approval` tested in unit tests, not integration |
| **Approval after shift ends** — Previous shift entry | No "day-old entry" approval test |
| **Re-approve rejected entry** — Terminal state | No rejected-then-reapprove test |
| **High-variance auto-flag** — >10% variance auto-criticals | Severity auto-compute tested, but no escalation flow |
| **Missing rejection reason** — Reject without reason | OCR rejection requires reason (tested), entry rejection does not |
| **Dispatch qty > invoice** — Exceeds remaining qty | Tested, but as Admin/Owner, not Supervisor |
| **OCR low confidence review** — <75% banner | No `avg_confidence` threshold test for UI banner |
| **Cross-supervisor visibility** — Wrong factory scope | No factory-scoped queue isolation test |

---

## 4. Accountant — Gap Analysis

### Existing Test Coverage ✅

| Test File | Tests Found | What They Cover |
|-----------|------------|-----------------|
| `test_steel_module.py` | 20+ tests | Invoices, payments, customers, credit limits |
| `test_steel_finance.py` | 24 tests | Finance overview, receivables, payables, expenses, profitability |
| `test_ocr_verification.py` | 10 tests | OCR approval |

**Specific mapping:**
- ✅ `test_steel_weight_invoice_flow` — **Task 1** (Create invoice)
- ✅ `test_steel_customer_ledger_and_payments` — **Task 2-3** (Record payment, allocate)
- ✅ `test_steel_customer_payment_auto_allocates_oldest` — Auto-allocation logic
- ✅ `test_steel_customer_verification_flow` — Customer verification
- ✅ `test_receivables_with_partial_payment` — Partial payment handling
- ✅ `test_receivables_overdue_aging` — Overdue detection

### What's MISSING 🔴

#### Tasks Not Tested (6 of 10)
| # | Task | Missing Because |
|---|------|----------------|
| **4** | **Follow up on overdue** — Create follow-up task | Follow-up tasks tested, but not specifically as overdue collection action |
| **6** | **Approve financial OCR** — OCR→approved, trusted_export=true | OCR approve tested, but not with financial document context |
| **8** | **Run attendance cost report** — Labour cost by department | No attendance cost report test (workforce cost tested separately) |
| **9** | **Generate email summary** — Financial summary sent | No `/email-summary` integration test with financial KPIs |
| **10** | **Edit pre-dispatch invoice** — Qty correction before dispatch linked | No post-creation invoice edit test |

#### Edge Cases Not Tested (6 of 10)
| Edge Case | Missing Because |
|-----------|----------------|
| **Post-dispatch invoice edit** — Locked with linked dispatch | Invoice-dispatch linkage tested, but edit-block not tested |
| **Delete invoice attempt** — Accountant blocked from delete | No negative permission test for Accountant on delete |
| **Duplicate invoice creation** — Same customer/product/qty <5min | No duplicate invoice detection test |
| **Zero-weight invoice** — 0 kg invoice blocked | No invoice validation boundary test |
| **GST validation failure** — Invalid GSTIN format | Customer GST tested, but not invoice-level GST validation |
| **Bounced cheque handling** — Payment reversal after bounce | No payment reversal test |

---

## 5. Manager — Gap Analysis

### Existing Test Coverage ✅

| Test File | Tests Found | What They Cover |
|-----------|------------|-----------------|
| `test_steel_module.py` | 20+ tests | Reconciliation approval, stock adjustments |
| `test_factory_context.py` | 11 tests | Invite users, factory management, role scoping |
| `test_workforce_intelligence.py` | 12 tests | Workforce overview, cost rates, shift comparison |
| `test_premium_analytics.py` | 2 tests | Dashboard, PDF |
| `test_ai_insights.py` | 5 tests | AI suggestions, anomalies, NLQ |

**Specific mapping:**
- ✅ `test_steel_reconciliation_approval_workflow` — **Task 8** (Approve inventory adjustment)
- ✅ `test_admin_can_assign_manager_to_multiple_factories` — Multi-factory management
- ✅ `test_manager_cannot_invite_admin_or_owner` — **Task 9** (Invite with role restriction)
- ✅ `test_overview_returns_kpis` — Workforce KPIs view

### What's MISSING 🔴

#### Tasks Not Tested (7 of 10)
| # | Task | Missing Because |
|---|------|----------------|
| **1** | **Review dashboard** — Production/attendance/alerts/financial KPIs | No dashboard KPI integration test for Manager |
| **2** | **Handle escalated variance** — ESC-001 variance >5% manager OK | No escalation handling flow test |
| **3** | **Override credit limit** — CUST-005 ₹40L→₹45L | Credit limit override exists but as Owner, not Manager |
| **4** | **Override dispatch qty** — ESC-003 excess qty authorize | Dispatch override not tested |
| **5** | **Resolve attendance dispute** — EMP-010 late mark dispute | No attendance dispute resolution test |
| **6** | **Review weekly analytics** — Production trends | Analytics test exists but not Manager-scoped |
| **7** | **Run cross-functional report** — Combined production+financial | No combined report test |
| **10** | **Review OCR productivity** — Per-supervisor stats | No OCR throughput/metrics test |

#### Edge Cases Not Tested (8 of 10)
| Edge Case | Missing Because |
|-----------|----------------|
| **Override without reason** — Block, reason required | No override-reason validation test |
| **Role self-promotion** — Manager tries to assign self to Admin | Tested in privilege_escalation unit tests, no integration test |
| **Cross-factory override** — FACT-001→FACT-002 blocked | Factory scoping tested for entries, not overrides |
| **Delete user attempt** — Blocked, only Admin/Owner | Manager delete blocked in integration |
| **Billing page access** — Manager→/billing blocked | Billing security tests verify Manager blocked |
| **Plan change attempt** — Manager tries subscription change | Only Owner billing tests exist |
| **Simultaneous override conflict** — Two managers, one dispatch | No concurrency test for overrides |
| **Override > 20% variance** — Auto-escalate to Owner | No escalation chain test |

---

## 6. Admin — Gap Analysis

### Existing Test Coverage ✅

| Test File | Tests Found | What They Cover |
|-----------|------------|-----------------|
| `test_factory_context.py` | 11 tests | User invite, role assignment, multi-factory, factory limits |
| `test_alert_recipients.py` | 5 tests | Alert recipients CRUD, preferences, limits, duplicates |
| `test_settings_demo_load.py` | 2 tests | Demo data loader |
| `test_factory_profiles.py` | 2 tests | Factory profile catalog, update |
| `test_billing_security.py` | 6 tests | Billing read/write role enforcement |
| `test_tenant_isolation.py` | 3 tests | Factory-scoped data isolation |

**Specific mapping:**
- ✅ `test_admin_can_manage_alert_recipients` — **Task 6** (Add alert recipient)
- ✅ `test_non_admin_cannot_manage_alert_recipients` — Role enforcement
- ✅ `test_free_plan_enforces_two_active_recipients` — **Task 5** (Alert plan limits)
- ✅ `test_alert_recipients_reject_duplicates` — Duplicate prevention
- ✅ `test_admin_can_read_billing_but_cannot_write` — **Task 9** (View billing, read-only)
- ✅ `test_demo_loader_requires_admin_role` — Role enforcement
- ✅ `test_auth_context_and_factory_switch` — **Task 10** (Create factory)
- ✅ `test_factory_user_limit_counts_multi_factory` — User limit enforcement

### What's MISSING 🔴

#### Tasks Not Tested (5 of 10)
| # | Task | Missing Because |
|---|------|----------------|
| **1** | **View user list** — All 18 users with roles/factories | `/settings/users` tested as part of other flows, but not as standalone "list all users" |
| **2** | **Invite new user** — Standard invite flow | Invite flow tested for Manager role, but not explicitly as Admin |
| **3** | **Change user role** — Operator→Supervisor promotion | Role change tested via monkeypatching (unit tests), not integration |
| **4** | **Deactivate user** — Flag inactive, blocks login | No user deactivation integration test |
| **8** | **Run usage reconciliation** — OCR + WhatsApp usage vs billed | No usage reconciliation dry-run test |

#### Edge Cases Not Tested (5 of 10)
| Edge Case | Missing Because |
|-----------|----------------|
| **Owner role assignment** — Admin blocked from assigning Owner | Tested in unit tests (`test_factory_roles.py`), not integration |
| **Last admin deletion** — Cannot remove last Admin | No boundary test for "last remaining" admin |
| **Invite to non-existent factory** — FACT-999 blocked | No invalid factory invite test |
| **Storage limit reached** — >10GB blocks uploads | No storage quota enforcement test |
| **Delete factory with users** — FACT-001 has 17 users, blocked | No "factory has members" delete guard test |

---

## 7. Owner — Gap Analysis

### Existing Test Coverage ✅

| Test File | Tests Found | What They Cover |
|-----------|------------|-----------------|
| `test_steel_module.py` | 20+ tests | Financial access, PDF export, role-redacted data |
| `test_billing_security.py` | 6 tests | Plan override, downgrade, order creation |
| `test_premium_analytics.py` | 2 tests | Premium dashboard, executive PDF |
| `test_ai_insights.py` | 5 tests | AI suggestions, anomalies, NLQ, executive summary |
| `test_workforce_intelligence.py` | 12 tests | Cost summary, financial access |

**Specific mapping:**
- ✅ `test_steel_overview_financials_require_owner_role` — Financial data redaction for non-Owner
- ✅ `test_steel_owner_daily_pdf_requires_owner` — **Task 10** (Daily PDF export, Owner-only)
- ✅ `test_owner_can_schedule_and_cancel_downgrade` — **Task 6-7** (Manage subscription, change plan)
- ✅ `test_premium_dashboard_and_pdf_work_for_factory_plan` — Premium dashboard
- ✅ `test_ai_nlq_requires_group_and_returns_data` — AI insights (Task 2)

### What's MISSING 🔴

#### Tasks Not Tested (8 of 10)
| # | Task | Missing Because |
|---|------|----------------|
| **1** | **Review premium dashboard** — All KPIs, risk signals, money | Dashboard tested for Factory plan, not specific Owner risk KPIs |
| **3** | **Review email summary** — Financials, risks, exceptions sent | No email summary content test |
| **4** | **View steel charts** — Trend lines, top customers | Steel charts endpoint not integration tested |
| **5** | **Explore drill-down** — Click ₹72L→invoice list | No drill-down navigation test (UI test needed) |
| **8** | **Purchase WhatsApp pack** — Pack added, limit increases | WhatsApp pack purchase not tested end-to-end |
| **9** | **Override blocked action** — Emergency override via control tower | No control tower override test |

#### Edge Cases Not Tested (9 of 10)
| Edge Case | Missing Because |
|-----------|----------------|
| **Last Owner deactivation** — Cannot remove only Owner | No boundary test |
| **Cross-factory scope** — FACT-001 Owner sees FACT-002 data | Cross-factory visibility not tested for Owner |
| **Override without audit trail** — Emergency override reason required | No override audit requirement test |
| **Billing downgrade mid-cycle** — 73% usage, scheduled downgrade | Downgrade tested for "OK" response, not mid-cycle proration |
| **Multiple Owner accounts** — Two Owners, both full authority | No multi-Owner test |
| **Financial export data range** — 1-year PDF | PDF tested for single day only |
| **Cancel subscription** — Expires on date, data retention | No cancellation/expiry test |
| **Owner as operator** — Dual-role in small factory | No dual-role context switching test |
| **Anomaly false positive** — Dismiss with feedback | No anomaly feedback loop test |

---

## Consolidated Coverage by Module/Workflow

| Module / Workflow | Tests Exist? | Coverage | Critical Gaps |
|-------------------|-------------|----------|---------------|
| **Attendance Punch** | `test_attendance.py` (9) | 🟡 ~50% | Late punch, cross-midnight, duplicate, auto-missed |
| **Attendance Regularization** | `test_attendance.py` (3) | 🟡 ~60% | Multiple same-day, different types |
| **Attendance Reports** | ❌ None | 🔴 0% | No attendance report test at all |
| **Production Entry** | `test_entry_offline_sync.py` (2) | 🔴 ~15% | No create/approve/reject flow as Operator |
| **Entry Approval** | `test_attendance.py` (indirect) | 🔴 ~20% | No Supervisor-specific entry approval test |
| **OCR Scan & Verify** | `test_ocr_verification.py` (10) | 🟢 ~80% | Low-quality image, per-supervisor stats |
| **OCR Export** | `test_ocr_verification.py` (3) | 🟢 ~75% | Trusted export tested |
| **Dispatch** | `test_steel_module.py`, `test_steel_dispatch_batch_workflow.py` | 🟡 ~60% | Gate pass generation, cancellation inventory reversal |
| **Inventory** | `test_steel_module.py` (5) | 🟡 ~55% | Negative stock only for batches, not Operator |
| **Batch Production** | `test_steel_dispatch_batch_workflow.py` (6) | 🟢 ~85% | Full lifecycle, severity, stock posting |
| **Invoicing** | `test_steel_module.py`, `test_steel_finance.py` | 🟢 ~80% | GST validation, invoice edit-lock |
| **Payments** | `test_steel_module.py` (4) | 🟡 ~65% | Bounced cheque, overpayment |
| **Customer Verification** | `test_steel_module.py` (5) | 🟢 ~90% | Document upload, mismatch, reject |
| **Receivables** | `test_steel_finance.py` (7) | 🟢 ~85% | Aging, efficiency, paid/unpaid |
| **Payables & Expenses** | `test_steel_finance.py` (8) | 🟢 ~80% | Some gap in paid bill handling |
| **Reconciliation** | `test_steel_module.py` (6) | 🟢 ~85% | Approval, rejection, summary KPIs, role scope |
| **Alert Recipients** | `test_alert_recipients.py` (5) | 🟢 ~80% | Admin CRUD, preferences, limits |
| **Alert Detection** | `test_ops_alerts.py` (12) | 🟢 ~90% | Detectors, rate limiter, dispatcher, formatter |
| **User Management** | `test_factory_context.py`, `test_factory_roles.py` (15) | 🟡 ~65% | Deactivation, last-admin guard, invite to invalid factory |
| **Role Assignment** | `test_privilege_escalation.py`, `test_factory_context.py` (9) | 🟢 ~85% | Manager→Admin blocked, Owner can promote |
| **Billing** | `test_billing_addons.py`, `test_billing_security.py` (9) | 🟡 ~65% | Addon checkout, plan upgrade, downgrade |
| **Premium Dashboard** | `test_premium_analytics.py` (2) | 🔴 ~30% | Plan-gating tested, drill-down not tested |
| **AI Insights** | `test_ai_insights.py` (5) | 🟡 ~55% | NLQ, anomalies, executive summary, usage |
| **Workforce Intelligence** | `test_workforce_intelligence.py` (12) | 🟢 ~80% | Cost rates, shift comparison, worker rankings |
| **Factory/Tenant Isolation** | `test_tenant_isolation.py` (3) | 🟡 ~60% | Entry/analytics/report scope switching |
| **Demo Loader** | `test_settings_demo_load.py` (2) | 🟢 ~75% | Idempotent load, admin-only |
| **Profile/Password** | `test_profile.py` (5) | 🟢 ~90% | Update, photo, password change |

---

## Priority Ranking of Missing Tests

### 🔴 P0 — Critical (Core workflow broken without these)
| # | Missing Scenario | Role(s) | Why Critical |
|---|-----------------|---------|--------------|
| 1 | **Late punch → late mark accumulation → half-day deduction** | Attendance | Core attendance rule, payroll impact |
| 2 | **Cross-midnight shift punch** | Attendance, Operator | Night shift workers = 33% of workforce |
| 3 | **Self-approval prevention (integration test)** | Supervisor, Manager | Maker-checker is a financial compliance requirement |
| 4 | **Entry approval/rejection by Supervisor** | Supervisor | Core Supervisor function, no test exists path |
| 5 | **Rejection reason required for entries** | Supervisor | Data integrity requirement |
| 6 | **Dispatch quantity override (Manager)** | Manager | Operational override authority |
| 7 | **Credit limit override (Manager)** | Manager, Accountant | Financial control |
| 8 | **Owner premium dashboard with full risk KPIs** | Owner | Strategic value proposition |
| 9 | **Attendance cost report** | Accountant, Manager | Payroll visibility |
| 10 | **Deactivate user (Admin)** | Admin | User lifecycle management |

### 🟡 P1 — Important (Business logic coverage)
| # | Missing Scenario | Role(s) |
|---|-----------------|---------|
| 11 | Duplicate punch-in prevention | Attendance |
| 12 | Regularization of all 3 types (missed, timing, status) | Attendance, Supervisor |
| 13 | Multiple same-day regularizations | Attendance, Supervisor |
| 14 | Zero-production entry with reason | Operator |
| 15 | Gate entry/exit standalone flow | Operator |
| 16 | Work queue view for Operator | Operator |
| 17 | Gate pass generation | Supervisor |
| 18 | Alert acknowledgement | Supervisor, Manager |
| 19 | Post-dispatch invoice edit block | Accountant |
| 20 | Bounced cheque payment reversal | Accountant |
| 21 | GST validation on invoice creation | Accountant |
| 22 | Escalation handling (variance >5%) | Manager |
| 23 | Attendance dispute resolution | Manager |
| 24 | Usage reconciliation dry run | Admin |
| 25 | Owner drill-down from KPIs to detail | Owner |
| 26 | WhatsApp pack purchase flow | Owner |
| 27 | Anomaly false-positive feedback | Owner |

### 🔵 P2 — Nice to Have (Edge case hardening)
| # | Missing Scenario | Role(s) |
|---|-----------------|---------|
| 28 | Back-date punch rejection | Attendance |
| 29 | Holiday/OT punch marking | Attendance |
| 30 | First-ever punch for new user | Attendance |
| 31 | Concurrent punch by two employees | Attendance |
| 32 | Auto-missed-punch at midnight | Attendance, System |
| 33 | Smart parse AI suggestion correction | Operator |
| 34 | Downtime > shift hours validation | Operator |
| 35 | Inter-shift batch handoff | Operator |
| 36 | OCR low-quality image handling | Operator, Supervisor |
| 37 | Offline queue persistence | Operator |
| 38 | Multiple machine entries per shift | Operator |
| 39 | Re-approve already-rejected entry | Supervisor |
| 40 | Cross-supervisor factory scoping | Supervisor |
| 41 | Duplicate invoice detection | Accountant |
| 42 | Last-admin deletion guard | Admin |
| 43 | Factory deletion with active users | Admin |
| 44 | Storage quota enforcement | Admin |
| 45 | Cross-factory Owner visibility | Owner |
| 46 | Multi-Owner scenario | Owner |
| 47 | Subscription cancellation | Owner |

---

## Existing Test Strengths (What's Well Covered)

| Area | Test File | Tests | Details |
|------|-----------|-------|---------|
| **Steel full lifecycle** | `test_steel_dispatch_batch_workflow.py` | 8 | Batch → Invoice → Dispatch → Delivery, negative stock, input!=output |
| **Customer verification** | `test_steel_module.py` | 5 | PAN/GST upload, match score, mismatch→block, reject |
| **Finance KPIs** | `test_steel_finance.py` | 24 | Revenue, receivables aging, payables, expenses, profitability |
| **Reconciliation** | `test_steel_module.py` | 6 | Approve, reject, mismatch cause, summary KPIs, role scoping |
| **Alert detection & dispatch** | `test_ops_alerts.py` | 12 | 5xx spike, OCR failure, auth anomaly, rate limiter, formatter |
| **Role privilege escalation** | `test_privilege_escalation.py` | 5 | Manager→Admin blocked, Owner→Admin allowed, rank checks |
| **Tenant isolation** | `test_tenant_isolation.py` | 3 | Factory-scoped entries, analytics, reports, alerts |
| **Billing security** | `test_billing_security.py` | 6 | Manager blocked, Admin read-only, Owner downgrade |
| **Workforce intelligence** | `test_workforce_intelligence.py` | 12 | Overview, workers, cost, shifts, rate CRUD |
| **OCR verification** | `test_ocr_verification.py` | 10 | Draft→Submit→Approve, rejection reason, trusted export, share link |

---

## Recommended Test Creation Order

Based on criticality and dependencies:

```
Phase 1 (P0 - 10 tests, high priority):
├── test_attendance_edge_cases.py
│   ├── test_late_punch_increments_late_mark
│   ├── test_cross_midnight_punch_flow
│   └── test_duplicate_punch_prevention
├── test_supervisor_entry_approval.py
│   ├── test_approve_entry_as_supervisor
│   ├── test_reject_entry_requires_reason
│   └── test_self_approval_prevented
├── test_manager_overrides.py
│   ├── test_override_dispatch_quantity
│   └── test_override_credit_limit
├── test_owner_premium_dashboard.py
│   ├── test_risk_kpis_displayed_on_dashboard
│   └── test_drill_down_from_kpi_to_invoices
└── test_admin_user_deactivation.py
    └── test_deactivate_user_blocks_login

Phase 2 (P1 - 8 tests):
├── test_accountant_edge_cases.py
│   ├── test_post_dispatch_invoice_edit_blocked
│   ├── test_bounced_cheque_reversal
│   └── test_gst_validation_on_invoice
├── test_operator_gate_flow.py
│   ├── test_gate_entry_and_exit_standalone
│   └── test_zero_production_entry
├── test_attendance_reports.py
│   └── test_attendance_cost_report_by_department
└── test_usage_reconciliation.py
    └── test_dry_run_reconciliation_discrepancy

Phase 3 (P2 - remaining edge cases):
├── test_attendance_remaining_edges.py (5 tests)
├── test_operator_remaining_edges.py (4 tests)  
├── test_supervisor_remaining_edges.py (3 tests)
├── test_accountant_remaining_edges.py (2 tests)
├── test_manager_remaining_edges.py (4 tests)
├── test_admin_remaining_edges.py (3 tests)
└── test_owner_remaining_edges.py (4 tests)
```

---

## Summary

| Metric | Count |
|--------|:-----:|
| Existing test files | 76 |
| Existing test functions | ~350+ |
| Total needed test cases (from requirements) | ~130 (60 tasks + 70 edge cases) |
| Currently covered test cases | ~35 |
| **Gap (uncovered)** | **~95 test cases** |
| **Overall test coverage of requirements** | **~27%** |
| **P0 missing tests** | 10 (critical) |
| **P1 missing tests** | 17 (important) |
| **P2 missing tests** | 20 (nice-to-have) |

**Strongest areas:** Steel full lifecycle, finance KPIs, reconciliation, alert ops, OCR verification, role security

**Weakest areas:** Attendance edge cases, Operator gate/sync flows, Supervisor entry approvals, Accountant post-dispatch controls, Manager overrides, Owner strategic dashboards, Admin user lifecycle

---

> **Document Version:** 1.0  
> **Date:** 2026-06-22  
> **Method:** Manual code review of all 76 test files against `docs/TEST_DATA_REQUIREMENTS.md`
