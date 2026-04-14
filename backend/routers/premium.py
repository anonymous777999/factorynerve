"""Premium analytics layer for Factory and Enterprise plans."""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone
from io import BytesIO
from textwrap import wrap
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.entry import Entry, ShiftType
from backend.models.factory import Factory
from backend.models.report import AuditLog
from backend.models.user import User, UserRole
from backend.premium_access import premium_required, require_premium_plan
from backend.query_helpers import apply_org_scope, apply_role_scope, factory_user_ids_query
from backend.rbac import require_any_role
from backend.security import get_current_user
from backend.services.report_trust import evaluate_report_trust_gate
from backend.tenancy import resolve_factory_id, resolve_org_id


router = APIRouter(tags=["Premium"])


class PremiumFilterOption(BaseModel):
    id: str
    label: str


class PremiumSummary(BaseModel):
    total_units: int
    total_target: int
    average_performance: float
    total_downtime: int
    issues_count: int
    active_factories: int
    active_people: int


class PremiumSeriesPoint(BaseModel):
    date: str
    factory_id: str
    factory_name: str
    shift: str
    units: int
    target: int
    performance: float
    downtime: int
    issues: int


class PremiumHeatmapCell(BaseModel):
    day: str
    label: str
    hour: int
    count: int
    level: int


class PremiumAuditItem(BaseModel):
    id: int
    timestamp: datetime
    action: str
    details: str | None
    user_name: str | None
    user_email: str | None
    factory_id: str | None


class PremiumDashboardResponse(BaseModel):
    plan: str
    generated_at: datetime
    enterprise_mode: bool
    filters: dict[str, list[PremiumFilterOption]]
    summary: PremiumSummary
    series: list[PremiumSeriesPoint]
    heatmap: list[PremiumHeatmapCell]
    audit_preview: list[PremiumAuditItem]
    insights: list[str]


class PremiumAuditTrailResponse(BaseModel):
    items: list[PremiumAuditItem]
    total: int
    limit: int


def _start_day(days: int) -> date:
    safe_days = max(7, min(days, 45))
    return date.today() - timedelta(days=safe_days - 1)


def _allowed_factories(db: Session, current_user: User) -> list[Factory]:
    org_id = resolve_org_id(current_user)
    query = db.query(Factory).filter(Factory.is_active.is_(True))
    if org_id:
        query = query.filter(Factory.org_id == org_id)

    if current_user.role in {UserRole.SUPERVISOR, UserRole.MANAGER}:
        active_factory_id = resolve_factory_id(db, current_user)
        if active_factory_id:
            query = query.filter(Factory.factory_id == active_factory_id)
    elif current_user.role == UserRole.OPERATOR:
        active_factory_id = resolve_factory_id(db, current_user)
        if active_factory_id:
            query = query.filter(Factory.factory_id == active_factory_id)

    return query.order_by(Factory.name.asc()).all()


def _entry_query(
    db: Session,
    current_user: User,
    *,
    start: date,
    end: date,
    factory_id: str | None,
    shift: ShiftType | None,
):
    query = db.query(Entry).filter(
        Entry.is_active.is_(True),
        Entry.date >= start,
        Entry.date <= end,
    )
    query = apply_org_scope(query, current_user)
    query = apply_role_scope(query, db, current_user)
    if factory_id:
        query = query.filter(Entry.factory_id == factory_id)
    if shift:
        query = query.filter(Entry.shift == shift)
    return query


def _audit_query(
    db: Session,
    current_user: User,
    *,
    start_dt: datetime,
    factory_id: str | None = None,
    action: str | None = None,
):
    org_id = resolve_org_id(current_user)
    query = db.query(AuditLog).filter(AuditLog.timestamp >= start_dt)
    if org_id:
        query = query.filter(AuditLog.org_id == org_id)
    if current_user.role in {UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.OPERATOR}:
        active_factory_id = resolve_factory_id(db, current_user)
        if active_factory_id:
            query = query.filter(AuditLog.factory_id == active_factory_id)
    if factory_id:
        query = query.filter(AuditLog.factory_id == factory_id)
    if action:
        query = query.filter(AuditLog.action == action)
    return query


def _build_insights(
    summary: PremiumSummary,
    series: list[PremiumSeriesPoint],
    *,
    enterprise_mode: bool,
) -> list[str]:
    insights: list[str] = []
    if summary.total_target > 0:
        gap = summary.total_target - summary.total_units
        if gap > 0:
            insights.append(f"Output is behind target by {gap} units in the selected window.")
        else:
            insights.append(f"Output is ahead of target by {abs(gap)} units in the selected window.")
    if summary.total_downtime > 0:
        insights.append(f"Downtime accumulated to {summary.total_downtime} minutes and should be reviewed by shift.")

    by_factory: dict[str, list[PremiumSeriesPoint]] = defaultdict(list)
    for point in series:
        by_factory[point.factory_name].append(point)

    if by_factory:
        worst_factory = min(
            by_factory.items(),
            key=lambda item: sum(p.performance for p in item[1]) / max(1, len(item[1])),
        )
        avg_perf = sum(p.performance for p in worst_factory[1]) / max(1, len(worst_factory[1]))
        insights.append(f"{worst_factory[0]} is the main intervention candidate at {avg_perf:.1f}% average performance.")

    if enterprise_mode:
        issue_days = len({point.date for point in series if point.issues > 0})
        insights.append(
            f"Enterprise mode active: {issue_days} day(s) in the selected window showed quality flags or audit-heavy activity."
        )

    return insights[:4]


def _heatmap_level(count: int, max_count: int) -> int:
    if count <= 0 or max_count <= 0:
        return 0
    ratio = count / max_count
    if ratio >= 0.75:
        return 4
    if ratio >= 0.5:
        return 3
    if ratio >= 0.25:
        return 2
    return 1


def _build_dashboard_payload(
    db: Session,
    current_user: User,
    *,
    days: int,
    factory_id: str | None,
    shift: ShiftType | None,
) -> PremiumDashboardResponse:
    plan = require_premium_plan(db, current_user, min_plan="factory")
    enterprise_mode = plan == "enterprise"
    allowed_factories = _allowed_factories(db, current_user)
    allowed_ids = {factory.factory_id for factory in allowed_factories}
    if factory_id and allowed_ids and factory_id not in allowed_ids:
        raise HTTPException(status_code=403, detail="Factory filter is outside your scope.")

    start = _start_day(days)
    end = date.today()
    query = _entry_query(db, current_user, start=start, end=end, factory_id=factory_id, shift=shift)

    performance_expr = case(
        (Entry.units_target > 0, (Entry.units_produced * 100.0) / Entry.units_target),
        else_=0.0,
    )
    issue_expr = case((Entry.quality_issues.is_(True), 1), else_=0)

    totals = query.with_entities(
        func.sum(Entry.units_produced).label("total_units"),
        func.sum(Entry.units_target).label("total_target"),
        func.avg(performance_expr).label("average_performance"),
        func.sum(Entry.downtime_minutes).label("total_downtime"),
        func.sum(issue_expr).label("issues_count"),
        func.count(func.distinct(Entry.factory_id)).label("active_factories"),
    ).first()

    active_people_query = db.query(func.count(User.id)).filter(User.is_active.is_(True))
    org_id = resolve_org_id(current_user)
    if org_id:
        active_people_query = active_people_query.filter(User.org_id == org_id)
    if current_user.role in {UserRole.SUPERVISOR, UserRole.MANAGER}:
        active_people_query = active_people_query.filter(
            User.id.in_(factory_user_ids_query(db, current_user))
        )
    elif current_user.role == UserRole.OPERATOR:
        active_people_query = active_people_query.filter(User.id == current_user.id)

    factory_name_map = {
        factory.factory_id: factory.name
        for factory in allowed_factories
    }
    if not factory_name_map:
        rows = (
            db.query(Factory)
            .filter(Factory.factory_id.in_(db.query(Entry.factory_id).distinct()))
            .all()
        )
        for row in rows:
            factory_name_map[row.factory_id] = row.name

    series_rows = (
        query.with_entities(
            Entry.date.label("date"),
            Entry.factory_id.label("factory_id"),
            Entry.shift.label("shift"),
            func.sum(Entry.units_produced).label("units"),
            func.sum(Entry.units_target).label("target"),
            func.avg(performance_expr).label("performance"),
            func.sum(Entry.downtime_minutes).label("downtime"),
            func.sum(issue_expr).label("issues"),
        )
        .group_by(Entry.date, Entry.factory_id, Entry.shift)
        .order_by(Entry.date.asc(), Entry.factory_id.asc(), Entry.shift.asc())
        .all()
    )
    series = [
        PremiumSeriesPoint(
            date=row.date.isoformat(),
            factory_id=row.factory_id or "unknown",
            factory_name=factory_name_map.get(row.factory_id, "Unassigned Factory"),
            shift=str(row.shift),
            units=int(row.units or 0),
            target=int(row.target or 0),
            performance=float(row.performance or 0),
            downtime=int(row.downtime or 0),
            issues=int(row.issues or 0),
        )
        for row in series_rows
    ]

    heatmap_start = datetime.combine(date.today() - timedelta(days=6), time.min, tzinfo=timezone.utc)
    audit_logs = (
        _audit_query(db, current_user, start_dt=heatmap_start, factory_id=factory_id)
        .order_by(AuditLog.timestamp.desc())
        .limit(250)
        .all()
    )
    by_cell: dict[tuple[str, int], int] = defaultdict(int)
    recent_items: list[PremiumAuditItem] = []
    for log in audit_logs:
        ts = log.timestamp if log.timestamp.tzinfo else log.timestamp.replace(tzinfo=timezone.utc)
        day_key = ts.date().isoformat()
        by_cell[(day_key, ts.hour)] += 1

    recent_user_ids = {log.user_id for log in audit_logs if log.user_id}
    user_map: dict[int, User] = {}
    if recent_user_ids:
        users = db.query(User).filter(User.id.in_(recent_user_ids)).all()
        user_map = {user.id: user for user in users}

    for log in audit_logs[:18]:
        user = user_map.get(log.user_id) if log.user_id else None
        recent_items.append(
            PremiumAuditItem(
                id=log.id,
                timestamp=log.timestamp,
                action=log.action,
                details=log.details,
                user_name=user.name if user else None,
                user_email=user.email if user else None,
                factory_id=log.factory_id,
            )
        )

    max_count = max(by_cell.values() or [0])
    heatmap: list[PremiumHeatmapCell] = []
    for offset in range(7):
        day_value = date.today() - timedelta(days=6 - offset)
        day_key = day_value.isoformat()
        for hour in range(24):
            count = by_cell.get((day_key, hour), 0)
            heatmap.append(
                PremiumHeatmapCell(
                    day=day_key,
                    label=day_value.strftime("%a"),
                    hour=hour,
                    count=count,
                    level=_heatmap_level(count, max_count),
                )
            )

    summary = PremiumSummary(
        total_units=int(totals.total_units or 0),
        total_target=int(totals.total_target or 0),
        average_performance=float(totals.average_performance or 0),
        total_downtime=int(totals.total_downtime or 0),
        issues_count=int(totals.issues_count or 0),
        active_factories=int(totals.active_factories or 0),
        active_people=int(active_people_query.scalar() or 0),
    )

    filters = {
        "factories": [
            PremiumFilterOption(id=factory.factory_id, label=factory.name)
            for factory in allowed_factories
        ],
        "shifts": [
            PremiumFilterOption(id="morning", label="Morning"),
            PremiumFilterOption(id="evening", label="Evening"),
            PremiumFilterOption(id="night", label="Night"),
        ],
    }

    return PremiumDashboardResponse(
        plan=plan,
        generated_at=datetime.now(timezone.utc),
        enterprise_mode=enterprise_mode,
        filters=filters,
        summary=summary,
        series=series,
        heatmap=heatmap,
        audit_preview=recent_items,
        insights=_build_insights(summary, series, enterprise_mode=enterprise_mode),
    )


def _format_signoff_time(value: str | None) -> str:
    if not value:
        return "-"
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return value
    return parsed.astimezone(timezone.utc).strftime("%d %b %Y %H:%M UTC")


def _render_executive_pdf(
    payload: PremiumDashboardResponse,
    *,
    days: int,
    factory_label: str,
    shift_label: str,
    trust_summary: dict[str, Any],
) -> bytes:
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    pdf.setFillColor(colors.HexColor("#0B0E14"))
    pdf.rect(0, 0, width, height, stroke=0, fill=1)

    pdf.setFillColor(colors.HexColor("#3EA6FF"))
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawString(40, height - 38, "DPR.ai EXECUTIVE ANALYTICS")

    pdf.setFillColor(colors.white)
    pdf.setFont("Helvetica-Bold", 20)
    pdf.drawString(40, height - 60, "Premium Command Center Brief")

    pdf.setFont("Helvetica", 10)
    pdf.setFillColor(colors.HexColor("#D0D7E2"))
    pdf.drawString(
        40,
        height - 78,
        f"Generated {payload.generated_at.astimezone(timezone.utc).strftime('%d %b %Y %H:%M UTC')} | Plan {payload.plan.title()} | Window {days} days",
    )
    pdf.drawString(40, height - 92, f"Factory filter: {factory_label} | Shift filter: {shift_label}")

    cards = [
        ("Output", str(payload.summary.total_units)),
        ("Target", str(payload.summary.total_target)),
        ("Performance", f"{payload.summary.average_performance:.1f}%"),
        ("Downtime", f"{payload.summary.total_downtime} min"),
    ]
    card_y = height - 150
    card_width = 118
    for index, (label, value) in enumerate(cards):
        x = 40 + index * (card_width + 12)
        pdf.setFillColor(colors.HexColor("#152032"))
        pdf.roundRect(x, card_y, card_width, 56, 10, stroke=0, fill=1)
        pdf.setFillColor(colors.HexColor("#8AA4BE"))
        pdf.setFont("Helvetica", 9)
        pdf.drawString(x + 12, card_y + 38, label)
        pdf.setFillColor(colors.white)
        pdf.setFont("Helvetica-Bold", 16)
        pdf.drawString(x + 12, card_y + 18, value)

    pdf.setFillColor(colors.white)
    pdf.setFont("Helvetica-Bold", 13)
    pdf.drawString(40, card_y - 24, "Operational Insights")
    pdf.setFont("Helvetica", 10)
    pdf.setFillColor(colors.HexColor("#D0D7E2"))
    line_y = card_y - 42
    for insight in payload.insights:
        pdf.drawString(48, line_y, f"- {insight[:110]}")
        line_y -= 16

    pdf.setFillColor(colors.white)
    pdf.setFont("Helvetica-Bold", 13)
    pdf.drawString(40, line_y - 8, "Recent Audit Trail")
    line_y -= 28

    pdf.setFont("Helvetica", 9)
    pdf.setFillColor(colors.HexColor("#AFC1D6"))
    preview_items = payload.audit_preview[:8]
    for item in preview_items:
        stamp = item.timestamp.astimezone(timezone.utc).strftime("%d %b %H:%M")
        actor = item.user_name or item.user_email or "System"
        detail = (item.details or "-").replace("\n", " ")
        detail = detail[:90] + ("..." if len(detail) > 90 else "")
        pdf.drawString(40, line_y, f"{stamp} | {actor} | {item.action}")
        line_y -= 12
        pdf.setFillColor(colors.HexColor("#71859B"))
        pdf.drawString(52, line_y, detail)
        line_y -= 16
        pdf.setFillColor(colors.HexColor("#AFC1D6"))
        if line_y < 60:
            break

    if line_y > 116:
        pdf.setFillColor(colors.white)
        pdf.setFont("Helvetica-Bold", 13)
        pdf.drawString(40, line_y - 2, "Trust Gate")
        line_y -= 22
        pdf.setFont("Helvetica", 10)
        pdf.setFillColor(colors.HexColor("#D0D7E2"))
        trust_lines = [
            f"OCR reviewed: {trust_summary['ocr']['approved_count']} of {trust_summary['ocr']['total_count']} approved",
            (
                f"Shift entries: {trust_summary['shift_entries']['approved_count']} of "
                f"{trust_summary['shift_entries']['total_count']} approved"
            ),
            (
                "Attendance: "
                f"{'reviewed' if trust_summary['attendance']['status'] == 'reviewed' else 'not reviewed'}"
            ),
            f"Overall trust score: {trust_summary['overall_trust_score']}%",
            trust_summary["confirmation"],
        ]
        for trust_line in trust_lines:
            pdf.drawString(48, line_y, trust_line[:112])
            line_y -= 14

    pdf.showPage()

    def start_dark_page(title: str, subtitle: str) -> float:
        pdf.setFillColor(colors.HexColor("#0B0E14"))
        pdf.rect(0, 0, width, height, stroke=0, fill=1)
        pdf.setFillColor(colors.HexColor("#3EA6FF"))
        pdf.setFont("Helvetica-Bold", 10)
        pdf.drawString(40, height - 38, "DPR.ai TRUST APPENDIX")
        pdf.setFillColor(colors.white)
        pdf.setFont("Helvetica-Bold", 20)
        pdf.drawString(40, height - 62, title)
        pdf.setFont("Helvetica", 10)
        pdf.setFillColor(colors.HexColor("#D0D7E2"))
        pdf.drawString(40, height - 80, subtitle[:120])
        return height - 112

    def ensure_space(current_y: float, needed_height: float, section_title: str) -> float:
        if current_y >= needed_height:
            return current_y
        pdf.showPage()
        return start_dark_page("Trust Sign-offs", section_title)

    y = start_dark_page(
        "Trust Sign-offs",
        f"Window {trust_summary['range']['start_date']} to {trust_summary['range']['end_date']} | Score {trust_summary['overall_trust_score']}%",
    )

    summary_lines = [
        f"OCR reviewed: {trust_summary['ocr']['reviewed_count']} of {trust_summary['ocr']['total_count']} | approved {trust_summary['ocr']['approved_count']}",
        (
            f"Shift entries reviewed: {trust_summary['shift_entries']['reviewed_count']} of "
            f"{trust_summary['shift_entries']['total_count']} | approved {trust_summary['shift_entries']['approved_count']}"
        ),
        (
            f"Attendance reviewed: {trust_summary['attendance']['reviewed_count']} of "
            f"{trust_summary['attendance']['total_count']} | status {trust_summary['attendance']['status'].replace('_', ' ')}"
        ),
        trust_summary["confirmation"],
    ]
    pdf.setFont("Helvetica", 10)
    pdf.setFillColor(colors.HexColor("#D0D7E2"))
    for line in summary_lines:
        y = ensure_space(y, 72, "Trust summary")
        pdf.drawString(40, y, line[:112])
        y -= 15

    sections = [
        ("Approved OCR records", trust_summary["approval_register"]["ocr"]),
        ("Approved shift entries", trust_summary["approval_register"]["shift_entries"]),
        ("Approved attendance records", trust_summary["approval_register"]["attendance"]),
    ]
    for title, records in sections:
        y = ensure_space(y, 110, title)
        pdf.setFillColor(colors.white)
        pdf.setFont("Helvetica-Bold", 13)
        pdf.drawString(40, y, title)
        y -= 18
        pdf.setFont("Helvetica", 9)
        if not records:
            pdf.setFillColor(colors.HexColor("#71859B"))
            pdf.drawString(48, y, "No approved records in this section for the selected window.")
            y -= 18
            continue
        for record in records:
            wrapped_label = wrap(str(record.get("label") or "-"), width=70) or ["-"]
            needed_height = 32 + (len(wrapped_label) * 12)
            y = ensure_space(y, max(needed_height, 90), title)
            pdf.setFillColor(colors.HexColor("#AFC1D6"))
            for label_line in wrapped_label:
                pdf.drawString(48, y, label_line)
                y -= 12
            pdf.setFillColor(colors.HexColor("#71859B"))
            pdf.drawString(
                60,
                y,
                (
                    f"Approved by {record.get('approved_by_name') or '-'} "
                    f"on {_format_signoff_time(record.get('approved_at'))}"
                )[:112],
            )
            y -= 18

    pdf.save()
    return buffer.getvalue()


@router.get("/dashboard", response_model=PremiumDashboardResponse)
@premium_required(min_plan="factory")
def premium_dashboard(
    days: int = Query(default=14, ge=7, le=45),
    factory_id: str | None = Query(default=None),
    shift: ShiftType | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PremiumDashboardResponse:
    require_any_role(current_user, {UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.ADMIN, UserRole.OWNER})
    return _build_dashboard_payload(
        db,
        current_user,
        days=days,
        factory_id=factory_id,
        shift=shift,
    )


@router.get("/audit-trail", response_model=PremiumAuditTrailResponse)
@premium_required(min_plan="factory")
def premium_audit_trail(
    days: int = Query(default=14, ge=7, le=45),
    limit: int = Query(default=60, ge=10, le=200),
    factory_id: str | None = Query(default=None),
    action: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PremiumAuditTrailResponse:
    require_any_role(current_user, {UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.ADMIN, UserRole.OWNER})
    allowed_factories = _allowed_factories(db, current_user)
    allowed_ids = {factory.factory_id for factory in allowed_factories}
    if factory_id and allowed_ids and factory_id not in allowed_ids:
        raise HTTPException(status_code=403, detail="Factory filter is outside your scope.")

    start_dt = datetime.combine(_start_day(days), time.min, tzinfo=timezone.utc)
    query = _audit_query(db, current_user, start_dt=start_dt, factory_id=factory_id, action=action)
    total = query.count()
    logs = query.order_by(AuditLog.timestamp.desc()).limit(limit).all()
    user_ids = {log.user_id for log in logs if log.user_id}
    user_map: dict[int, User] = {}
    if user_ids:
        users = db.query(User).filter(User.id.in_(user_ids)).all()
        user_map = {user.id: user for user in users}

    items = [
        PremiumAuditItem(
            id=log.id,
            timestamp=log.timestamp,
            action=log.action,
            details=log.details,
            user_name=user_map.get(log.user_id).name if log.user_id in user_map else None,
            user_email=user_map.get(log.user_id).email if log.user_id in user_map else None,
            factory_id=log.factory_id,
        )
        for log in logs
    ]
    return PremiumAuditTrailResponse(items=items, total=total, limit=limit)


@router.get("/executive-pdf")
@premium_required(min_plan="factory")
def premium_executive_pdf(
    days: int = Query(default=14, ge=7, le=45),
    factory_id: str | None = Query(default=None),
    shift: ShiftType | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    require_any_role(current_user, {UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.ADMIN, UserRole.OWNER})
    start = _start_day(days)
    end = date.today()
    trust_summary = evaluate_report_trust_gate(
        db,
        current_user,
        route="/premium/dashboard",
        start=start,
        end=end,
        shift=shift.value if shift else None,
        factory_id=factory_id,
    )
    if not trust_summary["can_send"]:
        raise HTTPException(status_code=409, detail=trust_summary["blocking_reason"])
    payload = _build_dashboard_payload(
        db,
        current_user,
        days=days,
        factory_id=factory_id,
        shift=shift,
    )
    factory_label = "All factories"
    if factory_id:
        matched = next((item for item in payload.filters["factories"] if item.id == factory_id), None)
        factory_label = matched.label if matched else factory_id
    shift_label = shift.value.title() if shift else "All shifts"
    pdf_bytes = _render_executive_pdf(
        payload,
        days=days,
        factory_label=factory_label,
        shift_label=shift_label,
        trust_summary=trust_summary,
    )
    return Response(content=pdf_bytes, media_type="application/pdf")
