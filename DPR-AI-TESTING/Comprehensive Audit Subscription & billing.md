Comprehensive Audit: Subscription & Platform Billing Module

## Files Audited

| File | Lines | Purpose |
|------|-------|---------|
| `backend/routers/billing.py` | 1156 | All billing endpoints, Razorpay integration, webhook handler |
| `backend/services/billing_manager.py` | 542 | Subscription state machine, plan changes, downgrades, addon activation |
| `backend/services/billing_logger.py` | 78 | Structured PII-masked billing event logging |
| `backend/services/plan_resolver.py` | 24 | Single source of truth for org plan resolution |
| `backend/models/subscription.py` | 53 | Subscription ORM (trial, plan, status, grace period) |
| `backend/models/payment_order.py` | 39 | Payment order ORM (idempotency, provider mapping) |
| `backend/models/invoice.py` | 46 | Invoice ORM for billing history |
| `backend/models/webhook_event.py` | 34 | Webhook event dedup storage |
| `backend/models/org_subscription_addon.py` | 47 | Org-level addon purchases |
| `backend/models/user_plan.py` | 25 | Per-user plan assignment |
| `backend/plans.py` | 575 | Plan catalog, pricing, feature checks, addon definitions |
| `backend/feature_limits.py` | 301 | AI feature quota enforcement (summary, email, smart) |
| `backend/ocr_limits.py` | 359 | OCR usage quota and rate limit enforcement |
| `backend/dependencies/quota.py` | 164 | `require_ocr_quota` / `require_ai_quota` FastAPI dependencies |
| `backend/dependencies/subscription.py` | 65 | `require_active_subscription` FastAPI dependency |
| `backend/middleware/rate_limit.py` | 123 | In-process rate limiter with slowapi fallback |
| `backend/rbac.py` | 51 | Role-based access control helpers |
| `backend/main.py` | Startup billing recovery logic |

---

## 1. Signature Verification on Webhook

**Status: PROPERLY IMPLEMENTED**

- **Lines 971-1004**: Reads `RAZORPAY_WEBHOOK_SECRET`, extracts `x-razorpay-signature` header, calls `razorpay.Utility.verify_webhook_signature(payload, signature, secret)`.
- Failure results in a 400 response with logging and ops alerting (line 1000-1004).
- The secret emptiness check (line 973) correctly rejects unconfigured webhooks.
- The Razorpay SDK's `verify_webhook_signature` uses HMAC-SHA256 under the hood.

**Verdict: No issue found.**

---

## 2. Webhook Event Deduplication

**Status: FUNCTIONAL WITH RACE CONDITION WINDOW**

The webhook handler implements dedup via the `WebhookEvent` table:

- **Unique constraint**: `(provider, event_id)` (webhook_event.py line 17) prevents duplicate inserts.
- **Event ID derivation** (`_resolve_event_id`, line 234-245): Uses `event_type:pay:{payment_id}` if available, else `event_type:order:{order_id}`, else SHA256 hash of payload.
- **Pre-insert check** (line 1010-1014): Queries for existing event before processing.
- **Post-insert IntegrityError catch** (line 1121-1130): If a concurrent request inserts the same event between the check and the insert, the IntegrityError is caught and the handler returns `{"status": "ok", "idempotent": True}`.

**Remaining concerns:**

| Concern | Severity |
|---------|----------|
| **Race window exists**: between the SELECT (line 1010-1014) and the INSERT (line 1027-1036), a second request can slip through. The IntegrityError catch covers this. | Medium |
| **Full rollback on dedup conflict** (line 1122): `db.rollback()` rolls back the **entire** transaction, including the `WebhookEvent` insert AND any `_activate_paid_order` work that already flushed. The event must be re-processed. | Medium |
| **Duplicate `razorpay_event_id` index** (webhook_event.py line 16): There's a separate unique index on `razorpay_event_id` alone. Since the code stores `event_id` as `razorpay_event_id` too (line 1031), this is redundant and could cause unexpected unique violations if code diverges. | Low |

---

## 3. Order Idempotency

**Status: BUGGY - SILENT DATA LOSS ON RACE CONDITION**

The order creation flow (lines 759-906):
1. Compute `idempotency_key` from user + plan + billing_cycle + addons + date (line 811-814)
2. Query `PaymentOrder` by `idempotency_key` (line 815-819)
3. If reusable order exists (status: created/attempted/authorized), return it (line 830-844)
4. If failed/cancelled/expired, generate new key with retry seed (line 828-829)
5. Create Razorpay order via API (line 859-867)
6. INSERT `PaymentOrder` record (line 869-886)
7. On `IntegrityError`, `db.rollback()` then **silently continues** to return success (line 888-889)

### BUG-BILLING-001: Silent Data Loss on Idempotency Race Condition
**Critical** - Lines 888-896.

```python
except IntegrityError:
    db.rollback()  # <-- PaymentOrder insert failed silently
# Execution CONTINUES to line 890, returns success
```

If two concurrent requests create orders with the same idempotency key:
1. Both pass the idempotency check (line 815-819) simultaneously
2. Both create Razorpay orders (risk of double charge)
3. The second INSERT fails with `IntegrityError` on `idempotency_key` unique constraint
4. `db.rollback()` is called but execution **continues** to return a success response
5. The survivor has a `PaymentOrder` record; the loser has an **orphaned Razorpay order** with no DB record
6. When the webhook arrives for the loser's Razorpay order, `_get_payment_order()` returns `None`; fallback logic may still activate the plan, but the `PaymentOrder` audit trail is lost

**Impact**: Orphaned Razorpay orders, potential double activation, lost audit trail.

### BUG-BILLING-002: Idempotency Key Changes Daily
Lines 812-813. The idempotency key hash includes `datetime.now(timezone.utc).date().isoformat()`. This means:
- Same user + plan + addons on **different days** = different idempotency keys → duplicate orders allowed
- This is by design for separate billing periods, but the key derivation is not documented

**Impact**: Low (by design), but worth noting for audit.

---

## 4. Expired Trial Enables Paid Feature Access

### BUG-BILLING-003: Trial Expiry Not Enforced
**Critical** - `billing_manager.py` lines 129-147.

The `get_effective_subscription_status()` function checks time-based transitions for `"active"` → `"past_due"` (line 143) and `"past_due"` → `"suspended"` (line 140-141), but **never checks `trial_end_at` for the `"trialing"` status**.

```python
def get_effective_subscription_status(sub, *, now=None):
    current_time = now or datetime.now(timezone.utc)
    raw_status = str(sub.status or "inactive").strip().lower()
    status = raw_status if raw_status in VALID_SUBSCRIPTION_STATUSES else "suspended"
    grace_end = ensure_utc(sub.grace_period_end_at)
    current_period_end = ensure_utc(sub.current_period_end_at)
    if status == "past_due":   # <-- handles past_due
        if grace_end and grace_end <= current_time:
            return "suspended"
        return "past_due"
    if status == "active" and current_period_end and current_period_end <= current_time:  # <-- handles active
        if grace_end is None:
            grace_end = current_period_end + timedelta(days=BILLING_GRACE_DAYS)
        return "past_due" if grace_end > current_time else "suspended"
    return status  # <-- "trialing" falls through here regardless of trial_end_at
```

Similarly, `require_active_subscription` (dependencies/subscription.py line 61-64) allows trialing access without checking expiry:

```python
if effective_status not in {"trialing", "active"}:
    raise HTTPException(status_code=403, detail={"code": "SUBSCRIPTION_INVALID"})
return sub  # <-- trialing always passes, even if trial_end_at is in the past
```

**Impact**: A user whose trial expired yesterday can still access all paid features (OCR, AI summaries, etc.) indefinitely. The system never transitions `trialing` to any other state based on time.

---

## 5. Feature Gating: Server-Side or Just UI-Hidden?

**Status: SERVER-SIDE ENFORCED**

Feature gating is implemented at three server-side layers:

| Layer | Mechanism | Files |
|-------|-----------|-------|
| **Route dependencies** | `Depends(require_active_subscription)`, `Depends(require_ocr_quota)` | `dependencies/subscription.py`, `dependencies/quota.py` |
| **OCR quota** | `check_and_record_org_usage()` raises 403/429 if plan lacks OCR access or quota exhausted | `ocr_limits.py` lines 114-301 |
| **AI feature quotas** | `check_and_record_org_feature_usage()` raises 403 for features not in plan, 429 for quota exhausted | `feature_limits.py` lines 60-261 |
| **Past-due blocking** | `require_ocr_quota` returns 402 `PAST_DUE` for expired subscriptions | `dependencies/quota.py` lines 97-120 |

All OCR routes (`/ocr/logbook-excel`, `/ocr/warp`, etc.) require both `require_active_subscription` and `require_ocr_quota` (ocr.py lines 3325, 3426, 3475, 3541).

**Impact**: No bypass possible through UI manipulation.

---

## 6. Data Preservation on Subscription Expiry

**Status: DATA PRESERVED, ACCESS BLOCKED**

When a subscription expires (status transitions through `past_due` → `suspended`):

| Data Type | What Happens |
|-----------|--------------|
| **Subscriptions** | Record remains; status updated to `past_due` or `suspended` |
| **OrgSubscriptionAddons** | `get_org_active_addons()` filters by `current_period_end_at >= now` (plans.py lines 470-471) |
| **Usage records** (OCR, features) | Preserved; new usage blocked |
| **Invoices** | Preserved |
| **User data** | Not touched |

Grace period: `BILLING_GRACE_DAYS` (3 days, default) between `past_due` and `suspended`. During grace, `require_ocr_quota` still allows access (dependencies/quota.py lines 103-120), but `require_active_subscription` allows it explicitly (dependencies/subscription.py lines 50-53).

### BUG-BILLING-004: Add-on Deactivation Depends on Period End Only
`get_org_active_addons` (plans.py lines 454-472) checks `current_period_end_at >= now`, but:
- If a subscription is cancelled (status changed), addons are not proactively deactivated
- If `current_period_end_at` is NULL, the addon is considered active indefinitely (checked in line 471: `not row.current_period_end_at`)

**Impact**: Medium - addon deactivation can be bypassed if `current_period_end_at` is NULL.

---

## 7. Downgrade Exploit for Feature Retention

### BUG-BILLING-005: Downgrade Enforcement Only on User Action
**High** - `billing_manager.py` lines 355-392.

`apply_due_downgrades()` is called in exactly **two** places:
1. `GET /billing/status` (billing.py line 636) - only when user visits billing page
2. On startup (main.py line 92) - once when server boots

There is **no periodic scheduler** for billing maintenance. The only scheduler in the app is `initialize_attendance_absence_scheduler()` (main.py line 105), which handles attendance, not billing.

A user who:
1. Schedules a downgrade via `POST /downgrade`
2. Never visits `GET /billing/status`
3. Avoids server restarts

...will retain higher-tier features indefinitely, even past `pending_plan_effective_at`.

**Attack scenario**:
1. User on "Business" plan schedules downgrade to "Free" at end of billing period
2. User stops hitting `/billing/status` endpoint
3. Server stays up for weeks without restart
4. User continues using paid features without paying

**Impact**: Revenue leakage.

---

## 8. Failed Payment Retry Logic

**Status: NO AUTOMATIC RETRY**

When a payment fails (`payment.failed` webhook, lines 1086-1119):
1. Order status marked `failed` (line 1092)
2. `record_payment_failure()` called for ops alerting (lines 1102-1109)
3. Downgrade scheduled to `free` with grace period (lines 1112-1117)
4. **No automatic re-charge or retry**

### BUG-BILLING-006: Failed Payment Schedules Downgrade Without Check
Lines 1111-1117:
```python
schedule_downgrade(
    db,
    user_id=user_id,
    plan=str(get_plan(None).get("id") or normalize_plan(None)),  # always "free"
    effective_at=effective_at,
)
```
This schedules a downgrade to `free` regardless of the user's current plan. If the user is on "Starter" and has a one-time payment failure, it schedules downgrade to "Free" with 3-day grace. After grace, all paid features are lost. The user must visit `/billing` and manually re-subscribe.

**Impact**: Revenue churn risk. No dunning / smart retry.

---

## 9. Rate Limiting

**Status: PROCESS-LOCAL, INEFFECTIVE IN MULTI-WORKER DEPLOYMENTS**

| Endpoint | Limit | Key Function | Worker Safety |
|----------|-------|-------------|---------------|
| `POST /orders` | 5/min | `authenticated_user_key` (user ID) | **No** - process-local deque |
| `POST /orders/{id}/sync` | 10/min | `authenticated_user_key` | **No** - process-local deque |
| `POST /webhook/razorpay` | 300/min | `webhook_ip_key` (client IP) | **No** - process-local deque |

### BUG-BILLING-007: In-Memory Rate Limiter Not Distributed
`rate_limit.py` lines 31-97. The fallback rate limiter uses a `defaultdict[deque]` in process memory:
- **N workers = N × configured limit** effective rate
- No Redis or shared backend for coordination
- Rate limit is advisory, not enforced across deployment

### BUG-BILLING-008: Memory Leak in Fallback Rate Limiter
Line 81-88: Pruning only runs every 60 seconds and only removes keys where `history[-1] >= 3600s` old. A sustained moderate rate creates unbounded key growth since keys stick around for up to 1 hour of inactivity, times the hash of all unique limit_value+key_func combinations.

**Impact**: Low - the dict is capped at 4096 keys (line 82).

---

## 10. Role Guards

**Status: CORRECTLY IMPLEMENTED**

| Endpoint | Required Role | Line |
|----------|---------------|------|
| `GET /config` | ADMIN | 615 |
| `GET /status` | ADMIN | 632 |
| `GET /invoices` | ADMIN | 708 |
| `POST /orders` | OWNER | 768 |
| `POST /orders/{id}/sync` | OWNER | 918 |
| `POST /downgrade` | OWNER | 736 |
| `DELETE /downgrade` | OWNER | 753 |
| `POST /webhook/razorpay` | None (signature-based) | 967 |

`require_role()` (rbac.py lines 27-29) uses a numeric role ranking: ATTENDANCE(0) → OWNER(6). ADMIN(5) < OWNER(6) ensures only owners can create orders.

**Verdict: Role guards are appropriate.**

---

## 11. Database Transaction Safety in Webhook Processing

**Status: FRAGILE TRANSACTION BOUNDARY**

Lines 1025-1120:
```python
transaction = db.begin() if not db.in_transaction() else nullcontext()
with transaction:
    event = WebhookEvent(...)
    db.add(event)
    db.flush()
    if _should_activate(event_type):
        ...  # _activate_paid_order which also flushes
    event.org_id = org_id
db.commit()
```

### BUG-BILLING-009: WebhookEvent and Plan Activation in Same Transaction
The `WebhookEvent` insert and the plan activation (`_activate_paid_order`) are in the **same** database transaction:
- If plan activation fails (exception), the `WebhookEvent` is also rolled back
- Razorpay will retry the webhook, and the event will be re-processed
- **Not inherently wrong** (Razorpay idempotency), but the retried webhook will re-activate the plan from scratch

**More concerning**: If `_activate_paid_order` succeeds (its own `db.flush()` at line 389) but the outer transaction encounters an IntegrityError on the `WebhookEvent` insert (line 1121), the **entire** outer rollback reverts both the event and the activation flush. This is correct behavior for rollback but means work is lost.

### BUG-BILLING-010: Nested Transaction Complexity
Line 1025: `db.begin() if not db.in_transaction() else nullcontext()` - This is a nested transaction guard, but:
- If the webhook handler is called within an existing transaction (e.g., from a test), it uses `nullcontext()` - but any `db.commit()` inside would commit the outer transaction's work too
- The explicit `db.commit()` at line 1120 could commit changes from the outer transaction unexpectedly if one exists

---

## 12. What Happens If Razorpay Order Created But DB Insert Fails

**Status: CRITICAL DATA CONSISTENCY BUG** (See BUG-BILLING-001)

The flow (lines 859-896):

```
1. client.order.create({...})       → Razorpay order created (external side effect)
2. db.add(PaymentOrder(...))         → DB INSERT attempt
3. db.commit()                        → May fail with IntegrityError
4. except IntegrityError:
       db.rollback()                  → Rolls back, but continues execution
5. return {"order": order, ...}      → Returns success to client
```

If step 3 fails (e.g., duplicate idempotency key):
- Razorpay has an order with no matching `PaymentOrder` in DB
- Webhook handler calls `_get_payment_order(order_id=order_id)` which returns `None` (line 1039)
- `was_paid` is `False` (line 1040-1044)
- Proceeds with fallback logic (lines 1047-1067) using `_fetch_order_entity()` to get plan/user from Razorpay API
- The plan may still be activated via fallback, but the `PaymentOrder` audit trail is **missing**
- The `PaymentOrder` record for the **other** request is fine

**Impact**: Missing audit trail for payment. If both requests succeed at Razorpay and the fallback activates, the user could be double-activated or have two invoices for the same transaction.

---

## 13. Subscription State Drift Handling

**Status: ONE-TIME STARTUP RECOVERY, NO CONTINUOUS ENFORCEMENT**

The startup handler (main.py lines 91-101) runs:
```python
normalized = normalize_subscription_states(db)   # Fix all status transitions
expired = enforce_expired_grace_periods(db)       # Suspend past-due subscriptions past grace
```

But there is **no periodic background scheduler** to continuously:
- Apply due downgrades
- Enforce grace period expiry
- Normalize subscription states

The only runtime call to `apply_due_downgrades` is in `GET /billing/status` (line 636).

### BUG-BILLING-011: No Cron/Scheduler for Billing Maintenance
Unlike attendance absence (which has a scheduler), billing state transitions depend on:
- Startup recovery
- User hits `/billing/status`

A server that stays up for months with inactive users will have stale subscription states.

---

## 14. Manual Sync Fallback

**Status: PROPERLY IMPLEMENTED**

`POST /orders/{order_id}/sync` (lines 909-964):
- Requires OWNER role (line 918)
- Fetches order from Razorpay API (line 930)
- Compares provider status with local status (line 934)
- Activates plan if newly paid (line 937-957)
- Handles missing notes by falling back to local `PaymentOrder` data (line 939)
- Properly catches 404 (order not found) and 502 (Razorpay unreachable)

**Verdict: No issue found. This serves as an effective fallback when webhooks are delayed.**

---

## Complete Bug Register

| ID | Severity | File | Line(s) | Description |
|----|----------|------|---------|-------------|
| **BUG-BILLING-001** | CRITICAL | `billing.py` | 888-896 | Silent data loss: IntegrityError on PaymentOrder insert is caught, rolled back, but execution continues returning success. Razorpay order created without DB record. |
| **BUG-BILLING-002** | MEDIUM | `billing.py` | 811-814 | Idempotency key includes date, allowing same-day duplicates but preventing cross-day dedup. Documented behavior but could surprise. |
| **BUG-BILLING-003** | CRITICAL | `billing_manager.py` | 129-147 | Trial expiry never enforced. `get_effective_subscription_status()` returns `"trialing"` without checking `trial_end_at`. Users with expired trials retain paid feature access indefinitely. |
| **BUG-BILLING-004** | MEDIUM | `plans.py` | 454-472 | Addon deactivation only checks `current_period_end_at >= now`. If `current_period_end_at` is NULL, addons remain active regardless of subscription state. |
| **BUG-BILLING-005** | HIGH | `billing_manager.py` | 355-392 | `apply_due_downgrades()` only called at startup and on `GET /billing/status`. No periodic scheduler. Users can evade downgrades by not visiting billing page. |
| **BUG-BILLING-006** | MEDIUM | `billing.py` | 1111-1117 | Failed payment unconditionally schedules downgrade to `free` with no retry/dunning logic. Single payment failure = lost revenue. |
| **BUG-BILLING-007** | MEDIUM | `rate_limit.py` | 31-97 | In-memory rate limiter is process-local. In multi-worker deployments, effective limit = N × configured limit. No shared backend. |
| **BUG-BILLING-008** | LOW | `rate_limit.py` | 81-88 | Fallback rate limiter pruning may leave stale keys for up to 1 hour. Minor memory concern. |
| **BUG-BILLING-009** | MEDIUM | `billing.py` | 1025-1120 | WebhookEvent and plan activation in same transaction. Failure in either rolls back both. Webhook retry will re-process from scratch. |
| **BUG-BILLING-010** | LOW | `billing.py` | 1025 | Nested transaction guard (`nullcontext()`) means if webhook runs inside existing transaction, `db.commit()` affects outer scope. |
| **BUG-BILLING-011** | HIGH | `main.py` | 91-101 | Billing maintenance runs only at startup and via `GET /billing/status`. No periodic scheduler for `normalize_subscription_states`, `enforce_expired_grace_periods`, or `apply_due_downgrades`. |
| **BUG-BILLING-012** | LOW | `billing.py` | 270-275 | `_resolve_period_end()` calculates from `datetime.now()`, not from actual period start. Should use `current_period_end_at` as baseline. |
| **BUG-BILLING-013** | LOW | `billing.py` | 457-477 | `_ensure_trial()` creates new subscription without checking for existing stale/cancelled ones. Could create duplicate subscriptions per org. |
| **BUG-BILLING-014** | LOW | `billing.py` | 131-133 | `_extract_addon_quantities` silently ignores JSON parse errors. No logging. |
| **BUG-BILLING-015** | MEDIUM | `billing.py` | 502-600 | `_resolve_checkout_quote` only checks user/factory caps if `plan_has_hard_caps()` is True. If disabled, over-limit selections pass through. |
| **BUG-BILLING-016** | LOW | `billing.py` | 355-389 | Invoice creation uses `db.flush()` inside the webhook transaction. If outer transaction rolls back, invoice creation is lost with no recovery. |
| **BUG-BILLING-017** | LOW | `billing.py` | 177-181 | Receipt parsing regex `^dpr_(\d+)_` is fragile. If receipt format changes, user extraction fails silently. |

---

## Summary of Architectural Risks

1. **No periodic billing scheduler**: All subscription state transitions (downgrades, grace expiry, trial expiry) depend on user-triggered endpoints or server restarts. This is the single biggest architectural weakness.

2. **Distributed rate limiting absent**: In-memory rate limiter means multi-worker deployments have no effective rate control on order creation or webhook processing.

3. **Trial lifecycle incomplete**: The state machine handles `active` → `past_due` → `suspended` but has no `trialing` → `expired` transition. Trial expiry is a no-op.

4. **Transaction boundaries in webhook**: Commingling event dedup, plan activation, and invoice creation in one transaction creates a single rollback point for all operations.

5. **No payment retry mechanism**: A single payment failure triggers downgrade with no retry or dunning flow.