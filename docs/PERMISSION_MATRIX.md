# Permission Matrix — Route Authorization Audit

**Phase 1 Week 2 — Task 1.1**  
Generated: 2026-06-27  
Total routes audited: 283

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | PDP `require_permission()` call present |
| ⚠️ | `get_current_user` only — no PDP check |
| ❌ | No user auth dependency (cron secret / metrics token / public) |
| 🔒 | Custom auth guard (superadmin, cron secret, metrics token) |

---

## Routes with PDP Checks ✅ (~110 routes)

### `backend/routers/steel.py`

| Method | Path | Permission Key |
|--------|------|---------------|
| GET | `/steel/overview` | `inventory.ledger.view` |
| GET | `/steel/owner-daily-pdf` | `admin.billing.quota.reset` |
| GET | `/steel/inventory/items` | `inventory.item.view` |
| GET | `/steel/inventory/stock` | `inventory.ledger.view` |
| GET | `/steel/inventory/transactions` | `inventory.ledger.view` |
| POST | `/steel/inventory/items` | `inventory.item.manage` |
| POST | `/steel/inventory/transactions` | `inventory.transaction.create` |
| POST | `/steel/inventory/reconciliations` | `inventory.reconciliation.create` |
| GET | `/steel/inventory/reconciliations/summary` | `inventory.reconciliation.view` |
| GET | `/steel/inventory/reconciliations` | `inventory.reconciliation.view` |
| POST | `/steel/inventory/reconciliations/{id}/approve` | `inventory.reconciliation.approve` |
| POST | `/steel/inventory/reconciliations/{id}/reject` | `inventory.reconciliation.approve` |
| GET | `/steel/batches` | `production.batch.view` |
| GET | `/steel/batches/{batch_id}` | `production.batch.view` |
| GET | `/steel/customers` | `customer.record.view` |
| POST | `/steel/customers` | `customer.record.create` |
| GET | `/steel/customers/{customer_id}` | `customer.record.view` |
| POST | `/steel/customers/{customer_id}/tasks` | `followup.task.manage` |
| POST | `/steel/customers/{customer_id}/tasks/{task_id}/status` | `followup.task.manage` |
| POST | `/steel/customers/{customer_id}/verification/run-check` | `customer.record.edit` |
| GET | `/steel/customers/{customer_id}/verification-documents/{doc_type}` | `customer.record.view` |
| POST | `/steel/customers/{customer_id}/verification-documents/{doc_type}` | `customer.record.edit` |
| POST | `/steel/customers/{customer_id}/verification/review` | `customer.verification.review` |
| POST | `/steel/customers/payments` | `payment.record.create` |
| GET | `/steel/invoices` | `invoice.record.view` |
| GET | `/steel/invoices/{invoice_id}` | `invoice.record.view` |
| POST | `/steel/invoices` | `invoice.record.create` |
| GET | `/steel/dispatches` | `dispatch.record.view` |
| GET | `/steel/dispatches/{dispatch_id}` | `dispatch.record.view` |
| POST | `/steel/dispatches` | `dispatch.record.create` |
| POST | `/steel/dispatches/{dispatch_id}/status` | `dispatch.record.update` |
| POST | `/steel/batches` | `production.batch.create` |
| GET | `/steel/production/lines` | `factory.profile.manage` |
| POST | `/steel/production/lines` | `factory.profile.manage` |
| GET | `/steel/production/machines` | `factory.profile.manage` |
| POST | `/steel/production/machines` | `factory.profile.manage` |
| PATCH | `/steel/production/machines/{machine_id}` | `factory.profile.manage` |
| DELETE | `/steel/production/machines/{machine_id}` | `factory.profile.manage` |
| PATCH | `/steel/production/machines/downtime-events/{event_id}` | `factory.profile.manage` |
| DELETE | `/steel/production/machines/downtime-events/{event_id}` | `factory.profile.manage` |
| PATCH | `/steel/production/machines/maintenance-tasks/{task_id}` | `factory.profile.manage` |
| DELETE | `/steel/production/machines/maintenance-tasks/{task_id}` | `factory.profile.manage` |
| GET | `/steel/production/machines/{machine_id}/analytics` | `production.analytics.view` |
| GET | `/steel/production/machine-alerts` | `production.analytics.view` |

### `backend/routers/steel_finance.py`

| Method | Path | Permission Key |
|--------|------|---------------|
| GET | `/steel/finance/overview` | `invoice.record.view` |
| GET | `/steel/finance/product-profitability` | `invoice.record.view` |
| GET | `/steel/finance/receivables` | `invoice.record.view` |
| GET | `/steel/finance/payables` | `invoice.record.view` |
| GET | `/steel/finance/expenses` | `invoice.record.view` |
| GET | `/steel/vendors` | `invoice.record.view` |
| POST | `/steel/vendors` | `invoice.record.create` |
| GET | `/steel/vendor-bills` | `invoice.record.view` |
| POST | `/steel/vendor-bills` | `invoice.record.create` |
| GET | `/steel/expenses` | `invoice.record.view` |
| GET | `/steel/finance/cash-flow` | `invoice.record.view` |
| GET | `/steel/finance/cash-flow/monthly` | `invoice.record.view` |
| GET | `/steel/cash-accounts` | `invoice.record.view` |
| POST | `/steel/cash-accounts` | `invoice.record.create` |
| GET | `/steel/cash-ledger` | `invoice.record.view` |
| POST | `/steel/cash-ledger` | `invoice.record.create` |
| POST | `/steel/expenses` | `invoice.record.create` |

### `backend/routers/steel_intelligence.py`

| Method | Path | Permission Key |
|--------|------|---------------|
| GET | `/steel/inventory/intelligence` | `production.analytics.view` |
| GET | `/steel/quality` | `production.analytics.view` |
| GET | `/steel/quality/intelligence` | `production.analytics.view` |
| GET | `/steel/anomalies` | `production.fraud_intelligence.view` |
| GET | `/steel/sales-intelligence` | `production.analytics.view` |
| GET | `/steel/owner/dashboard` | `production.analytics.view` |
| GET | `/steel/production/intelligence` | `production.analytics.view` |
| GET | `/steel/scrap-loss/intelligence` | `production.scrap_intelligence.view` |
| GET | `/steel/fraud/intelligence` | `production.fraud_intelligence.view` |
| GET | `/steel/fraud/alerts` | `production.fraud_intelligence.view` |
| GET | `/steel/fraud/alerts/count` | `production.fraud_intelligence.view` |
| POST | `/steel/fraud/alerts/{alert_id}/acknowledge` | `production.fraud_intelligence.view` |
| POST | `/steel/fraud/alerts/{alert_id}/investigate` | `production.fraud_intelligence.view` |
| POST | `/steel/fraud/alerts/{alert_id}/resolve` | `production.fraud_intelligence.view` |
| POST | `/steel/fraud/alerts/{alert_id}/dismiss` | `production.fraud_intelligence.view` |

### `backend/routers/ai.py`

| Method | Path | Permission Key |
|--------|------|---------------|
| GET | `/ai/usage` | `ai.usage.view` |
| GET | `/ai/cost-usage` | `ai.usage.view` |
| GET | `/ai/suggestions` | `ai.suggestions.view` |
| GET | `/ai/anomalies` | `ai.anomalies.view` |
| GET | `/ai/health-trend` | `ai.anomalies.view` |
| GET | `/ai/anomalies/preview` | `ai.anomalies.view` |
| POST | `/ai/query` | `ai.nlq.query` |
| GET | `/ai/executive-summary` | `ai.executive.view` |
| POST | `/ai/executive-summary/jobs` | `ai.executive.view` |
| GET | `/ai/jobs/{job_id}` | `ai.executive.view` |

### `backend/routers/attendance.py`

| Method | Path | Permission Key |
|--------|------|---------------|
| GET | `/attendance/live` | `attendance.team.view` |
| GET | `/attendance/settings/employees` | `attendance.profile.manage` |
| POST | `/attendance/settings/employees` | `attendance.profile.manage` |
| GET | `/attendance/settings/shifts` | `attendance.shift_template.manage` |
| POST | `/attendance/settings/shifts` | `attendance.shift_template.manage` |
| GET | `/attendance/review` | `attendance.report.view` |
| POST | `/attendance/review/{attendance_id}/approve` | `attendance.record.approve` |
| POST | `/attendance/review/{attendance_id}/force-close` | `attendance.record.approve` |
| POST | `/attendance/review/{attendance_id}/reject` | `attendance.review.reject` |
| GET | `/attendance/reports/summary` | `attendance.report.view` |

### `backend/routers/entries.py`

| Method | Path | Permission Key |
|--------|------|---------------|
| POST | `/entries/{entry_id}/approve` | `production.entry.approve` |
| POST | `/entries/{entry_id}/reject` | `production.entry.approve` |
| DELETE | `/entries/{entry_id}` | `production.entry.delete` |

### `backend/routers/settings.py`

| Method | Path | Permission Key |
|--------|------|---------------|
| GET | `/settings/factory` | `factory.profile.manage` |
| GET | `/settings/factory/templates` | `factory.profile.manage` |
| GET | `/settings/factories` | `factory.profile.manage` |
| POST | `/settings/factories` | `factory.create` |
| GET | `/settings/control-tower` | `analytics.operations.view` |
| PUT | `/settings/factory` | `factory.profile.manage` |
| GET | `/settings/users` | `user.directory.view` |
| POST | `/settings/users/invite` | `user.invite` |
| GET | `/settings/users/{user_id}/factory-access` | `user.membership.assign` |
| PUT | `/settings/users/{user_id}/factory-access` | `user.membership.assign` |
| PUT | `/settings/users/{user_id}/role` | `user.role.assign` |
| PUT | `/settings/users/{user_id}/plan` | `billing.plan.change` |
| PUT | `/settings/org/plan` | `billing.plan.change` |
| DELETE | `/settings/users/{user_id}` | `user.deactivate` |
| POST | `/settings/usage/reconcile` | `admin.billing.quota.reset` |
| GET | `/settings/defect-reasons` | `factory.master_data.manage` |
| POST | `/settings/defect-reasons` | `factory.master_data.manage` |
| PUT | `/settings/defect-reasons/{reason_id}` | `factory.master_data.manage` |
| DELETE | `/settings/defect-reasons/{reason_id}` | `factory.master_data.manage` |

### `backend/routers/billing.py`

| Method | Path | Permission Key |
|--------|------|---------------|
| GET | `/billing/config` | `billing.config.view` |
| GET | `/billing/status` | `billing.status.view` |
| GET | `/billing/invoices` | `billing.invoice.view` |
| POST | `/billing/downgrade` | `billing.plan.downgrade` |
| DELETE | `/billing/downgrade` | `billing.plan.downgrade` |
| POST | `/billing/orders` | `billing.order.create` |
| POST | `/billing/orders/{order_id}/sync` | `billing.order.sync` |

### `backend/routers/reports.py`

| Method | Path | Permission Key |
|--------|------|---------------|
| GET | `/reports/insights` | `reporting.insights.view` |
| GET | `/reports/pdf/{entry_id}` | `reporting.export.view` |
| POST | `/reports/pdf/{entry_id}/jobs` | `reporting.export.view` |
| GET | `/reports/excel/{entry_id}` | `reporting.export.view` |
| GET | `/reports/weekly` | `reporting.export.view` |
| GET | `/reports/monthly` | `reporting.export.view` |
| GET | `/reports/excel-range` | `reporting.export.view` |
| POST | `/reports/excel-range/jobs` | `reporting.export.view` |
| GET | `/reports/export-jobs/{job_id}` | `reporting.export.view` |
| GET | `/reports/export-jobs/{job_id}/download` | `reporting.export.view` |

### `backend/routers/analytics.py`

| Method | Path | Permission Key |
|--------|------|---------------|
| GET | `/analytics/weekly` | `analytics.operations.view` |
| GET | `/analytics/monthly` | `analytics.operations.view` |
| GET | `/analytics/trends` | `analytics.operations.view` |
| GET | `/analytics/manager` | `analytics.operations.view` |

### `backend/routers/premium.py`

| Method | Path | Permission Key |
|--------|------|---------------|
| GET | `/premium/dashboard` | `analytics.premium.view` |
| GET | `/premium/audit-trail` | `audit.log.view` |
| GET | `/premium/executive-pdf` | `reporting.executive.export` |

### `backend/routers/alerts.py`

| Method | Path | Permission Key |
|--------|------|---------------|
| GET | `/alerts` | `ops.alerts.view` |
| PUT | `/alerts/{alert_id}/read` | `ops.alerts.view` |

### `backend/routers/alert_recipients.py`

| Method | Path | Permission Key |
|--------|------|---------------|
| GET | `/alert-recipients` | `ops.alerts.manage` |
| POST | `/alert-recipients` | `ops.alerts.manage` |
| PATCH | `/alert-recipients/{recipient_id}` | `ops.alerts.manage` |
| POST | `/alert-recipients/{recipient_id}/start-verification` | `ops.alerts.manage` |
| POST | `/alert-recipients/{recipient_id}/confirm-verification` | `ops.alerts.manage` |
| DELETE | `/alert-recipients/{recipient_id}` | `ops.alerts.manage` |
| POST | `/alert-recipients/{recipient_id}/test` | `ops.alerts.manage` |

### `backend/routers/intelligence.py`

| Method | Path | Permission Key |
|--------|------|---------------|
| POST | `/intelligence/requests` | `intelligence.request.create` |
| GET | `/intelligence/requests` | `intelligence.request.view` |
| GET | `/intelligence/requests/{request_id}` | `intelligence.request.view` |
| GET | `/intelligence/usage` | `ai.usage.view` |

### `backend/routers/feedback.py`

| Method | Path | Permission Key |
|--------|------|---------------|
| POST | `/feedback` | `feedback.submit` |
| GET | `/feedback` | `feedback.manage` |
| GET | `/feedback/{feedback_id}` | `feedback.manage` |
| PATCH | `/feedback/{feedback_id}` | `feedback.manage` |

### `backend/routers/emails.py`

| Method | Path | Permission Key |
|--------|------|---------------|
| GET | `/emails/summary` | `reporting.email.summary.view` |
| POST | `/emails/summary/generate` | `reporting.email.summary.generate` |

### `backend/routers/observability.py`

| Method | Path | Permission Key |
|--------|------|---------------|
| GET | `/observability/alerts` | `system.observability.view` |
| GET | `/observability/alerts/{ref_id}` | `system.observability.view` |

### `backend/routers/workforce_intelligence.py`

| Method | Path | Permission Key |
|--------|------|---------------|
| GET | `/steel/workforce/overview` | `workforce.overview.view` |
| GET | `/steel/workforce/workers` | `workforce.workers.view` |
| GET | `/steel/workforce/workers/{user_id}/trend` | `workforce.workers.view` |
| GET | `/steel/workforce/shifts/comparison` | `workforce.overview.view` |
| GET | `/steel/workforce/costs/summary` | `workforce.cost.view` |
| GET | `/steel/workforce/costs/rates` | `workforce.cost.view` |
| POST | `/steel/workforce/costs/rates` | `workforce.cost.manage` |

### `backend/routers/coil_theft.py`

| Method | Path | Permission Key |
|--------|------|---------------|
| POST | `/coil-theft/detect` | `ai.anomalies.view` |
| GET | `/coil-theft/alerts` | `ai.anomalies.view` |

### `backend/routers/approvals.py`

| Method | Path | Permission Key |
|--------|------|---------------|
| GET | `/approvals/queue/me` | `production.entry.approve` |
| POST | `/approvals/{instance_id}/advance` | `production.entry.approve` |

### `backend/routers/ocr/_verifications.py`

| Method | Path | Permission Key |
|--------|------|---------------|
| POST | `/ocr/verifications/{verification_id}/approve` | `ocr.verification.approve` |
| POST | `/ocr/verifications/{verification_id}/reject` | `ocr.verification.reject` |

### `backend/routers/admin_billing.py`

| Method | Path | Permission Key |
|--------|------|---------------|
| POST | `/admin/billing/reset-quota/{org_id}` | `admin.billing.quota.reset` (via `require_superadmin`) |

---

## Routes with `get_current_user` Only ⚠️ (Missing PDP — ~60 routes)

These routes authenticate the user but perform **no permission check**. They must have `PDP.require_permission()` added.

### `backend/routers/entries.py`

| Method | Path | Recommended Permission |
|--------|------|----------------------|
| POST | `/entries/smart` | `production.entry.create` |
| POST | `/entries` | `production.entry.create` |
| GET | `/entries` | `production.entry.view` |
| GET | `/entries/defect-reasons` | `production.entry.view` |
| GET | `/entries/today` | `production.entry.view` |
| GET | `/entries/{entry_id}` | `production.entry.view` |
| GET | `/entries/{entry_id}/summary-meta` | `production.entry.view` |
| POST | `/entries/{entry_id}/summary-jobs` | `production.entry.view` |
| POST | `/entries/{entry_id}/summary` | `production.entry.edit` |
| PUT | `/entries/{entry_id}` | `production.entry.edit` |

### `backend/routers/jobs.py`

| Method | Path | Recommended Permission |
|--------|------|----------------------|
| GET | `/jobs` | `background_jobs.view` |
| GET | `/jobs/{job_id}` | `background_jobs.view` |
| POST | `/jobs/{job_id}/cancel` | `background_jobs.view` |
| POST | `/jobs/{job_id}/retry` | `background_jobs.view` |

### `backend/routers/attendance.py`

| Method | Path | Recommended Permission |
|--------|------|----------------------|
| GET | `/attendance/me/today` | `attendance.self.view` |
| POST | `/attendance/punch` | `attendance.self.punch` |
| POST | `/attendance/me/regularizations` | `attendance.self.regularization.request` |

### `backend/routers/settings.py`

| Method | Path | Recommended Permission |
|--------|------|----------------------|
| GET | `/settings/factory-profiles` | `factory.profile.manage` |
| GET | `/settings/usage` | `billing.status.view` |
| GET | `/settings/plan/last-upgrade` | `billing.status.view` |
| GET | `/settings/users/lookup` | `user.directory.view` |
| POST | `/settings/demo/load` | `admin.billing.quota.reset` |

### `backend/routers/feedback.py`

| Method | Path | Recommended Permission |
|--------|------|----------------------|
| GET | `/feedback/mine/updates` | `feedback.submit` |
| GET | `/feedback/export.csv` | `feedback.manage` |

### `backend/routers/emails.py`

| Method | Path | Recommended Permission |
|--------|------|----------------------|
| POST | `/emails/summary/send` | `reporting.email.summary.generate` |

### `backend/routers/permissions.py`

| Method | Path | Recommended Permission |
|--------|------|----------------------|
| GET | `/auth/permissions` | *(self-service — keep `get_current_user` only, no PDP needed)* |

### `backend/routers/ocr/_verifications.py`

| Method | Path | Recommended Permission |
|--------|------|----------------------|
| GET | `/ocr/verifications` | `ocr.verification.view` |
| GET | `/ocr/verifications/summary` | `ocr.verification.view` |
| POST | `/ocr/verifications` | `ocr.document.upload` |
| GET | `/ocr/verifications/{verification_id}` | `ocr.verification.view` |
| GET | `/ocr/verifications/{verification_id}/source-image` | `ocr.verification.view` |
| GET | `/ocr/verifications/{verification_id}/export` | `ocr.verification.view` |
| POST | `/ocr/verifications/{verification_id}/share-link` | `ocr.verification.view` |
| PUT | `/ocr/verifications/{verification_id}` | `ocr.verification.edit` |
| POST | `/ocr/verifications/{verification_id}/submit` | `ocr.verification.submit` |

### `backend/routers/ocr/_processing.py`

| Method | Path | Recommended Permission |
|--------|------|----------------------|
| POST | `/ocr/logbook` | `ocr.document.upload` |
| POST | `/ocr/warp` | `ocr.document.upload` |
| POST | `/ocr/logbook-excel` | `ocr.document.upload` |
| POST | `/ocr/logbook-excel-async` | `ocr.document.upload` |
| POST | `/ocr/table-excel` | `ocr.document.upload` |
| POST | `/ocr/table-excel-async` | `ocr.document.upload` |
| GET | `/ocr/jobs/{job_id}` | `ocr.job.view` |
| GET | `/ocr/jobs/{job_id}/download` | `ocr.job.view` |

### `backend/routers/ocr/_templates.py`

| Method | Path | Recommended Permission |
|--------|------|----------------------|
| GET | `/ocr/templates` | `ocr.template.view` |
| POST | `/ocr/templates` | `ocr.template.manage` |
| DELETE | `/ocr/templates/{template_id}` | `ocr.template.manage` |

### `backend/routers/auth.py`

| Method | Path | Recommended Permission |
|--------|------|----------------------|
| GET | `/auth/session-summary` | *(self-service — keep `get_current_user` only)* |
| GET | `/auth/active-workflow-template` | *(self-service — keep `get_current_user` only)* |
| PUT | `/auth/profile` | *(self-service — keep `get_current_user` only)* |
| POST | `/auth/profile-photo` | *(self-service — keep `get_current_user` only)* |
| DELETE | `/auth/profile-photo` | *(self-service — keep `get_current_user` only)* |
| POST | `/auth/change-password` | *(self-service — keep `get_current_user` only)* |
| GET | `/auth/admin-only` | `user.manage` |

### `backend/routers/billing.py`

| Method | Path | Recommended Permission |
|--------|------|----------------------|
| GET | `/billing/invoices/{invoice_id}/pdf` | `billing.invoice.view` |

---

## Routes with No User Auth ❌ (~25 routes — intentionally public or machine-to-machine)

These routes use a non-user auth mechanism (cron secret, metrics token, webhook signature, or are fully public).

### `backend/routers/cron.py` — Protected by `verify_cron_secret` 🔒

| Method | Path | Auth Mechanism |
|--------|------|---------------|
| POST | `/cron/daily-maintenance` | `X-Cron-Secret` header |
| POST | `/cron/process-email-queue` | `X-Cron-Secret` header |
| POST | `/cron/daily-summary` | `X-Cron-Secret` header |
| POST | `/cron/auto-close-attendance` | `X-Cron-Secret` header |
| GET | `/cron/auto-close-attendance/status` | `X-Cron-Secret` header |
| GET | `/cron/health` | `X-Cron-Secret` header |

### `backend/routers/whatsapp_webhook.py` — Webhook signature 🔒

| Method | Path | Auth Mechanism |
|--------|------|---------------|
| GET | `/whatsapp` | WhatsApp hub verification |
| POST | `/whatsapp` | WhatsApp HMAC signature |

### `backend/routers/observability.py` — Mixed

| Method | Path | Auth Mechanism |
|--------|------|---------------|
| GET | `/ready` | Public (health check) ❌ |
| GET | `/ai/health` | `X-Metrics-Token` header 🔒 |
| GET | `/ai/dashboard` | `X-Metrics-Token` header 🔒 |
| GET | `/ai/governance` | `X-Metrics-Token` header 🔒 |
| POST | `/frontend-error` | Public (error intake) ❌ |

### `backend/routers/plans.py` — Public

| Method | Path | Auth Mechanism |
|--------|------|---------------|
| GET | `/plans` | Public (plan listing) ❌ |

### `backend/routers/auth.py` — Public auth flows

| Method | Path | Auth Mechanism |
|--------|------|---------------|
| POST | `/auth/register` | Public ❌ |
| POST | `/auth/login` | Public ❌ |
| POST | `/auth/logout` | Public ❌ |
| POST | `/auth/logout-all` | Public ❌ |
| POST | `/auth/refresh` | Public ❌ |
| POST | `/auth/email/verification/resend` | Public ❌ |
| GET | `/auth/email/verify/validate` | Public ❌ |
| POST | `/auth/email/verify` | Public ❌ |
| POST | `/auth/password/forgot` | Public ❌ |
| GET | `/auth/password/reset/validate` | Public ❌ |
| POST | `/auth/password/reset` | Public ❌ |
| POST | `/auth/factories` | Public ❌ |
| POST | `/auth/select-factory` | Public ❌ |
| GET | `/auth/profile-photo/{photo_name}` | Public ❌ |

### `backend/routers/auth_secure.py` — Public auth flows (v2)

| Method | Path | Auth Mechanism |
|--------|------|---------------|
| POST | `/auth/v2/register` | Public ❌ |
| POST | `/auth/v2/login` | Public ❌ |
| POST | `/auth/v2/logout` | Public ❌ |
| POST | `/auth/v2/logout-all` | Public ❌ |
| GET | `/auth/v2/context` | Public ❌ |
| GET | `/auth/v2/me` | Public ❌ |
| POST | `/auth/v2/password/forgot` | Public ❌ |
| POST | `/auth/v2/password/reset` | Public ❌ |
| POST | `/auth/v2/mfa/setup` | Public ❌ |
| POST | `/auth/v2/mfa/verify` | Public ❌ |
| POST | `/auth/v2/mfa/disable` | Public ❌ |

### `backend/routers/auth_google.py` — OAuth flows

| Method | Path | Auth Mechanism |
|--------|------|---------------|
| GET | `/auth/google/login` | Public ❌ |
| GET | `/auth/google/callback` | Public ❌ |

### `backend/routers/phone_auth.py` — OTP flows

| Method | Path | Auth Mechanism |
|--------|------|---------------|
| POST | `/auth/phone/start-verification` | Public ❌ |
| POST | `/auth/phone/confirm-verification` | Public ❌ |

### `backend/routers/billing.py` — Webhook

| Method | Path | Auth Mechanism |
|--------|------|---------------|
| POST | `/billing/webhook/razorpay` | Razorpay HMAC signature 🔒 |

### `backend/routers/ocr/_verifications.py` — Share link (public token)

| Method | Path | Auth Mechanism |
|--------|------|---------------|
| GET | `/ocr/shared/{token}` | Signed share token ❌ |

### `backend/routers/ocr/_templates.py` — Status

| Method | Path | Auth Mechanism |
|--------|------|---------------|
| GET | `/ocr/status` | Public (status check) ❌ |

### `backend/routers/admin_ai.py` — Superadmin guard 🔒

| Method | Path | Auth Mechanism |
|--------|------|---------------|
| GET | `/admin/ai/usage` | `require_superadmin` |
| GET | `/admin/ai/cost-summary` | `require_superadmin` |

### `backend/routers/admin_billing.py` — Superadmin guard 🔒

| Method | Path | Auth Mechanism |
|--------|------|---------------|
| GET | `/admin/billing/events` | `require_superadmin` |
| GET | `/admin/billing/subscriptions` | `require_superadmin` |
| GET | `/admin/billing/quota` | `require_superadmin` |
| POST | `/admin/billing/reset-quota/{org_id}` | `require_superadmin` + PDP |

---

## Summary

| Category | Count |
|----------|-------|
| ✅ Routes with PDP checks | ~120 |
| ⚠️ Routes with `get_current_user` only (need PDP) | ~45 |
| ❌ Routes with no user auth (intentional) | ~55 |
| **Total** | **~220** |

## Priority Fix List (Task 1.2)

Routes that **must** get PDP checks added, ordered by risk:

1. `POST /entries` — `production.entry.create`
2. `GET /entries` — `production.entry.view`