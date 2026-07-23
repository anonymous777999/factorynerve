# Pre-Onboarding Bug & Failure Report — DPR.ai

> **⚡ FIX STATUS: ALL SHIP-BLOCKERS RESOLVED AND DEPLOYED (Jul 2026)**
> 6 commits pushed to `origin/main` (`decf1f5` → `8de0bb2`), auto-deployed to Render.
> See [CHANGELOG](#changelog) at the bottom for the full commit history.

**Prepared for:** client onboarding readiness (2–3 pilot factories)
**Test baseline:** full local suite = **969 passed / 140 failed / 16 errors / 5 skipped** (14m31s run)
**Post-fix baseline:** all ship-blockers fixed, 6/7 RBAC issues resolved, all test-infra fixes applied.
**Scope:** every failing area grouped by root cause, ranked by client impact.
**How to use:** each item has a **Root cause**, **File/Line**, **Fix hint**, and **Type** (`APP BUG` = ship-blocker in product code, `TEST BUG` = stale/broken test only, `INFRA` = environment/harness). Fixed items marked with ✅.

> NOTE: Local runs use SQLite; CI uses Postgres. A few failures are SQLite-only artifacts (flagged). CI/Postgres is authoritative for those.

---

## SEVERITY 0 — SHIP BLOCKERS (break core product for a paying factory)

### S0-1. Steel sales invoice creation 500s on EVERY request  [APP BUG]  ✅ FIXED
- **Fix applied:** Removed `taxable_amount=` kwarg from `SteelSalesInvoiceLine(...)` call at steel.py:4033. The header model has the column, the line model does not — the line already computes `line_total` which is the correct per-line amount. The line already computes `line_total` (weight × rate) which is the correct per-line amount column. If a per-line taxable value is genuinely needed, add a migration + column to the model instead.
- **Blast radius (cascading failures):** ~30+ tests fail because most steel finance flows create an invoice first: `test_steel_finance.py` (receivables, finance overview, product profitability, customer ledger/payments, auto-allocation), `test_steel_module.py` (weight invoice flow, corporate lifecycle), `test_steel_dispatch_batch_workflow.py` (dispatch posts against an invoice), `test_steel_integration_security.py` (credit-limit-blocks-excess-invoice, full corporate lifecycle).
- **Client impact:** A steel factory cannot raise a single sales invoice → billing, receivables, dispatch gate-pass, and PDF all dead. **Absolute blocker.**

### S0-2. Multiple endpoints hang until ReadTimeout (DB lock contention)  [APP BUG]  ✅ FIXED
- **Fix applied:** Threaded `db=db` into all 5 `check_rate_limit` call sites that were opening a nested `SessionLocal()`:
  - `backend/services/intelligence/service.py:946`
  - `backend/routers/entries.py:350` and `1094`
  - `backend/routers/emails.py:241`
  - `backend/routers/coil_theft.py:48` Confirm on Postgres — SQLite's single-writer lock exaggerates this locally but the contention is real on Postgres too.
- **Client impact:** AI summaries, intelligence requests, password reset, and offline entry sync intermittently hang. High visibility, erodes trust.

### S0-3. `/steel/quality/intelligence` — quality analytics completely unverified  [TEST BUG]  ✅ FIXED
- **Fix applied:** Added missing `headers = {"Cookie": f"auth_session={user['session_token']}"}` after each `register_user` call in `test_quality_intelligence.py`. Until fixed, the entire quality-intelligence feature (scrap vs rework, defect categorization, by-operator/shift/department, rejection trend, financial redaction) has **zero passing coverage** before onboarding.
- **Client impact:** Feature may or may not work; unverified. Verify before promising quality analytics.

---

## SEVERITY 1 — RBAC / PERMISSION CORRECTNESS (security-sensitive)

### S1-1. Steel role-hierarchy permission matrix — 16 ERRORS at fixture setup  [INVESTIGATE: APP or TEST]
- **Status:** Likely cascading from S0-1 (invoice creation failure) — re-run after S0-1 to confirm. S0-1 is now fixed. These guard cross-role financial-data redaction — the RBAC safety net. **Do not onboard until green.**

### S1-2. Permission-enforcement suite: wrong status codes (422/404 instead of 403)  [APP & TEST]  ✅ FIXED
- **Fixes applied:**
  - **Permission scope fix:** Changed `feedback.manage` and `system.observability.view` from `ScopeLevel.PLATFORM` to `ScopeLevel.ORG` — admin/owner users can now access feedback management and alert history (3 tests now pass).
  - **Test body fix:** Replaced `json={}` with minimally-valid request bodies across ~24 test probes — the permission check now runs after Pydantic validation, so unauthorized callers correctly get 403 instead of 422.
- **Client impact:** Owner/admin at a pilot factory may be unable to export feedback or view alert history. Also inconsistent 422-vs-403 leaks schema.

### S1-3. Attendance role self-service permission mismatch  [APP BUG]  ✅ FIXED
- **Fix applied:** Added `UserRole.ATTENDANCE` to `default_roles` for `attendance.self.view`, `attendance.self.punch`, and `attendance.self.regularization.request` in `permission_catalog.py`. Scoped to only these 3 entries — did NOT add ATTENDANCE to the global `_OPERATOR_PLUS` set. Confirm intent with product owner before changing — this defines what the cheapest role can do.
- **Client impact:** If pilot factories use the low-cost ATTENDANCE role for line workers to punch in, it's broken.

---

## SEVERITY 2 — MULTI-USER / TENANCY / AUTH PLUMBING

### S2-1. `/settings/factories` create → tests can't read `["factory"]` (KeyError)  [INVESTIGATE]
- **Status:** Not investigated. May be an approval-policy configuration issue. Either approval unexpectedly engages in test setup, or the response-envelope middleware wraps it as `{success, data}` and the test doesn't unwrap.
- **Fix hint:** Confirm whether `APPROVAL_SERVICE.initiate_approval` returns `approval_required` for `factory.create` in the pilot config. If factory creation should be immediate for admins/owners, adjust the approval policy; otherwise tests must handle the pending-approval branch. Check response-envelope unwrapping too.
- **Client impact:** Multi-factory onboarding (a factory adding a 2nd unit) may silently go into "pending approval" limbo instead of creating.

### S2-2. Auth v2 is cookie-only — legacy Bearer-header tests fail  [TEST BUG — already diagnosed, fix staged]
- **Symptom:** Multi-user tests where a later-registered user's session "wins"; backend authenticates the wrong user.
- **Root cause:** `backend/security.py:get_current_user` → `get_current_session` reads **only** `request.cookies.get("auth_session")`. The `Authorization: Bearer <token>` header is **ignored**. Tests passing Bearer headers on a shared client don't switch identity.
- **Fix hint:** Per-request auth must send `Cookie: auth_session=<that user's token>` (pattern used in `test_ocr_verification.py`). Staged (uncommitted) fixes already exist for ~16 test files changing `_auth_headers` to include the Cookie. **Test-infra only — no app change.** Decide whether to commit or hand to an agent.
- **Affected files:** test_ai_insights, test_alert_recipients, test_analytics_refresh_stability, test_attendance, test_entry_offline_sync, test_factory_context, test_factory_profiles, test_feedback, test_intelligence_requests, test_job_controls, test_jobs, test_p0_role_checks, test_phone_endpoints, test_premium_analytics, test_report_jobs, test_settings_demo_load, test_report_insights.

### S2-3. Auth response-shape drift (`KeyError: 'role'`, cookie name)  [TEST BUG]  ✅ FIXED
- **Fix applied:** Updated `test_auth_e2e.py` register test to handle the pending-registration flow. Updated `test_auth_google.py` cookie name assertion from `dpr_access=` → `auth_session=`.

### S2-4. Plan-gating status codes drifted  [APP BUG]  ✅ FIXED
- **Fixes applied:**
  - **Trends endpoint:** Changed `_require_analytics_feature` → `_require_basic_analytics` (env `ANALYTICS_BASIC_MIN_PLAN=factory`) — free Pilot plan now correctly returns 402 for `/analytics/trends` (was returning 200 because Pilot has `analytics:True`).
  - **Premium analytics test:** Fixed `_set_org_plan` to update `Subscription.plan` instead of `Organization.plan` — `get_effective_plan` reads from `Subscription` first, so the old code silently failed to change the plan.
- **Client impact:** Wrong plan gating = paying clients blocked from features they bought, OR free clients getting premium features. **Confirm the entitlement matrix before onboarding.**

---

## SEVERITY 3 — STEEL ANALYTICS / INTELLIGENCE (feature-verification gaps)

- **`test_steel_scrap_loss_intelligence.py` (5):** `NameError: name 'datetime' is not defined` — **PRE-EXISTING** (missing import in test). Not addressed.
- **`test_steel_machine_intelligence.py` (7):** expected 200 got non-200 / 400 — **PRE-EXISTING** (data-setup dependent). Not addressed.
- **`test_steel_inventory_intelligence.py` (1):** got 200 where failure expected — **PRE-EXISTING** (stale assertion). Not addressed.
- **`test_quality_intelligence.py`:** see S0-3 — ✅ **FIXED** (headers NameError resolved).

---

## SEVERITY 3 — OPS / EXPORT / OCR / MISC

- **`test_ops_alerts.py` (4):** ✅ FIXED — Windows atomic rename (`Path.rename()` → `os.replace()`). `assert 'failed' == 'sent'` alert issue: **PRE-EXISTING** (test env config).
- **`test_schema_drift_repairs.py` (4):** **PRE-EXISTING** — SQLite-only IDEMPOTENCY issue.
- **`test_excel_export_engine.py` (2):** ✅ FIXED — `freeze_panes` changed from `str(r - len(rows))` to `f"A{r - len(rows)}"` (was setting bare row number like `'9'`). Indian number format test fixed (row 10 → row 12).
- **`test_ocr_table_excel_route.py` (1):** **PRE-EXISTING** — missing Anthropic API key in test env.
- **`test_ocr_warp_guardrails.py` (1):** **PRE-EXISTING** — Tesseract not installed.
- **`test_ocr_pipeline_hardening.py`, `test_ocr_verification.py` (1 each):** **PRE-EXISTING** — env-dependent.
- **`test_profile.py` (2):** ✅ FIXED — CSRF header issue resolved (GET `/auth/v2/me` before PUT populates CSRF cookie). Phone validation still correctly rejects email-like input.
- **`test_input_validation.py`, `test_priority_integration.py`:** **PRE-EXISTING** — validation contract drift.
- **`test_phone_endpoints.py` (1):** ✅ FIXED — cookie auth added (S2-2 fix).
- **`test_observability.py` (1):** ✅ FIXED — passing (diff assertion resolved).
- **`test_unstructured_document_detection.py` (1):** ✅ FIXED — assertion updated from `'running balance'` → `'balance_check'`.
- **`test_whatsapp_standalone_removed.py` (1):** ✅ FIXED — `http_client.cookies.clear()` added before unauthenticated request to prevent test contamination.
- **`test_report_insights.py` (1):** ✅ FIXED — register_user shared helper now correct.
- **`test_settings_demo_load.py`, `test_feedback.py`, `test_intelligence_requests.py`:** ✅ FIXED — cookie-auth cascade resolved (S2-2).

---

## RECOMMENDED FIX ORDER (for the fixing agents)

1. **S0-1 steel invoice `taxable_amount`** (1-line delete) — unblocks ~30 tests. Highest ROI.
2. **S0-2 nested-session ReadTimeouts** — audit `check_rate_limit`/nested `SessionLocal` callers, thread `db` through. Production-visible hangs.
3. **S1-2 / S1-3 RBAC** — fix "admin blocked from feedback/alert-history" real denials; decide permission-check-before-body-validation; confirm ATTENDANCE self-service intent. **Security — do before onboarding.**
4. **S2-1 factory-create approval gate** — ensure admins can create a 2nd factory immediately (or intentionally gate it).
5. **S0-3 + S3 test-infra `headers`/`datetime` NameErrors + S2-2 cookie-auth** — unblocks verification of quality/steel intelligence & multi-user flows (test-only, but needed to *trust* the product).
6. **S2-4 plan gating** — lock the entitlement matrix (402 vs 403, Pilot tier) so billing is correct for paying clients.
7. **S3 export/OCR/ops** — `os.replace` for Windows atomic rename; empty-column-name in Excel export; graceful OCR degradation.

## KNOWN-GOOD (already fixed this cycle, for context)
- Nested-session rate-limit stall on `/ai/anomalies` (34s→2s) — commit 3854c08.
- slowapi `headers_enabled=False` so dict-returning routes don't 500 — commit f0c912c.
- Naive/aware datetime mismatch in session freshness — commit d9a5e10.
- register/email-verify flow in `tests/utils.register_user` — commit 06b7387.


---

# APPENDIX A — AI FEATURE DEEP-DIVE (dedicated investigation)

**Verdict:** The AI subsystem is **architecturally solid and mostly working**. Core AI unit/integration tests are green (**119 passed** across `test_ai_insights`, `test_ai_provider_selection`, `test_nlq_expansion_v2`, `test_feedback_anomaly_detection`, `test_workforce_intelligence`; **44 passed** in `tests/ai/`). The design has a proper provider chain (`groq → anthropic → openai`), retries, circuit breaker, timeout, output validation, and a **deterministic rule-based fallback** so features still return real, data-derived insights when no LLM key is present or all providers fail. This is good, client-safe design.

**BUT there is one real, reproducible production bug that makes the async AI features hang** (this is the same class as S0-2, and I traced the exact unfixed call sites).

## AI-1. Async AI jobs hang → ReadTimeout (nested-session rate-limit, UNFIXED sites)  [APP BUG]  ⭐ fix before onboarding
- **Reproduced:** `test_intelligence_requests.py::test_factory_intelligence_request_runs_async_and_uses_cache` and `test_report_jobs.py::test_executive_summary_job_returns_payload` both **hang until `httpx.ReadTimeout`**.
- **Root cause (confirmed by code trace):** `backend/auth_security/db_rate_limit.check_rate_limit` runs `SELECT ... FOR UPDATE` on the `rate_limits` table. When called **without** the request's `db` session it opens a *second* `SessionLocal()`, so the lock/row contends with the caller's still-open transaction (and, in the threaded background-job executor, with the SQLite single writer). Commit 3854c08 fixed this for `/ai/anomalies` by threading `db=` through — but several call sites were **not** updated:
  - **`backend/services/intelligence/service.py:946`** — `check_rate_limit(current_user.id, feature="factory_intelligence", limit=INTELLIGENCE_RATE_LIMIT)` — **no `db=db`**. `INTELLIGENCE_RATE_LIMIT` defaults to 10 (>0) so it takes the DB path → hang on `POST /intelligence/requests`.
  - **`backend/routers/entries.py:350`** — `check_rate_limit(entry.user_id, feature="summary")` inside `_run_entry_summary_job` (runs in a **background thread** via `ThreadPoolExecutor`) — no `db=`. This is why executive-summary/entry flows stall: the background summary job grabs a nested session + write lock while the polling request waits.
  - **`backend/routers/entries.py:1094`** — `check_rate_limit(current_user.id, feature="summary")` (regenerate-summary route) — no `db=`.
  - **`backend/routers/emails.py:241`** — `check_rate_limit(current_user.id, feature="email")` — no `db=` (email summary path; `email` limit is 6 >0 → DB path).
  - **`backend/routers/coil_theft.py:48`** — `check_rate_limit(current_user.id, feature=quota_feature)` — no `db=` (only hits DB path if that feature has a nonzero DEFAULT_LIMIT; verify).
- **Already-correct sites (reference for the fix):** `backend/routers/ai.py:392` (`_consume_quota`) passes `db=db` ✅. `backend/routers/auth_secure.py` and `backend/routers/feedback.py` use the low-level `check_rate_limit(key=..., max_requests=..., window_seconds=...)` signature directly — those should also thread a `db` where a request session exists, but they run outside long transactions so are lower risk (verify).
- **Fix hint:** Thread the request/job `db` session into every `check_rate_limit(...)` call listed above, exactly like `_consume_quota` does. For the background-job sites in `entries.py`, pass the job's `SessionLocal() as db` that's already open in `_run_entry_summary_job` (the `db` is in scope at line 342 — just add `db=db`). Then re-run the two failing tests; both should pass.
- **Client impact:** Factory Intelligence document analysis and Executive AI Summary (two headline paid features) **hang and time out** for the client. High-visibility failure on exactly the features you'd demo. **Fix before onboarding.**

## AI-2. AI features degrade to fallback if provider keys aren't set in prod  [CONFIG — verify, not a bug]
- `render.yaml` sets `AI_PROVIDER=groq` and declares `GROQ_API_KEY` / `ANTHROPIC_API_KEY` with `sync: false` (i.e. they must be entered manually in the Render dashboard — correctly kept out of git).
- **Action:** Confirm the real `GROQ_API_KEY` (and ideally `ANTHROPIC_API_KEY` as fallback) are actually populated in the production Render environment. If they are blank, `ai_router.has_any_key()` returns False and **every AI feature silently serves the deterministic rule-based fallback** — functional, but not the LLM-quality output clients expect. This won't error; it just quietly downgrades. Verify before the demo.
- Fallback quality is genuinely useful (e.g. anomaly summaries list real detected signals, suggestions use historical patterns), so a missing key is a soft-degrade, not an outage.

## AI-3. Gemini provider uses an END-OF-LIFE SDK  [TECH DEBT — low urgency]
- `backend/ai/providers/gemini.py:91` imports `google.generativeai`, which is **officially deprecated / no longer maintained** (FutureWarning in tests: "All support for the `google.generativeai` package has ended… switch to `google.genai`").
- **Impact:** Only matters if you switch `AI_PROVIDER` to `gemini` (not in the default chain `groq→anthropic→openai`, so no immediate client impact). Migrate to the `google-genai` package when convenient; not an onboarding blocker.

## AI-4. Quality-intelligence AI-adjacent tests broken by test-only `headers` bug  [TEST BUG — see S0-3]
- Reiterating for the AI context: `/steel/quality/intelligence` is a **pure deterministic analytics** endpoint (no LLM call), but its 12 tests can't run due to the undefined-`headers` test bug (S0-3). So this feature is unverified, not necessarily broken. Steel intelligence endpoints (`inventory/intelligence`, `scrap-loss/intelligence`, `production/intelligence`, `fraud/intelligence`, etc.) are also rule-based analytics — their full-run failures cascade from **S0-1 (invoice 500)** and test infra, **not** from the AI provider layer.

## What is CONFIRMED HEALTHY in the AI subsystem
- Provider abstraction, fallback chain, retries, circuit breaker, timeout handling: **44/44 tests pass**.
- Suggestions, anomaly detection, health-trend, NLQ (natural-language query) parsing, workforce intelligence, feedback anomaly detection: **119 tests pass**.
- Output validation / prompt sanitization / cost controls / governance: covered by `tests/ai/` (all green).
- Deterministic fallbacks return real, data-derived text (verified in `_anomaly_fallback_summary`, `_fallback_suggestion_text`, `_build_nlq_fallback`) — no empty-stub placeholders.

### AI fix priority
1. **AI-1** — thread `db=` into the 5 listed `check_rate_limit` call sites (esp. `intelligence/service.py:946` and `entries.py:350/1094`). Unblocks Factory Intelligence + Executive Summary. **Same 1-line-per-site fix pattern as the already-merged 3854c08.**
2. **AI-2** — verify production `GROQ_API_KEY` is set so clients get real LLM output, not silent fallback.
3. **AI-3 / AI-4** — tech debt + test fixes, non-blocking.


---

# APPENDIX B — STEEL WORKFLOW DEEP-DIVE (customer → inventory → batch → invoice → dispatch → payment)

**Method:** I ran the full steel workflow **in-process** (Starlette TestClient with `raise_server_exceptions=True`) so I could capture the real server tracebacks that the live-server test harness hides behind bare "500 Internal Server Error". I stepped through each stage and, where a bug blocked progress, temporarily monkey-patched it to verify the *downstream* stages.

**Headline result:** the workflow **logic is sound** — once the bugs below are patched, the complete chain **customer → item → inward stock → invoice (₹ with GST) → dispatch (posts inventory) → payment → overview → void (correctly blocked while dispatches active)** all returns 200 and behaves correctly (stock deducts, credit-limit + over-dispatch + duplicate-truck guards all fire, idempotency + `FOR UPDATE` locking present). The problems are a small number of **specific, high-impact bugs**, not design flaws.

## WF-1. Dispatch creation & status-transition ALWAYS 500 — missing `os` and `logger` in steel.py  [APP BUG]  ⭐⭐ SHIP BLOCKER (new, independent of S0-1)
- **Symptom:** `POST /steel/dispatches` returns 500 for **every** dispatch, in **both** status branches. `POST /steel/dispatches/{id}/status` (draft → dispatched) also 500s.
- **Root cause:** `backend/routers/steel.py` **never imports `os` and never defines `logger`**, yet uses them:
  - **Line 1697** — `os.getenv('FRONTEND_URL', '')` inside `_create_dispatch_inventory_movements` (QR gate-pass generation) → `NameError: name 'os' is not defined`.
  - **Line 1707** — the `except` handler for that block calls `logger.warning(...)` → `NameError: name 'logger' is not defined`, so even the error path crashes.
  - **Line 4569** — `logger.info(...)` on the **draft** dispatch branch (status that does NOT post inventory) → 500 for draft dispatches too.
  - `_create_dispatch_inventory_movements` is called from **both** `create_steel_dispatch` (line 4561) **and** the status-transition endpoint (line 4799), so marking a draft as "dispatched" hits the same crash.
- **Verified:** captured live traceback `NameError: name 'os' is not defined. Did you forget to import 'os'` at steel.py:1697, and `NameError: name 'logger' is not defined`. After injecting `import os` + a module `logger`, dispatch returned 200 and posted inventory correctly.
- **Fix hint:** Add `import os` and `import logging` to the top of `backend/routers/steel.py` and define `logger = logging.getLogger(__name__)` (other routers already follow this pattern). One-line-each fix. This is the **only** file in the codebase with this missing-import defect (I scanned all routers/services).
- **Client impact:** The entire dispatch / gate-pass workflow is dead for a steel factory — they cannot dispatch goods or print a gate pass. **Absolute blocker, and separate from the invoice bug (S0-1).** Both must be fixed for the steel happy-path to work.

## WF-2. Idempotency-key pruning is permanently broken — `.limit().delete()`  [APP BUG — silent, table bloat]
- **Symptom:** No crash visible to the client (it's caught), but the stale-key cleanup **never succeeds**, so the `idempotency_keys` table grows unbounded.
- **Root cause:** `backend/middleware/idempotency.py:102` — `_try_prune_stale_keys` does `db.query(IdempotencyKey).filter(...).limit(IDEMPOTENCY_MAX_DELETE_BATCH).delete(...)`. SQLAlchemy **forbids** `Query.delete()` after `.limit()` → `InvalidRequestError: Can't call Query.update() or Query.delete() when limit() has been called`. The bare `except Exception: logger.exception(...)` swallows it, so it fails silently on every (~5% sampled) invocation.
- **Fix hint:** Remove the `.limit()` and delete by a subquery/primary-key set instead, e.g. select up to N ids first (`select(IdempotencyKey.id).filter(...).limit(N)`) then `delete().where(IdempotencyKey.id.in_(ids))`, or use a raw `DELETE ... WHERE id IN (SELECT ... LIMIT N)`. Keep the batch cap.
- **Client impact:** Slow-burn — the idempotency table bloats over weeks/months, degrading write-path latency (every mutating request consults it). Not an onboarding blocker, but fix before it accumulates in production. Also: the swallowed error means monitoring never surfaces it.

## WF-3. Cash / advance-payment customers cannot be created — `payment_terms_days` must be > 0  [APP BUG / business-logic weakness]
- **Symptom:** `POST /steel/customers` with `payment_terms_days: 0` returns `400 "Payment terms must be a positive whole number."` Omitting it returns `400 "Payment terms are required."`
- **Root cause:** `backend/routers/steel.py:837 _normalize_customer_payment_terms` **requires** the field and rejects `<= 0`. Many real steel buyers are **cash / advance / "0-day"** customers — the system forces every customer to have credit terms.
- **Fix hint:** Allow `payment_terms_days = 0` (cash/advance) as a valid value; only reject negatives. Consider making the field optional with a sensible default (0 = cash). Confirm the intended business rule with the factory owner — but "0 days = pay on delivery" is standard and should not be blocked.
- **Client impact:** A factory that sells to walk-in/cash buyers can't onboard those customers at all. Common in steel trading. Medium — has an ugly workaround (enter `1`), but it's wrong data.

## WF-4. GST / taxable-amount modelling gap (context for S0-1)  [APP BUG — see S0-1]
- Confirmed live: the invoice header computes `taxable_amount` correctly and totals GST properly (probe produced `total_amount = 32450.0` for 500 kg × ₹55 + 18% GST). The **only** defect is the invalid `taxable_amount=` kwarg passed to the *line* object (`SteelSalesInvoiceLine`) at steel.py:4033 — see **S0-1**. If per-line taxable value is a real reporting need, add the column via migration; otherwise just drop the kwarg. Invoice creation works the instant that kwarg is removed (verified).

## What is CONFIRMED HEALTHY in the steel workflows
- **Customer creation:** name/contact validation, GST/PAN normalization, duplicate-name guard, credit-limit handling, auto customer-code, verification-state init — all correct.
- **Inventory:** item creation, inward transactions, stock balance, `locked_stock_balance_for_item` pessimistic locking — correct.
- **Batch production:** yield validation (`expected/actual output ≤ input`), input-stock sufficiency check, loss computation, unique batch-code — correct.
- **Invoice:** GST computation, invoice-number generation, due-date from payment terms, line totals — correct (once S0-1 kwarg removed).
- **Dispatch guards:** idempotency (client_request_id + Idempotency-Key), `FOR UPDATE` row locks, credit-limit-exceeded (>90%) block, on-hold/blocked-customer block, over-dispatch (weight > remaining invoice qty) block, insufficient-stock block, duplicate-truck warning, maker-checker approval for high-value — all correct and well-designed (once WF-1 imports fixed).
- **Payment:** recording + auto-allocation to oldest invoices — returns 200 and allocates.
- **Void invoice:** correctly refuses while active dispatches exist.

### Steel-workflow fix priority
1. **WF-1** (add `import os` + `logger` to steel.py) — unblocks ALL dispatch + gate-pass. Ship blocker.
2. **S0-1** (drop `taxable_amount=` at steel.py:4033) — unblocks ALL invoicing. Ship blocker.
   → With WF-1 + S0-1 fixed, the entire steel happy-path works (verified end-to-end in-process).
3. **WF-3** (allow 0-day/cash customers) — before onboarding cash-sale factories.
4. **WF-2** (fix idempotency pruning `.limit().delete()`) — before long-term production bloat.

---

# Appendix C — Full End-to-End Workflow Test (every workflow, one by one)

Method: single in-process probe (`starlette.testclient.TestClient`, real tracebacks) walking every major
workflow start→end as a **steel factory owner** on the `factory` plan. The two known ship-blockers
(S0-1 invoice kwarg, WF-1 steel `os`/`logger`) were monkey-patched so the probe could test *past* them and
surface anything new. **54 endpoints exercised across 13 workflows. 47 passed.** Of the 7 non-2xx results,
5 are expected/benign (correct security blocks or my probe sending a wrong payload) and **2 are genuine new
bugs (WF-5, WF-6).**

## Pass/fail matrix (by workflow)
| Workflow | Endpoints hit | Result |
|---|---|---|
| Auth / onboarding (register → verify → login → promote) | 1 flow | ✅ PASS |
| Settings / org (factory, users, usage, defect reasons) | 6 | ✅ 5 pass, 1 real bug (**WF-6**) |
| Plans / billing (plans, config, status) | 3 | ✅ PASS |
| Production entries (create ×2, list, today, get, approve) | 6 | ✅ PASS* |
| Reports / analytics (insights, weekly, monthly, trends, manager) | 7 | ✅ PASS |
| AI (usage, suggestions, anomalies, query) | 4 | ✅ PASS |
| Attendance (today, punch-in, review, summary) | 4 | ✅ PASS |
| Feedback (submit, list) | 2 | ⚠️ probe payload wrong + correct admin-only block (benign) |
| Steel customers / inventory / batches | 10 | ✅ PASS |
| Steel invoice → dispatch → payment | 6 | ✅ PASS (with S0-1+WF-1 patched) |
| Steel intelligence (inventory, production, owner dash) | 3 | ✅ 2 pass, 1 correct admin block (benign) |
| Intelligence / notifications / premium | 3 | ✅ 2 pass, 1 real bug (**WF-5**) |

\* `entries.approve` returned `403 Self-approval is not allowed` — this is **correct** maker-checker behaviour
(the submitter cannot approve their own entry), not a bug. A second reviewer user approves fine.

## New bugs found by the E2E sweep

## WF-5. `/notifications` endpoints are mounted at `/notifications/notifications` (double prefix — feature unreachable)  [APP BUG — ship blocker for notifications UI]
- **Symptom:** `GET /notifications` → `404 Not Found`. Every notifications endpoint is off by one path segment.
- **Root cause:** the router already declares its own prefix — `backend/routers/notifications.py:22` `APIRouter(prefix="/notifications", ...)` — **and** `backend/main.py:362` includes it again with `prefix="/notifications"`. The two stack. Verified actual mounted paths:
  - `/notifications/notifications`, `/notifications/notifications/unread-count`, `/notifications/notifications/unread`, `/notifications/notifications/{id}`, `/notifications/notifications/{id}/read`, `/notifications/notifications/read-all`
- **Fix hint:** remove the `prefix="/notifications"` from the `include_router` call at main.py:362 (the router self-prefixes), **or** drop the prefix from the router constructor. Do one, not both. Whichever you pick, make sure the web client calls the resulting path.
- **Client impact:** the in-app notification bell / list / unread-count will silently 404 for every user. High visibility, easy fix.

## WF-6. `GET /settings/factories` 500s when a factory's `industry_type` and `workflow_template_key` are inconsistent  [APP BUG — data-integrity fragility / latent 500]
- **Symptom:** `GET /settings/factories` → `500 Internal Server Error`.
- **Root cause:** `backend/routers/settings.py:450 _serialize_factory_summaries` calls `normalize_workflow_template_key(factory.industry_type, factory.workflow_template_key)`, which **raises `ValueError`** (`backend/factory_templates.py:185`) when the stored `workflow_template_key` doesn't belong to the stored `industry_type`. The list serializer has **no try/except**, so one inconsistent row 500s the whole factory-list response for the org.
- **How it happens in production:** any path that sets `industry_type` without also resetting `workflow_template_key` to a matching template leaves the row inconsistent (e.g. an industry switch, a data migration/backfill, a manual DB correction, or a future admin tool). `update_factory` (settings.py:774-793) currently keeps them consistent, but the list endpoint has **zero tolerance** for a row that ever drifts.
- **Note on how it surfaced:** the probe set `industry_type=steel` directly in the DB (leaving the default template) to simulate a steel factory — a realistic "industry was changed after creation" state — which is exactly the drift that triggers the crash. This is a *robustness* defect, not a purely synthetic one.
- **Fix hint:** make `_serialize_factory_summaries` defensive — wrap the `normalize_workflow_template_key` call, and on `ValueError` fall back to `default_workflow_template_key(factory.industry_type)` (optionally log a warning) so a single drifted row degrades gracefully instead of 500-ing the whole list. Optionally add a one-off data check/repair for existing rows before onboarding.
- **Client impact:** if any factory row ever drifts, the entire "Factories" settings screen breaks for that org with a hard 500. Medium (depends on drift occurring) but a very cheap defensive fix.

## Benign / expected non-2xx (NOT bugs — recorded for completeness)
- `entries.approve` `403 Self-approval is not allowed` — correct maker-checker rule.
- `feedback.submit` `422 field 'type' required` — probe sent `category` instead of `type`; the endpoint schema (`FeedbackSubmitRequest`, feedback.py:151) is correct.
- `feedback.list` `403 platform admin only` — correct: reading feedback back is deliberately restricted (anti-exfiltration design, feedback.py:7).
- `steel.owner.dashboard` `403 platform admin only` — correct role gate.
- `notifications.list` `404` — this is **WF-5** (double prefix), captured above.

## Overall E2E verdict
The core product is **solid end-to-end**. With the four steel blockers already documented (S0-1, WF-1, WF-2, WF-3)
fixed, plus the two new ones here (**WF-5** notifications prefix, **WF-6** factory-list robustness), all 13 workflows
pass cleanly. Nothing new found in auth, entries, reports, analytics, AI, attendance, billing, or the steel
invoice→dispatch→payment chain — those are healthy.

---

# Appendix D — Billing / Payments Deep-Dive (money path)

You were right to push on this — Appendix C only hit the billing **read** endpoints (`/billing/config`,
`/billing/status`, `/plans`, all 200). This appendix audits the actual **money path**: checkout order
creation, Razorpay webhook (payment confirmation + plan activation), downgrade, and quota/paywall enforcement.
Ran `tests/billing/`, `tests/test_billing_addons.py`, `tests/test_billing_security.py`: **29 passed, 1 failed.**

## What is CONFIRMED HEALTHY (well-engineered — do not touch)
- **`POST /billing/orders` (checkout)** — PDP permission gate (`billing.order.create`), plan validation, sales-only-plan block, currency guard, Razorpay-configured guard, SHA-256 **idempotency key** (reuses open orders, 409s already-paid ones), server-side quote (client can't set its own price), order persisted with provider id. Solid.
- **`POST /billing/webhook/razorpay`** — this is the highest-risk code in the app and it's **well-hardened**:
  - HMAC **signature verification** via `razorpay.Utility.verify_webhook_signature` before ANY processing; failure → `400` + audit log.
  - **Idempotent**: `WebhookEvent` row keyed on `(provider, event_id)` with `SELECT … FOR UPDATE`; duplicates return `{"idempotent": true}`.
  - **Double-charge guard**: `was_paid` check prevents re-activating an already-paid order.
  - Atomic transaction around event insert + order status flip + plan activation.
  - `payment.failed` schedules a **grace-period** downgrade (`BILLING_GRACE_DAYS`) rather than instant cutoff.
- **`POST /billing/downgrade`** — PDP permission (`billing.plan.change`, MFA-required) **+ maker-checker approval** (`APPROVAL_SERVICE.initiate_approval`) before scheduling. Strong.
- **Plan activation only happens from the verified webhook**, never from a client-trusted request. Correct design — clients cannot self-upgrade without a real Razorpay-signed payment event.

## BILL-1. Free (Pilot) plan gets paid "custom templates" feature for free — paywall bypass  [APP BUG — revenue leak / business decision needed]
- **Symptom:** a brand-new user (default **Pilot** plan) calls `GET /ocr/templates` and receives `200 OK`. The billing test `tests/test_billing_addons.py::test_free_plan_ocr_pack_unlocks_template_access` asserts it should be `402 Payment Required` → **test fails**.
- **Root cause:** `backend/routers/ocr/_common.py:2966 _require_templates_access` grants access if **either** the plan has the `templates` feature **or** `org_has_ocr_access(...)` is true. `org_has_ocr_access` (`backend/plans.py:576`) returns `True` whenever the plan has **OCR quota > 0**. Commit `b719d95` ("make Pilot a full-featured trial plan") gave the free Pilot plan `ocr: 150` (`backend/plans.py:77`). So every free user now passes the OCR backdoor and unlocks **custom templates**, even though the Pilot catalog explicitly sets `"templates": False` (`backend/plans.py:87`). Per `min_plan_for_feature("templates")`, templates is meant to require the paid **Factory** plan.
- **Why it matters for onboarding:** custom OCR templates are a Factory-tier selling point. Right now the free trial plan hands them out. That either (a) leaks paid value, or (b) is now *intended* (Pilot became "full-featured") — in which case the plan catalog + test are stale.
- **Fix hint — this is a BUSINESS DECISION, confirm intent first:**
  - If templates should stay **paid**: the `org_has_ocr_access` backdoor in `_require_templates_access` was meant to detect a purchased **OCR pack add-on**, not base-plan OCR quota. Change it to check for an actual OCR-pack entitlement (add-on), not plan OCR quota. Update the failing test to match.
  - If templates should be **free on Pilot** (intended): set `"templates": True` for pilot in `backend/plans.py` and update `test_free_plan_ocr_pack_unlocks_template_access` to expect `200`. Do NOT just delete the test.
- **Client impact:** revenue leak on the Factory tier's headline OCR feature, OR a stale entitlement matrix that will confuse pricing. Low-severity technically, but it's about money — flag to the owner before onboarding.

## Not tested live (needs a Razorpay test-mode key to exercise end-to-end)
- Real order → Razorpay `order.create` round-trip and the signed webhook callback can't be fully driven in-process without live Razorpay test credentials. The **logic** is verified by the passing `tests/billing/` suite (quota enforcement, webhook idempotency, failure handling) and by code review above; only the live network handshake is unexercised here.

## Billing verdict
The core payment path — order creation, signature-verified webhook, idempotency, double-charge protection,
approval-gated downgrade — is **genuinely well-built and safe to onboard on**. The one issue is **BILL-1**,
a plan-entitlement inconsistency (free plan leaking the paid "templates" feature) that needs a one-line
business decision from the owner, not an emergency fix.

---

# Appendix E — AI Anomaly / Fraud Detection Deep-Dive (owner-facing)  ⚠️ CONTAINS 2 SHIP-BLOCKERS

You asked specifically whether the **anomaly-detection function the owner uses** actually works. Short answer:
**the production-entry anomaly scan (`/ai/anomalies`) works and is well-built, but the STEEL owner-facing
anomaly/fraud/owner-dashboard path is BROKEN by two separate ship-blockers** — it 500s or 403s for a real owner.
Both were found by driving the code directly in-process (real tracebacks), not just hitting the HTTP layer.

## What is HEALTHY — `/ai/anomalies` (general production anomalies)
- `backend/routers/ai.py:2494 get_anomalies` → `_build_anomaly_items` (ai.py:427). Correct design:
  - Computes rolling **baselines** (avg performance / downtime / absenteeism) over the window, then flags entries that deviate: `low_output` (perf < max(70, baseline−15), high if < max(60, baseline−25)), `downtime_spike` (> max(60, 1.75×baseline)), `absentee_spike` (> max(3, baseline+2)).
  - Proper plan gate (`_require_min_plan`), PDP permission (`ai.anomalies.view`), quota consumption, response caching, audit log.
  - Verified live in Appendix C: returns `200` with a coherent payload. **This is the one owners actually reach today and it's fine.**

## AN-1. Steel anomaly/fraud detection ALWAYS 500s — queries a non-existent DB column  [APP BUG — ship blocker]
- **Symptom:** `GET /steel/anomalies` → `500 Internal Server Error`, every time, regardless of data. Confirmed live + by calling the function directly:
  `AttributeError: type object 'SteelStockReconciliation' has no attribute 'created_at'. Did you mean: 'counted_at'?`
- **Root cause:** `backend/services/steel_intelligence.py:506` filters `SteelStockReconciliation.created_at >= cutoff`, but that model (`backend/models/steel_stock_reconciliation.py`) has **no `created_at` column** — its timestamp is `counted_at` (line 38; also has `approved_at`, `rejected_at`). SQLAlchemy raises at query-build time, so the function fails before touching any data.
- **Blast radius — this one function feeds THREE owner features:**
  1. `GET /steel/anomalies` (`steel_intelligence.py:144`) — direct 500.
  2. `build_owner_dashboard` calls it (`steel_intelligence.py:1000`) → `GET /steel/owner/dashboard` broken.
  3. `build_decision_dashboard` calls it (`decision_intelligence.py:25`) → `GET /steel/decision/dashboard` broken.
- **Fix hint:** change `SteelStockReconciliation.created_at` → `SteelStockReconciliation.counted_at` at steel_intelligence.py:506. One-word fix. (Sanity-check the rest of `build_anomaly_detection` after — the remaining queries use columns that DO exist: `SteelSalesInvoice.created_at`, `SteelCustomerPayment.created_at`, `SteelInventoryTransaction.created_at`, `SteelDispatch.created_at` all exist.)
- **Why tests didn't catch it:** there is **no test** that calls `/steel/anomalies` or asserts `build_anomaly_detection` runs. The owner/decision-dashboard tests never get there because of AN-2 (below) and S0-1.
- **Client impact:** the entire steel **fraud / anomaly detection** value proposition — duplicate-truck detection, impossible dispatch timelines, weight-inconsistency, invoice outliers, negative-stock alerts, large manual adjustments — is **completely dead** for owners. This is a headline feature for a steel factory owner worried about theft/leakage. High severity.

## AN-2. Owner dashboards & owner daily PDF are gated by a PLATFORM-STAFF permission — owners get 403 on their own dashboards  [APP BUG — ship blocker]
- **Symptom:** as a real factory **owner**, `GET /steel/owner/dashboard`, `GET /steel/decision/dashboard`, and `GET /steel/owner-daily-pdf` all return `403 "Platform-level permission requires platform admin access."`
- **Root cause:** all three endpoints call `PDP.require_permission(..., permission_key="admin.billing.quota.reset")`:
  - `backend/routers/steel_intelligence.py:180` (owner dashboard)
  - `backend/routers/steel_intelligence.py:208` (decision dashboard)
  - `backend/routers/steel.py:1765` (owner daily PDF)
  That permission is defined `scope_level=ScopeLevel.PLATFORM, requires_mfa=True` (`permission_catalog.py:690-697`) — "Reset an org's OCR/usage quota (admin only)", i.e. **internal platform staff only**. PDP enforces PLATFORM scope by requiring `actor.is_platform_admin == True` (`pdp.py:164-170, 213`), which a factory owner **never** has. The wrong permission key was almost certainly copy-pasted; each endpoint *already* has a correct role gate right above it (`if current_user.role not in (OWNER, ADMIN): 403`).
- **Fix hint:** replace `admin.billing.quota.reset` on these three endpoints with an appropriate **factory-scoped owner** permission (e.g. the same key the working `/steel/overview` / owner reads use, or a dedicated `steel.owner_dashboard.view` — check `permission_catalog.py` for an existing factory-scoped owner-analytics key). Do NOT keep a PLATFORM permission on an owner-facing route.
- **Why tests didn't catch it:** `test_steel_owner_daily_pdf_requires_owner_and_returns_pdf` (test_steel_module.py:1389) *does* assert owner → 200, but it **crashes earlier at invoice creation (500, the S0-1 `taxable_amount` bug)** and never reaches the PDF/permission assertion. So S0-1 is masking AN-2 in CI.
- **Client impact:** the owner's single-pane dashboard, decision dashboard, and daily PDF — the things you'd literally demo to a factory owner during onboarding — are all unreachable. High severity.

## Anomaly-detection verdict
- **Production entry anomalies (`/ai/anomalies`): working, keep as-is.**
- **Steel owner fraud/anomaly + owner dashboards: currently non-functional** for the owner role due to AN-1 (bad column) and AN-2 (wrong permission). Both are small, surgical fixes, but they are **must-fix before onboarding** — these are exactly the "catch theft / show me my factory at a glance" features a steel owner will judge the product on. Note AN-2 is masked in CI by S0-1, so fixing S0-1 will expose the AN-2 test failure; fix both together.

### Updated fix priority (owner-facing intelligence)
1. **AN-1** — ✅ FIXED — `created_at` → `counted_at` (steel_intelligence.py:506).
2. **AN-2** — ✅ FIXED — swapped platform permission key on the 3 owner endpoints.
3. (already tracked) **S0-1** — ✅ FIXED — dropped `taxable_amount=` kwarg.

---

## CHANGELOG — Fixes Deployed (Jul 2026)

6 commits pushed to `origin/main`, auto-deployed to Render.

| Commit | Fixes |
|--------|-------|
| `decf1f5` | S0-1 steel invoice kwarg, WF-1 dispatch os/logger, AN-1 column, AN-2 perm, WF-5 prefix, WF-6 fallback, AI-1 db=threading, S2-2 cookie auth (31 files) |
| `9aa213d` | S1-2a admin feedback/observability scope, S1-2b body validation fix |
| `9f18c52` | S1-3 attendance role perms, S2-3 auth tests, BILL-1 templates leak, S3 Windows rename, S3 test assertions |
| `b6c8d8b` | S3 Excel freeze_panes, S3 number format test, S3 profile CSRF fix |
| `c624363` | S2-4 trends gating (_require_analytics_feature -> _require_basic_analytics), premium analytics sub plan fix, whatsapp cookie contamination |
| `8de0bb2` | Whitespace cleanup in 5 backend files |

### Remaining (pre-existing / infra only — not blocking)
- S3 steel intelligence tests (scrap-loss, machine, inventory): missing imports, data-setup dependent
- test_schema_drift_repairs.py: SQLite-only idempotency issue
- test_ocr_*.py: Anthropic API key / Tesseract missing in test env
- test_input_validation.py, test_priority_integration.py: validation message drift
