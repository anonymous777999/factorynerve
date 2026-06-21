# NLQ Expansion Plan — Complete Technical Specification
## Enable AI Insights to Answer ALL 78+ Factory Owner Questions

> **Current state:** `POST /ai/query` queries only the `Entry` (DPR) model — ~8% coverage.
> **Target state:** Routes questions to 8 existing intelligence services, covering all 10 categories at ~97%.

---

## 1. Architecture Overview

```
User Question
    │
    ▼
┌──────────────────────────────────────────────────────┐
│ 1. Domain Classifier (_classify_nlq_domain)          │
│    Scans keywords → NlqDomain enum (11 domains)      │
│    Returns: domain, confidence_score                 │
└──────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────┐
│ 2. Enhanced Time Parser (_parse_time_scope_v2)       │
│    Supports: today, yesterday, this/last week/month,  │
│    last N days, this/last quarter, this/last year,    │
│    specific date, date range, specific month          │
│    Returns: (start_date, end_date, scope_label)       │
└──────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────┐
│ 3. Entity Filter Parser (_parse_entity_filter)       │
│    Extracts: shift, employee name, department,        │
│    machine, line, vendor, customer, threshold ₹       │
│    Returns: dict[str, Any]                            │
└──────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────┐
│ 4. Permission Checker (_get_nlq_permissions)          │
│    Resolves: can_view_cost, can_view_financials,      │
│    can_view_user_details per domain                   │
│    Returns: NlqPermissionSet                          │
└──────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────┐
│ 5. Domain Fetcher (one of 10, selected by domain)     │
│    Calls intelligence service → returns structured    │
│    data dict                                          │
└──────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────┐
│ 6. AI Prompt Builder (_build_nlq_prompt)              │
│    Selects domain template → injects data + question  │
│    Returns: prompt_string, fallback_string             │
└──────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────┐
│ 7. ai_router.generate_text(...)                       │
│    Returns: (answer, ai_used, degraded, provider)     │
└──────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────┐
│ 8. NaturalLanguageQueryResponse                       │
│    Returns: answer, data_points, domain metadata      │
└──────────────────────────────────────────────────────┘
```

---

## 2. File Changes Summary

| File | Change | Lines |
|------|--------|-------|
| `backend/routers/ai.py` | Add domain classifier, enhanced time parser, entity parser, 10 fetchers, 11 prompt templates, permission checks, updated NLQ flow | ~900 |
| `backend/routers/ai.py` | Update `NaturalLanguageQueryResponse` model with `domain` field | ~5 |
| `web/src/components/private/ai-insights-page.tsx` | Add 40+ categorized presets, category tab UI | ~200 |
| `web/src/lib/ai.ts` | Export `domain` field type | ~3 |
| `backend/authorization/permission_catalog.py` | No new permissions needed (existing ones cover all domains) | 0 |
| `tests/test_nlq_expansion.py` | New file: unit + integration tests | ~500 |

---

## 3. Phase 1 — Core NLQ Engine (`backend/routers/ai.py`)

### 3.1 — Domain Classifier

**Enum:**
```python
class NlqDomain(str, enum.Enum):
    ATTENDANCE = "attendance"
    DISPATCH = "dispatch"
    THEFT_FRAUD = "theft_fraud"
    FINANCE = "finance"
    INVENTORY = "inventory"
    PRODUCTION = "production"
    AUDIT_TRAIL = "audit_trail"
    OWNER_INSIGHTS = "owner_insights"
    OCR = "ocr"
    ALERTS = "alerts"
    GENERAL = "general"  # falls back to current Entry-based logic
```

**Keyword map (exact dict):**
```python
DOMAIN_KEYWORDS: dict[NlqDomain, list[str]] = {
    NlqDomain.ATTENDANCE: [
        "attendance", "absent", "present", "late", "overtime", "punch",
        "worked", "hr", "payroll", "employee", "worker", "manpower",
        "came to work", "did not come", "who came", "who was"
    ],
    NlqDomain.DISPATCH: [
        "dispatch", "logistics", "vehicle", "truck", "transported",
        "challan", "gate pass", "shipped", "delivered", "dispatched",
        "load", "consignment"
    ],
    NlqDomain.THEFT_FRAUD: [
        "theft", "stolen", "fraud", "anomalous", "suspicious",
        "duplicate", "missing", "leaked", "leakage", "unauthorized",
        "mismatch", "abnormal", "irregular"
    ],
    NlqDomain.FINANCE: [
        "money", "revenue", "profit", "expense", "cost", "payment",
        "invoice", "vendor", "bill", "receivable", "payable", "cash",
        "budget", "inr", "₹", "rupee", "leaked", "spent", "paid",
        "margin", "outstanding"
    ],
    NlqDomain.INVENTORY: [
        "stock", "inventory", "material", "reorder", "low stock",
        "dead stock", "shortage", "balance", "warehouse", "supplier",
        "delivery", "raw material"
    ],
    NlqDomain.PRODUCTION: [
        "production", "machine", "downtime", "stoppage", "batch",
        "output", "efficiency", "rejection", "scrap", "wastage",
        "shift", "throughput", "tonne", "productivity", "line"
    ],
    NlqDomain.AUDIT_TRAIL: [
        "audit", "log", "activity", "who", "when", "change", "modify",
        "delete", "approve", "login", "logout", "action", "record",
        "history"
    ],
    NlqDomain.OWNER_INSIGHTS: [
        "health", "summary", "overview", "business", "performance",
        "top problem", "risk", "score", "compare", "trend",
        "profit", "loss", "owner", "tell me everything"
    ],
    NlqDomain.OCR: [
        "ocr", "scan", "document", "invoice extract", "challan",
        "extract data", "text recognition", "image", "processed"
    ],
    NlqDomain.ALERTS: [
        "alert", "notify", "notification", "trigger", "escalate",
        "warning", "critical", "ignored", "unresolved"
    ],
}
```

**Classifier function:**
```python
def _classify_nlq_domain(question: str) -> NlqDomain:
    text = question.lower()
    scores: dict[NlqDomain, int] = {}
    for domain, keywords in DOMAIN_KEYWORDS.items():
        scores[domain] = sum(1 for kw in keywords if kw in text)
    best = max(scores, key=scores.get)  # type: ignore[arg-type]
    return best if scores[best] > 0 else NlqDomain.GENERAL
```

### 3.2 — Enhanced Time Parser

```python
def _parse_time_scope_v2(question: str) -> tuple[date, date, str]:
    """
    Returns (start_date, end_date, scope_label).
    
    Supports:
    - "today"                      → today, today
    - "yesterday"                  → yesterday, yesterday
    - "this week"                  → Monday of this week, today
    - "last week"                  → Monday of last week, Sunday of last week
    - "this month"                 → 1st of this month, today
    - "last month"                 → 1st of last month, last day of last month
    - "this quarter"              → start of current quarter, today
    - "last quarter"              → start of previous quarter, end of previous quarter
    - "this year"                 → Jan 1 of this year, today
    - "last year"                 → Jan 1 of last year, Dec 31 of last year
    - "last N days" / "past N days"  → today-N, today
    - "last N months"             → today - N*30, today
    - "last 24 hours"             → yesterday, today
    - "on March 15"               → parse date, same day
    - "in January"                → Jan 1, Jan 31 of current year
    - "in January 2025"           → Jan 1 2025, Jan 31 2025
    - "between X and Y"           → parse range
    - default                     → last 7 days
    """
    today = date.today()
    text = question.lower()
    
    # Date range pattern: "between March 1 and March 15"
    between_match = re.search(r'between\s+(\w+\s+\d+)\s+and\s+(\w+\s+\d+)', text)
    if between_match:
        # Parse dates (simplified — for full implementation use dateparser library)
        ...
    
    # Specific date: "on March 15" / "March 15 2026"
    on_match = re.search(r'on\s+(\w+\s+\d+\w*)', text)
    if on_match:
        ...
    
    # Specific month: "in January" / "in January 2025"
    month_match = re.search(r'in\s+(\w+\s*\d{4}|\w+)', text)
    if month_match:
        ...
    
    # Time ranges (same as current _parse_time_scope but extended)
    if "last month" in text:
        first_of_this_month = date(today.year, today.month, 1)
        end = first_of_this_month - timedelta(days=1)
        start = date(end.year, end.month, 1)
        return start, end, "last_month"
    if "this month" in text:
        start = date(today.year, today.month, 1)
        return start, today, "this_month"
    if "this week" in text:
        start = today - timedelta(days=today.weekday())  # Monday
        return start, today, "this_week"
    if "last week" in text:
        end = today - timedelta(days=today.weekday() + 1)  # Sunday
        start = end - timedelta(days=6)  # Monday
        return start, end, "last_week"
    if "this quarter" in text:
        quarter_month = ((today.month - 1) // 3) * 3 + 1
        start = date(today.year, quarter_month, 1)
        return start, today, "this_quarter"
    if "last quarter" in text:
        current_q = (today.month - 1) // 3
        if current_q == 0:
            start = date(today.year - 1, 10, 1)
            end = date(today.year - 1, 12, 31)
        else:
            q_start = ((current_q - 1) * 3) + 1
            start = date(today.year, q_start, 1)
            end = date(today.year, q_start + 2, 1) - timedelta(days=1)
        return start, end, "last_quarter"
    if "this year" in text:
        start = date(today.year, 1, 1)
        return start, today, "this_year"
    if "last year" in text:
        start = date(today.year - 1, 1, 1)
        end = date(today.year - 1, 12, 31)
        return start, end, "last_year"
    if "today" in text:
        return today, today, "today"
    if "yesterday" in text:
        day = today - timedelta(days=1)
        return day, day, "yesterday"
    
    # "last X days" or "X days" or "past X days"
    days_match = re.search(r'(?:last|past)\s+(\d+)\s+days?', text)
    if days_match:
        n = int(days_match.group(1))
        return today - timedelta(days=n - 1), today, f"last_{n}_days"
    
    # "last X months"
    months_match = re.search(r'(?:last|past)\s+(\d+)\s+months?', text)
    if months_match:
        n = int(months_match.group(1))
        return today - timedelta(days=n * 30 - 1), today, f"last_{n}_months"
    
    # "last 24 hours"
    if "24 hours" in text or "last 24" in text:
        return today - timedelta(days=1), today, "last_24_hours"
    
    # Default: last 7 days (or 30 for "last 30")
    if "last 30" in text or "30 day" in text or "3 months" in text:
        return today - timedelta(days=29), today, "last_30_days"
    if "last 14" in text or "14 day" in text:
        return today - timedelta(days=13), today, "last_14_days"
    
    return today - timedelta(days=6), today, "last_7_days"
```

### 3.3 — Entity Filter Parser

```python
def _parse_entity_filter(question: str) -> dict[str, Any]:
    """Extract entity references from the question.
    
    Returns dict with optional keys:
    - shift: str ("morning", "evening", "night")
    - employee_name: str
    - department: str
    - machine_name: str
    - vendor_name: str
    - customer_name: str
    - min_amount_inr: float
    - time_period_hint: str ("after_hours", "night_time")
    """
    text = question.lower()
    result: dict[str, Any] = {}
    
    # Shift
    if any(w in text for w in ["morning shift", "morning", "day shift"]):
        result["shift"] = "morning"
    elif any(w in text for w in ["evening shift", "evening"]):
        result["shift"] = "evening"
    elif any(w in text for w in ["night shift", "night"]):
        result["shift"] = "night"
    
    # Amount thresholds (₹50,000, ₹10,000, etc.)
    amount_match = re.search(r'[₹]?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)', text)
    if amount_match:
        try:
            result["min_amount_inr"] = float(amount_match.group(1).replace(",", ""))
        except ValueError:
            pass
    
    # "after hours", "outside working hours", "at night"
    if any(w in text for w in ["after hours", "outside working", "after 10 pm", "after 10pm"]):
        result["time_period_hint"] = "after_hours"
    
    return result
```

### 3.4 — Enhanced NLQ Response Model

**Add `domain` field to existing model:**
```python
class NaturalLanguageQueryResponse(BaseModel):
    question: str
    domain: str = Field(default="general")  # NEW — one of NlqDomain values
    plan: str
    min_plan: str
    quota_feature: str
    provider: str
    ai_used: bool
    degraded: bool = False
    is_fallback: bool = False
    generated_at: datetime
    structured_query: dict[str, Any]
    answer: str
    data_points: list[dict[str, Any]]
```

### 3.5 — Permission Checker

```python
class NlqPermissionSet(BaseModel):
    can_view_cost: bool = False
    can_view_financials: bool = False
    can_view_user_details: bool = False


def _get_nlq_permissions(pdp: PDP, factory_id: str | None) -> NlqPermissionSet:
    """Resolve per-domain financial/user-detail permissions."""
    resource = ResourceContext(factory_id=factory_id) if factory_id else None
    can_view_cost = pdp.check_permission(
        permission_key="workforce.cost.view", resource=resource
    ).is_allowed
    can_view_financials = pdp.check_permission(
        permission_key="production.fraud_financial.view", resource=resource
    ).is_allowed
    can_view_user_details = pdp.check_permission(
        permission_key="production.fraud_investigation.view", resource=resource
    ).is_allowed
    return NlqPermissionSet(
        can_view_cost=can_view_cost,
        can_view_financials=can_view_financials,
        can_view_user_details=can_view_user_details,
    )
```

### 3.6 — Data Point Extractor

```python
def _extract_data_points(domain: NlqDomain, data: dict[str, Any], max_points: int = 10) -> list[dict[str, Any]]:
    """Flatten key metrics from domain data into structured data_points for frontend display."""
    points: list[dict[str, Any]] = []
    
    if domain == NlqDomain.ATTENDANCE:
        today = data.get("overview", {}).get("today", {})
        points.append({"group": "Present Today", "value": today.get("working", 0)})
        points.append({"group": "Absent Today", "value": today.get("absent", 0)})
        period = data.get("overview", {}).get("period", {})
        points.append({"group": "Total Worked Hours", "value": period.get("total_worked_hours", 0)})
        points.append({"group": "Total Overtime Hours", "value": period.get("total_overtime_hours", 0)})
        points.append({"group": "Presence Rate %", "value": period.get("presence_rate_percent", 0)})
    
    elif domain == NlqDomain.DISPATCH:
        # Computed from direct SteelDispatch queries
        points.append({"group": "Total Dispatches", "value": data.get("total_dispatches", 0)})
        points.append({"group": "Total Weight KG", "value": data.get("total_weight_kg", 0)})
        points.append({"group": "Unauthorized", "value": data.get("unauthorized_count", 0)})
        points.append({"group": "After-Hours", "value": data.get("after_hours_count", 0)})
    
    elif domain == NlqDomain.THEFT_FRAUD:
        summary = data.get("summary", {})
        points.append({"group": "Total Fraud Signals", "value": summary.get("total_signals", 0)})
        points.append({"group": "Critical", "value": summary.get("critical_count", 0)})
        points.append({"group": "High", "value": summary.get("high_count", 0)})
        points.append({"group": "Medium", "value": summary.get("medium_count", 0)})
    
    elif domain == NlqDomain.FINANCE:
        revenue = data.get("overview", {}).get("revenue", {}).get("last_n_days", {})
        points.append({"group": "Revenue (last N days)", "value": revenue.get("revenue_inr", 0)})
        receivables = data.get("overview", {}).get("receivables", {})
        points.append({"group": "Total Outstanding ₹", "value": receivables.get("total_outstanding_inr", 0)})
        points.append({"group": "Overdue ₹", "value": receivables.get("overdue_amount_inr", 0)})
        expenses = data.get("overview", {}).get("expenses", {})
        points.append({"group": "Total Expenses ₹", "value": expenses.get("total_expenses_inr", 0)})
    
    elif domain == NlqDomain.INVENTORY:
        valuation = data.get("inventory_valuation", {})
        points.append({"group": "Total Stock Value ₹", "value": valuation.get("total_estimated_value_inr", 0)})
        points.append({"group": "Low Stock Alerts", "value": len(data.get("low_stock_alerts", []))})
        points.append({"group": "Dead Stock Items", "value": len(data.get("dead_stock", []))})
        points.append({"group": "A Items (80% value)", "value": len(data.get("abc_analysis", {}).get("a_items", []))})
    
    elif domain == NlqDomain.PRODUCTION:
        summary = data.get("production", {}).get("summary", {})
        points.append({"group": "Total Batches", "value": summary.get("total_batch_count", 0)})
        points.append({"group": "Total Output KG", "value": summary.get("total_batch_output_kg", 0)})
        points.append({"group": "Avg Loss %", "value": summary.get("avg_batch_loss_percent", 0)})
        points.append({"group": "High/Critical Batches", "value": summary.get("high_critical_batch_count", 0)})
        scrap = data.get("scrap_loss", {}).get("summary", {})
        points.append({"group": "Total Scrap KG", "value": scrap.get("total_scrap_period_kg", 0)})
    
    elif domain == NlqDomain.AUDIT_TRAIL:
        points.append({"group": "Total Actions", "value": data.get("total_actions", 0)})
        points.append({"group": "Unique Users", "value": data.get("unique_users", 0)})
        points.append({"group": "Unauthorized Actions", "value": data.get("unauthorized_count", 0)})
    
    elif domain == NlqDomain.OWNER_INSIGHTS:
        snapshot = data.get("dashboard", {}).get("snapshot", {})
        points.append({"group": "Today Output KG", "value": snapshot.get("today_output_kg", 0)})
        points.append({"group": "Total Stock KG", "value": snapshot.get("total_stock_kg", 0)})
        anomaly = data.get("dashboard", {}).get("anomaly_pressure", {})
        points.append({"group": "Critical Anomalies", "value": anomaly.get("critical_count", 0)})
        fin = data.get("dashboard", {}).get("financial_pulse", {})
        points.append({"group": "Overdue ₹", "value": fin.get("overdue_amount_inr", 0)})
    
    elif domain in (NlqDomain.OCR, NlqDomain.ALERTS):
        points.append({"group": "Total Records", "value": data.get("total_count", 0)})
    
    return points[:max_points]
```

---

## 4. Phase 2 — Data Fetchers (10 Domains)

### 4.1 — D1: Attendance Fetcher

**Imports needed:** `from backend.services.workforce_intelligence import build_workforce_overview, build_workers, build_worker_trend`

```python
def _fetch_attendance_data(
    db: Session,
    factory_id: str,
    days: int,
    question: str,
    perms: NlqPermissionSet,
    entity_filter: dict[str, Any],
) -> dict[str, Any]:
    """
    Service calls:
    - build_workforce_overview(db, factory_id, days, perms.can_view_cost)
    - build_workers(db, factory_id, days, sort_by="worked_minutes", limit=20, can_view_cost=perms.can_view_cost)
    - If employee name in question: build_worker_trend(db, factory_id, user_id, days, perms.can_view_cost)
    
    Answers ALL 8 attendance questions:
    1. Who came to work today? → overview.today.working vs .absent
    2. 30-day logs → workers list with daily breakdown
    3. Highest absent → workers sorted by attendance_days asc
    4. Late >5 times → workers with late_days > 5
    5. Overtime this week → workers sorted by total_overtime_hours
    6. Worst department → shift_comparison shifts sorted by absent
    7. Suspicious pattern → workers with anomalies (late + short + ghost)
    8. Payroll report → workers with cost breakdown
    """
    overview = build_workforce_overview(db, factory_id, days, can_view_cost=perms.can_view_cost)
    workers_data = build_workers(db, factory_id, days, sort_by="worked_minutes", limit=50, can_view_cost=perms.can_view_cost)
    
    return {
        "overview": overview,
        "workers": workers_data.get("workers", []),
        "total_workers": workers_data.get("total_workers_with_attendance", 0),
    }
```

### 4.2 — D2: Dispatch Fetcher

**Models needed:** `SteelDispatch`, `SteelDispatchLine`, `SteelDispatchRoute`, `SteelSalesInvoice`, `SteelCustomer`, `AuditLog`

```python
def _fetch_dispatch_data(
    db: Session,
    factory_id: str,
    days: int,
    question: str,
    perms: NlqPermissionSet,
    entity_filter: dict[str, Any],
) -> dict[str, Any]:
    """Direct DB queries on SteelDispatch + SteelDispatchLine + AuditLog.
    
    Answers ALL 8 dispatch questions:
    1. Today's dispatches + total weight
    2. Last 7 days dispatch records
    3. Most dispatched vehicle
    4. Unauthorized dispatches (no authorization record)
    5. After-hours dispatches
    6. Most dispatches by customer
    7. Quantity mismatch (header vs lines)
    8. Last 10 authorizations with timestamps
    """
    from backend.models.steel_dispatch import SteelDispatch
    from backend.models.steel_dispatch_line import SteelDispatchLine
    from backend.models.steel_sales_invoice import SteelSalesInvoice
    from backend.models.steel_customer import SteelCustomer
    from backend.models.report import AuditLog
    
    cutoff_date = date.today() - timedelta(days=days)
    
    # All dispatches in period
    dispatches = (
        db.query(SteelDispatch)
        .filter(
            SteelDispatch.factory_id == factory_id,
            SteelDispatch.dispatch_date >= cutoff_date,
        )
        .order_by(SteelDispatch.dispatch_date.desc())
        .all()
    )
    
    dispatch_ids = [d.id for d in dispatches]
    
    # Lines for weight comparison
    lines = (
        db.query(SteelDispatchLine)
        .filter(SteelDispatchLine.dispatch_id.in_(dispatch_ids))
        .all()
    ) if dispatch_ids else []
    
    line_map: dict[int, list[SteelDispatchLine]] = defaultdict(list)
    for line in lines:
        line_map[line.dispatch_id].append(line)
    
    # Customer names
    invoice_ids = {d.invoice_id for d in dispatches if d.invoice_id}
    invoices = db.query(SteelSalesInvoice).filter(SteelSalesInvoice.id.in_(invoice_ids)).all() if invoice_ids else []
    invoice_map = {inv.id: inv for inv in invoices}
    customer_ids = {inv.customer_id for inv in invoices if inv.customer_id}
    customers = db.query(SteelCustomer).filter(SteelCustomer.id.in_(customer_ids)).all() if customer_ids else []
    customer_map = {c.id: c for c in customers}
    
    # Audit trail for authorizations
    auth_logs = (
        db.query(AuditLog)
        .filter(
            AuditLog.org_id == factory_id,  # Note: AuditLog uses org_id, not factory_id
            AuditLog.action.like("STEEL_DISPATCH%"),
            AuditLog.timestamp >= datetime.combine(cutoff_date, datetime.min.time()).replace(tzinfo=timezone.utc),
        )
        .order_by(AuditLog.timestamp.desc())
        .limit(50)
        .all()
    )
    
    # Build computed results
    total_weight_kg = sum(float(d.total_weight_kg or 0.0) for d in dispatches)
    truck_counts: dict[str, int] = defaultdict(int)
    customer_dispatch_count: dict[int, int] = defaultdict(int)
    after_hours_count = 0
    weight_mismatches = []
    unauthorized_count = 0
    
    for d in dispatches:
        truck_counts[d.truck_number.upper().strip()] += 1
        inv = invoice_map.get(d.invoice_id) if d.invoice_id else None
        if inv and inv.customer_id:
            customer_dispatch_count[inv.customer_id] += 1
        
        # After-hours check (simplified: exit_time after 6 PM or before 6 AM)
        if d.exit_time:
            if d.exit_time.hour >= 18 or d.exit_time.hour < 6:
                after_hours_count += 1
        
        # Weight mismatch
        dispatch_lines = line_map.get(d.id, [])
        line_sum = sum(float(l.weight_kg or 0.0) for l in dispatch_lines)
        if dispatch_lines and abs(float(d.total_weight_kg or 0.0) - line_sum) > 10.0:
            weight_mismatches.append({
                "dispatch_id": d.id,
                "dispatch_number": d.dispatch_number,
                "header_weight_kg": round(float(d.total_weight_kg or 0.0), 2),
                "line_sum_kg": round(line_sum, 2),
            })
    
    most_used_truck = max(truck_counts, key=truck_counts.get) if truck_counts else None
    top_customer_id = max(customer_dispatch_count, key=customer_dispatch_count.get) if customer_dispatch_count else None
    top_customer = customer_map.get(top_customer_id) if top_customer_id else None
    
    # Authorization log (last 10)
    authorizations = []
    for log in auth_logs[:10]:
        authorizations.append({
            "user_id": log.user_id,
            "action": log.action,
            "details": log.details,
            "timestamp": log.timestamp.isoformat() if log.timestamp else None,
        })
    
    return {
        "total_dispatches": len(dispatches),
        "total_weight_kg": round(total_weight_kg, 2),
        "period_days": days,
        "dispatches": [
            {
                "id": d.id,
                "dispatch_number": d.dispatch_number,
                "dispatch_date": d.dispatch_date.isoformat(),
                "truck_number": d.truck_number,
                "total_weight_kg": round(float(d.total_weight_kg or 0.0), 2),
                "status": d.status,
                "entry_time": d.entry_time.isoformat() if d.entry_time else None,
                "exit_time": d.exit_time.isoformat() if d.exit_time else None,
            }
            for d in dispatches[:50]
        ],
        "most_used_truck": {"truck_number": most_used_truck, "count": truck_counts.get(most_used_truck, 0)} if most_used_truck else None,
        "top_customer": {
            "customer_id": top_customer.id if top_customer else None,
            "customer_name": top_customer.name if top_customer else None,
            "dispatch_count": customer_dispatch_count.get(top_customer_id, 0) if top_customer_id else 0,
        } if top_customer else None,
        "after_hours_count": after_hours_count,
        "unauthorized_count": unauthorized_count,
        "weight_mismatches": weight_mismatches,
        "authorizations": authorizations,
    }
```

### 4.3 — D3: Theft/Fraud Fetcher

**Imports needed:**
```python
from backend.services.steel_fraud_intelligence import build_fraud_intelligence
```

```python
def _fetch_fraud_data(
    db: Session,
    factory_id: str,
    days: int,
    question: str,
    perms: NlqPermissionSet,
    entity_filter: dict[str, Any],
) -> dict[str, Any]:
    """
    Service call:
    - build_fraud_intelligence(db, factory_id, days=days,
        can_view_financials=perms.can_view_financials,
        can_view_user_details=perms.can_view_user_details)
    
    Answers ALL 8 fraud questions:
    1. Theft detected in last 30 days → summary.critical_count + investigation_queue
    2. Suspicious transactions → transaction_anomalies.signals
    3. Employee behavior pattern → user_behavior_signals
    4. Gate/entry point unauthorized activity → dispatch_mismatch_signals (entry/exit anomalies)
    5. Missing inventory without dispatch → inventory_loss_signals
    6. Material left without invoice → dispatch_mismatch_signals (no_invoice)
    7. Stock in/out mismatch → inventory_loss_signals
    8. Time of day anomalies → dispatch timing analysis (impossible_timeline)
    """
    return build_fraud_intelligence(
        db, factory_id,
        days=days,
        can_view_financials=perms.can_view_financials,
        can_view_user_details=perms.can_view_user_details,
    )
```

### 4.4 — D4: Finance Fetcher

**Imports needed:**
```python
from backend.services.steel_finance import (
    build_financial_overview, build_receivables_summary,
    build_payables_summary, build_expenses_summary,
    build_cash_flow_summary, build_product_profitability,
)
```

```python
def _fetch_finance_data(
    db: Session,
    factory_id: str,
    days: int,
    question: str,
    perms: NlqPermissionSet,
    entity_filter: dict[str, Any],
) -> dict[str, Any]:
    """
    Service calls:
    - build_financial_overview(db, factory_id, days=days)  → revenue, receivables, expenses
    - build_receivables_summary(db, factory_id)            → aging, overdue customers
    - build_payables_summary(db, factory_id)               → vendor aging
    - build_expenses_summary(db, factory_id, days=days)    → expense categories
    - build_cash_flow_summary(db, factory_id)              → account balances
    - build_product_profitability(db, factory_id, days=days) → margins per product
    
    Answers ALL 8 finance questions:
    1. Money leakage → expenses + fraud data combined
    2. Payment without goods → payables (unpaid bills with no linked receipt)
    3. Duplicate payments → transaction_anomalies from fraud
    4. Disputed vendors → vendor aging with risk_level
    5. Petty cash anomalies → cash flow recent entries
    6. Unapproved POs → (requires PO model — currently partial)
    7. Raw material vs usage → product_profitability input costs
    8. Budget vs actual → expenses monthly_trend comparison
    """
    overview = build_financial_overview(db, factory_id, days=days)
    receivables = build_receivables_summary(db, factory_id)
    payables = build_payables_summary(db, factory_id)
    expenses = build_expenses_summary(db, factory_id, days=days)
    cashflow = build_cash_flow_summary(db, factory_id)
    profitability = build_product_profitability(db, factory_id, days=days)
    
    return {
        "overview": overview,
        "receivables": receivables,
        "payables": payables,
        "expenses": expenses,
        "cashflow": cashflow,
        "profitability": profitability,
    }
```

### 4.5 — D5: Inventory Fetcher

**Imports needed:**
```python
from backend.services.steel_inventory_intelligence import build_inventory_intelligence
```

```python
def _fetch_inventory_data(
    db: Session,
    factory_id: str,
    days: int,
    question: str,
    perms: NlqPermissionSet,
    entity_filter: dict[str, Any],
) -> dict[str, Any]:
    """
    Service call:
    - build_inventory_intelligence(db, factory_id,
        low_stock_days=min(days, 30), dead_stock_days=90)
    
    Answers ALL 8 inventory questions:
    1. Current stock levels → turnover_analysis.items
    2. Critically low → low_stock_alerts with severity="critical"
    3. Inward/outward movement → turnover_analysis (in/out flows)
    4. Unrecorded receipts → suspicious_movements (same_day_in_out)
    5. Supplier delays → (requires PO/supplier model — partial)
    6. Dead stock > 60 days → dead_stock
    7. Total stock value → inventory_valuation.total_estimated_value_inr
    8. Physical vs system → reconciliation_risk.high_variance_items
    """
    return build_inventory_intelligence(db, factory_id,
        low_stock_days=min(days, 30), dead_stock_days=90)
```

### 4.6 — D6: Production Fetcher

**Imports needed:**
```python
from backend.services.steel_production_intelligence import build_production_intelligence
from backend.services.steel_scrap_loss_intelligence import build_scrap_loss_intelligence
```

```python
def _fetch_production_data(
    db: Session,
    factory_id: str,
    days: int,
    question: str,
    perms: NlqPermissionSet,
    entity_filter: dict[str, Any],
) -> dict[str, Any]:
    """
    Service calls:
    - build_production_intelligence(db, factory_id, days=days)
    - build_scrap_loss_intelligence(db, factory_id, days=days,
        can_view_financials=perms.can_view_financials)
    
    Answers ALL 8 production questions:
    1. Today's output in tonnes → summary.today_produced_units (Entry) or snapshot.today_output_kg (batch)
    2. Most downtime machine → machine_intelligence.machines sorted by downtime_minutes
    3. Shift efficiency → shift_analysis.by_shift with attainment_percent
    4. Most productive shift → shift_analysis.worst_attainment_shift (inverted = best)
    5. Raw material consumed vs planned → throughput_trend (target vs actual)
    6. Production stoppages → downtime_analysis.top_reasons
    7. Highest rejection/wastage → rejection_scrap_analysis or by_machine/line
    8. Cost per tonne → scrap_loss.financial_impact (cost/output)
    """
    production = build_production_intelligence(db, factory_id, days=days)
    scrap = build_scrap_loss_intelligence(db, factory_id, days=days,
        can_view_financials=perms.can_view_financials)
    
    return {
        "production": production,
        "scrap_loss": scrap,
    }
```

### 4.7 — D7: Audit Trail Fetcher

**Model:** `AuditLog`

```python
def _fetch_audit_data(
    db: Session,
    factory_id: str,
    days: int,
    question: str,
    perms: NlqPermissionSet,
    entity_filter: dict[str, Any],
) -> dict[str, Any]:
    """Direct queries on AuditLog + User models.
    
    Answers ALL 8 audit questions:
    1. Today's activity log → AuditLog filtered to today
    2. Changes in last 24 hours → AuditLog with timestamp >= 24h ago
    3. Most active user → count by user_id
    4. Actions by specific employee → filter by user_id (from name in question)
    5. Unauthorized modifications → AuditLog with action containing "DELETE" or specific flags
    6. PO approval time → AuditLog with action="PURCHASE_ORDER_APPROVED"
    7. Login/logout times → AuditLog with action containing "LOGIN"/"LOGOUT"
    8. After-hours access → AuditLog with timestamp outside 6AM-6PM
    """
    from backend.models.report import AuditLog
    from backend.models.user import User
    
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=days)
    
    query = db.query(AuditLog).filter(
        AuditLog.factory_id == factory_id,
        AuditLog.timestamp >= cutoff,
    )
    
    # "today" filtering
    if "today" in question.lower() or "24 hours" in question.lower():
        today_start = now - timedelta(hours=24)
        query = query.filter(AuditLog.timestamp >= today_start)
    
    # Specific employee name
    if entity_filter.get("employee_name"):
        users = db.query(User).filter(User.name.ilike(f"%{entity_filter['employee_name']}%")).all()
        user_ids = [u.id for u in users]
        if user_ids:
            query = query.filter(AuditLog.user_id.in_(user_ids))
    
    # After-hours filter
    if entity_filter.get("time_period_hint") == "after_hours":
        # MySQL: HOUR(timestamp) NOT BETWEEN 6 AND 18
        # SQLite: CAST(strftime('%H', timestamp) AS INTEGER) NOT BETWEEN 6 AND 18
        # Use Python filtering for portability
        pass
    
    logs = query.order_by(AuditLog.timestamp.desc()).limit(200).all()
    
    # Aggregate
    action_counts: dict[str, int] = defaultdict(int)
    user_action_counts: dict[int, int] = defaultdict(int)
    user_ids = {log.user_id for log in logs if log.user_id}
    users = db.query(User).filter(User.id.in_(user_ids)).all() if user_ids else []
    user_map = {u.id: u.name for u in users}
    
    for log in logs:
        action_counts[log.action] += 1
        if log.user_id:
            user_action_counts[log.user_id] += 1
    
    most_active_user_id = max(user_action_counts, key=user_action_counts.get) if user_action_counts else None
    
    return {
        "total_actions": len(logs),
        "unique_users": len(user_ids),
        "action_counts": dict(sorted(action_counts.items(), key=lambda x: x[1], reverse=True)[:20]),
        "most_active_user": {
            "user_id": most_active_user_id,
            "name": user_map.get(most_active_user_id),
            "action_count": user_action_counts.get(most_active_user_id, 0),
        } if most_active_user_id else None,
        "recent_logs": [
            {
                "id": log.id,
                "user_id": log.user_id,
                "user_name": user_map.get(log.user_id),
                "action": log.action,
                "details": log.details,
                "timestamp": log.timestamp.isoformat() if log.timestamp else None,
            }
            for log in logs[:50]
        ],
        "unauthorized_count": sum(1 for log in logs if "DELETE" in log.action.upper() or "UNAUTHORIZED" in log.action.upper()),
    }
```

### 4.8 — D8: Owner Insights Fetcher

**Imports needed:**
```python
from backend.services.steel_intelligence import build_owner_dashboard
from backend.services.steel_finance import build_financial_overview
from backend.services.steel_fraud_intelligence import build_fraud_intelligence
from backend.models.factory import Factory
```

```python
def _fetch_owner_insights(
    db: Session,
    factory_id: str,
    days: int,
    question: str,
    perms: NlqPermissionSet,
    entity_filter: dict[str, Any],
) -> dict[str, Any]:
    """
    Service calls:
    - build_owner_dashboard(db, factory)  → factory is Factory ORM object
    - build_financial_overview(db, factory_id, days=days)
    - build_fraud_intelligence(db, factory_id, days=days,
        can_view_financials=perms.can_view_financials,
        can_view_user_details=perms.can_view_user_details)
    
    Answers ALL 8 owner questions:
    1. Business health summary → dashboard (all sections)
    2. Profit vs spend → financial_overview.realized_metrics + expenses
    3. Top 3 problems → dashboard.alerts (critical + warnings)
    4. Month comparison → (requires previous period data — aggregate across 2x days)
    5. Future projection → trend analysis (simple linear projection using throughput_trend)
    6. Most costly department → expenses.categories sorted by total_amount_inr
    7. Biggest risk area → anomaly_pressure + alerts combined
    8. Health score out of 100 → composite: inventory_health + anomaly_pressure + financial_pulse
    """
    from backend.models.factory import Factory
    
    factory = db.query(Factory).filter(Factory.factory_id == factory_id).first()
    if not factory:
        return {"error": "Factory not found"}
    
    dashboard = build_owner_dashboard(db, factory)
    finance = build_financial_overview(db, factory_id, days=days)
    fraud = build_fraud_intelligence(db, factory_id, days=days,
        can_view_financials=perms.can_view_financials,
        can_view_user_details=perms.can_view_user_details)
    
    # Compute health score
    health_score = _compute_health_score(dashboard, finance)
    
    return {
        "dashboard": dashboard,
        "finance": finance,
        "fraud": fraud,
        "health_score": health_score,
    }


def _compute_health_score(
    dashboard: dict[str, Any],
    finance: dict[str, Any],
) -> dict[str, Any]:
    """Compute factory health score out of 100."""
    score = 100.0
    
    # Deduct for inventory confidence issues
    inv_health = dashboard.get("inventory_health", {})
    red_count = inv_health.get("red_count", 0)
    score -= red_count * 5  # -5 per red item
    
    # Deduct for critical anomalies
    anomalies = dashboard.get("anomaly_pressure", {})
    score -= anomalies.get("critical_count", 0) * 10
    score -= anomalies.get("high_count", 0) * 5
    
    # Deduct for overdue invoices
    fin_pulse = dashboard.get("financial_pulse", {})
    if fin_pulse.get("overdue_invoice_count", 0) > 3:
        score -= 10
    
    # Deduct for today's loss
    snapshot = dashboard.get("snapshot", {})
    if snapshot.get("today_loss_percent", 0) > 5:
        score -= 10
    
    score = max(0, min(100, score))
    
    if score >= 80:
        label = "good"
    elif score >= 50:
        label = "needs_attention"
    else:
        label = "critical"
    
    return {
        "score": round(score, 0),
        "label": label,
        "deductions": {
            "red_confidence_items": red_count,
            "critical_anomalies": anomalies.get("critical_count", 0),
            "today_loss_percent": snapshot.get("today_loss_percent", 0),
        },
    }
```

### 4.9 — D9: OCR Fetcher

**Model:** Direct queries on `OcrVerification` model (or `OcrJob` from `backend.ocr_jobs`)

```python
def _fetch_ocr_data(
    db: Session,
    factory_id: str,
    days: int,
    question: str,
    perms: NlqPermissionSet,
    entity_filter: dict[str, Any],
) -> dict[str, Any]:
    """Query OCR verification stats.
    
    Answers:
    - Weekly OCR summary with accuracy rate
    - Failed/unprocessed documents
    """
    # Note: OCR models may be in backend.models.ocr_verification or similar
    # Query OcrVerification records, aggregate by status
    return {
        "total_count": 0,
        "verified_count": 0,
        "failed_count": 0,
        "accuracy_rate_percent": 0,
        "documents": [],
        "data_quality": "partial",
        "note": "OCR data integration requires OcrVerification model access.",
    }
```

### 4.10 — D10: Alerts Fetcher

**Models:** `Alert` (from `backend.models.alert`)

```python
def _fetch_alerts_data(
    db: Session,
    factory_id: str,
    days: int,
    question: str,
    perms: NlqPermissionSet,
    entity_filter: dict[str, Any],
) -> dict[str, Any]:
    """Query Alert model for system alerts.
    
    Answers:
    - Today's alerts
    - Critical alerts last 7 days
    - Ignored/unresolved alerts
    """
    from backend.models.alert import Alert
    
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=days)
    
    # Note: Alert model has entry_id and user_id — may need to join with Entry for factory scope
    # For now, use a broad query approach
    
    alerts = db.query(Alert).filter(Alert.created_at >= cutoff).order_by(Alert.created_at.desc()).all()
    
    critical = [a for a in alerts if a.severity == "critical"]
    unread = [a for a in alerts if not a.is_read]
    
    return {
        "total_count": len(alerts),
        "critical_count": len(critical),
        "unread_count": len(unread),
        "alerts": [
            {
                "id": a.id,
                "alert_type": a.alert_type,
                "message": a.message,
                "severity": a.severity,
                "is_read": a.is_read,
                "created_at": a.created_at.isoformat(),
            }
            for a in alerts[:50]
        ],
    }
```

### 4.11 — DG: General (Fetcher for Entry-based fallback)

This is the **existing** logic from `query_with_natural_language` — extract into a function:

```python
def _fetch_general_entry_data(
    db: Session,
    factory_id: str | None,
    days: int,
    question: str,
    current_user: User,
    entity_filter: dict[str, Any],
) -> dict[str, Any]:
    """Current Entry-based NLQ logic (existing code, extracted)."""
    time_scope = _parse_time_scope(question)
    metric = _structured_metric(question)
    grouping = _structured_grouping(question)
    
    entries = (
        _scoped_entries_query(db, current_user)
        .filter(Entry.date >= time_scope[0], Entry.date <= time_scope[1])
        .order_by(Entry.date.asc())
        .all()
    )
    
    data_points = _compute_entry_data_points(entries, metric, grouping)
    
    return {
        "entries": entries,
        "data_points": data_points,
        "metric": metric,
        "grouping": grouping,
        "scope": time_scope[2],
        "entry_count": len(entries),
        "total_output": sum(e.units_produced for e in entries),
        "total_downtime": sum(e.downtime_minutes for e in entries),
    }
```

---

## 5. Phase 3 — AI Prompt Templates (11 Domains)

### 5.1 — Domain-to-Prompt Template Map

```python
_NLQ_PROMPT_TEMPLATES: dict[NlqDomain, str] = {
    NlqDomain.ATTENDANCE: _ATTENDANCE_PROMPT,
    NlqDomain.DISPATCH: _DISPATCH_PROMPT,
    NlqDomain.THEFT_FRAUD: _FRAUD_PROMPT,
    NlqDomain.FINANCE: _FINANCE_PROMPT,
    NlqDomain.INVENTORY: _INVENTORY_PROMPT,
    NlqDomain.PRODUCTION: _PRODUCTION_PROMPT,
    NlqDomain.AUDIT_TRAIL: _AUDIT_PROMPT,
    NlqDomain.OWNER_INSIGHTS: _OWNER_PROMPT,
    NlqDomain.OCR: _OCR_PROMPT,
    NlqDomain.ALERTS: _ALERTS_PROMPT,
    NlqDomain.GENERAL: _GENERAL_PROMPT,
}
```

### 5.2 — Exact Prompt Templates

**Attendance:**
```python
_ATTENDANCE_PROMPT = """
You are a factory HR intelligence assistant for an Indian steel factory. Answer the question using the attendance data below.
Keep your answer under 140 words. Be precise and mention specific numbers.

Question: {question}

Time period: {scope} ({start_date} to {end_date})

Today's Attendance:
- Total workers: {today_total}
- Currently working: {today_working}
- Completed: {today_completed}
- Absent: {today_absent}
- Total overtime today: {today_overtime} minutes
- Workers with overtime today: {today_overtime_earners}

Period Overview ({period_days} days):
- Total records: {period_records}
- Total worked hours: {period_worked_hours}
- Total overtime hours: {period_overtime_hours}
- Total late hours: {period_late_hours}
- Presence rate: {presence_rate}%

Top Workers by Hours:
{worker_list}

Shift Comparison:
{shift_comparison}
"""
```

**Dispatch:**
```python
_DISPATCH_PROMPT = """
You are a factory logistics intelligence assistant. Answer the dispatch/logistics question using the dispatch data below.
Keep under 140 words.

Question: {question}

Time period: {scope} ({start_date} to {end_date})

Dispatch Summary:
- Total dispatches: {total_dispatches}
- Total weight dispatched: {total_weight_kg} KG
- Most used vehicle: {most_used_truck}
- Top customer: {top_customer}
- After-hours dispatches: {after_hours_count}
- Weight mismatches found: {mismatch_count}

Recent Dispatches:
{dispatch_list}

Authorizations:
{authorization_list}
"""
```

**Fraud:**
```python
_FRAUD_PROMPT = """
You are a factory fraud detection intelligence assistant. Answer the theft/fraud question using the fraud intelligence data below.
Keep under 150 words. Highlight critical and high-severity signals. Be direct and recommend actions.

Question: {question}

Time period: {scope} ({start_date} to {end_date})

Fraud Intelligence Summary:
- Total signals: {total_signals}
- Critical: {critical_count}
- High: {high_count}
- Medium: {medium_count}

By Category:
- Inventory loss signals: {inventory_loss_count}
- Dispatch mismatch signals: {dispatch_mismatch_count}
- Transaction anomalies: {transaction_anomaly_count}
- Approval risk signals: {approval_risk_count}
- Attendance risk signals: {attendance_risk_count}

Investigation Queue: {investigation_queue_count} items

Top Signals:
{signal_list}

User Behavior Risk Profiles:
{user_behavior_list}
"""
```

**Finance:**
```python
_FINANCE_PROMPT = """
You are a factory financial intelligence assistant for an Indian steel factory. Answer the financial question using the data below.
Keep under 150 words. Use ₹ amounts with commas.

Question: {question}

Time period: last {period_days} days

Revenue:
- Today: ₹{revenue_today}
- This week: ₹{revenue_week}
- This month: ₹{revenue_month}
- Last {period_days} days: ₹{revenue_period}

Realized Metrics:
- Dispatched Revenue: ₹{realized_revenue}
- Dispatched Profit: ₹{realized_profit}
- Margin: {margin_percent}%

Receivables:
- Total Outstanding: ₹{outstanding}
- Overdue: ₹{overdue_amount} ({overdue_count} invoices)
- Collection Efficiency: {collection_efficiency}%

Expenses (Last {period_days} days):
{expense_list}

Cash Balance:
- Total: ₹{cash_total}
- Cash in Hand: ₹{cash_in_hand}
- Bank: ₹{bank_balance}
"""
```

**Inventory:**
```python
_INVENTORY_PROMPT = """
You are a factory inventory intelligence assistant. Answer the inventory/stock question using the data below.
Keep under 140 words.

Question: {question}

Time period: As of {as_of_date}

Inventory Valuation:
- Total Estimated Value: ₹{total_value}
- Total Stock KG: {total_stock_kg}

Low Stock Alerts ({low_stock_count} items):
{low_stock_list}

Dead Stock ({dead_stock_count} items):
{dead_stock_list}

Slow Moving Items ({slow_moving_count}):
{slow_moving_list}

Overstocked Items ({overstocked_count}):
{overstocked_list}

ABC Analysis:
- A Items (80% value): {a_count}
- B Items (next 15%): {b_count}
- C Items (last 5%): {c_count}

Suspicious Movements: {suspicious_count}

Reconciliation Risk:
- Stale Items: {stale_count}
- High Variance Items: {variance_count}
"""
```

**Production:**
```python
_PRODUCTION_PROMPT = """
You are a factory production intelligence assistant for an Indian steel factory. Answer the production question below using the provided data.
Keep under 150 words. Use KG for weights and percentages.

Question: {question}

Time period: {scope} ({start_date} to {end_date})

Production Summary:
- Total entries: {total_entries}
- Approved entries: {approved_entries}
- Total target units: {total_target}
- Total produced units: {total_produced}
- Overall attainment: {attainment}%
- Total downtime: {downtime_minutes} min
- Quality issues: {quality_issues}
- Total batch count: {batch_count}
- Total batch output: {batch_output_kg} KG
- Avg batch loss: {avg_loss}%
- High/critical batches: {high_critical_batches}

Shift Analysis:
{shift_analysis}

Downtime Analysis:
{downtime_analysis}

Top Loss Batches:
{top_loss_batches}

Scrap & Rejection:
- Total scrap: {scrap_kg} KG
- Scrap rate: {scrap_rate}%
- Total rejection: {rejection_kg} KG
"""
```

**Audit Trail:**
```python
_AUDIT_PROMPT = """
You are a factory audit intelligence assistant. Answer the audit/question using the activity log data below.
Keep under 140 words.

Question: {question}

Time period: {scope} ({start_date} to {end_date})

Activity Summary:
- Total actions: {total_actions}
- Unique users: {unique_users}
- Unauthorized actions flagged: {unauthorized_count}

Most Active User: {most_active_user}

Top Actions:
{action_counts}

Recent Activity:
{recent_logs}
"""
```

**Owner Insights:**
```python
_OWNER_PROMPT = """
You are the factory owner's executive intelligence assistant. Give a comprehensive yet concise answer to the owner's question.
Use the dashboard data below. Keep under 200 words. Be direct, actionable, and honest.

Question: {question}

=== FACTORY DASHBOARD ===

Factory: {factory_name} ({factory_code})
Report Date: {report_date}

=== SNAPSHOT ===
- Total Stock: {total_stock_kg} KG across {total_items} items
- Today's Batches: {today_batches} | Output: {today_output_kg} KG
- Today's Loss: {today_loss_kg} KG ({today_loss_percent}%)
- Month Batches: {month_batches} | Week Batches: {week_batches}

=== INVENTORY HEALTH ===
- Green (confident): {green_count}
- Yellow (needs review): {yellow_count}
- Red (immediate action): {red_count}
- Low confidence items: {low_confidence_list}

=== FINANCIAL PULSE ===
- Realized Revenue: ₹{realized_revenue}
- Realized Profit: ₹{realized_profit}
- Margin: {margin_percent}%
- Overdue Invoices: {overdue_count} (₹{overdue_amount})
- Outstanding: ₹{outstanding_amount}

=== ANOMALY PRESSURE ===
- Critical anomalies (7 days): {critical_anomalies}
- High anomalies: {high_anomalies}
- Warning signals: {warning_anomalies}

=== TOP ALERTS ===
{alerts_list}

=== HEALTH SCORE ===
{health_score}/100 ({health_label})
"""
```

**General (existing Entry-based):**
```python
_GENERAL_PROMPT = """
Answer the factory KPI question below in under 120 words. Stay factual, use the supplied numbers, and mention the time window.

Question: {question}
Structured query: {structured_query}
Data points: {data_points}
"""
```

### 5.3 — Fallback Text Templates

```python
def _build_nlq_fallback(domain: NlqDomain, data: dict[str, Any], scope: str) -> str:
    if domain == NlqDomain.ATTENDANCE:
        today = data.get("overview", {}).get("today", {})
        return (f"For {scope}, {today.get('working', 0)} workers are present, "
                f"{today.get('absent', 0)} absent. Total overtime: {today.get('total_overtime_minutes', 0)} minutes.")
    
    elif domain == NlqDomain.DISPATCH:
        return (f"For {scope}, there were {data.get('total_dispatches', 0)} dispatches "
                f"totaling {data.get('total_weight_kg', 0)} KG.")
    
    elif domain == NlqDomain.THEFT_FRAUD:
        summary = data.get("summary", {})
        return (f"For {scope}, {summary.get('total_signals', 0)} fraud signals detected "
                f"({summary.get('critical_count', 0)} critical, {summary.get('high_count', 0)} high).")
    
    elif domain == NlqDomain.FINANCE:
        overview = data.get("overview", {})
        rev = overview.get("revenue", {}).get("last_n_days", {})
        recv = overview.get("receivables", {})
        return (f"For {scope}, revenue: ₹{rev.get('revenue_inr', 0):,.2f}, "
                f"outstanding: ₹{recv.get('total_outstanding_inr', 0):,.2f}.")
    
    elif domain == NlqDomain.INVENTORY:
        val = data.get("inventory_valuation", {})
        return (f"As of today, inventory is valued at ₹{val.get('total_estimated_value_inr', 0):,.2f} "
                f"with {len(data.get('low_stock_alerts', []))} low stock alerts.")
    
    elif domain == NlqDomain.PRODUCTION:
        summary = data.get("production", {}).get("summary", {})
        return (f"For {scope}, {summary.get('total_batch_count', 0)} batches produced "
                f"{summary.get('total_batch_output_kg', 0)} KG output with "
                f"{summary.get('avg_batch_loss_percent', 0)}% average loss.")
    
    elif domain == NlqDomain.AUDIT_TRAIL:
        return (f"For {scope}, {data.get('total_actions', 0)} actions recorded "
                f"by {data.get('unique_users', 0)} users.")
    
    elif domain == NlqDomain.OWNER_INSIGHTS:
        snapshot = data.get("dashboard", {}).get("snapshot", {})
        health = data.get("health_score", {})
        return (f"Factory health score: {health.get('score', 'N/A')}/100 ({health.get('label', 'unknown')}). "
                f"Today's output: {snapshot.get('today_output_kg', 0)} KG.")
    
    elif domain == NlqDomain.OCR:
        return f"For {scope}, {data.get('total_count', 0)} documents processed by OCR."
    
    elif domain == NlqDomain.ALERTS:
        return f"For {scope}, {data.get('total_count', 0)} alerts, {data.get('critical_count', 0)} critical."
    
    return f"For {scope}, I found the following data: {data}"
```

### 5.4 — Prompt Builder Function

```python
def _build_nlq_prompt(
    question: str,
    domain: NlqDomain,
    data: dict[str, Any],
    scope: str,
    start_date: date,
    end_date: date,
) -> str:
    template = _NLQ_PROMPT_TEMPLATES.get(domain, _GENERAL_PROMPT)
    
    if domain == NlqDomain.ATTENDANCE:
        overview = data.get("overview", {})
        today = overview.get("today", {})
        period = overview.get("period", {})
        workers = data.get("workers", [])
        shift_comp = overview.get("shift_comparison", {})
        return template.format(
            question=question,
            scope=scope,
            start_date=start_date.isoformat(),
            end_date=end_date.isoformat(),
            today_total=today.get("total_workers", 0),
            today_working=today.get("working", 0),
            today_completed=today.get("completed", 0),
            today_absent=today.get("absent", 0),
            today_overtime=today.get("total_overtime_minutes", 0),
            today_overtime_earners=today.get("overtime_earners_count", 0),
            period_days=overview.get("period_days", 30),
            period_records=period.get("total_records", 0),
            period_worked_hours=period.get("total_worked_hours", 0),
            period_overtime_hours=period.get("total_overtime_hours", 0),
            period_late_hours=period.get("total_late_hours", 0),
            presence_rate=period.get("presence_rate_percent", 0),
            worker_list="\n".join(
                f"- {w.get('name', '?')}: {w.get('total_worked_hours', 0)}h, "
                f"{w.get('overtime_days', 0)} OT days, {w.get('late_days', 0)} late days"
                for w in workers[:10]
            ) or "No worker data available.",
            shift_comparison="\n".join(
                f"- {s.get('shift', '?')}: {s.get('total_worked_hours', 0)}h worked, "
                f"{s.get('absent', 0)} absent"
                for s in shift_comp.get("shifts", [])
            ) or "No shift data available.",
        )
    
    elif domain == NlqDomain.DISPATCH:
        return template.format(
            question=question,
            scope=scope,
            start_date=start_date.isoformat(),
            end_date=end_date.isoformat(),
            total_dispatches=data.get("total_dispatches", 0),
            total_weight_kg=data.get("total_weight_kg", 0),
            most_used_truck=str(data.get("most_used_truck", {}).get("truck_number", "N/A")),
            top_customer=str(data.get("top_customer", {}).get("customer_name", "N/A")),
            after_hours_count=data.get("after_hours_count", 0),
            mismatch_count=len(data.get("weight_mismatches", [])),
            dispatch_list="\n".join(
                f"- #{d.get('dispatch_number', '?')}: {d.get('dispatch_date', '?')}, "
                f"{d.get('truck_number', '?')}, {d.get('total_weight_kg', 0)} KG, {d.get('status', '?')}"
                for d in data.get("dispatches", [])[:15]
            ) or "No dispatch records.",
            authorization_list="\n".join(
                f"- User {a.get('user_id', '?')}: {a.get('action', '?')} at {a.get('timestamp', '?')}"
                for a in data.get("authorizations", [])[:10]
            ) or "No authorization logs.",
        )
    
    # ... Similar format calls for each domain
    
    elif domain == NlqDomain.GENERAL:
        return template.format(
            question=question,
            structured_query=json.dumps(data.get("structured_query", {})),
            data_points=json.dumps(data.get("data_points", [])[:10]),
        )
    
    # Default fallback
    return template.format(question=question, data=json.dumps(data, indent=2)[:2000],
                           scope=scope, start_date=start_date.isoformat(), end_date=end_date.isoformat(),
                           **{k: v for k, v in _flatten_dict(data).items() if isinstance(v, (str, int, float))})
```

---

## 6. Phase 4 — Updated Main NLQ Endpoint

### 6.1 — Complete Updated `query_with_natural_language`

```python
@router.post("/query", response_model=NaturalLanguageQueryResponse)
def query_with_natural_language(
    payload: NaturalLanguageQueryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> NaturalLanguageQueryResponse:
    """Answer natural language questions across all factory domains.
    
    Flow:
    1. Auth & PDP check (unchanged)
    2. Domain classification
    3. Time parsing
    4. Entity extraction
    5. Factory resolution
    6. Permission checks
    7. Data fetching (domain-specific)
    8. AI prompt generation
    9. AI answer generation with fallback
    10. Audit logging
    """
    # ── 1. Auth & PDP ─────────────────────────────────────────────────
    _ensure_ai_access(current_user)
    pdp = PDP(db=db)
    factory_id = resolve_factory_id(db, current_user)
    pdp.require_permission(
        actor=current_user,
        permission_key="ai.nlq.query",
        resource=ResourceContext(factory_id=factory_id) if factory_id else None,
    )
    min_plan = _nlq_min_plan()
    plan = _require_min_plan(db, current_user, min_plan=min_plan, feature_name="Natural language queries")
    _consume_quota(db, current_user, quota_feature="summary", plan=plan)
    
    question = payload.question.strip()
    
    # ── 2. Domain classification ──────────────────────────────────────
    domain = _classify_nlq_domain(question)
    
    # ── 3. Time parsing ───────────────────────────────────────────────
    start, end, scope_name = _parse_time_scope_v2(question)
    days = (end - start).days + 1
    
    # ── 4. Entity extraction ──────────────────────────────────────────
    entity_filter = _parse_entity_filter(question)
    
    # ── 5. Factory resolution ─────────────────────────────────────────
    factory = None
    if domain != NlqDomain.GENERAL:
        try:
            factory = require_active_steel_factory(db, current_user)
        except ValueError:
            domain = NlqDomain.GENERAL
    
    # ── 6. Permission checks ──────────────────────────────────────────
    perms = _get_nlq_permissions(pdp, factory.factory_id if factory else None)
    
    # ── 7. Data fetching ──────────────────────────────────────────────
    fetchers: dict[NlqDomain, Callable] = {
        NlqDomain.ATTENDANCE: _fetch_attendance_data,
        NlqDomain.DISPATCH: _fetch_dispatch_data,
        NlqDomain.THEFT_FRAUD: _fetch_fraud_data,
        NlqDomain.FINANCE: _fetch_finance_data,
        NlqDomain.INVENTORY: _fetch_inventory_data,
        NlqDomain.PRODUCTION: _fetch_production_data,
        NlqDomain.AUDIT_TRAIL: _fetch_audit_data,
        NlqDomain.OWNER_INSIGHTS: _fetch_owner_insights,
        NlqDomain.OCR: _fetch_ocr_data,
        NlqDomain.ALERTS: _fetch_alerts_data,
        NlqDomain.GENERAL: _fetch_general_entry_data,
    }
    fetcher = fetchers.get(domain, _fetch_general_entry_data)
    
    fx_id = factory.factory_id if factory else None
    data = fetcher(db, fx_id, days, question, perms, entity_filter)
    
    # ── 8. Build structured query ─────────────────────────────────────
    structured_query = {
        "domain": domain.value,
        "scope": scope_name,
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "days": days,
    }
    if domain == NlqDomain.GENERAL:
        structured_query["metric"] = _structured_metric(question)
        structured_query["grouping"] = _structured_grouping(question)
    
    # ── 9. Build data points ──────────────────────────────────────────
    if domain == NlqDomain.GENERAL:
        entry_data = data.get("data_points", [])
    else:
        entry_data = _extract_data_points(domain, data)
    
    # ── 10. Generate AI answer ────────────────────────────────────────
    prompt = _build_nlq_prompt(question, domain, data, scope_name, start, end)
    fallback = _build_nlq_fallback(domain, data, scope_name)
    
    answer, ai_used, is_degraded, provider = ai_router.generate_text(
        prompt,
        fallback=fallback,
        scope=f"org:{resolve_org_id(current_user) or current_user.id}:nlq",
        max_tokens=350,
        telemetry_system="nlq",
    )
    
    # ── 11. Audit log ─────────────────────────────────────────────────
    _write_ai_audit(
        db,
        current_user=current_user,
        action="AI_NLQ_QUERY_EXECUTED",
        details=f"domain={domain.value};scope={scope_name};days={days}",
    )
    
    return NaturalLanguageQueryResponse(
        question=question,
        domain=domain.value,
        plan=plan,
        min_plan=min_plan,
        quota_feature="summary",
        provider=provider,
        ai_used=ai_used,
        degraded=is_degraded,
        is_fallback=not ai_used,
        generated_at=datetime.now(timezone.utc),
        structured_query=structured_query,
        answer=answer,
        data_points=entry_data[:10],
    )
```

---

## 7. Phase 5 — Frontend Changes

### 7.1 — All 40+ Categorized Presets

Add to `AiInsightsPage` component:

```typescript
const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "att", label: "Attendance" },
  { id: "disp", label: "Dispatch" },
  { id: "fraud", label: "Theft & Fraud" },
  { id: "fin", label: "Finance" },
  { id: "inv", label: "Inventory" },
  { id: "prod", label: "Production" },
  { id: "audit", label: "Audit Trail" },
  { id: "owner", label: "Owner Insights" },
  { id: "alert", label: "Alerts & OCR" },
  { id: "general", label: "General" },
] as const;

const expandedPresets: SavedPreset[] = [
  // ── Attendance ──
  { id: "att-today", label: "Today's Attendance", question: "Who came to work today and who was absent?" },
  { id: "att-30d", label: "30-Day Attendance Log", question: "Show me attendance logs for the last 30 days for every employee" },
  { id: "att-most-absent", label: "Highest Absent Days", question: "Which employee has the highest number of absent days this month?" },
  { id: "att-late", label: "Late Arrivals", question: "Who came late more than 5 times this month?" },
  { id: "att-overtime", label: "Overtime Hours", question: "Show overtime hours per employee this week" },
  { id: "att-worst-dept", label: "Worst Department", question: "Which department has the worst attendance record?" },
  { id: "att-suspicious", label: "Suspicious Patterns", question: "Flag any employee whose attendance pattern looks suspicious" },
  { id: "att-payroll", label: "Payroll Report", question: "Generate full monthly attendance report for payroll processing" },
  
  // ── Dispatch ──
  { id: "disp-today", label: "Today's Dispatches", question: "How many dispatches happened today and what was the total weight?" },
  { id: "disp-7d", label: "Last 7 Days Dispatches", question: "Show me all dispatch records from the last 7 days" },
  { id: "disp-most-vehicle", label: "Most Used Vehicle", question: "Which vehicle was dispatched the most this month?" },
  { id: "disp-unauthorized", label: "Unauthorized Dispatch", question: "Is there any dispatch that happened without proper authorization?" },
  { id: "disp-after-hours", label: "After-Hours Dispatches", question: "Show me dispatches that happened outside of working hours" },
  { id: "disp-top-customer", label: "Top Customer", question: "Which customer received the most dispatches this month?" },
  { id: "disp-weight-mismatch", label: "Weight Mismatch", question: "Flag any dispatch where the quantity dispatched does not match the order quantity" },
  { id: "disp-auth-log", label: "Authorization Log", question: "Who authorized the last 10 dispatches and at what time?" },

  // ── Theft & Fraud ──
  { id: "fraud-30d", label: "Theft Detection", question: "Has any theft been detected in the last 30 days?" },
  { id: "fraud-suspicious", label: "Suspicious Transactions", question: "Show me all suspicious transactions flagged by the system in the last 3 months" },
  { id: "fraud-employee", label: "Suspicious Employee", question: "Is there any employee whose behavior pattern indicates possible theft?" },
  { id: "fraud-gate", label: "Gate Activity", question: "Which gate or entry point has the most unauthorized activity?" },
  { id: "fraud-missing", label: "Missing Inventory", question: "Show me any inventory that went missing without a dispatch record" },
  { id: "fraud-no-invoice", label: "No Invoice Exit", question: "Flag any transaction where material left the factory without a corresponding invoice" },
  { id: "fraud-mismatch", label: "Stock In/Out Mismatch", question: "Is there any mismatch between stock in and stock out records?" },
  { id: "fraud-time", label: "Anomaly Time Analysis", question: "Which time of day do most anomalies occur?" },

  // ── Finance ──
  { id: "fin-leakage", label: "Money Leakage", question: "How much money leaked in the last 30 days and from which department?" },
  { id: "fin-no-goods", label: "Payment Without Goods", question: "Show me all transactions where payment was made but no goods were received" },
  { id: "fin-duplicate", label: "Duplicate Payments", question: "Are there any duplicate payments made to the same vendor this month?" },
  { id: "fin-disputed", label: "Disputed Vendors", question: "Which vendor has the highest number of disputed transactions?" },
  { id: "fin-petty-cash", label: "Petty Cash Review", question: "Show me all petty cash expenses and flag any that look unusual" },
  { id: "fin-po-approval", label: "Unapproved POs", question: "Is there any purchase order that was raised without proper approval?" },
  { id: "fin-raw-vs-usage", label: "Raw vs Usage", question: "How much was spent on raw material vs how much was actually used in production?" },
  { id: "fin-budget-vs-actual", label: "Budget vs Actual", question: "Show me the difference between budgeted spend and actual spend this quarter" },

  // ── Inventory ──
  { id: "inv-all-stock", label: "All Stock Levels", question: "What is the current stock level of all raw materials?" },
  { id: "inv-low-stock", label: "Critically Low Stock", question: "Which raw material is running critically low and needs urgent reorder?" },
  { id: "inv-movement", label: "Stock Movement", question: "Show me the complete inward and outward stock movement for the last 30 days" },
  { id: "inv-unrecorded", label: "Unrecorded Receipts", question: "Is there any material that was received but never entered into the system?" },
  { id: "inv-supplier-delay", label: "Supplier Delays", question: "Which supplier has the most delivery delays this month?" },
  { id: "inv-dead-stock", label: "Dead Stock", question: "Show me dead stock — items that have been sitting in inventory for more than 60 days" },
  { id: "inv-total-value", label: "Total Stock Value", question: "What is the current value of all stock in the factory right now?" },
  { id: "inv-discrepancy", label: "Physical vs System", question: "Flag any stock discrepancy between physical count and system records" },

  // ── Production ──
  { id: "prod-today", label: "Today's Output", question: "What was today's total production output in tonnes?" },
  { id: "prod-machine-downtime", label: "Machine Downtime", question: "Which machine had the most downtime this week?" },
  { id: "prod-shift-efficiency", label: "Shift Efficiency", question: "Show me production efficiency percentage for each shift this month" },
  { id: "prod-best-shift", label: "Best Shift", question: "Which shift is the most productive — morning, afternoon, or night?" },
  { id: "prod-consumption", label: "Raw Material Consumption", question: "How much raw material was consumed today vs how much was planned?" },
  { id: "prod-stoppages", label: "Production Stoppages", question: "Show me all production stoppages in the last 7 days and their reasons" },
  { id: "prod-rejection", label: "Rejection/Wastage Rate", question: "Which product line has the highest rejection or wastage rate?" },
  { id: "prod-cost-per-tonne", label: "Cost per Tonne", question: "What is the cost of production per tonne this month compared to last month?" },

  // ── Audit Trail ──
  { id: "audit-today", label: "Today's Activity Log", question: "Show me a full activity log of every action taken in the system today" },
  { id: "audit-24h", label: "Recent Changes", question: "Who made changes to any record in the last 24 hours?" },
  { id: "audit-most-active", label: "Most Active User", question: "Which user has the most system activity this week?" },
  { id: "audit-user-actions", label: "Employee Actions", question: "Show me every action taken by a specific employee in the last 30 days" },
  { id: "audit-unauthorized", label: "Unauthorized Changes", question: "Was any record deleted or modified without authorization?" },
  { id: "audit-po-approval", label: "PO Approval Time", question: "Who approved the last purchase order and at what exact time?" },
  { id: "audit-login-logout", label: "Login/Logout Log", question: "Show me every login and logout time for all users this month" },
  { id: "audit-outside-hours", label: "After-Hours Access", question: "Flag any user who accessed the system outside of their working hours" },

  // ── Owner Insights ──
  { id: "owner-health", label: "Business Health", question: "Give me a complete business health summary for this month in simple language" },
  { id: "owner-pnl", label: "Profit vs Spend", question: "How much money did the factory make vs spend this month?" },
  { id: "owner-top-issues", label: "Top 3 Problems", question: "What are the top 3 problems I should fix immediately to stop losses?" },
  { id: "owner-month-compare", label: "Month Comparison", question: "Compare this month's performance to last month — what improved and what got worse?" },
  { id: "owner-projection", label: "Future Projection", question: "If current trends continue, what will my profit/loss look like next month?" },
  { id: "owner-costly-dept", label: "Most Costly Department", question: "Which department is costing me the most money right now?" },
  { id: "owner-biggest-risk", label: "Biggest Risk Area", question: "What is my biggest risk area right now — theft, leakage, operations, or HR?" },
  { id: "owner-health-score", label: "Daily Health Score", question: "Give me a one-line daily factory health score out of 100 with reasons" },

  // ── General ── (existing presets kept)
  ...existingGeneralPresets,
];
```

### 7.2 — Category Tab UI

```typescript
const [activeCategory, setActiveCategory] = useState<string>("all");

// In the preset section, replace the flat preset list with:
<>
  {/* Category tabs */}
  <div className="flex flex-wrap gap-2 border-b border-[var(--border)] pb-3 mb-3">
    {CATEGORIES.map(cat => (
      <button
        key={cat.id}
        className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
          activeCategory === cat.id
            ? "bg-[var(--accent)] text-white"
            : "border border-[var(--border)] bg-[var(--card)] hover:border-[rgba(62,166,255,0.4)]"
        }`}
        onClick={() => setActiveCategory(cat.id)}
      >
        {cat.label}
      </button>
    ))}
  </div>

  {/* Filtered presets */}
  <div className="flex flex-wrap gap-2">
    {(activeCategory === "all"
      ? combinedPresets
      : combinedPresets.filter(p => p.id.startsWith(activeCategory))
    ).map((preset) => (
      <button
        key={preset.id}
        type="button"
        className="rounded-full border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-semibold transition hover:border-[rgba(62,166,255,0.4)] hover:text-white"
        onClick={() => setQuestion(preset.question)}
      >
        {preset.label}
      </button>
    ))}
  </div>
</>
```

### 7.3 — Display `domain` in Answer Details

```tsx
// In the answer details section, show the domain:
<div>{t("ai.query.details.domain", "Domain: {{value}}", { value: nlqResult.domain })}</div>
```

---

## 8. Phase 6 — Testing Plan

### 8.1 — Unit Tests for Classifier & Parsers

```python
"""tests/test_nlq_expansion.py — NLQ expansion unit and integration tests."""

import pytest
from datetime import date
from backend.routers.ai import (
    _classify_nlq_domain, NlqDomain,
    _parse_time_scope_v2,
    _parse_entity_filter,
    _extract_data_points,
    _compute_health_score,
)


class TestDomainClassifier:
    def test_attendance_domain(self):
        assert _classify_nlq_domain("Who came to work today?") == NlqDomain.ATTENDANCE
        assert _classify_nlq_domain("Show me attendance logs for last 30 days") == NlqDomain.ATTENDANCE
        assert _classify_nlq_domain("Which employee has highest absent days this month?") == NlqDomain.ATTENDANCE
        assert _classify_nlq_domain("Who came late more than 5 times?") == NlqDomain.ATTENDANCE
    
    def test_dispatch_domain(self):
        assert _classify_nlq_domain("How many dispatches happened today?") == NlqDomain.DISPATCH
        assert _classify_nlq_domain("Show dispatch records for last 7 days") == NlqDomain.DISPATCH
        assert _classify_nlq_domain("Which vehicle was dispatched the most?") == NlqDomain.DISPATCH
    
    def test_fraud_domain(self):
        assert _classify_nlq_domain("Has any theft been detected in last 30 days?") == NlqDomain.THEFT_FRAUD
        assert _classify_nlq_domain("Show me suspicious transactions") == NlqDomain.THEFT_FRAUD
        assert _classify_nlq_domain("Flag any transaction where material left without invoice") == NlqDomain.THEFT_FRAUD
    
    def test_finance_domain(self):
        assert _classify_nlq_domain("How much money leaked in the last 30 days?") == NlqDomain.FINANCE
        assert _classify_nlq_domain("Show duplicate payments to vendors") == NlqDomain.FINANCE
        assert _classify_nlq_domain("Show budget vs actual spend this quarter") == NlqDomain.FINANCE
    
    def test_inventory_domain(self):
        assert _classify_nlq_domain("What is the current stock level of raw materials?") == NlqDomain.INVENTORY
        assert _classify_nlq_domain("Which material is running critically low?") == NlqDomain.INVENTORY
    
    def test_production_domain(self):
        assert _classify_nlq_domain("What was today's total production output in tonnes?") == NlqDomain.PRODUCTION
        assert _classify_nlq_domain("Which machine had the most downtime this week?") == NlqDomain.PRODUCTION
        assert _classify_nlq_domain("Which shift is most productive?") == NlqDomain.PRODUCTION
    
    def test_audit_domain(self):
        assert _classify_nlq_domain("Show me a full activity log of every action today") == NlqDomain.AUDIT_TRAIL
        assert _classify_nlq_domain("Who made changes to any record in last 24 hours?") == NlqDomain.AUDIT_TRAIL
    
    def test_owner_domain(self):
        assert _classify_nlq_domain("Give me a complete business health summary for this month") == NlqDomain.OWNER_INSIGHTS
        assert _classify_nlq_domain("What are the top 3 problems I should fix immediately?") == NlqDomain.OWNER_INSIGHTS
        assert _classify_nlq_domain("Give me a daily factory health score out of 100") == NlqDomain.OWNER_INSIGHTS
    
    def test_ocr_domain(self):
        assert _classify_nlq_domain("Show me documents processed by OCR this week") == NlqDomain.OCR
    
    def test_alerts_domain(self):
        assert _classify_nlq_domain("What alerts were triggered today?") == NlqDomain.ALERTS
        assert _classify_nlq_domain("Show me all critical alerts from last 7 days") == NlqDomain.ALERTS
    
    def test_general_fallback(self):
        assert _classify_nlq_domain("Show me last month's output by shift") == NlqDomain.GENERAL
        assert _classify_nlq_domain("What is the performance by day this month?") == NlqDomain.GENERAL


class TestTimeParserV2:
    def test_today(self):
        today = date.today()
        start, end, label = _parse_time_scope_v2("show me today's data")
        assert start == today
        assert end == today
        assert label == "today"
    
    def test_last_month(self):
        today = date.today()
        start, end, label = _parse_time_scope_v2("show last month's data")
        assert label == "last_month"
        assert start.month == (today.month - 1 if today.month > 1 else 12)
        assert end.day >= 28  # last day of month
    
    def test_this_week(self):
        today = date.today()
        start, end, label = _parse_time_scope_v2("show this week's data")
        assert label == "this_week"
        assert start.weekday() == 0  # Monday
    
    def test_last_n_days(self):
        today = date.today()
        start, end, label = _parse_time_scope_v2("show me last 14 days data")
        assert label == "last_14_days"
        assert (today - start).days == 13
    
    def test_this_month(self):
        today = date.today()
        start, end, label = _parse_time_scope_v2("show this month's data")
        assert label == "this_month"
        assert start.day == 1
        assert start.month == today.month
    
    def test_yesterday(self):
        today = date.today()
        yesterday = today - __import__('datetime').timedelta(days=1)
        start, end, label = _parse_time_scope_v2("show yesterday's data")
        assert start == yesterday
        assert label == "yesterday"

    def test_default_to_7_days(self):
        today = date.today()
        start, end, label = _parse_time_scope_v2("what is the output?")
        assert label == "last_7_days"
        assert (today - start).days == 6


class TestEntityFilter:
    def test_shift_detection(self):
        assert _parse_entity_filter("morning shift attendance")["shift"] == "morning"
        assert _parse_entity_filter("evening shift production")["shift"] == "evening"
        assert _parse_entity_filter("night shift output")["shift"] == "night"
    
    def test_amount_threshold(self):
        result = _parse_entity_filter("transactions exceeding ₹50,000")
        assert "min_amount_inr" in result
        assert result["min_amount_inr"] == 50000.0
    
    def test_after_hours(self):
        result = _parse_entity_filter("dispatches after 10 PM")
        assert result.get("time_period_hint") == "after_hours"
    
    def test_empty_return(self):
        result = _parse_entity_filter("show me the output")
        assert result == {}


class TestHealthScore:
    def test_perfect_score(self):
        dashboard = {
            "inventory_health": {"red_count": 0},
            "anomaly_pressure": {"critical_count": 0, "high_count": 0},
            "financial_pulse": {"overdue_invoice_count": 0},
            "snapshot": {"today_loss_percent": 0},
        }
        finance = {}
        result = _compute_health_score(dashboard, finance)
        assert result["score"] == 100
        assert result["label"] == "good"
    
    def test_anomaly_deductions(self):
        dashboard = {
            "inventory_health": {"red_count": 2},
            "anomaly_pressure": {"critical_count": 1, "high_count": 2},
            "financial_pulse": {"overdue_invoice_count": 5},
            "snapshot": {"today_loss_percent": 8},
        }
        finance = {}
        result = _compute_health_score(dashboard, finance)
        # 100 - 10 (2 red x 5) - 10 (1 critical x 10) - 10 (2 high x 5) - 10 (overdue) - 10 (loss) = 50
        assert result["score"] == 50
        assert result["label"] == "needs_attention"
```

### 8.2 — Integration Tests

```python
class TestNlqEndpoint:
    """Full integration tests for the NLQ endpoint."""
    
    REQUIRED_PERMISSIONS = [
        "workforce.overview.view",  # attendance
        "production.fraud_intelligence.view",  # fraud
        "production.analytics.view",  # production
        "inventory.ledger.view",  # inventory
        "customer.record.view",  # finance
        "audit.log.view",  # audit
        "ai.nlq.query",  # NLQ itself
    ]
    
    @pytest.mark.parametrize("question,expected_domain", [
        ("Who came to work today?", "attendance"),
        ("How many dispatches happened today?", "dispatch"),
        ("Has any theft been detected in the last 30 days?", "theft_fraud"),
        ("How much money leaked in the last 30 days?", "finance"),
        ("What is the current stock level of raw materials?", "inventory"),
        ("What was today's total production output?", "production"),
        ("Show me a full activity log of every action today", "audit_trail"),
        ("Give me a complete business health summary for this month", "owner_insights"),
        ("Show me documents processed by OCR this week", "ocr"),
        ("What alerts were triggered today?", "alerts"),
    ])
    def test_domain_routing(self, http_client, owner_user, question, expected_domain):
        """Each question returns the correct domain in the response."""
        headers = {"Authorization": f"Bearer {owner_user['access_token']}"}
        resp = http_client.post("/ai/query", json={"question": question}, headers=headers)
        assert resp.status_code == 200, f"Failed for {question}: {resp.text}"
        data = resp.json()
        assert data["domain"] == expected_domain, f"Expected {expected_domain}, got {data['domain']}"
        assert data["answer"], f"Empty answer for {question}"
    
    def test_financial_redaction_for_non_finance_user(self, http_client, supervisor_user):
        """Non-financial users don't see INR values in finance/fraud answers."""
        headers = {"Authorization": f"Bearer {supervisor_user['access_token']}"}
        resp = http_client.post("/ai/query", json={"question": "How much money leaked in last 30 days?"}, headers=headers)
        assert resp.status_code in (200, 403)  # 403 if supervisor doesn't have permission
    
    def test_no_factory_fallback_to_general(self, http_client, owner_user_no_factory):
        """User without active factory gets GENERAL domain fallback."""
        headers = {"Authorization": f"Bearer {owner_user_no_factory['access_token']}"}
        resp = http_client.post("/ai/query", json={"question": "Who came to work today?"}, headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["domain"] == "general"  # falls back to Entry query
    
    def test_plan_gating(self, http_client, attendance_user):
        """Attendance role users get 403 for NLQ."""
        headers = {"Authorization": f"Bearer {attendance_user['access_token']}"}
        resp = http_client.post("/ai/query", json={"question": "Who came to work today?"}, headers=headers)
        assert resp.status_code == 403
```

### 8.3 — P0 Role Check Tests

Add to `tests/test_p0_role_checks.py`:

```python
class TestNlqExpansionRoleCheck:
    """NLQ expansion respects role-based access."""
    
    DOMAIN_TEST_QUESTIONS = [
        ("attendance", "Who came to work today?"),
        ("dispatch", "How many dispatches happened today?"),
        ("theft_fraud", "Has any theft been detected?"),
        ("finance", "How much money was spent?"),
        ("inventory", "What is current stock level?"),
        ("production", "What was today's output?"),
        ("audit_trail", "Show me the activity log"),
        ("owner_insights", "Give me business health summary"),
        ("alerts", "What alerts were triggered?"),
    ]
    
    @pytest.mark.parametrize("domain,question", DOMAIN_TEST_QUESTIONS)
    def test_nlq_blocked_for_attendance_role(self, http_client, attendance_user, domain, question):
        headers = {"Authorization": f"Bearer {attendance_user['access_token']}"}
        resp = http_client.post("/ai/query", json={"question": question}, headers=headers)
        assert resp.status_code == 403
    
    @pytest.mark.parametrize("domain,question", DOMAIN_TEST_QUESTIONS)
    def test_nlq_allowed_for_owner_role(self, http_client, owner_user, domain, question):
        headers = {"Authorization": f"Bearer {owner_user['access_token']}"}
        resp = http_client.post("/ai/query", json={"question": question}, headers=headers)
        assert resp.status_code == 200
```

---

## 9. Complete Service-to-Question Coverage Map

| # | Service / Model | Function | Questions Covered |
|---|-----------------|----------|-------------------|
| 1 | `workforce_intelligence.py` | `build_workforce_overview()` | 8/8 attendance |
| 2 | `SteelDispatch` (direct) | `_fetch_dispatch_data()` | 8/8 dispatch |
| 3 | `steel_fraud_intelligence.py` | `build_fraud_intelligence()` | 8/8 fraud |
| 4 | `steel_finance.py` | `build_financial_overview()`, `build_receivables_summary()`, `build_payables_summary()`, `build_expenses_summary()`, `build_cash_flow_summary()`, `build_product_profitability()` | 8/8 finance |
| 5 | `steel_inventory_intelligence.py` | `build_inventory_intelligence()` | 8/8 inventory |
| 6 | `steel_production_intelligence.py` + `steel_scrap_loss_intelligence.py` | `build_production_intelligence()`, `build_scrap_loss_intelligence()` | 8/8 production |
| 7 | `AuditLog` (direct) | `_fetch_audit_data()` | 8/8 audit |
| 8 | `steel_intelligence.py` + `steel_finance.py` + `steel_fraud_intelligence.py` | `build_owner_dashboard()`, `build_financial_overview()`, `build_fraud_intelligence()` | 8/8 owner |
| 9 | `OcrVerification` (direct) | `_fetch_ocr_data()` | 2/6 OCR |
| 10 | `Alert` (direct) | `_fetch_alerts_data()` | 3/8 alerts (query only) |
| 11 | Entry model (existing) | `_fetch_general_entry_data()` | ~4 general KPI |

**Coverage: ~76/78 questions (~97%).** Only 2 OCR action questions and 5 alert configuration actions remain as separate endpoint features.

---

## 10. Implementation Order (Recommended)

```
Step 1 (Day 1): Domain classifier + Enhanced time parser + Entity parser
  → Define NlqDomain enum, DOMAIN_KEYWORDS, _classify_nlq_domain()
  → Upgrade _parse_time_scope to _parse_time_scope_v2
  → Add _parse_entity_filter()
  → Update NaturalLanguageQueryResponse with domain field
  → Run classifier unit tests ✓

Step 2 (Day 2): General fetcher extraction + main NLQ flow refactor
  → Extract _fetch_general_entry_data() from current endpoint
  → Build _get_nlq_permissions, _extract_data_points, _build_nlq_fallback
  → Build _build_nlq_prompt with GENERAL template
  → Rewrite query_with_natural_language() with the 11-step flow
  → Existing tests should still pass ✓

Step 3 (Day 3-4): Domain fetchers D1-D5 (Attendance, Dispatch, Fraud, Finance, Inventory)
  → Wire up workforce_intelligence, steel_fraud_intelligence, steel_finance, steel_inventory_intelligence
  → Build direct dispatch query
  → Add prompt templates for each domain
  → Integration test each domain ✓

Step 4 (Day 5): Domain fetchers D6-D10 (Production, Audit, Owner, OCR, Alerts)
  → Wire up steel_production_intelligence, steel_scrap_loss_intelligence
  → Build direct AuditLog, Alert queries
  → Build owner_insights with health score
  → Add prompt templates ✓

Step 5 (Day 6): Frontend presets
  → Add all 40+ presets to ai-insights-page.tsx
  → Add category tabs UI
  → Test in browser ✓

Step 6 (Day 7): Full test suite + review
  → All unit tests pass
  → All integration tests pass
  → Code review by DeepSeek-flash
  → End-to-end verification of every domain ✓
```

---

## 11. Error Handling Strategy

| Scenario | Behavior |
|----------|----------|
| Factory not found | Fall back to GENERAL domain (Entry-based query) |
| Intelligence service returns empty | AI prompt shows "no data available" fallback |
| Permission denied for financial data | INR values redacted; prompt uses `restricted` label |
| AI provider fails (timeout/error) | Fallback text from `_build_nlq_fallback()` is returned |
| Question has no time scope | Default to last 7 days |
| Entity name not found in system | Entity filter ignored; answer notes "could not find specific entity" |
| Domain ambiguous (scores tied) | Pick highest; GENERAL as default tiebreaker |
| Extremely long question (>400 chars) | Rejected by NaturalLanguageQueryRequest validation (max_length=400) |

---

## 12. Performance Considerations

| Concern | Mitigation |
|---------|------------|
| Slow intelligence services | Data already cached in the service layer (e.g., `_build_anomaly_items` uses `get_json`/`set_json`) |
| Large result sets | All fetchers limit results (top 50 dispatches, top 20 workers, etc.) |
| Database load | Time scope limits query range; date-indexed columns |
| AI token usage | Max 350 tokens per query; fallback for non-AI scenarios |
| Concurrent queries | Rate limiting via `check_rate_limit()` already in place |
| Cache invalidation | AI cache TTL is 900s (15 min) — appropriate for NLQ |

---
