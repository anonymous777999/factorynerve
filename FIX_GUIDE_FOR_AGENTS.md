# DPR.ai — Fix Guide for AI Coding Agents (Bug-by-Bug)

**Companion to:** `BUG_REPORT_PRE_ONBOARDING.md` (that file has full root-cause analysis; this file is the actionable fix playbook).
**Audience:** an IDE AI agent (Cursor / OpenCode / Claude Code / etc.) that will apply the fixes.

**Golden rules for the fixing agent:**
1. Fix **one bug per commit**. Keep diffs minimal — do not refactor surrounding code.
2. After each fix, run the specific test named in that bug's card. Do **not** move on until it's green.
3. **Do NOT** touch `render.yaml` (auto-deploys prod), and do NOT commit any `*.db`, `*.log`, scratch, or report files.
4. If a card says **"BUSINESS DECISION"**, stop and ask the owner — do not guess.
5. Never hardcode secrets. Never weaken an auth/permission check beyond what the card specifies.

---

## TIER 1 — FASTEST & SAFEST (do these first; ~1 line each, near-zero risk)

These four are trivial, isolated, and cannot break anything else. Highest value-per-effort. Fix all four first.

### FIX-01  (report ref: S0-1)  — Steel invoice creation 500s on every request
- **Risk:** LOW / near-zero. Removing an argument the model never accepted.
- **File:** `backend/routers/steel.py` — line **4033**
- **What to do:** delete the single kwarg `taxable_amount=round(float(line["weight_kg"]) * float(line["rate_per_kg"]), 2),` from the `SteelSalesInvoiceLine(...)` constructor. Leave the invoice-*header* `taxable_amount=` at line 4005 untouched (that model column exists).
- **Why safe:** `SteelSalesInvoiceLine` has no `taxable_amount` column, so this kwarg only ever raised `TypeError`. The correct per-line amount (`line_total`) is already set.
- **Verify:** `pytest tests/test_steel_module.py -k "weight_invoice or corporate_lifecycle" -q` should pass. The wider steel finance suite (~30 tests) then improves.
- **Agent prompt:**
  > In `backend/routers/steel.py`, in the `SteelSalesInvoiceLine(...)` constructor around line 4033, remove ONLY the `taxable_amount=...` keyword argument. Do not change the `SteelSalesInvoice(...)` header constructor near line 4005. Then run `pytest tests/test_steel_module.py -k weight_invoice -q` and confirm it passes.

### FIX-02  (report ref: WF-1)  — Dispatch/gate-pass 500s: missing `os` + `logger` in steel.py
- **Risk:** LOW / near-zero. Adding two standard imports + a module logger — the pattern every other router already uses.
- **File:** `backend/routers/steel.py` — top-of-file imports (around lines 3–15)
- **What to do:** add `import os` and `import logging` to the import block, then after the imports add `logger = logging.getLogger(__name__)`.
- **Why safe:** `os` and `logger` are already *referenced* at lines 1697, 1707, 4569 but never defined → guaranteed `NameError`. Defining them can only fix, never break.
- **Verify:** `pytest tests/test_steel_dispatch_batch_workflow.py -q` should pass once FIX-01 is also in.
- **Agent prompt:**
  > In `backend/routers/steel.py`, add `import os` and `import logging` to the top import block, and add a module-level `logger = logging.getLogger(__name__)` after the imports. Confirm lines ~1697 (`os.getenv`), ~1707 (`logger.warning`), and ~4569 (`logger.info`) now resolve. Run `pytest tests/test_steel_dispatch_batch_workflow.py -q`.

### FIX-03  (report ref: AN-1)  — Steel anomaly/fraud detection 500s: wrong column name
- **Risk:** LOW / near-zero. One-word rename to the column that actually exists.
- **File:** `backend/services/steel_intelligence.py` — line **506**
- **What to do:** change `SteelStockReconciliation.created_at` → `SteelStockReconciliation.counted_at`.
- **Why safe:** the model has `counted_at` (not `created_at`); current code raises `AttributeError` at query-build time on every call. This unblocks `/steel/anomalies`, `/steel/owner/dashboard`, and `/steel/decision/dashboard` (all call `build_anomaly_detection`). The other `.created_at` filters in that function reference different models that DO have `created_at` — leave them.
- **Verify:** import the module and call `build_anomaly_detection(db, factory_id)` without exception; then `GET /steel/anomalies?days=30` returns 200 for a steel owner (after FIX-05 for the dashboards).
- **Agent prompt:**
  > In `backend/services/steel_intelligence.py` line 506, change `SteelStockReconciliation.created_at` to `SteelStockReconciliation.counted_at`. That is the ONLY occurrence to change — leave the other `.created_at` filters in `build_anomaly_detection` (they reference models that do have `created_at`). Verify `build_anomaly_detection` no longer raises AttributeError.

### FIX-04  (report ref: WF-5)  — `/notifications` unreachable (double `/notifications/notifications` prefix)
- **Risk:** LOW / near-zero, BUT requires a matching front-end check (see note).
- **File:** `backend/main.py` — line **362**
- **What to do:** the router in `backend/routers/notifications.py:22` already declares `APIRouter(prefix="/notifications")`. Remove the redundant `prefix="/notifications"` from the `include_router` call so it reads `app.include_router(notifications_router)`. (Do NOT remove both prefixes — keep the router-level one.)
- **Why safe:** endpoints currently mount at `/notifications/notifications`; after this they mount at the intended `/notifications`.
- **FRONT-END NOTE:** confirm the web client calls `/notifications` (not the doubled path). If any client code hardcodes `/notifications/notifications`, update it in the same PR.
- **Verify:** `GET /notifications` returns 200 (not 404) for an authenticated user; `GET /notifications/unread-count` works.
- **Agent prompt:**
  > In `backend/main.py` line 362, change `app.include_router(notifications_router, prefix="/notifications")` to `app.include_router(notifications_router)` because the router already self-prefixes with `/notifications` (see `backend/routers/notifications.py:22`). Then grep the `web/` front-end for `notifications/notifications` and fix any hardcoded doubled path. Verify `GET /notifications` returns 200.

---

## TIER 2 — SMALL & SAFE, but touch security/permissions (test hard)

### FIX-05  (report ref: AN-2)  — Owner dashboards/PDF return 403 for real owners (wrong PLATFORM permission)
- **Risk:** MEDIUM-LOW. It IS a permission change — verify it doesn't over-grant.
- **Files & lines:**
  - `backend/routers/steel_intelligence.py:180` (owner dashboard)
  - `backend/routers/steel_intelligence.py:208` (decision dashboard)
  - `backend/routers/steel.py:1765` (owner daily PDF)
- **What to do:** replace `permission_key="admin.billing.quota.reset"` (which is `ScopeLevel.PLATFORM`, internal-staff-only) with a **factory-scoped owner** permission. Recommended existing key: **`production.analytics.view`** (defined `ScopeLevel.FACTORY`, `default_roles=_SUPERVISOR_PLUS`, `backend/authorization/permission_catalog.py:126`), already used by the working `/steel/production/intelligence` owner route. Keep the `ResourceContext(factory_id=...)` that's already passed. For the fraud-heavy dashboards you may instead use **`production.fraud_intelligence.view`** (also FACTORY-scoped, `permission_catalog.py:135`) — either is correct-scope; pick the one matching the data each dashboard exposes.
- **Why safe:** each of these 3 endpoints ALREADY has an explicit role gate directly above the PDP call (`if current_user.role not in (OWNER, ADMIN): raise 403`), so swapping to a FACTORY-scoped permission does not open them to non-owners — it just stops wrongly rejecting legitimate owners.
- **DO NOT** invent a new permission key unless you also register it in `permission_catalog.py`. Prefer reusing an existing FACTORY-scoped key.
- **Verify:** `pytest tests/test_steel_module.py::test_steel_owner_daily_pdf_requires_owner_and_returns_pdf -q` (needs FIX-01 first — that test crashes at invoice creation otherwise). Confirm owner → 200 and a non-owner (operator) → 403.
- **Agent prompt:**
  > In `backend/routers/steel_intelligence.py` lines 180 and 208, and `backend/routers/steel.py` line 1765, replace `permission_key="admin.billing.quota.reset"` with `permission_key="production.analytics.view"` (a FACTORY-scoped permission defined in `backend/authorization/permission_catalog.py:126`). Keep the existing `ResourceContext(factory_id=...)`. Do NOT remove the role check (`if current_user.role not in (OWNER, ADMIN)`) just above each call. Apply FIX-01 first, then run `pytest tests/test_steel_module.py::test_steel_owner_daily_pdf_requires_owner_and_returns_pdf -q` and confirm owner=200, operator=403.

### FIX-06  (report ref: WF-6)  — `/settings/factories` 500s on a drifted factory row
- **Risk:** LOW. Adding a defensive fallback; no behavior change for healthy rows.
- **File:** `backend/routers/settings.py` — line **450** (inside `_serialize_factory_summaries`)
- **What to do:** wrap the `normalize_workflow_template_key(factory.industry_type, factory.workflow_template_key)` call in try/except `ValueError`; on error fall back to `default_workflow_template_key(factory.industry_type)` (already imported in this file) and `logger.warning(...)` the drifted factory_id. So one inconsistent row degrades gracefully instead of 500-ing the whole factory list.
- **Why safe:** healthy rows never raise, so behavior is identical for them; only a drifted row (which currently hard-500s) is rescued.
- **Verify:** create a factory, then set its `workflow_template_key` to a mismatched value in a test DB; `GET /settings/factories` should return 200 with the fallback template, not 500.
- **Agent prompt:**
  > In `backend/routers/settings.py`, function `_serialize_factory_summaries` around line 450, wrap `normalize_workflow_template_key(factory.industry_type, factory.workflow_template_key)` in a try/except catching `ValueError`, falling back to `default_workflow_template_key(factory.industry_type)` (already imported). Add a `logger.warning` with the drifted factory_id. Change nothing else. Verify a factory row with a mismatched template no longer 500s the list.

### FIX-07  (report ref: AI-1 / S0-2)  — Async AI features hang → ReadTimeout (nested DB session)
- **Risk:** MEDIUM-LOW per site; multiple sites. Follow the proven pattern from commit 3854c08.
- **What to do:** thread the request/job-scoped `db` session into every `check_rate_limit(...)` call that currently omits `db=`. Confirmed unfixed sites:
  - `backend/services/intelligence/service.py:946` → add `db=db`
  - `backend/routers/entries.py:350` (inside `_run_entry_summary_job`; `db` is in scope) → add `db=db`
  - `backend/routers/entries.py:1094` → add `db=db`
  - `backend/routers/emails.py:241` → add `db=db`
  - `backend/routers/coil_theft.py:48` → add `db=db` (only matters if that feature has a nonzero default limit — verify)
- **Reference (already-correct):** `backend/routers/ai.py:392` (`_consume_quota`) passes `db=db`. Mirror it exactly.
- **Why safe:** passing the existing session avoids opening a second `SessionLocal()` that deadlocks against the caller's open transaction. Same one-arg change already merged for `/ai/anomalies`.
- **Verify:** `pytest tests/test_intelligence_requests.py -k factory_intelligence_request_runs_async tests/test_report_jobs.py -k executive_summary_job_returns_payload -q` — both should stop timing out and pass.
- **Agent prompt:**
  > Following `backend/routers/ai.py:392` (`_consume_quota` passes `db=db` to `check_rate_limit`), add `db=db` to these `check_rate_limit(...)` calls that omit it: `backend/services/intelligence/service.py:946`, `backend/routers/entries.py:350`, `backend/routers/entries.py:1094`, `backend/routers/emails.py:241`, and (if its feature limit is nonzero) `backend/routers/coil_theft.py:48`. Each site already has a request- or job-scoped `db` in scope. Change nothing else. Run `pytest tests/test_intelligence_requests.py -k factory_intelligence_request_runs_async tests/test_report_jobs.py -k executive_summary_job_returns_payload -q` and confirm no ReadTimeout.

---

## TIER 3 — REQUIRES A DECISION or DEEPER TRIAGE (not one-line; do NOT rush)

### DECISION-01  (report ref: BILL-1)  — Free (Pilot) plan leaks the paid "custom templates" feature
- **Type:** BUSINESS DECISION — ask the owner before coding.
- **Question for owner:** should the free **Pilot** plan include custom OCR templates, or is that Factory-tier only?
- **Files:** `backend/routers/ocr/_common.py:2966` (`_require_templates_access`), `backend/plans.py:77/87`.
- **If templates stay PAID:** change the `org_has_ocr_access(...)` branch in `_require_templates_access` to check for a purchased **OCR-pack add-on** entitlement, not base-plan OCR quota. Keep `tests/test_billing_addons.py::test_free_plan_ocr_pack_unlocks_template_access` expecting 402 for a plain free user.
- **If templates become FREE on Pilot (intended):** set `"templates": True` for the pilot plan in `backend/plans.py` and update that test to expect 200. Do NOT just delete the test.

### TRIAGE-01  (report ref: S1-2)  — Real RBAC denials: admin blocked from feedback export & alert history
- **Type:** Investigate — possible real regression.
- **Symptom:** `TestFeedbackPermissions.test_list_feedback_admin_allowed`, `test_export_feedback_csv_admin_allowed`, `TestObservabilityPermissions.test_alert_history_admin_allowed` — admin/owner DENIED access they should have.
- **What to do:** verify the permission catalog grants `feedback.*` / `alert.history` keys to ADMIN/OWNER via `default_roles`. If a legit admin is locked out, fix the role set. Separately, the 422-vs-403 ordering (move `require_permission` before body validation on sensitive routes) is lower priority.

### TRIAGE-02  (report ref: S1-3)  — ATTENDANCE role can't self-serve punch/view
- **Type:** Business decision + small permission change.
- **File:** `backend/authorization/permission_catalog.py` — `attendance.self.view` / `.punch` / `.regularization.request` map to `_OPERATOR_PLUS`, which excludes the ATTENDANCE role.
- **What to do:** confirm with owner whether the cheap ATTENDANCE role should punch/view its own attendance (it almost certainly should). If yes, add ATTENDANCE to those three keys' role sets.

### TRIAGE-03  (report ref: WF-2)  — Idempotency-key pruning permanently broken (`.limit().delete()`)
- **Type:** Small fix, not urgent (slow table bloat).
- **File:** `backend/middleware/idempotency.py:102`
- **What to do:** SQLAlchemy forbids `Query.delete()` after `.limit()`. Select up to N ids first (`select(IdempotencyKey.id).filter(...).limit(N)`), then `delete().where(IdempotencyKey.id.in_(ids))`. Keep the batch cap. The current bare `except` swallows the error, so pruning never runs.

### TRIAGE-04  (report ref: WF-3)  — Cash/advance (0-day) customers rejected
- **Type:** Business decision.
- **File:** `backend/routers/steel.py:837` (`_normalize_customer_payment_terms`).
- **What to do:** if the owner sells to cash/walk-in buyers, allow `payment_terms_days = 0` (only reject negatives). Confirm intended rule first.

### TRIAGE-05  (report ref: S3 / ops)  — Windows non-atomic rename in OCR jobs persist + Excel export
- **Type:** Small, safe.
- **What to do:** replace `os.rename()` / `Path.rename()` with `os.replace()` (atomic overwrite on Windows) in the OCR jobs persistence path (`exports/ocr_jobs/_ocr_jobs_persist.tmp -> .json`; `test_ops_alerts.py` `FileExistsError [WinError 183]`). Separately fix the empty-column-name bug in `test_excel_export_engine.py`'s export engine.

---

## SUGGESTED EXECUTION ORDER (checklist for the agent)

```
[ ] FIX-01  steel.py:4033  drop taxable_amount kwarg                 (1 line,  LOW risk)
[ ] FIX-02  steel.py imports  add os + logging + logger              (3 lines, LOW risk)
[ ] FIX-03  steel_intelligence.py:506  created_at -> counted_at      (1 word,  LOW risk)
[ ] FIX-04  main.py:362  remove duplicate /notifications prefix      (1 line,  LOW risk) + FE check
[ ] FIX-05  3 routes  admin.billing.quota.reset -> production.analytics.view (MED-LOW; needs FIX-01 to test)
[ ] FIX-06  settings.py:450  try/except around template normalize    (LOW-MED risk)
[ ] FIX-07  5 sites  add db=db to check_rate_limit                   (MED-LOW; follow ai.py:392)
[ ] DECISION-01 / TRIAGE-01..05  — require owner input or deeper triage
```

**After Tier 1 + Tier 2**, run the full suite (`pytest -q`) and compare against the **969 passed / 140 failed** baseline — S0-1 (FIX-01) alone should flip ~30 tests green, and the rest of Tier 1/2 clears most owner-facing blockers.

## FASTEST-TO-FIX SUMMARY (direct answer)
The four **fastest and safest** — literally 1–3 lines each, zero risk of breaking anything, and each kills a ship-blocker — are, in order:
1. **FIX-01** (S0-1) — unblocks ALL invoicing (+ ~30 tests). Best ROI in the whole codebase.
2. **FIX-03** (AN-1) — unblocks ALL steel anomaly/fraud + owner + decision dashboards (1 word).
3. **FIX-02** (WF-1) — unblocks ALL dispatch + gate-pass (3 import lines).
4. **FIX-04** (WF-5) — unblocks the notifications feature (1 line; just re-check the front-end path).

Do those four first — they clear the biggest owner-facing blockers with the least code and the least risk.
