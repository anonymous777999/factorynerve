"""Email summary router for DPR.ai."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
import os
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from backend.ai_engine import build_email_prompt, estimate_tokens, generate_email_summary, has_any_ai_key
from backend.services import ai_router
from backend.models.entry import Entry
from backend.models.report import AuditLog
from backend.models.user import User, UserRole
from backend.models.user_factory_role import UserFactoryRole
from backend.plans import min_plan_for_feature, has_plan_feature, get_org_plan
from backend.feature_limits import check_and_record_feature_usage, check_and_record_org_feature_usage
from backend.ai_rate_limit import check_rate_limit, RateLimitError
from backend.database import get_db
from backend.security import get_current_user
from backend.rbac import require_any_role
from backend.tenancy import resolve_factory_id, resolve_org_id
from backend.query_helpers import apply_org_scope, apply_role_scope, factory_user_ids_query
from backend.services.report_trust import evaluate_report_trust_gate


router = APIRouter(tags=["Email"])


class EmailSummaryResponse(BaseModel):
    range: dict[str, str]
    totals: dict[str, float | int]
    top_performer: dict[str, float | int | str] | None
    most_downtime: dict[str, float | int | str] | None
    subject: str
    raw_lines: list[str]
    suggested_recipients: list[EmailStr]
    estimated_tokens: int
    provider: str
    plan: str
    can_send: bool
    min_plan: str


class EmailGenerateResponse(BaseModel):
    subject: str
    body: str
    estimated_tokens: int
    provider: str


class EmailSendRequest(BaseModel):
    start_date: date | None = None
    end_date: date | None = None
    to_emails: list[EmailStr] = Field(min_length=1)
    subject: str | None = None
    body: str | None = None
    use_ai: bool = True



def _factory_user_ids_query(db: Session, current_user: User):
    return factory_user_ids_query(db, current_user)


def _apply_org_filter(query: Any, current_user: User) -> Any:
    return apply_org_scope(query, current_user)


def _apply_role_filter(query: Any, db: Session, current_user: User) -> Any:
    return apply_role_scope(query, db, current_user)


def _summary_min_plan() -> str:
    return min_plan_for_feature("emailSummary")


def _can_send_email(plan: str) -> bool:
    return has_plan_feature(plan, "emailSummary")


def _get_recipients(db: Session, current_user: User) -> list[str]:
    query = db.query(User.email).filter(User.is_active.is_(True), User.role.in_([UserRole.MANAGER, UserRole.ADMIN, UserRole.OWNER]))
    org_id = resolve_org_id(current_user)
    if org_id:
        query = query.filter(User.org_id == org_id)
    factory_id = resolve_factory_id(db, current_user)
    if factory_id:
        query = query.join(UserFactoryRole, UserFactoryRole.user_id == User.id).filter(
            UserFactoryRole.factory_id == factory_id
        )
    recipients = [row.email for row in query.all() if row.email]
    if current_user.email not in recipients and current_user.role in {UserRole.MANAGER, UserRole.ADMIN, UserRole.OWNER}:
        recipients.append(current_user.email)
    return sorted(set(recipients))


def _build_summary(
    db: Session,
    current_user: User,
    start_date: date | None,
    end_date: date | None,
) -> dict[str, Any]:
    start = start_date or (date.today() - timedelta(days=7))
    end = end_date or date.today()
    query = db.query(Entry).filter(Entry.date >= start, Entry.date <= end, Entry.is_active.is_(True))
    query = _apply_org_filter(query, current_user)
    query = _apply_role_filter(query, db, current_user)

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
        func.sum(case((Entry.quality_issues.is_(True), 1), else_=0)).label("quality_issues_count"),
    ).first()

    supervisor_summary = (
        query.join(User, Entry.user_id == User.id)
        .with_entities(
            User.name.label("name"),
            func.avg(performance_expr).label("production_percent"),
            func.sum(Entry.downtime_minutes).label("downtime_minutes"),
        )
        .group_by(User.name)
        .all()
    )

    top_performer = None
    most_downtime = None
    if supervisor_summary:
        best = max(supervisor_summary, key=lambda row: row.production_percent or 0)
        worst = max(supervisor_summary, key=lambda row: row.downtime_minutes or 0)
        top_performer = {
            "name": best.name,
            "production_percent": float(best.production_percent or 0),
        }
        most_downtime = {
            "name": worst.name,
            "downtime_minutes": int(worst.downtime_minutes or 0),
        }

    totals_payload = {
        "total_units": int(totals.total_units or 0),
        "total_target": int(totals.total_target or 0),
        "average_performance": float(totals.average_performance or 0),
        "total_downtime": int(totals.total_downtime or 0),
        "manpower_present": int(totals.manpower_present or 0),
        "manpower_absent": int(totals.manpower_absent or 0),
        "quality_issues": int(totals.quality_issues_count or 0),
    }

    raw_lines = [
        f"DPR.ai Summary ({start.isoformat()} to {end.isoformat()})",
        f"Total units: {totals_payload['total_units']} / target {totals_payload['total_target']}",
        f"Average performance: {totals_payload['average_performance']:.2f}%",
        f"Total downtime: {totals_payload['total_downtime']} minutes",
        f"Manpower present: {totals_payload['manpower_present']} | absent: {totals_payload['manpower_absent']}",
        f"Quality issues logged: {totals_payload['quality_issues']}",
    ]
    if top_performer:
        raw_lines.append(f"Top performer: {top_performer['name']}, {top_performer['production_percent']:.2f}%")
    if most_downtime:
        raw_lines.append(f"Most downtime: {most_downtime['name']}, {most_downtime['downtime_minutes']} min")

    return {
        "range": {"start_date": start.isoformat(), "end_date": end.isoformat()},
        "totals": totals_payload,
        "top_performer": top_performer,
        "most_downtime": most_downtime,
        "raw_lines": raw_lines,
    }


def _require_email_trust_ready(
    db: Session,
    current_user: User,
    *,
    start: date,
    end: date,
) -> dict[str, Any]:
    trust_summary = evaluate_report_trust_gate(
        db,
        current_user,
        route="/email-summary",
        start=start,
        end=end,
    )
    if not trust_summary["can_send"]:
        raise HTTPException(status_code=409, detail=trust_summary["blocking_reason"])
    return trust_summary




@router.get("/summary", response_model=EmailSummaryResponse)
def get_email_summary(
    start_date: date | None = None,
    end_date: date | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EmailSummaryResponse:
    require_any_role(current_user, {UserRole.ACCOUNTANT, UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.ADMIN, UserRole.OWNER})
    summary = _build_summary(db, current_user, start_date, end_date)
    org_id = resolve_org_id(current_user)
    plan = get_org_plan(db, org_id=org_id, fallback_user_id=current_user.id)
    subject = f"DPR.ai Summary ({summary['range']['start_date']} to {summary['range']['end_date']})"
    prompt = build_email_prompt(summary)
    provider_label = ai_router.primary_provider_label()
    return EmailSummaryResponse(
        range=summary["range"],
        totals=summary["totals"],
        top_performer=summary["top_performer"],
        most_downtime=summary["most_downtime"],
        subject=subject,
        raw_lines=summary["raw_lines"],
        suggested_recipients=_get_recipients(db, current_user),
        estimated_tokens=estimate_tokens(prompt),
        provider=provider_label,
        plan=plan,
        can_send=_can_send_email(plan),
        min_plan=_summary_min_plan(),
    )




@router.post("/summary/generate", response_model=EmailGenerateResponse)
def generate_summary_email(
    start_date: date | None = None,
    end_date: date | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EmailGenerateResponse:
    require_any_role(current_user, {UserRole.ACCOUNTANT, UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.ADMIN, UserRole.OWNER})
    start = start_date or (date.today() - timedelta(days=7))
    end = end_date or date.today()
    _require_email_trust_ready(db, current_user, start=start, end=end)
    if not has_any_ai_key():
        raise HTTPException(
            status_code=400,
            detail="AI provider not configured. Add ANTHROPIC_API_KEY or OPENAI_API_KEY in DPR.ai/.env and restart.",
        )
    summary = _build_summary(db, current_user, start, end)
    org_id = resolve_org_id(current_user)
    plan = get_org_plan(db, org_id=org_id, fallback_user_id=current_user.id)
    if not _can_send_email(plan):
        raise HTTPException(
            status_code=403,
            detail=f"Email summaries are not available on the {plan.title()} plan. Upgrade to {_summary_min_plan().title()} or higher to unlock this.",
        )
    try:
        check_rate_limit(current_user.id, feature="email")
    except RateLimitError as error:
        raise HTTPException(status_code=429, detail=error.detail) from error
    if org_id:
        check_and_record_org_feature_usage(db, org_id=org_id, feature="email", plan=plan)
    else:
        check_and_record_feature_usage(db, user_id=current_user.id, feature="email", plan=plan)
    subject = f"DPR.ai Summary ({summary['range']['start_date']} to {summary['range']['end_date']})"
    scope_key = f"org:{org_id}" if org_id else f"user:{current_user.id}"
    body = generate_email_summary(summary, scope=scope_key)
    prompt = build_email_prompt(summary)
    provider = ai_router.primary_provider_label()
    db.add(
        AuditLog(
            user_id=current_user.id,
            org_id=resolve_org_id(current_user),
            factory_id=resolve_factory_id(db, current_user),
            action="EMAIL_SUMMARY_GENERATED",
            details=f"Email summary generated range={summary['range']['start_date']}..{summary['range']['end_date']}",
            ip_address=None,
            timestamp=datetime.now(timezone.utc),
        )
    )
    db.commit()
    return EmailGenerateResponse(
        subject=subject,
        body=body,
        estimated_tokens=estimate_tokens(prompt),
        provider=provider,
    )


@router.post("/summary/send")
def send_summary_email(
    payload: EmailSendRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    raise HTTPException(
        status_code=410,
        detail="Server-side SMTP sending is disabled. Use Gmail/Outlook compose buttons instead.",
    )
