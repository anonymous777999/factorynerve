# 🏗️ DPR.ai / FactoryNerve — Full-Scale SaaS Architecture Audit & Blueprint

**Role:** Principal Solutions Architect & Lead Full-Stack Engineer  
**Date:** 2026-06-17  
**Version:** 1.0

---

## Table of Contents

1. [Phase 1: Global System Architecture](#phase-1-global-system-architecture)
2. [Workflow 1: Auth & Onboarding](#workflow-1-auth--onboarding)
3. [Workflow 2: Auth-Gated Billing](#workflow-2-auth-gated-billing)
4. [Workflow 3: OCR/Data Ingestion Pipeline](#workflow-3-ocrdata-ingestion-pipeline)
5. [Workflow 4: Data Export & Management](#workflow-4-data-export--management)
6. [Workflow 5: User Access Control & RBAC](#workflow-5-user-access-control--rbac)
7. [Workflow 6: Steel Production & Inventory](#workflow-6-steel-production--inventory)
8. [Workflow 7: Attendance Management](#workflow-7-attendance-management)
9. [Workflow 8: Alerts & Notifications](#workflow-8-alerts--notifications)
10. [Workflow 9: Feedback & Anomaly Detection](#workflow-9-feedback--anomaly-detection)
11. [Workflow 10: Email Communications](#workflow-10-email-communications)
12. [Phase 2: Architectural Gaps & Systematic Recommendations](#phase-2-architectural-gaps--systematic-recommendations)

---

## Phase 1: Global System Architecture

### 1.1 Tech Stack Overview

| Layer | Technology | Version |
|-------|-----------|---------|
| **Frontend Framework** | Next.js | 16.2.1 |
| **UI Library** | React | 19.2.4 |
| **Styling** | Tailwind CSS | 4.2.4 |
| **Language (FE)** | TypeScript | 5.9.3 |
| **Backend Framework** | FastAPI (Python) | latest |
| **Database** | PostgreSQL (prod) / SQLite (dev) | — |
| **ORM** | SQLAlchemy 2.0 | latest |
| **Migrations** | Alembic + auto-drift-repair on startup | — |
| **Auth** | JWT (HS256) + bcrypt + Google OAuth + Phone OTP | — |
| **Payments** | Razorpay | — |
| **AI Providers** | Groq / Anthropic / Gemini / OpenAI | — |
| **OCR** | Tesseract (local) + Anthropic Claude | — |
| **Email** | SMTP via Resend | — |
| **WhatsApp** | Meta Cloud API | — |
| **Deployment (FE)** | Vercel | — |
| **Deployment (BE)** | Render (Docker) | — |
| **Container** | Docker (Python 3.12-slim) | — |

### 1.2 Directory Architecture

```
/
├── backend/                    # FastAPI Python backend
│   ├── main.py                 # App entrypoint, router registration, lifespan
│   ├── database.py             # Engine, session, init_db(), drift repair
│   ├── security.py             # JWT create/decode, bcrypt, get_current_user
│   ├── auth_cookies.py         # Cookie-based JWT extraction
│   ├── authorization.py        # PDP (Policy Decision Point)
│   ├── tenancy.py              # Org/factory tenancy resolution
│   ├── utils.py                # Config, logging setup
│   ├── metrics.py              # Prometheus-style request metrics
│   ├── plans.py                # Subscription plan definitions
│   ├── models/                 # SQLAlchemy ORM models (~50 tables)
│   ├── routers/                # API route handlers (~25 routers)
│   ├── services/               # Business logic layer
│   ├── middleware/             # Security, CSRF, response envelope
│   ├── ai/                     # AI provider abstractions, pipelines
│   └── factory_profiles.py     # Factory industry profiles
├── web/                        # Next.js frontend
│   ├── src/
│   │   ├── app/                # Next.js App Router pages
│   │   │   ├── (public)/       # Public routes (login, register, etc.)
│   │   │   ├── (private)/      # Authenticated routes
│   │   │   ├── (workflow)/     # Workflow routes (steel, ocr, attendance)
│   │   │   └── (system)/       # System routes (403, etc.)
│   │   ├── components/         # React components
│   │   │   ├── auth/           # Auth-related components
│   │   │   ├── layout/         # App shell, providers
│   │   │   ├── private/        # Private/dashboard components
│   │   │   ├── public/         # Public page components
│   │   │   ├── shared/         # Shared components (error boundary, etc.)
│   │   │   ├── ui/             # Design system primitives
│   │   │   ├── workflow/       # Workflow-specific components
│   │   │   └── ocr/            # OCR-specific components
│   │   ├── lib/                # Utility libraries
│   │   ├── hooks/              # Custom React hooks
│   │   └── middleware.ts       # Next.js edge middleware
│   └── package.json
├── deploy/
│   └── render/
│       └── backend.Dockerfile  # Dockerfile for Render deployment
├── scripts/                    # Utility scripts (backup, init, migration)
├── tests/                      # Python test suite
├── docs/                       # Documentation
├── render.yaml                 # Render infrastructure as code
├── alembic.ini                 # Alembic configuration
└── vercel.json                 # Vercel configuration
```

### 1.3 State Management Architecture

#### Backend State

| State Type | Mechanism | Location |
|-----------|-----------|----------|
| **Database Connection** | SQLAlchemy engine pool | `backend/database.py` |
| **User Session (JWT)** | HS256 tokens in cookies or Bearer header | `backend/security.py` |
| **MFA State** | `mfa_verified` claim in JWT payload | JWT payload |
| **Active Org/Factory** | Attached to user via `setattr` in `get_current_user()` | Request-scoped |
| **Token Blacklist** | `TokenBlacklist` DB table | `backend/models/report.py` |
| **Rate Limiting** | In-memory window tracking | `backend/middleware/` |
| **Billing State** | `subscriptions`, `payment_orders`, `invoices` tables | DB models |
| **Audit Trail** | SQLAlchemy `before_flush` event → `AuditLog` table | `backend/database.py` |
| **AI Provider State** | Circuit breakers, retry counters | In-memory |
| **Ops Alerting** | `OpsAlertEvent` table + in-memory dispatcher | DB + memory |

#### Frontend State

| State Type | Mechanism | Location |
|-----------|-----------|----------|
| **Auth Session** | HttpOnly cookies (JWT) | Browser cookies |
| **CSRF Token** | Double-submit cookie pattern | Cookie + header |
| **React Query Cache** | TanStack React Query | In-memory |
| **UI State** | React `useState` / `useReducer` | Component-local |
| **OCR Session State** | Custom hook `use-ocr-verify-route-state` | `hooks/` |
| **Route State** | URL search params | Next.js router |
| **Offline Sync** | `ServiceWorker` + `OfflineSyncAgent` | Service Worker |

### 1.4 Middleware Stack

#### Backend Middleware (applied in `backend/main.py`)

```python
# Order of application:
1. apply_security(app)           # CORS, HSTS, HTTPS redirect, rate limiting
2. apply_response_envelope(app)  # Wraps all responses in {success, data, error} envelope
3. apply_cookie_csrf(app)        # CSRF token validation via double-submit cookie
4. attach_role_revision_header   # Custom middleware: adds X-Role-Revision header
5. log_requests                  # Custom middleware: request/response logging + metrics
```

#### Frontend Middleware (`web/src/middleware.ts`)

- Location: `web/src/middleware.ts` (formerly at root web path, now restructured)
- Handles: Route protection, auth redirects, public route gating

### 1.5 Database Schema Map

```
organizations ──┬── users ──┬── user_factory_roles
                │           ├── refresh_tokens
                │           ├── password_reset_tokens
                │           ├── email_verification_tokens
                │           └── phone_verifications
                │
                ├── factories ──┬── factory_settings
                │               ├── shift_templates
                │               └── user_factory_roles
                │
                ├── subscriptions ──┬── org_subscription_addons
                │                   └── invoices
                ├── payment_orders
                ├── webhook_events
                │
                ├── entries
                ├── attendance_records ──┬── attendance_events
                │                        └── attendance_regularizations
                ├── employee_profiles
                │
                ├── feedback
                ├── approval_instances
                │
                ├── steel_customers ──┬── steel_customer_payments
                │                     └── steel_customer_follow_up_tasks
                ├── steel_production_batches
                ├── steel_sales_invoices ─── steel_sales_invoice_lines
                ├── steel_dispatches ──────── steel_dispatch_lines
                ├── steel_inventory_items ──┬── steel_inventory_transactions
                │                           └── steel_stock_reconciliations
                │
                ├── ocr_templates
                ├── ocr_verifications
                ├── ocr_usage
                │
                ├── admin_alert_recipients
                ├── ops_alert_events
                ├── ops_alert_daily_summaries
                │
                ├── email_queue
                ├── intelligence_requests
                ├── ai_usage_logs
                ├── ai_result_cache
                ├── audit_logs
                ├── token_blacklist
                └── feature_usage / org_feature_usage
```

### 1.6 API Router Map

| Prefix | Router | Module |
|--------|--------|--------|
| `/auth` | auth, google auth, phone auth, permissions | `routers/auth*.py`, `routers/permissions.py` |
| `/auth/v2` | auth_secure (new auth system) | `routers/auth_secure.py` |
| `/api` | approvals | `routers/approvals.py` |
| `/jobs` | job management | `routers/jobs.py` |
| `/entries` | production entries | `routers/entries.py` |
| `/reports` | report generation | `routers/reports.py` |
| `/analytics` | analytics | `routers/analytics.py` |
| `/ai` | AI/insights | `routers/ai.py` |
| `/alerts` | alert history | `routers/alerts.py` |
| `/feedback` | user feedback | `routers/feedback.py` |
| `/attendance` | attendance tracking | `routers/attendance.py` |
| `/settings` | settings + alert recipients | `routers/settings.py` |
| `/ocr` | OCR pipeline | `routers/ocr.py` |
| `/observability` | health, metrics, frontend errors | `routers/observability.py` |
| `/webhooks` | WhatsApp webhook | `routers/whatsapp_webhook.py` |
| `/emails` | email operations | `routers/emails.py` |
| `/intelligence` | AI intelligence | `routers/intelligence.py` |
| `/plans` | subscription plans | `routers/plans.py` |
| `/billing` | billing operations | `routers/billing.py` |
| `/admin-billing` | admin billing | `routers/admin_billing.py` |
| `/premium` | premium features | `routers/premium.py` |
| `/steel` | steel workflow CRUD | `routers/steel.py` |
| `/health` | health check | `main.py` |
| `/metrics` | metrics snapshot | `main.py` |

---

## Workflow 1: Auth & Onboarding

### 1. The Happy Path

```
User visits /register
  → Fills form (email, password, company name, phone optional)
  → POST /auth/register
  → Backend hashes password (bcrypt, gensalt)
  → Creates user in DB (status: active)
  → Creates Organization + Factory if first user
  → Generates email verification token
  → Queues verification email
  → Sets JWT cookies (access + refresh + CSRF)
  → Redirects to /verify-email?token=...
  → User clicks link in email
  → GET /auth/verify-email?token=...
  → Marks email_verified_at = now()
  → Redirects to /dashboard (first-time tour)
```

### 2. Failure & Edge Cases

| Scenario | Handling |
|----------|----------|
| **Duplicate email** | 409 Conflict — "Email already registered" |
| **Weak password** | `validate_password_strength()` — min 12 chars, mixed case, digits, symbols |
| **Email delivery fails** | Async queuing via `email_queue` table; retry on next send cycle |
| **Token expired** | Resend option; new token generated, old one invalidated |
| **User never verifies email** | Graceful — `email_verified_at` stays null, app still works but shows banner |
| **Database timeout during registration** | Transaction rollback — no partial user created |
| **Phone OTP verification** | Rate-limited to 5 attempts per window; OTP expires after 5 min |
| **Google OAuth callback mismatch** | `GOOGLE_REDIRECT_URI` mismatch → 400 with clear error |

### 3. Key Files

| File | Purpose |
|------|---------|
| `web/src/app/(public)/register/page.tsx` | Registration form UI |
| `web/src/app/(public)/login/page.tsx` | Login form UI |
| `web/src/app/(public)/verify-email/page.tsx` | Email verification page |
| `web/src/components/auth/auth-guard.tsx` | Route protection wrapper |
| `web/src/components/auth/auth-shell.tsx` | Shared auth layout |
| `backend/routers/auth.py` | Registration, login, token refresh, logout endpoints |
| `backend/routers/auth_secure.py` | v2 auth with enhanced security |
| `backend/routers/auth_google.py` | Google OAuth flow |
| `backend/routers/phone_auth.py` | Phone OTP verification |
| `backend/security.py` | JWT creation, password hashing |
| `backend/models/user.py` | User ORM model |
| `backend/models/email_queue.py` | Async email queue |

---

## Workflow 2: Auth-Gated Billing

### 1. The Happy Path

```
User browses /plans
  → Selects a plan (e.g., "Factory" tier)
  → Click "Subscribe" → redirect to /login?redirect=/billing/checkout?plan=xxx
  → User logs in / registers
  → POST /billing/checkout (backend creates Razorpay order)
  → Response: { razorpay_order_id, amount, currency }
  → Frontend opens Razorpay checkout modal
  → Payment succeeds → Razorpay fires webhook
  → POST /webhooks/razorpay (backend verifies signature)
  → Creates subscription in DB
  → Provisions plan features
  → Sends confirmation email
  → Redirects to /billing/success → /dashboard
```

### 2. Failure & Edge Cases

| Scenario | Handling |
|----------|----------|
| **Payment fails** | Razorpay modal shows error; user can retry; no partial state persisted |
| **Webhook not delivered** | Grace period logic (`enforce_expired_grace_periods`) auto-downgrades after N days |
| **User closes checkout mid-flow** | No order created at backend; stale `payment_order` cleaned during recovery |
| **Signature mismatch** | Webhook rejected; logged as security alert |
| **Downgrade mid-cycle** | `apply_due_downgrades()` runs daily; credits usage tracked per cycle |
| **Free tier limits** | Feature gating via `FeatureUsage` / `OrgFeatureUsage` tables |
| **Concurrent upgrades** | Idempotent — subscription state normalized on startup |

### 3. Key Files

| File | Purpose |
|------|---------|
| `web/src/app/(public)/plans/page.tsx` | Plan selection UI |
| `web/src/app/(private)/billing/page.tsx` | Billing dashboard |
| `web/src/components/private/billing-checkout-sequence.tsx` | Checkout flow |
| `backend/routers/billing.py` | Checkout session, Razorpay integration |
| `backend/routers/admin_billing.py` | Admin billing controls |
| `backend/services/billing_manager.py` | Subscription lifecycle, downgrades, grace periods |
| `backend/models/subscription.py` | Subscription ORM |
| `backend/models/payment_order.py` | Payment order tracking |
| `backend/models/webhook_event.py` | Webhook event log |
| `backend/models/invoice.py` | Invoice records |
| `backend/plans.py` | Plan definitions and pricing |

---

## Workflow 3: OCR/Data Ingestion Pipeline

### 1. The Happy Path

```
User navigates to /ocr/scan
  → Uploads image/PDF (drag-and-drop or camera capture)
  → Frontend compresses image (browser-image-compression) if needed
  → POST /ocr/upload (multipart)
  → Backend saves file, creates OCR job
  → Response: { job_id, status: "processing" }
  → Frontend polls GET /ocr/status/{job_id} or uses WebSocket
  → Backend processes:
      1. Tesseract OCR (local) for initial text extraction
      2. AI provider (Anthropic Claude) for structured data extraction
      3. Layout analysis → cell structure identification
      4. Result stored in ocr_verifications table
  → Status → "completed"
  → User navigates to /ocr/verify/{job_id}
  → Reviews extracted data in editable table
  → Makes corrections if needed
  → Clicks "Confirm" → POST /ocr/confirm/{job_id}
  → Data exported to entries or downloadable file
```

### 2. Failure & Edge Cases

| Scenario | Handling |
|----------|----------|
| **File too large** | `MAX_REQUEST_BYTES` enforced (12MB default); frontend compression applied |
| **Corrupted image** | Backend validates image integrity; returns 422 with description |
| **OCR processing timeout** | AI circuit breaker trips after 3 failures; falls back to Tesseract-only |
| **AI provider down** | Provider chain: tries Anthropic → falls back to Gemini → falls back to Tesseract |
| **Partial data extraction** | UI shows success with warnings; user can manually edit |
| **Concurrent OCR limits** | Org-level OCR usage tracking; free tier has monthly cap |
| **Browser closes during processing** | Job continues server-side; user can return to /ocr/history to check |

### 3. Key Files

| File | Purpose |
|------|---------|
| `web/src/app/(workflow)/ocr/scan/page.tsx` | OCR upload page |
| `web/src/app/(workflow)/ocr/verify/page.tsx` | OCR verification page |
| `web/src/app/(workflow)/ocr/history/page.tsx` | OCR history page |
| `web/src/components/ocr/upload-box.tsx` | File upload component |
| `web/src/components/ocr-scan/ocr-uploader.tsx` | Upload orchestrator |
| `web/src/components/ocr-scan/ocr-results-grid.tsx` | OCR results display |
| `web/src/components/ocr-scan/ocr-editor.tsx` | OCR data editor |
| `backend/routers/ocr.py` | OCR API endpoints |
| `backend/services/ocr_document_pipeline.py` | Full OCR pipeline orchestration |
| `backend/services/ocr_layout_analysis.py` | Document layout parsing |
| `backend/services/ocr_structural_grouping.py` | Cell structure identification |
| `backend/ai/pipelines/ocr_pipeline.py` | AI model integration |
| `backend/models/ocr_verification.py` | OCR verification ORM |
| `backend/models/ocr_template.py` | OCR template ORM |

---

## Workflow 4: Data Export & Management

### 1. The Happy Path

```
User completes data entry / OCR verification
  → Navigates to reports page
  → Selects filters (date range, factory, shift)
  → GET /reports/export?format=excel&from=...&to=...
  → Backend queries entries table (optimized with composite indexes)
  → Generates Excel via openpyxl / ReportLab
  → Returns file as downloadable response (Content-Disposition: attachment)
  → Frontend triggers browser download
  → Temporary file cleaned up (in-memory or temp directory)
```

### 2. Failure & Edge Cases

| Scenario | Handling |
|----------|----------|
| **Large dataset (>10K rows)** | Streamed response; chunked database queries |
| **Database query timeout** | `DB_POOL_TIMEOUT=30s`; query retry logic |
| **Disk space full** | Temp file cleanup on failure; monitored via `/metrics` |
| **Concurrent export requests** | Rate-limited per org (120 req/min default) |
| **Empty result set** | Returns empty Excel with headers; not an error |
| **Memory exhaustion** | PDF generation via streaming; Excel via incremental writes |

### 3. Key Files

| File | Purpose |
|------|---------|
| `backend/routers/reports.py` | Report generation endpoints |
| `backend/services/` | Business logic for report building |
| `backend/models/entry.py` | Entry data ORM |
| `web/src/components/private/reports-page.tsx` | Reports UI |

---

## Workflow 5: User Access Control & RBAC

### 1. The Happy Path

```
Admin navigates to /settings/users
  → Views user list with roles
  → Clicks "Add User" → fills email + role selection
  → POST /settings/users (backend creates user with role)
  → Email sent to new user with invite link
  → New user registers → role assigned automatically
  → API requests from user include JWT with role claim
  → PDP (Policy Decision Point) evaluates:
      - Does user have permission_key for this action?
      - Is user scoped to this org/factory?
  → If permitted → action executes
  → If denied → 403 Forbidden
```

### 2. RBAC Model

```
Organizations ─── Factories
     │                │
     └── Users ───────┘
          │
          ├── role: ADMIN, OWNER, MANAGER, SUPERVISOR, OPERATOR, ACCOUNTANT, ATTENDANCE
          ├── user_factory_roles (cross-factory assignments)
          ├── role_revision (incremented when roles change)
          └── is_platform_admin (superadmin flag)
```

**Permission Evaluation Flow:**
```
Request → get_current_user() → decode JWT → attach org/factory context
       → PDP.require_permission(actor, permission_key)
       → Check user role + resource context
       → Allow / Deny (403)
```

### 3. Failure & Edge Cases

| Scenario | Handling |
|----------|----------|
| **Role changed mid-session** | `X-Role-Revision` header compared; session invalidated if mismatch |
| **Deleted user tries to access** | `User.is_active = False` → 401 in `get_current_user()` |
| **Cross-org access attempt** | Org_id mismatch in JWT vs DB → 401 |
| **Token revoked** | `TokenBlacklist` checked on every request |
| **Permission not found** | Default deny — must be explicitly granted |
| **Race condition on role update** | `role_revision` incremented atomically |

### 4. Key Files

| File | Purpose |
|------|---------|
| `backend/routers/permissions.py` | Permission endpoints |
| `backend/authorization.py` | PDP (Policy Decision Point) |
| `backend/security.py` | `get_current_user()` with org/factory context |
| `backend/models/user.py` | User model with role enum |
| `backend/models/user_factory_role.py` | Cross-factory role assignments |
| `backend/models/organization.py` | Org model |
| `backend/models/factory.py` | Factory model |
| `docs/ROLE_HIERARCHY_NEEDS_MODEL.md` | Role hierarchy documentation |
| `docs/TARGET_STATE_AUTHORIZATION_AND_GOVERNANCE_ARCHITECTURE.md` | Auth architecture docs |

---

## Workflow 6: Steel Production & Inventory

### 1. The Happy Path

```
Production flow:
  Factory produces steel → Record in /steel/production/record
    → POST /steel/batches { grade, quantity, heat_number, ... }
    → Inventory updated automatically
    → Batch status: "completed"

Sales flow:
  Customer inquiry → Create/select customer in /steel/customers
    → Create sales invoice → POST /steel/invoices
    → Invoice status: "unpaid"
    → Generate dispatch → POST /steel/dispatches
    → Dispatch status: "dispatched" → "delivered"
    → Inventory deducted
    → Payment received → POST /steel/customers/{id}/payments
    → Invoice status → "paid"
    → Reconciliation → POST /steel/reconciliations
```

### 2. Failure & Edge Cases

| Scenario | Handling |
|----------|----------|
| **Insufficient inventory** | Validation on dispatch; returns 400 with available quantity |
| **Duplicate invoice** | Invoice number uniqueness enforced |
| **Dispatch without invoice** | Allowed for direct sales; optional invoice linking |
| **Customer credit limit exceeded** | Validation on invoice creation; configurable per customer |
| **Partial delivery** | Dispatch lines support partial quantities; remaining stays in inventory |
| **GST/PAN verification** | Optional verification workflow with status tracking |

### 3. Key Files

| File | Purpose |
|------|---------|
| `backend/routers/steel.py` | All steel CRUD endpoints (~50+ operations) |
| `backend/models/steel_*.py` | Steel domain models (10+ tables) |
| `web/src/app/(workflow)/steel/` | Steel UI routes (batches, invoices, dispatches, etc.) |
| `web/src/components/workflow/steel-*.tsx` | Steel UI components |

---

## Workflow 7: Attendance Management

### 1. The Happy Path

```
Worker punches in (morning shift)
  → POST /attendance/records { worker_id, timestamp, type: "in" }
  → Record created with status: "auto"
  → Worker punches out (evening)
  → POST /attendance/records { worker_id, timestamp, type: "out" }
  → Attendance duration calculated
  → Supervisor reviews → POST /attendance/review
  → Status → "approved"
  → Report generated for payroll

Live monitoring:
  → GET /attendance/live → Real-time worker status grid
  → Attendance regularization for missed punches
```

### 2. Failure & Edge Cases

| Scenario | Handling |
|----------|----------|
| **Missing punch-out** | Auto-calculated as half-day; regularization request available |
| **Duplicate punch** | Idempotent via request tracking; duplicates rejected |
| **Late arrival** | Flagged for review; configurable grace period |
| **Offline mode** | `client_request_id` for idempotent sync when connectivity returns |
| **Regularization request** | Requires supervisor approval; tracked in `attendance_regularizations` |

### 3. Key Files

| File | Purpose |
|------|---------|
| `backend/routers/attendance.py` | Attendance endpoints |
| `backend/models/attendance_record.py` | Core attendance model |
| `backend/models/attendance_event.py` | Punch events |
| `backend/models/attendance_regularization.py` | Missed punch corrections |
| `backend/services/attendance_absence_service.py` | Absence detection scheduler |
| `web/src/app/(workflow)/attendance/` | Attendance UI routes |

---

## Workflow 8: Ops Alerts & Notifications

### 1. The Happy Path

```
System detects anomaly (e.g., 5xx rate > 5%)
  → OpsAlertEvent created with severity: "HIGH"
  → WhatsApp message dispatched to configured recipients
  → Delivery tracked (sent → delivered → read)
  → Alert history available via GET /observability/alerts
  → Daily summary sent at configured UTC hour
```

### 2. Alert Tiers

| Tier | Trigger | Channel | Escalation |
|------|---------|---------|------------|
| T1 | 5xx spike (>5% in 5min) | WhatsApp | Levels 0-3 |
| T2 | OCR failures (>10 in 5min) | WhatsApp | Levels 0-3 |
| T4 | Auth brute force (>8 attempts) | WhatsApp | Levels 0-3 |
| T5 | General error rate breach | WhatsApp | Levels 0-3 |

### 3. Key Files

| File | Purpose |
|------|---------|
| `backend/services/ops_alerts/` | Alert engine, dispatchers |
| `backend/routers/observability.py` | Alert history, readiness |
| `backend/models/ops_alert_event.py` | Alert event model |
| `backend/models/admin_alert_recipient.py` | Recipient configuration |
| `backend/services/whatsapp_sender.py` | WhatsApp message dispatch |

---

## Workflow 9: Feedback & Anomaly Detection

### 1. The Happy Path

```
User clicks feedback widget
  → Submits rating + comment
  → POST /feedback { rating, message, route }
  → Feedback stored in DB
  → Anomaly detector analyzes patterns (hourly/daily)
  → If unusual pattern detected → ops alert triggered
  → Translation service (optional) for multilingual feedback
```

### 2. Key Files

| File | Purpose |
|------|---------|
| `backend/routers/feedback.py` | Feedback endpoints |
| `backend/models/feedback.py` | Feedback ORM |
| `backend/services/feedback_anomaly_detection.py` | Anomaly detection scheduler |
| `web/src/components/shared/feedback-widget.tsx` | Frontend feedback widget |
| `web/src/components/shared/micro-feedback-prompt.tsx` | Micro-feedback popup |

---

## Workflow 10: Email Communications

### 1. The Happy Path

```
System needs to send email (verification, invoice, alert)
  → Email queued in email_queue table
  → Background worker picks up pending emails
  → Sends via SMTP (Resend)
  → Status updated (sent / failed)
  → Failed emails retried with exponential backoff
```

### 2. Key Files

| File | Purpose |
|------|---------|
| `backend/services/email_service.py` | Email sending logic |
| `backend/models/email_queue.py` | Email queue ORM |
| `backend/routers/emails.py` | Email management endpoints |
| `web/src/components/public/verify-email-page.tsx` | Verification email UI |
| `docs/AUTH_EMAIL_SETUP.md` | Email setup documentation |

---

## Phase 2: Architectural Gaps & Systematic Recommendations

### A. Critical Gaps

| Gap | Severity | Impact | Recommendation |
|-----|----------|--------|----------------|
| **No end-to-end integration tests** | 🔴 HIGH | Workflow breaks undetected | Add per-workflow integration tests (Playwright for FE, pytest for BE) |
| **No global frontend state machine** | 🟡 MEDIUM | Workflow state transitions not enforced | Implement XState or Zustand for complex workflows (billing, OCR) |
| **No centralized error tracking** | 🟡 MEDIUM | Errors logged inconsistently | Enforce Sentry DSN in all environments; add frontend error grouping |
| **Offline sync limited** | 🟡 MEDIUM | Data loss on connectivity loss | Expand offline queue; add conflict resolution UI |
| **No rate-limiting headers** | 🟢 LOW | Clients can't back off | Add `Retry-After` / `RateLimit-*` headers on 429 responses |
| **No API versioning** | 🟢 LOW | Breaking changes affect clients | Add `/v1/` prefix to new endpoints; maintain backward compat |

### B. Systematic Recommendations

#### 1. Create a Global Workflow State Machine
```
Problem: Workflow state transitions (e.g., OCR: upload → processing → review → confirm)
are managed ad-hoc in individual components.

Solution: Create a shared state machine library:
- OCR workflow: upload → processing → review → confirm → export
- Billing: plan_selected → checkout → payment → provisioned → active
- Attendance: punched_in → working → punched_out → reviewed → approved

File: web/src/lib/workflow-machines.ts
```

#### 2. Unify Error Handling Layer
```
Problem: Error handling is spread across try/catch blocks with inconsistent patterns.

Solution:
- Frontend: Centralized Axios interceptor with retry logic
- Backend: Unified exception handler that wraps all errors in { success, data, error }
- Add error codes (E001, E002, etc.) for machine-readable errors
- File: backend/middleware/error_handler.py, web/src/lib/api-client.ts
```

#### 3. Add Request Correlation IDs
```
Problem: Tracing a request through the system requires manual log correlation.

Solution:
- Generate `X-Request-ID` at the edge (Vercel middleware or Nginx)
- Forward to backend via header
- Include in all log lines, error responses, and Sentry events
- File: web/src/middleware.ts, backend/middleware/correlation.py
```

#### 4. Implement Idempotency Keys
```
Problem: Retry-safe operations (payments, OCR submissions) depend on client_request_id
but not all endpoints enforce it.

Solution:
- Add idempotency middleware at `/billing`, `/ocr/upload`, `/entries`
- TTL of 24 hours for idempotency cache
- Return original response on duplicate key
- File: backend/middleware/idempotency.py
```

#### 5. Frontend Lazy Loading & Code Splitting
```
Problem: All ~65 routes load in the initial bundle.

Solution:
- Implement Next.js dynamic imports for workflow routes
- Lazy-load OCR components (heavy ~200KB)
- Image optimization pipeline for uploads
```

#### 6. Database Connection Pool Monitoring
```
Problem: Connection pool exhaustion could silently degrade performance.

Solution:
- Add `/metrics` endpoint with pool stats (active, idle, overflow)
- Alert when pool utilization > 80%
- Auto-scale pool based on request volume
```

#### 7. Multi-Tenant Data Isolation Audit
```
Problem: org_id scoping is applied per-query but not enforced at DB level.

Solution:
- Add row-level security policies (PostgreSQL) for critical tables
- Automated tenant isolation tests (existing: `test_tenant_isolation.py`)
- Cross-org query leak detection in CI
```

#### 8. Automated Backup & Recovery
```
Problem: Backups are manual (scripts/backup.py).

Solution:
- Schedule daily automated backups via Render cron jobs
- Test restore procedure monthly
- Store backups in S3-compatible storage (not local disk)
```

### C. Implementation Priority Matrix

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| P0 | Fix Dockerfile build (DONE ✅) | 10 min | 🔴 Blocking deployment |
| P1 | Add integration tests for OCR pipeline | 2 days | 🟡 Prevents regressions |
| P1 | Implement global workflow state machines | 3 days | 🟡 Reduces bugs |
| P1 | Unify error handling layer | 1 day | 🟡 Improves reliability |
| P2 | Add correlation IDs | 4 hours | 🟢 Debugging efficiency |
| P2 | Idempotency for critical endpoints | 1 day | 🟢 Payment safety |
| P2 | Multi-tenant isolation audit | 2 days | 🟢 Security hardening |
| P3 | Database pool monitoring | 4 hours | 🟢 Ops visibility |
| P3 | Automated backups | 1 day | 🟢 Disaster recovery |
| P3 | Code splitting for OCR routes | 4 hours | 🟢 Performance |

---

## Summary

**Strengths:**
- Comprehensive security posture (JWT, CSRF, CORS, HSTS, rate limiting)
- Robust database pattern (auto-drift repair, graceful migrations)
- Multiple AI provider fallback chain
- Complete audit trail via SQLAlchemy events
- Well-structured middleware stack
- Multi-tenant architecture with org/factory scoping

**Weakenesses:**
- No end-to-end integration tests covering complete workflows
- State machine logic scattered across components
- Idempotency not universally applied
- Backup strategy needs automation
- No request correlation for distributed tracing

**Recommendations:** Address P1 items first (integration tests + state machines + error handling), then P2-P3 items in parallel.

---

*Architecture audit generated 2026-06-17 | 10 workflows analyzed | ~50 DB tables mapped | ~25 API routers documented*
