# FACTORYNERVE CURRENT ROLE WORKFLOW MATRIX

This document provides a comprehensive map of roles and permissions as actually implemented in the FactoryNerve backend codebase.

## SECTION 1: Role Definitions (from code)

As defined in `backend/models/user.py` and `backend/rbac.py`:

| Role | Rank | Description |
|:---|:---:|:---|
| **ATTENDANCE** | 0 | Basic punch-in/out access. Cannot see production entries. |
| **OPERATOR** | 1 | Production floor staff. Can create/view entries and batches. |
| **ACCOUNTANT** | 2 | Financial and reporting access. Restricted from core production editing. |
| **SUPERVISOR** | 3 | Verification and review role. Can approve entries and dispatches. |
| **MANAGER** | 4 | Factory-level administrator. Manages users, items, and settings. |
| **ADMIN** | 5 | Organization administrator. Full access across all factories in org. |
| **OWNER** | 6 | Highest rank. Only role that can manage billing and org plans. |

**Special Permissions:**
- `is_platform_admin`: A boolean flag on the `User` model allowing access to global system administration (Superadmin).
- `effective_role`: Used in `backend/security.py` to determine the user's role specifically for the active factory context.

---

## SECTION 2: Complete Workflow Inventory

Every unique action discovered in `backend/routers/` with its source location.

### 1. Identity & Auth (`auth.py`, `auth_secure.py`, `phone_auth.py`)
- **Register Account**: `POST /auth/register` (auth.py:530)
- **Login**: `POST /auth/v2/login` (auth_secure.py:157)
- **Logout**: `POST /auth/logout` (auth.py:656)
- **Session Context**: `GET /auth/context` (auth.py:906)
- **Profile Management**: `PUT /auth/profile` (auth.py:935)
- **MFA Setup**: `POST /auth/v2/mfa/setup` (auth_secure.py:317)
- **Phone Verification**: `POST /auth/phone/start-verification` (phone_auth.py:56)

### 2. Core Production (`entries.py`)
- **Submit DPR**: `POST /entries` (entries.py:476)
- **Smart Input (AI)**: `POST /entries/smart` (entries.py:364)
- **Approve Entry**: `POST /entries/{id}/approve` (entries.py:760)
- **Reject Entry**: `POST /entries/{id}/reject` (entries.py:796)
- **Soft Delete Entry**: `DELETE /entries/{id}` (entries.py:1023)

### 3. Attendance Workflow (`attendance.py`)
- **Punch In/Out**: `POST /attendance/punch` (attendance.py:507)
- **Live Roster**: `GET /attendance/live` (attendance.py:659)
- **Review Queue**: `GET /attendance/review` (attendance.py:986)
- **Regularization Request**: `POST /attendance/me/regularizations` (attendance.py:938)
- **Shift Management**: `POST /attendance/settings/shifts` (attendance.py:867)

### 4. OCR & Digitization (`ocr.py`)
- **Extract Logbook**: `POST /ocr/logbook` (ocr.py:1777)
- **Submit for Verification**: `POST /ocr/verifications/{id}/submit` (ocr.py:1718)
- **Approve OCR**: `POST /ocr/verifications/{id}/approve` (ocr.py:1742)
- **Template Creation**: `POST /ocr/templates` (ocr.py:1174)

### 5. Steel Module (`steel.py`)
- **Inventory Transaction**: `POST /steel/inventory/transactions` (steel.py:1062)
- **Production Batch**: `POST /steel/batches` (steel.py:4371)
- **Invoice Creation**: `POST /steel/invoices` (steel.py:3066)
- **Dispatch Gate Pass**: `POST /steel/dispatches` (steel.py:3838)
- **Stock Reconciliation**: `POST /steel/inventory/reconciliations` (steel.py:1146)

### 6. Analytics & Intelligence (`analytics.py`, `ai.py`, `reports.py`)
- **Manager Insights**: `GET /analytics/manager` (analytics.py:256)
- **AI Anomalies**: `GET /ai/anomalies` (ai.py:744)
- **Natural Language Query**: `POST /ai/query` (ai.py:867)
- **Executive Summary**: `GET /ai/executive-summary` (ai.py:917)
- **Excel Export**: `GET /reports/excel-range` (reports.py:1030)

### 7. Organization & Billing (`billing.py`, `settings.py`)
- **Order Plan**: `POST /billing/orders` (billing.py:766)
- **Sync Billing**: `POST /billing/orders/{id}/sync` (billing.py:935)
- **Invite User**: `POST /settings/users/invite` (settings.py:837)
- **Update Role**: `PUT /settings/users/{id}/role` (settings.py:1113)
- **Override Org Plan**: `PUT /settings/org/plan` (settings.py:1243)

---

## SECTION 3: Current Permission Matrix

What the code ACTUALLY enforces (checks per endpoint).

| Workflow / Action | ATT | OPR | ACC | SUP | MGR | ADM | OWN | P-ADM |
|:--- |:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Identity/Profile** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Punch Attendance** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Submit Production Entry** | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **AI Smart Input** | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Approve/Reject Entry** | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Live Attendance View** | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Review Attendance** | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Manage Shifts/Employees** | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| **OCR Extraction** | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Approve OCR Records** | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Steel Stock View** | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Create Steel Batch** | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Steel Reconciliation (Sub)** | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Steel Reconciliation (App)** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Steel Invoice/Dispatch** | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **AI Insights/Anomalies** | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Analytical Dashboards** | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Reports (PDF/Excel)** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **User/Factory Management** | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Billing/Subscriptions** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Order/Downgrade Plan** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Platform Analytics/Audit** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## SECTION 4: Gap Analysis

### 1. Inconsistent "Office" Role Access
- **The Gap**: `ACCOUNTANT` role is sometimes included in `require_any_role` (Steel overview, Emails) but explicitly blocked in others (Smart Input, Entry creation).
- **Reality**: The code treats ACCOUNTANT as a viewer for most things but inconsistently grants "Office" access.

### 2. Supervisor vs. Manager on Digitization
- **The Gap**: `OPERATOR` can submit OCR drafts, but only `MANAGER+` can approve them (`ocr.py:1744`).
- **Reality**: `SUPERVISOR` is bypassed in the OCR workflow, while they are the primary approver for manual Entries.

### 3. Steel Financial Redaction
- **The Gap**: `steel.py` has complex manual redaction logic for financials (`_redact_steel_overview_financials`).
- **Reality**: This is enforced via `if user.role == UserRole.OWNER`. Other administrative roles (MANAGER, ADMIN) are blocked from seeing margins/rates, which might hinder legitimate management tasks.

### 4. Self-Approval Guardrails
- **The Gap**: `assert_not_self_approval` is used in `entries.py` and `attendance.py`, but missing in several `steel.py` update routes (Dispatch status, Batch updates).

---

## SECTION 5: Safe Migration Plan

### Step 1: Standardize "Office" and "Management" Role Sets
Create constants in `rbac.py`:
- `MANAGEMENT_ROLES = {MANAGER, ADMIN, OWNER}`
- `REVIEW_ROLES = {SUPERVISOR, MANAGER, ADMIN, OWNER}`
- `FINANCIAL_ROLES = {ACCOUNTANT, ADMIN, OWNER}`

### Step 2: Harmonize Approval Workflows
- Update `ocr.py` to allow `SUPERVISOR` to approve records, aligning with the `entries.py` workflow.
- Ensure `assert_not_self_approval` is applied to ALL state-transition endpoints across Steel, Attendance, and Entries.

### Step 3: Formalize Steel Financial Access
- Move financial visibility logic from hardcoded role checks to a capability check: `can_view_margins(user)`.
- Consider allowing `ADMIN` to see financials, as they outrank `ACCOUNTANT` but currently see less in the Steel module.

### Step 4: Audit Platform Admin Routes
- Move all endpoints requiring `is_platform_admin` to a dedicated `backend/routers/admin_*.py` structure to prevent accidental exposure of Superadmin capabilities in general routers.
