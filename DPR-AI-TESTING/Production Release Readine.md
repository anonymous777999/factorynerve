DPR.ai — Production Release Readiness Audit: Master Scorecard
Audited: 11 modules across 46 router/service/model files + frontend + tests
Date: 2026-06-13
Total findings: 46 unique bugs (5 CRITICAL, 13 HIGH, 18 MEDIUM, 10 LOW)

RELEASE BLOCKERS (CRITICAL — Must fix before production)
ID	Module	Title	Severity
BUG-INV-001	Steel Inventory	Negative stock race condition — TOCTOU in stock_balances_for_factory(). Three code paths (transactions, batches, dispatch status) check balance then insert without row lock. Two concurrent dispatches can both pass.	CRITICAL
BUG-AUDIT-001	Audit Logs	Missing indexes on audit_logs.factory_id and timestamp. Steel queries at steel.py:2362,3449,3807 filter by factory_id + details LIKE — full table scan on every steel overview/invoice/dispatch detail load.	CRITICAL
BUG-AUDIT-002	Audit Logs	No audit log retention/purging mechanism. audit_logs grows unbounded with every steel CRUD, every entry review, every auth event. No archival, no partitioning, no TTL. Eventual disk-full downtime.	CRITICAL
BUG-REPORT-001	Reports	stock_balances_for_factory() loads ALL transactions into Python and sums in a loop (steel_service.py:76). No GROUP BY SUM in SQL. Called on every inventory check — O(n) per check.	CRITICAL
BUG-REPORT-002	Reports	build_steel_realization_metrics() loads ALL production batches with no LIMIT (steel_service.py:400). Called on every overview load. For a factory with 100K batches, this is an instant OOM risk.	CRITICAL
HIGH PRIORITY (Fix before GA, acceptable for staged rollout with monitoring)
ID	Module	Title	Severity
BUG-SALES-004	Sales	No sales order model — invoices created without preceding quotation/order confirmation. No order-to-cash state machine.	HIGH
BUG-REPORT-003	Reports	latest_reconciliations_for_factory() loads ALL approved reconciliation rows (steel_service.py:87). Should use window function / DISTINCT ON per item_id.	HIGH
BUG-AUDIT-003	Audit Logs	SQL wildcard injection via details LIKE f"%{batch_code}%" (steel.py:2362,3449,3807). A batch_code containing % or _ matches unintended rows.	HIGH
BUG-AUDIT-004	Audit Logs	No HTML/sanitization in details field — user-controlled data embedded via f-strings (steel.py:2648). Stored XSS risk in any audit log viewer.	HIGH
BUG-AUDIT-005	Audit Logs	IP address handling inconsistent — _write_steel_audit and _write_admin_audit store plaintext IPs; 4 other paths hash via hash_ip_address. GDPR exposure.	HIGH
BUG-E2E-002	E2E	Globally unique constraints on batch_code, dispatch_number, gate_pass_number, invoice_number — no factory_id scoping. Two factories can never share the same sequence.	HIGH
BUG-E2E-003	E2E	Steel customers have no update/status-change endpoint. status (active/on_hold/blocked), credit_limit, payment_terms_days frozen on creation. Invoice creation blocks on_hold customers but no way to set it.	HIGH
BUG-E2E-004	E2E	Steel production batches have no soft-delete or lifecycle closure — is_active missing. Batches accumulate forever with no way to void/obsolete.	HIGH
BUG-WHATSAPP-001	WhatsApp	Transport errors (TimeoutException, HTTPError) never retried — immediately return _failed_result. Existing while attempt_count < 2 loop only retries on HTTP 5xx.	HIGH
BUG-E2E-001	E2E	Check-then-act race condition (duplicate of BUG-INV-001) — stock balance check without row lock.	HIGH
BUG-SALES-003	Sales	Credit limit check race condition — two simultaneous invoices for same customer both pass before either commits.	MEDIUM
BUG-BILLING-001	Billing	Razorpay order created outside DB transaction. If PaymentOrder INSERT fails, Razorpay order is orphaned.	MEDIUM
REGRESSION SUITE (Critical paths to cover in CI)
Inventory → Dispatch → Invoice — Create batch → create dispatch (debit inventory) → verify balance check prevents oversell → create invoice → verify stock movement recorded
Negative stock rejection — Concurrent dispatch creation for same item: expect exactly one to fail with 409
Role hierarchy enforcement — ACCOUNTANT tries to promote to MANAGER: 403. OWNER promotes SUPERVISOR: 200.
Multi-factory isolation — Factory A user cannot read Factory B data on any steel, entry, attendance, or audit endpoint
OCL verification self-approval — User who submits OCR draft tries to approve it: 403
Billing webhook integrity — Razorpay webhook with invalid signature: 401. Duplicate webhook event: idempotent response.
Audit trail consistency — Every steel write, role change, and entry review produces an AuditLog row with hashed IP, action, previous_state, new_state
Rate limiter — >100 requests/minute from same IP: 429. Admin exempt.
Steel financial redaction — Non-OWNER overview response has financial fields nulled; OWNER sees full values
Dispatch state machine — delivered cannot transition back to pending; cancelled is final
MODULE-BY-MODULE BREAKDOWN
Module	Bugs Found	Critical	High	Medium	Low	Verdict
1. Roles & Permissions	2	0	0	2	0	PASS (minor)
2. Steel Inventory	1	1	0	0	0	BLOCKED
3. Purchase	1	0	0	0	1	PASS (feature gap)
4. Sales & Billing	2	0	1	1	0	CONDITIONAL
5. Dispatch	1	0	0	1	0	PASS (minor)
6. OCR	1	0	0	1	0	PASS (minor)
7. WhatsApp	5	0	1	1	3	CONDITIONAL
8. Subscription & Billing	1	0	0	1	0	PASS (minor)
9. Reports & Analytics	11	2	1	4	4	BLOCKED
10. Audit Logs	11	2	3	3	3	BLOCKED
11. E2E Integration	10	0	4	4	2	BLOCKED
FINAL VERDICT
╔══════════════════════════════════════════════════════════════╗
║                    NOT RELEASE READY                         ║
╠══════════════════════════════════════════════════════════════╣
║  5 CRITICAL  ·  13 HIGH  ·  18 MEDIUM  ·  10 LOW            ║
║                                                              ║
║  BLOCKERS: Negative stock race (INV-001), missing indexes    ║
║  on audit_logs (AUDIT-001), no retention (AUDIT-002),       ║
║  full table scans on inventory/report queries (RPT-001/002) ║
║                                                              ║
║  RECOMMENDATION: Address 5 CRITICAL + 4 HIGH blockers       ║
║  before any factory floor deployment.                        ║
║  Estimated effort: 3-4 sprints for all CRITICAL+HIGH,       ║
║  or 1 sprint for CRITICAL only (staged rollout).            ║
╚══════════════════════════════════════════════════════════════╝
Minimal path to green: Fix 5 CRITICAL bugs (stock race condition, audit index, audit retention, two full-table-scan queries in reports). Re-audit those modules. At that point, staged rollout with monitoring is viable — the remaining HIGH items are operational risks rather than data-loss risks.

Audit complete. 5 CRITICAL, 13 HIGH, 18 MEDIUM, 10 LOW across all 11 modules. The 5 release blockers are: negative stock race condition (INV-001), missing audit log indexes (AUDIT-001), no audit retention (AUDIT-002), and two full-table-scan queries in the reports module (RPT-001/002). Fix those for a staged rollout; all 18 high-severity issues for GA.