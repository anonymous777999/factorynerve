Comprehensive Steel Dispatch Module Audit
1. Dispatch Statuses and Valid Transitions
Defined statuses (line 72 of steel.py): pending, loaded, exited, dispatched, delivered, cancelled

Default status on creation: "dispatched" (line 259, model default line 39)

Normalization (_normalize_dispatch_status, line 767): Validates the status string is in the allowed set, but does NOT enforce any transition graph. There is no logic that validates that e.g. you can only go pending -> loaded -> exited -> dispatched -> delivered.

BUG-DISPATCH-002: No status transition validation. The endpoint accepts any valid status as a target from any current status (with 3 narrow exceptions). For example, a dispatch can move directly from pending to delivered, or from dispatched back to pending (only blocked if inventory is posted). The only prohibitions are:

Rule	Lines	What it prevents
Cancelled dispatches cannot be updated	4097-4098	Any status change from cancelled
Posted dispatches cannot be cancelled	4099-4100	cancelled if inventory_posted_at is set
Posted dispatches cannot go to pending/loaded	4101-4102	pending or loaded if inventory_posted_at is set
There is no validation that entry_time must precede exit_time, or that exit_time requires entry_time.

2. Inventory Deduction: At Creation or Execution?
Inventory is deducted at the moment the dispatch enters a "posting" status, not at dispatch creation generally.

_dispatch_status_posts_inventory (line 524) returns True for statuses: exited, dispatched, delivered. It returns False for pending, loaded, and (via allow_cancelled=False) cancelled.

Flow in create_steel_dispatch (lines 3956-4028):

User provides a status in the creation payload (default "dispatched").
If the requested status posts inventory, the stock balance is checked.
The dispatch is created with the requested status.
If the status posts inventory, _create_dispatch_inventory_movements is called immediately (line 4021-4028).
The transaction is committed.
Flow in update_steel_dispatch_status (lines 4115-4130):

If the next status posts inventory AND the dispatch has NOT already posted inventory, stock balance is checked and _create_dispatch_inventory_movements is called.
If inventory was already posted (e.g., moving from dispatched to delivered), no new movements are created.
_create_dispatch_inventory_movements has a guard: it returns immediately if inventory_posted_at is already set (line 1599-1600).
Key insight: A dispatch created with status="pending" does NOT deduct inventory. Inventory is only deducted when status moves to exited, dispatched, or delivered.

3. Can Dispatch Be Approved by Same Person Who Created It?
Yes. There is no self-approval check in update_steel_dispatch_status (line 4080). The assert_not_self_approval helper exists in backend/rbac.py (line 37) and is used in other routers (entries, attendance), but it is not called here.

The creator's user_id is stored in created_by_user_id, and the status update allows any user with SUPERVISOR/MANAGER/ADMIN/OWNER role to update, including the same user who created the dispatch. The delivered_by_user_id is set to current_user.id when status is set to delivered, enabling self-delivery confirmation.

BUG-DISPATCH-005: No self-approval guard. The same user can create a dispatch and later mark it as delivered without any secondary approval.

4. What Happens If Dispatch Is Cancelled? Is Inventory Restored?
Cancellation is only allowed for non-posted dispatches (line 4099-4100):

if next_status == "cancelled" and _dispatch_has_posted_inventory(dispatch):
    raise HTTPException(status_code=409, detail="Only non-posted draft dispatches can be cancelled.")
This means:

If the dispatch is still pending or loaded (no inventory posted), it can be cancelled freely. No inventory restoration is needed because no inventory was ever deducted.
If the dispatch has moved to exited, dispatched, or delivered (inventory posted), cancellation is blocked entirely.
There is no mechanism to reverse/restore inventory after cancellation. If a posted dispatch needs to be undone, there is no "inventory return" or "credit note" workflow. The only way is to manipulate inventory manually via stock reconciliation or adjustments.

This is a business process limitation, not strictly a bug, but it means posted dispatches are effectively immutable — they cannot be cancelled, and no compensating inventory transaction is created.

5. Can More Stock Be Dispatched Than Available? (Race Condition)
Yes, this is vulnerable to a race condition.

The stock check pattern:

# create_steel_dispatch, lines 3956-3961
if _dispatch_status_posts_inventory(requested_status):
    balances = stock_balances_for_factory(db, factory.factory_id)
    for item_id, requested_weight in requested_by_item.items():
        available = float(balances.get(item_id, 0.0))
        if available + 0.0001 < requested_weight:
            raise HTTPException(...)
And in update_steel_dispatch_status, lines 4119-4123:

balances = stock_balances_for_factory(db, factory.factory_id)
for item_id, requested_weight in requested_by_item.items():
    available = float(balances.get(item_id, 0.0))
    if available + 0.0001 < requested_weight:
        raise HTTPException(...)
BUG-DISPATCH-004: Check-then-act race condition. The flow is:

Read stock balance from DB (no lock).
If sufficient, proceed to create the dispatch and inventory movements.
Commit.
Between steps 1 and 3, another concurrent request can also read the same balance and also proceed. Both will commit, and the net stock can go negative. The system uses no locking mechanism (SELECT ... FOR UPDATE is absent — the only with_for_update usage in the entire codebase is in otp_service.py at line 456, not in dispatch).

The same race condition applies to invoice line over-dispatch: existing_dispatch_weights (lines 3897-3910) reads committed data only, and two concurrent dispatches for the same invoice line could both succeed, exceeding the invoice line's quantity.

There is no optimistic locking (no version column) and no pessimistic locking (no FOR UPDATE) protecting the stock check.

6. Is Dispatch Linked to Invoice? Can Dispatch Happen Without Billing?
Dispatch is tightly linked to invoice — invoice_id is a required FK on SteelDispatch (line 26 of model), and dispatch_number is unique (line 17 of model).

Dispatch can happen on any invoice regardless of billing status. The _get_invoice_or_404 function (line 1519) only checks that the invoice exists and belongs to the factory. It does not check:

Whether the invoice has been billed/sent to the customer
Whether the invoice is paid, partial, or unpaid
Whether the customer has any credit hold
BUG-DISPATCH-006: No invoice billing status check. Goods can be dispatched against an invoice that:

Has never been sent to the customer
Has an outstanding balance (no payment)
Is overdue
The customer may be on hold/blocked
7. What Happens If Dispatch Is Executed but Delivery Never Confirmed?
Nothing. There is:

No timeout mechanism for unconformed deliveries
No alerting/scheduling system for stale dispatched status
No escalation workflow for pending delivery confirmations
No notification to users/managers
The system has a recover_stale_dispatching_events function (in billing_manager.py, line 515), but this is for the ops_alert_events notification dispatch system, NOT for steel dispatches. Steel dispatch deliveries that remain in dispatched status indefinitely will stay that way forever unless manually updated.

The delivered_at timestamp is only set when status is explicitly changed to delivered. There is no automatic "overdue delivery" detection.

8. Role Guards on Each Endpoint
Endpoint	Route	Roles Allowed	Notes
List dispatches	GET /dispatches	SUPERVISOR, MANAGER, ADMIN, OWNER, ACCOUNTANT	Line 3691
Get dispatch detail	GET /dispatches/{id}	SUPERVISOR, MANAGER, ADMIN, OWNER, ACCOUNTANT	Line 3739
Create dispatch	POST /dispatches	SUPERVISOR, MANAGER, ADMIN, OWNER	Line 3860 — no ACCOUNTANT
Update status	POST /dispatches/{id}/status	SUPERVISOR, MANAGER, ADMIN, OWNER	Line 4087 — no ACCOUNTANT
BUG-DISPATCH-007 (minor): ACCOUNTANT role can VIEW dispatches (list/detail) but cannot CREATE or UPDATE them. This is inconsistent — an accountant can see dispatch data but cannot create or change status. This may be intentional (accountants should not create physical dispatches), but it is worth documenting.

No OPERATOR role has access to any dispatch endpoint, which is reasonable since operators handle production batches.

9. Audit Logging
Audit logging is implemented via _write_steel_audit (line 311):

db.add(AuditLog(
    user_id=actor.id,
    org_id=resolve_org_id(actor),
    factory_id=factory_id,
    action=action,
    details=details,
    ip_address=request.client.host if request and request.client else None,
    user_agent=request.headers.get("user-agent") if request else None,
    timestamp=datetime.now(timezone.utc),
))
Audit events recorded for dispatch:

STEEL_DISPATCH_CREATED (line 4037-4047): Logs dispatch number, gate pass, invoice, truck, weight, status.
STEEL_DISPATCH_STATUS_UPDATED (line 4143-4149): Logs dispatch number and current_status->next_status transition.
Missing from audit:

BUG-DISPATCH-010: No audit of entry_time/exit_time/receiver_name/pod_notes changes. The status update endpoint can modify these fields (lines 4104-4107), but the audit entry only records the status transition. If someone changes entry_time or receiver_name without changing status, it is not audited.
10. Factory Isolation
Adequate. The pattern used throughout is:

require_active_steel_factory (line 38 of steel_service.py):
Resolves factory_id from the user's active factory context.
Validates the factory belongs to the user's org (org_id == resolve_org_id(user)).
Validates the factory is a steel factory (industry_type == "steel").
Validates the factory is active.
All queries filter by factory_id == factory.factory_id.
_get_dispatch_or_404 (line 1548) filters by dispatch_id AND factory_id, preventing cross-factory access.
No org-level isolation on the dispatch query itself, but this is mitigated because factory_id is scoped to an org via the factory validation. The pattern is consistent with the rest of the codebase.

11. Concurrency Issues (Summary)
Issue	Severity	Description
Stock balance race	Critical	stock_balances_for_factory reads without a lock; two concurrent dispatches can both see sufficient stock and both succeed, causing negative inventory.
Invoice over-dispatch race	High	existing_dispatch_weights is computed from committed data; two concurrent dispatches can both see remaining quantity on an invoice line and both succeed.
No transactional retry	Medium	No optimistic locking, no retry logic, no with_for_update. The system relies entirely on serialization by the database (which is usually READ COMMITTED).
12. Complete Bug Inventory
BUG-DISPATCH-001 (Medium): Dispatch can be created with "cancelled" status
File: steel.py, line 3867

requested_status = _normalize_dispatch_status(payload.status)
_normalize_dispatch_status defaults to allow_cancelled=True, so a dispatch can be created directly in cancelled state. This produces a nonsensical record — a dispatch that was never active. Fix: Use _normalize_dispatch_status(payload.status, allow_cancelled=False) or add an explicit check after normalization.

BUG-DISPATCH-002 (High): No valid status transition enforcement
File: steel.py, lines 4096-4102 A dispatch can jump from pending directly to delivered, or from dispatched back to pending (if no inventory posted). Only 3 narrow rules exist. The full expected lifecycle (pending -> loaded -> exited -> dispatched -> delivered) is not enforced. Fix: Implement a transition map and validate against it in update_steel_dispatch_status.

BUG-DISPATCH-003 (Medium): No inventory restoration on cancellation (by design, but inflexible)
File: steel.py, lines 4099-4100 Only non-posted dispatches can be cancelled. There is no compensating inventory transaction for cancelling a posted dispatch. Fix: Implement a dispatch_return or dispatch_cancel inventory transaction type that reverses the original movements.

BUG-DISPATCH-004 (Critical): Race condition on stock balance check
File: steel.py, lines 3956-3961 and 4119-4123 stock_balances_for_factory reads without FOR UPDATE. Two concurrent requests can both pass the balance check and over-dispatch. Fix: Use with_for_update() when querying inventory transactions within a transaction, or implement an optimistic locking scheme with retry.

BUG-DISPATCH-005 (High): No self-approval guard
File: steel.py, update_steel_dispatch_status (line 4080) No assert_not_self_approval check. The user who created the dispatch can mark it as delivered, bypassing any separation of duties. Fix: Add assert_not_self_approval(dispatch.created_by_user_id, current_user.id) before allowing status updates (or at least for the delivered transition).

BUG-DISPATCH-006 (Medium): Dispatch allowed on any invoice regardless of billing status
File: steel.py, line 3866 (_get_invoice_or_404) No check on the invoice's payment status, customer hold status, or invoice validity. Goods can be dispatched against unpaid/overdue invoices or blocked customers. Fix: Check invoice.status and/or customer credit status before allowing dispatch creation.

BUG-DISPATCH-007 (Low): ACCOUNTANT role can view but not create/update dispatches
File: steel.py, lines 3691, 3739, 3860, 4087 ACCOUNTANT is in the allowlist for GET /dispatches and GET /dispatches/{id} but not for POST /dispatches or POST /dispatches/{id}/status. This is inconsistent. Fix: Either add ACCOUNTANT to create/update or remove from list/detail — whichever matches the intended business logic.

BUG-DISPATCH-008 (Low): entry_time/exit_time not validated for ordering or consistency
File: steel.py, lines 4104-4105

dispatch.entry_time = coerce_utc_datetime(payload.entry_time) or dispatch.entry_time
dispatch.exit_time = coerce_utc_datetime(payload.exit_time) or dispatch.exit_time
No validation that entry_time < exit_time, or that exit_time requires entry_time, or that these times are in the past. Fix: Add validation that exit_time > entry_time (if both set), and that both are in the past (or at least not in the far future).

BUG-DISPATCH-009 (Medium): Dispatch can be moved from "delivered" back to earlier status
File: steel.py, lines 4137-4139

elif next_status != "cancelled":
    dispatch.delivered_at = None
    dispatch.delivered_by_user_id = None
A dispatch can go from delivered to exited or dispatched, which clears delivery metadata. This could be used to falsify delivery records. Fix: Block transitions from delivered to any non-delivered status (except via an explicit correction workflow).

BUG-DISPATCH-010 (Low): Incomplete audit trail for status updates
File: steel.py, line 4143-4149 Only the status transition is audited. Changes to entry_time, exit_time, receiver_name, and pod_notes are not captured. Fix: Extend the audit detail to include previous/new values of all modifiable fields.

BUG-DISPATCH-011 (Medium): Delivered-at-creation bypasses audit
File: steel.py, lines 4002-4003 If a dispatch is created with status="delivered", delivered_at and delivered_by_user_id are set but the audit log says STEEL_DISPATCH_CREATED, not STEEL_DISPATCH_STATUS_UPDATED. The delivery event is not separately logged. Fix: When status is delivered at creation, also emit a status update audit entry, or include in the creation audit that the dispatch was created as delivered.

BUG-DISPATCH-012 (Critical): get_steel_dispatch_detail will crash with UnboundLocalError
File: steel.py, lines 3786, 3818

# Line 3786 — USED here
can_view_financials=can_view_dispatch_line_financials,
...
# Line 3818 — DEFINED here
can_view_dispatch_line_financials = _can_view_steel_financials(current_user) or ...
The variable can_view_dispatch_line_financials is used in the serialized_lines list comprehension at line 3786 but is only assigned at line 3818, 32 lines later. Python will raise UnboundLocalError because the variable is treated as local (due to the assignment later in the scope) but has not been bound yet when the list comprehension executes. Fix: Move the assignment to BEFORE the list comprehension at line 3780.

BUG-DISPATCH-013 (Low): No stale/undelivered dispatch monitoring
File: Whole dispatch module There is no mechanism to detect dispatches stuck in dispatched status (truck left but delivery never confirmed). No alert, no timeout, no escalation. Fix: Implement a background task or alert that flags dispatches with status="dispatched" and no delivered_at within a configurable threshold (e.g., 48 hours).

Summary Table
Bug ID	Severity	Category	Description
DISPATCH-012	Critical	Runtime crash	get_steel_dispatch_detail raises UnboundLocalError — dispatch cannot be viewed
DISPATCH-004	Critical	Concurrency	Race condition allows over-dispatch of stock
DISPATCH-005	High	Security	Self-approval of dispatch delivery (no segregation of duties)
DISPATCH-002	High	Business logic	No valid status transition enforcement
DISPATCH-009	Medium	Integrity	Delivered status can be reverted, falsifying delivery records
DISPATCH-001	Medium	Data quality	Dispatch can be created already cancelled
DISPATCH-006	Medium	Integration	Dispatch allowed against unpaid/overdue invoices
DISPATCH-003	Medium	Business logic	No inventory restoration on posted dispatch cancellation
DISPATCH-011	Medium	Audit	Delivered-at-creation not audited as a status event
DISPATCH-007	Low	UX/Consistency	ACCOUNTANT role inconsistency (view vs create/update)
DISPATCH-008	Low	Validation	entry_time/exit_time not validated for ordering
DISPATCH-010	Low	Audit	Incomplete audit detail on status updates
DISPATCH-013	Low	Monitoring	No stale/undelivered dispatch detection
Most impactful: DISPATCH-012 (function is broken) and DISPATCH-004 (data integrity under concurrency).