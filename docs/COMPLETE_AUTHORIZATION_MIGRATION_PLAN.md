# Complete Authorization Migration Plan — DPR.ai

**Source Architecture:** Scoped Policy-Based RBAC with Contextual ABAC  
**Formula:** `Role + Permission + Scope + Maker-Checker + Audit`  
**Reference Docs:** `TARGET_STATE_AUTHORIZATION_AND_GOVERNANCE_ARCHITECTURE.md`, `AUTHORIZATION_FOUNDATION_ENGINEERING_SPEC.md`, `ROUTE_TO_PERMISSION_AUDIT_REPORT.md`  
**Date:** June 16, 2026  

---

## Table of Contents

1. [Priority Framework](#1-priority-framework)
2. [Module Migration Matrix (28 Modules)](#2-module-migration-matrix)
3. [Per-Endpoint Migration Detail](#3-per-endpoint-migration-detail)
4. [Cross-Cutting Gap Register](#4-cross-cutting-gap-register)
5. [Workflow Dependencies & Sequencing](#5-workflow-dependencies--sequencing)
6. [Test Case Catalog](#6-test-case-catalog)
7. [Migration Rollback Plan](#7-migration-rollback-plan)
8. [Appendix: Permission-to-Route Quick Reference](#8-appendix-permission-to-route-quick-reference)

---

## 1. Priority Framework

### Priority Definitions

| Priority | Definition | SLA |
|----------|------------|:---:|
| **P0 — Critical** | Unauthorized access possible; security vulnerability; compliance violation | Fix within 1 sprint |
| **P1 — High** | Permission gap for financial/manufacturing control; missing maker-checker for approvals | Fix within 2 sprints |
| **P2 — Medium** | Missing scope enforcement; missing audit events; read permission gap for non-sensitive data | Fix within 4 sprints |
| **P3 — Low** | Missing MFA enforcement; denial logging improvement; observability/admin endpoints | Fix within 8 sprints |

### Auto-Assignment Rules

A gap is automatically assigned P0 if:
- Permission check was removed (AI, intelligence endpoints)
- No authorization exists for a financial mutation (payments, invoices, billing)
- No maker-checker exists for a dual-control workflow (reconciliation, payment reversal)
- Any authenticated user can access a restricted resource

A gap is automatically assigned P1 if:
- Uses rank-based check (`require_role`) instead of permission-based
- Scope is implicit (org/factory resolved but not validated)
- Maker-checker exists but is not permission-enforced
- No audit event for an override action

A gap is automatically assigned P2 if:
- Read endpoint with implicit role filtering
- Missing denial audit log
- Missing state validation on update
- Missing factory isolation check for multi-factory scenario

A gap is automatically assigned P3 if:
- MFA not enforced for an action that requires it
- Admin-only endpoints without explicit permission checks
- Observability/health endpoints with role checks

---

## 2. Module Migration Matrix

### Legend

| Column | Description |
|--------|-------------|
| Endpoints | Number of endpoints in this router |
| Current Auth | Number of endpoints with ANY authorization check |
| Permission Gap | Number missing target permission |
| Scope Gap | Number missing scope enforcement |
| MC Gap | Number missing maker-checker where required |
| Audit Gap | Number missing audit events for mutations |
| SoD Gap | Number missing separation-of-duties check |
| State Gap | Number missing workflow state validation |
| Denial Log Gap | Number missing denial audit logging |
| MFA Gap | Number missing MFA where required |
| BG Gap | Number missing break-glass controls where required |
| Priority | Dominant priority level |

| Module | Endpoints | Current Auth | Permission Gap | Scope Gap | MC Gap | Audit Gap | SoD Gap | State Gap | Denial Log Gap | MFA Gap | BG Gap | Priority |
|--------|:---------:|:------------:|:--------------:|:---------:|:------:|:---------:|:-------:|:---------:|:--------------:|:-------:|:------:|:--------:|
| 1. Authentication | 30 | 6 (20%) | 0 | 0 | 0 | 0 | 0 | 0 | 30 | 3 | 0 | P2 |
| 2. Attendance | 11 | 8 (73%) | 11 | 11 | 3 | 6 | 2 | 3 | 11 | 0 | 1 | P1 |
| 3. Production Entries | 10 | 8 (80%) | 10 | 9 | 3 | 8 | 2 | 3 | 10 | 0 | 1 | P1 |
| 4. OCR | 16 | 12 (75%) | 16 | 15 | 6 | 10 | 4 | 4 | 16 | 0 | 0 | P1 |
| 5. Analytics | 4 | 4 (100%) | 4 | 4 | 0 | 0 | 0 | 0 | 4 | 0 | 0 | P2 |
| 6. AI Insights | 8 | 8 (100%) | 8 | 8 | 0 | 6 | 0 | 0 | 8 | 0 | 0 | **P0** |
| 7. Intelligence | 4 | 0 (0%) | 4 | 4 | 0 | 2 | 0 | 0 | 4 | 0 | 0 | **P0** |
| 8. Reports | 11 | 10 (91%) | 10 | 10 | 0 | 2 | 0 | 0 | 11 | 0 | 0 | P2 |
| 9. Alerts | 2 | 2 (100%) | 2 | 2 | 0 | 0 | 0 | 0 | 2 | 0 | 0 | P2 |
| 10. Alert Recipients | 6 | 6 (100%) | 6 | 6 | 0 | 4 | 0 | 0 | 6 | 0 | 0 | P2 |
| 11. Steel Inventory | 11 | 10 (91%) | 11 | 11 | 3 | 9 | 3 | 2 | 11 | 0 | 1 | P1 |
| 12. Production Batches | 2 | 0 (0%) | 2 | 2 | 0 | 0 | 0 | 0 | 2 | 0 | 0 | P1 |
| 13. Customers | 5 | 3 (60%) | 5 | 5 | 2 | 4 | 1 | 1 | 5 | 0 | 0 | P1 |
| 14. Customer Verification | 4 | 0 (0%) | 4 | 4 | 2 | 4 | 1 | 1 | 4 | 0 | 0 | P1 |
| 15. Customer Followups | 3 | 0 (0%) | 3 | 3 | 0 | 2 | 0 | 1 | 3 | 0 | 0 | P2 |
| 16. Invoices | 6 | 4 (67%) | 6 | 6 | 2 | 4 | 2 | 2 | 6 | 0 | 1 | P1 |
| 17. Dispatch | 7 | 5 (71%) | 7 | 7 | 3 | 6 | 2 | 3 | 7 | 0 | 1 | P1 |
| 18. Payments | 3 | 2 (67%) | 3 | 3 | 2 | 3 | 2 | 1 | 3 | 0 | 1 | P1 |
| 19. Billing | 9 | 9 (100%) | 8 | 9 | 0 | 5 | 0 | 0 | 9 | 2 | 0 | P1 |
| 20. User Management | 12 | 11 (92%) | 11 | 12 | 1 | 8 | 1 | 0 | 12 | 1 | 0 | P1 |
| 21. Factory Management | 6 | 5 (83%) | 6 | 6 | 0 | 4 | 0 | 0 | 6 | 0 | 0 | P2 |
| 22. Organization Mgmt | 5 | 3 (60%) | 5 | 5 | 0 | 3 | 0 | 0 | 5 | 0 | 0 | P2 |
| 23. Background Jobs | 4 | 0 (0%) | 4 | 4 | 0 | 0 | 0 | 0 | 4 | 0 | 0 | P2 |
| 24. Emails | 3 | 3 (100%) | 3 | 3 | 0 | 1 | 0 | 0 | 3 | 0 | 0 | P2 |
| 25. Feedback | 6 | 3 (50%) | 6 | 6 | 0 | 4 | 0 | 2 | 6 | 0 | 0 | P2 |
| 26. Observability | 7 | 2 (29%) | 7 | 7 | 0 | 0 | 0 | 0 | 7 | 0 | 0 | P3 |
| 27. Admin Modules | 6 | 4 (67%) | 6 | 6 | 0 | 2 | 0 | 0 | 6 | 1 | 0 | P2 |
| 28. Premium Features | 3 | 3 (100%) | 3 | 3 | 0 | 0 | 0 | 0 | 3 | 0 | 0 | P2 |
| **TOTAL** | **~250** | **139 (56%)** | **169 (68%)** | **170 (68%)** | **27** | **97** | **20** | **23** | **212 (85%)** | **7** | **6** | — |

---

## 3. Per-Endpoint Migration Detail

### 3.1 Authentication (`backend/routers/auth.py`, `auth_secure.py`, `auth_google.py`)

| # | Endpoint | Method | Current Auth | Target Permission | Target Scope | Workflow State | Maker-Checker | SoD | Audit Events | Denial Audit | MFA | BG | Code Changes | DB Changes | Tests | Priority |
|---|----------|--------|--------------|------------------|--------------|----------------|---------------|-----|--------------|--------------|-----|-----|--------------|------------|-------|:--------:|
| A1 | `/auth/register` | POST | None | Public | SYSTEM | — | — | — | — | — | — | — | None | None | Auth e2e | — |
| A2 | `/auth/login` | POST | None | Public | SYSTEM | — | — | — | AUTH_LOGIN | AUTH_LOGIN_FAILED | — | — | Log denial on failure | None | Auth e2e | — |
| A3 | `/auth/logout` | POST | get_current_user | Self | SELF | — | — | — | AUTH_LOGOUT | — | — | — | None | None | Auth e2e | — |
| A4 | `/auth/logout-all` | POST | get_current_user | Self | SELF | — | — | — | AUTH_LOGOUT_ALL | — | — | — | Add audit event | None | Auth e2e | P2 |
| A5 | `/auth/refresh` | POST | None (public) | Public | SYSTEM | — | — | — | — | — | — | — | None | None | — | — |
| A6 | `/auth/verify-email/*` | All | None | Public | SYSTEM | — | — | — | — | — | — | — | None | None | — | — |
| A7 | `/auth/password/*` | All | None/token | Public/Self | SYSTEM/SELF | — | — | — | PASSWORD_* | — | — | — | None | None | — | — |
| A8 | `/auth/factories` | GET | get_current_user | `factory.context.switch` | FACTORY | — | — | — | — | — | — | — | Add permission check | None | Auth e2e | P2 |
| A9 | `/auth/select-factory` | POST | get_current_user | `factory.context.switch` | FACTORY | — | — | — | FACTORY_SWITCH | — | — | — | Add permission + audit | None | Auth e2e | P2 |
| A10 | `/auth/me` | GET | get_current_user | Self | SELF | — | — | — | — | — | — | — | None | None | — | — |
| A11 | `/auth/profile` | PUT | get_current_user | Self | SELF | — | — | — | PROFILE_UPDATE | — | — | — | None | None | Profile update | — |
| A12 | `/auth/change-password` | POST | get_current_user | Self | SELF | — | — | — | PASSWORD_CHANGED | — | MFA req'd | — | Add MFA enforcement | None | Password change | P3 |
| A13 | `/auth_secure/register` | POST | None | Public | SYSTEM | — | — | — | — | — | — | — | None | None | — | — |
| A14 | `/auth_secure/login` | POST | None | Public | SYSTEM | — | — | — | AUTH_LOGIN | AUTH_LOGIN_FAILED | — | — | Log denial | None | Auth e2e | — |
| A15 | `/auth_secure/logout` | POST | get_current_user | Self | SELF | — | — | — | AUTH_LOGOUT | — | — | — | None | None | — | — |
| A16 | `/auth_secure/me` | GET | get_current_user | Self | SELF | — | — | — | — | — | — | — | None | None | — | — |
| A17 | `/auth_secure/mfa/setup` | POST | get_current_user | Self | SELF | — | — | — | MFA_SETUP | — | — | — | Add audit event | None | MFA flow | P3 |
| A18 | `/auth_secure/mfa/verify` | POST | get_current_user | Self | SELF | — | — | — | — | — | — | — | None | None | — | — |
| A19 | `/auth_secure/mfa/disable` | POST | get_current_user | Self | SELF | — | — | — | MFA_DISABLE | — | — | — | Add audit event | None | MFA flow | P3 |
| A20 | `/auth/google/login` | GET | None | Public | SYSTEM | — | — | — | — | — | — | — | None | None | — | — |
| A21 | `/auth/google/callback` | GET | None | Public | SYSTEM | — | — | — | — | — | — | — | None | None | — | — |

### 3.2 Attendance (`backend/routers/attendance.py`)

| # | Endpoint | Method | Current Auth | Target Permission | Target Scope | Workflow State | Maker-Checker | SoD | Audit Events | Denial Audit | MFA | BG | Code Changes | DB Changes | Tests | Priority |
|---|----------|--------|--------------|------------------|--------------|----------------|---------------|-----|--------------|--------------|-----|-----|--------------|------------|-------|:--------:|
| AT1 | `/me/today` | GET | None | `attendance.self.view` | SELF | — | — | — | — | ✅ Add | — | — | Replace with `require_permission` | None | `test_attendance_authz` | P2 |
| AT2 | `/punch` | POST | None | `attendance.self.punch` | SELF | Review `review_status` | — | — | ATTENDANCE_PUNCHED_* | ✅ Add | — | — | Add `require_permission` + rate limit | None | `test_attendance_punch` | P1 |
| AT3 | `/live` | GET | `require_role(SUPERVISOR)` | `attendance.team.view` | FACTORY | — | — | — | — | ✅ Add | — | — | Replace with PDP check | None | `test_attendance_live` | P1 |
| AT4 | `/settings/employees` | GET | `require_role(MANAGER)` | `attendance.profile.manage` | FACTORY | — | — | — | — | ✅ Add | — | — | Replace with PDP | None | `test_attendance_settings` | P1 |
| AT5 | `/settings/employees` | POST | `require_role(MANAGER)` | `attendance.profile.manage` | FACTORY | — | — | — | ATTENDANCE_PROFILE_UPSERTED | ✅ Add | — | — | Replace with PDP | None | `test_attendance_settings` | P1 |
| AT6 | `/settings/shifts` | GET | `require_role(MANAGER)` | `attendance.shift_template.manage` | FACTORY | — | — | — | — | ✅ Add | — | — | Replace with PDP | None | `test_attendance_shifts` | P2 |
| AT7 | `/settings/shifts` | POST | `require_role(MANAGER)` | `attendance.shift_template.manage` | FACTORY | — | — | — | ATTENDANCE_SHIFT_TEMPLATE_* | ✅ Add | — | — | Replace with PDP | None | `test_attendance_shifts` | P1 |
| AT8 | `/me/regularizations` | POST | None | `attendance.self.regularization.request` | SELF | Record status | Self-only | — | ATTENDANCE_REGULARIZATION_* | ✅ Add | — | — | Add `require_permission` + state check | None | `test_attendance_regularization` | P1 |
| AT9 | `/review` | GET | `require_any_role(SUP, MGR, ADMIN, OWNER)` | `attendance.review.queue.view` | FACTORY | — | — | — | — | ✅ Add | — | — | Replace with PDP | None | `test_attendance_review` | P1 |
| AT10 | `/review/{id}/approve` | POST | `require_any_role(...)` + `assert_not_self_approval` | `attendance.review.approve` | DEPT/FACTORY | pending_review | ✅ Existing | ✅ Existing | ATTENDANCE_REVIEW_APPROVED | ✅ Add | — | BG | Replace role set with PDP; validate scope | None | `test_attendance_approve` | P1 |
| AT11 | `/review/{id}/reject` | POST | `require_any_role(...)` + `assert_not_self_approval` | `attendance.review.reject` | DEPT/FACTORY | pending_review | ✅ Existing | ✅ Existing | ATTENDANCE_REVIEW_REJECTED | ✅ Add | — | BG | Same as AT10 | None | `test_attendance_reject` | P1 |
| AT12 | `/reports/summary` | GET | `require_any_role(...)` incl ACC | `attendance.report.view` | FACTORY/ORG | — | — | — | — | ✅ Add | — | — | Remove ACC, replace with PDP | None | `test_attendance_report` | P2 |

### 3.3 Production Entries (`backend/routers/entries.py`)

| # | Endpoint | Method | Current Auth | Target Permission | Target Scope | Workflow State | Maker-Checker | SoD | Audit Events | Denial Audit | MFA | BG | Code Changes | DB Changes | Tests | Priority |
|---|----------|--------|--------------|------------------|--------------|----------------|---------------|-----|--------------|--------------|-----|-----|--------------|------------|-------|:--------:|
| E1 | `/smart` | POST | Role block (ACC, ATT) | `production.entry.create` | FACTORY | — | — | — | SMART_INPUT_USED | ✅ Add | — | — | Replace role block with `require_permission` | None | `test_smart_input_authz` | P1 |
| E2 | `/` | POST | Role block (ACC, ATT) | `production.entry.create` | SELF/FACTORY | — | — | — | ENTRY_CREATED | ✅ Add | — | — | Replace with PDP | None | `test_entry_create_authz` | P1 |
| E3 | `/` | GET | Implicit `_apply_role_filter` | `production.entry.view_team` / `view_factory` | DEPT/FACTORY | — | — | — | — | ✅ Add | — | — | Add explicit permission check | None | `test_entry_list_authz` | P2 |
| E4 | `/today` | GET | Implicit `_apply_role_filter` | `production.entry.view_team` | DEPT/FACTORY | — | — | — | — | ✅ Add | — | — | Same as E3 | None | `test_entry_today_authz` | P2 |
| E5 | `/{id}` | GET | `_can_view_entry` helper | `production.entry.view_team` | DEPT | — | — | — | — | ✅ Add | — | — | Explicit permission check | None | `test_entry_detail_authz` | P2 |
| E6 | `/{id}` | PUT | Ad-hoc logic | `production.entry.edit_own_draft` | SELF | Entry date, review status | — | — | ENTRY_UPDATED | ✅ Add | — | — | Replace with `require_permission` + state validation | None | `test_entry_update_authz` | P1 |
| E7 | `/{id}/approve` | POST | `require_role(SUPERVISOR)` + `assert_not_self_approval` | `production.entry.approve` | DEPT/FACTORY | submitted | ✅ Existing | ✅ Existing | ENTRY_APPROVED | ✅ Add | — | BG | Replace rank with PDP | None | `test_entry_approve` | P1 |
| E8 | `/{id}/reject` | POST | `require_role(SUPERVISOR)` + `assert_not_self_approval` | `production.entry.reject` | DEPT/FACTORY | submitted | ✅ Existing | ✅ Existing | ENTRY_REJECTED | ✅ Add | — | BG | Same as E7 | None | `test_entry_reject` | P1 |
| E9 | `/{id}` | DELETE | `require_role(MANAGER)` | `production.override` | FACTORY | — | — | — | ENTRY_DELETED (soft) | ✅ Add | — | BG | Replace with `require_permission("production.override")` | None | `test_entry_delete_authz` | P1 |
| E10 | `/{id}/summary*` | Various | `_can_view_entry` helper | `production.summary.request` | FACTORY | — | — | — | ENTRY_SUMMARY_* | ✅ Add | — | — | Add explicit permission | None | `test_entry_summary_authz` | P2 |

### 3.4 OCR (`backend/routers/ocr.py`)

| # | Endpoint | Method | Current Auth | Target Permission | Target Scope | Workflow State | Maker-Checker | SoD | Audit Events | Denial Audit | MFA | BG | Code Changes | DB Changes | Tests | Priority |
|---|----------|--------|--------------|------------------|--------------|----------------|---------------|-----|--------------|--------------|-----|-----|--------------|------------|-------|:--------:|
| O1 | `/status` | GET | None | Public | SYSTEM | — | — | — | — | — | — | — | None | None | — | — |
| O2 | `/templates` | GET | `_require_ocr_access` (OPR+) | `ocr.template.view` | FACTORY/ORG | — | — | — | — | ✅ Add | — | — | Replace with PDP | None | `test_ocr_template_view` | P2 |
| O3 | `/templates` | POST | `_require_ocr_access` + templates check | `ocr.template.manage` | FACTORY/ORG | — | — | — | OCR_TEMPLATE_CREATED | ✅ Add | — | — | Replace with PDP + plan check | None | `test_ocr_template_create` | P1 |
| O4 | `/templates/{id}` | DELETE | `_require_templates_access` | `ocr.template.manage` | FACTORY/ORG | — | — | — | OCR_TEMPLATE_DEACTIVATED | ✅ Add | — | — | Replace with PDP | None | `test_ocr_template_delete` | P1 |
| O5 | `/verifications` | GET | Implicit `_verification_query` | `ocr.job.view` | FACTORY/ORG | — | — | — | — | ✅ Add | — | — | Add PDP check | None | `test_ocr_verification_list` | P2 |
| O6 | `/verifications` | POST | `_require_ocr_access` | `ocr.document.upload` | DEPT/FACTORY | — | — | — | OCR_VERIFICATION_CREATED | ✅ Add | — | — | Replace with PDP | None | `test_ocr_verification_create` | P1 |
| O7 | `/verifications/{id}` | GET | `_get_verification_or_404` | `ocr.job.view` | FACTORY/ORG | — | — | — | — | ✅ Add | — | — | Add PDP + factory scope validation | None | `test_ocr_verification_detail` | P2 |
| O8 | `/verifications/{id}` | PUT | Implicit | `ocr.verification.edit` | DEPT/FACTORY | Not approved/rejected | — | — | OCR_VERIFICATION_UPDATED | ✅ Add | — | — | Add state check + PDP | None | `test_ocr_verification_update` | P1 |
| O9 | `/verifications/{id}/submit` | POST | Implicit | `ocr.verification.submit` | DEPT/FACTORY | draft | ✅ Required | — | OCR_VERIFICATION_SUBMITTED | ✅ Add | — | — | Add maker-checker + PDP | None | `test_ocr_verification_submit` | P1 |
| O10 | `/verifications/{id}/approve` | POST | `is_manager_or_admin` | `ocr.verification.approve_ops` / `approve_finance` | DEPT/FACTORY | pending | ✅ Required | Domain split | OCR_VERIFICATION_APPROVED | ✅ Add | — | — | Domain-split approval; separate ops vs finance | None | `test_ocr_approve_ops` / `test_ocr_approve_finance` | P1 |
| O11 | `/verifications/{id}/reject` | POST | `is_manager_or_admin` | Same as approve | DEPT/FACTORY | pending | ✅ Required | Domain split | OCR_VERIFICATION_REJECTED | ✅ Add | — | — | Same as O10 | None | `test_ocr_reject` | P1 |
| O12 | `/verifications/{id}/source-image` | GET | Implicit | `ocr.job.view` | FACTORY/ORG | — | — | — | — | ✅ Add | — | — | Add PDP check | None | `test_ocr_source_image` | P2 |
| O13 | `/verifications/{id}/share-link` | POST | Implicit | `ocr.job.view` | FACTORY/ORG | — | — | — | OCR_SHARE_LINK_CREATED | ✅ Add | — | — | Add PDP + audit | None | `test_ocr_share_link` | P2 |
| O14 | `/verifications/{id}/export` | GET | Implicit | `reporting.finance.export` | FACTORY/ORG | approved/draft/rejected | — | — | OCR_EXPORT_* | ✅ Add | — | — | Add PDP + status check | None | `test_ocr_export` | P2 |
| O15 | `/logbook` | POST | `_require_ocr_access` | `ocr.document.upload` | DEPT/FACTORY | — | — | — | OCR_LOGBOOK_SCANNED | ✅ Add | — | — | Replace with PDP | None | `test_ocr_logbook` | P1 |
| O16 | `/table-excel` | POST | `_require_ocr_access` | `ocr.document.upload` | DEPT/FACTORY | — | — | — | OCR_TABLE_EXCEL | ✅ Add | — | — | Replace with PDP | None | `test_ocr_table_excel` | P1 |

### 3.5 Analytics (`backend/routers/analytics.py`)

| # | Endpoint | Method | Current Auth | Target Permission | Target Scope | MC | SoD | Audit | Denial | Code Changes | Priority |
|---|----------|--------|--------------|------------------|--------------|----|-----|-------|--------|--------------|:--------:|
| AN1 | `/weekly` | GET | `require_any_role(SUP, MGR, ADMIN, OWNER)` | `analytics.operations.view` | DEPT/FACTORY/ORG | — | — | — | ✅ Add | Replace with PDP | P2 |
| AN2 | `/monthly` | GET | Same | `analytics.operations.view` | DEPT/FACTORY/ORG | — | — | — | ✅ Add | Same | P2 |
| AN3 | `/trends` | GET | Same | `analytics.operations.view` | DEPT/FACTORY/ORG | — | — | — | ✅ Add | Same | P2 |
| AN4 | `/manager` | GET | `require_role(MANAGER)` | `analytics.operations.view` + manager filter | FACTORY | — | — | — | ✅ Add | Replace rank with PDP | P1 |

### 3.6 AI Insights (`backend/routers/ai.py`) — **P0 Critical**

| # | Endpoint | Method | Current Auth | Target Permission | Target Scope | MC | SoD | Audit | Denial | Code Changes | Priority |
|---|----------|--------|--------------|------------------|--------------|----|-----|-------|--------|--------------|:--------:|
| AI1 | `/usage` | GET | `_ensure_ai_access` (blocks ATT only) | `analytics.ai.query` | FACTORY/ORG | — | — | AI_USAGE_VIEW | ✅ Add | Restore permission check (was REMOVED in git diff) | **P0** |
| AI2 | `/suggestions` | GET | `_ensure_ai_access` + blocks ACC | `analytics.ai.query` | FACTORY/ORG | — | — | AI_DPR_SUGGESTION | ✅ Add | Add explicit `require_permission` | **P0** |
| AI3 | `/anomalies` | GET | `_ensure_ai_access` | `analytics.anomaly.view` | FACTORY/ORG | — | — | AI_ANOMALY_SCAN | ✅ Add | Add `require_permission` (was REMOVED) | **P0** |
| AI4 | `/anomalies/preview` | GET | `_ensure_ai_access` | `analytics.anomaly.view` | FACTORY/ORG | — | — | — | ✅ Add | Add `require_permission` | **P0** |
| AI5 | `/query` | POST | `_ensure_ai_access` | `analytics.ai.query` | FACTORY/ORG | — | — | AI_NLQ_QUERY | ✅ Add | Add `require_permission` | **P0** |
| AI6 | `/executive-summary` | GET | `_ensure_ai_access` | `analytics.executive.view` | ORG | — | — | AI_EXECUTIVE_SUMMARY | ✅ Add | Add `require_permission` (was REMOVED) | **P0** |
| AI7 | `/executive-summary/jobs` | POST | `_ensure_ai_access` | `analytics.executive.view` | ORG | — | — | — | ✅ Add | Add `require_permission` | **P0** |
| AI8 | `/jobs/{job_id}` | GET | `_ensure_ai_access` | `analytics.ai.query` | ORG | — | — | — | ✅ Add | Add `require_permission` | **P0** |

### 3.7 Intelligence (`backend/routers/intelligence.py`) — **P0 Critical**

| # | Endpoint | Method | Current Auth | Target Permission | Target Scope | MC | SoD | Audit | Denial | Code Changes | Priority |
|---|----------|--------|--------------|------------------|--------------|----|-----|-------|--------|--------------|:--------:|
| IN1 | `/intelligence/requests` | POST | `require_any_role` REMOVED | `analytics.ai.query` | FACTORY/ORG | — | — | INTELLIGENCE_REQUEST_CREATED | ✅ Add | Restore permission check | **P0** |
| IN2 | `/intelligence/requests` | GET | REMOVED | `analytics.ai.query` | FACTORY/ORG | — | — | — | ✅ Add | Add `require_permission` | **P0** |
| IN3 | `/intelligence/requests/{id}` | GET | REMOVED | `analytics.ai.query` | FACTORY/ORG | — | — | — | ✅ Add | Add `require_permission` | **P0** |
| IN4 | `/intelligence/usage` | GET | REMOVED | `analytics.ai.query` | FACTORY/ORG | — | — | — | ✅ Add | Add `require_permission` | **P0** |

### 3.8 Reports (`backend/routers/reports.py`)

| # | Endpoint | Method | Current Auth | Target Permission | Target Scope | MC | SoD | Audit | Denial | Code Changes | Priority |
|---|----------|--------|--------------|------------------|--------------|----|-----|-------|--------|--------------|:--------:|
| R1 | `/insights` | GET | `require_any_role(SUP, MGR, ADMIN, OWNER)` | `analytics.operations.view` | FACTORY/ORG | — | — | — | ✅ Add | Replace with PDP | P2 |
| R2 | `/pdf/{entry_id}` | GET | `require_any_role(OPR, SUP, MGR, ACC, ADMIN, OWNER)` | `reporting.finance.export` | FACTORY/ORG | — | — | — | ✅ Add | Replace with PDP; validate ACC access | P1 |
| R3 | `/pdf/{entry_id}/jobs` | POST | Same as R2 | `reporting.finance.export` | FACTORY/ORG | — | — | REPORT_PDF_JOB | ✅ Add | Same as R2 | P1 |
| R4 | `/excel/{entry_id}` | GET | Same as R2 | `reporting.finance.export` | FACTORY/ORG | — | — | — | ✅ Add | Same as R2 | P1 |
| R5 | `/weekly` | GET | Same as R1 | `analytics.operations.view` | FACTORY/ORG | — | — | — | ✅ Add | Replace with PDP | P2 |
| R6 | `/monthly` | GET | Same as R1 | `analytics.operations.view` | FACTORY/ORG | — | — | — | ✅ Add | Replace with PDP | P2 |
| R7 | `/excel-range` | GET | Same as R2 | `reporting.finance.export` | FACTORY/ORG | — | — | — | ✅ Add | Replace with PDP + plan check | P2 |
| R8 | `/excel-range/jobs` | POST | Same as R2 | `reporting.finance.export` | FACTORY/ORG | — | — | REPORT_EXCEL_JOB | ✅ Add | Same as R7 | P2 |
| R9 | `/sample-pdf` | GET | None | Public | SYSTEM | — | — | — | — | None | — |
| R10 | `/export-jobs/{job_id}` | GET | Owner-id check | `reporting.finance.export` | FACTORY/ORG | — | — | — | ✅ Add | Add PDP check | P2 |
| R11 | `/export-jobs/{job_id}/download` | GET | Owner-id check | `reporting.finance.export` | FACTORY/ORG | — | — | — | ✅ Add | Add PDP check | P2 |

### 3.9 Alerts (`backend/routers/alerts.py`)

| # | Endpoint | Method | Current Auth | Target Permission | Target Scope | MC | SoD | Audit | Denial | Code Changes | Priority |
|---|----------|--------|--------------|------------------|--------------|----|-----|-------|--------|--------------|:--------:|
| AL1 | `/alerts` | GET | `require_any_role(OPR, SUP, MGR, ADMIN, OWNER)` | `ops_alerts.view` | FACTORY | — | — | — | ✅ Add | Replace with PDP + new permission | P2 |
| AL2 | `/alerts/{id}/read` | PUT | Same | `ops_alerts.view` | FACTORY | — | — | ALERT_READ | ✅ Add | Replace with PDP | P2 |

**Missing Permission:** `ops_alerts.view` — Low risk, FACTORY scope, SUP/FM/OA roles — needs to be added to catalog.

### 3.10 Alert Recipients (`backend/routers/alert_recipients.py`)

| # | Endpoint | Method | Current Auth | Target Permission | Target Scope | MC | SoD | Audit | Denial | Code Changes | Priority |
|---|----------|--------|--------------|------------------|--------------|----|-----|-------|--------|--------------|:--------:|
| AR1 | `/alert-recipients` | GET | `require_any_role(ADMIN, OWNER)` | `ops_alerts.configure` | ORG | — | — | — | ✅ Add | Replace with PDP | P2 |
| AR2 | `/alert-recipients` | POST | Same | `ops_alerts.configure` | ORG | — | — | ALERT_RECIPIENT_CREATED | ✅ Add | Replace with PDP | P2 |
| AR3 | `/alert-recipients/{id}` | PATCH | Same | `ops_alerts.configure` | ORG | — | — | ALERT_RECIPIENT_UPDATED | ✅ Add | Replace with PDP | P2 |
| AR4 | `/alert-recipients/{id}/start-verification` | POST | Same | `ops_alerts.configure` | ORG | — | — | — | ✅ Add | Replace with PDP | P2 |
| AR5 | `/alert-recipients/{id}/confirm-verification` | POST | Same | `ops_alerts.configure` | ORG | — | — | — | ✅ Add | Replace with PDP | P2 |
| AR6 | `/alert-recipients/{id}` | DELETE | Same | `ops_alerts.configure` | ORG | — | — | ALERT_RECIPIENT_DELETED | ✅ Add | Replace with PDP | P2 |

**Missing Permission:** `ops_alerts.configure` — High risk, ORG scope, ADMIN/OWNER roles — needs to be added to catalog.

### 3.11 Steel Inventory (`backend/routers/steel.py` — inventory)

| # | Endpoint | Method | Current Auth | Target Permission | Target Scope | Workflow State | MC | SoD | Audit | Denial | MFA | BG | Code Changes | Priority |
|---|----------|--------|--------------|------------------|--------------|----------------|----|-----|-------|--------|-----|-----|--------------|:--------:|
| SI1 | `/inventory/items` | GET | `require_any_role(SUP, MGR, ADMIN, OWNER, ACC)` | `inventory.item.view` | FACTORY | — | — | — | — | ✅ Add | — | — | Replace with PDP | P2 |
| SI2 | `/inventory/stock` | GET | Same as SI1 | `inventory.ledger.view` | FACTORY | — | — | — | — | ✅ Add | — | — | Replace with PDP | P2 |
| SI3 | `/inventory/transactions` | GET | Same as SI1 | `inventory.ledger.view` | FACTORY | — | — | — | — | ✅ Add | — | — | Replace with PDP | P2 |
| SI4 | `/inventory/items` | POST | `require_role(MANAGER)` | `inventory.item.manage` | FACTORY | — | — | — | STEEL_INVENTORY_ITEM_CREATED | ✅ Add | — | — | Replace rank with PDP | P1 |
| SI5 | `/inventory/transactions` | POST | `require_role(MANAGER)` | `inventory.transaction.create` | FACTORY | — | ✅ Required | ✅ (cannot approve own reconciliation) | STEEL_LEDGER_TRANSACTION_CREATED | ✅ Add | — | BG | Replace rank + add MC | **P1** |
| SI6 | `/inventory/reconciliations` | POST | `require_role(MANAGER)` + auto-approve for Admin | `inventory.reconciliation.submit` | FACTORY | pending → approved | ✅ Required | ✅ (cannot create + approve) | STEEL_STOCK_RECONCILIATION_* | ✅ Add | — | BG | Remove auto-approve for Admin | **P0** |
| SI7 | `/inventory/reconciliations/summary` | GET | `require_any_role(SUP, MGR, ADMIN, OWNER)` | `inventory.report.view` | FACTORY/ORG | — | — | — | — | ✅ Add | — | — | Replace with PDP | P2 |
| SI8 | `/inventory/reconciliations` | GET | Same as SI7 | `inventory.report.view` | FACTORY/ORG | — | — | — | — | ✅ Add | — | — | Replace with PDP | P2 |
| SI9 | `/inventory/reconciliations/{id}/approve` | POST | `require_any_role(ADMIN, OWNER)` | `inventory.reconciliation.approve` | FACTORY | pending | ✅ Required | ✅ (not self-submitted) | STEEL_STOCK_RECONCILIATION_APPROVED | ✅ Add | — | BG | Change to FM/OO per target | **P1** |
| SI10 | `/inventory/reconciliations/{id}/reject` | POST | Same as SI9 | `inventory.reconciliation.reject` | FACTORY | pending | ✅ Required | ✅ | STEEL_STOCK_RECONCILIATION_REJECTED | ✅ Add | — | — | Change to FM/OO | P1 |
| SI11 | `/overview` | GET | None | `inventory.ledger.view` / `analytics.operations.view` | FACTORY | — | — | — | — | ✅ Add | — | — | Add permission check | **P0** |

### 3.12 Production Batches (`backend/routers/steel.py` — batches)

| # | Endpoint | Method | Current Auth | Target Permission | Target Scope | Workflow State | MC | SoD | Audit | Denial | BG | Code Changes | Priority |
|---|----------|--------|--------------|------------------|--------------|----------------|----|-----|-------|--------|-----|--------------|:--------:|
| PB1 | `/batches` | GET | None (implicit factory from `require_active_steel_factory`) | `inventory.item.view` | FACTORY | — | — | — | — | ✅ Add | — | Add `require_permission` | P1 |
| PB2 | `/batches/{id}` | GET | None | `inventory.item.view` | FACTORY | — | — | — | — | ✅ Add | — | Add `require_permission` | P1 |
| PB3 | `/batches` | POST | Implicit | `inventory.item.manage` | FACTORY | — | ✅ Required (variance approval) | ✅ (not self-approve) | STEEL_BATCH_CREATED | ✅ Add | BG | Add create endpoint (hidden behind create function) | P1 |

### 3.13 Customers (`backend/routers/steel.py` — customers)

| # | Endpoint | Method | Current Auth | Target Permission | Target Scope | MC | SoD | Audit | Denial | Code Changes | Priority |
|---|----------|--------|--------------|------------------|--------------|----|-----|-------|--------|--------------|:--------:|
| C1 | `/customers` | GET | `require_any_role(MGR, ADMIN, OWNER, ACC)` | `customer.record.view` | FACTORY/ORG | — | — | — | ✅ Add | Replace with PDP | P2 |
| C2 | `/customers` | POST | Implicit | `customer.record.manage` | FACTORY | — | — | STEEL_CUSTOMER_CREATED | ✅ Add | Add `require_permission` | P1 |
| C3 | `/customers/{id}` | GET | Implicit | `customer.record.view` | FACTORY/ORG | — | — | — | ✅ Add | Add `require_permission` | P2 |
| C4 | `/customers/{id}` | PATCH | Implicit | `customer.record.manage` | FACTORY | — | — | STEEL_CUSTOMER_UPDATED | ✅ Add | Add `require_permission` | P1 |
| C5 | `/customers/{id}/ledger` | GET | `require_any_role(ACC, MGR, ADMIN, OWNER)` | `customer.record.view` | FACTORY/ORG | — | — | — | ✅ Add | Replace with PDP | P2 |

### 3.14 Customer Verification (`backend/routers/steel.py` — verification)

| # | Endpoint | Method | Current Auth | Target Permission | Target Scope | Workflow State | MC | SoD | Audit | Denial | Code Changes | Priority |
|---|----------|--------|--------------|------------------|--------------|----------------|----|-----|-------|--------|--------------|:--------:|
| CV1 | `/customers/{id}/verification` | POST | Implicit | `customer.verification.request` | FACTORY | — | — | — | STEEL_VERIFICATION_SUBMITTED | ✅ Add | Add `require_permission("customer.verification.request")` | P1 |
| CV2 | `/customers/{id}/verification` | GET | Implicit | `customer.record.view` | FACTORY/ORG | — | — | — | — | ✅ Add | Add `require_permission` | P2 |
| CV3 | `/customers/{id}/verification/review` | POST | Implicit | `customer.verification.review` | FACTORY | format_valid/pending_review | ✅ Required | ✅ (not self-request) | STEEL_VERIFICATION_REVIEWED | ✅ Add | Add MC + PDP + state validation | **P1** |
| CV4 | `/customers/{id}/verification-documents/*` | Upload | Implicit | `customer.verification.request` | FACTORY | — | — | — | STEEL_VERIFICATION_DOC_UPLOADED | ✅ Add | Add `require_permission` | P1 |

### 3.15 Customer Followups (`backend/routers/steel.py` — followups)

| # | Endpoint | Method | Current Auth | Target Permission | Target Scope | Workflow State | MC | SoD | Audit | Denial | Code Changes | Priority |
|---|----------|--------|--------------|------------------|--------------|----------------|----|-----|-------|--------|--------------|:--------:|
| CF1 | `/customers/{id}/follow-up-tasks` | GET | Implicit | `customer.followup.manage` | FACTORY | — | — | — | — | ✅ Add | Add `require_permission` | P2 |
| CF2 | `/customers/{id}/follow-up-tasks` | POST | Implicit | `customer.followup.manage` | FACTORY | — | — | — | STEEL_FOLLOW_UP_CREATED | ✅ Add | Add `require_permission` | P2 |
| CF3 | `/customers/{id}/follow-up-tasks/{task_id}/status` | PATCH | Implicit | `customer.followup.manage` | FACTORY | open/in_progress/done/cancelled | — | — | STEEL_FOLLOW_UP_UPDATED | ✅ Add | Add PDP + state validation | P2 |

### 3.16 Invoices (`backend/routers/steel.py` — invoices)

| # | Endpoint | Method | Current Auth | Target Permission | Target Scope | Workflow State | MC | SoD | Audit | Denial | MFA | BG | Code Changes | Priority |
|---|----------|--------|--------------|------------------|--------------|----------------|----|-----|-------|--------|-----|-----|--------------|:--------:|
| I1 | `/invoices` | GET | `require_any_role(ACC, MGR, ADMIN, OWNER)` | `invoice.record.view` | FACTORY/ORG | — | — | — | — | ✅ Add | — | — | Replace with PDP | P2 |
| I2 | `/invoices` | POST | `require_role(MANAGER)` | `invoice.record.create` | FACTORY | — | — | — | STEEL_INVOICE_CREATED | ✅ Add | — | — | Change to ACC per target | **P1** |
| I3 | `/invoices/{id}` | GET | Implicit | `invoice.record.view` | FACTORY/ORG | — | — | — | — | ✅ Add | — | — | Add PDP check | P2 |
| I4 | `/invoices/{id}` | PATCH | Implicit | `invoice.record.edit_pre_dispatch` | FACTORY | pre/post dispatch | ✅ Required | ✅ (not creator) | STEEL_INVOICE_UPDATED | ✅ Add | — | BG | Add dispatch state check + MC | **P1** |
| I5 | `/invoices/{id}/void` | POST | Implicit | `invoice.record.void` | FACTORY/ORG | — | ✅ Required | ✅ (not creator) | STEEL_INVOICE_VOIDED | ✅ Add | ✅ | BG | Add void endpoint (doesn't exist yet) | **P1** |
| I6 | `/invoices/{id}/payment-status` | GET | Implicit | `invoice.record.view` | FACTORY/ORG | — | — | — | — | ✅ Add | — | — | Add PDP check | P2 |

### 3.17 Dispatch (`backend/routers/steel.py` — dispatches)

| # | Endpoint | Method | Current Auth | Target Permission | Target Scope | Workflow State | MC | SoD | Audit | Denial | MFA | BG | Code Changes | Priority |
|---|----------|--------|--------------|------------------|--------------|----------------|----|-----|-------|--------|-----|-----|--------------|:--------:|
| D1 | `/dispatches` | GET | `require_any_role(OPR, SUP, MGR, ADMIN, OWNER, ACC)` | `dispatch.record.view` | FACTORY/ORG | — | — | — | — | ✅ Add | — | — | Restrict OPR/ACC to limited view | P2 |
| D2 | `/dispatches` | POST | `require_role(MANAGER)` | `dispatch.record.create` | FACTORY | — | — | — | STEEL_DISPATCH_CREATED | ✅ Add | — | — | Change to SUP/FM per target | **P1** |
| D3 | `/dispatches/{id}` | GET | Implicit | `dispatch.record.view` | FACTORY/ORG | — | — | — | — | ✅ Add | — | — | Add PDP check + scope filtering | P2 |
| D4 | `/dispatches/{id}` | PATCH | Implicit | `dispatch.status.update` | FACTORY | Pending→Loaded→Exited→Dispatched→Delivered | ✅ Required | ✅ (not creator) | STEEL_DISPATCH_STATUS_UPDATED | ✅ Add | — | — | Add state machine validation + MC | **P1** |
| D5 | `/dispatches/{id}/cancel` | POST | Implicit | `dispatch.record.cancel` | FACTORY/ORG | Not delivered | ✅ Required | ✅ (not creator) | STEEL_DISPATCH_CANCELLED | ✅ Add | ✅ | BG | Add cancel endpoint (may not exist separately) | P1 |
| D6 | `/dispatches/{id}/override-quantity` | POST | Implicit | `dispatch.quantity.override` | FACTORY/ORG | Pending/Dispatched | ✅ Required | ✅ (not creator) | STEEL_DISPATCH_QTY_OVERRIDE | ✅ Add | ✅ | BG | Add override endpoint | **P1** |
| D7 | `/overview` | GET | None | `dispatch.record.view` | FACTORY | — | — | — | — | ✅ Add | — | — | Add PDP check | **P0** |

### 3.18 Payments (`backend/routers/steel.py` — payments)

| # | Endpoint | Method | Current Auth | Target Permission | Target Scope | Workflow State | MC | SoD | Audit | Denial | MFA | BG | Code Changes | Priority |
|---|----------|--------|--------------|------------------|--------------|----------------|----|-----|-------|--------|-----|-----|--------------|:--------:|
| P1 | `/customers/{id}/payments` | POST | Implicit | `payment.record.create` | FACTORY | — | — | — | STEEL_PAYMENT_CREATED | ✅ Add | — | — | Add `require_permission("payment.record.create")` | **P1** |
| P2 | `/customers/{id}/payments/{id}` | GET | Implicit | `payment.record.view` | FACTORY/ORG | — | — | — | — | ✅ Add | — | — | Add PDP check | P2 |
| P3 | `/payments/{id}/reverse` | POST | Implicit | `payment.record.reverse` | FACTORY/ORG | Payment exists | ✅ Required | ✅ (not creator) | STEEL_PAYMENT_REVERSED | ✅ Add | ✅ | BG | Add MC + SoD + MFA | **P1** |
| P4 | `/customers/{id}/payments/{id}/reallocate` | POST | Implicit | `payment.allocation.reallocate` | FACTORY/ORG | Payment exists | ✅ Required | ✅ (not allocator) | STEEL_PAYMENT_REALLOCATED | ✅ Add | ✅ | BG | Add MC + SoD + MFA | **P1** |

### 3.19 Billing (`backend/routers/billing.py`)

| # | Endpoint | Method | Current Auth | Target Permission | Target Scope | MC | SoD | Audit | Denial | MFA | Code Changes | Priority |
|---|----------|--------|--------------|------------------|--------------|----|-----|-------|--------|-----|--------------|:--------:|
| B1 | `/config` | GET | `require_role(ADMIN)` | `billing.status.view` | ORG | — | — | — | ✅ Add | — | Replace with PDP | P2 |
| B2 | `/status` | GET | `require_role(ADMIN)` | `billing.status.view` | ORG | — | — | — | ✅ Add | — | Replace with PDP | P2 |
| B3 | `/invoices` | GET | `require_role(ADMIN)` | `billing.status.view` | ORG | — | — | — | ✅ Add | — | Replace with PDP | P2 |
| B4 | `/downgrade` | POST | `require_role(OWNER)` | `billing.plan.change` | ORG | — | — | — | BILLING_DOWNGRADE_SCHEDULED | ✅ Add | ✅ | Replace rank with PDP + MFA | **P1** |
| B5 | `/downgrade` | DELETE | `require_role(OWNER)` | `billing.plan.change` | ORG | — | — | — | BILLING_DOWNGRADE_CANCELLED | ✅ Add | ✅ | Replace rank with PDP + MFA | P1 |
| B6 | `/orders` | POST | `require_role(OWNER)` | `billing.order.create` | ORG | — | — | — | BILLING_ORDER_CREATED | ✅ Add | ✅ | Replace rank with PDP + MFA | P1 |
| B7 | `/orders/{id}/sync` | POST | `require_role(OWNER)` | `billing.order.create` | ORG | — | — | — | BILLING_ORDER_SYNCED | ✅ Add | ✅ | Replace rank with PDP | P1 |
| B8 | `/webhook/razorpay` | POST | Webhook signature | System (external) | SYSTEM | — | — | — | BILLING_WEBHOOK_RECEIVED | — | — | ✅ OK as is | — |
| B9 | `/admin-override` | POST | `require_role(OWNER)` + manual override flag | `billing.plan.change` | ORG | — | — | — | BILLING_ADMIN_OVERRIDE | ✅ Add | ✅ | Add audit + MFA | P2 |

### 3.20 User Management (`backend/routers/settings.py` — users)

| # | Endpoint | Method | Current Auth | Target Permission | Target Scope | MC | SoD | Audit | Denial | MFA | Code Changes | Priority |
|---|----------|--------|--------------|------------------|--------------|----|-----|-------|--------|-----|--------------|:--------:|
| U1 | `/users` | GET | `require_role(MANAGER)` | `user.directory.view` | FACTORY/ORG | — | — | — | ✅ Add | — | Replace with PDP | P1 |
| U2 | `/users/invite` | POST | `require_role(MANAGER)` + role assignment check | `user.invite` | FACTORY/ORG | — | ✅ Required | ✅ (OA/OO only) | USER_INVITED | ✅ Add | ✅ | Replace rank with PDP + MC + SoD | **P1** |
| U3 | `/users/{id}/factory-access` | GET | `require_role(ADMIN)` | `user.membership.assign` | ORG | — | — | — | — | ✅ Add | — | Replace with PDP | P1 |
| U4 | `/users/{id}/factory-access` | PUT | `require_role(ADMIN)` | `user.membership.assign` | ORG | — | ✅ Required | ✅ (not self-manage) | FACTORY_ACCESS_UPDATED | ✅ Add | ✅ | Add MC + SoD + MFA | **P1** |
| U5 | `/users/{id}/role` | PUT | `require_role(MANAGER)` + rank comparison | `user.role.assign` | ORG | — | ✅ Required | ✅ (target says OA/OO) | ROLE_UPDATED | ✅ Add | ✅ | **Remove rank comparison** + add MC + SoD | **P1** |
| U6 | `/users/{id}/plan` | PUT | `require_role(MANAGER)` | `billing.plan.change` | ORG | — | — | ✅ (target says OO only) | PLAN_UPDATED | ✅ Add | ✅ | Change to OO per target | **P1** |
| U7 | `/org/plan` | PUT | `require_role(OWNER)` + manual override flag | `billing.plan.change` | ORG | — | — | — | ORG_PLAN_UPDATED | ✅ Add | ✅ | Replace with PDP | P1 |
| U8 | `/users/{id}` | DELETE | `require_role(MANAGER)` | `user.deactivate` | FACTORY/ORG | — | ✅ Required | ✅ (OA/OO only) | USER_DEACTIVATED | ✅ Add | ✅ | Change to OA/OO per target + MC | **P1** |
| U9 | `/users/lookup` | GET | `_scoped_users_query` | `user.directory.view` | FACTORY/ORG | — | — | — | ✅ Add | — | Add explicit PDP check | P2 |
| U10 | `/usage` | GET | None | `billing.status.view` | ORG | — | — | — | — | ✅ Add | — | Add PDP check | P2 |
| U11 | `/plan/last-upgrade` | GET | None | `billing.status.view` | ORG | — | — | — | — | ✅ Add | — | Add PDP check | P2 |
| U12 | `/usage/reconcile` | POST | `require_role(ADMIN)` | `billing.status.view` | ORG | — | — | — | USAGE_RECONCILED | ✅ Add | ✅ | Replace with PDP + MFA | P2 |

### 3.21 Factory Management (`backend/routers/settings.py` — factories)

| # | Endpoint | Method | Current Auth | Target Permission | Target Scope | MC | SoD | Audit | Denial | Code Changes | Priority |
|---|----------|--------|--------------|------------------|--------------|----|-----|-------|--------|--------------|:--------:|
| FM1 | `/factory-profiles` | GET | None | Public | SYSTEM | — | — | — | — | None | — |
| FM2 | `/factory` | GET | `require_role(MANAGER)` | `factory.profile.manage` | FACTORY | — | — | — | ✅ Add | Replace with PDP | P2 |
| FM3 | `/factory/templates` | GET | `require_role(MANAGER)` | `factory.profile.manage` | FACTORY | — | — | — | ✅ Add | Replace with PDP | P2 |
| FM4 | `/factories` | GET | `require_role(MANAGER)` | `factory.profile.manage` | FACTORY/ORG | — | — | — | ✅ Add | Replace with PDP | P2 |
| FM5 | `/factories` | POST | `require_role(MANAGER)` + factory limit | `factory.create` | ORG | ✅ Required | ✅ (OA/OO only) | FACTORY_CREATED | ✅ Add | Change rank to OA/OO + add MC | **P1** |
| FM6 | `/factory` | PUT | `require_role(MANAGER)` | `factory.profile.manage` | FACTORY | — | — | — | ✅ Add | Replace with PDP | P2 |
| FM7 | `/control-tower` | GET | `require_role(MANAGER)` | `analytics.operations.view` | ORG | — | — | — | ✅ Add | Replace with PDP | P2 |

### 3.22 Organization Management

| # | Endpoint | Method | Current Auth | Target Permission | Target Scope | MC | SoD | Audit | Denial | Code Changes | Priority |
|---|----------|--------|--------------|------------------|--------------|----|-----|-------|--------|--------------|:--------:|
| OG1 | `/admin/factories` | GET | Admin role | `factory.create` | ORG | — | — | — | ✅ Add | Replace with PDP | P2 |
| OG2 | `/admin/users` | GET | Admin role | `user.directory.view` | ORG | — | — | — | ✅ Add | Replace with PDP | P2 |
| OG3 | `/admin/events` | GET | Admin role | `audit.log.view` | ORG | — | — | — | ✅ Add | Replace with PDP | P2 |
| OG4 | `/admin/quota` | GET | Admin role | `billing.status.view` | ORG | — | — | — | ✅ Add | Replace with PDP | P2 |
| OG5 | `/admin/subscriptions` | GET | Admin role | `billing.status.view` | ORG | — | — | — | ✅ Add | Replace with PDP | P2 |

### 3.23 Background Jobs (`backend/routers/jobs.py`)

| # | Endpoint | Method | Current Auth | Target Permission | Target Scope | Code Changes | Priority |
|---|----------|--------|--------------|------------------|--------------|--------------|:--------:|
| BJ1 | `/jobs` | GET | Owner-id check | `background_jobs.view` | SELF | Add PDP check | P2 |
| BJ2 | `/jobs/{id}` | GET | Owner-id check | `background_jobs.view` | SELF | Add PDP check | P2 |
| BJ3 | `/jobs/{id}/cancel` | POST | Owner-id check | `background_jobs.view` | SELF | Add PDP check | P2 |
| BJ4 | `/jobs/{id}/retry` | POST | Owner-id check | `background_jobs.view` | SELF | Add PDP check + audit | P2 |

**Missing Permission:** `background_jobs.view` — Low risk, SELF scope, all authenticated roles.

### 3.24 Emails (`backend/routers/emails.py`)

| # | Endpoint | Method | Current Auth | Target Permission | Target Scope | MC | SoD | Audit | Denial | Code Changes | Priority |
|---|----------|--------|--------------|------------------|--------------|----|-----|-------|--------|--------------|:--------:|
| EM1 | `/summary` | GET | `require_any_role(ACC, SUP, MGR, ADMIN, OWNER)` | `reporting.email.summary.send` | FACTORY/ORG | — | — | — | ✅ Add | Replace with PDP | P2 |
| EM2 | `/summary/generate` | POST | Same | `reporting.email.summary.send` | FACTORY/ORG | — | — | EMAIL_SUMMARY_GENERATED | ✅ Add | Replace with PDP | P2 |
| EM3 | `/summary/send` | POST | Same | `reporting.email.summary.send` | FACTORY/ORG | ✅ Required (confirm send) | — | EMAIL_SUMMARY_SENT | ✅ Add | Add confirmation MC | P2 |

### 3.25 Feedback (`backend/routers/feedback.py`)

| # | Endpoint | Method | Current Auth | Target Permission | Target Scope | Workflow State | MC | SoD | Audit | Denial | Code Changes | Priority |
|---|----------|--------|--------------|------------------|--------------|----------------|----|-----|-------|--------|--------------|:--------:|
| FB1 | `/feedback` | POST | `get_current_user` | `feedback.submit` | SELF | — | — | — | FEEDBACK_SUBMITTED | ✅ Add | Add `require_permission` | P2 |
| FB2 | `/feedback` | GET | `require_any_role(ADMIN, OWNER)` | `feedback.manage` | ORG | — | — | — | — | ✅ Add | Replace with PDP | P2 |
| FB3 | `/feedback/mine/updates` | GET | `get_current_user` | `feedback.submit` | SELF | — | — | — | — | ✅ Add | Add PDP | P2 |
| FB4 | `/feedback/export.csv` | GET | Admin role | `feedback.manage` | ORG | — | — | — | FEEDBACK_EXPORTED | ✅ Add | Add PDP + audit | P2 |
| FB5 | `/feedback/{id}` | GET | Admin role | `feedback.manage` | ORG | — | — | — | — | ✅ Add | Add PDP | P2 |
| FB6 | `/feedback/{id}` | PATCH | Admin role | `feedback.manage` | ORG | open → in_progress → resolved | — | — | FEEDBACK_UPDATED | ✅ Add | Add state validation + PDP | P2 |

**Missing Permissions:** `feedback.submit`, `feedback.manage` — Low/Medium risk — need catalog addition.

### 3.26 Observability (`backend/routers/observability.py`)

| # | Endpoint | Method | Current Auth | Target Permission | Target Scope | Denial | Code Changes | Priority |
|---|----------|--------|--------------|------------------|--------------|--------|--------------|:--------:|
| OB1 | `/ready` | GET | None | Public | SYSTEM | — | None | — |
| OB2 | `/ai/health` | GET | None | Public | SYSTEM | — | None | — |
| OB3 | `/ai/dashboard` | GET | None | Public | SYSTEM | — | None | — |
| OB4 | `/ai/governance` | GET | None | Public | SYSTEM | — | None | — |
| OB5 | `/alerts` | GET | `require_any_role(ADMIN, OWNER)` | `ops_alerts.view` | ORG | ✅ Add | Replace with PDP | P3 |
| OB6 | `/alerts/{ref_id}` | GET | Same | `ops_alerts.view` | ORG | ✅ Add | Replace with PDP | P3 |
| OB7 | `/frontend-error` | POST | None | Public | SYSTEM | — | None | — |

**Missing Permission:** `system.observability.view` — Low risk — needs catalog addition.

### 3.27 Admin Modules (`backend/routers/admin_billing.py`, `admin_ai.py`)

| # | Endpoint | Method | Current Auth | Target Permission | Target Scope | Denial | MFA | Code Changes | Priority |
|---|----------|--------|--------------|------------------|--------------|--------|-----|--------------|:--------:|
| AD1 | `/admin/billing/events` | GET | Admin role | `audit.log.view` | ORG | ✅ Add | — | Add PDP | P2 |
| AD2 | `/admin/billing/subscriptions` | GET | Admin role | `billing.status.view` | ORG | ✅ Add | — | Add PDP | P2 |
| AD3 | `/admin/billing/quota` | GET | Admin role | `billing.status.view` | ORG | ✅ Add | — | Add PDP | P2 |
| AD4 | `/admin/billing/reset-quota/{org_id}` | POST | Admin role | `billing.addon.manage` | ORG | ✅ Add | ✅ | Add PDP + MFA | P2 |
| AD5 | `/admin/ai/usage` | GET | Admin role | `billing.status.view` | ORG | ✅ Add | — | Add PDP | P2 |
| AD6 | `/admin/ai/cost-summary` | GET | Admin role | `billing.status.view` | ORG | ✅ Add | — | Add PDP | P2 |

### 3.28 Premium Features (`backend/routers/premium.py`)

| # | Endpoint | Method | Current Auth | Target Permission | Target Scope | Denial | Code Changes | Priority |
|---|----------|--------|--------------|------------------|--------------|--------|--------------|:--------:|
| PR1 | `/premium/dashboard` | GET | `require_any_role(SUP, MGR, ADMIN, OWNER)` | `analytics.operations.view` | FACTORY/ORG | ✅ Add | Replace with PDP | P2 |
| PR2 | `/premium/audit-trail` | GET | Same | `audit.log.view` | ORG | ✅ Add | Replace with PDP | P2 |
| PR3 | `/premium/executive-pdf` | GET | Same | `reporting.owner.daily_pdf.export` | FACTORY/ORG | ✅ Add | Replace with PDP + scope | P2 |

### 3.29 External Integrations & Webhooks

| # | Endpoint | Method | Current Auth | Target Permission | Target Scope | Code Changes | Priority |
|---|----------|--------|--------------|------------------|--------------|--------------|:--------:|
| WH1 | `/whatsapp` | GET | Webhook verification | System (external) | SYSTEM | None | — |
| WH2 | `/whatsapp` | POST | Webhook verification | System (external) | SYSTEM | None | — |
| WH3 | `/phone/start-verification` | POST | None | Public | SYSTEM | None | — |
| WH4 | `/phone/confirm-verification` | POST | None | Public | SYSTEM | None | — |

---

## 4. Cross-Cutting Gap Register

### 4.1 Missing Permissions (Need Catalog Addition)

| Permission | Risk | Scope | Roles | Affected Endpoints |
|-----------|:----:|-------|-------|--------------------|
| `ops_alerts.view` | Low | FACTORY | SUP, FM, OA | AL1, AL2, OB5, OB6 |
| `ops_alerts.configure` | High | ORG | ADMIN, OWNER | AR1–AR6 |
| `feedback.submit` | Low | SELF | All roles | FB1, FB3 |
| `feedback.manage` | Medium | ORG | ADMIN, OWNER | FB2, FB4–FB6 |
| `background_jobs.view` | Low | SELF | All authenticated | BJ1–BJ4 |
| `system.observability.view` | Low | SYSTEM | ADMIN, OWNER | OB5–OB6 |

### 4.2 Gap Register

| ID | Gap Type | Count | Severity | Description |
|----|----------|:-----:|:--------:|-------------|
| GR1 | Missing permission check | 169 | Critical/P0 | Endpoints with no positive permission check for target permission |
| GR2 | Missing scope enforcement | 170 | High/P1 | No validation that the user's scope covers the resource |
| GR3 | Missing maker-checker | 27 | High/P1 | Actions that should require dual control but don't |
| GR4 | Missing SoD check | 20 | High/P1 | No validation against toxic combinations |
| GR5 | Missing state validation | 23 | Medium/P2 | No workflow state verification before mutation |
| GR6 | Missing workflow ownership | 14 | Medium/P2 | No named owner for approval workflows |
| GR7 | Missing denial logging | 212 | Medium/P2 | No AUTHZ_DENY audit events generated |
| GR8 | Missing factory isolation | 170 | High/P1 | No validation user has role for the specific factory |
| GR9 | Missing MFA enforcement | 7 | Low/P3 | High-risk actions without MFA requirement |
| GR10 | Missing emergency access | 6 | Low/P3 | No break-glass override path for locked-out users |
| GR11 | Rank-based instead of permission | ~139 | High/P1 | `require_role` / `require_any_role` used instead of PDP |

### 4.3 Severity Distribution

```
GR1 (Permission)     ████████████████████████████████████████████████████████ 169
GR2 (Scope)          █████████████████████████████████████████████████████████ 170
GR7 (Denial Log)     ██████████████████████████████████████████████████████████ 212
GR11 (Rank-based)    ████████████████████████████████████████████████████ 139
GR3 (Maker-Checker)  ██████████ 27
GR4 (SoD)            ████████ 20
GR5 (State)          █████████ 23
GR8 (Isolation)      █████████████████████████████████████████████████████████ 170
GR9 (MFA)            ██ 7
GR10 (Break-Glass)   ██ 6
```

---

## 5. Workflow Dependencies & Sequencing

### 5.1 Phase Dependency Graph

```
Phase 0: Foundation
├── Add authz DB tables (roles, permissions, role_permissions, conditions)
├── Implement PDP core (shadow mode)
├── Seed roles/permissions from catalog
└── Backfill user_factory_roles
    │
    ▼
Phase 1: P0 Fixes (Sprint 1)
├── Fix AI/Intelligence permission gap (8 endpoints)
├── Fix Steel overview permission gap (2 endpoints)
├── Remove auto-approve for Admin in stock reconciliation
└── Add denial logging to PDP
    │
    ▼
Phase 2: P1 Operations (Sprint 2-3)
├── Attendance → replace rank with permission
├── Production Entries → permission + state validation
├── OCR → domain-split approval + maker-checker
├── Steel Inventory → FM/OO fixed, maker-checker added
├── Invoices → ACC creator, pre/post-dispatch state
├── Dispatch → state machine + maker-checker
├── Payments → maker-checker + SoD + MFA
└── User Management → OA/OO permissions, remove rank comparison
    │
    ▼
Phase 3: P2 Reads & Audits (Sprint 4-6)
├── All read endpoints → explicit permission check
├── All denial events → audit log
├── Scope enforcement on all list/detail queries
├── Factory isolation validation
├── Workflow state validation on update endpoints
└── Missing permission catalog additions
    │
    ▼
Phase 4: P3 Hardening (Sprint 7-8)
├── MFA enforcement on high-risk actions
├── Break-glass access workflow
├── Observability/admin endpoints
├── Remove all rank-based code
└── Enterprise hardening
```

### 5.2 Deployment Sequence

```
Sprint 1: Foundation + P0
  Week 1-2: DB schema + PDP + seeding + backfill
  Week 3:   AI/Intelligence P0 fixes + Steel P0
  Week 4:   Denial logging + shadow mode validation

Sprint 2-3: P1
  Week 5-6: Attendance + Entries + OCR
  Week 7-8: Steel Inventory + Invoices + Dispatch + Payments
  Week 9-10: User Management + Billing + Factory Management

Sprint 4-6: P2
  Week 11-12: Read endpoint migration
  Week 13-14: Scope enforcement + factory isolation
  Week 15-16: State validation + catalog additions

Sprint 7-8: P3
  Week 17: MFA + break-glass
  Week 18: Remove rank-based code
```

### 5.3 Feature Flags

```python
# PDP mode flags (per-module)
AUTHZ_ENFORCE_MODULES = os.getenv("AUTHZ_ENFORCE_MODULES", "").split(",")
# e.g. "attendance,entries,ocr,inventory,billing"

# When empty, all modules run in shadow mode
# When a module is in this list, PDP returns actual decision
```

---

## 6. Test Case Catalog

### 6.1 Core Authorization Tests (`tests/test_authorization/`)

| Test | Description | Type | Priority |
|------|-------------|------|:--------:|
| `test_pdp_allow_valid_permission` | PDP returns ALLOW for valid role+permission+scope | Unit | P0 |
| `test_pdp_deny_no_permission` | PDP returns DENY when no permission exists | Unit | P0 |
| `test_pdp_deny_wrong_scope` | PDP returns DENY when scope doesn't cover resource | Unit | P0 |
| `test_pdp_deny_violates_condition` | PDP returns DENY when ABAC condition fails | Unit | P0 |
| `test_pdp_shadow_mode_ignores_deny` | Shadow mode logs deny but returns ALLOW | Unit | P0 |
| `test_pdp_require_permission_raises` | `require_permission()` raises 403 on deny | Unit | P0 |
| `test_permission_resolution_hierarchy` | Scope containment works (ORG → FACTORY → DEPT → SELF) | Unit | P1 |
| `test_factory_isolation_filters` | Actor from Factory A cannot access Factory B records | Integration | P1 |
| `test_maker_checker_same_user_blocked` | Same user cannot make and check | Unit | P1 |
| `test_toxic_combo_blocked` | User with inventory.create cannot approve reconciliation | Unit | P1 |
| `test_runtime_self_approval_blocked` | Creator cannot approve own record | Unit | P1 |
| `test_session_mfa_enforcement` | Permission with `requires_mfa=True` fails without MFA | Unit | P3 |
| `test_break_glass_temporary` | Break-glass grants auto-expire | Integration | P3 |

### 6.2 Module-Specific Tests

| Test | Module | Priority |
|------|--------|:--------:|
| `test_ai_authz_restored` | AI | P0 |
| `test_intelligence_authz_restored` | Intelligence | P0 |
| `test_inventory_reconciliation_no_auto_approve` | Steel Inventory | P0 |
| `test_attendance_endpoint_permissions` | Attendance | P1 |
| `test_entry_create_edit_delete_permissions` | Entries | P1 |
| `test_ocr_domain_split_approval` | OCR | P1 |
| `test_invoice_pre_post_dispatch_state` | Invoices | P1 |
| `test_dispatch_status_machine_enforced` | Dispatch | P1 |
| `test_payment_maker_checker_enforced` | Payments | P1 |
| `test_user_role_assignment_sod_enforced` | User Management | P1 |
| `test_factory_isolation_cross_tenant` | Cross-cutting | P1 |
| `test_billing_mfa_required_for_plan_change` | Billing | P2 |
| `test_report_export_permissions` | Reports | P2 |
| `test_feedback_state_machine` | Feedback | P2 |
| `test_all_endpoints_log_denial_events` | Cross-cutting | P2 |
| `test_admin_endpoints_have_permissions` | Admin | P2 |
| `test_observability_public_endpoints` | Observability | P3 |

### 6.3 Migration Safety Tests

| Test | Description | Priority |
|------|-------------|:--------:|
| `test_shadow_mode_zero_regressions` | Shadow mode must not change any existing behavior | P0 |
| `test_backfill_user_factory_roles` | All existing users get valid assignments | P0 |
| `test_permission_seed_data_correct` | Seeded permissions match target catalog | P0 |
| `test_rollback_restores_old_auth` | Rolling back feature flag restores old behavior | P1 |

---

## 7. Migration Rollback Plan

### 7.1 Rollback Conditions

Rollback is triggered if:
1. Any module in enforcement mode causes > 1% legitimate request failure
2. Any user reports being unable to perform a previously allowed action
3. Any test suite reports regression in non-authz test cases
4. PDP response time exceeds 100ms P99

### 7.2 Rollback Steps

```bash
# Step 1: Disable enforcement for the affected module
# Set environment variable:
AUTHZ_ENFORCE_MODULES="attendance,entries,ocr,inventory"  
# Remove the failing module:
AUTHZ_ENFORCE_MODULES="attendance,entries,ocr"

# Step 2: Verify shadow mode is active for disabled modules
# The PDP will continue logging but return ALLOW

# Step 3: If systemic failure, disable all enforcement:
AUTHZ_ENFORCE_MODULES=""

# Step 4: Verify old behavior is restored
# Old require_role() calls still work (they haven't been removed yet)

# Step 5: Root cause analysis
# Check authz_decisions table for denied requests
SELECT event_type, permission_key, count(*)
FROM authz_decisions
WHERE event_time > NOW() - INTERVAL '1 hour'
  AND decision = 'deny'
GROUP BY event_type, permission_key;
```

### 7.3 Data Safety

All new tables are additive:
- `roles`, `permissions`, `role_permissions`, `permission_conditions` — new tables, no existing code depends on them
- `user_factory_roles` — upgraded with new columns (nullable), existing code uses old columns
- `authz_decisions` — new table, no reads from production code yet
- `approval_rules` — new table, not yet enforced

**Rollback = set `AUTHZ_ENFORCE_MODULES=""` + no schema revert needed**

---

## 8. Appendix: Permission-to-Route Quick Reference

### 8.1 Permission → First Endpoint Mapping

| Permission | First Endpoint | Module | Priority |
|-----------|----------------|--------|:--------:|
| `analytics.ai.query` | AI1 – `/ai/usage` | AI | **P0** |
| `analytics.anomaly.view` | AI3 – `/ai/anomalies` | AI | **P0** |
| `analytics.executive.view` | AI6 – `/ai/executive-summary` | AI | **P0** |
| `inventory.reconciliation.submit` | SI6 – `/inventory/reconciliations` | Steel | **P0** |
| `inventory.ledger.view` | SI11 – `/overview` | Steel | **P0** |
| `dispatch.record.view` | D7 – `/overview` | Steel | **P0** |
| `attendance.self.punch` | AT2 – `/punch` | Attendance | P1 |
| `attendance.team.view` | AT3 – `/live` | Attendance | P1 |
| `attendance.review.approve` | AT10 – `/review/{id}/approve` | Attendance | P1 |
| `production.entry.create` | E1 – `/smart`, E2 – `/` | Entries | P1 |
| `production.entry.approve` | E7 – `/{id}/approve` | Entries | P1 |
| `production.entry.reject` | E8 – `/{id}/reject` | Entries | P1 |
| `production.override` | E9 – `/{id}` DELETE | Entries | P1 |
| `ocr.document.upload` | O6 – `/verifications`, O15 – `/logbook` | OCR | P1 |
| `ocr.verification.approve_ops` | O10 – `/verifications/{id}/approve` | OCR | P1 |
| `ocr.verification.approve_finance` | O10 – `/verifications/{id}/approve` | OCR | P1 |
| `inventory.transaction.create` | SI5 – `/inventory/transactions` POST | Steel | P1 |
| `inventory.reconciliation.approve` | SI9 – `/reconciliations/{id}/approve` | Steel | P1 |
| `customer.record.manage` | C2 – `/customers` POST | Steel | P1 |
| `customer.verification.request` | CV1 – `/customers/{id}/verification` POST | Steel | P1 |
| `customer.verification.review` | CV3 – `/customers/{id}/verification/review` | Steel | P1 |
| `invoice.record.create` | I2 – `/invoices` POST | Steel | P1 |
| `invoice.record.edit_post_dispatch` | I4 – `/invoices/{id}` PATCH | Steel | P1 |
| `dispatch.record.create` | D2 – `/dispatches` POST | Steel | P1 |
| `dispatch.status.update` | D4 – `/dispatches/{id}` PATCH | Steel | P1 |
| `dispatch.quantity.override` | D6 – `/dispatches/{id}/override-quantity` | Steel | P1 |
| `payment.record.create` | P1 – `/customers/{id}/payments` POST | Steel | P1 |
| `payment.record.reverse` | P3 – `/payments/{id}/reverse` | Steel | P1 |
| `payment.allocation.reallocate` | P4 – `/payments/{id}/reallocate` | Steel | P1 |
| `billing.plan.change` | B4 – `/downgrade`, B6 – `/orders` | Billing | P1 |
| `user.invite` | U2 – `/users/invite` | Users | P1 |
| `user.role.assign` | U5 – `/users/{id}/role` PUT | Users | P1 |
| `user.deactivate` | U8 – `/users/{id}` DELETE | Users | P1 |
| `user.membership.assign` | U4 – `/users/{id}/factory-access` PUT | Users | P1 |
| `factory.create` | FM5 – `/factories` POST | Factory | P1 |

---

*End of Complete Authorization Migration Plan — 28 modules, ~250 endpoints, 10 gap types, 4-phase rollout*
