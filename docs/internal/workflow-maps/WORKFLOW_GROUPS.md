# FactoryNerve — Workflow Groups for Testing

> **260+ workflows → 18 testable workflow groups**  
> Organized by user journey and business domain, not by code files.

---

## 🧪 How To Use This

Each workflow group below represents an **end-to-end testing scenario**. Test them in order within each group — later steps often depend on earlier ones.

**Legend:**
| Icon | Meaning |
|------|---------|
| 🔓 | No auth needed |
| 🔐 | Any authenticated user |
| 👑 | Admin/Owner only |
| ✅ | Auto-bypasses approval |
| ⏳ | Requires approval (IP-2) |
| ⏳⏳ | Two-stage approval (IP-3) |
| 🚫 | Cross-domain approval (IP-4) |
| 🔒 | Owner-only approval (IP-5) |

---

## Group 1: 🔐 User Registration & Onboarding

*The very first thing every user does. Test this first.*

| Step | What To Test | Endpoint | Auth |
|------|-------------|----------|------|
| 1.1 | Register a new account | `POST /auth/register` | 🔓 |
| 1.2 | Resend verification email | `POST /auth/email/verification/resend` | 🔓 |
| 1.3 | Verify email (click link) | `POST /auth/email/verify` | 🔓 |
| 1.4 | Login with credentials | `POST /auth/login` | 🔓 |
| 1.5 | Change password | `POST /auth/change-password` | 🔐 |
| 1.6 | Forgot password → reset | `POST /auth/password/forgot` → `POST /auth/password/reset` | 🔓 |
| 1.7 | Setup MFA (TOTP) | `POST /auth/mfa/setup` → `POST /auth/mfa/verify` | 🔐 |
| 1.8 | Disable MFA | `POST /auth/mfa/disable` | 🔐 |
| 1.9 | Upload profile photo | `POST /auth/profile-photo` | 🔐 |
| 1.10 | Update profile | `PUT /auth/profile` | 🔐 |
| 1.11 | Logout | `POST /auth/logout` | 🔐 |
| 1.12 | Logout all devices | `POST /auth/logout-all` | 🔐 |
| 1.13 | Google OAuth login | `GET /auth/google/login` → callback | 🔓 |

**🧪 Test Scenario:**  
Register → verify email → login → change password → setup MFA → logout → login with MFA → logout all

---

## Group 2: 🏭 Factory Setup & Configuration

*Set up the factory before doing any production work.*

| Step | What To Test | Endpoint | Auth |
|------|-------------|----------|------|
| 2.1 | List factory profiles | `GET /settings/factory-profiles` | 🔐 |
| 2.2 | View factory templates | `GET /settings/factory/templates` | 🔐 |
| 2.3 | List available plans | `GET /plans` | 🔐 |
| 2.4 | View permission manifest | `GET /permissions` | 🔐 |
| 2.5 | Create new factory | `POST /settings/factories` | 👑 ⏳ |
| 2.6 | List factories | `GET /settings/factories` | 🔐 |
| 2.7 | Get factory settings | `GET /settings/factory` | 🔐 |
| 2.8 | Update factory settings | `PUT /settings/factory` | 👑 |
| 2.9 | Switch active factory | `POST /auth/select-factory` | 🔐 |
| 2.10 | View control tower | `GET /settings/control-tower` | 👑 |

**🧪 Test Scenario:**  
Create factory (with approval) → list factories → switch to new factory → update settings → view control tower

---

## Group 3: 👥 User & Team Management

*Invite people, assign roles, manage access.*

| Step | What To Test | Endpoint | Auth |
|------|-------------|----------|------|
| 3.1 | List users | `GET /settings/users` | 👑 |
| 3.2 | Invite a new user | `POST /settings/users/invite` | 👑 ⏳ |
| 3.3 | View user factory access | `GET /settings/users/{id}/factory-access` | 👑 |
| 3.4 | Assign factory access | `PUT /settings/users/{id}/factory-access` | 👑 ⏳ |
| 3.5 | Update user role | `PUT /settings/users/{id}/role` | 👑 🚫 |
| 3.6 | Update user plan | `PUT /settings/users/{id}/plan` | 👑 |
| 3.7 | Deactivate user | `DELETE /settings/users/{id}` | 👑 ⏳ |
| 3.8 | Reactivate user | `POST /auth/users/{id}/reactivate` | 👑 ⏳ |
| 3.9 | Update org plan | `PUT /settings/org/plan` | 👑 |

**🧪 Test Scenario:**  
List users → invite new user → approve invitation → assign to factory → change role → deactivate → reactivate

---

## Group 4: 📊 Production (DPR) — Daily Production Report

*The core daily workflow — shift handover, production tracking.*

| Step | What To Test | Endpoint | Auth |
|------|-------------|----------|------|
| 4.1 | Smart input (AI-assisted) | `POST /entries/smart` | 🔐 |
| 4.2 | Create entry manually | `POST /entries` | 🔐 |
| 4.3 | List entries | `GET /entries` | 🔐 |
| 4.4 | Get today's entries | `GET /entries/today` | 🔐 |
| 4.5 | Get single entry | `GET /entries/{id}` | 🔐 |
| 4.6 | Update entry | `PUT /entries/{id}` | 🔐 |
| 4.7 | Approve entry | `POST /entries/{id}/approve` | 👑 ⏳ |
| 4.8 | Reject entry | `POST /entries/{id}/reject` | 👑 ⏳ |
| 4.9 | Delete entry | `DELETE /entries/{id}` | 👑 ⏳ |
| 4.10 | Generate AI summary | `POST /entries/{id}/summary` | 🔐 |
| 4.11 | Get defect reasons | `GET /entries/defect-reasons` | 🔐 |

**🧪 Test Scenario:**  
Smart input entry → create entry → update → approve (via approval) → generate AI summary

---

## Group 5: ⏰ Attendance & Time Tracking

*Punch in/out, manage shifts, review attendance.*

| Step | What To Test | Endpoint | Auth |
|------|-------------|----------|------|
| 5.1 | View today's attendance | `GET /attendance/me/today` | 🔐 |
| 5.2 | Punch in/out | `POST /attendance/punch` | 🔐 |
| 5.3 | Live attendance view | `GET /attendance/live` | 👑 |
| 5.4 | List shift templates | `GET /attendance/settings/shifts` | 👑 |
| 5.5 | Create shift template | `POST /attendance/settings/shifts` | 👑 |
| 5.6 | List employees | `GET /attendance/settings/employees` | 👑 |
| 5.7 | Create employee profile | `POST /attendance/settings/employees` | 👑 |
| 5.8 | Bulk import employees | `POST /attendance/settings/employees/bulk-import` | 👑 |
| 5.9 | Request regularization | `POST /attendance/me/regularizations` | 🔐 |
| 5.10 | Review attendance queue | `GET /attendance/review` | 👑 |
| 5.11 | Approve attendance | `POST /attendance/review/{id}/approve` | 👑 ⏳ |
| 5.12 | Reject attendance | `POST /attendance/review/{id}/reject` | 👑 ⏳ |
| 5.13 | Force close attendance | `POST /attendance/review/{id}/force-close` | 👑 |
| 5.14 | Bulk approve | `POST /attendance/review/bulk-approve` | 👑 |
| 5.15 | Attendance report | `GET /attendance/reports/summary` | 👑 |
| 5.16 | Workforce overview | `GET /workforce/overview` | 👑 |
| 5.17 | Worker list & trends | `GET /workforce/workers` → `GET /workforce/workers/{id}/trend` | 👑 |
| 5.18 | Shift comparison | `GET /workforce/shifts/comparison` | 👑 |
| 5.19 | Cost summary & rates | `GET /workforce/costs/summary` → `POST /workforce/costs/rates` | 👑 |

**🧪 Test Scenario:**  
Create shift → punch in → view live → request regularization → review → approve → run report

---

## Group 6: 📄 OCR & Document Processing

*Scan documents, verify extracted data, export.*

| Step | What To Test | Endpoint | Auth |
|------|-------------|----------|------|
| 6.1 | Upload & process image | `POST /ocr/processing` | 🔐 |
| 6.2 | List verifications | `GET /ocr/verifications` | 🔐 |
| 6.3 | Create verification | `POST /ocr/verifications` | 🔐 |
| 6.4 | Get verification detail | `GET /ocr/verifications/{id}` | 🔐 |
| 6.5 | Update verification data | `PUT /ocr/verifications/{id}` | 🔐 |
| 6.6 | View source image | `GET /ocr/verifications/{id}/source-image` | 🔐 |
| 6.7 | Submit for approval | `POST /ocr/verifications/{id}/submit` | 🔐 |
| 6.8 | Approve verification | `POST /ocr/verifications/{id}/approve` | 👑 ⏳ |
| 6.9 | Reject verification | `POST /ocr/verifications/{id}/reject` | 👑 ⏳ |
| 6.10 | Export OCR to Excel | `GET /ocr/verifications/{id}/export` | 🔐 |
| 6.11 | Share OCR link | `POST /ocr/verifications/{id}/share-link` | 🔐 |
| 6.12 | Access shared OCR | `GET /ocr/shared/{token}` | 🔓 |

**🧪 Test Scenario:**  
Upload document → OCR processes → verify data → submit → approve → export → share

---

## Group 7: 🏗️ Steel — Inventory Management

*Manage items, stock, transactions, reconciliation.*

| Step | What To Test | Endpoint | Auth |
|------|-------------|----------|------|
| 7.1 | Create inventory item | `POST /steel/inventory/items` | 🔐 |
| 7.2 | List inventory items | `GET /steel/inventory/items` | 🔐 |
| 7.3 | View stock levels | `GET /steel/inventory/stock` | 🔐 |
| 7.4 | Create stock transaction | `POST /steel/inventory/transactions` | 🔐 |
| 7.5 | List stock transactions | `GET /steel/inventory/transactions` | 🔐 |
| 7.6 | Create reconciliation | `POST /steel/inventory/reconciliations` | 👑 ✅/⏳ |
| 7.7 | List reconciliations | `GET /steel/inventory/reconciliations` | 👑 |
| 7.8 | Approve reconciliation | `POST /steel/inventory/reconciliations/{id}/approve` | 👑 ⏳ |
| 7.9 | Reject reconciliation | `POST /steel/inventory/reconciliations/{id}/reject` | 👑 ⏳ |
| 7.10 | Calculate reorder points | `POST /steel/inventory/reorder-points/calculate` | 🔐 |

**🧪 Test Scenario:**  
Create item → add stock → do reconciliation (small variance auto-approved, large needs approval) → approve → verify inventory adjustment transaction created

---

## Group 8: 🏗️ Steel — Production & BOM

*Bill of materials, batch production, machine management.*

| Step | What To Test | Endpoint | Auth |
|------|-------------|----------|------|
| 8.1 | Create BOM | `POST /steel/bom` | 🔐 |
| 8.2 | List BOMs | `GET /steel/bom` | 🔐 |
| 8.3 | Get BOM by output item | `GET /steel/bom/by-output/{item_id}` | 🔐 |
| 8.4 | Delete BOM | `DELETE /steel/bom/{id}` | 👑 |
| 8.5 | Create production batch | `POST /steel/batches` | 🔐 |
| 8.6 | List batches | `GET /steel/batches` | 🔐 |
| 8.7 | Auto-fill batches from BOM | `POST /steel/production/batches/auto-fill` | 🔐 |
| 8.8 | Approve batch variance | `POST /steel/batches/{id}/variance` | 👑 ✅/⏳ |
| 8.9 | Create production line | `POST /steel/production/lines` | 👑 |
| 8.10 | Create machine | `POST /steel/production/machines` | 👑 |
| 8.11 | Update/delete machine | `PATCH/DELETE /steel/production/machines/{id}` | 👑 |
| 8.12 | Manage downtime events | `PATCH/DELETE /steel/production/machines/downtime-events/{id}` | 👑 |
| 8.13 | Manage maintenance tasks | `PATCH/DELETE /steel/production/machines/maintenance-tasks/{id}` | 👑 |
| 8.14 | View machine analytics | `GET /steel/production/machines/{id}/analytics` | 👑 |
| 8.15 | View machine alerts | `GET /steel/production/machine-alerts` | 👑 |

**🧪 Test Scenario:**  
Create BOM → auto-fill batches → create batch manually → approve variance → create machine → log downtime → view analytics

---

## Group 9: 🏗️ Steel — Customer Management

*Create customers, verify KYC, manage follow-ups.*

| Step | What To Test | Endpoint | Auth |
|------|-------------|----------|------|
| 9.1 | Create customer | `POST /steel/customers` | 🔐 |
| 9.2 | List customers | `GET /steel/customers` | 🔐 |
| 9.3 | Get customer detail | `GET /steel/customers/{id}` | 🔐 |
| 9.4 | Upload verification doc | `POST /steel/customers/{id}/verification-documents/{doc_type}` | 👑 |
| 9.5 | Run verification check | `POST /steel/customers/{id}/verification/run-check` | 👑 |
| 9.6 | Review verification | `POST /steel/customers/{id}/verification/review` | 👑 ⏳ |
| 9.7 | Create follow-up task | `POST /steel/customers/{id}/tasks` | 🔐 |
| 9.8 | Update task status | `POST /steel/customers/{id}/tasks/{task_id}/status` | 🔐 |

**🧪 Test Scenario:**  
Create customer → upload PAN/GST docs → run verification → review & approve → create follow-up task

---

## Group 10: 🏗️ Steel — Invoicing

*Create invoices, edit, void, track payments.*

| Step | What To Test | Endpoint | Auth |
|------|-------------|----------|------|
| 10.1 | Create sales invoice | `POST /steel/invoices` | 🔐 |
| 10.2 | List invoices | `GET /steel/invoices` | 🔐 |
| 10.3 | Get invoice detail | `GET /steel/invoices/{id}` | 🔐 |
| 10.4 | Edit invoice (pre-dispatch) | `PUT /steel/invoices/{id}` | 👑 ⏳ |
| 10.5 | Edit invoice (post-dispatch) | `PUT /steel/invoices/{id}/post-dispatch` | 👑 ⏳⏳ |
| 10.6 | Void invoice | `POST /steel/invoices/{id}/void` | 👑 🚫 |
| 10.7 | Record customer payment | `POST /steel/customers/payments` | 🔐 ✅/⏳ |
| 10.8 | Reallocate payment | `POST /steel/payments/{id}/reallocate` | 👑 ⏳⏳ |
| 10.9 | Reverse payment | `POST /steel/payments/{id}/reverse` | 👑 🚫 |

**🧪 Test Scenario:**  
Create invoice → edit pre-dispatch → record payment → reallocate → void invoice

---

## Group 11: 🏗️ Steel — Dispatch & Logistics

*Ship orders, track delivery, manage gate passes.*

| Step | What To Test | Endpoint | Auth |
|------|-------------|----------|------|
| 11.1 | Create dispatch | `POST /steel/dispatches` | 🔐 ✅/⏳ |
| 11.2 | List dispatches | `GET /steel/dispatches` | 🔐 |
| 11.3 | Get dispatch detail | `GET /steel/dispatches/{id}` | 🔐 |
| 11.4 | Update dispatch status | `POST /steel/dispatches/{id}/status` | 🔐 ✅/⏳ |
| 11.5 | Verify gate pass | `POST /steel/dispatches/{id}/gate-pass/verify` | 🔐 |
| 11.6 | Find by heat number | `GET /steel/dispatches/by-heat-number/{heat}` | 🔐 |

**Dispatch Lifecycle:** `draft` → `dispatched` → `in_transit` → `delivered` → `cancelled`

**🧪 Test Scenario:**  
Create dispatch (small auto-approved, large needs approval) → update status to in_transit → update to delivered → verify inventory deducted → verify gate pass

---

## Group 12: 🏗️ Steel — Vendor & Expenses

*Manage vendors, bills, cash accounts.*

| Step | What To Test | Endpoint | Auth |
|------|-------------|----------|------|
| 12.1 | List vendor bills | `GET /steel/vendor-bills` | 🔐 |
| 12.2 | Create vendor bill | `POST /steel/vendor-bills` | 🔐 |
| 12.3 | List vendors | `GET /steel/vendors` | 🔐 |
| 12.4 | Create vendor | `POST /steel/vendors` | 🔐 |
| 12.5 | List expenses | `GET /steel/expenses` | 🔐 |
| 12.6 | Create expense | `POST /steel/expenses` | 🔐 |
| 12.7 | List cash accounts | `GET /steel/cash-accounts` | 🔐 |
| 12.8 | Create cash account | `POST /steel/cash-accounts` | 👑 |
| 12.9 | View cash ledger | `GET /steel/cash-ledger` | 🔐 |

**🧪 Test Scenario:**  
Create vendor → create vendor bill → create cash account → view ledger

---

## Group 13: 🏗️ Steel — Intelligence & Fraud Detection

*AI-powered insights, fraud alerts, coil theft detection.*

| Step | What To Test | Endpoint | Auth |
|------|-------------|----------|------|
| 13.1 | Inventory intelligence | `GET /steel/intelligence/inventory` | 🔐 |
| 13.2 | Quality intelligence | `GET /steel/intelligence/quality` | 🔐 |
| 13.3 | Sales intelligence | `GET /steel/intelligence/sales` | 🔐 |
| 13.4 | Production intelligence | `GET /steel/intelligence/production` | 🔐 |
| 13.5 | Scrap loss intelligence | `GET /steel/intelligence/scrap-loss` | 🔐 |
| 13.6 | Fraud intelligence | `GET /steel/intelligence/fraud` | 🔐 |
| 13.7 | List fraud alerts | `GET /steel/intelligence/fraud/alerts` | 🔐 |
| 13.8 | Acknowledge fraud alert | `POST /steel/intelligence/fraud/alerts/{id}/acknowledge` | 👑 |
| 13.9 | Investigate fraud alert | `POST /steel/intelligence/fraud/alerts/{id}/investigate` | 👑 |
| 13.10 | Resolve fraud alert | `POST /steel/intelligence/fraud/alerts/{id}/resolve` | 👑 |
| 13.11 | Detect coil theft | `POST /steel/coil-theft/detect` | 🔐 |
| 13.12 | Owner dashboard | `GET /steel/intelligence/owner/dashboard` | 👑 |
| 13.13 | Decision dashboard | `GET /steel/intelligence/decision/dashboard` | 👑 |
| 13.14 | Finance overview | `GET /steel/finance/overview` | 👑 |
| 13.15 | Receivables/payables | `GET /steel/finance/receivables` → `GET /steel/finance/payables` | 👑 |
| 13.16 | Cash flow | `GET /steel/finance/cash-flow` | 👑 |
| 13.17 | Product profitability | `GET /steel/finance/product-profitability` | 👑 |

**🧪 Test Scenario:**  
Run all intelligence views → fraud alert triggers → acknowledge → investigate → resolve → view dashboards

---

## Group 14: 💳 Billing & Subscription

*Plan management, payments, invoices.*

| Step | What To Test | Endpoint | Auth |
|------|-------------|----------|------|
| 14.1 | View billing config | `GET /billing/config` | 🔐 |
| 14.2 | View billing status | `GET /billing/status` | 🔐 |
| 14.3 | List billing invoices | `GET /billing/invoices` | 🔐 |
| 14.4 | Download invoice PDF | `GET /billing/invoices/{id}/pdf` | 🔐 |
| 14.5 | Upgrade plan | `POST /billing/orders` | 👑 |
| 14.6 | Sync order | `POST /billing/orders/{id}/sync` | 👑 |
| 14.7 | Request plan downgrade | `POST /billing/downgrade` | 👑 🔒 |
| 14.8 | Cancel downgrade | `DELETE /billing/downgrade` | 👑 |

**🧪 Test Scenario:**  
View billing status → upgrade plan → sync order → request downgrade → approve downgrade

---

## Group 15: ✅ Approval Engine — Maker-Checker

*The central approval queue — test all patterns.*

| Step | What To Test | Endpoint | Auth |
|------|-------------|----------|------|
| 15.1 | View my pending approvals | `GET /approvals/queue/me` | 👑 |
| 15.2 | **IP-2**: Approve a production entry (single stage) | `POST /approvals/{id}/advance` | 👑 |
| 15.3 | **IP-3**: Two-stage approval (L1→L2) for post-dispatch invoice edit | `POST /approvals/{id}/advance` (needs 2 different people) | 👑 |
| 15.4 | **IP-4**: Cross-domain approve (Admin/Owner only) for role change | `POST /approvals/{id}/advance` | 👑 |
| 15.5 | **IP-5**: Critical dual approval (Owner only) for plan downgrade | `POST /approvals/{id}/advance` | 👑 |
| 15.6 | Reject an approval | `POST /approvals/{id}/advance` with action="reject" | 👑 |
| 15.7 | Verify auto-bypass (small dispatch, small variance, small payment) | Create resource below threshold | ✅ |
| 15.8 | Verify self-approval is blocked | Creator tries to approve own request | 🚫 |
| 15.9 | Verify expiry handling | Leave approval pending past TTL | ⏰ |

**🧪 Test Scenario:**  
Create entry → approve via IP-2 → create dispatch (<5000kg, verify auto-bypass) → create large dispatch (verify requires approval) → reject → verify

---

## Group 16: 📧 Email, Alerts & Notifications

*Test all communication channels.*

| Step | What To Test | Endpoint | Auth |
|------|-------------|----------|------|
| 16.1 | Debug email config | `GET /auth/debug/email-config` | 🔓 |
| 16.2 | Send test email | `POST /auth/debug/send-test-email` | 🔓 |
| 16.3 | Generate AI email summary | `POST /emails/summary/generate` | 👑 |
| 16.4 | View email summary | `GET /emails/summary` | 👑 |
| 16.5 | List notifications | `GET /notifications` | 🔐 |
| 16.6 | Get unread count | `GET /notifications/unread-count` | 🔐 |
| 16.7 | Mark as read | `PATCH /notifications/{id}/read` | 🔐 |
| 16.8 | Mark all read | `PATCH /notifications/read-all` | 🔐 |
| 16.9 | List alert recipients | `GET /alert-recipients` | 👑 |
| 16.10 | Add alert recipient | `POST /alert-recipients` | 👑 |
| 16.11 | Verify phone | `POST /alert-recipients/{id}/start-verification` → `POST /alert-recipients/{id}/confirm-verification` | 👑 |
| 16.12 | Send test alert | `POST /alert-recipients/{id}/test` | 👑 |
| 16.13 | View alerts | `GET /alerts` | 🔐 |

**🧪 Test Scenario:**  
Send test email → generate AI summary → add alert recipient → verify phone → send test alert → check notifications

---

## Group 17: 🤖 AI & Analytics

*AI queries, analytics dashboards, reports.*

| Step | What To Test | Endpoint | Auth |
|------|-------------|----------|------|
| 17.1 | Weekly analytics | `GET /analytics/weekly` | 👑 |
| 17.2 | Monthly analytics | `GET /analytics/monthly` | 👑 |
| 17.3 | Trends | `GET /analytics/trends` | 👑 |
| 17.4 | Manager dashboard | `GET /analytics/manager` | 👑 |
| 17.5 | Natural language query | `POST /ai/query` | 🔐 |
| 17.6 | AI anomalies | `GET /ai/anomalies` | 🔐 |
| 17.7 | AI suggestions | `GET /ai/suggestions` | 🔐 |
| 17.8 | AI health trend | `GET /ai/health-trend` | 🔐 |
| 17.9 | Executive summary | `GET /ai/executive-summary` | 👑 |
| 17.10 | AI usage & cost | `GET /ai/usage` → `GET /ai/cost-usage` | 👑 |
| 17.11 | Premium dashboard | `GET /premium/dashboard` | 👑 |
| 17.12 | Premium audit trail | `GET /premium/audit-trail` | 👑 |
| 17.13 | Executive PDF | `GET /premium/executive-pdf` | 👑 |
| 17.14 | Report insights | `GET /reports/insights` | 👑 |
| 17.15 | Generate PDF report | `GET /reports/pdf/{entry_id}` | 🔐 |
| 17.16 | Generate Excel export | `GET /reports/excel/{entry_id}` | 🔐 |
| 17.17 | Weekly/monthly reports | `GET /reports/weekly` → `GET /reports/monthly` | 👑 |
| 17.18 | Submit intelligence request | `POST /intelligence/requests` | 🔐 |
| 17.19 | Submit feedback | `POST /feedback` | 🔐 |
| 17.20 | List feedback | `GET /feedback` | 👑 |

**🧪 Test Scenario:**  
Ask NLQ → view analytics → generate reports (PDF + Excel) → check AI usage → view premium dashboard

---

## Group 18: ⚙️ System Admin & Ops

*Cron jobs, health checks, admin tools, dev tools.*

| Step | What To Test | Endpoint | Auth |
|------|-------------|----------|------|
| 18.1 | Readiness check | `GET /observability/ready` | 🔓 |
| 18.2 | AI health | `GET /observability/ai/health` | 🔓 |
| 18.3 | AI dashboard | `GET /observability/ai/dashboard` | 🔐 |
| 18.4 | OCR dashboard | `GET /observability/ocr-dashboard` | 👑 |
| 18.5 | OCR costs | `GET /observability/ocr-costs` | 👑 |
| 18.6 | Ops alerts history | `GET /observability/alerts` | 👑 |
| 18.7 | **Admin**: AI usage | `GET /admin/ai/usage` | 👑 |
| 18.8 | **Admin**: AI cost summary | `GET /admin/ai/cost-summary` | 👑 |
| 18.9 | **Admin**: Billing events | `GET /admin/billing/events` | 👑 |
| 18.10 | **Admin**: Subscriptions | `GET /admin/billing/subscriptions` | 👑 |
| 18.11 | **Admin**: Quota management | `GET /admin/billing/quota` → `POST /admin/billing/reset-quota/{org_id}` | 👑 |
| 18.12 | **Cron**: Daily maintenance | `POST /cron/daily-maintenance` | 🔐 |
| 18.13 | **Cron**: Process email queue | `POST /cron/process-email-queue` | 🔐 |
| 18.14 | **Cron**: Daily summary | `POST /cron/daily-summary` | 🔐 |
| 18.15 | **Cron**: Auto-close attendance | `POST /cron/auto-close-attendance` | 🔐 |
| 18.16 | **Cron**: Calculate reorder points | `POST /cron/calculate-reorder-points` | 🔐 |
| 18.17 | **Dev**: Failure simulation | `POST /dev/failures/{mode}/enable` → test → `POST /dev/failures/{mode}/disable` | 🔐 |
| 18.18 | Job management | `GET /jobs` → `GET /jobs/{id}` → `POST /jobs/{id}/cancel` | 🔐 |

**🧪 Test Scenario (Smoke Test):**  
Health check → admin dashboard → verify cron is healthy → run email queue processor → check ops alerts

---

## 📋 Quick-Reference: Approval Pattern Matrix

| Pattern | Workflows | Who Can Approve | Stages | Auto-Bypass |
|---------|-----------|-----------------|--------|-------------|
| **IP-2** 🟢 | Entry approve/delete, attendance review, OCR verify, inventory reconciliation, dispatch status, customer verify, invoice edit (pre), payment create, batch variance, factory create, user invite/deactivate/reactivate/membership | Any approver (not the maker) | 1 stage | Small variance (<5%), small payment (<₹50k), small dispatch (<5000kg), non-cancellation status |
| **IP-3** 🟡 | Invoice edit (post-dispatch), payment reallocate | Any approver (L2 must be different from L1) | L1 → L2 | — |
| **IP-4** 🟠 | User role assign, payment reverse, invoice void | Admin, Owner | 1 stage | — |
| **IP-5** 🔴 | Plan downgrade, plan change | Owner only | 1 stage | — |

---

## 🎯 Priority Testing Order

For a **smoke test**, run these groups in this order:

```
1️⃣  User Onboarding (Group 1)    →  2️⃣  Factory Setup (Group 2)
3️⃣  Production Entry (Group 4)    →  4️⃣  Attendance (Group 5)
5️⃣  Steel Inventory (Group 7)     →  6️⃣  Steel Invoicing (Group 10)
7️⃣  Steel Dispatch (Group 11)     →  8️⃣  Approval Engine (Group 15)
9️⃣  OCR (Group 6)                 →  10️⃣ Email (Group 16)
```

For a **regression test**, prioritize groups with approval callbacks (Groups 4, 5, 6, 7, 9, 10, 11, 15).

For a **full test**, run all 18 groups in sequence.
