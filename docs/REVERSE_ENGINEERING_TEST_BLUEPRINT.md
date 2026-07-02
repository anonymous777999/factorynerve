# DPR.ai — Complete Reverse Engineering & Testing Blueprint

**Date:** June 13, 2026  
**Auditor:** Buffy (AI Agent)  
**System:** DPR.ai — Factory Operations Platform

---

## 1. SYSTEM ARCHITECTURE MAP

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js 14)                      │
│  TypeScript · Tailwind CSS · React · 70+ Components           │
│  29 Route Pages · PWA Support · Offline Sync                  │
├─────────────────────────────────────────────────────────────┤
│                  API GATEWAY (Next.js API Routes)             │
├─────────────────────────────────────────────────────────────┤
│                    BACKEND (Python/FastAPI)                    │
│  25 Router Files · 30+ Services · 55+ Models                  │
│  SQLAlchemy ORM · Pydantic Validation · RBAC                  │
├─────────────────────────────────────────────────────────────┤
│                    DATABASE (SQLite/PostgreSQL)                │
│  55+ Tables · Multi-tenant (org_id) · Audit Logging           │
├─────────────────────────────────────────────────────────────┤
│  External: Razorpay · Resend · WhatsApp · Tesseract OCR       │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Backend Router Map

| Router File | Prefix (all under `/api/`) | Routes | Primary Purpose |
|---|---|---|---|
| `auth.py` | `/auth` | 18 | Register, login, logout, refresh, email verify, password reset, profile |
| `auth_google.py` | `/auth/google` | 2 | Google OAuth |
| `auth_secure.py` | `/auth/secure` | 3 | Secure auth extensions |
| `phone_auth.py` | `/auth/phone` | 4 | Phone-based auth, OTP |
| `settings.py` | `/settings` | 20 | Factory profiles, user mgmt, roles, plans, usage |
| `entries.py` | `/entries` | 12 | DPR entries CRUD, smart input, approve/reject, summaries |
| `attendance.py` | `/attendance` | 12 | Punch in/out, live view, review, regularization, reports |
| `steel.py` | `/steel` | 32 | Steel inventory, production, sales, dispatch, customers |
| `billing.py` | `/billing` | 9 | Razorpay orders, webhooks, subscription, invoices |
| `ocr.py` | `/ocr` | 24 | OCR pipeline, templates, verifications, warp, logbook |
| `ai.py` | `/ai` | 4 | AI chat, insights |
| `analytics.py` | `/analytics` | 4 | Dashboard analytics endpoints |
| `reports.py` | `/reports` | 11 | PDF/Excel report generation |
| `alerts.py` | `/alerts` | 4 | Alert CRUD, read/unread |
| `alert_recipients.py` | `/alert-recipients` | 4 | Alert recipient config |
| `emails.py` | `/emails` | 4 | Email sending, summaries |
| `feedback.py` | `/feedback` | 6 | User feedback CRUD |
| `intelligence.py` | `/intelligence` | 4 | AI intelligence features |
| `premium.py` | `/premium` | 4 | Premium dashboard features |
| `jobs.py` | `/jobs` | 2 | Background job management |
| `observability.py` | `/observability` | 2 | System observability |
| `whatsapp_webhook.py` | `/whatsapp` | 1 | WhatsApp message ingestion |
| `admin_ai.py` | `/admin/ai` | 2 | Admin AI management |
| `admin_billing.py` | `/admin/billing` | 2 | Admin billing management |

### 1.3 Frontend Page Map

| Route | Page Component | Auth Required | Key Feature |
|---|---|---|---|
| `/` | `home-route.tsx` | No | Landing |
| `/access` | `auth-shell.tsx` | No | Auth entry point |
| `/login` | — (redirects) | No | V2 login |
| `/register` | — | No | Registration |
| `/forgot-password` | `forgot-password-page.tsx` | No | Password reset |
| `/reset-password` | `reset-password-page.tsx` | No | Password reset form |
| `/verify-email` | `verify-email-page.tsx` | No | Email verification |
| `/dashboard` | `dashboard-home.tsx` | Yes | Main dashboard |
| `/entry` | `work-queue-page.tsx` | Yes | DPR submission |
| `/approvals` | `approvals-page.tsx` | Yes (Supervisor+) | Entry approval |
| `/attendance` | `attendance-page.tsx` | Yes | Punch in/out |
| `/attendance/live` | `attendance-live-page.tsx` | Yes (Supervisor+) | Live attendance board |
| `/attendance/review` | `attendance-review-page.tsx` | Yes (Supervisor+) | Attendance review |
| `/attendance/reports` | `attendance-reports-page.tsx` | Yes | Attendance reports |
| `/steel` | `steel-command-center-page.tsx` | Yes | Steel hub |
| `/steel/inventory` | `steel-inventory-page.tsx` | Yes | Inventory/stock |
| `/steel/batches` | `steel-batches-page.tsx` | Yes | Production batches |
| `/steel/production` | `steel-production-record-page.tsx` | Yes | Record production |
| `/steel/invoices` | `steel-invoices-page.tsx` | Yes | Sales invoices |
| `/steel/dispatches` | `steel-dispatches-page.tsx` | Yes | Dispatches |
| `/steel/customers` | `steel-customers-page.tsx` | Yes | Customer ledger |
| `/steel/customers/[id]` | `steel-customer-ledger-page.tsx` | Yes | Customer detail |
| `/steel/reconciliations` | `steel-reconciliations-page.tsx` | Yes | Stock reconciliation |
| `/steel/charts` | `steel-charts-page.tsx` | Yes | Steel analytics |
| `/ocr` | `ocr-page.tsx` | Yes | OCR scanning hub |
| `/ocr/scan` | `ocr-scan-page.tsx` | Yes | Document scanning |
| `/ocr/verification` | `ocr-verification-page.tsx` | Yes | OCR verification |
| `/ai` | `ai-insights-page.tsx` | Yes | AI chat/insights |
| `/analytics` | `analytics-page.tsx` | Yes | Analytics dashboard |
| `/reports` | `reports-page.tsx` | Yes | Report generation |
| `/billing` | `billing-page.tsx` | Yes | Billing dashboard |
| `/admin-billing` | `admin-billing-page.tsx` | Yes (Admin+) | Admin billing |
| `/plans` | `pricing-page.tsx` | No | Plan comparison |
| `/settings` | `settings-page.tsx` | Yes | Settings hub |
| `/settings/users` | `settings-users-tab.tsx` | Yes (Manager+) | User management |
| `/settings/attendance` | `settings-attendance-page.tsx` | Yes (Manager+) | Attendance settings |
| `/profile` | `profile-page.tsx` | Yes | User profile |
| `/alerts` | `alerts-page.tsx` | Yes | Alert center |
| `/control-tower` | `control-tower-page.tsx` | Yes | Multi-factory view |
| `/premium` | `premium-dashboard-page.tsx` | Yes | Premium features |
| `/tasks` | `my-tasks-page.tsx` | Yes | Follow-up tasks |
| `/work-queue` | `work-queue-page.tsx` | Yes | Work queue |
| `/onboarding` | — | Yes | New user flow |
| `/offline` | `offline-sync-agent.tsx` | Yes | Offline mode |
| `/403` | — | No | Forbidden page |

---

## 2. ROLE MATRIX

### 2.1 Role Hierarchy

```
ATTENDANCE (0) < OPERATOR (1) < ACCOUNTANT (2) < SUPERVISOR (3) < MANAGER (4) < ADMIN (5) < OWNER (6)
```

### 2.2 Permission Table

| Capability | ATTENDANCE | OPERATOR | ACCOUNTANT | SUPERVISOR | MANAGER | ADMIN | OWNER |
|---|---|---|---|---|---|---|---|
| **View dashboard** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Submit DPR entry** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **View analytics** | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Approve entries** | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Punch attendance** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Manage employees** | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Manage users/roles** | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Export data** | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **View billing** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Manage billing** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Admin panel** | ❌ | ❌ | ❌ | ❌ | ❌ | Platform | Platform |
| **Steel: View stock** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Steel: Record tx** | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Steel: Manage items** | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Steel: Approve reconciliations** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Steel: View financials** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **OCR: Use scanning** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **OCR: Manage templates** | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Attendance: Live view** | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Attendance: Review** | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |

### 2.3 Factory-Level RBAC

Each user has factory-specific roles via `UserFactoryRole`. A user may have different roles in different factories. JWT tokens encode the active factory's role.

### 2.4 Platform Admin

`is_platform_admin` flag on User model grants access to `/admin/*` endpoints regardless of org.

---

## 3. BUSINESS CAPABILITY CATALOG

| Capability | Description | Router | Models | Status |
|---|---|---|---|---|
| **DPR Entry** | Production data recording per shift: target units, produced, manpower, downtime, quality | entries.py | Entry | ✅ |
| **Smart Input** | AI-assisted entry from natural language | entries.py | Entry | ✅ |
| **Entry Approval** | Supervisor/manager approval workflow | entries.py | Entry | ✅ |
| **AI Summary** | Auto-generated production summaries | entries.py, ai.py | Entry | ✅ |
| **Attendance Punch** | Self-service punch in/out with shift inference | attendance.py | AttendanceRecord, AttendanceEvent | ✅ |
| **Attendance Live** | Real-time attendance board for supervisors | attendance.py | AttendanceRecord, EmployeeProfile | ✅ |
| **Attendance Review** | Supervisor approval of attendance records | attendance.py | AttendanceRegularization | ✅ |
| **Shift Management** | Configurable shift templates with grace/overtime | attendance.py | ShiftTemplate | ✅ |
| **Employee Profiles** | Department, designation, reporting manager | attendance.py | EmployeeProfile | ✅ |
| **Steel Inventory** | Item master, stock balances, confidence tracking | steel.py | SteelInventoryItem, SteelInventoryTransaction | ✅ |
| **Steel Production** | Batch tracking, input/output, loss analysis | steel.py | SteelProductionBatch | ✅ |
| **Steel Sales** | Invoicing with line items, payment tracking | steel.py | SteelSalesInvoice, SteelSalesInvoiceLine | ✅ |
| **Steel Dispatch** | Gate pass, truck tracking, delivery proof | steel.py | SteelDispatch, SteelDispatchLine | ✅ |
| **Steel Customers** | Ledger, credit tracking, risk scoring | steel.py | SteelCustomer, SteelCustomerPayment | ✅ |
| **Steel Reconciliation** | Physical vs system stock, approval workflow | steel.py | SteelStockReconciliation | ✅ |
| **OCR Scanning** | Document scanning and digitization | ocr.py | OcrTemplate, OcrVerification | ✅ |
| **OCR Verification** | Human review of OCR results | ocr.py | OcrVerification | ✅ |
| **OCR Logbook** | Curated OCR output for factory logs | ocr.py | OcrVerification | ✅ |
| **Email Alerts** | Automated email notifications | emails.py | EmailQueue | ✅ |
| **WhatsApp Alerts** | WhatsApp-based notifications | whatsapp_webhook.py | — | ✅ |
| **Ops Alerts** | Rule-based operational alerts | alerts.py | Alert | ✅ |
| **Billing & Plans** | Subscription management, Razorpay | billing.py | Subscription, PaymentOrder | ✅ |
| **Analytics** | Dashboard metrics and KPIs | analytics.py | — | ✅ |
| **Reports** | PDF/Excel generation | reports.py | — | ✅ |
| **User Management** | Invite, role assignment, factory access | settings.py | User, UserFactoryRole | ✅ |
| **Multi-factory** | Org-scoped factories with separate data | settings.py | Factory | ✅ |
| **Feedback** | In-app feedback collection | feedback.py | Feedback | ✅ |
| **Password Reset** | Email-based password recovery | auth.py | PasswordResetToken | ✅ |
| **Email Verification** | Verify email on registration | auth.py | EmailVerificationToken | ✅ |

---

## 4. WORKFLOW CATALOG

### 4.1 DPR Entry Workflow

| Step | Description | Role | API | Model |
|---|---|---|---|---|
| 1 | Submit production entry | Any | `POST /entries` | Entry |
| 2 | Smart input (optional) | Any | `POST /entries/smart` | Entry |
| 3 | View pending entries | Any | `GET /entries` | Entry |
| 4 | Approve entry | Supervisor+ | `POST /entries/{id}/approve` | Entry |
| 5 | Reject entry | Supervisor+ | `POST /entries/{id}/reject` | Entry |
| 6 | Generate AI summary | Any | `POST /entries/{id}/summary` | Entry |
| 7 | Generate alerts (auto) | System | — | Alert |

**States:** submitted → approved / rejected / needs_revision

### 4.2 Attendance Workflow

| Step | Description | Role | API |
|---|---|---|---|
| 1 | Punch in | Any | `POST /attendance/punch` |
| 2 | Punch out | Any | `POST /attendance/punch` |
| 3 | View live board | Supervisor+ | `GET /attendance/live` |
| 4 | Submit regularization | Any | `POST /attendance/me/regularizations` |
| 5 | Review queue | Supervisor+ | `GET /attendance/review` |
| 6 | Approve attendance | Supervisor+ | `POST /attendance/review/{id}/approve` |
| 7 | Reject attendance | Supervisor+ | `POST /attendance/review/{id}/reject` |
| 8 | View reports | Accountant+ | `GET /attendance/reports/summary` |

**Record States:** working → completed / absent / half_day / missed_punch  
**Review States:** auto → pending_review → approved / rejected

### 4.3 Steel Inventory Workflow

| Step | Description | Role | API |
|---|---|---|---|
| 1 | Create item | Manager+ | `POST /steel/inventory/items` |
| 2 | Record transaction | Supervisor+ | `POST /steel/inventory/transactions` |
| 3 | View stock | Any | `GET /steel/inventory/stock` |
| 4 | View transactions | Any | `GET /steel/inventory/transactions` |
| 5 | Reconcile stock | Supervisor+ | `POST /steel/inventory/reconciliations` |
| 6 | Approve reconciliation | Admin/Owner | `POST /steel/inventory/reconciliations/{id}/approve` |
| 7 | Reject reconciliation | Admin/Owner | `POST /steel/inventory/reconciliations/{id}/reject` |

**Transaction Types:** inward, adjustment, dispatch_out, production_issue, production_output, return_in, return_out, transfer  
**Reconciliation Status:** pending → approved / rejected

### 4.4 Steel Sales Workflow

| Step | Description | Role | API |
|---|---|---|---|
| 1 | Create customer | Manager+ | `POST /steel/customers` |
| 2 | Verify customer (PAN/GST) | Manager+ | `POST /steel/customers/{id}/verification/review` |
| 3 | Create invoice | Manager+ | `POST /steel/invoices` |
| 4 | Record payment | Manager+ | `POST /steel/customers/payments` |
| 5 | Create dispatch | Manager+ | `POST /steel/dispatches` |
| 6 | Update dispatch status | Supervisor+ | `POST /steel/dispatches/{id}/status` |
| 7 | Track customer ledger | Manager+ | `GET /steel/customers/{id}` |

**Invoice Status:** unpaid → partial / paid  
**Dispatch Status:** pending → loaded → exited / dispatched → delivered / cancelled

### 4.5 Billing Workflow

| Step | Description | Role | API |
|---|---|---|---|
| 1 | View billing status | Admin+ | `GET /billing/status` |
| 2 | Create checkout order | Owner | `POST /billing/orders` |
| 3 | Pay via Razorpay | Owner | External UI |
| 4 | Webhook confirmation | System | `POST /billing/webhook/razorpay` |
| 5 | Sync order | Owner | `POST /billing/orders/{id}/sync` |
| 6 | Schedule downgrade | Owner | `POST /billing/downgrade` |
| 7 | Cancel subscription | Owner | `POST /billing/cancel` |
| 8 | View invoice history | Admin+ | `GET /billing/invoices` |

**Subscription Status:** trialing → active / past_due / suspended / cancelled / inactive

### 4.6 User Management Workflow

| Step | Description | Role | API |
|---|---|---|---|
| 1 | Register | Public | `POST /auth/register` |
| 2 | Verify email | Public | `POST /auth/email/verify` |
| 3 | Login | Registered | `POST /auth/v2/login` |
| 4 | List users | Manager+ | `GET /settings/users` |
| 5 | Invite user | Manager+ | `POST /settings/users/invite` |
| 6 | Update role | Admin+ | `PUT /settings/users/{id}/role` |
| 7 | Update factory access | Admin+ | `PUT /settings/users/{id}/factory-access` |

---

## 5. DEPENDENCY GRAPH

```
                    Auth (no dependencies)
                       │
                       ▼
                  Organization
                       │
                       ▼
                  ┌──────────┐
                  │  Factory  │
                  └──────────┘
                 /      |      \
                ▼       ▼       ▼
           Entry    Attendance   Steel
              │         │         │
              ▼         ▼         ▼
          Alerts    Review      Inventory
              │         │         │
              ▼         ▼         ▼
         Reporting  Regular.   Production
                                   │
                                   ▼
                                Sales
                                   │
                                   ▼
                              Dispatch
                                   │
                                   ▼
                            Customer Ledger

  Billing ──► Subscriptions ──► Feature Gating ──► All Modules

  OCR ──► Entry (via OCR logbook)
```

### Critical Business Paths (in order)

1. **Auth → Factory → Entry → Alert → Report**
   - The primary DPR loop: users log in, submit production data, get alerts, generate reports

2. **Auth → Factory → Steel → Inventory → Production → Sales → Dispatch → Customer Ledger**
   - The complete steel operations value chain

3. **Auth → Factory → Attendance → Punch → Review → Report**
   - Attendance lifecycle

4. **Billing → Subscription → Feature Gating → All features**
   - Monetization layer that gates all capabilities

---

## 6. STATE DIAGRAMS

### 6.1 Entry State Machine
```
                  ┌─────────────┐
                  │  submitted   │
                  └──────┬──────┘
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
        ┌─────────┐ ┌─────────┐ ┌─────────┐
        │approved │ │ rejected│ │needs_rev│
        └─────────┘ └─────────┘ └─────────┘
                                       │
                                       ▼
                                  ┌─────────┐
                                  │submitted│  (resubmit)
                                  └─────────┘
```

### 6.2 Attendance Record State Machine
```
                  ┌──────────────┐
                  │  not_punched  │
                  └──────┬───────┘
                         │ punch_in
                         ▼
                  ┌──────────────┐
                  │   working     │◄────┐
                  └──────┬───────┘     │
                         │             │
                   ┌─────┴─────┐       │
                   │           │       │
                   ▼           ▼       │
            ┌──────────┐ ┌─────────┐   │
            │completed │ │missed   │───┘
            └──────────┘ │_punch   │(next day)
                         └─────────┘
```

### 6.3 Subscription State Machine
```
        trialing ────► active ────► past_due ────► suspended ────► cancelled
            │            │              │
            └────────────┘              │
                (expired)               │
                    │                   │
                    ▼                   ▼
               inactive             grace(3d)
                                       │
                                  ┌────┴────┐
                                  │         │
                                  ▼         ▼
                              active    suspended
                              (paid)    (expired)
```

### 6.4 Dispatch State Machine
```
    pending ──► loaded ──► exited ──► dispatched ──► delivered
       │         │          │             │
       └─────────┴──────────┴─────────────┘
                         │
                         ▼
                    cancelled
```

### 6.5 Steel Reconciliation State Machine
```
    pending ──┬──► approved ──► (automatic inventory adjustment)
              │
              └──► rejected ──► (no action, reason recorded)
```

---

## 7. DATA FLOW MAPS

### 7.1 DPR Entry Data Flow
```
User
  │ Input: units_target, units_produced, manpower, downtime, quality
  ▼
Frontend (entry-detail-page.tsx)
  │ POST /api/entries
  ▼
Backend (entries.py)
  │ validate → sanitize → normalize
  ▼
Service Layer
  │ check_limits → check_plan → check_factory
  ▼
Database (entries table)
  │ INSERT → commit
  ▼
AuditLog (immutable)
  │ action="ENTRY_CREATED"
  ▼
Alert Engine (auto)
  │ LOW_PRODUCTION / HIGH_DOWNTIME / MANPOWER_SHORTAGE
  ▼
Email/WhatsApp (if configured)
```

### 7.2 Steel Dispatch Data Flow
```
User
  │ Input: invoice_id, truck_number, driver, items
  ▼
Frontend (steel-dispatches-page.tsx)
  │ POST /api/steel/dispatches
  ▼
Backend (steel.py: create_steel_dispatch)
  │ validate → check stock → check duplicate truck
  ▼
SteelDispatch (new row)
  │ SteelDispatchLine (multiple rows)
  ▼
Inventory (auto, if status >= exited)
  │ SteelInventoryTransaction: dispatch_out (negative)
  ▼
AuditLog
  │ action="STEEL_DISPATCH_CREATED"
```

### 7.3 Billing Payment Data Flow
```
User (Owner)
  │ Click "Checkout" in billing page
  ▼
Frontend (billing-page.tsx)
  │ POST /api/billing/orders
  ▼
Backend (billing.py)
  │ calculate quote → create Razorpay order
  ▼
External (Razorpay)
  │ User completes payment in Razorpay checkout
  ▼
Backend (webhook)
  │ POST /api/billing/webhook/razorpay (signature verified)
  ▼
PaymentOrder (update status = paid)
  │ Subscription (activate/update)
  │ OrgOCRUsage (reset quota period)
  │ OrgSubscriptionAddon (activate addons)
  │ Invoice (record)
  ▼
AuditLog
  │ action="PLAN_UPGRADED"
```

---

## 8. FAILURE MATRIX

| Workflow | Failure Mode | Impact | Detection | Recovery |
|---|---|---|---|---|
| **Entry** | API returns 500 | Entry lost | Error in UI | Retry with idempotency key |
| **Entry** | SQL constraint violation | Duplicate entry | 409 Conflict | Client dedup by client_request_id |
| **Entry** | AI summary timeout | No summary generated | Async retry | Job queue retries |
| **Attendance** | Punch without factory | 400 Bad Request | Frontend validation | Select factory first |
| **Attendance** | Double punch-in | 409 Conflict | Frontend detects | Return existing record |
| **Attendance** | Cross-midnight shift | Wrong day assignment | Shift inference logic | Manual regularization |
| **Steel** | Transaction makes stock negative | 400 Bad Request | Balance check before commit | Adjust or create inward first |
| **Steel** | Duplicate invoice number | 409 Conflict | Unique constraint | Auto-generate fallback |
| **Steel** | Self-approval of reconciliation | 403 Forbidden | assert_not_self_approval | Different user must approve |
| **Billing** | Razorpay webhook signature fails | 400 Invalid signature | `verify_webhook_signature` | Check credentials |
| **Billing** | Duplicate webhook event | Ignored gracefully | `event_id` dedup | Returns idempotent: true |
| **Billing** | Order already paid | 409 Conflict | Idempotency key check | Refresh billing page |
| **OCR** | Unsupported file format | 400 Bad Request | Extension whitelist | Upload JPG/PNG/WEBP/PDF |
| **OCR** | AI vision failure | OCR fails | Error in pipeline | Retry or manual entry |
| **Auth** | Rate limit exceeded (5/min) | Temporary block | IP-based tracking | Wait 60 seconds |
| **Auth** | Token expired | 401 Unauthorized | JWT expiry check | Refresh token |
| **Auth** | Email delivery fails | Verification link not sent | logging | Resend verification |
| **Any** | org_id mismatch in token | 401 Unauthorized | Session validation | Re-login |
| **Any** | Factory not selected | 400 Bad Request | Factory resolver | Select factory first |

### Key Financial Risks

1. **Billing webhook processing exception** — Could miss payment confirmation. Mitigation: manual sync endpoint (`POST /billing/orders/{id}/sync`).
2. **Subscription state drift** — Razorpay state vs local DB could diverge. Mitigation: `normalize_subscription_record` on every status check.
3. **OCR scan overuse** — Billing impact if usage tracking fails. Mitigation: `force_reset` logic on plan change.
4. **Steel inventory negative balance loophole** — Threshold at -0.01, but race condition possible. Mitigation: serialized DB transactions.

---

## 9. TEST STRATEGY

### 9.1 Testing Order (by Business Criticality)

**Phase 1 — Core Auth & Tenancy (BLOCKING)**
- Registration → Email verification → Login → JWT refresh → Factory selection
- Multi-tenant isolation (org_id scoping on ALL queries)
- Role-based access control (every endpoint with permissions)

**Phase 2 — DPR Entry (CRITICAL BUSINESS PATH)**
- Create entry → Approve → Reject → Smart input → AI summary
- Rate limiting on submission
- Alert generation on low production/high downtime

**Phase 3 — Steel Operations (CRITICAL BUSINESS PATH)**
- Full end-to-end: Create item → Record transaction → View stock → Reconcile → Approve
- Full end-to-end: Create customer → Create invoice → Record payment → Create dispatch → Track delivery
- Negative stock prevention
- Self-approval prevention
- Financial data redaction (Owner-only)

**Phase 4 — Attendance (HIGH)**
- Punch in → Punch out → View live board → Regularization → Review → Approve/Reject
- Shift inference logic
- Cross-midnight shifts
- Late mark counting

**Phase 5 — Billing (HIGH)**
- Trial creation → Subscription status → Plan upgrade → Downgrade → Cancel
- Feature gating (plan-dependent features blocked)
- OCR quota reset on plan change
- Webhook signature verification + dedup

**Phase 6 — OCR (MEDIUM)**
- Document upload → OCR processing → Verification → Approval → Export
- Template management
- Cell extraction accuracy

**Phase 7 — Reports & Analytics (MEDIUM)**
- PDF generation → Excel export → Weekly/monthly rollups
- Owner-only financial data

**Phase 8 — Alerts & Notifications (MEDIUM)**
- Alert creation → Email delivery → WhatsApp delivery → Read/unread
- Recipient management

**Phase 9 — Settings & Admin (LOW)**
- User invite → Role change → Factory access → Plan override
- Employee profile → Shift template → Reporting manager

### 9.2 Critical End-to-End Test Paths

**C1 — Steel Manufacturing Value Chain:**
```
Login → Select steel factory → Create raw material item
→ Record inward transaction → Create batch → Record production
→ Create finished goods item → Record output → Create invoice
→ Create dispatch → Verify stock reduced → View overview
```

**C2 — Attendance Full Lifecycle:**
```
Login → Select factory → Punch in → Verify working status
→ Punch out → Verify completed → Submit regularization
→ Supervisor login → Review queue → Approve regularization
→ Check report shows updated data
```

**C3 — Billing Integration:**
```
Owner login → View billing status (trialing expected)
→ Start checkout → Verify Razorpay order created
→ Simulate webhook → Verify subscription active
→ Schedule downgrade → Cancel downgrade → Cancel subscription
```

### 9.3 Release Blocking Issues

| Issue Type | Must pass before release |
|---|---|
| Auth flow (register → verify → login) | ✅ BLOCKING |
| Tenant isolation (User A cannot see User B's data) | ✅ BLOCKING |
| Role enforcement (Operator cannot approve entries) | ✅ BLOCKING |
| Billing webhook processing | ✅ BLOCKING |
| Steel inventory negative balance prevention | ✅ BLOCKING |
| Self-approval prevention | ✅ BLOCKING |

### 9.4 Workflow Readiness Scores

| Workflow | Score | Notes |
|---|---|---|
| Auth & Registration | 90/100 | Auth v1 deprecated, v2 solid. Email delivery depends on Resend config |
| DPR Entry | 92/100 | Smart input and AI summary are advanced features, well isolated |
| Attendance | 88/100 | Cross-midnight shift logic has edge cases |
| Steel Inventory | 89/100 | Recent fixes for negative stock threshold, small-variance auto-approve |
| Steel Sales | 85/100 | Purchase workflow (vendor/PO/GRN) NOT IMPLEMENTED |
| Steel Dispatch | 87/100 | Gate pass tracking, inventory auto-post on status change |
| Steel Customers | 82/100 | Bank details recently added for vendor support |
| OCR Pipeline | 80/100 | Template matching, warp scanning, verification workflow |
| Billing | 75/100 | Complex Razorpay integration, multiple fallback strategies |
| Reporting | 85/100 | PDF/Excel generation, owner-only financial redaction |
| Alerts | 80/100 | WhatsApp integration, ops alert detectors |
| Settings | 88/100 | Factory profiles, user management, plan overrides |

---

## 10. TESTING ROADMAP

### Week 1: Foundation
- Day 1-2: Auth + Tenancy + RBAC (Phases 1)
- Day 3-5: DPR Entry + Approval (Phase 2)
- Day 5-7: Reporting + Alerts (Phases 7-8)

### Week 2: Core Business
- Day 8-10: Steel Inventory + Production (Phase 3a)
- Day 10-12: Steel Sales + Dispatch (Phase 3b)
- Day 12-14: Attendance (Phase 4)

### Week 3: Monetization & Advanced
- Day 15-17: Billing + Feature Gating (Phase 5)
- Day 17-19: OCR Pipeline (Phase 6)
- Day 19-21: Settings + Admin (Phase 9)

### Week 4: Hardening
- Day 22-23: Full regression suite
- Day 24-25: Performance/load testing
- Day 26: Security audit
- Day 27: Release candidate testing
- Day 28: Sign-off

---

## 11. RELEASE READINESS BLUEPRINT

### Pre-Release Checklist

- [ ] All 9 testing phases complete
- [ ] All 5 release-blocking issues pass
- [ ] Razorpay webhook signature verification tested end-to-end
- [ ] Email delivery (Resend) configured and tested
- [ ] WhatsApp integration credentials configured
- [ ] Rate limiting configured per plan
- [ ] Database backup strategy in place
- [ ] Audit logging verified (every state change recorded)
- [ ] Multi-tenant isolation verified (cross-org data leak test)
- [ ] JWT token expiry and refresh tested
- [ ] Trial → Paid → Downgrade → Cancel cycle tested
- [ ] OCR quota tracking and enforcement tested

### Known Gaps (NOT FOUND IN REPOSITORY)

1. **Purchase Workflow** — No vendors, purchase orders, GRN, or purchase invoices. Sales side is complete.
2. **Mobile app** — No native mobile client. PWA service worker exists for offline.
3. **Performance benchmarks** — No stress test reports in repository.
4. **API documentation** — No auto-generated OpenAPI docs exposed for external consumers.
5. **CI/CD pipeline** — No deployment pipeline visible in repo (Vercel config present).
6. **Database migrations** — Alembic migrations exist, but no automated migration runner in production startup.
7. **End-to-end tests** — Unit tests exist for several modules, but no Playwright/Cypress e2e tests found.
