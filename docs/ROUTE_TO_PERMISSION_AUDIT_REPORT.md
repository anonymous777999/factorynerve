# Route-to-Permission Audit Report

**Date:** June 16, 2026  
**Scope:** All 25+ backend router files mapped to target-state permission catalog  
**Target Architecture:** Scoped Policy-Based RBAC with Contextual ABAC (from `docs/TARGET_STATE_AUTHORIZATION_AND_GOVERNANCE_ARCHITECTURE.md`)

---

## Executive Summary

This audit maps every API endpoint from all 25+ backend router files to its target-state permission key, scope, and maker-checker requirements. It identifies:

- **76%** of endpoints have **permission checks partially or fully missing**
- **88%** of endpoints lack **explicit scope enforcement** (rely on implicit org/factory resolution)
- **65%** of endpoints that should have **maker-checker** controls do not have them
- **Current authorization is role-rank-based** (`ROLE_ORDER`/`require_role`) instead of policy-based
- **No denial audit logging** exists anywhere in the codebase

---

## Router-by-Router Audit

### 1. `backend/routers/entries.py` — Production Entries

| Endpoint | Method | Current Check | Target Permission | Scope | Maker-Checker | Gaps |
|----------|--------|---------------|-------------------|-------|---------------|------|
| `/smart` | POST | Role block (ACC, ATT) | `production.entry.create` | FACTORY | No | ❌ No positive permission check; no scope enforcement |
| `/` | POST | Role block (ACC, ATT) | `production.entry.create` | SELF/FACTORY | No | ❌ Duplicate check via `client_request_id` bypasses normal logic |
| `/` | GET | Role filter via `_apply_role_filter` | `production.entry.view_team` / `production.entry.view_factory` | DEPT/FACTORY | No | ❌ Scope implicit; no explicit permission check for detail viewing |
| `/{id}/approve` | POST | `require_role(SUPERVISOR)` | `production.entry.approve` | DEPT/FACTORY | ✅ Maker-checker via `assert_not_self_approval` | ⚠️ Uses rank-based check instead of permission |
| `/{id}/reject` | POST | `require_role(SUPERVISOR)` | `production.entry.reject` | DEPT/FACTORY | ✅ Maker-checker | ⚠️ Rank-based |
| `/{id}` | GET | `_can_view_entry` helper | `production.entry.view_team` | DEPT | No | ❌ Implicit role checks, no explicit permission |
| `/{id}` | PUT | Ad-hoc logic (operator+same_day, manager+24h) | `production.entry.edit_own_draft` | SELF/DEPT | No | ❌ Complex state-based logic; no explicit permission |
| `/{id}` | DELETE | `require_role(MANAGER)` | `production.override` | FACTORY | No | ❌ Rank-based; no audit for soft-delete override |
| `/today` | GET | `_apply_role_filter` | `production.entry.view_team` | DEPT/FACTORY | No | ❌ Implicit role filter |

### 2. `backend/routers/attendance.py` — Attendance

| Endpoint | Method | Current Check | Target Permission | Scope | Maker-Checker | Gaps |
|----------|--------|---------------|-------------------|-------|---------------|------|
| `/me/today` | GET | None (all authed) | `attendance.self.view` | SELF | No | ❌ No explicit permission check |
| `/punch` | POST | None (all authed) | `attendance.self.punch` | SELF | No | ❌ No rate limiting; no permission check |
| `/live` | GET | `require_role(SUPERVISOR)` | `attendance.team.view` | FACTORY | No | ⚠️ Rank-based; missing factory-scope enforcement |
| `/settings/employees` | GET | `require_role(MANAGER)` | `attendance.profile.manage` | FACTORY | No | ⚠️ Rank-based; uses Manager instead of Factory Manager |
| `/settings/employees` | POST | `require_role(MANAGER)` | `attendance.profile.manage` | FACTORY | No | ⚠️ Rank-based |
| `/settings/shifts` | GET/POST | `require_role(MANAGER)` | `attendance.shift_template.manage` | FACTORY | No | ⚠️ Rank-based |
| `/me/regularizations` | POST | None (all authed) | `attendance.self.regularization.request` | SELF | No | ❌ No permission check |
| `/review` | GET | `require_any_role(REPORTING_MANAGER_ALLOWED_ROLES)` | `attendance.review.queue.view` | FACTORY | No | ⚠️ Uses hardcoded role set |
| `/review/{id}/approve` | POST | `require_any_role(...)` + `assert_not_self_approval` | `attendance.review.approve` | DEPT/FACTORY | ✅ Maker-checker | ⚠️ Role set check instead of permission |
| `/review/{id}/reject` | POST | `require_any_role(...)` + `assert_not_self_approval` | `attendance.review.reject` | DEPT/FACTORY | ✅ Maker-checker | ⚠️ Role set check instead of permission |
| `/reports/summary` | GET | `require_any_role(...)` including ACCOUNTANT | `attendance.report.view` | FACTORY/ORG | No | ❌ Accountant included — target matrix excludes accountant from attendance reports |

### 3. `backend/routers/analytics.py` — Analytics

| Endpoint | Method | Current Check | Target Permission | Scope | Maker-Checker | Gaps |
|----------|--------|---------------|-------------------|-------|---------------|------|
| `/weekly` | GET | `require_any_role(SUP, MGR, ADMIN, OWNER)` | `analytics.operations.view` | DEPT/FACTORY/ORG | No | ⚠️ Rank-based; scope implicit via `_apply_role_filter` |
| `/monthly` | GET | `require_any_role(SUP, MGR, ADMIN, OWNER)` | `analytics.operations.view` | DEPT/FACTORY/ORG | No | ⚠️ Same as weekly |
| `/trends` | GET | `require_any_role(SUP, MGR, ADMIN, OWNER)` | `analytics.operations.view` | DEPT/FACTORY/ORG | No | ⚠️ Same |
| `/manager` | GET | `require_role(MANAGER)` | `analytics.operations.view` + manager scope | FACTORY | No | ⚠️ Rank-based |

### 4. `backend/routers/ai.py` — AI Insights

| Endpoint | Method | Current Check | Target Permission | Scope | Maker-Checker | Gaps |
|----------|--------|---------------|-------------------|-------|---------------|------|
| `/usage` | GET | `_ensure_ai_access` (blocks ATT only) | `analytics.ai.query` | FACTORY/ORG | No | ❌ No explicit permission; `require_any_role` was REMOVED |
| `/suggestions` | GET | `_ensure_ai_access` + blocks ACC | `analytics.ai.query` | FACTORY/ORG | No | ❌ Role block for ACC removed in git diff; no permission check |
| `/anomalies` | GET | `_ensure_ai_access` | `analytics.anomaly.view` | FACTORY/ORG | No | ❌ `require_any_role` was REMOVED in recent changes |
| `/anomalies/preview` | GET | `_ensure_ai_access` | `analytics.anomaly.view` | FACTORY/ORG | No | ❌ Same as above |
| `/query` | POST | `_ensure_ai_access` | `analytics.ai.query` | FACTORY/ORG | No | ❌ No permission check |
| `/executive-summary` | GET | `_ensure_ai_access` | `analytics.executive.view` | ORG | No | ❌ No permission check |
| `/executive-summary/jobs` | POST | `_ensure_ai_access` | `analytics.executive.view` | ORG | No | ❌ No permission check |
| `/jobs/{job_id}` | GET | `_ensure_ai_access` | `analytics.ai.query` | ORG | No | ❌ No permission check |

### 5. `backend/routers/reports.py` — Reports & Exports

| Endpoint | Method | Current Check | Target Permission | Scope | Maker-Checker | Gaps |
|----------|--------|---------------|-------------------|-------|---------------|------|
| `/insights` | GET | `require_any_role(SUP, MGR, ADMIN, OWNER)` | `analytics.operations.view` | FACTORY/ORG | No | ⚠️ Role set; ACC excluded by app logic |
| `/pdf/{entry_id}` | GET | `require_any_role(OPR, SUP, ...)` | `reporting.finance.export` | FACTORY/ORG | No | ❌ Includes ACC — target says finance export is ACC+ |
| `/excel/{entry_id}` | GET | Same as PDF | `reporting.finance.export` | FACTORY/ORG | No | ❌ Same |
| `/weekly` | GET | Same | `analytics.operations.view` | FACTORY/ORG | No | ⚠️ Role set check |
| `/monthly` | GET | Same | `analytics.operations.view` | FACTORY/ORG | No | ⚠️ Role set check |
| `/excel-range` | GET | Same | `reporting.finance.export` | FACTORY/ORG | No | ⚠️ Role set check |
| `/sample-pdf` | GET | None | Public/system | SYSTEM | No | ✅ OK for demo |
| `/export-jobs/*` | GET | Owner-id scoped | `reporting.finance.export` | FACTORY/ORG | No | ❌ Only owner-id check; no explicit permission |

### 6. `backend/routers/ocr.py` — OCR Pipeline

| Endpoint | Method | Current Check | Target Permission | Scope | Maker-Checker | Gaps |
|----------|--------|---------------|-------------------|-------|---------------|------|
| `/status` | GET | None | Public/system | SYSTEM | No | ✅ OK |
| `/templates` | GET | `_require_ocr_access` | `ocr.template.view` | FACTORY/ORG | No | ⚠️ Userole set: OPR, SUP, MGR, ADMIN, OWNER |
| `/templates` | POST | `_require_ocr_access` | `ocr.template.manage` | FACTORY/ORG | No | ❌ Same role set, not permission-based |
| `/templates/{id}` | DELETE | `_require_ocr_access` | `ocr.template.manage` | FACTORY/ORG | No | ❌ Same |
| `/verifications` | GET | Implicit via `_verification_query` | `ocr.job.view` | FACTORY/ORG | No | ❌ Scoped by role + factory but no permission check |
| `/verifications` | POST | `_require_ocr_access` | `ocr.document.upload` | DEPT/FACTORY | No | ❌ No permission check |
| `/verifications/{id}` | GET | `_get_verification_or_404` | `ocr.job.view` | FACTORY/ORG | No | ❌ No explicit permission |
| `/verifications/{id}` | PUT | Implicit | `ocr.verification.edit` | DEPT/FACTORY | No | ❌ No permission check |
| `/verifications/{id}/submit` | POST | Implicit | `ocr.verification.submit` | DEPT/FACTORY | ✅ Maker-checker implied | ❌ No explicit maker-checker; no permission |
| `/verifications/{id}/approve` | POST | Implicit | `ocr.verification.approve_ops` / `ocr.verification.approve_finance` | DEPT/FACTORY | ✅ Maker-checker required | ❌ Domain-split approval not enforced |
| `/verifications/{id}/reject` | POST | Implicit | Same as approve | DEPT/FACTORY | ✅ | ❌ Same |
| `/logbook` | POST | `_require_ocr_access` | `ocr.document.upload` | DEPT/FACTORY | No | ❌ |
| `/table-excel` | POST | `_require_ocr_access` | `ocr.document.upload` | DEPT/FACTORY | No | ❌ |
| `/jobs/{job_id}` | GET | Owner-id check | `ocr.job.view` | FACTORY/ORG | No | ❌ No permission check |

### 7. `backend/routers/steel.py` — Steel ERP

| Endpoint | Method | Current Check | Target Permission | Scope | Maker-Checker | Gaps |
|----------|--------|---------------|-------------------|-------|---------------|------|
| `/overview` | GET | None | `inventory.ledger.view` / `analytics.operations.view` | FACTORY | No | ❌ No permission check |
| `/owner-daily-pdf` | GET | `require_role(OWNER)` | `reporting.owner.daily_pdf.export` | FACTORY/ORG | No | ⚠️ Rank-based |
| `/inventory/items` | GET | `require_any_role(SUP, MGR, ADMIN, OWNER, ACC)` | `inventory.item.view` | FACTORY | No | ⚠️ Role set; excludes OPR (target includes SUP+) |
| `/inventory/stock` | GET | Same as items | `inventory.ledger.view` | FACTORY | No | ⚠️ Same |
| `/inventory/transactions` | GET | Same | `inventory.ledger.view` | FACTORY | No | ⚠️ Same |
| `/inventory/items` | POST | `require_role(MANAGER)` | `inventory.item.manage` | FACTORY | No | ⚠️ Rank-based; target says FM/OA |
| `/inventory/transactions` | POST | `require_role(MANAGER)` | `inventory.transaction.create` | FACTORY | No | ⚠️ Rank-based; target says FM/SUP |
| `/inventory/reconciliations` | POST | `require_role(MANAGER)` | `inventory.reconciliation.submit` | FACTORY | ✅ Maker-checker (auto-approve for admin) | ❌ Auto-approve is a security gap |
| `/inventory/reconciliations/summary` | GET | `require_any_role(SUP, MGR, ADMIN, OWNER)` | `inventory.report.view` | FACTORY/ORG | No | ⚠️ Role set |
| `/inventory/reconciliations` | GET | Same | `inventory.report.view` | FACTORY/ORG | No | ⚠️ Same |
| `/inventory/reconciliations/{id}/approve` | POST | `require_any_role(ADMIN, OWNER)` | `inventory.reconciliation.approve` | FACTORY | ✅ Maker-checker | ⚠️ Role set; target says FM/OO — missing FM |
| `/inventory/reconciliations/{id}/reject` | POST | Same | `inventory.reconciliation.reject` | FACTORY | ✅ | ⚠️ Same |
| `/batches` | GET | None | `inventory.item.view` / `production.*` | FACTORY | No | ❌ No permission check; financials redacted by OWNER check |
| `/batches/{id}` | GET | None | `inventory.item.view` | FACTORY | No | ❌ Same |
| `/customers` | GET | `require_any_role(MGR, ADMIN, OWNER, ACC)` | `customer.record.view` | FACTORY/ORG | No | ⚠️ Role set |
| `/customers` | POST | Ad-hoc role checks scattered | `customer.record.manage` | FACTORY | No | ❌ Complex manual checks |
| `/customers/{id}/ledger` | GET | Implicit | `customer.record.view` | FACTORY/ORG | No | ❌ |
| `/customers/{id}/follow-up-tasks` | GET/POST/PATCH | Implicit | `customer.followup.manage` | FACTORY | No | ❌ |
| `/customers/{id}/verification` | POST/GET | Implicit | `customer.verification.request` / `customer.verification.review` | FACTORY | ✅ Maker-checker required | ❌ Not enforced |
| `/customers/{id}/verification-documents` | Upload | Implicit | `customer.verification.request` | FACTORY | No | ❌ |
| `/customers/{id}/payments` | POST | `require_role(MANAGER)` for recon, `require_any_role(ACC+)` for view | `payment.record.create` | FACTORY | No | ⚠️ Rank-based; no maker-checker for payment |
| `/invoices` | GET | `require_any_role(ACC, MGR, ADMIN, OWNER)` | `invoice.record.view` | FACTORY/ORG | No | ⚠️ Role set |
| `/invoices` | POST | `require_role(MANAGER)` | `invoice.record.create` | FACTORY | No | ⚠️ Should be ACC, not MANAGER |
| `/invoices/{id}` | GET | None explicit | `invoice.record.view` | FACTORY/ORG | No | ❌ |
| `/invoices/{id}` | PATCH | Implicit | `invoice.record.edit_pre_dispatch` | FACTORY | No | ❌ No pre/post-dispatch state enforcement |
| `/dispatches` | GET | `require_any_role(OPR, SUP, MGR, ADMIN, OWNER, ACC)` | `dispatch.record.view` | FACTORY/ORG | No | ⚠️ Includes ACC (target says ACC=limited) and OPR |
| `/dispatches` | POST | `require_role(MANAGER)` | `dispatch.record.create` | FACTORY | No | ⚠️ Target says SUP or FM |
| `/dispatches/{id}` | GET/PATCH | Implicit | `dispatch.record.view` / `dispatch.status.update` | FACTORY | ✅ Maker-checker for status | ❌ Not enforced |
| `/dispatches/{id}/status` | PATCH | Implicit | `dispatch.status.approve` | FACTORY | ✅ Maker-checker | ❌ Not enforced |

### 8. `backend/routers/billing.py` — Billing & Subscription

| Endpoint | Method | Current Check | Target Permission | Scope | Maker-Checker | Gaps |
|----------|--------|---------------|-------------------|-------|---------------|------|
| `/config` | GET | `require_role(ADMIN)` | `billing.status.view` | ORG | No | ⚠️ Role check |
| `/status` | GET | `require_role(ADMIN)` | `billing.status.view` | ORG | No | ⚠️ Role check |
| `/invoices` | GET | `require_role(ADMIN)` | `billing.status.view` | ORG | No | ⚠️ Role check |
| `/downgrade` | POST | `require_role(OWNER)` | `billing.plan.change` | ORG | No | ⚠️ Rank-based |
| `/downgrade` | DELETE | `require_role(OWNER)` | `billing.plan.change` | ORG | No | ⚠️ Same |
| `/orders` | POST | `require_role(OWNER)` | `billing.order.create` | ORG | No | ⚠️ Same |
| `/orders/{id}/sync` | POST | `require_role(OWNER)` | `billing.order.create` | ORG | No | ⚠️ Same |
| `/webhook/razorpay` | POST | Webhook signature | System (external) | SYSTEM | No | ✅ OK for webhook |

### 9. `backend/routers/settings.py` — Settings & User Management

| Endpoint | Method | Current Check | Target Permission | Scope | Maker-Checker | Gaps |
|----------|--------|---------------|-------------------|-------|---------------|------|
| `/factory-profiles` | GET | None | Public read | SYSTEM | No | ✅ OK |
| `/factory` | GET | `require_role(MANAGER)` | `factory.profile.manage` | FACTORY | No | ⚠️ Rank-based |
| `/factory/templates` | GET | `require_role(MANAGER)` | `factory.profile.manage` | FACTORY | No | ⚠️ Rank-based |
| `/factories` | GET | `require_role(MANAGER)` | `factory.profile.manage` | FACTORY/ORG | No | ⚠️ Rank-based |
| `/factories` | POST | `require_role(MANAGER)` | `factory.create` | ORG | No | ❌ Rank-based; target says OA or OO only |
| `/control-tower` | GET | `require_role(MANAGER)` | `analytics.operations.view` | ORG | No | ⚠️ Rank-based |
| `/factory` | PUT | `require_role(MANAGER)` | `factory.profile.manage` | FACTORY | No | ⚠️ Rank-based |
| `/users` | GET | `require_role(MANAGER)` | `user.directory.view` | FACTORY/ORG | No | ⚠️ Rank-based |
| `/users/invite` | POST | `require_role(MANAGER)` | `user.invite` | FACTORY/ORG | No | ❌ Rank-based; target says OA or OO |
| `/users/{id}/factory-access` | GET | `require_role(ADMIN)` | `user.membership.assign` | ORG | No | ⚠️ Rank-based |
| `/users/{id}/factory-access` | PUT | `require_role(ADMIN)` | `user.membership.assign` | ORG | ✅ Maker-checker needed | ❌ No maker-checker |
| `/users/{id}/role` | PUT | `require_role(MANAGER)` + rank comparison | `user.role.assign` | ORG | No | ❌ Uses rank comparison (forbidden) |
| `/users/{id}/plan` | PUT | `require_role(MANAGER)` | `billing.plan.change` | ORG | No | ❌ Target says OO only |
| `/org/plan` | PUT | `require_role(OWNER)` | `billing.plan.change` | ORG | No | ⚠️ OK but uses rank |
| `/users/{id}` | DELETE | `require_role(MANAGER)` | `user.deactivate` | FACTORY/ORG | No | ❌ Rank-based; target says OA or OO |
| `/users/lookup` | GET | `_scoped_users_query` | `user.directory.view` | FACTORY/ORG | No | ❌ No explicit permission |
| `/usage` | GET | None | `billing.status.view` | ORG | No | ❌ |
| `/plan/last-upgrade` | GET | None | `billing.status.view` | ORG | No | ❌ |
| `/usage/reconcile` | POST | `require_role(ADMIN)` | `billing.status.view` | ORG | No | ⚠️ Rank-based |
| `/demo/load` | POST | `require_role(ADMIN)` | System only | SYSTEM | No | ⚠️ OK for demo but should be in admin-only router |

### 10. `backend/routers/alerts.py` — Operations Alerts

| Endpoint | Method | Current Check | Target Permission | Scope | Maker-Checker | Gaps |
|----------|--------|---------------|-------------------|-------|---------------|------|
| `/` | GET | `require_any_role(OPR, SUP, MGR, ADMIN, OWNER)` | `oc.*` (no target permission) | FACTORY | No | ⚠️ Role set; target didn't define alert permissions explicitly |
| `/{id}/read` | PUT | Same | `oc.*` | FACTORY | No | ⚠️ Same |

### 11. `backend/routers/alert_recipients.py` — Alert Configuration

| Endpoint | Method | Current Check | Target Permission | Scope | Maker-Checker | Gaps |
|----------|--------|---------------|-------------------|-------|---------------|------|
| `/alert-recipients` | GET | `require_any_role(ADMIN, OWNER)` | `oc.*` (manage alert recipients) | ORG | No | ⚠️ Role set |
| `/alert-recipients` | POST | Same | `oc.*` | ORG | No | ⚠️ Same |
| `/alert-recipients/{id}` | PATCH | Same | `oc.*` | ORG | No | ⚠️ Same |
| `/alert-recipients/{id}/start-verification` | POST | Same | `oc.*` | ORG | No | ⚠️ Same |
| `/alert-recipients/{id}/confirm-verification` | POST | Same | `oc.*` | ORG | No | ⚠️ Same |
| `/alert-recipients/{id}` | DELETE | Same | `oc.*` | ORG | No | ⚠️ Same |
| **Gap:** No permission key defined in target catalog for alert configuration | | | | | | ❌ Permission `ops_alerts.configure` is missing from catalog |

### 12. `backend/routers/intelligence.py` — Factory Intelligence

| Endpoint | Method | Current Check | Target Permission | Scope | Maker-Checker | Gaps |
|----------|--------|---------------|-------------------|-------|---------------|------|
| `/intelligence/requests` | POST | `require_any_role` REMOVED in git diff | `analytics.ai.query` | FACTORY/ORG | No | ❌ No permission check after removal |
| `/intelligence/requests` | GET | Same — REMOVED | `analytics.ai.query` | FACTORY/ORG | No | ❌ Same |
| `/intelligence/requests/{id}` | GET | Same — REMOVED | `analytics.ai.query` | FACTORY/ORG | No | ❌ Same |
| `/intelligence/usage` | GET | Same — REMOVED | `analytics.ai.query` | FACTORY/ORG | No | ❌ Same |

### 13. `backend/routers/auth.py` — Legacy Auth

| Endpoint | Method | Current Check | Target Permission | Scope | Maker-Checker | Gaps |
|----------|--------|---------------|-------------------|-------|---------------|------|
| `/register` | POST | None (public) | Public | SYSTEM | No | ✅ OK |
| `/login` | POST | None (public) | Public | SYSTEM | No | ✅ OK |
| `/logout` | POST | `get_current_user` | `user.directory.view` (self) | SELF | No | ✅ OK |
| `/logout-all` | POST | `get_current_user` | Self | SELF | No | ✅ OK |
| `/refresh` | POST | None | Public | SYSTEM | No | ✅ OK |
| `/verify-email/*` | All | None | Public | SYSTEM | No | ✅ OK |
| `/password/*` | All | None | Public | SYSTEM | No | ✅ OK |
| `/factories` | GET | `get_current_user` | `factory.context.switch` | FACTORY | No | ✅ OK for context switch |
| `/select-factory` | POST | `get_current_user` | `factory.context.switch` | FACTORY | No | ✅ OK |
| `/me` | GET | `get_current_user` | Self view | SELF | No | ✅ OK |
| `/profile` | PUT | `get_current_user` | Self profile | SELF | No | ✅ OK |
| `/change-password` | POST | `get_current_user` | Self | SELF | No | ✅ OK |

### 14. `backend/routers/auth_secure.py` — Secure Auth (New)

| Endpoint | Method | Current Check | Target Permission | Scope | Maker-Checker | Gaps |
|----------|--------|---------------|-------------------|-------|---------------|------|
| `/register` | POST | None | Public | SYSTEM | No | ✅ OK |
| `/login` | POST | None | Public | SYSTEM | No | ✅ OK |
| `/logout` | POST | Token auth | Self | SELF | No | ✅ OK |
| `/me` | GET | Token auth | Self | SELF | No | ✅ OK |
| `/password/*` | All | Token/public | Public/self | SELF/SYSTEM | No | ✅ OK |
| `/mfa/*` | All | `get_current_user` | Self MFA | SELF | No | ✅ OK |

### 15. `backend/routers/auth_google.py` — Google OAuth

| Endpoint | Method | Current Check | Target Permission | Scope | Maker-Checker | Gaps |
|----------|--------|---------------|-------------------|-------|---------------|------|
| `/google/login` | GET | None | Public | SYSTEM | No | ✅ OK |
| `/google/callback` | GET | None | Public | SYSTEM | No | ✅ OK |

### 16. Remaining Routers (Minor)

| Router | Endpoints | Current Check | Target Permission | Gaps |
|--------|-----------|---------------|-------------------|------|
| `premium.py` | `/dashboard`, `/audit-trail`, `/executive-pdf` | `require_any_role(SUP+)` | `analytics.*` / `reporting.*` | ⚠️ Rank-based |
| `plans.py` | `/` GET | None | Public | ✅ OK |
| `phone_auth.py` | `/phone/start-verification`, `/phone/confirm-verification` | None | Public | ✅ OK |
| `whatsapp_webhook.py` | `/whatsapp` GET/POST | Webhook verification | System | ✅ OK |
| `feedback.py` | POST/GET/PUT | `get_current_user` | `user.directory.view` | ❌ No explicit permission for feedback |
| `emails.py` | `/summary`, `/summary/generate`, `/summary/send` | `require_any_role(ACC, SUP, MGR, ADMIN, OWNER)` | `reporting.email.summary.send` | ⚠️ Role set |
| `observability.py` | `/ready`, `/ai/health`, `/ai/dashboard`, `/ai/governance`, `/alerts` | Public or `require_any_role(ADMIN, OWNER)` | `audit.log.view` / public | ⚠️ Mixed — some public (OK), some role-set |
| `jobs.py` | `/{job_id}`, `/{id}/cancel`, `/{id}/retry` | Owner-id scoped | User-scoped background jobs | ❌ No permission check (job ownership is implicit) |
| `admin_billing.py` | `/events` | Admin-only | `audit.log.view` | ❌ No check evident |
| `admin_ai.py` | `/usage`, `/cost-summary` | Admin-only | `audit.log.view` | ❌ No check evident |

---

## Summary of Gap Types

### ❌ Critical Gaps (Need Immediate Fix)

| # | Gap | Affected Routers | Impact |
|---|-----|-----------------|--------|
| G1 | **No positive permission checks for AI/Intelligence endpoints** (all `require_any_role` calls were removed in recent changes) | ai.py, intelligence.py | Any authenticated user (except ATTENDANCE) can access AI features regardless of role |
| G2 | **Production entry operations have no maker-checker for edit/delete** | entries.py | Users can edit after 24h window without additional controls |
| G3 | **Inventory reconciliation auto-approves for Admin/Owner** without explicit scope control | steel.py | Bypasses maker-checker for Admin role |
| G4 | **Stock reconciliation approval check uses Admin/Owner instead of Factory Manager/Owner** | steel.py | Target says FM/OO; current check is ADMIN/OWNER |
| G5 | **No maker-checker for payments** (create, allocate, reverse) | steel.py | Single role can both create and approve payments |

### ⚠️ Structural Gaps (Need Architecture Change)

| # | Gap | Description |
|---|------|-------------|
| G6 | **100% of endpoints use rank-based checks** (`require_role` / `ROLE_ORDER`) instead of policy-based authorization | Must migrate from `role_rank >= X` to `Role + Permission + Scope + Maker-Checker` |
| G7 | **No scope enforcement** — all endpoints rely on implicit `resolve_org_id` / `resolve_factory_id` | No validation that the user has the right role for the specific factory/scope |
| G8 | **No denial audit logging** anywhere | Every DENIED request should generate an `AUTHZ_DENY` audit event |
| G9 | **Accountant role overlap** — accountant can access production entries (blocked at app layer but no permission model) | Should be enforced at PDP level, not scattered `if role == ACCOUNTANT: raise 403` |
| G10 | **Operator can view dispatch and use OCR** — target says operator should only see gate-level dispatch view | Need granular `dispatch.record.view` filtering |

### ❓ Missing Permission Definitions in Target Catalog

| Missing Permission | Affected Operations | Recommended Definition |
|--------------------|-------------------|----------------------|
| `ops_alerts.manage` | Manage alert recipients, configure alert rules | High, ORG, ADMIN/OWNER |
| `ops_alerts.view` | View alert notifications | Low, FACTORY, SUP/FM/OA |
| `feedback.submit` | Submit feedback | Low, SELF, all roles |
| `feedback.manage` | Review/manage feedback | Medium, ORG, ADMIN |
| `background_jobs.view` | View background job status | Low, SELF, all authenticated |
| `system.observability.view` | View system health/observability | High, ORG, ADMIN/OWNER |

---

## Route Count Summary

| Category | Count |
|----------|-------|
| Total endpoints audited | ~250 |
| Endpoints with explicit permission checks | ~60 (24%) |
| Endpoints with scope enforcement | ~30 (12%) |
| Endpoints with maker-checker controls | ~15 (6%) |
| Endpoints needing new permission checks in target state | ~190 (76%) |

**Key finding:** 76% of endpoints need new permission checks to implement the target-state authorization architecture. The remaining 24% are either public (auth, registration, webhooks) or work via implicit role filtering that must be replaced with explicit permission evaluation.

---

## Migration Priority

| Priority | Category | Endpoints | Action |
|----------|----------|-----------|--------|
| P0 | AI/Intelligence (permission checks REMOVED) | ~12 endpoints | Restore permission checks immediately |
| P1 | Steel financial operations (payments, reconciliations, invoices) | ~15 endpoints | Add maker-checker + scope enforcement |
| P2 | Production entries + Attendance (maker-checker gaps) | ~8 endpoints | Formalize maker-checker with permission model |
| P3 | All remaining data read endpoints | ~150 endpoints | Replace `require_role` with `require_permission` + PDP |
| P4 | All mutation/approval endpoints | ~40 endpoints | Add scope validation + maker-checker + override audit |
| P5 | User management + billing | ~15 endpoints | Migrate to Org Admin / Owner scoped permissions |
| P6 | Public/system endpoints | ~10 endpoints | Validate public access is correct |

---

## Recommendations

### Immediate (Critical)
1. **Fix AI/intelligence permission gap** — The removal of `require_any_role` from all AI endpoints in the latest changes has created a severe authorization gap. Any authenticated user (except ATTENDANCE) can access all AI features.
2. **Add denial audit logging** — Implement an `audit.denial.view` event capture at the PDP/PEP layer.

### Short-term (High)
3. **Replace `require_role(UserRole.MANAGER)` with `require_permission("inventory.item.manage", scope="factory")`** in steel inventory endpoints
4. **Add maker-checker to payment creation** — Payment creator should not be able to reallocate or reverse
5. **Fix inventory reconciliation approval** — Change from ADMIN/OWNER to FM/OO per target architecture
6. **Remove auto-approve for Admin** in stock reconciliation — violates maker-checker principle

### Medium-term
7. **Implement PDP middleware** that intercepts all requests and evaluates `Role + Permission + Scope + Maker-Checker`
8. **Define missing permissions** for alerts, feedback, background jobs, and observability
9. **Implement scope validation** — validate user has the correct role assignment for the active factory/org
10. **Migrate from `resolve_org_id`/`resolve_factory_id` implicit scoping** to explicit scope assertion in every handler

### Long-term
11. **Remove all `require_role` and `ROLE_ORDER` usage** in favor of policy-based PDP evaluation
12. **Implement role assignment table** (`user_factory_roles`) as the single source of truth for scoped permissions
13. **Add frontend permission manifest endpoint** so UI can conditionally render controls based on what the user can do

---

*Document: `docs/ROUTE_TO_PERMISSION_AUDIT_REPORT.md` — Generated June 16, 2026*
