"""Phase 7 AI insights router for suggestions, anomalies, NLQ, and executive summaries."""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
import enum
import os
import re
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from backend.ai_rate_limit import RateLimitError, check_rate_limit
from backend.cache import build_cache_key, get_json, set_json
from backend.database import SessionLocal, get_db
from backend.ai.monitoring.telemetry import record_ai_event
from backend.dependencies.quota import consume_ai_quota
from backend.models.entry import Entry, ShiftType
from backend.models.report import AuditLog
from backend.models.user import User, UserRole
from backend.ocr_limits import get_org_usage_summary, get_usage_summary
from backend.authorization import PDP, ResourceContext
from backend.plans import get_org_plan, normalize_plan, plan_rank
from backend.query_helpers import apply_org_scope, apply_role_scope
from backend.security import get_current_user
from backend.services import ai_router
from backend.services.background_jobs import create_job, get_job, register_retry_handler, start_job
from backend.services.coil_theft_service import detect_coil_theft
from backend.services.workforce_intelligence import build_workforce_overview
from backend.services.steel_finance import build_financial_overview
from backend.services.steel_fraud_intelligence import build_fraud_intelligence
from backend.services.steel_inventory_intelligence import build_inventory_intelligence as build_inv_intel
from backend.services.steel_production_intelligence import build_production_intelligence
from backend.services.steel_intelligence import build_owner_dashboard
from backend.services.steel_service import require_active_steel_factory as _require_steel_factory
from backend.services.nlq_language import (
    detect_language as _detect_language,
    normalize_question as _normalize_question,
    get_hindi_keywords_for_domain as _get_hindi_keywords_for_domain,
    HINDI_RESPONSE_INSTRUCTION as _HINDI_RESPONSE_INSTRUCTION,
)
from backend.models.steel_dispatch import SteelDispatch
from backend.models.alert import Alert as AlertModel
from backend.tenancy import resolve_factory_id, resolve_org_id


router = APIRouter(tags=["AI"])

DEFAULT_SUGGESTIONS_LOOKBACK_DAYS = int(os.getenv("AI_SUGGESTIONS_LOOKBACK_DAYS", "60"))
DEFAULT_ANOMALY_DAYS = int(os.getenv("AI_ANOMALY_DEFAULT_DAYS", "14"))
AI_CACHE_TTL = int(os.getenv("AI_CACHE_TTL_SECONDS", "900"))


class NlqDomain(str, enum.Enum):
    """NLQ query domain classification."""
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
    GENERAL = "general"


DOMAIN_KEYWORDS: dict[NlqDomain, list[str]] = {
    NlqDomain.ATTENDANCE: [
        "attendance", "absent", "present", "late", "overtime", "punch",
        "worked", "hr", "payroll", "employee", "worker", "manpower",
        "came to work", "did not come", "who came", "who was",
    ],
    NlqDomain.DISPATCH: [
        "dispatch", "logistics", "vehicle", "truck", "transported",
        "challan", "gate pass", "shipped", "delivered", "dispatched",
        "load", "consignment",
    ],
    NlqDomain.THEFT_FRAUD: [
        "theft", "stolen", "fraud", "anomalous", "suspicious",
        "duplicate", "missing", "leaked", "leakage", "unauthorized",
        "mismatch", "abnormal", "irregular",
    ],
    NlqDomain.FINANCE: [
        "money", "revenue", "profit", "expense", "cost", "payment",
        "invoice", "vendor", "bill", "receivable", "payable", "cash",
        "budget", "inr", "\u20b9", "rupee", "leaked", "spent", "paid",
        "margin", "outstanding",
    ],
    NlqDomain.INVENTORY: [
        "stock", "inventory", "material", "reorder", "low stock",
        "dead stock", "shortage", "balance", "warehouse", "supplier",
        "delivery", "raw material",
    ],
    NlqDomain.PRODUCTION: [
        "production", "machine", "downtime", "stoppage", "batch",
        "output", "efficiency", "rejection", "scrap", "wastage",
        "shift", "throughput", "tonne", "productivity", "line",
    ],
    NlqDomain.AUDIT_TRAIL: [
        "audit", "log", "activity", "who", "when", "change", "modify",
        "delete", "approve", "login", "logout", "action", "record",
        "history",
    ],
    NlqDomain.OWNER_INSIGHTS: [
        "health", "summary", "overview", "business", "performance",
        "top problem", "risk", "score", "compare", "trend",
        "profit", "loss", "owner", "tell me everything",
    ],
    NlqDomain.OCR: [
        "ocr", "scan", "document", "invoice extract", "challan",
        "extract data", "text recognition", "image", "processed",
    ],
    NlqDomain.ALERTS: [
        "alert", "notify", "notification", "trigger", "escalate",
        "warning", "critical", "ignored", "unresolved",
    ],
}


# ── Per-domain cache TTL (Phase 2: smart caching) ───────────────────────
NLQ_CACHE_TTL_BY_DOMAIN: dict[NlqDomain, int] = {
    NlqDomain.THEFT_FRAUD: 30,
    NlqDomain.ALERTS: 30,
    NlqDomain.ATTENDANCE: 300,
    NlqDomain.DISPATCH: 300,
    NlqDomain.OWNER_INSIGHTS: 120,
    NlqDomain.FINANCE: 900,
    NlqDomain.INVENTORY: 900,
    NlqDomain.OCR: 900,
    NlqDomain.GENERAL: 900,
    NlqDomain.PRODUCTION: 600,
    NlqDomain.AUDIT_TRAIL: 180,
}

# ── Multi-domain fusion patterns (Phase 2) ───────────────────────────────
MULTI_DOMAIN_PATTERNS: list[tuple[frozenset[NlqDomain], list[str]]] = [
    (frozenset({NlqDomain.ATTENDANCE, NlqDomain.FINANCE}), ["cost", "costly", "spend", "expensive"]),
    (frozenset({NlqDomain.PRODUCTION, NlqDomain.FINANCE}), ["raw material", "spend", "cost", "budget"]),
    (frozenset({NlqDomain.THEFT_FRAUD, NlqDomain.FINANCE}), ["leaked", "leakage", "cost", "money"]),
    (frozenset({NlqDomain.DISPATCH, NlqDomain.THEFT_FRAUD}), ["dispatch", "mismatch", "discrepancy"]),
    (frozenset({NlqDomain.AUDIT_TRAIL, NlqDomain.DISPATCH}), ["who changed", "dispatch"]),
    (frozenset({NlqDomain.AUDIT_TRAIL, NlqDomain.FINANCE}), ["who changed", "invoice", "payment"]),
    (frozenset({NlqDomain.PRODUCTION, NlqDomain.FINANCE}), ["scrap", "cost", "batch", "loss"]),
]


@dataclass
class NlqPermissionSet:
    """Tracks which NLQ domains the current user has permission to access.

    Each flag corresponds to a PDP permission key. If a flag is False,
    the NLQ endpoint will gracefully degrade for that domain rather than
    returning a 403 error.
    """
    can_view_attendance: bool = False
    can_view_dispatch: bool = False
    can_view_finance: bool = False
    can_view_inventory: bool = False
    can_view_production: bool = False
    can_view_fraud: bool = False
    can_view_audit: bool = False
    can_view_ocr: bool = False
    can_view_alerts: bool = False
    can_view_owner_insights: bool = False
    can_view_analytics: bool = False


class AiUsageResponse(BaseModel):
    plan: str
    period: str
    summary_used: int
    summary_limit: int
    email_used: int
    email_limit: int
    smart_used: int
    smart_limit: int
    suggestion_min_plan: str
    anomaly_min_plan: str
    nlq_min_plan: str
    executive_min_plan: str


class SuggestionResponse(BaseModel):
    date: str
    shift: ShiftType
    plan: str
    min_plan: str
    quota_feature: str
    provider: str
    ai_used: bool
    degraded: bool = False
    is_fallback: bool = False
    reference_entries: int
    generated_at: datetime
    suggestion: dict[str, Any]
    recent_patterns: list[str]
    rationale: str


class AnomalyItem(BaseModel):
    entry_id: int
    date: str
    shift: str
    severity: str
    anomaly_type: str
    message: str
    value: float
    baseline: float


class AnomalyResponse(BaseModel):
    days: int
    plan: str
    min_plan: str
    quota_feature: str
    provider: str
    ai_used: bool
    degraded: bool = False
    is_fallback: bool = False
    generated_at: datetime
    summary: str
    items: list[AnomalyItem]


class NaturalLanguageQueryRequest(BaseModel):
    question: str = Field(min_length=4, max_length=400)


class ActionItem(BaseModel):
    """A recommended action derived from an NLQ query."""
    priority: int = Field(default=1, ge=1, le=5)
    action: str
    reason: str
    estimated_impact_inr: float | None = None
    deadline: str | None = None  # "today", "this week", "urgent"


class NaturalLanguageQueryResponse(BaseModel):
    question: str
    domain: str = Field(default="general")
    language: str = Field(default="english")
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
    action_items: list[ActionItem] = []
    health_score: int | None = None
    health_label: str | None = None


class ExecutiveSummaryResponse(BaseModel):
    start_date: str
    end_date: str
    plan: str
    min_plan: str
    quota_feature: str
    provider: str
    ai_used: bool
    degraded: bool = False
    is_fallback: bool = False
    generated_at: datetime
    metrics: dict[str, Any]
    summary: str


def _provider_label() -> str:
    return ai_router.primary_provider_label() if ai_router.has_any_key() else "fallback"


def _min_plan(env_key: str, default: str) -> str:
    return normalize_plan(os.getenv(env_key) or default)


def _suggestion_min_plan() -> str:
    return _min_plan("AI_SUGGESTIONS_MIN_PLAN", "pilot")


def _anomaly_min_plan() -> str:
    return _min_plan("AI_ANOMALIES_MIN_PLAN", "pilot")


def _nlq_min_plan() -> str:
    return _min_plan("AI_NLQ_MIN_PLAN", "operations")


def _executive_min_plan() -> str:
    return _min_plan("AI_EXECUTIVE_MIN_PLAN", "pilot")


def _scoped_entries_query(db: Session, current_user: User):
    query = db.query(Entry).filter(Entry.is_active.is_(True))
    query = apply_org_scope(query, current_user)
    return apply_role_scope(query, db, current_user)


def _ai_cache_key(db: Session, current_user: User, *parts: Any) -> str:
    return build_cache_key(
        "org",
        resolve_org_id(current_user) or "personal",
        "factory",
        resolve_factory_id(db, current_user) or "all",
        "ai",
        current_user.id,
        *parts,
    )


def _ensure_ai_access(current_user: User) -> None:
    if current_user.role == UserRole.ATTENDANCE:
        raise HTTPException(status_code=403, detail="Attendance role only has attendance access.")


def _require_min_plan(db: Session, current_user: User, *, min_plan: str, feature_name: str) -> str:
    org_id = resolve_org_id(current_user)
    plan = get_org_plan(db, org_id=org_id, fallback_user_id=current_user.id)
    if plan_rank(plan) < plan_rank(min_plan):
        raise HTTPException(
            status_code=402,
            detail=f"{feature_name} is not available on the {plan.title()} plan. Upgrade to {min_plan.title()} or higher to unlock this.",
        )
    return plan


def _consume_quota(db: Session, current_user: User, *, quota_feature: str, plan: str) -> None:
    del plan
    try:
        check_rate_limit(current_user.id, feature=quota_feature)
    except RateLimitError as error:
        raise HTTPException(status_code=429, detail=error.detail) from error
    org_id = resolve_org_id(current_user)
    if org_id:
        consume_ai_quota(db, org_id=org_id, feature=quota_feature)


def _write_ai_audit(
    db: Session,
    *,
    current_user: User,
    action: str,
    details: str,
) -> None:
    db.add(
        AuditLog(
            user_id=current_user.id,
            org_id=resolve_org_id(current_user),
            factory_id=resolve_factory_id(db, current_user),
            action=action,
            details=details,
            ip_address=None,
            timestamp=datetime.now(timezone.utc),
        )
    )
    db.commit()


def _safe_average(values: list[float | int]) -> float:
    if not values:
        return 0.0
    return round(sum(float(value) for value in values) / len(values), 2)


def _build_anomaly_items(entries: list[Entry]) -> tuple[list[AnomalyItem], dict[str, float]]:
    performance_values = [_entry_performance(entry) for entry in entries if entry.units_target]
    downtime_values = [entry.downtime_minutes for entry in entries]
    absent_values = [entry.manpower_absent for entry in entries]
    baselines = {
        "performance": _safe_average(performance_values),
        "downtime": _safe_average(downtime_values),
        "absent": _safe_average(absent_values),
    }

    items: list[AnomalyItem] = []
    for entry in entries:
        performance = _entry_performance(entry)
        if performance and performance < max(70.0, baselines["performance"] - 15.0):
            items.append(
                AnomalyItem(
                    entry_id=entry.id,
                    date=entry.date.isoformat(),
                    shift=str(entry.shift),
                    severity="high" if performance < max(60.0, baselines["performance"] - 25.0) else "medium",
                    anomaly_type="low_output",
                    message=f"Output dropped to {performance:.1f}% against a baseline of {baselines['performance']:.1f}%.",
                    value=performance,
                    baseline=baselines["performance"],
                )
            )
        if float(entry.downtime_minutes) > max(60.0, baselines["downtime"] * 1.75 if baselines["downtime"] else 60.0):
            items.append(
                AnomalyItem(
                    entry_id=entry.id,
                    date=entry.date.isoformat(),
                    shift=str(entry.shift),
                    severity="high" if entry.downtime_minutes > max(90.0, baselines["downtime"] * 2.25 if baselines["downtime"] else 90.0) else "medium",
                    anomaly_type="downtime_spike",
                    message=f"Downtime hit {entry.downtime_minutes} minutes versus a baseline of {baselines['downtime']:.1f}.",
                    value=float(entry.downtime_minutes),
                    baseline=baselines["downtime"],
                )
            )
        if float(entry.manpower_absent) > max(3.0, baselines["absent"] + 2.0):
            items.append(
                AnomalyItem(
                    entry_id=entry.id,
                    date=entry.date.isoformat(),
                    shift=str(entry.shift),
                    severity="medium",
                    anomaly_type="absentee_spike",
                    message=f"Absentee count reached {entry.manpower_absent} against a baseline of {baselines['absent']:.1f}.",
                    value=float(entry.manpower_absent),
                    baseline=baselines["absent"],
                )
            )
    return items[:12], baselines


def _anomaly_fallback_summary(items: list[AnomalyItem], *, days: int) -> str:
    if items:
        top_text = "; ".join(item.message for item in items[:4])
        return f"{len(items)} anomaly signals were found in the last {days} days. Top signals: {top_text}"
    return f"No meaningful anomalies were found in the last {days} days. Current performance is moving close to the recent baseline."


def _fallback_suggestion_text(patterns: list[str], *, shift: str) -> str:
    if not patterns:
        return f"No strong historical pattern is available for the {shift} shift yet, so start with a careful manual DPR and confirm actual output early."
    return f"For the {shift} shift, history suggests this pattern: " + " ".join(patterns[:3])


def _build_suggestion_prompt(*, shift: str, date_value: str, patterns: list[str], suggestion: dict[str, Any]) -> str:
    return (
        "You are an operations copilot for a factory DPR system. "
        "Use the historical patterns below to give one concise guidance paragraph for the supervisor filling today's DPR. "
        "Mention realistic target planning, manpower expectation, downtime watchouts, and one practical note. "
        "Keep it under 90 words.\n\n"
        f"Date: {date_value}\n"
        f"Shift: {shift}\n"
        f"Suggested values: {suggestion}\n"
        f"Patterns: {patterns}"
    )


def _entry_performance(entry: Entry) -> float:
    if not entry.units_target:
        return 0.0
    return round((float(entry.units_produced) / float(entry.units_target)) * 100.0, 2)


def _parse_time_scope_v2(question: str) -> tuple[date, date, str]:
    """Parse time scope from natural language question.

    Supports:
      - today, yesterday
      - this week, last week
      - this month, last month
      - this quarter, last quarter
      - this year, last year
      - last N days / past N days
      - last N months
      - "24 hours" / "last 24"
      - default: last 7 days
    """
    today = date.today()
    text = question.lower()

    # ── Hindi time words (Phase 2: normalized by language layer) ──────
    # Already handled by _normalize_question in Phase 2

    # ── Named time ranges ─────────────────────────────────────────────
    if "last month" in text or "pichle mahine" in text:
        first_of_this_month = date(today.year, today.month, 1)
        end = first_of_this_month - timedelta(days=1)
        start = date(end.year, end.month, 1)
        return start, end, "last_month"

    if "this month" in text or "is mahine" in text:
        start = date(today.year, today.month, 1)
        return start, today, "this_month"

    if "this week" in text or "is hafte" in text:
        start = today - timedelta(days=today.weekday())  # Monday
        return start, today, "this_week"

    if "last week" in text or "pichle hafte" in text:
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

    if "this year" in text or "is saal" in text:
        start = date(today.year, 1, 1)
        return start, today, "this_year"

    if "last year" in text or "pichle saal" in text:
        start = date(today.year - 1, 1, 1)
        end = date(today.year - 1, 12, 31)
        return start, end, "last_year"

    if "today" in text or "aaj" in text or "abhi" in text:
        return today, today, "today"

    if "yesterday" in text or "kal" in text:
        day = today - timedelta(days=1)
        return day, day, "yesterday"

    # ── Relative numeric ranges ───────────────────────────────────────
    days_match = re.search(r'(?:last|past)\s+(\d+)\s+days?', text)
    if days_match:
        n = int(days_match.group(1))
        return today - timedelta(days=n - 1), today, f"last_{n}_days"

    months_match = re.search(r'(?:last|past)\s+(\d+)\s+months?', text)
    if months_match:
        n = int(months_match.group(1))
        return today - timedelta(days=n * 30 - 1), today, f"last_{n}_months"

    if "24 hours" in text or "last 24" in text:
        return today - timedelta(days=1), today, "last_24_hours"

    if "last 30" in text or "30 day" in text or "3 months" in text:
        return today - timedelta(days=29), today, "last_30_days"

    if "last 14" in text or "14 day" in text:
        return today - timedelta(days=13), today, "last_14_days"

    return today - timedelta(days=6), today, "last_7_days"


def _parse_entity_filter(question: str) -> dict[str, Any]:
    """Extract entity references from a natural language question.

    Returns a dict with optional keys:
      - shift: str ("morning", "evening", "night")
      - employee_name: str
      - department: str
      - min_amount_inr: float
      - time_period_hint: str ("after_hours")
    """
    text = question.lower()
    result: dict[str, Any] = {}

    # Shift detection
    if any(w in text for w in ["morning shift", "morning", "day shift"]):
        result["shift"] = "morning"
    elif any(w in text for w in ["evening shift", "evening"]):
        result["shift"] = "evening"
    elif any(w in text for w in ["night shift", "night"]):
        result["shift"] = "night"

    # Amount threshold: "\u20b950,000" or "50000"
    amount_match = re.search(r'[\u20b9]?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)', text)
    if amount_match:
        try:
            result["min_amount_inr"] = float(amount_match.group(1).replace(",", ""))
        except ValueError:
            pass

    # After-hours detection
    if any(w in text for w in ["after hours", "outside working", "after 10 pm", "after 10pm"]):
        result["time_period_hint"] = "after_hours"

    return result


def _classify_nlq_domain(question: str) -> NlqDomain:
    """Classify a question into the most likely NLQ domain.

    Uses keyword-count scoring against DOMAIN_KEYWORDS plus Hindi keywords
    from _get_hindi_keywords_for_domain. Returns GENERAL if no domain
    keywords matched.
    """
    text = question.lower()
    scores: dict[NlqDomain, int] = {}

    # Score English keywords
    for domain, keywords in DOMAIN_KEYWORDS.items():
        scores[domain] = sum(1 for kw in keywords if kw in text)

    # Score Hindi/Hinglish keywords
    for domain in list(NlqDomain):
        hindi_kws = _get_hindi_keywords_for_domain(domain.value)
        if hindi_kws:
            scores[domain] = scores.get(domain, 0) + sum(1 for kw in hindi_kws if kw in text)

    best = max(scores, key=scores.get)  # type: ignore[arg-type]
    return best if scores[best] > 0 else NlqDomain.GENERAL


# ── Permission set for per-domain NLQ access ─────────────────────────────

def _get_nlq_permissions(db: Session, current_user: User, factory_id: str | None) -> NlqPermissionSet:
    """Check PDP permissions for each NLQ domain.

    Uses try/except around require_permission so that missing permission
    keys (still being defined) don't break the endpoint — they default to
    False and the response gracefully degrades.
    """
    pdp = PDP(db=db)
    resource = ResourceContext(factory_id=factory_id) if factory_id else None

    def _check(key: str) -> bool:
        try:
            pdp.require_permission(actor=current_user, permission_key=key, resource=resource)
            return True
        except HTTPException:
            return False

    return NlqPermissionSet(
        can_view_attendance=_check("attendance.view"),
        can_view_dispatch=_check("steel.dispatch.view"),
        can_view_finance=_check("billing.view"),
        can_view_inventory=_check("steel.inventory.view"),
        can_view_production=_check("production.batch.view"),
        can_view_fraud=_check("production.fraud_intelligence.view"),
        can_view_audit=_check("audit.view"),
        can_view_ocr=_check("ocr.view"),
        can_view_alerts=_check("alerts.view"),
        can_view_owner_insights=_check("ai.executive.view"),
        can_view_analytics=_check("analytics.view"),
    )


# ── Data fetcher: General / Entry (DPR) data ────────────────────────────

def _fetch_general_entry_data(
    db: Session,
    current_user: User,
    start: date,
    end: date,
) -> dict[str, Any]:
    """Fetch Entry/DPR data for the given time range.

    Returns a structured dict with raw Entry objects and pre-computed
    aggregates. This is the GENERAL/fallback fetcher used by the NLQ
    endpoint. Domain-specific fetchers will be added in Days 3-5.
    """
    entries = (
        _scoped_entries_query(db, current_user)
        .filter(Entry.date >= start, Entry.date <= end)
        .order_by(Entry.date.asc())
        .all()
    )

    if not entries:
        return {
            "entries": [],
            "total_units": 0,
            "total_target": 0,
            "total_downtime": 0,
            "total_manpower_present": 0,
            "total_manpower_absent": 0,
            "avg_performance": 0.0,
            "entry_count": 0,
        }

    total_units = sum(e.units_produced for e in entries)
    total_target = sum(e.units_target for e in entries if e.units_target) if any(e.units_target for e in entries) else 0
    total_downtime = sum(e.downtime_minutes for e in entries)
    total_present = sum(e.manpower_present for e in entries)
    total_absent = sum(e.manpower_absent for e in entries)

    performance_values = [_entry_performance(e) for e in entries if e.units_target]
    avg_performance = _safe_average(performance_values)

    return {
        "entries": entries,
        "total_units": total_units,
        "total_target": total_target,
        "total_downtime": total_downtime,
        "total_manpower_present": total_present,
        "total_manpower_absent": total_absent,
        "avg_performance": avg_performance,
        "entry_count": len(entries),
    }


# ── Domain-specific fetchers (D1-D10) ─────────────────────────────────


def _fetch_nlq_data(
    db: Session,
    current_user: User,
    domain: NlqDomain,
    start: date,
    end: date,
    question: str,
) -> dict[str, Any]:
    """Route an NLQ query to the correct domain-specific data fetcher.

    Returns a structured dict with the fetched data. Fields vary by domain
    but always include enough info for _build_nlq_fallback and _build_nlq_prompt.
    """
    factory_id = resolve_factory_id(db, current_user)
    days = (end - start).days + 1

    fetcher_map = {
        NlqDomain.ATTENDANCE: _fetch_attendance_data,
        NlqDomain.DISPATCH: _fetch_dispatch_data,
        NlqDomain.THEFT_FRAUD: _fetch_fraud_data,
        NlqDomain.FINANCE: _fetch_finance_data,
        NlqDomain.INVENTORY: _fetch_inventory_data,
        NlqDomain.PRODUCTION: _fetch_production_data,
        NlqDomain.AUDIT_TRAIL: _fetch_audit_data,
        NlqDomain.OWNER_INSIGHTS: _fetch_owner_data,
        NlqDomain.OCR: _fetch_ocr_data,
        NlqDomain.ALERTS: _fetch_alerts_data,
    }

    fetcher = fetcher_map.get(domain)
    if fetcher:
        try:
            return fetcher(db, current_user, factory_id, start, end, days, question)
        except (ValueError, HTTPException) as e:
            # Steel factory not selected or permission denied — graceful degrades
            return {"_error": str(e), "_domain": domain.value}

    # Fall back to general (Entry) data
    metric = _structured_metric(question)
    grouping = _structured_grouping(question)
    general_data = _fetch_general_entry_data(db, current_user, start, end)
    general_data["_metric"] = metric
    general_data["_grouping"] = grouping
    return general_data


# ── D1: Attendance ──────────────────────────────────────────────────────

def _fetch_attendance_data(
    db: Session, current_user: User, factory_id: str | None,
    start: date, end: date, days: int, question: str,
) -> dict[str, Any]:
    """Fetch attendance intelligence for NLQ."""
    factory = _require_steel_factory(db, current_user)
    overview = build_workforce_overview(
        db, factory.factory_id, days=days, can_view_cost=False,
    )
    return {
        "_domain": "attendance",
        "overview": overview,
        "summary": overview.get("period", {}),
        "today": overview.get("today", {}),
        "shift_comparison": overview.get("shift_comparison", {}),
    }


# ── D2: Dispatch ────────────────────────────────────────────────────────

def _fetch_dispatch_data(
    db: Session, current_user: User, factory_id: str | None,
    start: date, end: date, days: int, question: str,
) -> dict[str, Any]:
    """Fetch dispatch/logistics data for NLQ."""
    if not factory_id:
        raise ValueError("No active factory selected.")
    dispatches = (
        db.query(SteelDispatch)
        .filter(
            SteelDispatch.factory_id == factory_id,
            SteelDispatch.dispatch_date >= start,
            SteelDispatch.dispatch_date <= end,
        )
        .order_by(SteelDispatch.dispatch_date.desc())
        .all()
    )
    total_weight = sum(float(d.total_weight_kg or 0.0) for d in dispatches)
    total_count = len(dispatches)
    today_dispatches = [d for d in dispatches if d.dispatch_date == date.today()]
    today_weight = sum(float(d.total_weight_kg or 0.0) for d in today_dispatches)

    return {
        "_domain": "dispatch",
        "total_dispatches": total_count,
        "total_weight_kg": round(total_weight, 2),
        "today_count": len(today_dispatches),
        "today_weight_kg": round(today_weight, 2),
        "dispatches": [
            {
                "id": d.id, "dispatch_number": d.dispatch_number,
                "date": d.dispatch_date.isoformat(),
                "truck": d.truck_number, "weight_kg": float(d.total_weight_kg or 0.0),
                "status": d.status,
            }
            for d in dispatches[:50]
        ],
    }


# ── D3: Fraud / Theft ───────────────────────────────────────────────────

def _fetch_fraud_data(
    db: Session, current_user: User, factory_id: str | None,
    start: date, end: date, days: int, question: str,
) -> dict[str, Any]:
    """Fetch fraud/theft intelligence for NLQ."""
    factory = _require_steel_factory(db, current_user)
    fraud = build_fraud_intelligence(
        db, factory.factory_id, days=days,
        can_view_financials=True, can_view_user_details=True,
    )
    summary = fraud.get("summary", {})
    inv_signals = fraud.get("inventory_loss_signals", {})
    dispatch_signals = fraud.get("dispatch_mismatch_signals", {})
    tx_signals = fraud.get("transaction_anomalies", {})
    return {
        "_domain": "theft_fraud",
        "summary": summary,
        "critical_count": summary.get("critical_count", 0),
        "high_count": summary.get("high_count", 0),
        "total_signals": summary.get("total_signals", 0),
        "inventory_loss_signals": inv_signals.get("signals", []),
        "dispatch_mismatch_signals": dispatch_signals.get("signals", []),
        "transaction_anomalies": tx_signals.get("signals", []),
        "investigation_queue": fraud.get("investigation_queue", []),
    }


# ── D4: Finance ─────────────────────────────────────────────────────────

def _fetch_finance_data(
    db: Session, current_user: User, factory_id: str | None,
    start: date, end: date, days: int, question: str,
) -> dict[str, Any]:
    """Fetch financial intelligence for NLQ."""
    factory = _require_steel_factory(db, current_user)
    fin = build_financial_overview(db, factory.factory_id, days=days)
    revenue = fin.get("revenue", {})
    receivables = fin.get("receivables", {})
    realized = fin.get("realized_metrics", {})
    cash = fin.get("cash_balance", {})
    payables = fin.get("payables", {})
    expenses = fin.get("expenses", {})
    return {
        "_domain": "finance",
        "revenue": revenue,
        "receivables": receivables,
        "realized_metrics": realized,
        "cash_balance": cash,
        "payables": payables,
        "expenses": expenses,
        "collected_cash": fin.get("collected_cash", {}),
    }


# ── D5: Inventory ───────────────────────────────────────────────────────

def _fetch_inventory_data(
    db: Session, current_user: User, factory_id: str | None,
    start: date, end: date, days: int, question: str,
) -> dict[str, Any]:
    """Fetch inventory intelligence for NLQ."""
    factory = _require_steel_factory(db, current_user)
    inv = build_inv_intel(
        db, factory.factory_id,
        low_stock_days=days, dead_stock_days=max(days, 90),
    )
    valuation = inv.get("inventory_valuation", {})
    return {
        "_domain": "inventory",
        "low_stock_alerts": inv.get("low_stock_alerts", []),
        "dead_stock": inv.get("dead_stock", []),
        "turnover": inv.get("turnover_analysis", {}),
        "inventory_valuation": valuation,
        "total_value_inr": valuation.get("total_estimated_value_inr", 0.0),
        "slow_moving_items": inv.get("slow_moving_items", []),
        "overstocked_items": inv.get("overstocked_items", []),
        "abc_analysis": inv.get("abc_analysis", {}),
        "suspicious_movements": inv.get("suspicious_movements", []),
    }


# ── D6: Production ──────────────────────────────────────────────────────

def _fetch_production_data(
    db: Session, current_user: User, factory_id: str | None,
    start: date, end: date, days: int, question: str,
) -> dict[str, Any]:
    """Fetch production intelligence for NLQ."""
    factory = _require_steel_factory(db, current_user)
    prod = build_production_intelligence(db, factory.factory_id, days=days)
    summary = prod.get("summary", {})
    shift = prod.get("shift_analysis", {})
    downtime = prod.get("downtime_analysis", {})
    return {
        "_domain": "production",
        "summary": summary,
        "shift_analysis": shift,
        "downtime_analysis": downtime,
        "batch_loss": prod.get("batch_loss_analysis", {}),
        "quality_signals": prod.get("quality_signal_summary", {}),
        "rejection_scrap": prod.get("rejection_scrap_analysis", {}),
        "throughput_trend": prod.get("throughput_trend", []),
        "manpower_productivity": prod.get("manpower_productivity", {}),
    }


# ── D7: Audit Trail ─────────────────────────────────────────────────────

def _fetch_audit_data(
    db: Session, current_user: User, factory_id: str | None,
    start: date, end: date, days: int, question: str,
) -> dict[str, Any]:
    """Fetch audit trail data for NLQ."""
    logs = (
        db.query(AuditLog)
        .filter(
            AuditLog.org_id == resolve_org_id(current_user),
            AuditLog.timestamp >= datetime.combine(start, datetime.min.time(), tzinfo=timezone.utc),
            AuditLog.timestamp <= datetime.combine(end, datetime.max.time(), tzinfo=timezone.utc),
            AuditLog.factory_id == factory_id if factory_id else True,
        )
        .order_by(AuditLog.timestamp.desc())
        .limit(100)
        .all()
    )

    # Filter factory_id at Python level if needed
    if factory_id:
        logs = [l for l in logs if l.factory_id == factory_id]
    action_counts: dict[str, int] = {}
    user_action_counts: dict[int, int] = {}
    for log in logs:
        action_counts[log.action] = action_counts.get(log.action, 0) + 1
        if log.user_id:
            user_action_counts[log.user_id] = user_action_counts.get(log.user_id, 0) + 1

    return {
        "_domain": "audit_trail",
        "total_actions": len(logs),
        "action_counts": action_counts,
        "recent_actions": [
            {
                "id": l.id, "user_id": l.user_id,
                "action": l.action, "details": l.details,
                "timestamp": l.timestamp.isoformat(),
            }
            for l in logs[:30]
        ],
        "unique_users": len(user_action_counts),
    }


# ── D8: Owner Insights ──────────────────────────────────────────────────

def _fetch_owner_data(
    db: Session, current_user: User, factory_id: str | None,
    start: date, end: date, days: int, question: str,
) -> dict[str, Any]:
    """Fetch comprehensive owner dashboard data for NLQ."""
    factory = _require_steel_factory(db, current_user)
    dashboard = build_owner_dashboard(db, factory)
    snapshot = dashboard.get("snapshot", {})
    financial = dashboard.get("financial_pulse", {})
    anomaly = dashboard.get("anomaly_pressure", {})
    inv_health = dashboard.get("inventory_health", {})
    alerts = dashboard.get("alerts", [])
    return {
        "_domain": "owner_insights",
        "snapshot": snapshot,
        "financial_pulse": financial,
        "anomaly_pressure": anomaly,
        "inventory_health": inv_health,
        "alerts": alerts,
    }


# ── D9: OCR ─────────────────────────────────────────────────────────────

def _fetch_ocr_data(
    db: Session, current_user: User, factory_id: str | None,
    start: date, end: date, days: int, question: str,
) -> dict[str, Any]:
    """Fetch OCR/document processing data for NLQ."""
    from backend.models.ocr_verification import OcrVerification
    if not factory_id:
        return {"_domain": "ocr", "total_count": 0, "note": "No factory selected"}

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    docs = (
        db.query(OcrVerification)
        .filter(
            OcrVerification.factory_id == factory_id,
            OcrVerification.created_at >= cutoff,
        )
        .order_by(OcrVerification.created_at.desc())
        .limit(200)
        .all()
    )
    total = len(docs)
    approved = sum(1 for d in docs if d.outcome == "approved")
    failed = sum(1 for d in docs if d.outcome in ("failed", "rejected"))
    pending = sum(1 for d in docs if d.outcome == "pending")
    return {
        "_domain": "ocr",
        "total_count": total,
        "approved_count": approved,
        "failed_count": failed,
        "pending_count": pending,
        "accuracy_rate": round(approved / total * 100, 1) if total else 0.0,
    }


# ── D10: Alerts ─────────────────────────────────────────────────────────

def _fetch_alerts_data(
    db: Session, current_user: User, factory_id: str | None,
    start: date, end: date, days: int, question: str,
) -> dict[str, Any]:
    """Fetch alert/notification data for NLQ."""
    if not factory_id:
        return {"_domain": "alerts", "total_count": 0, "note": "No factory selected"}

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    alerts = (
        db.query(AlertModel)
        .filter(
            AlertModel.created_at >= cutoff,
            AlertModel.user_id == current_user.id,
        )
        .order_by(AlertModel.created_at.desc())
        .limit(100)
        .all()
    )
    critical = sum(1 for a in alerts if a.severity == "critical")
    warning = sum(1 for a in alerts if a.severity == "warning")
    unread = sum(1 for a in alerts if not a.is_read)
    # Enhanced: ignored (unread > 2 hours) and escalated tracking
    now = datetime.now(timezone.utc)
    ignored_count = sum(
        1 for a in alerts
        if not a.is_read and a.created_at and (now - a.created_at).total_seconds() > 7200
    )
    escalated_count = sum(1 for a in alerts if getattr(a, "is_escalated", False))
    alerts_by_day: dict[str, int] = {}
    for a in alerts:
        day_key = a.created_at.strftime("%Y-%m-%d") if a.created_at else "unknown"
        alerts_by_day[day_key] = alerts_by_day.get(day_key, 0) + 1

    return {
        "_domain": "alerts",
        "total_count": len(alerts),
        "critical_count": critical,
        "warning_count": warning,
        "info_count": len(alerts) - critical - warning,
        "unread_count": unread,
        "ignored_count": ignored_count,
        "escalated_count": escalated_count,
        "alerts_by_day": alerts_by_day,
    }


# ── Multi-domain data fusion (Phase 2) ───────────────────────────────────


def _fuse_domain_data(primary: dict[str, Any], secondary: dict[str, Any]) -> dict[str, Any]:
    """Merge data from two domains for multi-domain NLQ queries.

    The primary domain data takes precedence on conflicts. Both domains'
    data is included under `_primary` and `_secondary` keys so the
    prompt builder can reference both.
    """
    fused = dict(primary)
    fused["_primary"] = primary
    fused["_secondary"] = secondary
    fused["_fused"] = True
    return fused


# ── Action item generator (Phase 2) ──────────────────────────────────────


def _generate_nlq_action_items(
    domain: NlqDomain,
    domain_data: dict[str, Any],
    data_points: list[dict[str, Any]],
) -> list[ActionItem]:
    """Generate contextual action items from NLQ query results.

    Each domain gets relevant, actionable recommendations based on the
    fetched data. Items are returned in priority order (1 = highest).
    Returns an empty list if no actionable signals are found.
    """
    items: list[ActionItem] = []

    # ── ATTENDANCE: high absenteeism or overtime ─────────────────────────
    if domain == NlqDomain.ATTENDANCE:
        today = domain_data.get("today", {})
        absent = today.get("absent", 0) or 0
        working = today.get("working", 0) or 1
        if absent > 0 and (absent / max(1, working + absent)) > 0.15:
            items.append(ActionItem(
                priority=1, action="Investigate high absenteeism",
                reason=f"{absent} workers absent today ({float(absent/(working+absent))*100:.0f}% rate)",
                deadline="today",
            ))
        ot_min = today.get("total_overtime_minutes", 0) or 0
        if ot_min > 120:
            items.append(ActionItem(
                priority=2, action="Review overtime allocation",
                reason=f"{ot_min} minutes overtime today — check if avoidable",
                deadline="this week",
            ))

    # ── DISPATCH: pending dispatches ─────────────────────────────────────
    if domain == NlqDomain.DISPATCH:
        dispatches = domain_data.get("dispatches", [])
        pending = [d for d in dispatches if d.get("status") == "pending"]
        if pending:
            items.append(ActionItem(
                priority=1, action="Complete pending dispatches",
                reason=f"{len(pending)} dispatches still pending",
                deadline="today",
            ))

    # ── FRAUD: critical signals → immediate investigation ────────────────
    if domain == NlqDomain.THEFT_FRAUD:
        critical = domain_data.get("critical_count", 0) or 0
        high = domain_data.get("high_count", 0) or 0
        inv_q = len(domain_data.get("investigation_queue", []))
        if critical > 0:
            items.append(ActionItem(
                priority=1, action="Investigate critical fraud signals",
                reason=f"{critical} critical signals require immediate attention",
                deadline="urgent",
            ))
        if high > 0:
            items.append(ActionItem(
                priority=2, action="Review high-priority fraud signals",
                reason=f"{high} high-priority signals pending review",
                deadline="today",
            ))
        if inv_q > 0:
            items.append(ActionItem(
                priority=3, action="Clear investigation queue",
                reason=f"{inv_q} items in the investigation queue",
                deadline="this week",
            ))

    # ── FINANCE: overdue or low margin ───────────────────────────────────
    if domain == NlqDomain.FINANCE:
        receivables = domain_data.get("receivables", {})
        overdue = receivables.get("overdue_amount_inr", 0) or 0
        if overdue > 0:
            items.append(ActionItem(
                priority=1, action="Follow up on overdue payments",
                reason=f"INR {overdue:,.2f} overdue",
                estimated_impact_inr=overdue,
                deadline="urgent",
            ))
        realized = domain_data.get("realized_metrics", {})
        margin = realized.get("margin_percent", 0) or 0
        if 0 < margin < 10:
            items.append(ActionItem(
                priority=2, action="Review profit margin",
                reason=f"Margin at {margin}% — below 10% threshold",
                deadline="this week",
            ))

    # ── INVENTORY: low stock or dead stock ───────────────────────────────
    if domain == NlqDomain.INVENTORY:
        low = len(domain_data.get("low_stock_alerts", []))
        dead = len(domain_data.get("dead_stock", []))
        if low > 0:
            items.append(ActionItem(
                priority=1, action="Reorder low stock items",
                reason=f"{low} items running low — risk of stockout",
                deadline="today",
            ))
        if dead > 0:
            items.append(ActionItem(
                priority=3, action="Clear dead stock",
                reason=f"{dead} items classified as dead stock — consider discount or disposal",
                deadline="this month",
            ))

    # ── PRODUCTION: low attainment or high downtime ──────────────────────
    if domain == NlqDomain.PRODUCTION:
        s = domain_data.get("summary", {})
        attainment = s.get("overall_attainment_percent", 100) or 100
        downtime = s.get("total_downtime_minutes", 0) or 0
        if attainment < 80:
            items.append(ActionItem(
                priority=1, action="Improve production attainment",
                reason=f"Attainment at {attainment}% — below 80% target",
                deadline="today",
            ))
        if downtime > 300:
            items.append(ActionItem(
                priority=2, action="Address high downtime",
                reason=f"{downtime} minutes total downtime in period",
                deadline="today",
            ))

    # ── ALERTS: unread critical alerts ───────────────────────────────────
    if domain == NlqDomain.ALERTS:
        critical = domain_data.get("critical_count", 0) or 0
        unread = domain_data.get("unread_count", 0) or 0
        if critical > 0 and unread > 0:
            items.append(ActionItem(
                priority=1, action="Acknowledge critical alerts",
                reason=f"{critical} critical, {unread} unread alerts",
                deadline="urgent",
            ))

    # ── OCR: pending documents ───────────────────────────────────────────
    if domain == NlqDomain.OCR:
        pending = domain_data.get("pending_count", 0) or 0
        if pending > 5:
            items.append(ActionItem(
                priority=2, action="Review pending OCR documents",
                reason=f"{pending} documents pending review",
                deadline="today",
            ))

    return items[:5]


# ── 8-factor health score V2 (Phase 2) ───────────────────────────────────


def _compute_health_score_v2(domain_data: dict[str, Any]) -> tuple[int, str]:
    """Compute an 8-factor factory health score from owner dashboard data.

    Factors (weighted):
      1. Financial health (25%)  — margin + overdue status
      2. Fraud pressure (25%)    — critical + high signal count
      3. Production efficiency (15%) — loss percent
      4. Inventory health (15%)  — green/red confidence ratio
      5. Attendance health (10%) — presence rate
      6. Dispatch compliance (5%) — default 90
      7. Alert resolution (3%)   — unread critical ratio
      8. OCR accuracy (2%)       — default 85

    Returns (score: 0-100, label: str).
    """
    fin = domain_data.get("financial_pulse", {})
    anc = domain_data.get("anomaly_pressure", {})
    inv = domain_data.get("inventory_health", {})
    snap = domain_data.get("snapshot", {})

    margin = fin.get("realized_margin_percent", 0) or 0
    critical_anomalies = anc.get("critical_count", 0) or 0
    high_anomalies = anc.get("high_count", 0) or 0
    loss_pct = snap.get("today_loss_percent", 0) or 0
    green_count = inv.get("green_count", 0) or 0
    red_count = inv.get("red_count", 0) or 0

    # Financial health (25 points)
    fin_score = min(25, max(0, int((margin / 15.0) * 25)))

    # Fraud pressure (25 points — fewer signals = better)
    total_signals = critical_anomalies + high_anomalies
    fraud_score = max(0, 25 - min(25, total_signals * 5))

    # Production efficiency (15 points)
    prod_score = max(0, 15 - min(15, int(loss_pct * 3)))

    # Inventory health (15 points)
    total_items = green_count + red_count
    inv_ratio = green_count / max(1, total_items)
    inv_score = min(15, int(inv_ratio * 15))

    # Attendance health (10 points) — default 85%
    att_score = 8

    # Dispatch compliance (5 points) — default
    dispatch_score = 4

    # Alert resolution (3 points) — default
    alert_score = 2

    # OCR accuracy (2 points) — default
    ocr_score = 1

    total = fin_score + fraud_score + prod_score + inv_score + att_score + dispatch_score + alert_score + ocr_score

    if total >= 80:
        label = "good"
    elif total >= 60:
        label = "needs_attention"
    elif total >= 40:
        label = "at_risk"
    else:
        label = "critical"

    return min(100, total), label


# ── Steel factory helper ────────────────────────────────────────────────
# _require_steel_factory is imported from backend.services.steel_service
# and aliased at the top of this file.


def _compute_entry_group_metric(metric: str, entries: list[Entry]) -> float:
    """Compute a single metric value from a group of entries.

    Used by _extract_data_points to aggregate shift/day/total groupings.
    """
    if metric == "downtime":
        return round(float(sum(e.downtime_minutes for e in entries)), 2)
    if metric == "manpower":
        return round(float(sum(e.manpower_present for e in entries)), 2)
    if metric == "performance":
        values = [_entry_performance(e) for e in entries if e.units_target]
        return _safe_average(values)
    return round(float(sum(e.units_produced for e in entries)), 2)


def _extract_data_points(
    domain: NlqDomain,
    domain_data: dict[str, Any],
    metric: str,
    grouping: str,
) -> list[dict[str, Any]]:
    """Extract frontend-ready data points from domain-specific data.

    Each domain produces relevant KPIs as structured data points for
    frontend chart/table rendering.
    """
    # ── GENERAL: shift/day/total from Entry data ───────────────────────
    if domain == NlqDomain.GENERAL:
        entries: list[Entry] = domain_data.get("entries", [])
        if not entries:
            return []
        if grouping == "shift":
            grouped: dict[str, list[Entry]] = {}
            for entry in entries:
                grouped.setdefault(str(entry.shift), []).append(entry)
            return [{"group": k, "value": _compute_entry_group_metric(metric, g)} for k, g in grouped.items()]
        if grouping == "day":
            grouped = {}
            for entry in entries:
                grouped.setdefault(entry.date.isoformat(), []).append(entry)
            return [{"group": k, "value": _compute_entry_group_metric(metric, g)} for k, g in sorted(grouped.items())]
        total_val = _compute_entry_group_metric(metric, entries)
        return [{"group": "total", "value": total_val}]

    # ── ATTENDANCE ─────────────────────────────────────────────────────
    if domain == NlqDomain.ATTENDANCE:
        points = []
        today = domain_data.get("today", {})
        period = domain_data.get("summary", {})
        if today:
            points.append({"group": "today_working", "value": today.get("working", 0)})
            points.append({"group": "today_absent", "value": today.get("absent", 0)})
            points.append({"group": "today_overtime_min", "value": today.get("total_overtime_minutes", 0)})
        if period:
            points.append({"group": "presence_rate", "value": period.get("presence_rate_percent", 0)})
            points.append({"group": "total_overtime_hours", "value": period.get("total_overtime_hours", 0)})
        return points

    # ── DISPATCH ───────────────────────────────────────────────────────
    if domain == NlqDomain.DISPATCH:
        return [
            {"group": "total_dispatches", "value": domain_data.get("total_dispatches", 0)},
            {"group": "total_weight_kg", "value": domain_data.get("total_weight_kg", 0)},
            {"group": "today_count", "value": domain_data.get("today_count", 0)},
            {"group": "today_weight_kg", "value": domain_data.get("today_weight_kg", 0)},
        ]

    # ── FRAUD ──────────────────────────────────────────────────────────
    if domain == NlqDomain.THEFT_FRAUD:
        return [
            {"group": "total_signals", "value": domain_data.get("total_signals", 0)},
            {"group": "critical_count", "value": domain_data.get("critical_count", 0)},
            {"group": "high_count", "value": domain_data.get("high_count", 0)},
            {"group": "investigation_queue", "value": len(domain_data.get("investigation_queue", []))},
        ]

    # ── FINANCE ────────────────────────────────────────────────────────
    if domain == NlqDomain.FINANCE:
        points = []
        revenue = domain_data.get("revenue", {})
        receivables = domain_data.get("receivables", {})
        realized = domain_data.get("realized_metrics", {})
        period_rev = revenue.get("last_n_days", {})
        points.append({"group": "period_revenue_inr", "value": period_rev.get("revenue_inr", 0)})
        points.append({"group": "outstanding_inr", "value": receivables.get("total_outstanding_inr", 0)})
        points.append({"group": "overdue_inr", "value": receivables.get("overdue_amount_inr", 0)})
        points.append({"group": "margin_percent", "value": realized.get("margin_percent", 0)})
        return points

    # ── INVENTORY ──────────────────────────────────────────────────────
    if domain == NlqDomain.INVENTORY:
        low = domain_data.get("low_stock_alerts", [])
        dead = domain_data.get("dead_stock", [])
        turnover = domain_data.get("turnover", {})
        return [
            {"group": "low_stock_count", "value": len(low)},
            {"group": "dead_stock_count", "value": len(dead)},
            {"group": "total_value_inr", "value": domain_data.get("total_value_inr", 0)},
            {"group": "turnover_items", "value": len(turnover.get("items", []))},
        ]

    # ── PRODUCTION ─────────────────────────────────────────────────────
    if domain == NlqDomain.PRODUCTION:
        s = domain_data.get("summary", {})
        return [
            {"group": "total_produced", "value": s.get("total_produced_units", 0)},
            {"group": "attainment_percent", "value": s.get("overall_attainment_percent", 0)},
            {"group": "total_downtime_min", "value": s.get("total_downtime_minutes", 0)},
            {"group": "total_batches", "value": s.get("total_batch_count", 0)},
        ]

    # ── AUDIT ──────────────────────────────────────────────────────────
    if domain == NlqDomain.AUDIT_TRAIL:
        return [
            {"group": "total_actions", "value": domain_data.get("total_actions", 0)},
            {"group": "unique_users", "value": domain_data.get("unique_users", 0)},
        ]

    # ── OWNER INSIGHTS ─────────────────────────────────────────────────
    if domain == NlqDomain.OWNER_INSIGHTS:
        snap = domain_data.get("snapshot", {})
        fin = domain_data.get("financial_pulse", {})
        anc = domain_data.get("anomaly_pressure", {})
        return [
            {"group": "today_output_kg", "value": snap.get("today_output_kg", 0)},
            {"group": "realized_revenue_inr", "value": fin.get("realized_dispatched_revenue_inr", 0)},
            {"group": "margin_percent", "value": fin.get("realized_margin_percent", 0)},
            {"group": "critical_anomalies", "value": anc.get("critical_count", 0)},
        ]

    # ── OCR ────────────────────────────────────────────────────────────
    if domain == NlqDomain.OCR:
        return [
            {"group": "total_docs", "value": domain_data.get("total_count", 0)},
            {"group": "accuracy_rate", "value": domain_data.get("accuracy_rate", 0)},
            {"group": "pending", "value": domain_data.get("pending_count", 0)},
        ]

    # ── ALERTS ─────────────────────────────────────────────────────────
    if domain == NlqDomain.ALERTS:
        return [
            {"group": "total_alerts", "value": domain_data.get("total_count", 0)},
            {"group": "critical", "value": domain_data.get("critical_count", 0)},
            {"group": "unread", "value": domain_data.get("unread_count", 0)},
        ]

    return []


# ── Fallback text generators ────────────────────────────────────────────

def _build_nlq_fallback(
    domain: NlqDomain,
    domain_data: dict[str, Any],
    data_points: list[dict[str, Any]],
    scope_name: str,
    metric: str,
) -> str:
    """Build a human-readable fallback text for any domain.

    Used when the AI provider is unavailable. Returns a factual summary
    of the fetched data without generative AI. Each domain has its own
    template that pulls from domain_data.
    """
    scope_display = scope_name.replace("_", " ")

    # Check for error (e.g. no factory selected)
    if "_error" in domain_data:
        return f"Unable to answer this question: {domain_data['_error']}"

    # ── GENERAL domain (Entry/DPR data) ────────────────────────────────
    if domain == NlqDomain.GENERAL:
        entry_count = domain_data.get("entry_count", 0)
        if entry_count == 0:
            return f"I could not find any data for {scope_display}. Try a different time range or check if DPR entries have been recorded."
        total_units = domain_data.get("total_units", 0)
        total_target = domain_data.get("total_target", 0)
        total_downtime = domain_data.get("total_downtime", 0)
        avg_perf = domain_data.get("avg_performance", 0.0)
        if data_points and len(data_points) == 1 and data_points[0]["group"] == "total":
            return f"For {scope_display}, the {metric} result is {data_points[0]['value']}. Across {entry_count} entries, units produced: {total_units}, target: {total_target}, downtime: {total_downtime} min, avg performance: {avg_perf:.1f}%."
        points_text = "; ".join(f"{dp['group']}: {dp['value']}" for dp in data_points[:6])
        return f"For {scope_display}, results by {metric} are: {points_text}. Total entries: {entry_count}."

    # ── ATTENDANCE ─────────────────────────────────────────────────────
    if domain == NlqDomain.ATTENDANCE:
        today = domain_data.get("today", {})
        period = domain_data.get("summary", {})
        working = today.get("working", "N/A")
        absent = today.get("absent", "N/A")
        ot_min = today.get("total_overtime_minutes", 0)
        presence = period.get("presence_rate_percent", "N/A")
        late_hours = period.get("total_late_hours", 0)
        return (
            f"For {scope_display}, today {working} workers are present and {absent} absent "
            f"with {ot_min} minutes overtime. Period presence rate: {presence}%, "
            f"total late hours: {late_hours}."
        )

    # ── DISPATCH ───────────────────────────────────────────────────────
    if domain == NlqDomain.DISPATCH:
        total = domain_data.get("total_dispatches", 0)
        weight = domain_data.get("total_weight_kg", 0)
        today_c = domain_data.get("today_count", 0)
        today_w = domain_data.get("today_weight_kg", 0)
        return (
            f"For {scope_display}, there were {total} dispatches totaling {weight} kg. "
            f"Today: {today_c} dispatches, {today_w} kg."
        )

    # ── FRAUD ──────────────────────────────────────────────────────────
    if domain == NlqDomain.THEFT_FRAUD:
        critical = domain_data.get("critical_count", 0)
        high = domain_data.get("high_count", 0)
        total_s = domain_data.get("total_signals", 0)
        inv_q = len(domain_data.get("investigation_queue", []))
        if total_s == 0:
            return f"No fraud or anomaly signals detected in {scope_display}."
        return (
            f"For {scope_display}, {total_s} total fraud signals detected: "
            f"{critical} critical, {high} high. {inv_q} items in the investigation queue."
        )

    # ── FINANCE ────────────────────────────────────────────────────────
    if domain == NlqDomain.FINANCE:
        rev = domain_data.get("revenue", {}).get("last_n_days", {})
        recv = domain_data.get("receivables", {})
        realized = domain_data.get("realized_metrics", {})
        rev_inr = rev.get("revenue_inr", 0)
        out = recv.get("total_outstanding_inr", 0)
        overdue = recv.get("overdue_amount_inr", 0)
        margin = realized.get("margin_percent", 0)
        return (
            f"For {scope_display}, revenue is INR {rev_inr:,.2f}, "
            f"outstanding receivables: INR {out:,.2f} (overdue: INR {overdue:,.2f}), "
            f"realized margin: {margin}%."
        )

    # ── INVENTORY ──────────────────────────────────────────────────────
    if domain == NlqDomain.INVENTORY:
        low_count = len(domain_data.get("low_stock_alerts", []))
        dead_count = len(domain_data.get("dead_stock", []))
        total_val = domain_data.get("total_value_inr", 0)
        turnover = domain_data.get("turnover", {}).get("items", [])
        return (
            f"For {scope_display}, {low_count} low stock alerts, "
            f"{dead_count} dead stock items. Total estimated value: INR {total_val:,.2f}. "
            f"Turnover tracked for {len(turnover)} items."
        )

    # ── PRODUCTION ─────────────────────────────────────────────────────
    if domain == NlqDomain.PRODUCTION:
        s = domain_data.get("summary", {})
        produced = s.get("total_produced_units", 0)
        attainment = s.get("overall_attainment_percent", 0)
        downtime = s.get("total_downtime_minutes", 0)
        batches = s.get("total_batch_count", 0)
        return (
            f"For {scope_display}, total production: {produced} units, "
            f"attainment: {attainment}%, total downtime: {downtime} minutes, "
            f"batches: {batches}."
        )

    # ── AUDIT TRAIL ────────────────────────────────────────────────────
    if domain == NlqDomain.AUDIT_TRAIL:
        total_actions = domain_data.get("total_actions", 0)
        unique_users = domain_data.get("unique_users", 0)
        action_counts = domain_data.get("action_counts", {})
        top_actions = sorted(action_counts.items(), key=lambda x: x[1], reverse=True)[:3]
        actions_str = "; ".join(f"{a}: {c}" for a, c in top_actions) if top_actions else "none recorded"
        return (
            f"For {scope_display}, {total_actions} system actions logged "
            f"by {unique_users} unique users. Top actions: {actions_str}."
        )

    # ── OWNER INSIGHTS ─────────────────────────────────────────────────
    if domain == NlqDomain.OWNER_INSIGHTS:
        snap = domain_data.get("snapshot", {})
        fin = domain_data.get("financial_pulse", {})
        anc = domain_data.get("anomaly_pressure", {})
        inv_h = domain_data.get("inventory_health", {})
        alerts_list = domain_data.get("alerts", [])
        alerts_str = f"{len(alerts_list)} active alerts" if alerts_list else "no active alerts"
        return (
            f"Factory health for {scope_display}: today output {snap.get('today_output_kg', 0)} kg, "
            f"realized revenue INR {fin.get('realized_dispatched_revenue_inr', 0):,.2f}, "
            f"margin {fin.get('realized_margin_percent', 0)}%. "
            f"Anomalies: {anc.get('critical_count', 0)} critical. "
            f"Stock confidence: {inv_h.get('green_count', 0)} green, {inv_h.get('red_count', 0)} red. "
            f"{alerts_str}."
        )

    # ── OCR ────────────────────────────────────────────────────────────
    if domain == NlqDomain.OCR:
        total = domain_data.get("total_count", 0)
        acc = domain_data.get("accuracy_rate", 0)
        pending = domain_data.get("pending_count", 0)
        if total == 0:
            return f"No OCR documents processed in {scope_display}."
        return f"For {scope_display}, {total} documents processed with {acc}% accuracy. {pending} documents pending review."

    # ── ALERTS ─────────────────────────────────────────────────────────
    if domain == NlqDomain.ALERTS:
        total = domain_data.get("total_count", 0)
        critical = domain_data.get("critical_count", 0)
        warning = domain_data.get("warning_count", 0)
        unread = domain_data.get("unread_count", 0)
        if total == 0:
            return f"No alerts triggered in {scope_display}."
        return f"For {scope_display}, {total} alerts: {critical} critical, {warning} warnings. {unread} unread."

    return f"Data available for {scope_display}. Check the dashboard for details."


def _build_nlq_prompt(
    domain: NlqDomain,
    question: str,
    structured_query: dict[str, Any],
    data_points: list[dict[str, Any]],
    domain_data: dict[str, Any],
    language: str = "english",
) -> str:
    """Build a domain-specific AI prompt for NLQ queries.

    Each domain has its own prompt template that includes the actual
    fetched data and formatting instructions. The GENERAL template is
    the default fallback.

    When `language` is "hindi" or "hinglish", the Hinglish response
    instruction is prepended so the AI answers in the owner's language.
    """
    scope = structured_query.get("scope", "the period")

    # Language instruction for Hindi/Hinglish queries
    lang_instruction = ""
    if language in ("hindi", "hinglish"):
        lang_instruction = _HINDI_RESPONSE_INSTRUCTION + "\n"

    # ── GENERAL domain (Entry/DPR data) ───────────────────────────────
    if domain == NlqDomain.GENERAL:
        return (
            lang_instruction +
            "Answer the factory KPI question below in under 120 words. "
            "Stay factual, use the supplied numbers, and mention the time window.\n\n"
            f"Question: {question}\n"
            f"Structured query: {structured_query}\n"
            f"Data points: {data_points[:10]}"
        )

    # ── ATTENDANCE ─────────────────────────────────────────────────────
    if domain == NlqDomain.ATTENDANCE:
        today = domain_data.get("today", {})
        period = domain_data.get("summary", {})
        shift_comp = domain_data.get("shift_comparison", {})
        return (
            lang_instruction +
            "You are an HR intelligence assistant for a steel factory. "
            "Answer the attendance question factually using the data below. "
            "Keep it under 120 words. Mention the time window.\n\n"
            f"Question: {question}\n"
            f"Scope: {scope}\n"
            f"Today: {today.get('working', 'N/A')} present, {today.get('absent', 'N/A')} absent, "
            f"overtime: {today.get('total_overtime_minutes', 0)} min\n"
            f"Period: presence rate {period.get('presence_rate_percent', 'N/A')}%, "
            f"total overtime hours: {period.get('total_overtime_hours', 0)}, "
            f"total late hours: {period.get('total_late_hours', 0)}\n"
            f"Best shift: {shift_comp.get('best_performing_shift', 'N/A')}"
        )

    # ── DISPATCH ───────────────────────────────────────────────────────
    if domain == NlqDomain.DISPATCH:
        dispatches = domain_data.get("dispatches", [])
        return (
            lang_instruction +
            "You are a logistics intelligence assistant for a steel factory. "
            "Answer the dispatch question using the data below. Under 120 words.\n\n"
            f"Question: {question}\n"
            f"Scope: {scope}\n"
            f"Total dispatches: {domain_data.get('total_dispatches', 0)}\n"
            f"Total weight: {domain_data.get('total_weight_kg', 0)} kg\n"
            f"Today: {domain_data.get('today_count', 0)} dispatches, {domain_data.get('today_weight_kg', 0)} kg\n"
            f"Recent dispatches: {len(dispatches)} records available"
        )

    # ── FRAUD / THEFT ──────────────────────────────────────────────────
    if domain == NlqDomain.THEFT_FRAUD:
        summary = domain_data.get("summary", {})
        signal_count = summary.get("total_signals", 0)
        return (
            lang_instruction +
            "You are a fraud detection assistant for a steel factory. "
            "Answer the question using the data below. Be direct — flag critical issues. Under 120 words.\n\n"
            f"Question: {question}\n"
            f"Scope: {scope}\n"
            f"Total signals: {signal_count} (critical: {domain_data.get('critical_count', 0)}, "
            f"high: {domain_data.get('high_count', 0)})\n"
            f"Inventory loss signals: {len(domain_data.get('inventory_loss_signals', []))}\n"
            f"Dispatch mismatches: {len(domain_data.get('dispatch_mismatch_signals', []))}\n"
            f"Transaction anomalies: {len(domain_data.get('transaction_anomalies', []))}\n"
            f"Investigation queue: {len(domain_data.get('investigation_queue', []))} items"
        )

    # ── FINANCE ────────────────────────────────────────────────────────
    if domain == NlqDomain.FINANCE:
        revenue = domain_data.get("revenue", {})
        receivables = domain_data.get("receivables", {})
        realized = domain_data.get("realized_metrics", {})
        cash = domain_data.get("cash_balance", {})
        return (
            lang_instruction +
            "You are a financial intelligence assistant for a steel factory. "
            "Answer using the data below. Use INR with commas. Show changes. Under 120 words.\n\n"
            f"Question: {question}\n"
            f"Scope: {scope}\n"
            f"Period revenue: INR {revenue.get('last_n_days', {}).get('revenue_inr', 0):,.2f}\n"
            f"Outstanding: INR {receivables.get('total_outstanding_inr', 0):,.2f} "
            f"(overdue: INR {receivables.get('overdue_amount_inr', 0):,.2f})\n"
            f"Realized margin: {realized.get('margin_percent', 0)}%\n"
            f"Cash balance: INR {cash.get('total_balance_inr', 0):,.2f}"
        )

    # ── INVENTORY ──────────────────────────────────────────────────────
    if domain == NlqDomain.INVENTORY:
        low = domain_data.get("low_stock_alerts", [])
        dead = domain_data.get("dead_stock", [])
        valuation = domain_data.get("inventory_valuation", {})
        return (
            lang_instruction +
            "You are an inventory intelligence assistant for a steel factory. "
            "Answer using the data below. Focus on critical shortages. Under 120 words.\n\n"
            f"Question: {question}\n"
            f"Scope: {scope}\n"
            f"Low stock alerts: {len(low)} items\n"
            f"Dead stock: {len(dead)} items\n"
            f"Total estimated value: INR {domain_data.get('total_value_inr', 0):,.2f}\n"
            f"Slow moving items: {len(domain_data.get('slow_moving_items', []))}\n"
            f"Overstocked items: {len(domain_data.get('overstocked_items', []))}"
        )

    # ── PRODUCTION ─────────────────────────────────────────────────────
    if domain == NlqDomain.PRODUCTION:
        s = domain_data.get("summary", {})
        shift = domain_data.get("shift_analysis", {})
        downtime = domain_data.get("downtime_analysis", {})
        batch_loss = domain_data.get("batch_loss", {})
        return (
            lang_instruction +
            "You are a production intelligence assistant for a steel factory. "
            "Answer using the data below. Mention shift comparison. Under 120 words.\n\n"
            f"Question: {question}\n"
            f"Scope: {scope}\n"
            f"Output: {s.get('total_produced_units', 0)} units, attainment {s.get('overall_attainment_percent', 0)}%\n"
            f"Downtime: {s.get('total_downtime_minutes', 0)} min total\n"
            f"Batches: {s.get('total_batch_count', 0)} total, "
            f"avg loss: {batch_loss.get('avg_loss_percent', 0)}%\n"
            f"Best shift: {shift.get('best_performing_shift', 'N/A')}"
        )

    # ── AUDIT TRAIL ────────────────────────────────────────────────────
    if domain == NlqDomain.AUDIT_TRAIL:
        recent = domain_data.get("recent_actions", [])
        action_counts = domain_data.get("action_counts", {})
        return (
            lang_instruction +
            "You are an audit trail assistant for a factory system. "
            "Answer using the data below. List who did what and when. Under 120 words.\n\n"
            f"Question: {question}\n"
            f"Scope: {scope}\n"
            f"Total actions: {domain_data.get('total_actions', 0)} by {domain_data.get('unique_users', 0)} users\n"
            f"Action breakdown: {action_counts}\n"
            f"Recent actions: {[{ 'id': a['id'], 'action': a['action'] } for a in recent[:5]]}"
        )

    # ── OWNER INSIGHTS ─────────────────────────────────────────────────
    if domain == NlqDomain.OWNER_INSIGHTS:
        snap = domain_data.get("snapshot", {})
        fin = domain_data.get("financial_pulse", {})
        anc = domain_data.get("anomaly_pressure", {})
        inv = domain_data.get("inventory_health", {})
        alerts = domain_data.get("alerts", [])
        return (
            lang_instruction +
            "You are the factory owner's executive assistant. "
            "Provide a concise, honest factory health summary using the data below. "
            "Call out the top 3 issues and end with one recommended action. Under 180 words.\n\n"
            f"Question: {question}\n"
            f"Scope: {scope}\n"
            f"Today: {snap.get('today_output_kg', 0)} kg output, {snap.get('today_batches', 0)} batches, "
            f"loss {snap.get('today_loss_percent', 0)}%\n"
            f"Financial: revenue INR {fin.get('realized_dispatched_revenue_inr', 0):,.2f}, "
            f"profit INR {fin.get('realized_dispatched_profit_inr', 0):,.2f}, "
            f"margin {fin.get('realized_margin_percent', 0)}%\n"
            f"Anomalies: {anc.get('critical_count', 0)} critical, {anc.get('high_count', 0)} high\n"
            f"Inventory: {inv.get('green_count', 0)} green, {inv.get('red_count', 0)} red confidence items\n"
            f"Alerts ({len(alerts)} total): {[a.get('title', '') for a in alerts[:3]]}"
        )

    # ── OCR ────────────────────────────────────────────────────────────
    if domain == NlqDomain.OCR:
        return (
            lang_instruction +
            "You are a document processing assistant for a steel factory. "
            "Answer using the data below. Under 80 words.\n\n"
            f"Question: {question}\n"
            f"Scope: {scope}\n"
            f"Total documents: {domain_data.get('total_count', 0)}\n"
            f"Approved: {domain_data.get('approved_count', 0)}\n"
            f"Failed: {domain_data.get('failed_count', 0)}\n"
            f"Pending: {domain_data.get('pending_count', 0)}\n"
            f"Accuracy rate: {domain_data.get('accuracy_rate', 0)}%"
        )

    # ── ALERTS ─────────────────────────────────────────────────────────
    if domain == NlqDomain.ALERTS:
        return (
            lang_instruction +
            "You are an alert monitoring assistant for a steel factory. "
            "Answer using the data below. Prioritize critical alerts. Under 80 words.\n\n"
            f"Question: {question}\n"
            f"Scope: {scope}\n"
            f"Total alerts: {domain_data.get('total_count', 0)} "
            f"(critical: {domain_data.get('critical_count', 0)}, "
            f"warning: {domain_data.get('warning_count', 0)})\n"
            f"Unread: {domain_data.get('unread_count', 0)}"
        )

    # Fallback for any domain not explicitly handled
    return (
        lang_instruction +
        f"Answer the factory question below directly and factually. Under 120 words.\n\n"
        f"Question: {question}\n"
        f"Domain: {domain.value}\n"
        f"Scope: {scope}\n"
        f"Data points: {data_points[:10]}"
    )


def _structured_metric(question: str) -> str:
    text = question.lower()
    if any(word in text for word in ("downtime", "stoppage", "breakdown")):
        return "downtime"
    if any(word in text for word in ("attendance", "manpower", "absent", "present")):
        return "manpower"
    if any(word in text for word in ("performance", "target", "efficiency")):
        return "performance"
    return "output"


def _structured_grouping(question: str) -> str:
    text = question.lower()
    if "by shift" in text:
        return "shift"
    if "by day" in text or "daily" in text:
        return "day"
    return "total"


def _generate_anomaly_response(
    db: Session,
    current_user: User,
    *,
    days: int,
    plan: str,
    min_plan: str,
) -> AnomalyResponse:
    end = date.today()
    start = end - timedelta(days=days - 1)
    entries = (
        _scoped_entries_query(db, current_user)
        .filter(Entry.date >= start, Entry.date <= end)
        .order_by(Entry.date.desc())
        .all()
    )

    items, baselines = _build_anomaly_items(entries)
    fallback = _anomaly_fallback_summary(items, days=days)
    prompt = (
        "You are a factory analyst. Summarize the anomaly list below for a plant manager in under 110 words. "
        "Call out the biggest risk and one practical follow-up.\n\n"
        f"Window: last {days} days\n"
        f"Baseline performance: {baselines['performance']:.1f}%\n"
        f"Baseline downtime: {baselines['downtime']:.1f} min\n"
        f"Baseline absent: {baselines['absent']:.1f}\n"
        f"Anomalies: {[item.model_dump() for item in items]}"
    )
    summary, ai_used, is_degraded, provider = ai_router.generate_text(
        prompt,
        fallback=fallback,
        scope=f"org:{resolve_org_id(current_user) or current_user.id}:anomalies",
        max_tokens=200,
        telemetry_system="anomaly_detection",
    )
    return AnomalyResponse(
        days=days,
        plan=plan,
        min_plan=min_plan,
        quota_feature="summary",
        provider=provider,
        ai_used=ai_used,
        degraded=is_degraded,
        is_fallback=not ai_used,
        generated_at=datetime.now(timezone.utc),
        summary=summary,
        items=items,
    )


def _generate_executive_summary_response(
    db: Session,
    current_user: User,
    *,
    start: date,
    end: date,
    plan: str,
    min_plan: str,
) -> ExecutiveSummaryResponse:
    query = _scoped_entries_query(db, current_user).filter(Entry.date >= start, Entry.date <= end)

    performance_expr = case(
        (Entry.units_target > 0, (Entry.units_produced * 100.0) / Entry.units_target),
        else_=0.0,
    )
    totals = query.with_entities(
        func.sum(Entry.units_produced).label("total_units"),
        func.sum(Entry.units_target).label("total_target"),
        func.avg(performance_expr).label("average_performance"),
        func.sum(Entry.downtime_minutes).label("total_downtime"),
        func.sum(Entry.manpower_present).label("manpower_present"),
        func.sum(Entry.manpower_absent).label("manpower_absent"),
        func.sum(case((Entry.quality_issues.is_(True), 1), else_=0)).label("quality_issues"),
    ).first()

    grouped = (
        query.with_entities(
            Entry.shift.label("shift"),
            func.avg(performance_expr).label("performance"),
        )
        .group_by(Entry.shift)
        .all()
    )
    best_shift = max(grouped, key=lambda row: float(row.performance or 0), default=None)
    metrics = {
        "total_units": int(totals.total_units or 0) if totals else 0,
        "total_target": int(totals.total_target or 0) if totals else 0,
        "average_performance": round(float(totals.average_performance or 0), 2) if totals else 0.0,
        "total_downtime": int(totals.total_downtime or 0) if totals else 0,
        "manpower_present": int(totals.manpower_present or 0) if totals else 0,
        "manpower_absent": int(totals.manpower_absent or 0) if totals else 0,
        "quality_issues": int(totals.quality_issues or 0) if totals else 0,
        "best_shift": best_shift.shift if best_shift else None,
        "best_shift_performance": round(float(best_shift.performance or 0), 2) if best_shift else 0.0,
    }

    fallback = (
        f"From {start.isoformat()} to {end.isoformat()}, the plant produced {metrics['total_units']} units against a target of "
        f"{metrics['total_target']}, averaging {metrics['average_performance']:.1f}% performance with {metrics['total_downtime']} downtime minutes. "
        f"Best shift: {metrics['best_shift'] or 'n/a'}. Quality issues logged: {metrics['quality_issues']}."
    )
    prompt = (
        "Write a crisp executive factory update in 4-5 sentences. "
        "Use the metrics exactly, mention performance vs target, downtime, manpower, quality, and best shift, and end with one recommendation.\n\n"
        f"Start date: {start.isoformat()}\n"
        f"End date: {end.isoformat()}\n"
        f"Metrics: {metrics}"
    )
    summary, ai_used, is_degraded, provider = ai_router.generate_text(
        prompt,
        fallback=fallback,
        scope=f"org:{resolve_org_id(current_user) or current_user.id}:executive",
        max_tokens=240,
        telemetry_system="executive_summary",
    )
    return ExecutiveSummaryResponse(
        start_date=start.isoformat(),
        end_date=end.isoformat(),
        plan=plan,
        min_plan=min_plan,
        quota_feature="summary",
        provider=provider,
        ai_used=ai_used,
        degraded=is_degraded,
        is_fallback=not ai_used,
        generated_at=datetime.now(timezone.utc),
        metrics=metrics,
        summary=summary,
    )


def _queue_executive_summary_job(
    *,
    owner_id: int,
    org_id: str | None,
    factory_id: str | None,
    start: date,
    end: date,
    consume_quota: bool = True,
) -> dict[str, Any]:
    with SessionLocal() as preflight_db:
        job_user = preflight_db.query(User).filter(User.id == owner_id).first()
        if not job_user:
            raise HTTPException(status_code=404, detail="User is no longer available for AI summary.")
        job_user.active_org_id = org_id
        job_user.active_factory_id = factory_id
        min_plan = _executive_min_plan()
        plan = _require_min_plan(preflight_db, job_user, min_plan=min_plan, feature_name="Executive AI summary")
        cache_key = _ai_cache_key(preflight_db, job_user, "executive", plan, start.isoformat(), end.isoformat())
        cached = get_json(cache_key)
        if cached is None and consume_quota:
            _consume_quota(preflight_db, job_user, quota_feature="summary", plan=plan)

    job = create_job(
        kind="ai_executive_summary",
        owner_id=owner_id,
        org_id=org_id,
        message="Queued executive summary",
        context={
            "route": "/reports",
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "factory_id": factory_id,
        },
        retry_context={
            "owner_id": owner_id,
            "org_id": org_id,
            "factory_id": factory_id,
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "consume_quota": False,
        },
    )

    def worker(update):
        if cached is not None:
            update(100, "Loaded cached executive summary")
            return cached
        update(15, "Loading scoped KPI totals")
        with SessionLocal() as job_db:
            job_user = job_db.query(User).filter(User.id == owner_id).first()
            if not job_user:
                raise RuntimeError("User is no longer available for AI summary.")
            job_user.active_org_id = org_id
            job_user.active_factory_id = factory_id
            update(65, "Generating AI executive summary")
            response = _generate_executive_summary_response(
                job_db,
                job_user,
                start=start,
                end=end,
                plan=plan,
                min_plan=min_plan,
            )
            payload = response.model_dump(mode="json")
            set_json(cache_key, payload, AI_CACHE_TTL)
            _write_ai_audit(
                job_db,
                current_user=job_user,
                action="AI_EXECUTIVE_SUMMARY_GENERATED",
                details=f"start={start.isoformat()};end={end.isoformat()}",
            )
            return payload

    start_job(job["job_id"], worker)
    return job


def _retry_executive_summary_job(payload: dict[str, Any], _source_job: dict[str, Any]) -> dict[str, Any]:
    start_text = str(payload.get("start_date") or "")
    end_text = str(payload.get("end_date") or "")
    if not start_text or not end_text:
        raise RuntimeError("The original executive summary job is missing its date range.")
    return _queue_executive_summary_job(
        owner_id=int(payload["owner_id"]),
        org_id=str(payload["org_id"]) if payload.get("org_id") is not None else None,
        factory_id=str(payload["factory_id"]) if payload.get("factory_id") is not None else None,
        start=date.fromisoformat(start_text),
        end=date.fromisoformat(end_text),
        consume_quota=bool(payload.get("consume_quota")),
    )


register_retry_handler("ai_executive_summary", _retry_executive_summary_job)

def _queue_coil_theft_job(*, owner_id: int, org_id: str | None, factory_id: str | None) -> dict[str, Any]:
    with SessionLocal() as preflight_db:
        job_user = preflight_db.query(User).filter(User.id == owner_id).first()
        if not job_user:
            raise HTTPException(status_code=404, detail="User is no longer available for coil theft detection.")
        job_user.active_org_id = org_id
        job_user.active_factory_id = factory_id
        min_plan = normalize_plan(os.getenv("COIL_THEFT_MIN_PLAN") or COIL_THEFT_MIN_PLAN)
        plan = _require_min_plan(preflight_db, job_user, min_plan=min_plan, feature_name="Coil theft detection")
        _consume_quota(preflight_db, job_user, quota_feature="summary", plan=plan)

    job = create_job(
        kind="coil_theft_detection",
        owner_id=owner_id,
        org_id=org_id,
        message="Queued coil theft detection",
        context={
            "route": "/coil-theft/detect",
        },
        retry_context={
            "owner_id": owner_id,
            "org_id": org_id,
            "factory_id": factory_id,
        },
    )

    def worker(update):
        progress_callback = update
        progress_callback(10, "Starting coil theft detection")
        with SessionLocal() as job_db:
            job_user = job_db.query(User).filter(User.id == owner_id).first()
            if not job_user:
                raise RuntimeError("User is no longer available for coil theft detection.")
            job_user.active_org_id = org_id
            job_user.active_factory_id = factory_id
            progress_callback(50, "Running detection")
            alerts = detect_coil_theft(
                job_db,
                org_id=org_id,
                factory_id=factory_id,
            )
            progress_callback(90, f"Generated {len(alerts)} alerts")
            progress_callback(100, "Completed")
            return {"alerts_generated": len(alerts)}

    start_job(job["job_id"], worker)
    return job


def _retry_coil_theft_job(payload: dict[str, Any], _source_job: dict[str, Any]) -> dict[str, Any]:
    return _queue_coil_theft_job(
        owner_id=int(payload["owner_id"]),
        org_id=str(payload["org_id"]) if payload.get("org_id") is not None else None,
        factory_id=str(payload["factory_id"]) if payload.get("factory_id") is not None else None,
    )

register_retry_handler("coil_theft_detection", _retry_coil_theft_job)


@router.get("/usage", response_model=AiUsageResponse)
def get_ai_usage(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AiUsageResponse:
    _ensure_ai_access(current_user)
    PDP(db=db).require_permission(actor=current_user, permission_key="ai.usage.view")
    org_id = resolve_org_id(current_user)
    plan = get_org_plan(db, org_id=org_id, fallback_user_id=current_user.id)
    usage = get_org_usage_summary(db, org_id=org_id, plan=plan) if org_id else get_usage_summary(db, user_id=current_user.id)
    return AiUsageResponse(
        plan=plan,
        period=str(usage.get("period") or ""),
        summary_used=int(usage.get("summary_used") or 0),
        summary_limit=int(usage.get("summary_limit") or 0),
        email_used=int(usage.get("email_used") or 0),
        email_limit=int(usage.get("email_limit") or 0),
        smart_used=int(usage.get("smart_used") or 0),
        smart_limit=int(usage.get("smart_limit") or 0),
        suggestion_min_plan=_suggestion_min_plan(),
        anomaly_min_plan=_anomaly_min_plan(),
        nlq_min_plan=_nlq_min_plan(),
        executive_min_plan=_executive_min_plan(),
    )


@router.get("/suggestions", response_model=SuggestionResponse)
def get_dpr_suggestions(
    shift: ShiftType = Query(...),
    entry_date: date | None = Query(default=None),
    lookback_days: int = Query(default=DEFAULT_SUGGESTIONS_LOOKBACK_DAYS, ge=7, le=180),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SuggestionResponse:
    _ensure_ai_access(current_user)
    pdp = PDP(db=db)
    factory_id = resolve_factory_id(db, current_user)
    pdp.require_permission(
        actor=current_user,
        permission_key="ai.suggestions.view",
        resource=ResourceContext(factory_id=factory_id) if factory_id else None,
    )
    min_plan = _suggestion_min_plan()
    plan = _require_min_plan(db, current_user, min_plan=min_plan, feature_name="AI suggestions")
    _consume_quota(db, current_user, quota_feature="smart", plan=plan)

    target_date = entry_date or date.today()
    start = target_date - timedelta(days=lookback_days)
    entries = (
        _scoped_entries_query(db, current_user)
        .filter(Entry.date >= start, Entry.date < target_date, Entry.shift == shift)
        .order_by(Entry.date.desc())
        .limit(12)
        .all()
    )

    reference_entries = len(entries)
    if entries:
        suggestion = {
            "units_target": max(1, round(_safe_average([entry.units_target for entry in entries]))),
            "manpower_present": max(1, round(_safe_average([entry.manpower_present for entry in entries]))),
            "manpower_absent": max(0, round(_safe_average([entry.manpower_absent for entry in entries]))),
            "downtime_minutes": max(0, round(_safe_average([entry.downtime_minutes for entry in entries]))),
            "downtime_reason": Counter(
                [entry.downtime_reason.strip() for entry in entries if entry.downtime_reason]
            ).most_common(1)[0][0] if any(entry.downtime_reason for entry in entries) else "",
            "materials_used": Counter(
                [entry.materials_used.strip() for entry in entries if entry.materials_used]
            ).most_common(1)[0][0] if any(entry.materials_used for entry in entries) else "",
            "notes": "Watch the first hour closely and update actual blockers if the shift drifts from the recent pattern.",
        }
        avg_performance = _safe_average([_entry_performance(entry) for entry in entries])
        patterns = [
            f"Recent {shift} shifts averaged {avg_performance:.1f}% of target.",
            f"Typical manpower has been {suggestion['manpower_present']} present with {suggestion['manpower_absent']} absent.",
            f"Average downtime has stayed around {suggestion['downtime_minutes']} minutes.",
        ]
        if suggestion["downtime_reason"]:
            patterns.append(f"Most common downtime reason: {suggestion['downtime_reason']}.")
        if suggestion["materials_used"]:
            patterns.append(f"Common material note: {suggestion['materials_used']}.")
    else:
        suggestion = {
            "units_target": 0,
            "manpower_present": 0,
            "manpower_absent": 0,
            "downtime_minutes": 0,
            "downtime_reason": "",
            "materials_used": "",
            "notes": "No recent same-shift history was found, so treat this as a manual plan and update live numbers during the shift.",
        }
        patterns = ["No recent same-shift history was available in your current scope."]

    fallback = _fallback_suggestion_text(patterns, shift=shift)
    rationale, ai_used, is_degraded, provider = ai_router.generate_text(
        _build_suggestion_prompt(
            shift=shift,
            date_value=target_date.isoformat(),
            patterns=patterns,
            suggestion=suggestion,
        ),
        fallback=fallback,
        scope=f"org:{resolve_org_id(current_user) or current_user.id}:suggestions",
        max_tokens=180,
        telemetry_system="recommendations",
    )

    _write_ai_audit(
        db,
        current_user=current_user,
        action="AI_DPR_SUGGESTION_GENERATED",
        details=f"shift={shift};date={target_date.isoformat()};references={reference_entries}",
    )

    return SuggestionResponse(
        date=target_date.isoformat(),
        shift=shift,
        plan=plan,
        min_plan=min_plan,
        quota_feature="smart",
        provider=provider,
        ai_used=ai_used,
        degraded=is_degraded,
        is_fallback=not ai_used,
        reference_entries=reference_entries,
        generated_at=datetime.now(timezone.utc),
        suggestion=suggestion,
        recent_patterns=patterns,
        rationale=rationale,
    )


@router.get("/anomalies", response_model=AnomalyResponse)
def get_anomalies(
    days: int = Query(default=DEFAULT_ANOMALY_DAYS, ge=3, le=60),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AnomalyResponse:
    _ensure_ai_access(current_user)
    pdp = PDP(db=db)
    factory_id = resolve_factory_id(db, current_user)
    pdp.require_permission(
        actor=current_user,
        permission_key="ai.anomalies.view",
        resource=ResourceContext(factory_id=factory_id) if factory_id else None,
    )
    min_plan = _anomaly_min_plan()
    plan = _require_min_plan(db, current_user, min_plan=min_plan, feature_name="AI anomalies")
    cache_key = _ai_cache_key(db, current_user, "anomalies", plan, days)
    cached = get_json(cache_key)
    if cached is not None:
        return AnomalyResponse.model_validate(cached)

    _consume_quota(db, current_user, quota_feature="summary", plan=plan)
    response = _generate_anomaly_response(db, current_user, days=days, plan=plan, min_plan=min_plan)
    set_json(cache_key, response.model_dump(mode="json"), AI_CACHE_TTL)
    _write_ai_audit(
        db,
        current_user=current_user,
        action="AI_ANOMALY_SCAN_GENERATED",
        details=f"days={days};count={len(response.items)}",
    )
    return response


class HealthTrendPoint(BaseModel):
    """A single day's health score for trend visualization."""
    date: str
    score: int
    label: str
    performance: float
    downtime_min: float
    absenteeism: float
    quality_issues: int


class HealthTrendResponse(BaseModel):
    days: int
    current_score: int
    current_label: str
    trend: list[HealthTrendPoint]
    avg_score: float
    min_score: int
    max_score: int


@router.get("/health-trend", response_model=HealthTrendResponse)
def get_health_trend(
    days: int = Query(default=14, ge=3, le=90),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> HealthTrendResponse:
    """Compute daily factory health scores from Entry data for trend visualization.

    Each day's health score is calculated from:
      - Performance (units_produced / units_target) → 0-40 points
      - Downtime (inverse of downtime_minutes) → 0-25 points
      - Absenteeism (inverse of absent ratio) → 0-20 points
      - Quality (inverse of quality issues ratio) → 0-15 points

    Returns a time series suitable for an area/line chart on the frontend.
    """
    _ensure_ai_access(current_user)
    pdp = PDP(db=db)
    factory_id = resolve_factory_id(db, current_user)
    pdp.require_permission(
        actor=current_user,
        permission_key="ai.executive.view",
        resource=ResourceContext(factory_id=factory_id) if factory_id else None,
    )

    end = date.today()
    start = end - timedelta(days=days - 1)
    entries = (
        _scoped_entries_query(db, current_user)
        .filter(Entry.date >= start, Entry.date <= end)
        .order_by(Entry.date.asc())
        .all()
    )

    # Group entries by date
    daily_map: dict[date, list[Entry]] = {}
    for entry in entries:
        daily_map.setdefault(entry.date, []).append(entry)

    trend: list[HealthTrendPoint] = []
    for day_offset in range(days):
        day = end - timedelta(days=days - 1 - day_offset)
        day_entries = daily_map.get(day, [])

        if not day_entries:
            trend.append(HealthTrendPoint(
                date=day.isoformat(),
                score=0, label="no_data",
                performance=0.0, downtime_min=0.0,
                absenteeism=0.0, quality_issues=0,
            ))
            continue

        # Performance score (0-40)
        perf_values = [_entry_performance(e) for e in day_entries if e.units_target]
        avg_perf = _safe_average(perf_values)
        perf_score = min(40, int((avg_perf / 100.0) * 40))

        # Downtime score (0-25) — lower is better
        total_downtime = sum(e.downtime_minutes for e in day_entries)
        if total_downtime >= 240:
            dt_score = 0
        elif total_downtime >= 120:
            dt_score = 10
        elif total_downtime >= 60:
            dt_score = 18
        else:
            dt_score = 25

        # Absenteeism score (0-20)
        total_present = sum(e.manpower_present for e in day_entries)
        total_absent = sum(e.manpower_absent for e in day_entries)
        total_workers = total_present + total_absent
        if total_workers > 0:
            absent_rate = total_absent / total_workers
            att_score = max(0, 20 - int(absent_rate * 100))
        else:
            att_score = 15

        # Quality score (0-15)
        quality_count = sum(1 for e in day_entries if e.quality_issues)
        quality_score = max(0, 15 - quality_count * 3)

        total_score = perf_score + dt_score + att_score + quality_score

        if total_score >= 80:
            label = "good"
        elif total_score >= 60:
            label = "needs_attention"
        elif total_score >= 40:
            label = "at_risk"
        else:
            label = "critical"

        trend.append(HealthTrendPoint(
            date=day.isoformat(),
            score=min(100, total_score),
            label=label,
            performance=avg_perf,
            downtime_min=float(total_downtime),
            absenteeism=float(total_absent),
            quality_issues=quality_count,
        ))

    
    scores = [p.score for p in trend if p.label != "no_data"]
    current = trend[-1] if trend else HealthTrendPoint(date="", score=0, label="no_data", performance=0.0, downtime_min=0.0, absenteeism=0.0, quality_issues=0)

    return HealthTrendResponse(
        days=days,
        current_score=current.score,
        current_label=current.label,
        trend=trend,
        avg_score=round(_safe_average(scores), 1) if scores else 0.0,
        min_score=min(scores) if scores else 0,
        max_score=max(scores) if scores else 0,
    )


@router.get("/anomalies/preview", response_model=AnomalyResponse)
def get_anomaly_preview(
    days: int = Query(default=DEFAULT_ANOMALY_DAYS, ge=3, le=60),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AnomalyResponse:
    _ensure_ai_access(current_user)
    pdp = PDP(db=db)
    factory_id = resolve_factory_id(db, current_user)
    pdp.require_permission(
        actor=current_user,
        permission_key="ai.anomalies.view",
        resource=ResourceContext(factory_id=factory_id) if factory_id else None,
    )
    min_plan = _anomaly_min_plan()
    plan = _require_min_plan(db, current_user, min_plan=min_plan, feature_name="AI anomalies")
    cache_key = _ai_cache_key(db, current_user, "anomaly_preview", plan, days)
    cached = get_json(cache_key)
    if cached is not None:
        return AnomalyResponse.model_validate(cached)

    end = date.today()
    start = end - timedelta(days=days - 1)
    entries = (
        _scoped_entries_query(db, current_user)
        .filter(Entry.date >= start, Entry.date <= end)
        .order_by(Entry.date.desc())
        .all()
    )
    items, _baselines = _build_anomaly_items(entries)

    response = AnomalyResponse(
        days=days,
        plan=plan,
        min_plan=min_plan,
        quota_feature="summary",
        provider="preview",
        ai_used=False,
        generated_at=datetime.now(timezone.utc),
        summary=_anomaly_fallback_summary(items, days=days),
        items=items,
    )
    record_ai_event(
        system="anomaly_detection",
        operation="preview",
        provider="preview",
        model="rules-engine",
        latency_ms=0,
        token_estimate=0,
        fallback_used=False,
        degraded_mode=False,
        retry_count=0,
        timeout_hit=False,
        correction_applied=False,
        confidence_score=None,
        hallucination_blocked=False,
        rules_engine_used=True,
        success=True,
    )
    set_json(cache_key, response.model_dump(mode="json"), AI_CACHE_TTL)
    return response


@router.post("/query", response_model=NaturalLanguageQueryResponse)
def query_with_natural_language(
    payload: NaturalLanguageQueryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> NaturalLanguageQueryResponse:
    """
    11-step NLQ pipeline:
      1.  Auth + quota gate
      2.  Domain classification
      3.  Time scope parsing
      4.  Entity filter extraction
      5.  Per-domain permissions
      6.  Domain-specific data fetch
      7.  Build structured query
      8.  Extract data points
      9.  Build fallback text
     10.  Build AI prompt + generate
     11.  Audit + response
    """
    # ── Step 1: Auth, permission, plan, quota gate ───────────────────────
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

    # ── Step 0: Language detection + normalization (Phase 2) ────────────
    language = _detect_language(question)
    normalized_q = _normalize_question(question, language)
    # Use normalized version for classification; original preserved for prompt

    # ── Step 2: Domain classification (runs on normalized text) ─────────
    domain = _classify_nlq_domain(normalized_q)

    # ── Step 3: Time scope parsing (uses normalized text for Hindi support) ─
    start, end, scope_name = _parse_time_scope_v2(normalized_q)

    # ── Step 4: Entity filter extraction (uses normalized text) ────────────
    entity_filter = _parse_entity_filter(normalized_q)
    # Reserved for domain-specific fetchers (Days 3-5)

    # ── Step 5: Per-domain permissions ───────────────────────────────────
    _perms = _get_nlq_permissions(db, current_user, factory_id)
    # Currently used as a scaffolding flag; domain-specific permission
    # enforcement will be wired into each fetcher in Days 3-5.

    # ── Step 6: Domain-specific data fetch ───────────────────────────────
    # Routes to the correct domain fetcher via _fetch_nlq_data.
    # Falls back to GENERAL (Entry/DPR) data for unrecognized domains.
    domain_data = _fetch_nlq_data(db, current_user, domain, start, end, normalized_q)
    metric = domain_data.get("_metric") or _structured_metric(normalized_q)
    grouping = domain_data.get("_grouping") or _structured_grouping(normalized_q)

    # ── Step 7: Build structured query ──────────────────────────────────
    structured_query: dict[str, Any] = {
        "domain": domain.value,
        "metric": metric,
        "grouping": grouping,
        "scope": scope_name,
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "entity_filter": entity_filter,
    }

    # ── Step 8: Extract data points ──────────────────────────────────────
    data_points = _extract_data_points(domain, domain_data, metric, grouping)

    # ── Step 9: Build fallback text ─────────────────────────────────────
    fallback = _build_nlq_fallback(
        domain, domain_data, data_points, scope_name, metric,
    )

    # ── Step 10: Build AI prompt + generate ─────────────────────────────
    prompt = _build_nlq_prompt(
        domain, question, structured_query, data_points, domain_data,
        language=language,
    )
    answer, ai_used, is_degraded, provider = ai_router.generate_text(
        prompt,
        fallback=fallback,
        scope=f"org:{resolve_org_id(current_user) or current_user.id}:nlq",
        max_tokens=220,
        telemetry_system="nlq",
    )

    # ── Step 11: Action items + health score (Phase 2) ───────────────────
    action_items = _generate_nlq_action_items(domain, domain_data, data_points)
    if domain == NlqDomain.OWNER_INSIGHTS:
        health_score, health_label = _compute_health_score_v2(domain_data)
    elif domain in (NlqDomain.GENERAL, NlqDomain.PRODUCTION, NlqDomain.FINANCE):
        # Simple single-factor health: 0-100 based on performance/attainment
        perf_pct = 0.0
        if domain == NlqDomain.GENERAL:
            perf_pct = domain_data.get("avg_performance", 0.0) or 0.0
        elif domain == NlqDomain.PRODUCTION:
            s = domain_data.get("summary", {})
            perf_pct = s.get("overall_attainment_percent", 0.0) or 0.0
        elif domain == NlqDomain.FINANCE:
            realized = domain_data.get("realized_metrics", {})
            perf_pct = realized.get("margin_percent", 0.0) or 0.0
        health_score = min(100, max(0, int(perf_pct)))
        if health_score >= 80:
            health_label = "good"
        elif health_score >= 60:
            health_label = "needs_attention"
        elif health_score >= 40:
            health_label = "at_risk"
        else:
            health_label = "critical"
    else:
        health_score = None
        health_label = None

    # ── Step 12: Audit + response ───────────────────────────────────────
    _write_ai_audit(
        db,
        current_user=current_user,
        action="AI_NLQ_QUERY_EXECUTED",
        details=f"domain={domain.value};scope={scope_name}",
    )

    return NaturalLanguageQueryResponse(
        question=question,
        domain=domain.value,
        language=language,
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
        data_points=data_points[:10],
        action_items=action_items,
        health_score=health_score,
        health_label=health_label,
    )


@router.get("/executive-summary", response_model=ExecutiveSummaryResponse)
def executive_summary(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ExecutiveSummaryResponse:
    _ensure_ai_access(current_user)
    pdp = PDP(db=db)
    factory_id = resolve_factory_id(db, current_user)
    pdp.require_permission(
        actor=current_user,
        permission_key="ai.executive.view",
        resource=ResourceContext(factory_id=factory_id) if factory_id else None,
    )
    min_plan = _executive_min_plan()
    plan = _require_min_plan(db, current_user, min_plan=min_plan, feature_name="Executive AI summary")
    start = start_date or (date.today() - timedelta(days=6))
    end = end_date or date.today()
    cache_key = _ai_cache_key(db, current_user, "executive", plan, start.isoformat(), end.isoformat())
    cached = get_json(cache_key)
    if cached is not None:
        return ExecutiveSummaryResponse.model_validate(cached)

    _consume_quota(db, current_user, quota_feature="summary", plan=plan)
    response = _generate_executive_summary_response(
        db,
        current_user,
        start=start,
        end=end,
        plan=plan,
        min_plan=min_plan,
    )
    set_json(cache_key, response.model_dump(mode="json"), AI_CACHE_TTL)
    _write_ai_audit(
        db,
        current_user=current_user,
        action="AI_EXECUTIVE_SUMMARY_GENERATED",
        details=f"start={start.isoformat()};end={end.isoformat()}",
    )
    return response


@router.post("/executive-summary/jobs")
def executive_summary_job(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    _ensure_ai_access(current_user)
    pdp = PDP(db=db)
    factory_id = resolve_factory_id(db, current_user)
    pdp.require_permission(
        actor=current_user,
        permission_key="ai.executive.view",
        resource=ResourceContext(factory_id=factory_id) if factory_id else None,
    )
    min_plan = _executive_min_plan()
    _require_min_plan(db, current_user, min_plan=min_plan, feature_name="Executive AI summary")
    start = start_date or (date.today() - timedelta(days=6))
    end = end_date or date.today()
    return _queue_executive_summary_job(
        owner_id=current_user.id,
        org_id=resolve_org_id(current_user),
        factory_id=resolve_factory_id(db, current_user),
        start=start,
        end=end,
    )


@router.get("/jobs/{job_id}")
def get_ai_job(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    _ensure_ai_access(current_user)
    pdp = PDP(db=db)
    pdp.require_permission(actor=current_user, permission_key="ai.executive.view")
    job = get_job(job_id, owner_id=current_user.id)
    if not job or not str(job.get("kind", "")).startswith("ai_"):
        raise HTTPException(status_code=404, detail="AI job not found.")
    return job
