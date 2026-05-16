# DPR.ai Detailed Codebase Audit Map

## ROLES
- **Role definition**: `UserRole` enum in `backend/models/user.py` (attendance, operator, supervisor, accountant, manager, admin, owner)
- **Role hierarchy**: `ROLE_ORDER` in `backend/rbac.py` defines power ranking from 0 (attendance) to 6 (owner)
- **Role assignment (Registration)**: `backend/routers/auth.py`: First user in org becomes ADMIN, others default to ATTENDANCE
- **Role assignment (Invite)**: `backend/routers/settings.py`: MANAGER or higher can invite users with specific roles
- **Role update**: `backend/routers/settings.py`: MANAGER or higher can update user roles via `PUT /settings/users/{user_id}/role`
- **Role check (Middleware)**: `backend/middleware/csrf_cookie.py` checks session existence before CSRF validation
- **Role check (Hardcoded strings)**: `backend/routers/ai.py`: `current_user.role == UserRole.ATTENDANCE` (Line 165)
- **Role check (Hardcoded strings)**: `backend/routers/ai.py`: `current_user.role == UserRole.ACCOUNTANT` (Line 604)
- **Role check (Hardcoded strings)**: `backend/routers/entries.py`: `current_user.role == UserRole.ACCOUNTANT` (Line 203)
- **Role check (Hardcoded strings)**: `backend/routers/reports.py`: `current_user.role == UserRole.ACCOUNTANT` (Line 52)
- **Role check (Hardcoded strings)**: `backend/routers/settings.py`: `current_user.role == UserRole.OWNER` (Line 102)

## AUTH GUARDS
- **Global Auth Middleware**: `web/middleware.ts` protects all routes except `/login`, `/register`, and static assets
- **Rate Limit Middleware**: `backend/middleware/security.py` applies to all API routes based on IP and endpoint
- **API: AI Query**: `POST /ai/query` - Authenticated (`get_current_user`)
- **API: AI Anomalies**: `GET /ai/anomalies` - Authenticated (`get_current_user`)
- **API: Attendance Punch**: `POST /attendance/punch` - Authenticated (`get_current_user`)
- **API: Attendance Live**: `GET /attendance/live` - SUPERVISOR or higher (`require_role`)
- **API: Attendance Review**: `GET /attendance/review` - {SUPERVISOR, MANAGER, ADMIN, OWNER} (`require_any_role`)
- **API: Billing Config**: `GET /billing/config` - ADMIN or higher (`require_role`)
- **API: Billing Orders**: `POST /billing/orders` - OWNER (`require_role`)
- **API: Entry Approval**: `POST /entries/{entry_id}/approve` - SUPERVISOR or higher (`require_role`)
- **API: Feedback Review**: `GET /feedback` - {ADMIN, OWNER} (`require_any_role`)
- **API: OCR History**: `GET /ocr/verifications` - Authenticated (`get_current_user`), results scoped to user or org
- **API: OCR Approval**: `POST /ocr/verifications/{id}/approve` - {MANAGER, ADMIN} (checked via `is_manager_or_admin`)
- **API: Steel Overview**: `GET /steel/overview` - OWNER (`require_role`)
- **API: Steel Customers**: `POST /steel/customers` - {MANAGER, ADMIN, OWNER, ACCOUNTANT} (`require_any_role`)
- **API: Steel Dispatch**: `POST /steel/dispatches` - {SUPERVISOR, MANAGER, ADMIN, OWNER} (`require_any_role`)
- **Frontend Page: /dashboard**: UNPROTECTED (Open to all authenticated roles)
- **Frontend Page: /approvals**: SUPERVISOR, MANAGER, ADMIN (via `app-shell.tsx`)
- **Frontend Page: /steel**: MANAGER (via `app-shell.tsx`)
- **Frontend Page: /ai**: OWNER (via `app-shell.tsx`)
- **Frontend Page: /settings**: ADMIN (via `app-shell.tsx`)
- **Frontend Page: /control-tower**: OWNER (via `app-shell.tsx`)

## MODULES AND DATA
- **Attendance Module**: API `backend/routers/attendance.py`, Page `web/src/app/attendance/page.tsx`
- **Entries Module**: API `backend/routers/entries.py`, Page `web/src/app/entry/page.tsx`
- **OCR Module**: API `backend/routers/ocr.py`, Page `web/src/app/ocr/page.tsx`
- **Steel Module**: API `backend/routers/steel.py`, Page `web/src/app/steel/page.tsx`
- **Analytics Module**: API `backend/routers/analytics.py`, Page `web/src/app/analytics/page.tsx`
- **Feedback Module**: API `backend/routers/feedback.py`, Page (Widget only, Review in Settings)
- **Feedback Data**: Read/Written in `backend/routers/feedback.py`, uses `Feedback` model
- **Attendance Data**: Read/Written in `backend/routers/attendance.py`, uses `AttendanceRecord`, `AttendanceEvent`
- **Customer Data**: Read/Written in `backend/routers/steel.py`, uses `SteelCustomer`
- **Finance Data (Invoices)**: Read/Written in `backend/routers/steel.py`, uses `SteelSalesInvoice`
- **Finance Data (Payments)**: Read/Written in `backend/routers/steel.py`, uses `SteelCustomerPayment`
- **OCR Output**: Written in `backend/routers/ocr.py` (Verification records), Read in `backend/services/ocr_document_pipeline.py`
- **Dispatch Data**: Read/Written in `backend/routers/steel.py`, uses `SteelDispatch`
- **Inventory Data**: Read/Written in `backend/routers/steel.py`, uses `SteelInventoryItem`, `SteelInventoryTransaction`

## WORKFLOWS
- **Entry Approval Flow**: Operator submits -> Supervisor approves/rejects (`backend/routers/entries.py`)
- **Attendance Regularization Flow**: User submits -> Supervisor or higher approves (`backend/routers/attendance.py`)
- **OCR Verification Flow**: Operator/System scans -> Manager/Admin approves (`backend/routers/ocr.py`)
- **Steel Reconciliation Flow**: Manager submits -> Admin/Owner approves (`backend/routers/steel.py`)
- **Cross-Org Data Boundary**: `backend/tenancy.py` resolves `org_id` from user context, used for all database filters
- **Platform Access**: `backend/routers/settings.py`: `admin_only_route` (Line 1744) permits organization-wide management

## INCONSISTENCIES
- **OCR Verification**: Frontend allows OPERATOR to see history, but backend `require_any_role` for summary is broader than detail
- **Steel Dispatch**: Frontend restricts to {SUPERVISOR, MANAGER, OWNER}, but backend allows ACCOUNTANT to create invoices/dispatch lines
- **Attendance Review**: Backend allows ACCOUNTANT to see report summary, but not the live review queue
- **Settings Access**: Frontend allows ADMIN to see settings, but some backend routes like `/usage/reconcile` strictly require ADMIN
- **Data Redundancy**: `SteelSalesInvoice` data is exposed via `steel.py` (Management) and `reports.py` (PDF/Excel) with different role sets

## PLATFORM VS COMPANY ACCESS
- **Company Roles (Manager/Supervisor)**: Scoped to `factory_id` or `org_id` in most queries (`backend/routers/steel.py`, `backend/routers/attendance.py`)
- **Platform Roles (Admin/Owner)**: Can access `org_id` level data including billing, multi-factory usage, and organization settings
- **Superuser access**: No explicit "Superuser" role found; ADMIN role in the first created org acts as the primary authority for that org
