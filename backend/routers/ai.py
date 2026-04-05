"""Phase 7 AI insights router for suggestions, anomalies, NLQ, and executive summaries."""

from __future__ import annotations

from collections import Counter
from datetime import date, datetime, timedelta, timezone
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
from backend.feature_limits import check_and_record_feature_usage, check_and_record_org_feature_usage
from backend.models.entry import Entry, ShiftType
from backend.models.report import AuditLog
from backend.models.user import User, UserRole
from backend.ocr_limits import get_org_usage_summary, get_usage_summary
from backend.plans import get_org_plan, normalize_plan, plan_rank
from backend.query_helpers import apply_org_scope, apply_role_scope
from backend.security import get_current_user
from backend.services import ai_router
from backend.services.background_jobs import create_job, get_job, register_retry_handler, start_job
from backend.tenancy import resolve_factory_id, resolve_org_id


router = APIRouter(tags=["AI"])

DEFAULT_SUGGESTIONS_LOOKBACK_DAYS = int(os.getenv("AI_SUGGESTIONS_LOOKBACK_DAYS", "60"))
DEFAULT_ANOMALY_DAYS = int(os.getenv("AI_ANOMALY_DEFAULT_DAYS", "14"))
AI_CACHE_TTL = int(os.getenv("AI_CACHE_TTL_SECONDS", "60"))


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
    generated_at: datetime
    summary: str
    items: list[AnomalyItem]


class NaturalLanguageQueryRequest(BaseModel):
    question: str = Field(min_length=4, max_length=400)


class NaturalLanguageQueryResponse(BaseModel):
    question: str
    plan: str
    min_plan: str
    quota_feature: str
    provider: str
    ai_used: bool
    generated_at: datetime
    structured_query: dict[str, Any]
    answer: str
    data_points: list[dict[str, Any]]


class ExecutiveSummaryResponse(BaseModel):
    start_date: str
    end_date: str
    plan: str
    min_plan: str
    quota_feature: str
    provider: str
    ai_used: bool
    generated_at: datetime
    metrics: dict[str, Any]
    summary: str


def _provider_label() -> str:
    return ai_router.primary_provider_label() if ai_router.has_any_key() else "fallback"


def _min_plan(env_key: str, default: str) -> str:
    return normalize_plan(os.getenv(env_key) or default)


def _suggestion_min_plan() -> str:
    return _min_plan("AI_SUGGESTIONS_MIN_PLAN", "free")


def _anomaly_min_plan() -> str:
    return _min_plan("AI_ANOMALIES_MIN_PLAN", "growth")


def _nlq_min_plan() -> str:
    return _min_plan("AI_NLQ_MIN_PLAN", "business")


def _executive_min_plan() -> str:
    return _min_plan("AI_EXECUTIVE_MIN_PLAN", "factory")


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
    try:
        check_rate_limit(current_user.id, feature=quota_feature)
    except RateLimitError as error:
        raise HTTPException(status_code=429, detail=error.detail) from error

    org_id = resolve_org_id(current_user)
    if org_id:
        check_and_record_org_feature_usage(db, org_id=org_id, feature=quota_feature, plan=plan)
    else:
        check_and_record_feature_usage(db, user_id=current_user.id, feature=quota_feature, plan=plan)


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


def _parse_time_scope(question: str) -> tuple[date, date, str]:
    today = date.today()
    text = question.lower()
    if "last month" in text:
        first_of_this_month = date(today.year, today.month, 1)
        end = first_of_this_month - timedelta(days=1)
        start = date(end.year, end.month, 1)
        return start, end, "last_month"
    if "this month" in text:
        start = date(today.year, today.month, 1)
        return start, today, "this_month"
    if "today" in text:
        return today, today, "today"
    if "yesterday" in text:
        day = today - timedelta(days=1)
        return day, day, "yesterday"
    if "last 30" in text or "30 day" in text:
        return today - timedelta(days=29), today, "last_30_days"
    if "last 14" in text or "14 day" in text:
        return today - timedelta(days=13), today, "last_14_days"
    return today - timedelta(days=6), today, "last_7_days"


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
    summary, ai_used = ai_router.generate_text(
        prompt,
        fallback=fallback,
        scope=f"org:{resolve_org_id(current_user) or current_user.id}:anomalies",
        max_tokens=200,
    )
    return AnomalyResponse(
        days=days,
        plan=plan,
        min_plan=min_plan,
        quota_feature="summary",
        provider=_provider_label(),
        ai_used=ai_used,
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
    summary, ai_used = ai_router.generate_text(
        prompt,
        fallback=fallback,
        scope=f"org:{resolve_org_id(current_user) or current_user.id}:executive",
        max_tokens=240,
    )
    return ExecutiveSummaryResponse(
        start_date=start.isoformat(),
        end_date=end.isoformat(),
        plan=plan,
        min_plan=min_plan,
        quota_feature="summary",
        provider=_provider_label(),
        ai_used=ai_used,
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


@router.get("/usage", response_model=AiUsageResponse)
def get_ai_usage(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AiUsageResponse:
    _ensure_ai_access(current_user)
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
    if current_user.role == UserRole.ACCOUNTANT:
        raise HTTPException(status_code=403, detail="Accountant role cannot generate DPR suggestions.")
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
    rationale, ai_used = ai_router.generate_text(
        _build_suggestion_prompt(
            shift=shift,
            date_value=target_date.isoformat(),
            patterns=patterns,
            suggestion=suggestion,
        ),
        fallback=fallback,
        scope=f"org:{resolve_org_id(current_user) or current_user.id}:suggestions",
        max_tokens=180,
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
        provider=_provider_label(),
        ai_used=ai_used,
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


@router.get("/anomalies/preview", response_model=AnomalyResponse)
def get_anomaly_preview(
    days: int = Query(default=DEFAULT_ANOMALY_DAYS, ge=3, le=60),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AnomalyResponse:
    _ensure_ai_access(current_user)
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
    set_json(cache_key, response.model_dump(mode="json"), AI_CACHE_TTL)
    return response


@router.post("/query", response_model=NaturalLanguageQueryResponse)
def query_with_natural_language(
    payload: NaturalLanguageQueryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> NaturalLanguageQueryResponse:
    _ensure_ai_access(current_user)
    min_plan = _nlq_min_plan()
    plan = _require_min_plan(db, current_user, min_plan=min_plan, feature_name="Natural language queries")
    _consume_quota(db, current_user, quota_feature="summary", plan=plan)

    question = payload.question.strip()
    start, end, scope_name = _parse_time_scope(question)
    metric = _structured_metric(question)
    grouping = _structured_grouping(question)

    entries = (
        _scoped_entries_query(db, current_user)
        .filter(Entry.date >= start, Entry.date <= end)
        .order_by(Entry.date.asc())
        .all()
    )

    data_points: list[dict[str, Any]] = []
    if grouping == "shift":
        grouped: dict[str, list[Entry]] = {}
        for entry in entries:
            grouped.setdefault(str(entry.shift), []).append(entry)
        for key, group in grouped.items():
            if metric == "downtime":
                value = sum(item.downtime_minutes for item in group)
            elif metric == "manpower":
                value = sum(item.manpower_present for item in group)
            elif metric == "performance":
                value = _safe_average([_entry_performance(item) for item in group])
            else:
                value = sum(item.units_produced for item in group)
            data_points.append({"group": key, "value": round(float(value), 2)})
    elif grouping == "day":
        grouped = {}
        for entry in entries:
            grouped.setdefault(entry.date.isoformat(), []).append(entry)
        for key, group in grouped.items():
            if metric == "downtime":
                value = sum(item.downtime_minutes for item in group)
            elif metric == "manpower":
                value = sum(item.manpower_present for item in group)
            elif metric == "performance":
                value = _safe_average([_entry_performance(item) for item in group])
            else:
                value = sum(item.units_produced for item in group)
            data_points.append({"group": key, "value": round(float(value), 2)})
    else:
        if metric == "downtime":
            value = sum(item.downtime_minutes for item in entries)
        elif metric == "manpower":
            value = sum(item.manpower_present for item in entries)
        elif metric == "performance":
            value = _safe_average([_entry_performance(item) for item in entries])
        else:
            value = sum(item.units_produced for item in entries)
        data_points.append({"group": "total", "value": round(float(value), 2)})

    structured_query = {
        "metric": metric,
        "grouping": grouping,
        "scope": scope_name,
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
    }

    fallback = (
        f"For {scope_name.replace('_', ' ')}, the {metric} result is {data_points[0]['value'] if data_points else 0}."
        if grouping == "total"
        else f"I grouped {metric} by {grouping} for {scope_name.replace('_', ' ')} and found: {data_points[:5]}."
    )
    prompt = (
        "Answer the factory KPI question below in under 120 words. "
        "Stay factual, use the supplied numbers, and mention the time window.\n\n"
        f"Question: {question}\n"
        f"Structured query: {structured_query}\n"
        f"Data points: {data_points[:10]}"
    )
    answer, ai_used = ai_router.generate_text(
        prompt,
        fallback=fallback,
        scope=f"org:{resolve_org_id(current_user) or current_user.id}:nlq",
        max_tokens=220,
    )

    _write_ai_audit(
        db,
        current_user=current_user,
        action="AI_NLQ_QUERY_EXECUTED",
        details=f"metric={metric};grouping={grouping};scope={scope_name}",
    )

    return NaturalLanguageQueryResponse(
        question=question,
        plan=plan,
        min_plan=min_plan,
        quota_feature="summary",
        provider=_provider_label(),
        ai_used=ai_used,
        generated_at=datetime.now(timezone.utc),
        structured_query=structured_query,
        answer=answer,
        data_points=data_points[:10],
    )


@router.get("/executive-summary", response_model=ExecutiveSummaryResponse)
def executive_summary(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ExecutiveSummaryResponse:
    _ensure_ai_access(current_user)
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
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    _ensure_ai_access(current_user)
    job = get_job(job_id, owner_id=current_user.id)
    if not job or not str(job.get("kind", "")).startswith("ai_"):
        raise HTTPException(status_code=404, detail="AI job not found.")
    return job
