# FactoryNerve OS — Product Workspace Topology
> Principal Systems Architecture & Backend Operational Discovery
> Classification: Internal Engineering Intelligence Document
> Scope: Complete route inventory, entity ownership, workflow graphs, role architecture, AI/audit mapping

---

## SECTION 1 — Executive Product Topology Overview

### How FactoryNerve OS Is Structurally Organized

FactoryNerve OS is not a single-domain application. It is a **multi-domain industrial operating graph** where seven distinct operational domains are connected through shared entity relationships, a cross-cutting audit system, a role hierarchy, and an AI processing layer that runs across all domains.

The platform operates under a **multi-tenant, multi-factory architecture**: one Organization contains multiple Factories, each Factory contains Users with Factory-scoped roles, and nearly all data is scoped to `org_id` + `factory_id`. Every backend query enforces this tenancy boundary.

```
Organization (org_id)
  └── Factory (factory_id) [1..N per org]
        └── User (user_id) [role scoped per factory via UserFactoryRole]
              └── All operational data: entries, attendance, OCR, steel, reports
```

### The Seven Operational Domains

**1. WORKFORCE** — Attendance, punch management, shift operations, employee profiles, regularizations
**2. PRODUCTION** — Daily entry recording, shift data, AI-assisted input, production intelligence
**3. DOCUMENT** — OCR ingestion, verification, confidence scoring, template management, export
**4. COMMERCIAL** — Steel invoicing, dispatch, customer ledger, payment tracking, gate pass
**5. INVENTORY** — Steel stock, batch production, reconciliation, inventory transactions
**6. INTELLIGENCE** — AI anomaly detection, NLQ queries, executive summaries, premium analytics
**7. PLATFORM** — Billing, subscription management, settings, user access control, auth

### Cross-Domain Interaction Map

```
PRODUCTION entries ─────────────────────────────────► INTELLIGENCE (anomaly scan)
DOCUMENT OCR ────────────────────────────────────────► APPROVAL (OCR verification queue)
COMMERCIAL invoice ──────────────────────────────────► COMMERCIAL dispatch (fulfillment)
INVENTORY batch ─────────────────────────────────────► COMMERCIAL invoice (line items)
INVENTORY batch ─────────────────────────────────────► INVENTORY reconciliation (variance)
WORKFORCE attendance ────────────────────────────────► WORKFORCE review (regularization)
ALL domains ─────────────────────────────────────────► PLATFORM AuditLog (every mutation)
ALL domains ─────────────────────────────────────────► PLATFORM Jobs (async export/AI)
```

### Operational Lifecycle

The platform's operational day follows this graph:

**Morning:** Operators punch in (Attendance) → record shift entries (Production) → scan paper documents (OCR) → system generates AI summaries and alerts in background

**Midday:** Supervisors review OCR batches (Document Verification) → approve/reject entries (Approvals) → address missed punches (Attendance Review) → check stock discrepancies (Reconciliation)

**Evening:** Managers review dispatch movements (Commercial) → accountants track invoice collections → owners read anomaly signals (Intelligence) → scheduled email summaries fire (Emails)

**Ongoing:** The background job system processes AI summaries, Excel exports, OCR jobs. The ops-alerting system monitors for errors. The attendance absence scheduler fires nightly.

---

---

## SECTION 2 — Complete Route Inventory

### Route Classification Legend
- **Criticality:** P0 = mission-critical (data loss if broken), P1 = operationally blocking, P2 = important, P3 = administrative
- **Auth Gate:** Public, Auth-required, Role-gated
- **Industry Gate:** Universal, Steel-only

---

### AUTH & IDENTITY ROUTES

| Route | Feature Owner | Auth Gate | Primary Users | Backend Owner | Criticality |
|---|---|---|---|---|---|
| `/login` | auth | Public | All | `POST /auth/v2/login` | P0 |
| `/access` | auth | Public redirect | All | Redirect hub | P0 |
| `/register` | auth | Public | New users | `POST /auth/register` | P0 |
| `/forgot-password` | auth | Public | All | `POST /auth/password/forgot` | P1 |
| `/reset-password` | auth | Public (token) | All | `POST /auth/password/reset` | P1 |
| `/verify-email` | auth | Public (token) | New users | `POST /auth/email/verify` | P1 |
| `/profile` | auth | Auth-required | All roles | `GET /auth/me`, `PUT /auth/profile`, `POST /auth/profile-photo` | P2 |
| `/403` | platform | Auth-required | All (error) | Client-side gate | P3 |
| `/offline` | platform | None | All (PWA) | Service Worker | P3 |
| `/onboarding/factory-required` | platform | Auth-required | New orgs | `GET /auth/context` | P1 |

---

### TODAY / OPERATIONAL HUB ROUTES

| Route | Feature Owner | Auth Gate | Primary Users | Backend Owner | Criticality |
|---|---|---|---|---|---|
| `/` (root) | auth | Auth-required | All | Role-based redirect | P0 |
| `/dashboard` | dashboard | Auth-required | operator, manager, admin | `GET /analytics/weekly`, `GET /analytics/monthly`, `GET /alerts`, `GET /entries`, `GET /attendance/me/today` | P0 |
| `/work-queue` | work-queue | Auth-required | operator, supervisor, manager | `GET /entries`, `GET /attendance`, `GET /ocr/verifications`, `GET /alerts` | P0 |
| `/tasks` | work-queue | Auth-required | operator | `GET /entries` (assigned work) | P1 |

**Hidden/Internal routes discovered:**
- `/dashboard` has a **role-fork**: operators see a minimal route, managers/owners get the dynamic management workspace (feature-flag controlled in `features/dashboard/workspaces`)
- `/` root redirects based on `getHomeDestination(role)`: attendance→`/attendance`, operator→`/dashboard`, supervisor→`/approvals`, accountant→`/reports`, manager→`/dashboard`, admin→`/settings`, owner→`/premium/dashboard` or `/control-tower`

---

### ATTENDANCE DOMAIN ROUTES

| Route | Feature Owner | Auth Gate | Primary Users | Backend Owner | Criticality |
|---|---|---|---|---|---|
| `/attendance` | attendance | Auth-required | attendance, operator | `GET /attendance/me/today`, `POST /attendance/punch` | P0 |
| `/attendance/live` | attendance | Auth-required | supervisor, manager | `GET /attendance/live`, React Query 5s polling | P0 |
| `/attendance/review` | attendance | Auth-required | supervisor, manager | `GET /attendance/review`, `POST /attendance/review/{id}/decide`, `POST /attendance/regularizations` | P0 |
| `/attendance/reports` | attendance | Auth-required | accountant | `GET /attendance/report` | P1 |
| `/settings/attendance` | settings | Role-gated (supervisor+) | supervisor, manager, admin, owner | `GET/PUT /attendance/employee-profiles`, `GET/PUT /attendance/shift-templates` | P1 |

**Discovered hidden routes:**
- `/attendance/live` has `?attendance_date=` and `?status=` and `?live=` URL params — these are functional workflow states, not just filters
- `/attendance/review` has `?attendance_date=`, `?focus=`, `?tab=` params — the `focus` param pre-loads a specific record for the review pane (deep-link from live board)

---

### PRODUCTION / ENTRY DOMAIN ROUTES

| Route | Feature Owner | Auth Gate | Primary Users | Backend Owner | Criticality |
|---|---|---|---|---|---|
| `/entry` | entry | Auth-required | operator, supervisor | `GET /entries`, `POST /entries`, `POST /entries/smart` | P0 |
| `/entry/[id]` | entry | Auth-required | operator, supervisor, manager | `GET /entries/{id}`, `POST /entries/{id}/approve`, `POST /entries/{id}/reject`, `GET /reports/insights/entry/{id}/pdf` (async job) | P0 |

**Backend intelligence:** Entry creation triggers background AI summary job (`entry_summary` job kind). Smart input (`POST /entries/smart`) runs AI parse pipeline with rules-engine + Anthropic fallback. Entry approval requires `supervisor` minimum role and blocks self-approval (`assert_not_self_approval`).

---

### OCR DOMAIN ROUTES

| Route | Feature Owner | Auth Gate | Primary Users | Backend Owner | Criticality |
|---|---|---|---|---|---|
| `/ocr` | ocr | Auth-required | operator | Redirect to `/ocr/scan` | P1 |
| `/ocr/scan` | ocr | Auth-required | operator | `POST /ocr/table-excel` (Anthropic pipeline), `POST /ocr/verifications`, `GET /ocr/templates` | P0 |
| `/ocr/verify` | ocr | Auth-required | supervisor, operator | `GET /ocr/verifications`, `GET /ocr/verifications/{id}`, `PUT /ocr/verifications/{id}`, `POST /ocr/verifications/{id}/submit`, `POST /ocr/verifications/{id}/approve`, `POST /ocr/verifications/{id}/reject`, `GET /ocr/verifications/{id}/excel-export` | P0 |
| `/ocr/history` | ocr | Auth-required | operator, supervisor, manager, admin, owner | `GET /ocr/verifications` (filtered list), `GET /ocr/verifications/{id}`, `GET /ocr/verifications/{id}/excel-export` | P1 |
| `/ocr/jobs/[jobId]` | ocr | Auth-required | operator | `GET /jobs/{jobId}` (background job status), `POST /jobs/{jobId}/cancel`, `POST /jobs/{jobId}/retry` | P1 |

**Critical OCR pipeline detail:**
- Scan triggers `POST /ocr/table-excel` — multi-model Anthropic pipeline (Haiku → Sonnet → Opus fallback based on image quality score)
- Creates `OcrVerification` record in state `draft`
- Verification flow: `draft` → `pending` (submitted) → `approved` / `rejected`
- Each state transition writes an `OcrAuditEvent`
- Exports write to `exports/ocr_verifications/` and `exports/ocr_jobs/` directories
- OCR usage is rate-limited and quota-tracked per org per billing period

**Discovered hidden routes:**
- `/ocr/verify?id={id}&step={1-4}&pane={workspace|review}` — step-by-step verification wizard with URL-based state. Steps: 1=upload, 2=extract, 3=review, 4=approve/export
- The `src-v2/workspaces/ocr-execution/` directory contains a governed OCR verification page being built in parallel — not yet in production routing

---

### APPROVAL DOMAIN ROUTES

| Route | Feature Owner | Auth Gate | Primary Users | Backend Owner | Criticality |
|---|---|---|---|---|---|
| `/approvals` | approvals | Auth-required | ALL roles (see below) | `GET /entries` (pending), `POST /entries/{id}/approve`, `POST /entries/{id}/reject`, OCR verification endpoints, attendance regularization endpoints, steel reconciliation endpoints | P0 |

**Approval adapter registry (from ARCHITECTURE.md):**
- `attendance` adapter → attendance regularization records
- `entry` adapter → DPR production entries
- `ocr` adapter → OCR verification records (manager/admin/owner only)
- `reconciliation` adapter → steel stock reconciliation records (admin/owner only)
- `dispatch` adapter → pending (backend approval endpoint not yet wired)
- `batch` adapter → pending (read-only signals only)

The approvals page is the only route where **all roles** appear in `NAV_ROLE_MAP` — but the adapter system filters what each role actually sees. An attendance user sees attendance regularizations. An operator sees their own entry rejections. A supervisor sees OCR and entry approvals. The badge counter on this nav item drives urgent action.

---

### STEEL COMMERCIAL DOMAIN ROUTES

| Route | Feature Owner | Auth Gate | Primary Users | Backend Owner | Criticality |
|---|---|---|---|---|---|
| `/steel` | steel | Role-gated (manager+) | manager, supervisor, owner | `GET /steel/overview`, multiple list endpoints | P0 |
| `/steel/inventory` | steel | Role-gated (manager+) | manager | `GET /steel/stock`, `POST /steel/stock/items`, `PUT /steel/stock/items/{id}` | P0 |
| `/steel/inventory/transactions` | steel | Role-gated (manager+) | manager | `GET /steel/transactions` | P1 |
| `/steel/production/record` | steel | Role-gated (manager+) | manager | `POST /steel/batches`, `GET /steel/stock` (item list) | P0 |
| `/steel/batches` | steel | Role-gated (owner) | owner | `GET /steel/batches` | P1 |
| `/steel/batches/[id]` | steel | Role-gated (owner) | owner | `GET /steel/batches/{id}`, `GET /steel/transactions` (batch-scoped) | P1 |
| `/steel/charts` | steel | Role-gated (owner) | owner | `GET /steel/overview`, chart data derived client-side | P1 |
| `/steel/customers` | steel | Role-gated (accountant+) | accountant, manager, owner | `GET /steel/customers`, `POST /steel/customers`, `POST /steel/payments` | P0 |
| `/steel/customers/[id]` | steel | Role-gated (accountant+) | accountant, manager, owner | `GET /steel/customers/{id}`, `GET /steel/invoices`, `GET /steel/dispatches`, `GET /steel/payments`, `POST /steel/follow-up-tasks`, `POST /steel/customer-verification/upload` | P1 |
| `/steel/invoices` | steel | Role-gated (accountant+) | accountant, manager | `GET /steel/invoices`, `POST /steel/invoices` | P0 |
| `/steel/invoices/[id]` | steel | Role-gated (accountant+) | accountant, manager | `GET /steel/invoices/{id}`, `GET /steel/dispatches` (invoice-scoped) | P1 |
| `/steel/dispatches` | steel | Role-gated (supervisor+) | supervisor, manager, owner | `GET /steel/dispatches`, `POST /steel/dispatches`, `GET /steel/invoices` (for selection) | P0 |
| `/steel/dispatches/[id]` | steel | Role-gated (supervisor+) | supervisor, manager, owner | `GET /steel/dispatches/{id}`, `PUT /steel/dispatches/{id}/status`, `GET /steel/owner-daily-pdf` | P0 |
| `/steel/reconciliations` | steel | Role-gated (supervisor+) | supervisor | `GET /steel/reconciliations`, `POST /steel/reconciliations`, `POST /steel/reconciliations/{id}/approve`, `POST /steel/reconciliations/{id}/reject` | P0 |

**Critical steel domain relationships:**
- Production batch → creates inventory transaction (stock-in for output item) + depletes input item
- Dispatch → validates against invoice remaining weight → posts inventory transaction (stock-out) when status reaches `exited/dispatched/delivered`
- Inventory transaction has `inventory_posted_at` timestamp — the stock ledger is event-sourced
- Reconciliation compares `stock_balance_kg` (calculated from transactions) vs `physical_qty_kg` (manual count)
- Customer payment → allocated against specific invoice lines → updates `outstanding_amount_inr`

---

### REPORTS & INTELLIGENCE ROUTES

| Route | Feature Owner | Auth Gate | Primary Users | Backend Owner | Criticality |
|---|---|---|---|---|---|
| `/reports` | reports | Auth-required (all roles) | all | `GET /reports/insights`, `POST /reports/export/range` (async job), `POST /reports/entry/{id}/pdf` (async job), `GET /ai/executive-summary` (async job) | P1 |
| `/analytics` | analytics | Role-gated (supervisor+, plan-gated) | supervisor, manager, admin, owner | `GET /analytics/weekly`, `GET /analytics/monthly`, `GET /analytics/trends`, `GET /analytics/manager` | P1 |
| `/premium/dashboard` | premium | Role-gated (supervisor+, factory+ plan) | owner, manager (limited) | `GET /premium/dashboard`, `GET /premium/audit-trail`, `GET /premium/executive-pdf`, `GET /steel/overview` (steel layer) | P1 |
| `/email-summary` | emails | Role-gated (accountant+) | accountant, manager, owner | `GET /emails/summary-settings`, `PUT /emails/summary-settings`, `POST /emails/send-summary` | P2 |
| `/ai` | ai | Role-gated (owner, plan-gated) | owner | `GET /ai/usage`, `GET /ai/suggestions`, `GET /ai/anomalies`, `GET /ai/anomalies/preview`, `POST /ai/query` (NLQ), `POST /jobs` (async executive summary) | P2 |

---

### PLATFORM / ADMIN ROUTES

| Route | Feature Owner | Auth Gate | Primary Users | Backend Owner | Criticality |
|---|---|---|---|---|---|
| `/settings` | settings | Role-gated (manager+) | manager, admin, owner | `GET/PUT /settings/factory`, `GET /settings/factories`, `POST /settings/factories`, `GET/POST/PUT/DELETE /settings/users`, `GET/PUT /settings/user/{id}/role`, `GET /settings/templates`, `GET /settings/control-tower` | P1 |
| `/settings/attendance` | settings | Role-gated (supervisor+) | supervisor, manager, admin, owner | `GET/POST/PUT /attendance/employee-profiles`, `GET/PUT /attendance/shift-templates` | P1 |
| `/control-tower` | control-tower | Role-gated (owner) | owner | `GET /settings/control-tower`, `POST /auth/select-factory` | P1 |
| `/plans` | billing | Auth-required (all roles) | all | `GET /plans/pricing`, `GET /billing/status` | P2 |
| `/billing` | billing | Role-gated (admin+) | admin, owner | `GET /billing/status`, `GET /billing/invoices`, `POST /billing/orders`, `POST /billing/downgrade`, `DELETE /billing/downgrade` | P1 |

---

### BACKGROUND / SYSTEM ROUTES (no frontend page)

These routes exist at the backend only and drive async operational systems:

| Backend Route | Kind | Triggered By |
|---|---|---|
| `GET /jobs` | Background job list | `JobsDrawer` component polling |
| `GET /jobs/{id}` | Job status poll | OCR scan page, reports page |
| `POST /jobs/{id}/cancel` | Job cancellation | User action |
| `POST /jobs/{id}/retry` | Job retry | User action or system retry |
| `GET /observability/ready` | Health check | Backend warm-up, PWA |
| `GET /health` | DB health | Monitoring |
| `GET /metrics` | Operational metrics | Internal (token-gated) |
| `POST /webhooks/razorpay` | Payment webhook | Razorpay events |
| `GET /ai/anomalies/preview` | No-quota preview | Reports page anomaly preview |
| `GET /intelligence/requests` | Factory Intelligence Engine | Internal AI feature |
| `POST /feedback` | User feedback | FeedbackWidget, MicroFeedbackPrompt |
| `POST /alerts` | Operational alerts | Entry creation triggers |
| `GET /alerts` | Alert list | Dashboard, Work Queue |
| `POST /auth/select-factory` | Factory context switch | Sidebar factory switcher |
| `POST /auth/logout-all` | Session invalidation | Profile page |
| `GET /auth/active-workflow-template` | Template context | AppShell startup |

---

---

## SECTION 3 — Workspace Classification System

Every workspace in FactoryNerve maps to one of twelve operational workspace types. The classification is based on the **primary cognitive mode** the workspace demands from the user — not the data type displayed.

---

### TYPE 1: REALTIME MONITORING WORKSPACE
**Definition:** The user is observing live operational state. Data refreshes automatically. Primary action is escalation or navigation to a review workspace.
**Routes:** `/attendance/live`, `/work-queue`
**Why:** Attendance live polls the backend every 5 seconds and surfaces missed punches, working counts, and exception rows. Work queue aggregates live pending signals across domains. Neither requires heavy data entry — they require rapid triage decisions.
**Backend signature:** React Query `refetchInterval`, `staleTime: 0`, status aggregation across multiple entity types

---

### TYPE 2: OPERATIONAL FORM WORKSPACE
**Definition:** The user creates or edits a structured operational record. Workflow is sequential. Validation gates progress. The record creation has downstream effects.
**Routes:** `/entry` (new entry), `/steel/production/record`, `/steel/dispatches` (create), `/attendance` (punch form), `/steel/customers` (create), `/steel/invoices` (create)
**Why:** These workspaces are pure data capture. They have required fields, validation logic, pre-fill suggestions, and submit actions that trigger backend state transitions and often background jobs (AI summary, inventory posting).
**Backend signature:** `POST` endpoints, background job queuing on success, `client_request_id` idempotency on entry creation

---

### TYPE 3: QUEUE WORKSPACE (Two-Pane)
**Definition:** The user works through a list of items requiring decisions. Each decision is irreversible or has formal consequences. The user moves sequentially through the queue.
**Routes:** `/approvals`, `/ocr/verify`, `/attendance/review`
**Why:** These workspaces are approval engines. The left pane is the pending queue; the right pane is the decision surface for the selected item. The user never needs to leave the page to complete their workflow. These are the most operationally pressured surfaces in the system — delays here block downstream workflows.
**Backend signature:** Adapter pattern (approvals), multi-endpoint verification flow (OCR), regularization + decision endpoints (attendance review)

---

### TYPE 4: ENTITY LIST WORKSPACE (ERP Table)
**Definition:** The user browses, filters, and acts on a list of business records. Records are paginated or virtualized. Inline actions navigate to detail pages.
**Routes:** `/steel/batches`, `/steel/invoices`, `/steel/customers`, `/steel/dispatches`, `/steel/inventory`, `/steel/inventory/transactions`, `/steel/reconciliations`, `/ocr/history`, `/attendance/reports`
**Why:** These are classic ERP list views. The table is the primary instrument. The user's cognitive task is scanning, filtering, and navigating to detail. High data density, tabular figures, filter persistence matter here.
**Backend signature:** `GET` endpoints with pagination params, filter query params, list DTOs

---

### TYPE 5: ENTITY DETAIL WORKSPACE
**Definition:** The user views or edits a single business record with full context — related records, audit timeline, status transitions, and sub-entity management.
**Routes:** `/entry/[id]`, `/steel/batches/[id]`, `/steel/customers/[id]`, `/steel/invoices/[id]`, `/steel/dispatches/[id]`
**Why:** These workspaces are single-record deep dives. They need sub-tables (invoice lines, dispatch lines, payment history, audit events), status transition controls, and full lineage visibility. The user arrives from a list workspace and returns to it.
**Backend signature:** `GET /{id}` with nested serialization, `PUT/POST` status transitions, `AuditLog` read

---

### TYPE 6: IMMERSIVE SCANNER WORKSPACE
**Definition:** The user is performing a high-focus physical operation (camera scan). The interface must be minimal, distraction-free, and optimized for single-action completion. Navigation rail is hidden.
**Routes:** `/ocr/scan`
**Why:** OCR scanning is a physical workflow — the user is holding a phone or tablet over a paper document. Every extra UI element competes with the scanning task. The `immersiveScannerRoute` flag in the app shell hides the sidebar on this route. Background job creation, upload progress, and camera access are the operational concerns.
**Backend signature:** `POST /ocr/table-excel` (file upload), async job creation, `GET /jobs/{id}` polling

---

### TYPE 7: INTELLIGENCE DASHBOARD WORKSPACE
**Definition:** The user is reading synthesized operational signals — AI-generated summaries, anomaly rankings, trend lines, comparative KPIs. The primary action is not data entry but attention allocation and drill-down navigation.
**Routes:** `/ai`, `/premium/dashboard`, `/analytics`
**Why:** These workspaces are decision-support surfaces. The user is an owner or manager asking "where do I need to look?" The AI layer provides ranked signals. The charts provide trend context. The user's next action is navigating to the specific operational workspace that needs attention.
**Backend signature:** `GET /ai/*` (plan-gated, quota-consuming), `GET /premium/*` (plan-gated), `GET /analytics/*` (plan-gated), caching layer (ANALYTICS_CACHE_TTL, AI_CACHE_TTL)

---

### TYPE 8: OPERATIONAL COMMAND CENTER WORKSPACE
**Definition:** The user has a full-page tabbed workspace that organizes multiple operational sub-domains under one navigation context. Tabs switch between domain lanes without leaving the page.
**Routes:** `/steel` (Steel Hub / Command Center)
**Why:** The steel hub is the operational nerve center for steel factory operations. It aggregates overview signals, tabs into inventory/production/sales/risk lanes, and shows quick actions. It requires simultaneous awareness of multiple entity types without context switching. The tab state is URL-persisted (`?tab=`).
**Backend signature:** Multiple parallel `GET` endpoints on load (`getSteelOverview`, `listSteelStock`, `listSteelBatches`, etc.), tab-based sub-rendering

---

### TYPE 9: OPERATIONAL REPORTING WORKSPACE
**Definition:** The user is generating, filtering, and exporting operational reports. The workspace bridges live data and document export. Background jobs handle heavy exports.
**Routes:** `/reports`, `/attendance/reports`
**Why:** Reports workspaces are export-oriented. The user selects date ranges, applies filters, views aggregated KPIs, and triggers async Excel/PDF generation. The `reports/insights` endpoint does complex server-side aggregation. Exports create background jobs tracked via the `JobsDrawer`.
**Backend signature:** `GET /reports/insights`, `POST /reports/export/range` (job), `POST /jobs/{id}/cancel`, `GET /jobs/{id}` polling

---

### TYPE 10: MULTI-FACTORY COORDINATION WORKSPACE
**Definition:** The user manages or compares multiple factory contexts simultaneously. Factory switching occurs here. Org-level visibility applies.
**Routes:** `/control-tower`
**Why:** Control Tower is the only workspace that operates above the factory level. It shows all factories within the organization, their industry types, member counts, and active context. Factory switching (`POST /auth/select-factory`) happens here and in the sidebar.
**Backend signature:** `GET /settings/control-tower`, `POST /auth/select-factory`, org-scoped user and factory queries

---

### TYPE 11: PLATFORM ADMINISTRATION WORKSPACE
**Definition:** The user manages organizational infrastructure — users, roles, factory configurations, subscription, billing, and system settings.
**Routes:** `/settings`, `/settings/attendance`, `/billing`, `/plans`, `/profile`
**Why:** These workspaces are configuration surfaces. They are low-frequency but high-consequence (user role changes affect every other workspace's permission model). They require confirmation patterns, audit logging, and careful validation.
**Backend signature:** Admin-gated `POST/PUT/DELETE` endpoints, role enforcement via `require_role(UserRole.MANAGER/ADMIN/OWNER)`, full `AuditLog` writes

---

### TYPE 12: AUTH / ONBOARDING WORKSPACE
**Definition:** The user is not yet within the operational context. Auth, registration, email verification, and factory setup happen here.
**Routes:** `/login`, `/access`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, `/onboarding/factory-required`, `/403`, `/offline`
**Why:** These workspaces exist outside the app shell (no sidebar, no topbar). They are the entry points and recovery paths for the system. The `/onboarding/factory-required` route is a critical guard — it catches users who authenticated but have no factory context, preventing them from reaching operational routes.
**Backend signature:** Cookie-based auth (`/auth/v2/login`), token-based verification, `GET /auth/context` for factory resolution

---

### Workspace Type Summary Table

| Route | Workspace Type | Data Density | Realtime | AI Involvement |
|---|---|---|---|---|
| `/dashboard` | Intelligence Dashboard | Medium | Medium (polling) | AI summaries |
| `/work-queue` | Realtime Monitoring | High | High (badge counts) | None |
| `/tasks` | Entity List | Low | Low | None |
| `/attendance` | Operational Form | Low | Low | None |
| `/attendance/live` | Realtime Monitoring | High | **Critical** (5s poll) | None |
| `/attendance/review` | Queue Workspace | High | Low | None |
| `/attendance/reports` | Operational Reporting | Medium | None | None |
| `/entry` | Operational Form | Medium | Low | AI smart input |
| `/entry/[id]` | Entity Detail | Medium | None | AI summary |
| `/ocr/scan` | Immersive Scanner | Low | Medium (job polling) | **Core** (Anthropic) |
| `/ocr/verify` | Queue Workspace | Very High | Low | **Core** (confidence) |
| `/ocr/history` | Entity List | High | None | Confidence signals |
| `/ocr/jobs/[jobId]` | Entity Detail | Low | High (job poll) | None |
| `/approvals` | Queue Workspace | High | Medium | None |
| `/steel` | Command Center | Very High | Low | Anomaly signals |
| `/steel/inventory` | Entity List | High | None | None |
| `/steel/inventory/transactions` | Entity List | Very High | None | None |
| `/steel/production/record` | Operational Form | Medium | None | None |
| `/steel/batches` | Entity List | High | None | Anomaly scoring |
| `/steel/batches/[id]` | Entity Detail | High | None | Anomaly signals |
| `/steel/charts` | Intelligence Dashboard | Medium | None | None |
| `/steel/customers` | Entity List | High | None | None |
| `/steel/customers/[id]` | Entity Detail | Very High | None | Verification AI |
| `/steel/invoices` | Entity List | High | None | None |
| `/steel/invoices/[id]` | Entity Detail | High | None | None |
| `/steel/dispatches` | Operational Form + List | Very High | Low | None |
| `/steel/dispatches/[id]` | Entity Detail | High | None | None |
| `/steel/reconciliations` | Queue Workspace | High | None | Confidence scores |
| `/reports` | Operational Reporting | High | None (async export) | AI executive summary |
| `/analytics` | Intelligence Dashboard | Medium | None | None |
| `/premium/dashboard` | Intelligence Dashboard | Very High | None | AI insights |
| `/email-summary` | Platform Administration | Low | None | AI email generation |
| `/ai` | Intelligence Dashboard | Medium | None | **Core** (all AI features) |
| `/control-tower` | Multi-Factory Coordination | Medium | None | None |
| `/settings` | Platform Administration | Medium | None | None |
| `/settings/attendance` | Platform Administration | Medium | None | None |
| `/billing` | Platform Administration | Low | None | None |
| `/plans` | Platform Administration | Low | None | None |
| `/profile` | Platform Administration | Low | None | None |

---

---

## SECTION 4 — Backend Ownership Mapping

### 4.1 OCR Domain — Full Backend Breakdown

**Primary Backend Router:** `backend/routers/ocr.py` (prefix: `/ocr`)
**Supporting Services:** `ocr_document_pipeline.py`, `ocr_review_cells.py`, `ocr_confidence.py`, `ocr_normalization.py`, `ocr_routing.py`, `ocr_queue.py`, `ocr_cell_adapter.py`, `anthropic_usage.py`

**Core Entities:**
- `OcrVerification` — the primary record: stores headers, rows, confidence matrix, audit events, status, reviewer assignment
- `OcrAuditEvent` — immutable event log per verification record (every status change)
- `OcrTemplate` — factory-specific column templates for structured extraction
- `OcrUsage` / `OrgOcrUsage` — quota tracking per user/org per billing period
- `AiResultCache` — cached AI extraction results (reuse detection via `find_reusable_verification`)

**API Endpoints by Workspace:**
```
POST /ocr/table-excel              ← Scan page: image upload → Anthropic extraction → OcrVerification created
POST /ocr/verifications            ← Scan page: creates OcrVerification from structured result
GET  /ocr/verifications            ← History page, Verify queue: list with filters
GET  /ocr/verifications/{id}       ← Verify workspace: full record with cells + audit events
PUT  /ocr/verifications/{id}       ← Verify workspace: row/cell edits, reviewer notes
POST /ocr/verifications/{id}/submit        ← Verify workspace: draft → pending
POST /ocr/verifications/{id}/approve       ← Verify workspace: pending → approved
POST /ocr/verifications/{id}/reject        ← Verify workspace: pending → rejected
GET  /ocr/verifications/{id}/excel-export  ← History page: generate/download xlsx
GET  /ocr/templates                ← Scan page: factory template list
POST /ocr/templates                ← Settings: create new template
```

**Workflow States:**
```
DRAFT → PENDING (submit) → APPROVED (approve)
                         → REJECTED (reject)
DRAFT → REJECTED (directly, low quality)
```

**Async Jobs:**
- `POST /ocr/table-excel` triggers Anthropic API call synchronously (not async job) but the frontend creates a job wrapper for progress tracking
- `GET /ocr/verifications/{id}/excel-export` streams file response directly (no background job)
- OCR quota consumed via `check_and_record_usage` + `check_and_record_org_usage`

**AI System:** Three-tier Anthropic model selection based on image quality score:
- `score >= 82`: Claude Haiku (fast, cheapest)
- `score 58-81`: Claude Sonnet (balanced)
- `score < 58`: Claude Opus (best quality for poor scans)
- Two-pass correction: if JSON validation fails, a correction pass runs on the next model tier up

**Audit Lineage:** Every `OcrVerification` state transition writes to `OcrAuditEvent` (not the generic `AuditLog`). The audit event includes: `event_type`, `actor`, `created_at`, `reviewer_notes`.

---

### 4.2 Attendance Domain — Full Backend Breakdown

**Primary Backend Router:** `backend/routers/attendance.py` (prefix: `/attendance`)
**Supporting Services:** `attendance_absence_service.py` (scheduled), `steel_service.py` (not attendance)

**Core Entities:**
- `AttendanceRecord` — one per user per day per shift. Tracks punch times, status, worked/late/overtime minutes.
- `AttendanceEvent` — immutable punch-in/punch-out event log (source of truth for time)
- `AttendanceRegularization` — formal correction request (missed punch, timing correction, shift correction, status correction)
- `EmployeeProfile` — extended HR profile per user per factory (department, designation, default shift, joining date)
- `ShiftTemplate` — configurable shift definitions per factory (start/end time, grace period, overtime threshold, cross-midnight flag)

**API Endpoints by Workspace:**
```
GET  /attendance/me/today           ← /attendance page: my punch status
POST /attendance/punch              ← /attendance page: punch in/out
GET  /attendance/live               ← /attendance/live: supervisor board
GET  /attendance/review             ← /attendance/review: exception queue
POST /attendance/review/{id}/decide ← /attendance/review: approve/reject regularization
POST /attendance/regularizations    ← /attendance/review: create regularization request
GET  /attendance/report             ← /attendance/reports: date-range summary
GET  /attendance/employee-profiles  ← /settings/attendance: profile list
POST /attendance/employee-profiles  ← /settings/attendance: create/update profile
GET  /attendance/shift-templates    ← /settings/attendance: shift config
PUT  /attendance/shift-templates/{id} ← /settings/attendance: update shift
```

**Operational Complexity:**
- Shift inference uses configurable `ShiftTemplate` matching current local time to factory timezone (IST by default)
- Cross-midnight shift detection: a night shift punch-out on the next day is correctly attributed to the previous day's record
- The `_worked_minutes`, `_late_minutes`, `_overtime_minutes` calculations run in Python at punch time and are stored on the record
- Late warning system: after 2 late marks in a month, a warning appears; 3+ triggers half-day deduction flag

**Async Systems:**
- `attendance_absence_service.py` runs a **scheduled background service** that fires nightly to mark absent records for users who did not punch in by the end of a shift
- `refetchInterval: 5000` on `/attendance/live` — the frontend polls every 5 seconds when `liveMode` is true

---

### 4.3 Production Entry Domain — Full Backend Breakdown

**Primary Backend Router:** `backend/routers/entries.py` (prefix: `/entries`)
**Supporting Services:** `background_jobs.py`, `ai_router.py`, `ParseService`, `PromptRegistry`

**Core Entities:**
- `Entry` — the DPR record: date, shift, units target/produced, manpower, downtime, materials, quality, notes, AI summary, status
- `Alert` — generated automatically on entry creation when anomaly conditions are met (e.g., quality issues, high downtime)
- `AuditLog` — written on create, approve, reject, summary generation
- `AiResultCache` — stores per-entry AI summaries

**Workflow States:**
```
SUBMITTED → APPROVED (supervisor approve)
          → REJECTED (supervisor reject)
```

**AI Integration — Two Pathways:**
1. **Smart Input** (`POST /entries/smart`): User pastes raw shift text or WhatsApp export. Rules engine parses first. If confidence below threshold, Anthropic fallback runs. Returns structured field pre-fill with confidence score.
2. **AI Summary** (`POST /entries/{id}/summary`): Background job (`entry_summary`) generates a narrative shift summary using Anthropic. Consumed from quota. Stored as `entry.ai_summary`.

**Approval Gate:** `require_role(supervisor)` + `assert_not_self_approval()` — a supervisor cannot approve their own entry. This is a compliance control.

---

### 4.4 Steel Domain — Full Backend Breakdown

**Primary Backend Router:** `backend/routers/steel.py` (prefix: `/steel`)
**Supporting Service:** `backend/services/steel_service.py`

**Core Entities and Relationships:**

```
SteelInventoryItem (item master)
  ├── SteelInventoryTransaction (stock movements — event log)
  └── SteelStockReconciliation (physical count vs ledger)

SteelProductionBatch (batch record)
  ├── consumes: SteelInventoryItem (input_item_id) — stock-out
  └── produces: SteelInventoryItem (output_item_id) — stock-in
      └── both via SteelInventoryTransaction

SteelCustomer (buyer master)
  ├── SteelCustomerFollowUpTask
  ├── SteelCustomerPayment
  │     └── SteelCustomerPaymentAllocation (allocated to invoices)
  └── SteelSalesInvoice
        ├── SteelSalesInvoiceLine (weight_kg, rate_per_kg, line_total)
        └── SteelDispatch
              ├── SteelDispatchLine (invoice_line_id, weight_kg)
              └── triggers SteelInventoryTransaction (stock-out on dispatch)
```

**Inventory Posting Logic:**
- Dispatch status `exited`, `dispatched`, `delivered` → triggers inventory post
- `inventory_posted_at` timestamp prevents double-posting
- `POST /steel/dispatches/{id}/status` checks `_dispatch_status_posts_inventory(status)` before posting

**Financial Access Gate:**
- `can_view_steel_financials()` checks `user.role == UserRole.OWNER`
- Financial fields (revenue, leakage value, profit estimates) are null/hidden for non-owner roles
- The `financial_access` flag is returned in `SteelOverview` response

**Customer Verification System:**
- Customers can upload PAN/GST documents (`POST /steel/customer-verification/upload/{id}/{doc_type}`)
- Documents stored in `var/steel_customer_verification/` directory
- Verification states: `draft` → `format_valid` → `pending_review` → `verified` / `mismatch` / `rejected`
- GST regex validation: `^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$`

**Anomaly System:**
- `build_steel_overview()` computes `ranked_anomalies` — batches ranked by variance between input_quantity_kg and actual_output_kg
- `severity_from_variance()` maps variance percent → `normal` / `watch` / `high` / `critical`
- `responsibility_analytics` groups anomalies by operator, day, and batch

---

### 4.5 Premium / AI Domain — Full Backend Breakdown

**Primary Backend Routers:** `backend/routers/ai.py`, `backend/routers/premium.py`, `backend/routers/analytics.py`, `backend/routers/intelligence.py`

**Plan Gates:**
```
AI Suggestions:     min plan = free (configurable via AI_SUGGESTIONS_MIN_PLAN)
AI Anomalies:       min plan = growth (AI_ANOMALIES_MIN_PLAN)
NLQ queries:        min plan = business (AI_NLQ_MIN_PLAN)
AI Executive:       min plan = factory (AI_EXECUTIVE_MIN_PLAN)
Analytics basic:    min plan = growth (ANALYTICS_BASIC_MIN_PLAN)
Analytics trends:   requires "analytics" feature flag on plan
Analytics manager:  requires "analytics" feature flag + manager role minimum
Premium dashboard:  min plan = factory, supervisor+ role
```

**AI Response Architecture:**
- All AI responses have `ai_used: bool`, `degraded: bool`, `is_fallback: bool`, `provider: str` fields
- If AI provider key is missing or request fails → `is_fallback: true` — system never errors, it degrades gracefully
- Cache layer: `AI_CACHE_TTL = 60s` via Redis/in-memory cache. Cache key includes org_id + factory_id + user_id + feature + params.

**Factory Intelligence Engine (`/intelligence/requests`):**
- Separate async pipeline for document-based intelligence requests (file upload → background processing)
- Not yet surfaced in any frontend navigation route — internal/beta feature

---

### 4.6 Billing / Platform Domain — Full Backend Breakdown

**Primary Backend Router:** `backend/routers/billing.py` (prefix: `/billing`)
**Supporting Services:** `billing_manager.py`, `billing_logger.py`

**Subscription State Machine:**
```
trialing → active (payment captured)
         → grace (payment failed)
         → expired (grace period ended)
active → scheduled_downgrade (owner requests)
       → downgraded (scheduled date reached)
```

**Startup Recovery:** On app startup (`lifespan`), three billing recovery functions run:
1. `normalize_subscription_states()` — fixes any inconsistent subscription states
2. `enforce_expired_grace_periods()` — downgrades orgs whose grace period ended
3. `recover_stale_dispatching_events()` — completes any payment events stuck in processing

**Addon System:**
- Addons are purchasable capabilities (extra OCR scans, extra users, etc.)
- `OrgSubscriptionAddon` tracks active addons with `quantity`, `billing_cycle`, `current_period_end_at`
- `activate_org_addons()` called on successful payment webhook

**Razorpay Integration:**
- `POST /billing/orders` creates a Razorpay order (idempotent via SHA256 of order params)
- `POST /webhooks/razorpay` receives payment confirmation events
- Webhook events stored in `WebhookEvent` table to prevent duplicate processing

---

---

## SECTION 5 — Operational Workflow Graphs

### 5.1 OCR Workflow: Document Ingestion to Verified Export

```
OPERATOR                    SYSTEM                          SUPERVISOR
   │                           │                               │
   ├─ Opens /ocr/scan           │                               │
   ├─ Captures image            │                               │
   ├─ POST /ocr/table-excel ───►│ Image quality scoring         │
   │                           ├─ Model selection (auto-tier)  │
   │                           ├─ Anthropic API call           │
   │                           ├─ JSON extraction              │
   │                           ├─ Confidence matrix built      │
   │                           ├─ OcrVerification created      │
   │                           │  (status: DRAFT)              │
   │◄─ Job ID returned ─────────┤                               │
   │                           │                               │
   ├─ Reviews extracted data    │                               │
   ├─ Edits incorrect cells     │                               │
   ├─ PUT /ocr/verifications/  ─►│ Rows/cells updated           │
   ├─ POST .../submit ─────────►│ Status: PENDING               │
   │                           │ Writes OcrAuditEvent          │
   │                           │                              ◄─┤ Opens /ocr/verify
   │                           │                               ├─ Sees pending queue
   │                           │                               ├─ Reviews cells + confidence
   │                           │                               ├─ POST .../approve ──►│ Status: APPROVED
   │                           │                               │                     │ Writes OcrAuditEvent
   │                           │                              ◄─┤ Export available
   │                           │                               ├─ GET .../excel-export → xlsx download
   │                           │                               │
   ↓                           ↓                               ↓
Status: APPROVED, export complete, records visible in /ocr/history
```

**Cross-system effect:** Approved OCR records feed into reports and analytics as verified data points.

---

### 5.2 Steel Production → Inventory → Invoice → Dispatch Workflow

```
MANAGER (Production)          LEDGER (Inventory)         ACCOUNTANT (Commercial)

1. POST /steel/batches
   input_item_id,
   output_item_id,
   input_qty_kg,
   actual_output_kg
        │
        ├─────────────────────►  SteelInventoryTransaction
        │                        type: batch_consumption (stock-out)
        │                        item: input_item_id
        │                        qty: input_quantity_kg
        │
        ├─────────────────────►  SteelInventoryTransaction
        │                        type: batch_production (stock-in)
        │                        item: output_item_id
        │                        qty: actual_output_kg
        │
        │   stock_balance_kg recalculated from transaction sum
        │
        ▼
   Batch created (batch_code, loss_percent calculated)
        │
        │                                               2. POST /steel/invoices
        │                                                  lines: [{item_id, batch_id,
        │                                                           weight_kg, rate_per_kg}]
        │                                                        │
        │                                                        ├─ SteelSalesInvoice created
        │                                                        ├─ SteelSalesInvoiceLine(s) created
        │                                                        ├─ remaining_weight_kg = weight_kg
        │                                                        │
        │                                          3. POST /steel/dispatches
        │                                             invoice_id, lines:[{invoice_line_id,
        │                                             weight_kg}], truck/driver details
        │                                                        │
        │                                                        ├─ SteelDispatch created (PENDING/DISPATCHED)
        │                                                        ├─ SteelDispatchLine(s) created
        │                                                        ├─ remaining_weight_kg on invoice line decremented
        │                                                        │
        │                                          4. PUT /steel/dispatches/{id}/status
        │                                             status: exited/dispatched/delivered
        │                                                        │
        │                                         ◄──────────────┤
        │                                         SteelInventoryTransaction
        │                                         type: dispatch (stock-out)
        │                                         qty: dispatch total_weight_kg
        │                                         inventory_posted_at = now()
        │
        ▼
   Stock ledger updated, dispatch complete, invoice partially/fully fulfilled
```

---

### 5.3 Attendance Workflow: Punch → Exception → Report

```
OPERATOR                    SYSTEM                     SUPERVISOR          ACCOUNTANT

├─ POST /attendance/punch   │                          │                    │
│  action: "in"             │                          │                    │
│                           ├─ Infer shift from time   │                    │
│                           ├─ Create AttendanceRecord │                    │
│                           ├─ Create AttendanceEvent  │                    │
│                           │  (status: working)       │                    │
│◄─ Today response ─────────┤                          │                    │
│                           │                          │                    │
│   ... shift works ...     │                          │                    │
│                           │                          │                    │
├─ POST /attendance/punch   │                          │                    │
│  action: "out"            │                          │                    │
│                           ├─ Calculate worked_minutes│                    │
│                           ├─ Calculate overtime      │                    │
│                           ├─ Update AttendanceRecord │                    │
│                           │  (status: completed)     │                    │
│◄─ Today response ─────────┤                          │                    │
│                           │                          │                    │
│   MISSED PUNCH CASE:      │                          │                    │
│  Operator forgets punch-out                          │                    │
│                           │ attendance_absence_service│                   │
│                           ├─ Nightly scheduler fires │                    │
│                           ├─ Marks record: missed_punch                  │
│                           │                          │                    │
│                           │                          ├─ Opens /attendance/review
│                           │                          ├─ Sees missed_punch row
│                           │                          │                    │
│◄──────────────────────────┤◄─────────────────────────┤                    │
│ POST /attendance/         │                          │                    │
│  regularizations          │                          │                    │
│  request_type: missed_punch                          │                    │
│  requested_in/out times   │                          │                    │
│                           ├─ AttendanceRegularization created (PENDING)  │
│                           │                          │                    │
│                           │                         ├─ POST .../decide    │
│                           │                         │  decision: approve  │
│                           ├─ AttendanceRecord updated│                    │
│                           ├─ worked_minutes recalc  │                    │
│                           │  (status: completed)     │                    │
│                           │                          │                    │
│                           │                          │                    ├─ GET /attendance/report
│                           │                          │                    │  date_from, date_to
│                           │                          │                    │  Returns: daily totals,
│                           │                          │                    │  punched_in, completed,
│                           │                          │                    │  not_punched, pending_review
```

---

### 5.4 Approvals Workflow: Cross-Domain Queue

```
Entries (status: submitted)          │
Attendance regularizations (pending) │
OCR verifications (pending)          │──► GET /approvals
Steel reconciliations (pending)      │    (unified adapter queue)
                                     │
                                     ▼
                            APPROVALS PAGE
                            Queue shows pending items
                            Adapter decides which endpoint
                                     │
                           ┌─────────┴──────────┐
                           │                    │
                          APPROVE              REJECT
                           │                    │
                    POST ../approve      POST ../reject
                    (varies by adapter)  (varies by adapter)
                           │                    │
                           ▼                    ▼
                    Status updated         Status updated
                    AuditLog written       AuditLog written
                    Badge count reduced    Badge count reduced
```

---

### 5.5 Background Job Lifecycle

```
USER ACTION                 JOB SYSTEM                      USER FEEDBACK

POST /entries (create)  ───► create_job("entry_summary")   ─► JobsDrawer shows job
                             start_job(worker_fn)
                             worker: AI summary generation   
                             update_job(progress, status)
                             
                        ◄─── job.status: "complete"    ◄─── JobsDrawer: badge clears
                             entry.ai_summary populated

POST /reports/export ──────► create_job("reports_excel")
                             start_job(worker_fn)
                             worker: build xlsx, write_job_file()
                             
                        ◄─── job.status: "complete"
                             job.file: {filename, media_type}
                             GET /jobs/{id}/file → download

POST /billing/orders ──────► Payment flow (synchronous)
POST /webhooks/razorpay ───► activate_org_addons() (synchronous in webhook)
```

**Job kinds registered in the system:**
- `entry_summary` — AI narrative summary for a production entry
- `reports_excel_range` — Date-range Excel export of entries
- `reports_entry_pdf` — Single entry PDF export
- `ai_executive_summary` — AI executive summary (cached, plan-gated)
- `ai_anomaly_scan` — (queued via background, cached)
- OCR jobs are tracked but run synchronously during scan

---

---

## SECTION 6 — Entity Relationship Mapping

### Core Entity Registry

```
PLATFORM ENTITIES
├── Organization              org_id (UUID), name, plan
├── Factory                   factory_id, org_id, name, industry_type, workflow_template_key, factory_code
├── User                      id, org_id, role (enum), factory_name, user_code, email
├── UserFactoryRole           user_id, factory_id, org_id, role (factory-scoped role)
├── Subscription              org_id, user_id, plan, status, trial dates, period_end
├── Invoice (billing)         user_id, plan, amount, status, provider_invoice_id
├── PaymentOrder              user_id, provider_order_id, status, idempotency_key
├── OrgSubscriptionAddon      org_id, addon_id, quantity, billing_cycle
├── AuditLog                  user_id, org_id, factory_id, action, details, ip, timestamp
└── Alert                     entry_id, user_id, alert_type, severity, is_read

ATTENDANCE ENTITIES
├── AttendanceRecord          user_id, factory_id, date, shift, status, punch_in/out, worked/late/overtime_minutes
├── AttendanceEvent           user_id, factory_id, record_id, event_type (in/out), event_time
├── AttendanceRegularization  record_id, user_id, request_type, status, requested_times, reviewer
├── EmployeeProfile           user_id, factory_id, org_id, employee_code, department, default_shift
└── ShiftTemplate             factory_id, org_id, shift_name, start/end_time, grace_minutes, cross_midnight

PRODUCTION ENTITIES
├── Entry                     user_id, org_id, factory_id, date, shift, units, manpower, downtime, status, ai_summary
└── AiResultCache             scope, feature, result_hash, payload, created_at

OCR ENTITIES
├── OcrVerification           factory_id, org_id, user_id, status, doc_type_hint, avg_confidence,
│                             headers, original_rows, reviewed_rows, confidence_matrix, source_filename
├── OcrAuditEvent             verification_id, event_type, actor, reviewer_notes, created_at
├── OcrTemplate               factory_id, org_id, factory_name, name, columns (JSON config)
├── OcrUsage                  user_id, period, request_count
└── OrgOcrUsage               org_id, period, ocr_limit, request_count, credit_count

STEEL ENTITIES
├── SteelInventoryItem        factory_id, item_code, name, category (raw_material/wip/finished),
│                             current_rate_per_kg, is_active
├── SteelInventoryTransaction factory_id, item_id, transaction_type, quantity_kg, direction (in/out),
│                             reference_type, reference_id, created_by_user_id
├── SteelStockReconciliation  factory_id, item_id, physical_qty_kg, ledger_qty_kg, variance_kg,
│                             confidence_level, status, mismatch_cause, approver_notes
├── SteelProductionBatch      factory_id, batch_code, production_date, input/output_item_id,
│                             input/expected/actual_output_kg, loss_percent, anomaly_score, anomaly_rank
├── SteelCustomer             factory_id, org_id, customer_code, name, gst_number, pan_number,
│                             credit_limit, verification_status, risk_level, outstanding_amount
├── SteelCustomerPayment      customer_id, invoice_id, amount, payment_mode, reference_number
├── SteelCustomerPaymentAlloc payment_id, invoice_id, amount
├── SteelCustomerFollowUpTask customer_id, invoice_id, title, priority, status, due_date
├── SteelSalesInvoice         factory_id, customer_id, invoice_number, invoice_date, due_date,
│                             status, total_weight_kg, total_amount, payment_terms_days
├── SteelSalesInvoiceLine     invoice_id, item_id, batch_id, weight_kg, rate_per_kg, line_total,
│                             dispatched_weight_kg, remaining_weight_kg
├── SteelDispatch             invoice_id, dispatch_number, gate_pass_number, truck_number,
│                             driver_name, status, total_weight_kg, inventory_posted_at
└── SteelDispatchLine         dispatch_id, invoice_line_id, item_id, weight_kg

AI / INTELLIGENCE ENTITIES
├── AiUsageLog                user_id, org_id, feature, tokens_used, cost_usd, created_at
├── IntelligenceRequest       user_id, org_id, status, filename, content_type, result
├── IntelligenceStageUsage    request_id, stage, tokens, cost
├── FeatureUsage              user_id, org_id, feature, period, used_count
└── OrgFeatureUsage           org_id, feature, period, used_count, limit_count

OPERATIONAL ALERT ENTITIES
├── OpsAlertEvent             path, method, status_code, duration_ms, created_at
└── OpsAlertDailyReport       date, alert_count, error_summary
```

### Entity Lifecycle Summary

| Entity | Created By | Terminal State | Deletable? |
|---|---|---|---|
| `OcrVerification` | Operator (scan) | approved / rejected | No (audit immutable) |
| `OcrAuditEvent` | System (on status change) | — | No (append-only) |
| `AttendanceRecord` | Operator (punch) / System (nightly) | completed / missed_punch | No |
| `AttendanceRegularization` | Operator/Supervisor | approved / rejected | No |
| `Entry` | Operator | approved / rejected | Soft-delete (`is_active=False`) |
| `SteelProductionBatch` | Manager | — (no terminal) | No |
| `SteelDispatch` | Supervisor/Manager | delivered / cancelled | No |
| `SteelStockReconciliation` | Manager | approved / rejected | No |
| `SteelCustomer` | Manager | blocked / inactive | Soft-delete |
| `SteelSalesInvoice` | Accountant/Manager | paid / cancelled | No |
| `AuditLog` | System (every mutation) | — | No (append-only) |
| `Alert` | System (entry triggers) | read | Soft (is_read) |
| `Subscription` | System (billing webhook) | expired | No |

---

## SECTION 7 — Permission & Role Architecture

### The Role Hierarchy

```
ATTENDANCE (rank 0) — Lowest privilege
  Can only: punch in/out, view own attendance, view profile

OPERATOR (rank 1)
  Can: all attendance capabilities + create entries, scan OCR, view own data
  Cannot: approve anything, view other users' data, access management

ACCOUNTANT (rank 2)
  Can: view reports, manage customers, invoices, payments
  Cannot: create entries, access raw entry data, manage users
  Unique: CAN access financial data on steel (customers/invoices)
  Unique: CANNOT access raw production entries (403 on /entries)

SUPERVISOR (rank 3)
  Can: all operator capabilities + approve entries, review attendance,
       verify OCR, view dispatch, stock reconciliation, attendance reports
  Cannot: access financial intelligence, manage users, owner-level analytics

MANAGER (rank 4)
  Can: all supervisor capabilities + create/manage factories, invite users,
       access steel hub, inventory, production record, analytics,
       manage settings, access premium dashboard (limited)
  Cannot: billing management, owner-level financial intelligence, delete factories

ADMIN (rank 5)
  Can: all manager capabilities + billing config, user role management,
       manage admin panel, access all reports
  Cannot: billing plan changes (owner only), owner financial intelligence

OWNER (rank 6) — Highest privilege
  Can: all capabilities + billing/subscription management, premium analytics,
       factory network control, AI insights, financial data access,
       anomaly intelligence, leakage reports, executive PDF
  Note: owners must have `financial_access` flag verified in steel overview
```

### Route Access Matrix by Role

| Route | attendance | operator | accountant | supervisor | manager | admin | owner |
|---|---|---|---|---|---|---|---|
| `/attendance` | ✓ | ✓ | — | — | — | — | — |
| `/attendance/live` | — | — | — | ✓ | ✓ | ✓ | ✓ |
| `/attendance/review` | — | — | — | ✓ | ✓ | ✓ | ✓ |
| `/attendance/reports` | — | — | ✓ | — | — | — | — |
| `/dashboard` | — | ✓ | — | — | ✓ | ✓ | — |
| `/work-queue` | — | ✓ | — | ✓ | ✓ | — | — |
| `/tasks` | — | ✓ | — | — | — | — | — |
| `/entry` | — | ✓ | — | ✓ | — | — | — |
| `/ocr/scan` | — | ✓ | — | — | — | — | — |
| `/ocr/verify` | — | — | — | ✓ | — | — | — |
| `/ocr/history` | — | ✓ | — | ✓ | ✓ | ✓ | ✓ |
| `/approvals` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/steel` | — | — | — | — | ✓ | — | — |
| `/steel/inventory` | — | — | — | — | ✓ | — | — |
| `/steel/production/record` | — | — | — | — | ✓ | — | — |
| `/steel/batches` | — | — | — | — | — | — | ✓ |
| `/steel/charts` | — | — | — | — | — | — | ✓ |
| `/steel/customers` | — | — | ✓ | — | ✓ | — | ✓ |
| `/steel/invoices` | — | — | ✓ | — | ✓ | — | — |
| `/steel/dispatches` | — | — | — | ✓ | ✓ | — | ✓ |
| `/steel/reconciliations` | — | — | — | ✓ | — | — | — |
| `/reports` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/analytics` | — | — | — | ✓ | ✓ | ✓ | ✓ |
| `/premium/dashboard` | — | — | — | — | — | — | ✓ |
| `/email-summary` | — | — | ✓ | — | ✓ | — | ✓ |
| `/ai` | — | — | — | — | — | — | ✓ |
| `/control-tower` | — | — | — | — | — | — | ✓ |
| `/settings` | — | — | — | — | ✓ | ✓ | ✓ |
| `/settings/attendance` | — | — | — | ✓ | ✓ | ✓ | ✓ |
| `/billing` | — | — | — | — | — | ✓ | ✓ |
| `/plans` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/profile` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

### Permission Object (Frontend)

The `Permissions` TypeScript interface carries derived boolean flags:
```typescript
can_view_billing       // admin, owner
can_manage_users       // admin, owner (creates/edits users)
can_view_analytics     // supervisor+ (plan-gated)
can_approve_entries    // supervisor+ (blocks approvals nav for lower roles)
can_export_data        // all roles (but filtered by role scope)
can_manage_billing     // owner only
can_view_admin_panel   // admin, owner
```

These permissions gate navigation items, not just pages. The `can_approve_entries` flag controls whether the `/approvals` route badge appears.

---

---

## SECTION 8 — Realtime & Async Operational Systems

### 8.1 Realtime Systems (Frontend Polling)

| Workspace | Mechanism | Interval | Condition | Backend Endpoint |
|---|---|---|---|---|
| `/attendance/live` | React Query `refetchInterval` | 5,000ms | `liveMode === true` | `GET /attendance/live` |
| `/attendance/live` | React Query `refetchOnWindowFocus` | On focus | `liveMode === true` | `GET /attendance/live` |
| `/work-queue` | React Query stale-then-refetch | Navigational | Badge counts in AppShell | `GET /alerts`, `GET /entries` |
| `/ocr/scan` | Job polling (`GET /jobs/{id}`) | 2,000ms | Job in progress | `GET /jobs/{jobId}` |
| AppShell badge counts | `refetchInterval` | 30,000ms | Always active | `GET /alerts`, approvals count |

**Critical realtime architectural note:** The system does NOT use WebSockets or SSE. All realtime is polling-based. This is a deliberate architectural decision appropriate for factory terminal environments with unreliable connectivity. The cost is staleness tolerance; the benefit is simplicity and offline resilience.

---

### 8.2 Async Background Jobs (Server-Side)

**Job Engine:** `backend/services/background_jobs.py` — custom in-process thread-based job queue. Not Redis/Celery. Jobs are stored in-memory and in the filesystem (`exports/background_jobs/`).

| Job Kind | Trigger | Duration | File Output | Retry Available |
|---|---|---|---|---|
| `entry_summary` | Entry creation | 5–20s (AI call) | None | Yes |
| `reports_excel_range` | Export button click | 2–30s (DB query + xlsx) | `.xlsx` file | Yes |
| `reports_entry_pdf` | PDF export button | 2–10s (PDF render) | `.pdf` file | Yes |
| `ai_executive_summary` | Reports page | 10–30s (AI call) | None (cached) | Yes |
| `ai_anomaly_scan` | AI page | 5–20s | None (cached) | No (direct) |

**JobsDrawer:** A persistent floating component in the app shell that polls `GET /jobs?limit=12` and shows all active/completed/failed jobs for the current user. This is the primary async feedback surface for operators.

---

### 8.3 Scheduled Background Services

| Service | Schedule | Function |
|---|---|---|
| `attendance_absence_service` | Nightly | Marks absent/missed_punch for unfilled shifts |
| `ops_alerting` | Continuous (running service) | Monitors HTTP error rates, fires ops alerts |
| `whatsapp_sender` | On-demand | Sends WhatsApp notifications (attendance alerts) |

The `attendance_absence_service` is the most operationally critical scheduled task — it defines the attendance record state for the next day's review queue. If it fails, missed punches are not flagged, and supervisors cannot process regularizations.

---

### 8.4 Email Queue System

`EmailQueue` model stores pending emails. `send_email()` function in `email_service.py` delivers via SMTP. Email types:
- **User invite** — registration link for new factory member
- **Password reset** — time-limited reset token
- **Email verification** — token-based account verification
- **Scheduled factory summary** — AI-generated operational summary sent to configured recipients

The scheduled summary email pipeline:
1. Admin configures schedule via `PUT /emails/summary-settings`
2. User triggers `POST /emails/send-summary` on-demand from `/email-summary` route
3. Backend generates summary from last N days of entries + AI executive summary
4. Sent to all configured recipients for the factory

---

### 8.5 Offline Operational System

**Files:** `offline-sync-agent.tsx`, `service-worker.tsx`, `/offline` route
**Architecture:**
- Service Worker (via `next-pwa` or manual) caches static assets
- `OfflineSyncAgent` component queues mutations that fail due to network errors
- When connectivity restores, queued mutations are replayed
- The `/offline` page is a fallback for complete connectivity loss

**Operational implication:** The `/entry` (production entry creation) and `/attendance` (punch) routes are the most critical for offline support — these are the workflows that operators perform on the factory floor where connectivity is unreliable.

---

## SECTION 9 — AI & Audit Intelligence Mapping

### 9.1 AI System Inventory

| AI Feature | Route | Backend Endpoint | AI Model | Plan Gate | Human-in-Loop |
|---|---|---|---|---|---|
| Smart Input parse | `/entry` | `POST /entries/smart` | Rules-engine + Anthropic fallback | Free | Yes (user reviews extracted fields) |
| Entry AI summary | `/entry/[id]` | `POST /jobs` (entry_summary) | Anthropic (provider-resolved) | Growth+ | No (informational only) |
| OCR image extraction | `/ocr/scan` | `POST /ocr/table-excel` | Anthropic Haiku/Sonnet/Opus | Any | **Yes** (verification required before use) |
| OCR confidence scoring | `/ocr/verify` | Computed in `ocr_confidence.py` | Structural heuristics | Any | **Yes** (confidence drives review priority) |
| AI suggestions | `/ai` | `GET /ai/suggestions` | Anthropic + fallback | Free+ | No (advisory) |
| AI anomaly detection | `/ai` | `GET /ai/anomalies` | Statistical + Anthropic summary | Growth+ | No (signals, not actions) |
| NLQ queries | `/ai` | `POST /ai/query` | Anthropic | Business+ | No (answers only) |
| Executive summary | `/reports`, `/ai` | `GET /ai/executive-summary` (job) | Anthropic | Factory+ | No (informational) |
| Steel anomaly scoring | `/steel`, `/premium/dashboard` | `build_steel_overview()` | Statistical (Python) | Any (steel only) | Yes (owner reviews) |
| Customer verification | `/steel/customers/[id]` | `POST /steel/customer-verification` | Document analysis | Any (steel only) | **Yes** (manager reviews) |
| Premium insights | `/premium/dashboard` | `_build_insights()` | Statistical (Python) | Factory+ | No |
| Factory Intelligence | (internal) | `POST /intelligence/requests` | Multi-stage pipeline | (beta) | Yes |

### 9.2 AI Trust Architecture

**The Confidence System (OCR):**
- Every OCR cell has a `confidence_score` (0.0–1.0) stored in the confidence matrix
- `avg_confidence` computed as the mean of all extracted cell confidences
- Three tiers used in UI: High (≥0.85), Medium (0.60–0.84), Low (<0.60)
- Low confidence rows require mandatory human review before approval
- The `submit` action is blocked until a minimum review threshold is met

**The Fallback System (all AI features):**
- Every AI endpoint returns `ai_used: bool` — if False, a rules-based or statistical fallback was used
- `degraded: bool` — the AI was called but the result quality was insufficient
- `is_fallback: bool` — the rules engine result was used (no AI call)
- The system never returns an error when AI fails — it degrades to a deterministic fallback
- This is the most important architectural decision for industrial reliability

**The Anomaly System (Steel):**
- `anomaly_score = abs(input_qty_kg - actual_output_kg) / input_qty_kg * 100`
- Ranked batches: top N batches by anomaly score become `ranked_anomalies`
- `severity_from_variance()`: <2% → normal, 2-5% → watch, 5-10% → high, >10% → critical
- These signals feed `/steel` command center, `/premium/dashboard` risk cards, and `/ai` anomaly list

---

### 9.3 Audit System Architecture

**The AuditLog table** is the universal audit backbone. Every state-changing operation across all domains writes a record:

| Action Pattern | Domain | Triggered By |
|---|---|---|
| `ENTRY_CREATED`, `ENTRY_APPROVED`, `ENTRY_REJECTED` | Production | entries router |
| `ATTENDANCE_PUNCHED_IN`, `ATTENDANCE_PUNCHED_OUT` | Attendance | attendance router |
| `ATTENDANCE_REGULARIZATION_DECIDED` | Attendance | attendance router |
| `OCR_VERIFICATION_SUBMITTED`, `_APPROVED`, `_REJECTED` | OCR | ocr router (via OcrAuditEvent) |
| `STEEL_BATCH_CREATED`, `STEEL_BATCH_ANOMALY_FLAGGED` | Steel | steel router |
| `STEEL_DISPATCH_CREATED`, `STEEL_DISPATCH_STATUS_UPDATED` | Steel | steel router |
| `STEEL_RECONCILIATION_SUBMITTED`, `_APPROVED`, `_REJECTED` | Steel | steel router |
| `FACTORY_CREATED`, `FACTORY_UPDATED` | Settings | settings router |
| `USER_INVITED`, `USER_ROLE_UPDATED` | Settings | settings router |
| `PLAN_UPGRADED`, `PLAN_DOWNGRADED` | Billing | billing router |
| `ENTRY_SUMMARY_GENERATED`, `AI_ANOMALY_SCAN_GENERATED` | AI | ai router |
| `SMART_INPUT_USED` | AI | entries router |
| `AI_EXECUTIVE_SUMMARY_GENERATED` | AI | job worker |

**OCR has its own audit table** (`OcrAuditEvent`) because OCR operations require field-level audit granularity (who changed which cell, when, from what value to what value) that the generic `AuditLog` does not support.

**The Premium Audit Trail** (`GET /premium/audit-trail`) queries `AuditLog` filtered by org, factory, and date range — providing owners with a time-ordered operational audit trail across all actions by all users.

---

## SECTION 10 — Operational Criticality Matrix

### Classification Criteria

- **P0 — Mission Critical:** If this workflow breaks, factory operations stop. Revenue-impacting. Data cannot be reconstructed from memory.
- **P1 — Operationally Blocking:** Breaks a supervisor or manager's daily workflow. Causes accumulation of unprocessed work.
- **P2 — Important:** Reduces operational visibility. Managers cannot make informed decisions.
- **P3 — Administrative:** Configuration and intelligence surfaces. Impacts efficiency, not operations.

### Criticality Matrix

| Workflow | Criticality | Frequency | Primary Role | Notes |
|---|---|---|---|---|
| Attendance punch in/out | **P0** | Every shift, every operator | operator | Factory presence record |
| Production entry creation | **P0** | Every shift, every operator | operator | Core DPR — the product's founding purpose |
| OCR document scan | **P0** | Multiple times/day | operator | Paper-to-digital — high velocity |
| OCR verification | **P0** | Multiple times/day | supervisor | Blocks export if stalled |
| Entry approval | **P0** | Multiple times/day | supervisor | Downstream analytics invalid if stalled |
| Steel dispatch creation | **P0** | Multiple times/day (steel) | supervisor, manager | Gate pass required for truck movement |
| Steel dispatch status | **P0** | Per truck movement (steel) | supervisor | Inventory posted only on status update |
| Attendance review | **P1** | Daily | supervisor | Blocked by nightly scheduler missing |
| Reconciliation review | **P1** | Weekly/monthly (steel) | supervisor | Stock ledger trust depends on this |
| Invoice creation | **P1** | Per sale (steel) | accountant, manager | Downstream dispatch impossible without invoice |
| Reports export | **P1** | Daily to weekly | all | Compliance reporting |
| Shift entry AI summary | **P2** | Automatic (background) | manager | Informational — no block if it fails |
| AI anomaly scan | **P2** | On-demand | owner | Signals, not blocking workflows |
| Premium dashboard | **P2** | Daily (owner) | owner | Intelligence surface |
| Billing / subscription | **P2** | Monthly | admin, owner | System continues in grace period |
| Settings / user management | **P2** | Infrequent | admin, owner | Changes affect auth on next login |
| Control tower | **P3** | Weekly | owner | Multi-factory visibility |
| Email summaries | **P3** | Configured schedule | accountant, manager | Automated reporting |
| Analytics trends | **P3** | On-demand | manager, owner | Performance review |

### High-Frequency Workflow Identification

These workflows occur multiple times per shift and are the highest-frequency touchpoints:

1. **Attendance punch** — every operator, every shift start/end (~5–50 punches/day per factory)
2. **Production entry** — every operator, every shift (~3–9 entries/day per factory)
3. **OCR scan** — operators scan paper documents throughout the day (~5–30 scans/day)
4. **OCR verification** — supervisors review pending queue (~5–30 decisions/day)
5. **Entry approval** — supervisors clear queue (~3–9 approvals/day)
6. **Work queue check** — operators check for pending actions at shift start (~5–15 views/day)
7. **Dispatch creation** — steel factories: per truck movement (~2–10 dispatches/day)

---

## SECTION 11 — Frontend Structural Complexity Assessment

For each workspace, the complexity dimensions are rated 1–5 (5 = highest).

| Workspace | UI Complexity | Workflow Complexity | Data Density | Realtime | Table Complexity | Operational Pressure | Audit Pressure | AI Complexity | Total |
|---|---|---|---|---|---|---|---|---|---|
| `/ocr/verify` | 5 | 5 | 5 | 2 | 5 | 5 | 5 | 5 | **37** |
| `/steel` (command center) | 5 | 5 | 5 | 2 | 4 | 4 | 3 | 4 | **32** |
| `/premium/dashboard` | 4 | 3 | 5 | 2 | 4 | 3 | 5 | 5 | **31** |
| `/approvals` | 4 | 5 | 4 | 3 | 4 | 5 | 4 | 2 | **31** |
| `/attendance/live` | 3 | 3 | 4 | 5 | 4 | 5 | 3 | 1 | **28** |
| `/attendance/review` | 3 | 5 | 4 | 2 | 4 | 5 | 4 | 1 | **28** |
| `/steel/dispatches` | 4 | 5 | 4 | 2 | 3 | 5 | 3 | 1 | **27** |
| `/steel/customers/[id]` | 4 | 3 | 5 | 1 | 5 | 3 | 3 | 3 | **27** |
| `/steel/reconciliations` | 3 | 4 | 4 | 1 | 4 | 4 | 4 | 2 | **26** |
| `/reports` | 3 | 3 | 5 | 2 | 5 | 3 | 3 | 4 | **28** |
| `/steel/dispatches/[id]` | 3 | 3 | 4 | 1 | 3 | 4 | 4 | 1 | **23** |
| `/entry/[id]` | 3 | 3 | 3 | 1 | 2 | 3 | 4 | 4 | **23** |
| `/steel/inventory` | 3 | 2 | 5 | 1 | 5 | 3 | 3 | 1 | **23** |
| `/steel/batches` | 2 | 2 | 5 | 1 | 5 | 3 | 3 | 3 | **24** |
| `/steel/invoices/[id]` | 3 | 3 | 4 | 1 | 4 | 3 | 3 | 1 | **22** |
| `/ocr/scan` | 4 | 4 | 2 | 3 | 1 | 5 | 3 | 5 | **27** |
| `/entry` | 3 | 3 | 2 | 1 | 1 | 4 | 3 | 4 | **21** |
| `/ai` | 3 | 2 | 3 | 1 | 2 | 2 | 3 | 5 | **21** |
| `/ocr/history` | 2 | 2 | 4 | 1 | 5 | 3 | 4 | 3 | **24** |
| `/analytics` | 3 | 2 | 3 | 1 | 2 | 2 | 2 | 2 | **17** |
| `/attendance/reports` | 2 | 2 | 4 | 1 | 4 | 2 | 2 | 1 | **18** |
| `/dashboard` | 3 | 2 | 3 | 2 | 2 | 3 | 2 | 3 | **20** |
| `/work-queue` | 2 | 2 | 3 | 4 | 3 | 4 | 2 | 1 | **21** |
| `/settings` | 3 | 3 | 2 | 1 | 2 | 1 | 4 | 1 | **17** |
| `/control-tower` | 2 | 2 | 3 | 1 | 2 | 1 | 2 | 1 | **14** |
| `/billing` | 2 | 3 | 2 | 1 | 2 | 2 | 2 | 1 | **15** |
| `/attendance` | 1 | 2 | 1 | 1 | 1 | 3 | 2 | 1 | **12** |
| `/profile` | 1 | 1 | 1 | 1 | 1 | 1 | 2 | 1 | **9** |

**Complexity Tier 1 (Score ≥ 30):** `/ocr/verify`, `/steel`, `/premium/dashboard`, `/approvals`
**Complexity Tier 2 (Score 25–29):** `/attendance/live`, `/attendance/review`, `/steel/dispatches`, `/ocr/scan`, `/reports`
**Complexity Tier 3 (Score 20–24):** Most steel detail pages, `/entry`, `/ocr/history`, `/work-queue`
**Complexity Tier 4 (Score < 20):** Settings, profiles, administrative surfaces

---

---

## SECTION 12 — Future Workspace Skeleton Generation Guidance

This section does not describe any skeleton design. It maps the operational constraints and structural requirements that skeleton generation must respect for each workspace tier.

---

### 12.1 Tier 1 Critical Workspaces: Required Skeleton Constraints

**`/ocr/verify` — OCR Queue + Verification Workspace**

Skeleton generation must account for:
- **Two-pane mandatory structure**: left pane = pending document queue, right pane = active verification editor. Neither pane can be absent without breaking the workflow.
- **Cell-level interaction model**: The right pane shows a table of extracted rows where individual cells are editable inline. The skeleton must reserve the scrollable data zone for this interaction.
- **Confidence visualization zone**: Every row must have a visual confidence indicator. The skeleton must include a confidence column position.
- **Step-based header**: The workflow has 4 steps (upload → extract → review → approve/export). The header zone must accommodate a step indicator.
- **Multi-action footer**: At least 3 actions available: Submit, Approve, Reject. Status-dependent visibility.
- **URL-state persistence**: `?id=`, `?step=`, `?pane=` params must survive navigation. This is a stateful workspace.
- **Audit timeline slot**: A disclosure zone for viewing OCR audit events on the selected record.
- **AI confidence badge position**: Each row in the queue list needs a confidence badge — not just the table header.

**`/steel` — Command Center**

Skeleton generation must account for:
- **Tab-driven lane structure**: 5 tabs (overview, inventory, production, sales, risk). Each tab renders a different content surface. Tab state is URL-persisted (`?tab=`).
- **Overview metrics strip**: Always-visible KPI strip above the tabs with 4–5 key metrics.
- **Context rail**: Factory name, active plan, financial access indicator must be always visible.
- **Progressive disclosure on sub-tabs**: The inventory tab has a table; the production tab has a form; the sales tab has multiple tables; the risk tab has ranked anomaly cards.
- **Industry gate**: The entire `/steel` domain is only rendered for steel industry factories. Every skeleton must handle the "non-steel factory" empty state gracefully.
- **Financial data visibility gate**: Several data points (revenue, profit, leakage value) are null for non-owner roles. The skeleton must accommodate blank/restricted cells.

**`/premium/dashboard` — Owner Intelligence Workspace**

Skeleton generation must account for:
- **Linked filter bar**: Factory and shift selectors at the top that synchronize all charts and tables below. This is a critical UX contract — changing a filter re-renders the entire page.
- **Multi-chart layout**: Timeline chart, factory performance bars, shift comparison, audit heatmap. Each requires a distinct sized slot.
- **Steel owner risk layer**: Conditionally visible (steel factories only) — a risk card section with 5 cards (money at risk, stock trust, dispatch exposure, anomaly signals, responsibility). Skeleton must handle conditional section visibility.
- **Audit trail table**: A high-density table at the bottom with action, actor, timestamp, factory. Requires sticky header behavior.
- **Plan gate**: Entire page is behind `factory` plan minimum. Skeleton must handle the 402-locked state gracefully.

**`/approvals` — Unified Approval Queue**

Skeleton generation must account for:
- **Adapter-polymorphic content**: The queue shows items from different domains. Each item type has different fields. The skeleton must handle variable item schemas without visual inconsistency.
- **Badge count driver**: The approvals nav badge count is the primary driver for this page's urgency. The skeleton must surface the pending count in the header.
- **Bulk action capability**: Select multiple items, apply action. The skeleton must reserve a bulk toolbar zone.
- **Self-approval prevention**: The backend blocks self-approval. The frontend must communicate this at the row level (not just on submit error).
- **Role-scoped queue**: Different roles see different items. The skeleton must handle the "no items for your role" empty state distinctly from "all items processed" empty state.

---

### 12.2 Tier 2 High-Frequency Workspaces: Required Skeleton Constraints

**`/attendance/live` — Realtime Supervision Board**

- **Live mode indicator**: The pulsing live indicator must be a first-class header element.
- **Row state coloring**: Missed punch rows must be visually distinguished from working/completed/not-punched rows without requiring the user to read the status badge.
- **Filter URL persistence**: `?status=` and `?attendance_date=` filters survive navigation. The skeleton must include a filter zone that reflects active filter state.
- **Review queue navigation**: The primary action from this page is navigating to `/attendance/review` with a pre-focused record. The sticky action bar must always show the review queue button.
- **Polling indicator**: When background refresh is happening, a subtle indicator must be visible. Not a full loading overlay — a badge or icon state change.

**`/steel/dispatches` — Dispatch Creation + History**

- **Dual surface**: The page shows both the creation form AND the recent dispatches list simultaneously. This is not a form OR a list — it is both. The skeleton must accommodate this split.
- **Checklist panel**: The readiness checklist (5 items, ready/not-ready state) must be visible alongside the form — not hidden in a disclosure panel. On mobile, it must be accessible.
- **Invoice selection dependency**: The material weights section depends on which invoice is selected. The skeleton must handle the loading state between invoice selection and line display.
- **Debug panel removal**: The `DispatchDebugPanel` must be absent from the skeleton.

**`/ocr/scan` — Immersive Scanner**

- **Shell-hidden context**: The sidebar and topbar are hidden on this route. The skeleton must work with this minimal chrome.
- **Camera/file input primary**: The primary interaction is image capture or file selection. This must be the dominant skeleton element.
- **Job progress zone**: After submission, a progress indicator and job status zone must appear. The skeleton must accommodate this transition.
- **Template selector**: The user can select an OCR template before scanning. This must be accessible but not dominant.

---

### 12.3 Structural Sensitivity Notes

**Do not fragment the steel domain across separate skeletons without considering:**
- The `industry_type` gate affects every steel route. Non-steel factories will see empty states, not route errors.
- The `financial_access` gate (owner only) means many steel metric slots render empty for all other roles.
- Steel batch anomaly scoring is a statistical field, not an AI call. It is always available but its display depends on having sufficient batch history.

**The attendance domain has a critical implicit dependency:**
- `ShiftTemplate` records must exist for the factory before punch calculations are correct. The `_ensure_default_shift_templates()` function creates defaults automatically, but the first-run experience differs from subsequent runs.
- Timezone-aware punch times (Asia/Kolkata default) affect every timestamp displayed. Skeleton generation must plan for UTC-stored, IST-displayed timestamps throughout.

**The OCR domain has three modes that require distinct skeleton structures:**
1. New scan (draft → pending flow)
2. Continuation of existing draft (loaded from URL `?id=`)
3. History review (read-only approved/rejected records)
The `?step=` and `?pane=` URL params determine which mode is active. Skeleton generation must map each mode separately.

**The approvals queue is the most role-sensitive workspace:**
- An attendance user sees regularization approvals only
- An operator sees their own rejected entry decisions (not really approval work — more like notification)
- A supervisor sees OCR verifications + entry approvals + attendance regularizations
- Skeleton generation must avoid assuming what kind of items will be in the queue

**The reporting domain is plan-stratified:**
- `/reports` basic insights: available on growth+ plan
- AI executive summary on reports: factory+ plan
- Analytics weekly/monthly: growth+ plan
- Analytics trends/manager: requires "analytics" feature flag in plan
- Skeleton generation must handle 402-gated sections gracefully — showing what is locked, not hiding it

---

### 12.4 Cross-Workspace Navigation Contracts

These navigation patterns must be preserved in any skeleton:

| Source | Deep Link Target | Params Carried |
|---|---|---|
| `/attendance/live` → `/attendance/review` | `?attendance_date=`, `?focus={attendance_id}`, `?tab=fix` |
| `/ocr/history` row → `/ocr/verify` | `?id={verification_id}&step=4&pane=workspace` |
| `/approvals` item → respective detail page | Adapter-specific |
| `/steel/customers/[id]` → `/steel/invoices` | `?customer_id=` filter |
| `/steel/invoices/[id]` → `/steel/dispatches` | `?invoice_id=` filter |
| `/steel` (command center) → detail tabs | `?tab=inventory|production|sales|risk` |
| Work queue item → entry/OCR detail | Item-type specific |

These deep links are operational continuity mechanisms — they eliminate the "find the record again" friction when moving between workspaces. Any future skeleton must honor these link contracts.

---

### 12.5 Platform-Level Constraints

**Multi-tenant scoping:** Every query is scoped to `org_id` + `factory_id`. The factory switcher in the sidebar changes the active `factory_id` via `POST /auth/select-factory`. After switching, all data must refresh. This affects every workspace that shows factory-scoped data.

**Role revision tracking:** The `X-Role-Revision` response header contains the user's current role revision. When this changes (admin updates a user's role), the frontend invalidates the session and reloads. Any workspace must be able to gracefully handle a session invalidation mid-operation.

**Plan enforcement on load:** Several workspaces hit plan-gated endpoints. A 402 response indicates the current plan does not support the feature. Skeletons must handle 402 gracefully as an expected application state, not an error.

**Background job persistence:** Job IDs are stored in-memory on the server. After a server restart, job status is lost. The frontend `JobsDrawer` must handle `404` responses on job status polls gracefully.

---

*Document generated from direct analysis of: backend router files, model definitions, navigation registry, role-navigation system, feature module structure, and cross-reference with all 48 frontend route directories.*

*Topology version: 1.0 | Analysis depth: Full codebase scan | Confidence: High*
