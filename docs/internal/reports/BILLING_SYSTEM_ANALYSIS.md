# DPR.ai Billing System: Architectural Analysis & Security Audit

## ════════════════════════════════════════════════════════════════
## SECTION 1 — EXISTING ARCHITECTURE INSPECTION
## ════════════════════════════════════════════════════════════════

### 1.1 FRONTEND FRAMEWORK
*   **Framework:** Multi-Page Application (MPA) / Static HTML approach. Frontend code resides in `frontend/pages` and `frontend/static`.
*   **Payment Logic:** `dpr_ai_design_system.html` and `backend/middleware/security.py` suggest Razorpay Checkout is used via the standard `checkout.razorpay.com` script. No heavy payment logic was found in the JS bundles beyond standard integration.
*   **Relevance:** The frontend is a thin layer. This is safe, provided all state changes are backend-driven.

### 1.2 BACKEND FRAMEWORK
*   **Framework:** FastAPI 0.3.0 (scaffolded version), Python 3.11+. Async-first.
*   **Logic Layer:** Partial service layer exists (`backend/services/billing_manager.py`). However, `backend/routers/billing.py` is bloated (962 lines) and contains significant business logic that should be moved to services.
*   **Background Tasks:** Handled via `backend/services/background_jobs.py`. Webhooks currently process in-thread which is a performance risk.

### 1.3 AUTHENTICATION SYSTEM
*   **Type:** JWT-based auth (`python-jose`) with optional secure cookie storage.
*   **Multi-tenancy:** Aware of `org_id`. JWT payloads and the `User` model both carry `org_id`.
*   **Enforcement:** `backend/rbac.py` provides rank-based role checking (`require_role`).
*   **Risk:** `subscriptions` table is currently linked to `user_id` instead of `org_id`, creating a mismatch with the multi-tenant `Organization` model.

### 1.4 DATABASE STRUCTURE
*   **ORM:** SQLAlchemy 2.0 style (Mapped/mapped_column).
*   **Models:** `Organization`, `Factory`, `User`, `Subscription`, `Invoice`, `PaymentOrder`, `WebhookEvent`, `OrgSubscriptionAddon`.
*   **Missing Fields:** `Subscription` lacks `org_id`. `Organization` has redundant `plan` and `plan_expires_at` fields.
*   **Migrations:** Alembic is used. Clean and versioned in `alembic/versions`.

### 1.5 API STRUCTURE
*   **Versioning:** No explicit versioning (e.g., `/v1/`).
*   **Middleware:** Strong middleware layer for Security, CSRF, and Response Enveloping.
*   **Validation:** Pydantic schemas are used extensively.

### 1.6 ENVIRONMENT VARIABLE HANDLING
*   **Management:** `AppConfig` class in `backend/utils.py` with `lru_cache`. Uses `python-dotenv`.
*   **Secrets:** `redact_secrets` utility exists and is used in logging. RAZORPAY_KEY_ID/SECRET are expected in `.env`.

### 1.7 MULTI-TENANT MODEL
*   **Hierarchy:** `Organization` (Tenant) -> `Factory` (Site) -> `User` (Member).
*   **Isolation:** `backend/tenancy.py` resolves `org_id`. Most models include `org_id`.
*   **Risk:** Billing isolation is currently tied to the user who created the order (`user_id` in `Subscription`), which breaks if that user leaves the organization.

### 1.8 FILE UPLOAD / OCR PIPELINE
*   **Validation:** Size limits (8MB) and file types are validated.
*   **Quota Check:** `backend/ocr_limits.py` performs atomic quota checks via `check_and_record_org_usage`.
*   **Bypass Risk:** OCR routes are protected by `get_current_user` and `require_any_role`, but the quota check is called manually inside the route rather than via a global dependency.

### 1.9 DEPLOYMENT ARCHITECTURE
*   **Target:** Render (Docker-based).
*   **Webhooks:** Publicly reachable. Signature verification is implemented.
*   **Supervisor:** Render manages the container lifecycle. In-flight webhooks on restart are not currently persisted beyond the standard `WebhookEvent` audit log.

## ════════════════════════════════════════════════════════════════
## SECTION 2 — SECURITY RISK AUDIT
## ════════════════════════════════════════════════════════════════

*   **□ Frontend-trusted payment success:** **PASS**
    *   `billing.py` uses `sync_order_status` which calls the Razorpay API server-side to verify status. No client-side success signal is trusted.
*   **□ Order amount set by client:** **PASS**
    *   `create_order` calculates `amount_paise` server-side in `_resolve_checkout_quote` using `PLAN_CATALOG`.
*   **□ Missing webhook signature verification:** **PASS**
    *   `razorpay_webhook` uses `razorpay.Utility.verify_webhook_signature`.
*   **□ Webhook replay vulnerability:** **PASS**
    *   `_resolve_event_id` generates a unique ID, and the handler checks `WebhookEvent` table for duplicates.
*   **□ Exposed Razorpay credentials:** **PASS**
    *   Secrets are redacted in logs and not present in `render.yaml` or frontend.
*   **□ Subscription enforcement gaps:** **FAIL**
    *   The duality of `UserPlan` and `Organization.plan` creates a risk where one might be updated but the other isn't, leading to inconsistent enforcement.
*   **□ Missing rate limiting on payment endpoints:** **FAIL**
    *   `/billing/orders` lacks specific rate limiting in `security.py`. An attacker could spam order creation.
*   **□ Quota bypass via direct API call:** **PASS**
    *   Quota check is performed inside the `ocr.py` route handlers server-side.
*   **□ Role validation on billing routes:** **PASS**
    *   `require_role(current_user, UserRole.OWNER)` is used for sensitive billing operations.
*   **□ Insecure OCR upload flow:** **PASS**
    *   Size limits and auth are strictly enforced.
*   **□ Missing idempotency on order creation:** **PASS**
    *   `PaymentOrder` uses an `idempotency_key` (SHA256 of payload).
*   **□ PII / financial data in logs:** **PASS**
    *   `redact_secrets` prevents leakage.

## ════════════════════════════════════════════════════════════════
## SECTION 3 — PAYMENT ARCHITECTURE DESIGN
## ════════════════════════════════════════════════════════════════

### 3.1 PLAN STRUCTURE
*   **Definition:** `PLAN_CATALOG` in `backend/plans.py` (justify: allows for rapid iteration and type safety without DB overhead for static pricing).
*   **Dimensions:** Monthly/Annual prices, OCR limits, Factory/User limits, and Feature Flags.
*   **Proration:** immediate upgrade (charge full, or calculate difference), end-of-cycle downgrade.

### 3.2 SUBSCRIPTION LIFECYCLE
*   **TRIALING:** 7 days, limited OCR (0 by default, requires pack).
*   **ACTIVE:** Full access.
*   **PAST_DUE:** 3-day grace period. Read access only.
*   **SUSPENDED:** No OCR, no analytics.
*   **CANCELLED:** Locked.

### 3.3 QUOTA AND USAGE TRACKING
*   **Storage:** `OrgOcrUsage` table.
*   **Decrement:** At OCR job start (atomic `UPDATE ... WHERE used < limit`).
*   **Reset:** 1st of every month (via `_period_now()`).

### 3.4 FACTORY-BASED BILLING MODEL
*   **Scope:** Billing is **Per-Organization**. All factories in an org share the plan and quota pool.
*   **Admin:** Only `UserRole.OWNER` can modify billing.

### 3.5 INVOICE AND PAYMENT HISTORY
*   **Trigger:** `payment.captured` or `order.paid` webhook.
*   **Immutability:** Invoices are read-only once status is `paid`.

### 3.6 FAILED PAYMENT HANDLING
*   **Trigger:** `payment.failed` webhook.
*   **Notification:** Ops alert triggered to system admins. Grace period starts.

### 3.7 UPGRADE AND DOWNGRADE PATHS
*   **Upgrade:** New quota grants immediately on payment.
*   **Downgrade:** `pending_plan` set, applied at `current_period_end_at`.

## ════════════════════════════════════════════════════════════════
## SECTION 4 — DATABASE SCHEMA DESIGN
## ════════════════════════════════════════════════════════════════

*   **PLANS:** (Static in `plans.py`, no change needed).
*   **SUBSCRIPTIONS (REFACTORED):** Tie to `org_id`. Remove `user_id`. Add `billing_email`.
*   **SUBSCRIPTION_QUOTA:** Already exists as `OrgOcrUsage`.
*   **PAYMENT_EVENTS:** Already exists as `WebhookEvent`.
*   **INVOICES:** Add `org_id` and `tax_amount`.
*   **PLAN_CHANGES:** (New table) Audit trail for transitions.

## ════════════════════════════════════════════════════════════════
## SECTION 5 — RAZORPAY INTEGRATION ARCHITECTURE
## ════════════════════════════════════════════════════════════════

### 5.1 ADAPTER INTERFACE
`AbstractPaymentProvider` (Protocol) to allow switching to Stripe/Paddle.
Methods: `create_order`, `verify_signature`, `cancel_subscription`, `get_payment_details`.

### 5.2 RAZORPAY ADAPTER
Implementation using `razorpay` Python SDK.

### 5.3 ORDER CREATION FLOW
1. POST `/billing/orders`
2. Server calculates price from `PLAN_CATALOG`.
3. Create Razorpay Order.
4. Save `PaymentOrder`.
5. Return `order_id` to frontend.

### 5.4 WEBHOOK PIPELINE
*   Verified via HMAC-SHA256.
*   Idempotency checked via `WebhookEvent`.
*   Transaction-wrapped status updates.

### 5.5 SERVER-SIDE VERIFICATION
`POST /billing/verify-payment` acts as a "speed-up" for the UI while the webhook remains the Source of Truth.

## ════════════════════════════════════════════════════════════════
## SECTION 6 — QUOTA ENFORCEMENT ARCHITECTURE
## ════════════════════════════════════════════════════════════════

### 6.1 MIDDLEWARE
FastAPI dependency `require_quota(feature="ocr")` applied to OCR routes.

### 6.2 ATOMIC DECREMENT
`UPDATE org_ocr_usage SET request_count = request_count + 1 WHERE org_id = :oid AND request_count < :limit`.

### 6.4 GRACE PERIOD
Detected by `Subscription.status == 'past_due'`. Middleware blocks write ops.

## ════════════════════════════════════════════════════════════════
## SECTION 7 — ABUSE PREVENTION DESIGN
## ════════════════════════════════════════════════════════════════

*   **Webhook Replay:** `WebhookEvent.event_id` unique constraint.
*   **Amount Manipulation:** Server-side price resolution.
*   **Rate Limiting:** `SlowAPI` or middleware limits on `/billing/orders` (5/min).

## ════════════════════════════════════════════════════════════════
## SECTION 8 — TECHNICAL DEBT AND PREREQUISITES
## ════════════════════════════════════════════════════════════════

*   **8.1 Org-scoped Subscriptions:** **MUST FIX**. Move subscription logic from `user_id` to `org_id`.
*   **8.2 Service Layer Refactor:** **MUST FIX**. Move logic from `billing.py` to `billing_manager.py`.
*   **8.5 Background Processing:** **DEFER**. In-thread webhook processing is acceptable for <1000 events/day.

## ════════════════════════════════════════════════════════════════
## SECTION 9 — IMPLEMENTATION ROADMAP
## ════════════════════════════════════════════════════════════════

*   **PHASE 0:** Refactor `Subscription` model to link to `org_id`.
*   **PHASE 1:** Implement `AbstractPaymentProvider` and `RazorpayAdapter`.
*   **PHASE 2:** Migrate `/billing/orders` to use the new adapter.
*   **PHASE 3:** Global `require_quota` dependency for OCR routes.
*   **PHASE 4:** Hardening and Rate Limiting.

## ════════════════════════════════════════════════════════════════
## SECTION 10 — RISK REGISTER
## ════════════════════════════════════════════════════════════════

| Risk | Severity | Likelihood | Impact | Mitigation |
| :--- | :--- | :--- | :--- | :--- |
| User-scoped Billing | P0 | High | Subscription lost if user deleted | Refactor to `org_id` |
| Billing Spam | P1 | Medium | API Rate limits hit | Add 5/min rate limit |
| Signature Bypass | P0 | Low | Fake payments | Strict HMAC verification |

## ════════════════════════════════════════════════════════════════
## SECTION 11 — RECOMMENDED DB SCHEMA
## ════════════════════════════════════════════════════════════════

```python
class Subscription(Base):
    __tablename__ = "subscriptions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    org_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.org_id"), unique=True)
    plan: Mapped[str] = mapped_column(String(32), default="free")
    status: Mapped[str] = mapped_column(String(24), default="active") # active, past_due, suspended
    current_period_end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
```

## ════════════════════════════════════════════════════════════════
## SECTION 12 — IMPLEMENTATION START POINT
## ════════════════════════════════════════════════════════════════

**First Task:** Refactor `backend/models/subscription.py` to replace `user_id` with `org_id` and update `billing_manager.py` to match.
**First Test:** `tests/test_billing_models.py` to verify an organization can hold a subscription and it survives user deletion.
