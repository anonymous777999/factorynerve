🔍 DPR.ai Billing & Subscription — Comprehensive Dual-Perspective Audit
Executive Summary
The billing system has two parallel webhook implementations — one in billing.py (the "router handler") and one in lifecycle.py (the "lifecycle handler"). This is the single most critical architectural issue. Beyond that, there are hardcoded values, missing transaction boundaries, race conditions, and UX gaps that affect both developer maintainability and customer experience.

🔴 CRITICAL ISSUES (Developer Perspective)
1. DUPLICATE WEBHOOK HANDLING — Two Competing Implementations
Files: billing.py (lines ~970-1135) vs lifecycle.py (handle_razorpay_webhook)

The router has a full webhook handler at POST /webhook/razorpay that:

Uses razorpay.Utility.verify_webhook_signature() directly
Queries WebhookEvent by provider + event_id composite
Has its own _should_activate(), _should_downgrade(), _activate_paid_order(), _mark_payment_order_status() helpers
Uses db.begin() / db.commit() / db.rollback() manually
The lifecycle module has handle_razorpay_webhook() that:

Uses provider.verify_webhook_signature() via the adapter
Queries WebhookEvent by razorpay_event_id only
Delegates to process_webhook_event() → process_payment_captured() etc.
Uses with db.begin(): context manager
Fetches payment details from Razorpay via provider.fetch_payment() before processing
These are NOT the same code path. Which one is actually registered on the route? If both are somehow active, webhooks could be processed twice. If only one is active, the other is dead code that will confuse future developers.

Risk: Double-processing payments, inconsistent state, maintenance nightmare.

2. Hardcoded plan="free" in create_paid_invoice()
File: lifecycle.py, line ~120


Every paid invoice is recorded with plan="free". This means:

Invoice history will show every payment as "free" plan
Revenue reporting by plan is impossible
Customer sees "free" on their paid invoice — confusing and unprofessional
Audit/compliance issues
Fix: Pass the actual plan_id as a parameter.

3. _resolve_subscription() Auto-Creates Inactive Subscriptions
File: lifecycle.py, lines ~175-180


This is called by process_payment_failed, process_subscription_halted, and process_subscription_cancelled. If a webhook arrives for an org that has no subscription record (e.g., a stray/malformed webhook, or an org that was deleted), a new inactive subscription is silently created. This could:

Create orphan subscription records
Re-activate billing for orgs that should have none
Cause confusion in subscription counts/metrics
4. process_payment_failed Hardcodes 7-Day Grace Period
File: lifecycle.py, line ~225


The router handler uses BILLING_GRACE_DAYS env var. The lifecycle handler hardcodes 7 days. Inconsistent grace period logic.

5. process_subscription_halted and process_subscription_cancelled Don't Update PaymentOrder Status
File: lifecycle.py

process_payment_captured sets order.status = "paid". process_payment_failed sets order.status = "failed". But process_subscription_halted and process_subscription_cancelled do NOT update the order status at all. The order stays in its previous state (likely "pending"), which is semantically wrong.

6. create_payment_order Has Duplicate Fields
File: lifecycle.py, lines ~75-90


This suggests the PaymentOrder model has redundant/legacy columns alongside newer ones. This is confusing and wastes storage.

7. RazorpayPaymentAdapter.create_order Has a Retry Loop Bug
File: razorpay_adapter.py, lines ~45-60


But self._sdk_client.order.create uses the razorpay SDK which makes HTTP calls via the requests library, NOT httpx. So httpx.HTTPStatusError will NEVER be raised by the SDK call. The retry logic is effectively dead — it will never catch HTTP errors from the razorpay SDK.

8. Mixed Sync/Async HTTP Clients
File: razorpay_adapter.py

create_order uses razorpay.Client (sync, via asyncio.to_thread)
fetch_payment uses httpx.AsyncClient (native async)
cancel_subscription uses razorpay.Client (sync, via asyncio.to_thread)
Two different HTTP libraries for the same API. The razorpay SDK uses requests under the hood; httpx is a separate stack. This means:

Two separate connection pools
Different error types (requests.HTTPError vs httpx.HTTPStatusError)
Different timeout/retry behavior
The transport parameter only works for httpx calls, not SDK calls
9. BillingSettings Validator Checks WHATSAPP_PROVIDER_MODE
File: settings.py, lines ~35-45


This is confusing — why does a billing settings validator check a WhatsApp environment variable? This seems like a copy-paste error or misplaced concern. The billing system should not depend on WhatsApp configuration.

10. No Webhook Event Type Whitelist Validation
Neither webhook handler validates that the incoming event field is from a known set. The lifecycle handler silently skips unknown events (returns "skipped"). The router handler only checks _should_activate() / _should_downgrade(). A malicious or misconfigured webhook sender could flood the system with arbitrary event types that get persisted to WebhookEvent but never processed.

🟡 MEDIUM ISSUES (Developer Perspective)
11. PaymentOrder Model Has Redundant Columns
Based on the create_payment_order code, the model has both plan_id/plan, amount_paise/amount, razorpay_order_id/provider_order_id, receipt_id/receipt. This suggests incomplete migration from legacy column names.

12. _billing_cycle_from_notes Checks Three Entities But Returns Early
File: lifecycle.py, lines ~155-162

It checks order entity → payment entity → subscription entity for billing_cycle in notes. But if the order entity has no notes, it falls through to payment entity, etc. This is fragile — the billing cycle should be stored on the PaymentOrder record at creation time, not reverse-engineered from webhook notes.

13. next_invoice_number Uses COUNT(*) — Race Condition
File: lifecycle.py, lines ~100-102


Two concurrent invoice creations for the same org will get the same invoice number. This should use a database sequence or SELECT ... FOR UPDATE.

14. handle_razorpay_webhook Commits Twice
File: lifecycle.py

First commit: inside with db.begin(): (auto-commit at end of context manager). Second commit: db.commit() after updating duration_ms on the persisted event. This means the webhook event row is committed in two separate transactions — if the second commit fails, the event is persisted but without duration_ms.

15. Router Webhook Handler Uses nullcontext() for Nested Transactions
File: billing.py, line ~1025


This is fragile. If S