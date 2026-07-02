DPR.ai Reports & Analytics Module -- Comprehensive Audit

## 1. What Analytics Endpoints Exist and What Data Do They Return?

### Backend (`backend/routers/analytics.py`)

| Endpoint | Method | Role Guard | Plan Gate | Date Range | Returns |
|---|---|---|---|---|---|
| `/analytics/weekly` | GET | SUPERVISOR+ | Basic (Growth+) | Last 7 days | `list[{date, units, production_percent, attendance_percent}]` -- per-day aggregate |
| `/analytics/monthly` | GET | SUPERVISOR+ | Basic (Growth+) | Last 30 days | `{summary[], best_day, worst_day, average}` -- per-day with best/worst |
| `/analytics/trends` | GET | SUPERVISOR+ | **Full** analytics | Last 7 days | `{production_trend(up/down/stable), common_issues{downtime,quality}, peak_performance_shift}` |
| `/analytics/manager` | GET | **MANAGER only** | Full analytics | Custom (def: 7d) | `{totals{total_units,total_target,average_performance,total_downtime}, shift_summary[], supervisor_summary[]}` |

### Frontend wrappers (`web/src/lib/analytics.ts`)
- `getWeeklyAnalytics()` -> `WeeklyAnalyticsPoint[]`
- `getMonthlyAnalytics()` -> `MonthlyAnalytics`
- `getTrendAnalytics()` -> `TrendsAnalytics`
- `getManagerAnalytics(startDate?, endDate?)` -> `ManagerAnalytics`

---

## 2. Do Reports Respect Factory Isolation?

**YES, with caveats.**

The `_scoped_entries_query()` in `reports.py` (lines 75-94) applies factory isolation:
- **OPERATOR**: filters to `Entry.user_id == current_user.id` **AND** `Entry.factory_id == factory_id` (if resolve_factory_id returns one).
- **SUPERVISOR / MANAGER / ACCOUNTANT**: filters to `Entry.user_id IN (factory_user_ids_query(...))` **AND** `Entry.factory_id == factory_id`.
- **ADMIN / OWNER**: passes through `apply_org_filter` only -- no automatic factory filter.

The `apply_role_scope()` in `query_helpers.py` (lines 126-141) is similar but **does not filter ADMIN/OWNER by factory at all** -- they see all factories in their org, which is correct design.

However, `build_steel_overview()` in `steel_service.py` (line 507) takes a `factory` parameter passed by the route handler and filters all queries by `factory.factory_id`. The route handler `get_steel_overview()` in `steel.py` (line 1619) calls `require_active_steel_factory()` to resolve the user's active factory, so **steel overview IS factory-isolated**.

**Verdict**: Entry reports use proper factory scoping. Steel overview is factory-scoped through the route handler. **OK.**

---

## 3. What Role Guards Exist? (Owner-only Financial Data?)

### Role Guards Summary

| Feature | Required Roles |
|---|---|
| `/analytics/weekly` | SUPERVISOR, MANAGER, ADMIN, OWNER |
| `/analytics/monthly` | SUPERVISOR, MANAGER, ADMIN, OWNER |
| `/analytics/trends` | SUPERVISOR+, MANAGER+, ADMIN, OWNER |
| `/analytics/manager` | **MANAGER only** |
| `/reports/insights` | SUPERVISOR, MANAGER, ADMIN, OWNER |
| `/reports/pdf/{id}`, `/reports/excel/{id}` | OPERATOR, SUPERVISOR, MANAGER, ACCOUNTANT, ADMIN, OWNER |
| `/reports/excel-range` | OPERATOR+ (all roles) |
| `/reports/weekly`, `/reports/monthly` | OPERATOR+ (all roles) |
| `/premium/dashboard` | SUPERVISOR+ |
| `/steel/overview` | `require_active_steel_factory()` (any steel-role) |

### Owner-only Financial Data (Steel)

**`_can_view_steel_financials(user)`** (steel.py line 1299): `return user.role == UserRole.OWNER`

The steel overview route (steel.py lines 1619-1634):
1. Calls `build_steel_overview()` which always sets `can_view_financials=True` when calling `serialize_stock_row()` (line 521).
2. Then, if `_can_view_financials` is False, calls `_redact_steel_overview_financials()`.

**BUG-REPORT-001**: `build_steel_overview()` always passes `can_view_financials=True` to `serialize_stock_row()` at line 521. This means the raw payload always has financial data. Only the overview response is redacted. If any other caller of `build_steel_overview` forgets to redact (e.g., `owner-daily-pdf` at line 1659), financial data leaks. The `owner-daily-pdf` endpoint does NOT redact because it sets `overview["financial_access"] = True` and assumes only OWNER can reach it (it has `require_role(current_user, UserRole.OWNER)` at line 1643). **This is currently safe but fragile.**

---

## 4. Are Date Filters Inclusive/Exclusive Correctly Applied?

**Inclusive on BOTH ends** for all endpoints. Example from analytics.py line 86:
```python
.filter(Entry.date >= start, Entry.date <= today, Entry.is_active.is_(True))
```

This means:
- **Weekly**: `[today - 6, today]` -- 7 days inclusive. Correct.
- **Monthly**: `[today - 29, today]` -- 30 days inclusive. Correct.
- **Manager**: user-provided start/end, inclusive both ends. Correct.
- **Insights**: user-provided start/end, inclusive both ends. Correct.

The `_build_dashboard_payload()` in premium.py line 132-133:
```python
Entry.date >= start,
Entry.date <= end,
```
Same pattern. **Inclusive on both ends.** Consistent.

**Annual window**: `_start_day()` in premium.py line 98-100:
```python
def _start_day(days: int) -> date:
    safe_days = max(7, min(days, 45))
    return date.today() - timedelta(days=safe_days - 1)
```
So `days=14` means `today - 13` through `today` = 14 days inclusive. Correct.

**Verdict**: Date filters are consistently inclusive on both ends. **OK.**

---

## 5. What Happens on Report Query Timeout?

**No timeout protection exists for report queries.**

Background jobs in `background_jobs.py` are run via `ThreadPoolExecutor` with no timeout on the worker function. If a query takes 30+ minutes, the worker thread will simply keep running. The `start_job()` function (line 352) submits the worker to the executor but never applies a timeout. The `_executor` has `max_workers=4`, so a long-running export can consume a worker slot indefinitely.

**BUG-REPORT-002**: There is no query timeout on report/analytics database queries. A large date range (`/excel-range` or `/insights`) on a factory with millions of entries could hang indefinitely, exhausting the 4-worker thread pool and blocking all other export jobs. Add a `statement_timeout` or `query_timeout` to the DB session.

Synchronous endpoints like `/reports/insights` (line 745) and `/reports/excel-range` (line 1020) run queries synchronously within the HTTP request, with **no timeout**. FastAPI would eventually time out the HTTP connection, but the DB query continues running.

---

## 6. Can Reports Be Exported? (PDF/Excel?)

**YES.** Multiple export paths:

### Synchronous (immediate download)
| Endpoint | Format | Feature Gate | Note |
|---|---|---|---|
| `GET /reports/pdf/{entry_id}` | PDF per entry | `has_plan_feature("pdf")` | Requires plan |
| `GET /reports/excel/{entry_id}` | Excel per entry | `has_plan_feature("excel")` | Requires plan |
| `GET /reports/excel-range` | Excel range | `has_plan_feature("excel")` | All entries in range |
| `GET /reports/sample-pdf` | PDF | None | No auth needed (public) |
| `GET /steel/owner-daily-pdf` | PDF | OWNER role + `has_plan_feature("pdf")` | Steel daily |

### Asynchronous (background job, polling)
| Endpoint | Format | Note |
|---|---|---|
| `POST /reports/pdf/{entry_id}/jobs` | PDF | Returns `{job_id}`, poll via `GET /reports/export-jobs/{job_id}` |
| `POST /reports/excel-range/jobs` | Excel | Same polling pattern |
| `GET /reports/export-jobs/{job_id}/download` | Both | Download completed file |

### Premium Dashboard
| Endpoint | Format |
|---|---|
| `GET /premium/executive-pdf` | PDF (command-center brief) |

---

## 7. Is Exported Data Sanitized?

**Partially -- there are gaps.**

PDF export (`_render_pdf_bytes()`, reports.py lines 97-135): All entry fields are written directly. No text sanitization (XSS not applicable in PDF). **OK.**

Excel export (`_render_entries_excel()`, reports.py lines 138-188): Raw `entry.notes`, `entry.downtime_reason`, `entry.quality_details`, etc. are written directly into cell values. No sanitization against Excel formula injection (values starting with `=`, `+`, `-`, `@`).

**BUG-REPORT-003**: Excel exports are vulnerable to formula injection. If an entry field contains `=HYPERLINK(...)` or `=MALICIOUS()`, Excel will execute it. All string fields should be prefixed with a single quote or sanitized.

The `download_excel()` single-entry endpoint (line 893) has the same issue -- raw values written to cells.

**Steel overview redaction**: Financial redaction is thorough for non-OWNER roles:
- `profit_summary` -> `None` entirely
- `variance_value_inr`, `estimated_gross_profit_inr`, `estimated_input_cost_inr`, etc. -> `None`
- `current_rate_per_kg` -> `None`
- `ranked_anomalies[*].estimated_leakage_value_inr` -> `None`
- Batches: 7 financial keys set to `None` (line 1288-1296)

**BUG-REPORT-004**: In `build_steel_overview()` (line 521), `serialize_stock_row` is called with `can_view_financials=True` regardless of user. The redaction happens AFTER in `_redact_steel_overview_financials()`. If the overview payload is serialized/cached before redaction, financials could leak. The code shows redaction happens before returning, so OK currently. But the two-phase approach is fragile.

---

## 8. Key KPIs, Calculations, and Formula Verification

### Production Performance (all endpoints)
```
performance = (units_produced * 100.0) / units_target    if units_target > 0
            = 0.0                                         otherwise
```
Used in: `weekly_analytics` (line 90-93), `monthly_summary` (line 153-156), `trends` (line 203-206), `manager_analytics` (line 271-274), `report_insights` (line 191-192).

**Verdict: Correct formula.** Percentage of target achieved.

### Attendance Percent
```
attendance = (manpower_present * 100.0) / (manpower_present + manpower_absent)    if total > 0
           = 0.0                                                                   otherwise
```
Used in: `weekly_analytics` (lines 100-106), `_build_report_insights_payload` (line 383 via `_entry_attendance()` at line 195-197).

**Verdict: Correct formula.** Present as % of total expected.

### Attention Score (support signals)
```
attention = max(0.0, 100.0 - performance) * 1.15 + (downtime_minutes / 8.0) + (quality_issue_entries * 12.0)
```
Used in `_attention_score()` (reports.py lines 208-209). Higher is worse.

**Verdict: Heuristic formula**. `100 - performance` gives "opportunity gap", scaled by 1.15. Downtime penalty is `minutes / 8` (i.e., per 8 minutes adds 1 point). Quality issues add 12 points each. Subjective but reasonable.

### Trend Detection (analytics trends)
```
if last_day_performance > first_day_performance -> "up"
elif last_day_performance < first_day_performance -> "down"
else -> "stable"
```
Used in `trends()` (lines 218-224).

**BUG-REPORT-005**: Trend detection compares only **first vs last day** in the 7-day window, ignoring everything in between. A single bad day at the start gives "up" even if 5 middle days tanked. Should use linear regression or compare first-half vs second-half averages.

### Realization Metrics (steel service)
```
realized_dispatched_profit = revenue - cost
realized_margin_percent = (profit / revenue) * 100  if revenue > 0 else 0
outstanding_invoice_amount = invoiced_amount - dispatched_revenue
```
Used in `build_steel_realization_metrics()` (steel_service.py lines 394-504).

**Verdict: Correct formulas.** Revenue from dispatched weight * rate; cost from batch-level cost per kg.

### Gross Margin (steel overview)
```
gross_margin_percent = (estimated_gross_profit / estimated_output_value) * 100
```
Lines 752-756.

**Verdict: Correct formula.**

### Overall Performance (report insights totals)
```
performance_percent = (total_units_produced * 100.0 / total_units_target)
```
Lines 379-382.

**Verdict: Correct formula.**

---

## 9. Are Financial Values Properly Redacted for Non-OWNER Roles?

**YES for steel.** The redaction pipeline in `_redact_steel_overview_financials()` (steel.py lines 1348-1378) is thorough:

| Field | Redaction |
|---|---|
| `profit_summary` | Entire dict -> `None` |
| `anomaly_summary.total_estimated_leakage_value_inr` | `None` |
| `anomaly_summary.highest_risk_operator.total_variance_value_inr` | `None` |
| `anomaly_summary.highest_risk_operator.total_estimated_gross_profit_inr` | `None` |
| `anomaly_summary.highest_loss_day.total_variance_value_inr` | `None` |
| `anomaly_summary.highest_loss_day.total_estimated_gross_profit_inr` | `None` |
| `top_loss_batch` (7 financial keys) | `None` |
| `top_operator_losses[*]` (2 keys) | `None` |
| `loss_by_day[*]` (2 keys) | `None` |
| `anomaly_batches[*]` (7 keys) | `None` |
| `ranked_anomalies[*].estimated_leakage_value_inr` | `None` |
| `ranked_anomalies[*].batch` (7 keys) | `None` |
| `responsibility_analytics.by_operator[*]` (2 keys) | `None` |
| `responsibility_analytics.by_day[*]` (2 keys) | `None` |
| `responsibility_analytics.by_batch[*]` (2 keys) | `None` |
| `low_confidence_items[*].current_rate_per_kg` | `None` |

**REDACTED BATCH KEYS** (line 1288-1296):
- `input_rate_per_kg`
- `output_rate_per_kg`
- `variance_value_inr`
- `estimated_input_cost_inr`
- `estimated_output_value_inr`
- `estimated_gross_profit_inr`
- `profit_per_kg_inr`

**BUG-REPORT-006**: The `dispatch_line` serializer (`_serialize_steel_dispatch_line()`, steel.py lines 491-517) relies on `can_view_financials` parameter to redact `rate_per_kg` and `line_total_reference`. However, the `_serialize_steel_dispatch()` function (line 529) does NOT support `can_view_financials` and always passes `can_view_financials=False` (line 497 default). **This means dispatch line financials are ALWAYS None by default, which is overly restrictive.** There is no code path that sets `can_view_financials=True` for dispatch lines. Owner users cannot see dispatch line financials.

**Non-Steel**: The regular Reports & Analytics module does NOT have any financial data to redact -- it only tracks production units, downtime, attendance, quality issues. No monetary values are stored. **OK.**

---

## 10. Is There an Overall Dashboard?

**YES.** The premium dashboard at `GET /premium/dashboard` (`PremiumDashboardResponse`) provides:

- **`summary`**: total_units, total_target, average_performance, total_downtime, issues_count, active_factories, active_people
- **`series`**: per-day, per-factory, per-shift breakdown of units, target, performance, downtime, issues
- **`heatmap`**: 7-day x 24-hour activity heatmap from AuditLog timestamps
- **`audit_preview`**: Last 18 audit log entries
- **`insights`**: Up to 4 auto-generated text insights (output gap, downtime review, worst factory, enterprise mode flags)
- **`filters`**: Available factories and shifts
- **Plan-gated**: Requires `factory` plan or higher (`@premium_required(min_plan="factory")`)
- **Role-gated**: SUPERVISOR+ (`require_any_role` on line 481)
- **Date range**: 7-45 days configurable

This is the **only** overall dashboard. The `analytics.py` endpoints are individual widgets; `reports.py`'s `/insights` is a detailed drill-down. The steel `/overview` is a separate industry-specific dashboard for steel operations.

---

## Complete Bug Report

### BUG-REPORT-001: Two-phase redaction leaks in build_steel_overview
**File**: `backend/services/steel_service.py`, line 521
**Severity**: Medium
**Detail**: `build_steel_overview()` calls `serialize_stock_row(item, ..., can_view_financials=True)` unconditionally, then the route handler redacts afterward. If any future caller forgets to redact, financial data leaks to non-OWNER roles. Refactor to accept `can_view_financials` as a parameter.

### BUG-REPORT-002: No query timeout on report/analytics DB queries
**Files**: `backend/routers/reports.py`, `backend/routers/analytics.py`, `backend/services/background_jobs.py`
**Severity**: High
**Detail**: No `statement_timeout` is set on report queries. Large date-range Excel exports or insight queries can hang indefinitely, consuming the 4-worker thread pool. Add `db.execute(text("SET LOCAL statement_timeout = '30s'"))` or use SQLAlchemy query execution options. The `background_jobs.py` worker has no timeout either.

### BUG-REPORT-003: Excel exports vulnerable to formula injection
**File**: `backend/routers/reports.py`, functions `_render_entries_excel()` (line 138) and `download_excel()` (line 893)
**Severity**: Medium
**Detail**: Entry fields like `notes`, `downtime_reason`, `quality_details`, `materials_used` are written raw to Excel cells. If a value starts with `=`, `+`, `-`, or `@`, Excel will interpret it as a formula. Sanitize by prefixing user-supplied text values with a single quote (`'`).

### BUG-REPORT-004: build_steel_overview always builds with financials
**File**: `backend/services/steel_service.py`, line 521
**Severity**: Low
**Detail**: Same root cause as BUG-REPORT-001. The `serialize_stock_row` is always called with `can_view_financials=True`, but `current_rate_per_kg` is only included conditionally. Other financials in the batch serialization (`estimated_input_cost_inr`, etc.) are always computed. Consider making `can_view_financials` a parameter of `build_steel_overview`.

### BUG-REPORT-005: Trend detection uses naive first-vs-last comparison
**File**: `backend/routers/analytics.py`, lines 218-224
**Severity**: Low
**Detail**: `production_trend` is determined by comparing only day[0] vs day[-1] performance. A single outlier dominates. Should use linear regression slope or compare first 3 days vs last 3 days average.

### BUG-REPORT-006: Dispatch line financials always redacted for everyone
**File**: `backend/routers/steel.py`, `_serialize_steel_dispatch_line()` (line 491-517) and `_serialize_steel_dispatch()` (line 529)
**Severity**: Medium
**Detail**: `_serialize_steel_dispatch()` does not accept or pass `can_view_financials` to `_serialize_steel_dispatch_line()`. The `rate_per_kg` and `line_total_reference` fields are always `None` even for OWNER users because `_serialize_steel_dispatch_line` defaults to `can_view_financials=False`. Owner users and PDF exports are affected.

### BUG-REPORT-007: ACCOUNTANT role blocks non-financial report access
**File**: `backend/routers/reports.py`, `_apply_role_filter()` line 70-72
**Severity**: Low (by design? Or a bug?)
**Detail**: `_apply_role_filter` in reports.py **raises 403** for ACCOUNTANT role with message "Accountant role cannot access raw report insights." However, the PDF/Excel export endpoints ALLOW the ACCOUNTANT role (line 815: `require_any_role` includes ACCOUNTANT). Inconsistent -- ACCOUNTANT can download exports but cannot view the `/insights` dashboard. If intentional, the ACCOUNTANT entries in export endpoints should be reviewed for data leakage.

### BUG-REPORT-008: No pagination on /reports/insights
**File**: `backend/routers/reports.py`, line 272
**Severity**: Low
**Detail**: The `report_insights` endpoint loads ALL entries matching the filter into memory with `.all()`. For factories with tens of thousands of entries over a long date range, this will be a memory/time issue. No pagination or limit.

### BUG-REPORT-009: Export endpoint lacks rate limiting
**File**: `backend/routers/reports.py`, lines 1020 and 1050
**Severity**: Medium
**Detail**: The `/excel-range` and `/excel-range/jobs` endpoints have no rate limiting. A malicious user could trigger many large exports, exhausting the 4-worker thread pool or filling disk space. Consider per-user rate limits and/or per-org concurrency limits on exports.

### BUG-REPORT-010: Monthly analytics average calculation uses unweighted mean of daily performances
**File**: `backend/routers/analytics.py`, line 170
**Severity**: Low
**Detail**: `average` in `monthly_summary` is computed as `sum(performance for each day) / number_of_days`. This is an unweighted average of per-day performance percentages. If a day had very low target but high production, the daily performance may be inflated but gets equal weight. This is a semantic issue -- overall `total_units / total_target` would be more meaningful. Not technically wrong, but potentially misleading.

---

## Summary Matrix

| Question | Answer |
|---|---|
| Analytics endpoints exist? | 4 endpoints (weekly, monthly, trends, manager) |
| Factory isolation? | YES -- via `apply_role_scope` / `_scoped_entries_query` |
| Role guards? | SUPERVISOR+ mostly; MANAGER-only for `/analytics/manager` |
| Owner-only financials? | YES -- steel overview redacts for non-OWNER (6 bugs found nonetheless) |
| Date filters? | Inclusive on both ends -- consistent |
| Query timeout behavior? | **NONE** -- no timeout protection anywhere (BUG-REPORT-002) |
| Export formats? | PDF (single-entry), Excel (single + range), background job variants |
| Exported data sanitized? | **NO** -- Excel formula injection risk (BUG-REPORT-003) |
| KPIs verified? | All formulas correct; trend detection is naive (BUG-REPORT-005) |
| Financial redaction? | Thorough for overview, but dispatch lines always redacted (BUG-REPORT-006) |
| Overall dashboard? | YES -- `/premium/dashboard` with summary, series, heatmap, audit trail |