# FactoryNerve (DPR.ai) — Complete Workflow Catalog

> Generated: July 2026  
> Total: **~200 workflows** across 14 categories

---

## Table of Contents

1. [Steel Industry — Dispatch & Logistics](#1-steel-industry--dispatch--logistics)
2. [Steel Industry — Invoicing & Finance](#2-steel-industry--invoicing--finance)
3. [Steel Industry — Customer Management](#3-steel-industry--customer-management)
4. [Steel Industry — Inventory & Stock](#4-steel-industry--inventory--stock)
5. [Steel Industry — Production & BOM](#5-steel-industry--production--bom)
6. [Steel Industry — Intelligence & Analytics](#6-steel-industry--intelligence--analytics)
7. [Production Entries (DPR)](#7-production-entries-dpr)
8. [Attendance & Workforce](#8-attendance--workforce)
9. [OCR & Document Processing](#9-ocr--document-processing)
10. [User Authentication & Account](#10-user-authentication--account)
11. [User & Organization Management](#11-user--organization-management)
12. [Factory Management](#12-factory-management)
13. [Billing & Subscriptions](#13-billing--subscriptions)
14. [Email, Alerts & Notifications](#14-email-alerts--notifications)
15. [Analytics, AI & Intelligence](#15-analytics-ai--intelligence)
16. [Approval Engine (Maker-Checker)](#16-approval-engine-maker-checker)
17. [System, Admin & Cron](#17-system-admin--cron)

---

## 1. Steel Industry — Dispatch & Logistics

**Router:** `backend/routers/steel.py`  
**Models:** `SteelDispatch`, `SteelDispatchLine`

| # | Workflow | Endpoint | Method | Auth | Approval |
|---|----------|----------|--------|------|----------|
| 1 | **Create Dispatch** | `/steel/dispatches` | `POST` | Required | IP-2 (auto-bypass if weight < 5000kg) |
| 2 | **List Dispatches** | `/steel/dispatches` | `GET` | Required | — |
| 3 | **Get Dispatch** | `/steel/dispatches/{dispatch_id}` | `GET` | Required | — |
| 4 | **Update Dispatch Status** | `/steel/dispatches/{dispatch_id}/status` | `POST` | Required | IP-2 (auto-bypass if not cancellation) |
| 5 | **Verify Gate Pass** | `/steel/dispatches/{dispatch_id}/gate-pass/verify` | `POST` | Required | — |
| 6 | **Find Dispatch by Heat Number** | `/steel/dispatches/by-heat-number/{heat_number}` | `GET` | Required | — |
| 7 | **Cancel Dispatch** | Handled via `dispatch.status.update` approval | — | Required | IP-2 (requires approval if cancellation) |

**Dispatch Lifecycle States:** `draft` → `dispatched` → `in_transit` → `delivered` → `cancelled`

**Auto-Bypass Conditions (approval skipped when):**
- `total_weight_kg <= 5000` AND not a cancellation
- Otherwise requires IP-2 single-stage approval

---

## 2. Steel Industry — Invoicing & Finance

**Router:** `backend/routers/steel.py`, `backend/routers/steel_finance.py`  
**Models:** `SteelSalesInvoice`, `SteelSalesInvoiceLine`

| # | Workflow | Endpoint | Method | Approval |
|---|----------|----------|--------|----------|
| 8 | **Create Sales Invoice** | `/steel/invoices` | `POST` | — |
| 9 | **List Invoices** | `/steel/invoices` | `GET` | — |
| 10 | **Get Invoice** | `/steel/invoices/{invoice_id}` | `GET` | — |
| 11 | **Edit Invoice (Pre-Dispatch)** | `/steel/invoices/{invoice_id}` | `PUT` | IP-2 |
| 12 | **Edit Invoice (Post-Dispatch)** | `/steel/invoices/{invoice_id}/post-dispatch` | `PUT` | **IP-3** (two-stage) |
| 13 | **Void Invoice** | `/steel/invoices/{invoice_id}/void` | `POST` | **IP-4** (cross-domain) |
| 14 | **Record Customer Payment** | `/steel/customers/payments` | `POST` | IP-2 (auto-bypass if < ₹50k) |
| 15 | **Reallocate Payment** | `/steel/payments/{id}/reallocate` | `POST` | **IP-3** (two-stage) |
| 16 | **Reverse Payment** | `/steel/payments/{id}/reverse` | `POST` | **IP-4** (cross-domain) |

**Approval Callbacks Registered:**
- `invoice.record.edit_pre_dispatch` → `_on_generic_completed`
- `invoice.record.edit_post_dispatch` → `_on_generic_completed`
- `invoice.record.void` → `_on_generic_completed`
- `payment.record.create` → `_on_generic_completed`
- `payment.record.reallocate` → `_on_generic_completed`
- `payment.record.reverse` → `_on_generic_completed`

---

## 3. Steel Industry — Customer Management

**Router:** `backend/routers/steel.py`  
**Models:** `SteelCustomer`, `SteelCustomerFollowUpTask`

| # | Workflow | Endpoint | Method | Approval |
|---|----------|----------|--------|----------|
| 17 | **List Customers** | `/steel/customers` | `GET` | — |
| 18 | **Create Customer** | `/steel/customers` | `POST` | — |
| 19 | **Get Customer** | `/steel/customers/{customer_id}` | `GET` | — |
| 20 | **Create Follow-Up Task** | `/steel/customers/{customer_id}/tasks` | `POST` | — |
| 21 | **Update Task Status** | `/steel/customers/{customer_id}/tasks/{task_id}/status` | `POST` | — |
| 22 | **Run Verification Check** | `/steel/customers/{customer_id}/verification/run-check` | `POST` | — |
| 23 | **Upload Verification Document** | `/steel/customers/{customer_id}/verification-documents/{document_type}` | `POST` | — |
| 24 | **Download Verification Doc** | `/steel/customers/{customer_id}/verification-documents/{document_type}` | `GET` | — |
| 25 | **Review Customer Verification** | `/steel/customers/{customer_id}/verification/review` | `POST` | IP-2 |

**Approval Callbacks Registered:**
- `customer.verification.review` → `_on_customer_verification_completed`

---

## 4. Steel Industry — Inventory & Stock

**Router:** `backend/routers/steel.py`  
**Models:** `SteelInventoryItem`, `SteelInventoryTransaction`, `SteelStockReconciliation`

| # | Workflow | Endpoint | Method | Approval |
|---|----------|----------|--------|----------|
| 26 | **List Inventory Items** | `/steel/inventory/items` | `GET` | — |
| 27 | **Create Inventory Item** | `/steel/inventory/items` | `POST` | — |
| 28 | **View Stock Levels** | `/steel/inventory/stock` | `GET` | — |
| 29 | **List Stock Transactions** | `/steel/inventory/transactions` | `GET` | — |
| 30 | **Create Stock Transaction** | `/steel/inventory/transactions` | `POST` | — |
| 31 | **Create Reconciliation** | `/steel/inventory/reconciliations` | `POST` | IP-2 (auto-bypass if variance < 5%) |
| 32 | **Get Reconciliation Summary** | `/steel/inventory/reconciliations/summary` | `GET` | — |
| 33 | **List Reconciliations** | `/steel/inventory/reconciliations` | `GET` | — |
| 34 | **Approve Reconciliation** | `/steel/inventory/reconciliations/{id}/approve` | `POST` | IP-2 |
| 35 | **Reject Reconciliation** | `/steel/inventory/reconciliations/{id}/reject` | `POST` | IP-2 |
| 36 | **Calculate Reorder Points** | `/steel/inventory/reorder-points/calculate` | `POST` | Cron trigger |

**Approval Callbacks Registered:**
- `inventory.reconciliation.approve` → `_on_reconciliation_completed` (auto-creates inventory adjustment transaction)
- `inventory.reconciliation.reject` → `_on_reconciliation_completed` (marks as rejected)

**Auto-Bypass:** Reconciliation auto-approved when `variance_percent <= 5%`

---

## 5. Steel Industry — Production & BOM

**Router:** `backend/routers/steel.py`, `backend/routers/steel_bom.py`  
**Models:** `SteelBatch`, `SteelBom`, `SteelProductionLine`, `SteelMachine`

| # | Workflow | Endpoint | Method | Approval |
|---|----------|----------|--------|----------|
| 37 | **List Batches** | `/steel/batches` | `GET` | — |
| 38 | **Get Batch** | `/steel/batches/{batch_id}` | `GET` | — |
| 39 | **Create Production Batch** | `/steel/batches` | `POST` | — |
| 40 | **Approve Batch Variance** | `/steel/batches/{id}/variance` | `POST` | IP-2 (auto-bypass if < 5%) |
| 41 | **Create BOM** | `/steel/bom` | `POST` | — |
| 42 | **List BOMs** | `/steel/bom` | `GET` | — |
| 43 | **Get BOM** | `/steel/bom/{bom_id}` | `GET` | — |
| 44 | **Get BOM by Output Item** | `/steel/bom/by-output/{output_item_id}` | `GET` | — |
| 45 | **Delete BOM** | `/steel/bom/{bom_id}` | `DELETE` | — |
| 46 | **Auto-Fill Batches** | `/steel/production/batches/auto-fill` | `POST` | — |
| 47 | **List Production Lines** | `/steel/production/lines` | `GET` | — |
| 48 | **Create Production Line** | `/steel/production/lines` | `POST` | — |
| 49 | **List Machines** | `/steel/production/machines` | `GET` | — |
| 50 | **Create Machine** | `/steel/production/machines` | `POST` | — |
| 51 | **Update Machine** | `/steel/production/machines/{machine_id}` | `PATCH` | — |
| 52 | **Delete Machine** | `/steel/production/machines/{machine_id}` | `DELETE` | — |
| 53 | **Update Downtime Event** | `/steel/production/machines/downtime-events/{event_id}` | `PATCH` | — |
| 54 | **Delete Downtime Event** | `/steel/production/machines/downtime-events/{event_id}` | `DELETE` | — |
| 55 | **Update Maintenance Task** | `/steel/production/machines/maintenance-tasks/{task_id}` | `PATCH` | — |
| 56 | **Delete Maintenance Task** | `/steel/production/machines/maintenance-tasks/{task_id}` | `DELETE` | — |
| 57 | **Machine Analytics** | `/steel/production/machines/{machine_id}/analytics` | `GET` | — |
| 58 | **List Machine Alerts** | `/steel/production/machine-alerts` | `GET` | — |

**Approval Callbacks Registered:**
- `production.batch.variance.approve` → `_on_generic_completed`

---

## 6. Steel Industry — Intelligence & Analytics

**Router:** `backend/routers/steel_intelligence.py`, `backend/routers/coil_theft.py`  
**Services:** `SteelIntelligence`, `SteelFraudIntelligence`

| # | Workflow | Endpoint | Method |
|---|----------|----------|--------|
| 59 | **Inventory Intelligence** | `/steel/intelligence/inventory` | `GET` |
| 60 | **Quality Intelligence** | `/steel/intelligence/quality` | `GET` |
| 61 | **Sales Intelligence** | `/steel/intelligence/sales` | `GET` |
| 62 | **Owner Dashboard** | `/steel/intelligence/owner/dashboard` | `GET` |
| 63 | **Decision Dashboard** | `/steel/intelligence/decision/dashboard` | `GET` |
| 64 | **Production Intelligence** | `/steel/intelligence/production` | `GET` |
| 65 | **Scrap Loss Intelligence** | `/steel/intelligence/scrap-loss` | `GET` |
| 66 | **Fraud Intelligence** | `/steel/intelligence/fraud` | `GET` |
| 67 | **List Fraud Alerts** | `/steel/intelligence/fraud/alerts` | `GET` |
| 68 | **Fraud Alert Count** | `/steel/intelligence/fraud/alerts/count` | `GET` |
| 69 | **Acknowledge Fraud Alert** | `/steel/intelligence/fraud/alerts/{id}/acknowledge` | `POST` |
| 70 | **Investigate Fraud Alert** | `/steel/intelligence/fraud/alerts/{id}/investigate` | `POST` |
| 71 | **Resolve Fraud Alert** | `/steel/intelligence/fraud/alerts/{id}/resolve` | `POST` |
| 72 | **Detect Coil Theft** | `/steel/coil-theft/detect` | `POST` |
| 73 | **List Coil Theft Alerts** | `/steel/coil-theft/alerts` | `GET` |
| 74 | **Finance Overview** | `/steel/finance/overview` | `GET` |
| 75 | **Product Profitability** | `/steel/finance/product-profitability` | `GET` |
| 76 | **Receivables Aging** | `/steel/finance/receivables` | `GET` |
| 77 | **Payables Aging** | `/steel/finance/payables` | `GET` |
| 78 | **Expenses** | `/steel/finance/expenses` | `GET` |
| 79 | **Cash Flow** | `/steel/finance/cash-flow` | `GET` |
| 80 | **Monthly Cash Flow** | `/steel/finance/cash-flow/monthly` | `GET` |

---

## 7. Production Entries (DPR)

**Router:** `backend/routers/entries.py`  
**Models:** `Entry`

| # | Workflow | Endpoint | Method | Approval |
|---|----------|----------|--------|----------|
| 81 | **Smart Input Entry (AI)** | `/entries/smart` | `POST` | — |
| 82 | **Create Entry** | `/entries` | `POST` | — |
| 83 | **List Entries** | `/entries` | `GET` | — |
| 84 | **Get Today's Entries** | `/entries/today` | `GET` | — |
| 85 | **Get Entry** | `/entries/{entry_id}` | `GET` | — |
| 86 | **Update Entry** | `/entries/{entry_id}` | `PUT` | — |
| 87 | **Delete Entry** | `/entries/{entry_id}` | `DELETE` | IP-2 |
| 88 | **Approve Entry** | `/entries/{entry_id}/approve` | `POST` | IP-2 |
| 89 | **Reject Entry** | `/entries/{entry_id}/reject` | `POST` | IP-2 |
| 90 | **List Defect Reasons** | `/entries/defect-reasons` | `GET` | — |
| 91 | **Get Entry Summary Meta** | `/entries/{entry_id}/summary-meta` | `GET` | — |
| 92 | **Generate AI Summary** | `/entries/{entry_id}/summary` | `POST` | — |
| 93 | **AI Summary (Async Job)** | `/entries/{entry_id}/summary-jobs` | `POST` | — |

**Approval Callbacks Registered:**
- `production.entry.approve` → `_on_entry_completed` (updates entry status to "approved")
- `production.entry.delete` → `_on_entry_completed`

---

## 8. Attendance & Workforce

**Router:** `backend/routers/attendance.py`, `backend/routers/workforce_intelligence.py`  
**Models:** `AttendanceRecord`, `AttendanceEvent`, `AttendanceRegularization`, `ShiftTemplate`

| # | Workflow | Endpoint | Method | Approval |
|---|----------|----------|--------|----------|
| 94 | **Get Today's Attendance** | `/attendance/me/today` | `GET` | — |
| 95 | **Punch In/Out** | `/attendance/punch` | `POST` | — |
| 96 | **Live Attendance View** | `/attendance/live` | `GET` | — |
| 97 | **List Employees** | `/attendance/settings/employees` | `GET` | — |
| 98 | **Create Employee Profile** | `/attendance/settings/employees` | `POST` | — |
| 99 | **Bulk Import Employees** | `/attendance/settings/employees/bulk-import` | `POST` | — |
| 100 | **List Shift Templates** | `/attendance/settings/shifts` | `GET` | — |
| 101 | **Create Shift Template** | `/attendance/settings/shifts` | `POST` | — |
| 102 | **Submit Regularization** | `/attendance/me/regularizations` | `POST` | — |
| 103 | **Attendance Review Queue** | `/attendance/review` | `GET` | — |
| 104 | **Approve Attendance** | `/attendance/review/{attendance_id}/approve` | `POST` | IP-2 |
| 105 | **Force Close Attendance** | `/attendance/review/{attendance_id}/force-close` | `POST` | — |
| 106 | **Reject Attendance** | `/attendance/review/{attendance_id}/reject` | `POST` | IP-2 |
| 107 | **Bulk Approve Attendance** | `/attendance/review/bulk-approve` | `POST` | — |
| 108 | **Attendance Report** | `/attendance/reports/summary` | `GET` | — |
| 109 | **Workforce Overview** | `/workforce/overview` | `GET` | — |
| 110 | **Worker List** | `/workforce/workers` | `GET` | — |
| 111 | **Worker Trend** | `/workforce/workers/{user_id}/trend` | `GET` | — |
| 112 | **Shift Comparison** | `/workforce/shifts/comparison` | `GET` | — |
| 113 | **Cost Summary** | `/workforce/costs/summary` | `GET` | — |
| 114 | **Cost Rates** | `/workforce/costs/rates` | `GET/POST` | — |

**Approval Callbacks Registered:**
- `attendance.review.approve` → `_on_attendance_review_completed`
- `attendance.review.reject` → `_on_attendance_review_completed`

---

## 9. OCR & Document Processing

**Router:** `backend/routers/ocr/`  
**Services:** `ocr_routing`, `ocr_pipeline`

| # | Workflow | Endpoint | Method | Approval |
|---|----------|----------|--------|----------|
| 115 | **Upload & Process OCR** | `/ocr/processing` | `POST` | — |
| 116 | **List Verifications** | `/ocr/verifications` | `GET` | — |
| 117 | **Verification Summary** | `/ocr/verifications/summary` | `GET` | — |
| 118 | **Create Verification** | `/ocr/verifications` | `POST` | — |
| 119 | **Get Verification** | `/ocr/verifications/{verification_id}` | `GET` | — |
| 120 | **Get Source Image** | `/ocr/verifications/{verification_id}/source-image` | `GET` | — |
| 121 | **Export OCR Data** | `/ocr/verifications/{verification_id}/export` | `GET` | — |
| 122 | **Share OCR Link** | `/ocr/verifications/{verification_id}/share-link` | `POST` | — |
| 123 | **Access Shared OCR** | `/ocr/shared/{token}` | `GET` | — |
| 124 | **Update Verification** | `/ocr/verifications/{verification_id}` | `PUT` | — |
| 125 | **Submit for Approval** | `/ocr/verifications/{verification_id}/submit` | `POST` | — |
| 126 | **Approve OCR Verification** | `/ocr/verifications/{verification_id}/approve` | `POST` | IP-2 |
| 127 | **Reject OCR Verification** | `/ocr/verifications/{verification_id}/reject` | `POST` | IP-2 |

**Approval Callbacks Registered:**
- `ocr.verification.approve` → `_on_generic_completed`
- `ocr.verification.reject` → `_on_generic_completed`

---

## 10. User Authentication & Account

**Routers:** `backend/routers/auth_secure.py`, `backend/routers/auth.py`, `backend/routers/auth_google.py`

| # | Workflow | Endpoint | Method |
|---|----------|----------|--------|
| 128 | **Register** | `/auth/register` | `POST` |
| 129 | **Login** | `/auth/login` | `POST` |
| 130 | **Logout** | `/auth/logout` | `POST` |
| 131 | **Logout All Devices** | `/auth/logout-all` | `POST` |
| 132 | **Get Auth Context** | `/auth/context` | `GET` |
| 133 | **Get My Profile** | `/auth/me` | `GET` |
| 134 | **Update Profile** | `/auth/profile` | `PUT` |
| 135 | **Upload Profile Photo** | `/auth/profile-photo` | `POST` |
| 136 | **Delete Profile Photo** | `/auth/profile-photo` | `DELETE` |
| 137 | **Get Profile Photo** | `/auth/profile-photo/{photo_name}` | `GET` |
| 138 | **Change Password** | `/auth/change-password` | `POST` |
| 139 | **Forgot Password** | `/auth/password/forgot` | `POST` |
| 140 | **Reset Password** | `/auth/password/reset` | `POST` |
| 141 | **Validate Reset Token** | `/auth/password/reset/validate` | `GET` |
| 142 | **Resend Email Verification** | `/auth/email/verification/resend` | `POST` |
| 143 | **Verify Email** | `/auth/email/verify` | `POST` |
| 144 | **Validate Email Token** | `/auth/email/verify/validate` | `GET` |
| 145 | **MFA Setup** | `/auth/mfa/setup` | `POST` |
| 146 | **MFA Verify** | `/auth/mfa/verify` | `POST` |
| 147 | **MFA Disable** | `/auth/mfa/disable` | `POST` |
| 148 | **Select Factory** | `/auth/select-factory` | `POST` |
| 149 | **Google Login** | `/auth/google/login` | `GET` |
| 150 | **Google Callback** | `/auth/google/callback` | `GET` |
| 151 | **Phone Start Verification** | `/auth/phone/start-verification` | `POST` |
| 152 | **Phone Confirm Verification** | `/auth/phone/confirm-verification` | `POST` |

---

## 11. User & Organization Management

**Router:** `backend/routers/settings.py`

| # | Workflow | Endpoint | Method | Approval |
|---|----------|----------|--------|----------|
| 153 | **Invite User** | `/settings/users/invite` | `POST` | IP-2 |
| 154 | **List Users** | `/settings/users` | `GET` | — |
| 155 | **Update User Role** | `/settings/users/{user_id}/role` | `PUT` | **IP-4** (cross-domain) |
| 156 | **Update User Plan** | `/settings/users/{user_id}/plan` | `PUT` | — |
| 157 | **Deactivate User** | `/settings/users/{user_id}` | `DELETE` | IP-2 |
| 158 | **Reactivate User** | `/auth/users/{user_id}/reactivate` | `POST` | IP-2 |
| 159 | **Get Factory Access** | `/settings/users/{user_id}/factory-access` | `GET` | — |
| 160 | **Update Factory Access** | `/settings/users/{user_id}/factory-access` | `PUT` | IP-2 |
| 161 | **Update Org Plan** | `/settings/org/plan` | `PUT` | — |

**Approval Callbacks Registered:**
- `user.invite` → `_on_user_invite_completed` (creates user + sends email)
- `user.role.assign` → `_on_generic_completed`
- `user.membership.assign` → `_on_generic_completed`
- `user.deactivate` → `_on_user_deactivate_completed` (sets `is_active=False`, revokes sessions)
- `user.reactivate` → `_on_user_reactivate_completed` (sets `is_active=True`, sends email)

---

## 12. Factory Management

**Router:** `backend/routers/settings.py`

| # | Workflow | Endpoint | Method | Approval |
|---|----------|----------|--------|----------|
| 162 | **Create Factory** | `/settings/factories` | `POST` | IP-2 |
| 163 | **List Factories** | `/settings/factories` | `GET` | — |
| 164 | **Get Factory Settings** | `/settings/factory` | `GET` | — |
| 165 | **Update Factory Settings** | `/settings/factory` | `PUT` | — |
| 166 | **Get Control Tower View** | `/settings/control-tower` | `GET` | — |
| 167 | **Get Factory Profiles** | `/settings/factory-profiles` | `GET` | — |
| 168 | **Get Factory Templates** | `/settings/factory/templates` | `GET` | — |
| 169 | **List Available Plans** | `/plans` | `GET` | — |
| 170 | **Get Permission Manifest** | `/permissions` | `GET` | — |

**Approval Callbacks Registered:**
- `factory.create` → `_on_generic_completed`

---

## 13. Billing & Subscriptions

**Router:** `backend/routers/billing.py`  
**Models:** `Invoice`, `Subscription`, `PaymentOrder`

| # | Workflow | Endpoint | Method | Approval |
|---|----------|----------|--------|----------|
| 171 | **Get Billing Config** | `/billing/config` | `GET` | — |
| 172 | **Get Billing Status** | `/billing/status` | `GET` | — |
| 173 | **List Invoices** | `/billing/invoices` | `GET` | — |
| 174 | **Download Invoice PDF** | `/billing/invoices/{invoice_id}/pdf` | `GET` | — |
| 175 | **Upgrade Plan** | `/billing/orders` | `POST` | — |
| 176 | **Sync Order** | `/billing/orders/{order_id}/sync` | `POST` | — |
| 177 | **Request Downgrade** | `/billing/downgrade` | `POST` | **IP-5** (dual approval) |
| 178 | **Cancel Downgrade** | `/billing/downgrade` | `DELETE` | — |
| 179 | **Razorpay Webhook** | `/billing/webhook/razorpay` | `POST` | — |

**Approval Callbacks Registered:**
- `billing.plan.downgrade` → `_on_generic_completed`
- `billing.plan.change` → `_on_generic_completed`

---

## 14. Email, Alerts & Notifications

**Routers:** `backend/routers/emails.py`, `backend/routers/notifications.py`, `backend/routers/alert_recipients.py`

| # | Workflow | Endpoint | Method |
|---|----------|----------|--------|
| 180 | **Get Email Summary** | `/emails/summary` | `GET` |
| 181 | **Generate AI Email** | `/emails/summary/generate` | `POST` |
| 182 | **Send Summary Email** | `/emails/summary/send` | `POST` (currently disabled) |
| 183 | **Debug Email Config** | `/auth/debug/email-config` | `GET` |
| 184 | **Send Test Email** | `/auth/debug/send-test-email` | `POST` |
| 185 | **List Notifications** | `/notifications` | `GET` |
| 186 | **Get Unread Count** | `/notifications/unread-count` | `GET` |
| 187 | **Get Notification** | `/notifications/{notification_id}` | `GET` |
| 188 | **Get Unread List** | `/notifications/unread` | `GET` |
| 189 | **Mark as Read** | `/notifications/{notification_id}/read` | `PATCH` |
| 190 | **Mark All as Read** | `/notifications/read-all` | `PATCH` |
| 191 | **List Alert Recipients** | `/alert-recipients` | `GET` |
| 192 | **Add Alert Recipient** | `/alert-recipients` | `POST` |
| 193 | **Update Alert Recipient** | `/alert-recipients/{recipient_id}` | `PATCH` |
| 194 | **Delete Alert Recipient** | `/alert-recipients/{recipient_id}` | `DELETE` |
| 195 | **Start Phone Verification** | `/alert-recipients/{recipient_id}/start-verification` | `POST` |
| 196 | **Confirm Phone Verification** | `/alert-recipients/{recipient_id}/confirm-verification` | `POST` |
| 197 | **Send Test Alert** | `/alert-recipients/{recipient_id}/test` | `POST` |
| 198 | **List Alerts** | `/alerts` | `GET` |
| 199 | **Mark Alert as Read** | `/alerts/{alert_id}/read` | `PUT` |

---

## 15. Analytics, AI & Intelligence

**Routers:** `backend/routers/analytics.py`, `backend/routers/ai.py`, `backend/routers/premium.py`, `backend/routers/intelligence.py`, `backend/routers/reports.py`

| # | Workflow | Endpoint | Method |
|---|----------|----------|--------|
| 200 | **Weekly Analytics** | `/analytics/weekly` | `GET` |
| 201 | **Monthly Analytics** | `/analytics/monthly` | `GET` |
| 202 | **Trends** | `/analytics/trends` | `GET` |
| 203 | **Manager Dashboard** | `/analytics/manager` | `GET` |
| 204 | **Natural Language Query** | `/ai/query` | `POST` |
| 205 | **AI Anomalies** | `/ai/anomalies` | `GET` |
| 206 | **AI Anomalies Preview** | `/ai/anomalies/preview` | `GET` |
| 207 | **AI Health Trend** | `/ai/health-trend` | `GET` |
| 208 | **AI Suggestions** | `/ai/suggestions` | `GET` |
| 209 | **AI Usage** | `/ai/usage` | `GET` |
| 210 | **AI Cost Usage** | `/ai/cost-usage` | `GET` |
| 211 | **Executive Summary** | `/ai/executive-summary` | `GET` |
| 212 | **Executive Summary Job** | `/ai/executive-summary/jobs` | `POST` |
| 213 | **Get Job Status** | `/ai/jobs/{job_id}` | `GET` |
| 214 | **Premium Dashboard** | `/premium/dashboard` | `GET` |
| 215 | **Premium Audit Trail** | `/premium/audit-trail` | `GET` |
| 216 | **Executive PDF** | `/premium/executive-pdf` | `GET` |
| 217 | **Submit Intelligence Request** | `/intelligence/requests` | `POST` |
| 218 | **List Intelligence Requests** | `/intelligence/requests` | `GET` |
| 219 | **Get Intelligence Request** | `/intelligence/requests/{request_id}` | `GET` |
| 220 | **Intelligence Usage** | `/intelligence/usage` | `GET` |
| 221 | **Report Insights** | `/reports/insights` | `GET` |
| 222 | **Generate PDF Report** | `/reports/pdf/{entry_id}` | `GET` |
| 223 | **PDF Report (Async Job)** | `/reports/pdf/{entry_id}/jobs` | `POST` |
| 224 | **Sample PDF** | `/reports/sample-pdf` | `GET` |
| 225 | **Excel Export** | `/reports/excel/{entry_id}` | `GET` |
| 226 | **Weekly Report** | `/reports/weekly` | `GET` |
| 227 | **Monthly Report** | `/reports/monthly` | `GET` |
| 228 | **Job Management** | `/jobs` | `GET` |

---

## 16. Approval Engine (Maker-Checker)

**Service:** `backend/services/approval_service.py`  
**Model:** `ApprovalInstance`  
**Router:** `backend/routers/approvals.py`

### Approval Patterns

| Pattern | Name | Workflows | Requirements |
|---------|------|-----------|-------------|
| **IP-2** | Single Stage | Entry approve/delete, attendance review, OCR verify, inventory reconciliation, dispatch status, customer verify, invoice edit (pre-dispatch), payment create, batch variance, factory create, user invite, user deactivate, user reactivate, user membership assign | One approver; auto-bypasses if below threshold |
| **IP-3** | Sequential Two-Stage | `invoice.record.edit_post_dispatch`, `payment.record.reallocate` | L1 → L2; **different person** must approve each stage |
| **IP-4** | Cross-Domain | `user.role.assign`, `payment.record.reverse`, `invoice.record.void` | Admin or Owner only |
| **IP-5** | Critical Dual | `billing.plan.downgrade`, `billing.plan.change` | Owner only |

### Approval API Endpoints

| # | Workflow | Endpoint | Method |
|---|----------|----------|--------|
| 229 | **View My Pending Approvals** | `/approvals/queue/me` | `GET` |
| 230 | **Advance/Reject Approval** | `/approvals/{instance_id}/advance` | `POST` |

### Auto-Bypass Conditions

| Workflow | Condition | Bypasses Approval When |
|----------|-----------|----------------------|
| `inventory.reconciliation.approve` | `variance_percent <= 5%` | Low-variance reconciliations |
| `payment.record.create` | `payment_amount <= ₹50,000 AND not backdated` | Small/current payments |
| `dispatch.status.update` | `NOT is_cancellation` | Non-cancellation status changes |
| `dispatch.record.create` | `total_weight_kg <= 5,000` | Small dispatches |

### Auto-Escalation (on TTL expiry)

- `inventory.reconciliation.approve`
- `inventory.reconciliation.reject`
- `dispatch.status.update`
- `dispatch.record.create`
- `dispatch.record.cancel`

### Auto-Rejection (on TTL expiry)

- `billing.plan.downgrade`
- `billing.plan.change`

---

## 17. System, Admin & Cron

**Routers:** `backend/routers/observability.py`, `backend/routers/cron.py`, `backend/routers/admin_billing.py`, `backend/routers/admin_ai.py`, `backend/routers/dev.py`

### System Health

| # | Workflow | Endpoint | Method |
|---|----------|----------|--------|
| 231 | **Readiness Check** | `/observability/ready` | `GET` |
| 232 | **AI Health** | `/observability/ai/health` | `GET` |
| 233 | **AI Dashboard** | `/observability/ai/dashboard` | `GET` |
| 234 | **AI Governance** | `/observability/ai/governance` | `GET` |
| 235 | **Ops Alerts History** | `/observability/alerts` | `GET` |
| 236 | **Ops Alert Detail** | `/observability/alerts/{ref_id}` | `GET` |
| 237 | **OCR Dashboard** | `/observability/ocr-dashboard` | `GET` |
| 238 | **OCR Costs** | `/observability/ocr-costs` | `GET` |
| 239 | **Frontend Error Logging** | `/observability/frontend-error` | `POST` |

### Cron Jobs

| # | Workflow | Endpoint | Method |
|---|----------|----------|--------|
| 240 | **Daily Maintenance** | `/cron/daily-maintenance` | `POST` |
| 241 | **Process Email Queue** | `/cron/process-email-queue` | `POST` |
| 242 | **Daily Summary** | `/cron/daily-summary` | `POST` |
| 243 | **Auto-Close Attendance** | `/cron/auto-close-attendance` | `POST` |
| 244 | **Auto-Close Attendance Status** | `/cron/auto-close-attendance/status` | `GET` |
| 245 | **Cron Health** | `/cron/health` | `GET` |
| 246 | **Calculate Reorder Points** | `/cron/calculate-reorder-points` | `POST` |

### Admin Endpoints

| # | Workflow | Endpoint | Method |
|---|----------|----------|--------|
| 247 | **Admin: AI Usage** | `/admin/ai/usage` | `GET` |
| 248 | **Admin: AI Cost Summary** | `/admin/ai/cost-summary` | `GET` |
| 249 | **Admin: Billing Events** | `/admin/billing/events` | `GET` |
| 250 | **Admin: Subscriptions** | `/admin/billing/subscriptions` | `GET` |
| 251 | **Admin: Quota View** | `/admin/billing/quota` | `GET` |
| 252 | **Admin: Reset Quota** | `/admin/billing/reset-quota/{org_id}` | `POST` |
| 253 | **Admin: Repair Trial Quotas** | `/admin/billing/repair-trial-quotas` | `GET/POST` |

### Developer / Testing

| # | Workflow | Endpoint | Method |
|---|----------|----------|--------|
| 254 | **View Failure Modes** | `/dev/failures` | `GET` |
| 255 | **Failure Status** | `/dev/status` | `GET` |
| 256 | **Enable Failure Mode** | `/dev/failures/{mode}/enable` | `POST` |
| 257 | **Disable Failure Mode** | `/dev/failures/{mode}/disable` | `POST` |
| 258 | **Enable All Failures** | `/dev/failures/enable-all` | `POST` |
| 259 | **Disable All Failures** | `/dev/failures/disable-all` | `POST` |
| 260 | **Reset Failures** | `/dev/failures/reset` | `POST` |

---

## Approval Callback Registry

All 26 registered workflow callbacks (from `backend/services/approval_callbacks.py`):

| Workflow Key | Callback Function | Side Effect |
|-------------|-------------------|-------------|
| `inventory.reconciliation.approve` | `_on_reconciliation_completed` | Updates status, creates inventory adjustment transaction |
| `inventory.reconciliation.reject` | `_on_reconciliation_completed` | Sets status to "rejected" |
| `customer.verification.review` | `_on_customer_verification_completed` | Updates verification_status, verified_by, verified_at |
| `dispatch.status.update` | `_on_dispatch_status_completed` | Updates dispatch status, sets delivered_at/delivered_by |
| `dispatch.record.create` | `_on_dispatch_create_completed` | Creates inventory movements, finalizes status |
| `production.entry.approve` | `_on_entry_completed` | Updates entry status to "approved" |
| `production.entry.delete` | `_on_entry_completed` | Updates entry status to "deleted" |
| `production.batch.variance.approve` | `_on_generic_completed` | Logs completion (no-op) |
| `invoice.record.edit_pre_dispatch` | `_on_generic_completed` | Logs completion |
| `invoice.record.edit_post_dispatch` | `_on_generic_completed` | Logs completion |
| `invoice.record.void` | `_on_generic_completed` | Logs completion |
| `payment.record.create` | `_on_generic_completed` | Logs completion |
| `payment.record.reallocate` | `_on_generic_completed` | Logs completion |
| `payment.record.reverse` | `_on_generic_completed` | Logs completion |
| `attendance.review.approve` | `_on_attendance_review_completed` | Updates review_status, approved_by, approved_at |
| `attendance.review.reject` | `_on_attendance_review_completed` | Updates review_status to "rejected" |
| `ocr.verification.approve` | `_on_generic_completed` | Logs completion |
| `ocr.verification.reject` | `_on_generic_completed` | Logs completion |
| `factory.create` | `_on_generic_completed` | Logs completion |
| `user.invite` | `_on_user_invite_completed` | Creates User + UserFactoryRole + sends email |
| `user.role.assign` | `_on_generic_completed` | Logs completion |
| `user.membership.assign` | `_on_generic_completed` | Logs completion |
| `user.reactivate` | `_on_user_reactivate_completed` | Sets is_active=True, sends notification email |
| `user.deactivate` | `_on_user_deactivate_completed` | Sets is_active=False, revokes all sessions |
| `billing.plan.downgrade` | `_on_generic_completed` | Logs completion |
| `billing.plan.change` | `_on_generic_completed` | Logs completion |

---

## Industry Templates (Starter Modules)

| Template Key | Template Label | Industry | Modules |
|-------------|---------------|----------|---------|
| `general-ops-pack` | General Operations Pack | General Manufacturing | `dpr`, `downtime`, `quality`, `dispatch`, `manpower` |
| `steel-core-pack` | Steel Core Pack | Steel Industry | `dpr`, `quality`, `traceability`, `scrap`, `certificates` |
| `chemical-core-pack` | Chemical Core Pack | Chemical Plant | `dpr`, `safety`, `incident`, `compliance`, `batch_log` |

---

## Summary Statistics

| Category | Workflow Count |
|----------|---------------|
| Steel Dispatch & Logistics | 7 |
| Steel Invoicing & Finance | 9 |
| Steel Customer Management | 9 |
| Steel Inventory & Stock | 11 |
| Steel Production & BOM | 22 |
| Steel Intelligence & Analytics | 22 |
| Production Entries (DPR) | 13 |
| Attendance & Workforce | 21 |
| OCR & Document Processing | 13 |
| User Authentication & Account | 25 |
| User & Organization Management | 9 |
| Factory Management | 9 |
| Billing & Subscriptions | 9 |
| Email, Alerts & Notifications | 20 |
| Analytics, AI & Intelligence | 29 |
| Approval Engine | 2 (+ 26 callbacks) |
| System, Admin & Cron | 29 |
| **Total** | **~260 unique workflows** |
