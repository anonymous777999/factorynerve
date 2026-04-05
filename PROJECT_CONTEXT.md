# DPR.ai Project Context (AI Handoff Guide)

Last updated: April 1, 2026
Audience: New AI tools/agents (ChatGPT, Claude, Codex, etc.) and new engineers.

## 0) Vision, mission, and product intent

### One-line positioning

DPR.ai is a factory-first operating system that turns daily plant work into a simple, visible, and reliable digital workflow.

### Project vision

Build the most practical daily operating system for factories, especially for real teams working with paper records, WhatsApp photos, patchy internet, and mixed levels of digital comfort.

### Project mission

Replace scattered registers, Excel sheets, follow-up calls, and disconnected tools with one product that helps workers, supervisors, managers, and owners complete daily factory work faster, with less confusion, more accountability, and better visibility.

### What success looks like

- A worker can use it without training.
- A supervisor can review and act without chasing people.
- A manager can trust what is happening on the floor in near real time.
- An owner can see production, attendance, stock, dispatch, risk, and performance in one place.
- The product still works well on mobile, on slow networks, and with messy real-world inputs.

### Product principles

- Factory-first, not SaaS-first.
- Mobile-first, because many actions happen away from desks.
- Local-language friendly, because comfort and adoption matter.
- Structured output over raw data, because people need decisions, not dumps.
- Human-guided AI, because OCR and automation fail without correction flows.
- Speed and clarity over feature overload.

## 1) What this project is

DPR.ai is a production-style factory operations SaaS platform.
It includes:
- Daily production entries
- Attendance and review flows
- OCR scanning to structured data and Excel
- Analytics and AI summaries
- Billing/plans and premium features
- Steel operations module (inventory, batches, invoices, dispatches)

Main stack:
- Frontend: Next.js 16 + React 19 (`web`)
- Backend: FastAPI + SQLAlchemy (`backend`)
- DB: SQLite by default (can run with Postgres)

## 2) Runtime topology

- Backend launcher: `run.py` -> starts `backend.main:app` via uvicorn.
- FastAPI app entry: `backend/main.py`.
- Web app entry: `web` Next.js app (`npm run dev`, `npm run build`).
- Browser API calls are proxied through `/api` to backend.

Important directories:
- `backend/routers`: all API route handlers (business endpoints)
- `backend/services`: shared business logic and background jobs
- `backend/models`: SQLAlchemy models
- `web/src/app`: Next.js route pages
- `web/src/components`: page-level and reusable UI components
- `web/src/lib`: frontend API clients and utility logic

Legacy/extra folders:
- `frontend/` exists but active web client is `web/`.

## 3) How to run locally

Backend:
- `python run.py`
  - Default host/port from env (`FASTAPI_HOST`, `FASTAPI_PORT`), usually `127.0.0.1:8765`.

Frontend:
- `cd web`
- `npm run dev`
- Open `http://127.0.0.1:3000`

## 4) Core modules and status

Status key:
- Green: broadly working in targeted tests/manual checks
- Yellow: working but with known risk/gaps
- Red: known reproducible break

### 4.1 Auth and session

Backend routers:
- `backend/routers/auth.py` (JWT-style auth)
- `backend/routers/auth_secure.py` (secure cookie sessions + MFA)
- `backend/routers/auth_google.py` (Google OAuth)

Frontend libs:
- `web/src/lib/auth.ts`
- `web/src/lib/use-session.ts`
- `web/src/lib/session-store.ts`

Current status: Yellow
- Works in targeted tests, but lint rules currently flag hooks patterns in session code.

### 4.2 Entries and approvals

Backend:
- `backend/routers/entries.py`

Frontend:
- `web/src/lib/entries.ts`
- page components in `web/src/components/*entry*`

Current status: Yellow
- Core paths exist and tested in suite, but full-suite reliability needs cleanup.

### 4.3 Attendance

Backend:
- `backend/routers/attendance.py`

Frontend:
- `web/src/lib/attendance.ts`
- attendance pages/components

Current status: Green/Yellow
- Targeted attendance test passed.
- Full-suite run shows environment/isolation instability.

### 4.4 OCR (critical area)

Backend:
- `backend/routers/ocr.py`
- `backend/ocr_utils.py` (local Tesseract OCR)
- `backend/ledger_scan.py` (AI ledger extraction)
- `backend/table_scan.py` (AI table extraction)
- `backend/services/background_jobs.py` (active shared background jobs)

Frontend:
- Route: `web/src/app/ocr/scan/page.tsx`
- Main page: `web/src/components/ocr-scan-page.tsx`
- Components:
  - `web/src/components/ocr-scan/ocr-uploader.tsx`
  - `web/src/components/ocr-scan/ocr-progress.tsx`
  - `web/src/components/ocr-scan/ocr-partial-result.tsx`
  - `web/src/components/ocr-scan/ocr-result-form.tsx`
  - `web/src/components/ocr-scan/ocr-editor.tsx`
  - `web/src/components/ocr-scan/ocr-error.tsx`
- Frontend OCR client: `web/src/lib/ocr.ts`
- Local image enhancement: `web/src/lib/image-enhance.ts`, `web/src/lib/image-enhance-client.ts`

Current status: Yellow
- UI flow is implemented and web build passes.
- Several production mismatches remain (see section 8: live risks).

### 4.5 Reports and analytics

Backend:
- `backend/routers/reports.py`
- `backend/routers/analytics.py`
- `backend/routers/ai.py`

Frontend:
- `web/src/lib/reports.ts`, `web/src/lib/analytics.ts`, `web/src/lib/ai.ts`

Current status: Yellow
- Feature-rich but test stability and plan-gating regressions need regression pass.

### 4.6 Billing/plans/premium

Backend:
- `backend/routers/billing.py`
- `backend/routers/plans.py`
- `backend/routers/premium.py`

Frontend:
- `web/src/lib/billing.ts`, `web/src/lib/plans.ts`, `web/src/lib/premium.ts`

Current status: Yellow
- Endpoints exist; full-suite has multiple failures.

### 4.7 Steel module

Backend:
- `backend/routers/steel.py`
- `backend/services/steel_service.py`

Frontend:
- `web/src/lib/steel.ts`
- steel pages/components

Current status: Yellow
- Broad surface area, complex role/financial redaction logic; requires stronger integration validation.

## 5) OCR flow (actual implementation)

Frontend state machine:
- `OCRState = "idle" | "uploading" | "processing" | "partial" | "completed" | "error"`
  - file: `web/src/components/ocr-scan/types.ts`

Primary UI flow in `ocr-scan-page.tsx`:
1. Pick image (camera/gallery)
2. Optional auto warp (`/ocr/warp`)
3. Local enhancement (worker/canvas)
4. OCR preview (`/ocr/logbook`)
5. Progressive field reveal (Date/Material/Quantity)
6. Save verification draft (`/ocr/verifications`)
7. Fire async Excel job (`/ocr/logbook-excel-async`)

Important local functions in `ocr-scan-page.tsx`:
- `buildEnhancedFile`: wraps enhanced blob in new File.
- `buildWarpedFile`: wraps perspective-fixed blob.
- `humanExtractError`: maps technical backend errors into user-friendly copy.
- `withTimeout`: fail-fast wrapper for async steps.
- `hintsFromWarnings`: transforms quality warnings to user hints.
- `applyFieldsToRows`: injects edited structured fields back into rows.
- `continueManualEntry`: fallback when OCR service unavailable.

Backend OCR behavior split:
- `/ocr/logbook` uses local OCR path (`ocr_utils.extract_table_from_image`), mostly Tesseract/OpenCV.
- `/ocr/logbook-excel` and `/ocr/table-excel` use AI providers via `ledger_scan.py` / `table_scan.py`.
- Async Excel routes use shared background jobs (`backend/services/background_jobs.py`).

Practical note:
- Preview can work even if Anthropic key is invalid, because local OCR route does not require Anthropic.
- Excel export may fail if AI provider keys are invalid.

## 6) Backend API handler inventory

This list is all user-facing route handlers by router.

### `backend/routers/auth.py`
- `register_user`: create user + auth response.
- `login_user`: login.
- `logout_user`: logout and token/session cleanup.
- `refresh_access_token`: refresh auth token.
- `password_forgot`, `validate_password_reset_token`, `password_reset`.
- `list_factories`, `select_factory`.
- `get_me`, `get_auth_context`, `get_active_workflow_template`.
- `update_profile`, `change_password`, `admin_only_route`.

### `backend/routers/auth_secure.py`
- `register`, `login`, `logout`, `me`, `password_forgot`, `password_reset`, `mfa_setup`, `mfa_verify`, `mfa_disable`.

### `backend/routers/auth_google.py`
- `google_login`, `google_callback`.

### `backend/routers/entries.py`
- `parse_smart_input`, `create_entry`, `list_entries`, `approve_entry`, `reject_entry`, `get_today_entries`, `get_entry`, `get_entry_summary_meta`, `queue_entry_summary`, `regenerate_entry_summary`, `update_entry`, `delete_entry`.

### `backend/routers/attendance.py`
- `get_my_attendance_today`, `punch_attendance`, `get_live_attendance`, `get_attendance_employee_profiles`, `upsert_attendance_employee_profile`, `get_shift_templates`, `upsert_shift_template`, `create_regularization_request`, `get_attendance_review_queue`, `approve_attendance_review`, `reject_attendance_review`, `get_attendance_report_summary`.

### `backend/routers/ocr.py`
- `ocr_status`, `list_templates`, `create_template`, `deactivate_template`, `list_verifications`, `create_verification`, `get_verification`, `update_verification`, `submit_verification`, `approve_verification`, `reject_verification`, `ocr_logbook`, `warp_document`, `ocr_logbook_excel`, `ocr_logbook_excel_async`, `ocr_table_excel`, `ocr_table_excel_async`, `get_ocr_job`, `download_ocr_job`.

### `backend/routers/reports.py`
- `report_insights`, `download_pdf`, `download_pdf_job`, `sample_pdf`, `download_excel`, `weekly_export`, `monthly_export`, `export_factory_excel`, `export_factory_excel_job`, `get_report_job`, `download_report_job`.

### `backend/routers/analytics.py`
- `weekly_analytics`, `monthly_summary`, `trends`, `manager_analytics`.

### `backend/routers/ai.py`
- `get_ai_usage`, `get_dpr_suggestions`, `get_anomalies`, `get_anomaly_preview`, `query_with_natural_language`, `executive_summary`, `executive_summary_job`, `get_ai_job`.

### `backend/routers/settings.py`
- `get_factory_profiles`, `get_factory_settings`, `get_factory_templates`, `list_factories`, `create_factory`, `get_control_tower`, `update_factory_settings`, `list_users`, `invite_user`, `update_user_role`, `update_user_plan`, `update_org_plan`, `deactivate_user`, `lookup_users`, `get_usage`, `last_plan_upgrade`, `reconcile_usage_endpoint`, `load_demo_data`.

### `backend/routers/billing.py`
- `get_billing_config`, `get_billing_status`, `get_invoices`, `schedule_plan_downgrade`, `cancel_plan_downgrade`, `create_order`, `razorpay_webhook`.

### `backend/routers/premium.py`
- `premium_dashboard`, `premium_audit_trail`, `premium_executive_pdf`.

### `backend/routers/steel.py`
- `get_steel_overview`, `download_steel_owner_daily_pdf`, `list_steel_inventory_items`, `list_steel_inventory_stock`, `list_steel_inventory_transactions`, `create_steel_inventory_item`, `create_steel_inventory_transaction`, `create_steel_stock_reconciliation`, `list_steel_stock_reconciliations`, `approve_steel_stock_reconciliation`, `reject_steel_stock_reconciliation`, `list_steel_batches`, `get_steel_batch_detail`, `list_steel_customers`, `create_steel_customer`, `get_steel_customer_ledger`, `create_steel_customer_payment`, `list_steel_invoices`, `get_steel_invoice_detail`, `create_steel_invoice`, `list_steel_dispatches`, `get_steel_dispatch_detail`, `create_steel_dispatch`, `create_steel_batch`.

### Other routers
- `alerts.py`: `list_unread_alerts`, `mark_alert_read`
- `emails.py`: `get_email_summary`, `generate_summary_email`, `send_summary_email`
- `jobs.py`: `list_background_jobs`, `get_background_job`, `cancel_background_job`, `retry_background_job`
- `observability.py`: `readiness_check`, `capture_frontend_error`
- `plans.py`: `list_plans`

## 7) Frontend function inventory (API-facing)

Main API clients in `web/src/lib`:
- `auth.ts`: login/register/logout/refresh/reset/profile/factory-context functions.
- `entries.ts`: entry CRUD + smart parse + summary jobs.
- `attendance.ts`: punch/live/review/settings/reports.
- `ocr.ts`: OCR status/templates/preview/warp/jobs/verifications.
- `reports.ts`: report downloads + export jobs + insights.
- `analytics.ts`, `ai.ts`: analytics and AI endpoints.
- `billing.ts`, `plans.ts`, `premium.ts`, `settings.ts`, `steel.ts`, `jobs.ts`.
- `api.ts`: shared `apiFetch` and API error normalization.

OCR UI components:
- `OCRUploader`: camera/gallery input.
- `OCRProgress`: stage status + progress bar + live preview.
- `OCRPartialResult`: progressive field detection display.
- `OCRResultForm`: editable structured fields + actions.
- `OCREditor`: optional advanced image tuning.
- `OCRError`: user-friendly failure and fallback actions.

## 8) Known live risks (if deployed now)

### Red (reproducible break)

1. User invite endpoint can crash with 500.
- Location: `backend/routers/settings.py:696`
- Root cause: `secrets.token_urlsafe(8)` used without `import secrets`.
- User impact: admin cannot invite users reliably.

### High risk

2. OCR role policy mismatch (frontend vs backend).
- Frontend allows `operator` to enter OCR UI:
  - `web/src/components/ocr-scan-page.tsx:133`
- Backend OCR access excludes operator:
  - `backend/routers/ocr.py:250`
- User impact: operator sees OCR screen, then gets API denial.

3. Upload limit mismatch.
- Frontend allows up to 12 MB:
  - `web/src/components/ocr-scan-page.tsx:27`, `:328`
- Backend hard limit 8 MB:
  - `backend/routers/ocr.py` (multiple `Image too large. Max 8MB.` guards)
- User impact: confusing "allowed then rejected" behavior.

4. Silent async export failure in OCR save flow.
- `startOcrExcelJob(...).catch(() => undefined)` swallows errors.
- Location: `web/src/components/ocr-scan-page.tsx:376`
- User impact: user may assume export happened when it failed.

### Medium risk

5. OCR can save placeholder strings if detection remains unresolved.
- `DETECTING_TEXT` is used as temporary field state.
- Ensure save path blocks placeholders.

6. Lint policy currently failing (6 errors, 9 warnings in full web lint).
- Build passes, lint fails.
- CI pipelines with strict lint gate may block deployment.

7. Two OCR async systems exist.
- Legacy: `backend/ocr_jobs.py`
- Active shared jobs: `backend/services/background_jobs.py`
- Risk: maintenance confusion and drift.

## 9) Current verification snapshot (March 31, 2026)

Executed checks:
- `web`: `npm run build` -> PASSED
- `web`: `npm run lint` -> FAILED (hook/lint issues in non-OCR files)
- `backend`: targeted tests
  - `tests/test_auth_e2e.py::test_cookie_session_flow` -> PASSED
  - `tests/test_ocr_verification.py::test_ocr_verification_draft_submit_approve` -> PASSED
  - `tests/test_job_controls.py::test_shared_ocr_job_retry_and_download` -> PASSED
  - `tests/test_attendance.py::test_attendance_punch_flow_and_live_board` -> PASSED
- `backend`: full `pytest -q` -> FAILED (many tests, mixed env/data/isolation failures)

OCR local dependency check:
- `/ocr/status` returns installed Tesseract and languages (`eng`, `hin`, `mar`, `osd`) in this environment.

## 10) Priority fix order before go-live

1. Fix invite 500 (`import secrets` in `settings.py`).
2. Resolve OCR role mismatch (align frontend + backend policy).
3. Resolve upload-size mismatch (8 MB vs 12 MB).
4. Remove silent catch for OCR async export; surface real user feedback.
5. Block saving unresolved placeholders like `Detecting...`.
6. Stabilize lint errors and establish CI baseline.
7. Decide single OCR async infrastructure (prefer `background_jobs.py`) and deprecate legacy queue path.

## 11) AI onboarding checklist (for any new AI tool)

Before editing:
1. Read this file end-to-end.
2. Confirm active frontend is `web/`, not legacy `frontend/`.
3. Run:
   - backend health: `GET /health`
   - OCR health: `GET /ocr/status`
   - web build: `cd web && npm run build`

For OCR changes:
1. Start from `web/src/components/ocr-scan-page.tsx`.
2. Keep OCR flow state-driven (`idle/uploading/processing/partial/completed/error`).
3. Keep default path simple; hide advanced controls behind explicit action.
4. Always verify backend route contract in `backend/routers/ocr.py` + `web/src/lib/ocr.ts`.

Before shipping:
1. Re-test invitation flow.
2. Re-test OCR on poor image + no provider key scenario.
3. Re-test role gating for operator/supervisor/manager.
4. Re-run targeted tests + lint/build.

## 12) Quick command crib sheet

Backend:
- `python run.py`
- `python -m uvicorn backend.main:app --host 127.0.0.1 --port 8765`

Frontend:
- `cd web && npm run dev`
- `cd web && npm run build`
- `cd web && npm run lint`

Tests:
- `python -m pytest tests/test_auth_e2e.py::test_cookie_session_flow -q -s`
- `python -m pytest tests/test_ocr_verification.py::test_ocr_verification_draft_submit_approve -q -s`

---

If you are a new AI agent: treat this file as source-of-truth context, then validate against current code before making assumptions.
