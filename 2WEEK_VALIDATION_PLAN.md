# FactoryNerve – 2‑Week Real‑Client Validation Plan  

**Purpose:** Simulate two weeks of production use by exercising every role and every core workflow, confirming functional completeness, reliability, performance, data integrity, UX quality, observability, and security before handing the system to a paying client.  

---  

## 1. Goals & Success Criteria  

| Goal | Success Metric (must be met for go‑live) |
|------|------------------------------------------|
| **Functional completeness** | 100 % of defined end‑to‑end scenarios execute without blocking errors. |
| **Reliability** | No unhandled exceptions, crashes, or infinite loops observed during the 2‑week run. HTTP 5xx responses ≤ 0.1 % of total requests. |
| **Performance** | Page‑load (first meaningful paint) ≤ 3 s on a typical dev‑machine (Chrome, 4 CPU, 8 GB RAM). API latency (p95) ≤ 500 ms for core endpoints. |
| **Data integrity** | All created records (attendance punches, OCR verifications, steel transactions, invoices, approvals) are persisted correctly and can be retrieved without corruption. |
| **UX acceptance** | ≥ 80 % of usability checklist items pass (see Section 4). No show‑stopper UX blockers (e.g., missing navigation, inaccessible forms). |
| **Observability** | Logs contain no new ERROR/WARN spikes > 5 % above baseline; Prometheus metrics stay within defined SLO ranges. |
| **Rollback safety** | Ability to restore a clean DB snapshot after the test and verify that no test data persists unintentionally. |

If any criterion fails, the test is extended until the issue is resolved and re‑tested.  

---  

## 2. Test Environment  

| Component | Version / Config | Notes |
|-----------|------------------|-------|
| **Backend** | FastAPI (uvicorn) – `FASTAPI_PORT=8765` – reload enabled | Started via `scripts/start_dev.py --with-frontend`. |
| **Frontend** | Next.js 16.6.2 dev mode, served on `http://127.0.0.1:3000` – Tailwind 4 – shadcn/ui | `npm run dev` inside `web/`. |
| **Database** | PostgreSQL (Render free tier) – seeded via `scripts/seed_dev.py` | Fresh snapshot taken before Day 0; restored each night. |
| **Cache / Queue** | Redis (local) + RQ workers (optional) | Workers enabled via `RQ_WORKER_ENABLED=true`. |
| **OCR** | Local Tesseract + mock Anthropic/Bytez (API keys set to test values) | No real‑AI calls; ensures deterministic output. |
| **Email** | SMTP dry‑run (`SMTP_DRY_RUN=1`) – logs to console | Verification links appear in backend logs. |
| **Payments** | Razorpay sandbox credentials (if configured) – otherwise invoices stay in “draft” state. |
| **Observability** | Structured JSON logging, OpenTelemetry (no export), Prometheus `/metrics` (token‑protected), Sentry DSN (optional). |
| **Test Tooling** | Playwright (Chromium) for UI flows, pytest for API/backend, custom Python scripts for data validation. |
| **Monitoring** | Grafana‑lite dashboard (local) showing request rate, error rate, 95th‑latency, DB connections, queue length. |

*The environment is reset each night (DB restore, container restart) to simulate a clean production start‑day.*  

---  

## 3. Roles & Personas  

| Role | Primary Responsibilities | Typical Daily Actions (≈ 2‑4 hrs) |
|------|--------------------------|----------------------------------|
| **System Admin** | Manage org, users, roles, billing, system settings, API keys. | Create/edit users, assign roles, view audit logs, configure OCR providers, set up billing plans, run system health checks. |
| **Operations Supervisor** | Oversee attendance, approvals, workflow queues, handle exceptions. | Approve/reject attendance edits, monitor work‑queue, resolve OCR verification exceptions, steel dispatch approvals, view control‑tower alerts. |
| **Floor Operator / Worker** | Clock‑in/out, submit OCR scans, record steel production, log issues. | Punch in/out, upload documents via OCR scan, verify OCR output, log production data, raise attendance/anomaly tickets. |
| **Accountant / Billing** | Review invoices, manage subscriptions, process payments. | Generate invoices, reconcile payments, apply discounts, view billing reports, handle failed payments. |
| **Quality / Compliance** | Audit steel quality, traceability, SLA compliance. | Run quality inspections, view SLA reports, verify subprocessors, maintain compliance documentation. |
| **Support / Help‑desk** (optional) | Troubleshoot user issues, raise internal tickets. | Use the ticketing/work‑flow system, monitor notifications, respond to user‑submitted issues. |

Each role will be exercised by at least one dedicated tester (can be the same person switching contexts).  

---  

## 4. Test Scenarios (End‑to‑End Flows)  

| ID | Scenario (Title) | Role(s) | Steps (high‑level) | Expected Outcome |
|----|------------------|---------|--------------------|------------------|
| **A1** | **User Lifecycle – Onboard & Verify** | Admin | 1. Admin creates new org → 2. Invites user (email) → 3. User clicks verification link → 4. User sets password → 5. User logs in → 6. User sees correct role‑based sidebar. | User appears in org with correct role; email verified flag = true; can access role‑specific pages. |
| **A2** | **Role Change & Permission Propagation** | Admin → Supervisor | 1. Admin promotes user from Operator → Supervisor. 2. Supervisor logs in. 3. Verify new menu items (Approvals, Work‑Queue, Control‑Tower) appear and previously hidden items are removed. | Permissions updated instantly; no need to logout/login again (if using live‑update via WebSocket/session refresh). |
| **A3** | **Password Reset Flow** | Any user | 1. Click “Forgot password” → 2. Enter email → 3. Receive reset link (log) → 4. Set new password → 5. Login with new password. | Reset succeeds; old password invalid; audit log shows password change. |
| **B1** | **Attendance – Punch In/Out (Live)** | Operator | 1. Operator navigates to `/attendance` → 2. Selects shift (if applicable) → 3. Clicks “Punch In”. 4. System logs timestamp & location (if GPS mock). 5. After work, clicks “Punch Out”. 6. Verify timesheet entry appears with correct duration. | Timesheet record created with correct in/out times; visible in operator’s attendance report and supervisor’s approval queue. |
| **B2** | **Attendance – Bulk Edit & Approval** | Supervisor | 1. Supervisor opens `/attendance/review` → 2. Selects multiple punches needing correction (e.g., missed punch) → 3. Edits start/end times → 4. Adds note → 5. Submits for approval → 6. System creates approval request → 7. Supervisor (or another approver) approves → 8. Updated timesheet reflected. | Edited punches persisted; approval audit trail present; notification sent to operator. |
| **B3** | **Attendance – Reports & Export** | Supervisor / Accountant | 1. Navigate to `/attendance/reports` → 2. Filter by date range, user, shift → 3. View summary chart → 4. Export to CSV/Excel → 5. Validate file contents match UI totals. | Export succeeds, data matches filtered set, file opens correctly. |
| **C1** | **OCR Scan – Upload & Auto‑Process** | Operator | 1. Go to `/ocr/scan` → 2. Upload sample PDF/PNG (pre‑seeded test fixture) → 3. System shows processing stages (preprocess → detect → extract → confidence) → 4. Preview renders in spreadsheet view → 5. Operator makes a correction (e.g., fixes a mis‑read cell) → 6. Clicks “Save Draft”. | OCR verification record created; draft saved; edited cell reflected; confidence matrix updated; toast shows “Draft saved”. |
| **C2** | **OCR – Re‑run with Different Model** | Operator | 1. After saving draft, open model selector → 2. Change from Auto → Claude Sonnet 4.6 → 3. Click “Re‑run with selected model” → 4. System re‑processes same file → 5. Preview updates; token usage/cost changes accordingly. | New OCR result generated, draft updated, token usage reflects model change, no loss of previous edits unless overridden. |
| **C3** | **OCR – Share Link Generation** | Operator → Supervisor | 1. After saving draft, click “Share link” → 2. System generates time‑limited URL → 3. Copy link → 4. Open in incognito → 5. View read‑only OCR sheet → 6. Verify inability to edit. | Share link works, expires after set time, read‑only view. |
| **C4** | **OCR – Submit for Review** | Operator → Supervisor | 1. Operator submits draft for review → 2. System moves record to “Pending Review” queue → 3. Supervisor opens `/ocr/verify?verification_id=X` → 4. Reviews, adds reviewer notes, optionally requests re‑scan → 5. Approves/rejects → 6. Status updates and notification sent to operator. | Review workflow completes; audit trail shows submission, review, decision; operator notified. |
| **C5** | **OCR – History & Export** | Supervisor | 1. Open `/ocr/history` → 2. Filter by date/user → 3. Select a record → 4. Export to Excel/JSON/CSV → 5. Validate exported data matches original OCR result + any edits. | Export successful; data integrity preserved. |
| **D1** | **Steel – Create Dispatch & Track** | Operator | 1. Navigate to `/steel/dispatches` → 2. Click “New Dispatch” → 3. Fill in source, destination, product, quantity, vehicle, driver → 4. Save → 5. Dispatch appears in list with status “Created”. | Dispatch record created; visible in list; can be edited before release. |
| **D2** | **Steel – Release Dispatch (Supervisor Approval)** | Supervisor | 1. Supervisor views pending dispatches → 2. Selects a dispatch → 3. Adds release notes → 4. Clicks “Release” → 5. System updates status to “In‑Transit” → 6. Generates a tracking number (mock). | Dispatch status updated; notification to driver (if configured); audit log entry. |
| **D3** | **Steel – Record Production / Consumption** | Operator | 1. Go to `/steel/production/record` → 2. Select dispatch (in‑transit) → 3. Enter produced quantity, scrap, rework → 4. Save → 5. System updates inventory balances accordingly. | Inventory adjustments reflected in `/steel/inventory` and `/steel/inventory-intelligence`. |
| **D4** | **Steel – Quality Inspection & Non‑Conformance** | Quality | 1. Navigate to `/steel/quality` → 2. Create new inspection record linked to a dispatch or batch → 3. Record defects, severity, photos (mock) → 4. Submit → 5. System creates non‑conformance ticket (if defect > threshold). | Inspection saved; if threshold breached, a non‑conformance appears in approvals queue for review. |
| **D5** | **Steel – Scrap/Loss Intelligence Report** | Accountant / Supervisor | 1. Open `/steel/scrap-loss-intelligence` → 2. Filter by date, product → 3. View chart of loss vs. target → 4. Export report. | Report renders correctly; export file contains expected numbers. |
| **E1** | **Billing – Create Subscription & Invoice** | Admin / Accountant | 1. Admin creates a new plan (if not existing) → 2. Assigns plan to org → 3. System generates upcoming invoice → 4. Accountant views `/billing/invoices` → 5. Clicks “Pay now” (sandbox) → 6. Payment status moves to “Paid”. | Invoice created, payment recorded, receipt downloadable. |
| **E2** | **Billing – Dunning & Grace Period** | Accountant | 1. Simulate overdue invoice (adjust `due_date` in DB or wait for scheduler) → 2. System sends reminder email (log) → 3. After grace period, invoice marked “Past Due” → 4. Accountant sees dunning banner → 5. Attempt payment → 6. Status updates. | Reminder emails appear in logs; invoice status transitions correctly; UI shows overdue badge. |
| **E3** | **Admin – Audit Log & Settings** | Admin | 1. Admin opens `/settings/audit` → 2. Filters by action/user/date → 3. Views detailed log entries (login, role change, data edit) → 4. Export log (CSV). | All actions performed during the two weeks are present and exportable. |
| **F1** | **Notifications & Real‑Time Updates** | Any user | 1. Perform an action that triggers a notification (e.g., attendance punch, OCR submission, approval request) → 2. Observe bell/badge updates in UI without page reload → 3. Click notification → 4. Navigate to linked item. | Notification appears instantly (via WebSocket or polling), directs correctly. |
| **F2** | **Offline‑Sync & Retry Simulation** | Operator | 1. Disable network (devtools → offline) → 2. Attempt to punch in/out or upload OCR file → 3. See offline queue indicator → 4. Re‑enable network → 5. System automatically retries and syncs → 6. Verify data persisted. | Offline actions stored locally and synced upon reconnection; no data loss. |
| **F3** | **Error Boundary & Graceful Degradation** | Any user | 1. Trigger a known error (e.g., submit OCR with corrupted file) → 2. Error boundary shows friendly message + retry button → 3. Retry succeeds or gives clear guidance. | No stack trace leaked to user; recovery path available. |

---  

## 5. Two‑Week Execution Schedule  

| Day | Morning (~3 h) | Afternoon (~3 h) | Evening (~1 h) | Focus |
|-----|----------------|------------------|----------------|-------|
| **0 (Prep)** | Environment setup: DB snapshot, start servers, verify health endpoints. | Install Playwright, write helper scripts for bulk actions (create test users, upload OCR fixtures). | Run smoke‑test suite (login, basic navigation) → capture baseline metrics. | Ensure a clean, repeatable start. |
| **1** | **A1‑A3** (User lifecycle, role change, password reset) | **B1‑B2** (Attendance punch, bulk edit/approval) | Review logs, capture any errors, update test data if needed. | Core auth & attendance. |
| **2** | **B3** (Attendance reports/export) | **C1‑C2** (OCR upload & model re‑run) | Daily health check (CPU, memory, DB connections). | Attendance reporting + OCR basics. |
| **3** | **C3‑C4** (Share link & submit for review) | **C5** (OCR history/export) | Run Playwright regression on OCR flow; record timings. | OCR collaboration & review. |
| **4** | **D1‑D2** (Steel dispatch create & release) | **D3** (Production recording) | Verify inventory balances updated correctly. | Steel lifecycle (dispatch → production). |
| **5** | **D4** (Quality inspection & non‑conformance) | **D5** (Scrap/Loss intelligence) | Run audit‑log verification for steel actions. | Steel QC & intelligence. |
| **6** | **E1‑E2** (Billing subscription, invoice, dunning) | **E3** (Admin audit log & settings) | Validate that invoice PDFs download and contain correct line items. | Billing & auditing. |
| **7** | **F1** (Notifications real‑time) | **F2** (Offline‑sync simulation) | Stress test: generate 50 rapid attendance punches + 20 OCR uploads (via script) → measure API latency & queue depth. | System resilience & sync. |
| **8** | **F3** (Error boundaries) | Mixed: Re‑run any flaky scenarios from days 1‑7 | Capture UX checklist (see Section 4). | Edge‑case handling & UX polish. |
| **9** | **Cross‑role End‑to‑End Order** (Operator punch → OCR upload → Supervisor OCR approval → Operator production record → Quality defect → Supervisor NC approval → Accountant scrap invoice → Admin audit log) | Free‑form exploratory testing (odd combos, rapid navigation, multiple tabs) | Review logs for any missed events. | Full business‑process integration. |
| **10** | Load‑test simulation (scripts) – 100 concurrent users performing mixed actions (punch, OCR, dispatch) for 30 min. | Monitor Prometheus/Grafana; collect p95 latency, error rate, DB pool usage. | Adjust configs (`UVICORN_WORKERS`, `NEXT_PUBLIC_API_TIMEOUT`) if needed. | Performance under load. |
| **11** | **Security check** – IDOR on `/ocr/verify/{id}` (should 403), CSRF attempts, cookie flags (`Secure; HttpOnly; SameSite=Strict`) | OWASP ZAP baseline scan (if available) against local host. | Document findings, plan remediation if any. | Security assurance. |
| **12** | **Accessibility audit** (axe‑core) on key pages: `/access`, `/ocr/scan`, `/attendance`, `/steel/dispatches`, `/billing/invoices`. | Fix any WCAG 2.1 AA violations (color contrast, label association, focus order). | Re‑run audit to confirm. | Accessibility compliance. |
| **13** | **UX polishing** – verify loading skeletons, empty states, toast consistency, keyboard navigation, help‑tooltips, model‑selector labels. | Conduct short “think‑aloud” session with a tester acting as a new user; note confusion. | Iterate on any UI friction spotted. | Usability readiness. |
| **14** | **Final Sign‑Off**: <br> • Re‑run all core scenarios (A1‑F3) in a single automated Playwright suite. <br> • Verify no regressions vs. Day‑0 baseline. <br> • Export final metrics report (latency, error, throughput). <br> • Stakeholder walk‑through (Product owner, QA lead, Dev lead) reviewing the report and signing off. | Archive test artifacts (logs, screenshots, videos). | Restore DB to clean state (post‑test snapshot) and ensure no test data leaks. | Release readiness decision. |

*Notes:*  

- Each day’s morning/afternoon blocks can be split among multiple testers (e.g., one focuses on Auth, another on Attendance).  
- The evening slot is reserved for quick health checks, log review, and capturing defects for the next day.  
- Automated regression scripts (Playwright + pytest) are run at the start and end of each day to catch breakages early.  
- Where a scenario requires data prep (e.g., creating a test OCR fixture), a small Python helper script is used to keep the process repeatable.  

---  

## 6. Test Data & Fixtures  

| Fixture | Description | Source / Preparation |
|---------|-------------|----------------------|
| **User set** | 1 Org, 1 Admin, 2 Supervisors, 4 Operators, 1 Accountant, 1 Quality. | Base seed from `scripts/seed_dev.py`; expanded via `tests/fixtures/create_test_users.py`. |
| **Attendance shifts** | 3 shift patterns (Day, Night, Flex). | Defined in `attendance/fixtures/shifts.json`. |
| **OCR test files** | • 5 PDFs (multi‑column tables) <br> • 5 PNG images (receipt‑style) <br> • 1 corrupted PDF (to trigger error boundary). | Stored in `tests/fixtures/ocr_samples/`; copied to `/tmp` before each upload via test script. |
| **Steel product catalog** | 10 steel grades, each with UoM (kg, ton). | Populated by seed script; additional items via `steel/fixtures/products.py`. |
| **Billing plans** | 3 tiers (Basic, Pro, Enterprise) with monthly/annual options. | Defined in `billing/fixtures/plans.yaml`. |
| **Notification webhook mock** | Endpoint `http://localhost:9999/webhook` logs payloads. | Started via `python -m http.server 9999` in background (optional). |
| **Audit‑log extractor** | Script to pull all `audit_log` rows for a given time window and output CSV. | `scripts/export_audit_log.py`. |

All fixtures are version‑controlled under `tests/fixtures/` and re‑loaded each night from a clean DB snapshot.  

---  

## 7. Metrics Collection & Reporting  

| Metric | Tool | Target | Collection Frequency |
|--------|------|--------|----------------------|
| **Request latency (p95, p99)** | Prometheus (`http_request_duration_seconds`) | ≤ 500 ms (p95) | Every 15 s (scrape) |
| **Error rate (5xx)** | Prometheus (`http_requests_total{status=~"5.."}`) | ≤ 0.1 % | Every 15 s |
| **Throughput** | Prometheus (`http_requests_total`) | ≥ 20 req/s sustained (peak) | Every 15 s |
| **DB connections** | `pg_stat_activity` count | ≤ 80 % of max_connections | Every 30 s |
| **Redis memory** | `INFO memory` | ≤ 70 % of configured `maxmemory` | Every 30 s |
| **Queue depth (RQ)** | `rq info` | ≤ 10 jobs waiting (non‑processing) | Every 30 s |
| **Frontend paint** | Lighthouse (CI) or Chrome DevTools → `First Contentful Paint` | ≤ 3 s | Once per day (automated script) |
| **Test execution success** | Playwright test runner | 100 % pass | After each scenario batch |
| **User‑reported issues** | Manual tester log (shared sheet) | 0 critical, ≤ 2 minor per day | End of each day |

A daily summary (email/Slack) will be sent to the test lead with the above numbers and any deviations highlighted.  

---  

## 8. Risk Mitigation & Contingency  

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Server hangs (original timeout routes)** | Medium (believed fixed after code review) | High – blocks core flows | Before Day 0 run a focused SSR sanity check: request `/ocr`, `/sla`, `/reset-password`, `/signup`, `/subprocessors` with a 2‑second timeout; if any hangs, investigate stack traces, fix before proceeding. |
| **Data leakage between test runs** | Low (DB snapshot restore) | Medium | After each day snapshot the DB; before next day restore from pristine snapshot. Verify key table row counts equal baseline. |
| **Flaky Playwright tests due to timing** | Medium | Medium | Use `await page.waitForLoadState('networkidle')` and explicit selectors; increase default timeout to 30 s for actions involving background workers (OCR processing). |
| **Insufficient edge‑case coverage** | Low | Medium | Pair‑programming during test design; add exploratory testing slot (Day 8). |
| **Performance degradation under load** | Low | High | Conduct load test early (Day 10); if SLA breached, tune UVICORN workers, increase Next.js `experimental.concurrentFeatures`, or add Redis caching for frequent read‑only queries. |
| **Security mis‑config (CORS, cookies)** | Low | High | Run automated security scan (OWASP ZAP) on Day 11; ensure `Secure; HttpOnly; SameSite=Strict` flags on auth cookies; verify CORS whitelist matches expected domains. |
| **Accessibility regressions** | Low | Medium | Run axe‑core on Day 12; treat any WCAG AA violation as a blocker; fix before sign‑off. |
| **Incorrect billing (tax, proration)** | Low | Medium | Verify invoices against known test data; use sandbox payment gateway to confirm state transitions. |

If any risk materialises and cannot be resolved within the day’s allocated time, the test schedule will be extended by 1‑2 days to address the blocker before proceeding.  

---  

## 9. Deliverables  

1. **Test Execution Log** – chronological record of every step taken, outcomes, timestamps, and deviations.  
2. **Automated Test Suite** – Playwright & pytest scripts (committed under `tests/e2e/` and `tests/unit/`).  
3. **Metrics Report** – CSV/JSON of daily Prometheus queries, Grafana snapshots, Lighthouse scores.  
4. **UX Audit Summary** – checklist results, screenshots of any issues, remediation notes.  
5. **Accessibility Report** – axe‑core output with pass/fail per page.  
6. **Security Scan Report** – OWASP ZAP findings (if any).  
7. **Final Sign‑Off Document** – signed by Product Owner, QA Lead, Dev Lead stating that the system meets the success criteria for a two‑week real‑client usage simulation.  
8. **Clean‑State DB Snapshot** – post‑test validation that the database can be returned to the original seed state with no test data left.  

---  

## 10. Go/No‑Go Decision Matrix  

| Criterion | Pass? (Y/N) | Comments / Evidence |
|-----------|-------------|---------------------|
| All core scenarios (A1‑F3) run without blocking errors |  |  |
| HTTP 5xx ≤ 0.1 % of total requests |  |  |
| Page LCP ≤ 3 s (95 % of runs) |  |  |
| Data integrity checks (row counts, foreign‑key constraints) pass |  |  |
| UX checklist ≥ 80 % pass, no show‑stopper |  |  |
| Accessibility WCAG AA ≥ 90 % pass |  |  |
| Security scan yields no high‑severity findings |  |  |
| Observability shows no new error spikes > 5 % baseline |  |  |
| Ability to restore clean DB snapshot after test |  |  |

*If any row is **N**, the issue must be resolved and the affected day(s) re‑executed before sign‑off.*  

---  

### Closing Note  

Executing this plan will give you confidence that FactoryNerve behaves like a production‑grade SaaS when real users perform their day‑to‑day tasks across all roles.  The combination of scripted end‑to‑end flows, exploratory testing, performance/load checks, accessibility, and security validation covers the dimensions that matter most to a paying customer who expects the platform to be stable, usable, and trustworthy for at least several months of continuous operation.  

**Proceed to Day 0 preparation once the six previously‑timing‑out routes (`/ocr`, `/register`, `/reset-password`, `/signup`, `/sla`, `/subprocessors`) have been verified to return a response within 2 seconds.** After that, launch the two‑week validation schedule as outlined above. Good luck!