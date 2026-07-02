# DPR.ai Platform Consistency & Workflow Audit Report

## PHASE 0 — REPO MAP (MANDATORY FIRST)

### backend/routers/
admin_ai.py
admin_billing.py
ai.py
alert_recipients.py
alerts.py
analytics.py
attendance.py
auth_google.py
auth_secure.py
auth.py
billing.py
emails.py
entries.py
feedback.py
intelligence.py
jobs.py
observability.py
ocr.py
phone_auth.py
plans.py
premium.py
reports.py
settings.py
steel.py
whatsapp_webhook.py

### backend/services/
ai_router.py
anthropic_usage.py
attendance_absence_service.py
background_jobs.py
billing_logger.py
billing_manager.py
email_service.py
intelligence_service.py
ops_alerts_dispatcher.py
password_reset_service.py
plan_resolver.py
registration_service.py
sms_service.py
steel_service.py
token_service.py
user_code_service.py
user_service.py
whatsapp_sender.py

### backend/dependencies/
quota.py
subscription.py

### backend/models/
admin_alert_recipient.py
ai_result_cache.py
ai_usage_log.py
alert.py
attendance_event.py
... (truncated)

### backend/middleware/
csrf_cookie.py
rate_limit_middleware.py
rate_limit.py
response_envelope.py
security.py

### backend/utils/
NOT FOUND (backend/utils.py exists as a file)

### web/src/lib/
access-reason.ts
ai.ts
analytics.ts
api.ts
attendance.ts
auth.ts
billing.ts
... (truncated)

### web/src/context/
NOT FOUND

---

## PHASE 1 — FULL REPO GREP SCAN

S1: `services\plan_resolver.py:L27: if organization and organization.plan:`
S2: `services\billing_manager.py:L122: sub.status = "past_due"`, `services\plan_resolver.py:L18: Subscription.status.in_(("active", "trialing"))`
S3: `routers\billing.py:L351: ocr_limit=int(plan_limit(plan, "ocr") or 0)`
S4: `models\organization.py:L21: plan: Mapped[str] = mapped_column(String(20), nullable=False, default="free")`
S5: `routers\auth.py:L949: token_payload = decode_access_token(token)`
S6: `routers\entries.py:L198: db.add(`, `routers\entries.py:L224: db.commit()`
S7: `routers\attendance.py:L828: raise HTTPException(status_code=409, detail="Attendance is already closed for today.")`
S8: `plans.py:L47: DEFAULT_PLAN = normalize_plan(os.getenv("OCR_DEFAULT_PLAN") or "free")`
S9: `services\ai_router.py:L355: client = anthropic.Anthropic(api_key=api_key, timeout=config.timeout_seconds)`
S10: NOT FOUND
S11: `web/src/app/entry/page.tsx:L376: window.addEventListener("online", onOnline);`
S12: `routers\entries.py:L751: items = query...offset(offset).limit(page_size).all()`
S13: `web/src/lib/auth.ts:L177: window.location.assign(...)`, `web/src/lib/api.ts:L347: await bootstrapCsrfCookie(timeoutMs)`

---

## PHASE 2 — DOMAIN AUDIT

### D1. AUTH & SESSION
[🔴 CRITICAL] AUTH | backend/routers/auth.py:L949 | Manual token decoding in routers instead of using get_current_user dependency | Bypass of centralized token revocation/blacklist logic
[🟡 MEDIUM] AUTH | backend/security.py:L114 | active_factory_id set from token without re-verifying current membership status on every request | Access to factories after membership revocation until token expiry
[🔵 LOW] AUTH | web/src/lib/auth.ts:L177 | Hardcoded window.location.assign for role revision redirects | Disruption of SPA state during permissions updates

### D2. BILLING & SUBSCRIPTIONS
[🔴 CRITICAL] BILLING | backend/services/plan_resolver.py:L27 | get_effective_plan falls back to organization.plan field if no active subscription found | Organization table is a secondary, potentially stale source of truth
[🔴 CRITICAL] BILLING | backend/ocr_limits.py:L65 | Local defaults dict in ocr_limits.py overrides PLAN_CATALOG for rate limits | Fragmented quota configuration management
[🟡 MEDIUM] BILLING | backend/routers/billing.py:L1112 | Hardcoded plan="free" during scheduled downgrades | Inflexible downgrade workflows bypassing plan catalog
[🔵 LOW] BILLING | backend/dependencies/subscription.py:L42 | Dependency normalization side-effect: commits the database transaction | Unexpected DB commit behavior in read-only dependency chains

### D3. AI SYSTEMS & OCR
[🔴 CRITICAL] AI | backend/services/ai_router.py:L355 | Inconsistent timeout configurations (25s vs 10s vs 8s) across AI providers and service layers | Unpredictable request termination and high latency sensitivity
[🔴 CRITICAL] OCR | backend/routers/ocr.py:L2123 | Fragmented commits: multiple db.commit() calls within single OCR request pipeline | High risk of partial data integrity failures on mid-request crashes
[🟡 MEDIUM] AI | backend/feature_limits.py:L75 | Usage increment validation and DB update performed in separate steps | Race condition risk in high-concurrency AI usage scenarios

### D4. API CONTRACT CONSISTENCY
[🔴 CRITICAL] CONTRACT | backend/middleware/response_envelope.py:L37 | Error envelope masks original router error detail with generic "Request failed." if payload structure differs | Loss of frontend error-handling granularity
[🟡 MEDIUM] CONTRACT | backend/routers/entries.py:L752 | Inconsistent pagination response envelope (EntryListResponse vs raw lists in feedback.py) | Frontend hydration complexity and inconsistent UI state management
[🔵 LOW] CONTRACT | backend/routers/attendance.py:L1192 | 422 Unprocessable Entity used for business rule violations instead of 400 Bad Request | Inconsistent HTTP status code semantics

### D5. FRONTEND-BACKEND CONTINUITY
[🔴 CRITICAL] CONTINUITY | web/src/lib/api.ts:L347 | CSRF bootstrap logic triggers implicit /auth/context calls during non-safe method initialization | Hidden network latency and race conditions during early app initialization
[🟡 MEDIUM] CONTINUITY | web/src/lib/auth.ts:L220 | login() flow performs redundant getMe() call after successful login response | Unnecessary network overhead on critical path
[🔵 LOW] CONTINUITY | web/src/lib/auth.ts:L157 | Global role revision handler forces full page reload | Loss of application state for active users

### D6. DATA INTEGRITY & WORKFLOWS
[🔴 CRITICAL] INTEGRITY | backend/routers/*.py | 181 instances of direct db.add/db.commit in router files | Massive business logic leakage into transport layer; bypassing service validation
[🟡 MEDIUM] WORKFLOW | backend/routers/entries.py:L651 | Database error catch-all returns 500 but claims "Entry saved locally" without verifiable persistence | False data safety promise to end users
[🔵 LOW] INTEGRITY | backend/utils.py:L575 | check_entry_alerts calculates severity in backend utils instead of service layer | Business logic fragmentation

---

## PHASE 3 — FINAL AUDIT REPORT

### R1. CRITICAL FINDINGS
backend/routers/auth.py:L949 | Manual token decoding | Bypass of centralized security controls
backend/services/plan_resolver.py:L27 | Fragmented plan source-of-truth | Risk of stale organization entitlements
backend/routers/*.py | 181 direct DB writes in routers | Impossible to maintain data integrity across domains
backend/middleware/response_envelope.py:L37 | Error detail masking | Frontend cannot accurately report backend failures
backend/ocr_limits.py:L65 | Shadow quota configuration | Inconsistent billing vs enforcement logic

### R2. SOURCE-OF-TRUTH CONFLICTS
*   **Active plan**: Reads from `Organization.plan` (services/plan_resolver.py:L27), `Subscription.plan` (services/plan_resolver.py:L23), and `UserPlan.plan` (plans.py:L430). Canonical should be `Subscription` only.
*   **Subscription status**: Canonical is `Subscription.status`. Fragmented reads in `billing_manager.py` and `plan_resolver.py`.
*   **AI quota remaining**: Reads from `OrgFeatureUsage` (feature_limits.py:L142) and `FeatureUsage` (feature_limits.py:L113). Conflicting logic for individual vs org-level capping.
*   **OCR quota remaining**: Shadow config in `ocr_limits.py:L65` conflicts with `PLAN_CATALOG` in `plans.py`.

### R3. BROKEN WORKFLOW CHAINS
*   **subscription → billing** | direct plan hardcoding | backend/routers/billing.py:L1112 | Downgrade logic ignores plan catalog constraints.
*   **auth → org switching** | stale factory ID | backend/security.py:L114 | Token-based factory IDs not re-validated against current DB state.
*   **quota → entitlement** | shadow limits | backend/ocr_limits.py:L65 | OCR enforcement uses hardcoded dict instead of dynamic billing state.
*   **frontend navigation → hydration** | CSRF bootstrap race | web/src/lib/api.ts:L347 | Initial POST calls may fail or hang while waiting for implicit CSRF context.

### R4. API CONTRACT INCONSISTENCIES
#### Sub-table 1: ERROR SHAPES
FILE | format | example
--- | --- | ---
attendance.py | string | `{"detail": "Select a factory..."}`
alert_recipients.py | dict | `{"detail": {"code": "ERR", "message": "..."}}`
ocr.py | dict | `{"detail": {"error": "ocr_pack_required", ...}}`

#### Sub-table 2: PAGINATION STYLES
FILE | pagination style
--- | --- | ---
entries.py | Wrapped: `{"items": [], "total": 10, "page": 1, ...}`
feedback.py | Raw List: `[]`
observability.py | Raw List: `[]`

### R5. FRONTEND REDESIGN BLOCKERS
backend/middleware/response_envelope.py:L37 | Error detail masking | New frontend UI will show generic "Request failed" for specific 429/402 quota errors.
web/src/lib/api.ts:L347 | Unstable hydration (CSRF race) | New interactive UI components will experience nondeterministic initialization failures.
backend/routers/*.py | Business logic in routers | Refactoring frontend routes will require untangling complex DB logic embedded in API handlers.

### R6. STABILIZATION ROADMAP
PRIORITY | FIX AREA | FILES | EFFORT | BLOCKS WHAT
--- | --- | --- | --- | ---
CRITICAL | Service Layer Extraction | backend/routers/*.py | HIGH | Data integrity & testing
CRITICAL | Error Envelope Fix | backend/middleware/response_envelope.py | LOW | Frontend UI error reporting
HIGH | Unified Plan Resolver | backend/services/plan_resolver.py | MEDIUM | Billing consistency
HIGH | Centralized Quota Config | backend/ocr_limits.py, backend/plans.py | MEDIUM | Quota enforcement
MEDIUM | Token Validation Cleanup | backend/routers/auth.py | LOW | Security audit
MEDIUM | API Contract Normalization | backend/routers/*.py | MEDIUM | Frontend hydration
LOW | Redundant Network Calls | web/src/lib/auth.ts | LOW | Performance

### R7. SAFE TO IGNORE (FOR NOW)
DPR alert severity calculation in backend/utils.py.
Global role revision reloads.
Hardcoded fallback plans in DB defaults.
Duplicate industry type metadata.
Manual plan overrides for superadmins.
