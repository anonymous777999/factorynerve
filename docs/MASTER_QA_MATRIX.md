# Master QA Matrix

Last updated: 2026-04-04
Owner: Product + Engineering + QA
Source docs: `docs/role_security_matrix.md`, `docs/go_live_checklist.md`

## Purpose

Use this as the single release matrix to verify:

- role-based access is correct
- critical workflows work end-to-end
- plan/factory gates behave correctly
- we do not ship regressions in core factory flows

## How To Use This Matrix

1. Keep every row mapped to either an automated test, a manual UAT step, or both.
2. Before release, every `P0` and `P1` row must be `pass`.
3. Any `fail` or `blocked` row must have an owner + ETA before sign-off.
4. If a new feature is shipped, add new rows in this file in the same PR.

Status values:

- `pass`
- `fail`
- `blocked`
- `not-run`

## Coverage Dimensions

- Roles: `attendance`, `operator`, `supervisor`, `accountant`, `manager`, `admin`, `owner`
- Factory type: `general`, `steel`
- Plan tiers: `free`, `starter`, `growth`, `factory`, `business`, `enterprise`
- Auth mode: cookie auth + bearer token
- Client scope: desktop + mobile basic smoke

## Execution Cadence

### Per PR (fast gate)

- `python -m pytest -q tests/test_auth_e2e.py tests/test_factory_context.py tests/test_attendance.py tests/test_ocr_verification.py`
- `python -m pytest -q tests/test_steel_module.py -k "role or reconciliation or dispatch"`
- `cd web && npm run lint && npm run build`

### Nightly (full gate)

- `python -m pytest -q`
- Refresh this matrix statuses for changed modules

### Pre-release (manual UAT)

- Run all `P0` + `P1` rows with real role accounts in staging
- Record result + evidence link/screenshot in release notes

## Master Matrix

| ID | Area | Scenario | Expected Allow | Expected Deny | Factory | Plan | Automation Evidence | Manual UAT | Priority | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AUTH-01 | Auth | Public registration cannot self-assign high roles | `attendance` registration | `accountant/manager/admin/owner` via public register | general+steel | all | `tests/test_auth_e2e.py` | yes | P0 | pass | Privilege-escalation blocker |
| AUTH-02 | Auth | Login returns correct role + context | all active invited users | inactive/invalid creds | general+steel | all | `tests/test_auth_e2e.py` | yes | P0 | pass | Include first-login temp-password flow |
| AUTH-03 | Auth | Factory switch updates active role/context | users with multi-factory access | users without access to target factory | general+steel | all | `tests/test_factory_context.py` | yes | P0 | pass | Validate `/auth/select-factory` |
| AUTH-04 | Auth | Password reset end-to-end | active users | invalid/expired token | general+steel | all | `tests/test_password_reset.py` | optional | P1 | pass | Include token expiry case |
| RBAC-01 | Roles | Manager cannot assign admin/owner | admin/owner | manager promoting to `admin/owner` | general+steel | all | `tests/test_factory_context.py` | yes | P0 | pass | Critical role boundary |
| RBAC-02 | Roles | Manager cannot modify existing admin/owner account | admin/owner | manager downgrade/edit privileged users | general+steel | all | `tests/test_factory_context.py` | yes | P0 | pass | Critical role boundary |
| RBAC-03 | Roles | No-op role update returns clear message | same-role updates | misleading success message | general+steel | all | `tests/test_factory_context.py` | yes | P1 | pass | Added 2026-04-03 |
| RBAC-04 | Roles | Operator cannot access approval/review queues | supervisor+ | operator/accountant | general+steel | all | `tests/test_attendance.py`, `tests/test_report_insights.py` | yes | P0 | pass | Include UI menu visibility check |
| RBAC-05 | Roles | Billing write APIs leadership-only | admin/owner (or owner-only per final policy) | operator/supervisor/accountant/manager | general+steel | all | `tests/test_billing_security.py` | yes | P0 | pass | Must align backend + frontend policy |
| TEN-01 | Tenancy | Cross-org isolation for users/data | in-org scoped queries | cross-org reads/writes | general+steel | all | `tests/test_tenant_isolation.py` | optional | P0 | pass | Data isolation blocker |
| TEN-02 | Tenancy | Multi-factory user access updates safely | admin/owner | invalid factory assignment or zero factory access | general+steel | growth+ | `tests/test_factory_context.py` | yes | P1 | pass | Validate fallback active factory |
| TEN-03 | Tenancy | User/factory limits enforced by plan | valid limits | over-limit factory/user creates | general+steel | all | `tests/test_factory_context.py`, `tests/test_billing_addons.py` | optional | P1 | pass | Covers org scaling boundaries |
| ATT-01 | Attendance | Attendance worker self punch + regularization | attendance/self | unauthorized cross-user edits | general+steel | all | `tests/test_attendance.py` | yes | P0 | pass | Core daily workflow |
| ATT-02 | Attendance | Live board only for review roles | supervisor/manager/admin/owner | operator/accountant | general+steel | all | `tests/test_attendance.py` | yes | P0 | pass | Role gate correctness |
| ATT-03 | Attendance | Review queue approve/reject flow | review roles | non-review roles | general+steel | all | `tests/test_attendance.py` | yes | P1 | pass | Include missed punch edge case |
| OCR-01 | OCR | OCR scan and verification role guards | operator/supervisor/manager/admin/owner (as designed) | accountant/no-access roles | general+steel | plan-dependent | `tests/test_ocr_verification.py` | yes | P1 | pass | Validate plan quota paths |
| OCR-02 | OCR | OCR limits and feature gating | eligible plans/users | over-quota/free restrictions | general+steel | by feature | `tests/test_feature_gating.py` | optional | P1 | pass | Includes usage reset assumptions |
| OCR-03 | OCR | Approved OCR only feeds trusted export/reporting surfaces | approved verification rows in export, dashboard, reports, owner views | draft/pending/rejected OCR treated as trusted | general+steel | plan-dependent | `tests/test_ocr_verification.py` | yes | P0 | pass | Includes reviewed Excel export, trust summary, and review audit visibility |
| REP-01 | Reports | Report insights access by role | supervisor/manager/admin/owner | operator denied | general+steel | by plan | `tests/test_report_insights.py` | yes | P1 | pass | Ensure message clarity on deny |
| REP-02 | Reports | Report export jobs create/download | authorized roles | unauthorized access/job leakage | general+steel | by plan | `tests/test_report_jobs.py`, `tests/test_jobs.py` | yes | P1 | pass | Includes async job controls |
| ANA-01 | Analytics | Analytics role + plan gates | supervisor/manager/admin/owner on eligible plan | operator/accountant or plan-blocked users | general+steel | growth+ (or configured min) | `tests/test_premium_analytics.py`, `tests/test_feature_gating.py` | yes | P1 | pass | Validate 402 UX path |
| ANA-02 | Analytics | No client fetch storm/rate-limit loop | stable periodic refresh | repeated request loop | general+steel | all | `tests/test_analytics_refresh_stability.py` | yes | P0 | pass | Regression from prior incident |
| STL-01 | Steel | Steel overview only with active steel factory | steel context users | non-steel active factory | steel | all | `tests/test_steel_module.py` | yes | P0 | pass | Must return clear message |
| STL-02 | Steel | Reconciliation summary/view role scope | supervisor/manager/admin/owner | operator/accountant | steel | all | `tests/test_steel_module.py` | yes | P0 | pass | Factory trust workflow; includes mismatch-cause visibility |
| STL-03 | Steel | Reconciliation approve/reject restricted | admin/owner | supervisor/manager/operator/accountant | steel | all | `tests/test_steel_module.py` | yes | P0 | pass | Financial + stock integrity; mismatch cause required for variance |
| STL-04 | Steel | Dispatch create/update status permissions | manager/admin/owner/supervisor (as designed) | operator/accountant (if denied) | steel | all | `tests/test_steel_module.py` | yes | P1 | pass | Verify negative stock protection and invoice-dispatch weight linkage |
| STL-05 | Steel | Invoices/customers/payments accountant access | accountant + higher allowed roles | disallowed worker roles | steel | all | `tests/test_steel_module.py` | yes | P1 | pass | Commercial workflow safety; invoice/customer exposure drill-downs covered |
| STL-06 | Steel | Owner daily PDF is owner-only | owner | non-owner roles | steel | pdf-enabled plans | `tests/test_steel_module.py` | yes | P1 | pass | Sensitive financial export |
| BILL-01 | Billing | Checkout/create order guarded by role | leadership per policy | non-leadership direct API calls | general+steel | all | `tests/test_billing_security.py` | yes | P0 | pass | Must match nav restrictions |
| BILL-02 | Billing | Upgrade/downgrade lifecycle + webhook safety | authorized billing roles | unauthorized state changes | general+steel | all | `tests/test_billing_security.py`, `tests/test_billing_addons.py` | optional | P1 | pass | Revenue integrity |
| OBS-01 | Observability | Error ingestion/auth does not leak privilege | authorized telemetry path | unauthenticated/forbidden writes | general+steel | all | `tests/test_observability.py` | optional | P2 | pass | Non-blocking but recommended |
| UX-01 | Mobile | Core pages render and act on mobile widths | key pages usable | broken layout/actions | general+steel | all | `web/e2e/ux-mobile-language.spec.ts` | yes | P1 | pass | Dashboard, entry, OCR, steel, reports |
| UX-02 | Language | Localized labels do not break workflows | supported locales | broken forms/actions | general+steel | all | `web/e2e/ux-mobile-language.spec.ts` | yes | P2 | pass | Hindi/Marathi critical paths |

## High-Risk Rows (Release Blockers)

Release cannot proceed unless these are `pass`:

- `AUTH-01`
- `RBAC-01`
- `RBAC-02`
- `RBAC-05`
- `TEN-01`
- `ATT-01`
- `ANA-02`
- `STL-01`
- `STL-02`
- `STL-03`
- `BILL-01`

## Current Known Gaps To Close

- Keep billing backend role checks fully aligned with frontend leadership visibility.
- Add mobile/language smoke evidence (`npm run test:e2e`) to every release note.

## Latest Automated Evidence

Execution date: `2026-04-04`

- `python -m pytest -q` -> `106 passed`
- `cd web && npm.cmd run lint` -> `passed`
- `cd web && npm.cmd run build` -> `passed`
- Supporting launch docs added:
  - `docs/go_live_checklist.md`
  - `docs/V1_RELEASE_NOTES.md`
  - `docs/SUPPORT_PLAYBOOK.md`
  - `docs/DEMO_WALKTHROUGH.md`

Manual staging smoke is still recommended for:

- operator mobile walkthrough
- supervisor desktop walkthrough
- owner desktop walkthrough

## Release Sign-Off Template

- Release ID:
- Date:
- QA Owner:
- Engineering Owner:
- Product Owner:

Summary:

- P0 passed: `16 / 16`
- P1 passed: `15 / 15`
- Open blockers: final staging smoke and release-owner sign-off
- Approved for release: `no`

