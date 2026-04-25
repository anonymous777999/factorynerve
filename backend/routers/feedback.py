"""Feedback API router for in-app product feedback submission and triage."""

from __future__ import annotations

import csv
from datetime import datetime, timedelta, timezone
import hashlib
from io import StringIO
import re
from enum import Enum
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.auth_security.rate_limit import RateLimitError, check_rate_limit
from backend.database import get_db
from backend.middleware.rate_limit_middleware import extract_client_ip
from backend.models.factory import Factory
from backend.models.feedback import (
    Feedback,
    FeedbackChannel,
    FeedbackMood,
    FeedbackRating,
    FeedbackSource,
    FeedbackStatus,
    FeedbackType,
)
from backend.models.user import User, UserRole
from backend.rbac import require_any_role
from backend.security import get_current_user
from backend.services.feedback_translation import enrich_feedback_message
from backend.tenancy import resolve_factory_id, resolve_org_id
from backend.utils import sanitize_text


router = APIRouter(tags=["Feedback"])
_WHITESPACE_RE = re.compile(r"\s+")


class FeedbackSort(str, Enum):
    RECENCY = "recency"
    FREQUENCY = "frequency"


class FeedbackSubmitRequest(BaseModel):
    type: FeedbackType
    message_original: str = Field(min_length=1, max_length=4000)
    source: FeedbackSource = FeedbackSource.FLOATING
    channel: FeedbackChannel = FeedbackChannel.TEXT
    mood: FeedbackMood | None = None
    rating: FeedbackRating | None = None
    message_translated: str | None = Field(default=None, max_length=4000)
    detected_language: str | None = Field(default=None, max_length=24)
    translation_status: str | None = Field(default="not_requested", max_length=24)
    context: dict[str, Any] | None = None
    client_request_id: str | None = Field(default=None, max_length=64)

    @field_validator("message_original")
    @classmethod
    def validate_message_original(cls, value: str) -> str:
        cleaned = sanitize_text(value, max_length=4000)
        if not cleaned:
            raise ValueError("Feedback message cannot be empty.")
        return cleaned

    @field_validator("message_translated")
    @classmethod
    def validate_message_translated(cls, value: str | None) -> str | None:
        return sanitize_text(value, max_length=4000) if value is not None else None

    @field_validator("detected_language")
    @classmethod
    def validate_detected_language(cls, value: str | None) -> str | None:
        return sanitize_text(value, max_length=24, preserve_newlines=False) if value is not None else None

    @field_validator("translation_status")
    @classmethod
    def validate_translation_status(cls, value: str | None) -> str:
        cleaned = sanitize_text(value or "not_requested", max_length=24, preserve_newlines=False)
        return cleaned or "not_requested"

    @field_validator("client_request_id")
    @classmethod
    def validate_client_request_id(cls, value: str | None) -> str | None:
        return sanitize_text(value, max_length=64, preserve_newlines=False) if value is not None else None


class FeedbackUpdateRequest(BaseModel):
    status: FeedbackStatus
    resolution_note: str | None = Field(default=None, max_length=1000)

    @field_validator("resolution_note")
    @classmethod
    def validate_resolution_note(cls, value: str | None) -> str | None:
        return sanitize_text(value, max_length=1000) if value is not None else None


class FeedbackSubmitResponse(BaseModel):
    id: int
    type: FeedbackType
    status: FeedbackStatus
    deduplicated: bool = False
    created_at: datetime


class FeedbackAdminItem(BaseModel):
    id: int
    org_id: str
    factory_id: str | None = None
    factory_name: str | None = None
    user_id: int
    user_name: str
    user_role: str
    type: FeedbackType
    source: FeedbackSource
    channel: FeedbackChannel
    mood: FeedbackMood | None = None
    rating: FeedbackRating | None = None
    status: FeedbackStatus
    message_original: str
    message_translated: str | None = None
    detected_language: str | None = None
    translation_status: str
    context: dict[str, Any] | None = None
    resolution_note: str | None = None
    resolved_at: datetime | None = None
    resolved_by_user_id: int | None = None
    resolved_by_name: str | None = None
    created_at: datetime
    group_key: str
    group_occurrences: int = 1
    latest_similar_at: datetime | None = None


class FeedbackReporterUpdateItem(BaseModel):
    id: int
    type: FeedbackType
    message_original: str
    resolution_note: str | None = None
    resolved_at: datetime


class FeedbackReporterUpdatesResponse(BaseModel):
    items: list[FeedbackReporterUpdateItem]
    total: int
    limit: int


class FeedbackListResponse(BaseModel):
    items: list[FeedbackAdminItem]
    total: int
    limit: int
    offset: int


def _require_feedback_admin(current_user: User) -> None:
    require_any_role(current_user, {UserRole.ADMIN, UserRole.OWNER})


def _sanitize_json(value: Any, *, depth: int = 0) -> Any:
    if depth > 4:
        return None
    if value is None or isinstance(value, (bool, int, float)):
        return value
    if isinstance(value, str):
        return sanitize_text(value, max_length=500)
    if isinstance(value, list):
        sanitized_items = [_sanitize_json(item, depth=depth + 1) for item in value[:10]]
        return [item for item in sanitized_items if item is not None]
    if isinstance(value, dict):
        sanitized: dict[str, Any] = {}
        for raw_key, raw_value in list(value.items())[:20]:
            key = sanitize_text(str(raw_key), max_length=64, preserve_newlines=False)
            if not key:
                continue
            sanitized_value = _sanitize_json(raw_value, depth=depth + 1)
            if sanitized_value is None:
                continue
            sanitized[key] = sanitized_value
        return sanitized or None
    return sanitize_text(str(value), max_length=200, preserve_newlines=False)


def _normalize_message(value: str) -> str:
    return _WHITESPACE_RE.sub(" ", value).strip().lower()


def _dedupe_hash(*, feedback_type: FeedbackType, message_original: str, route: str | None) -> str:
    normalized_route = sanitize_text(route, max_length=255, preserve_newlines=False) or "-"
    payload = f"{feedback_type.value}|{normalized_route}|{_normalize_message(message_original)}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _feedback_group_stats(
    db: Session,
    *,
    org_id: str,
    status_value: FeedbackStatus | None = None,
    feedback_type: FeedbackType | None = None,
):
    query = (
        db.query(
            Feedback.dedupe_hash.label("group_key"),
            func.count(Feedback.id).label("group_occurrences"),
            func.max(Feedback.created_at).label("latest_similar_at"),
        )
        .filter(Feedback.org_id == org_id)
    )
    if status_value:
        query = query.filter(Feedback.status == status_value)
    if feedback_type:
        query = query.filter(Feedback.type == feedback_type)
    return query.group_by(Feedback.dedupe_hash).subquery()


def _feedback_query(db: Session, *, org_id: str, group_stats=None):
    resolved_by_user = db.query(User).subquery()
    columns: list[Any] = [
        Feedback,
        User.name.label("user_name"),
        User.role.label("user_role"),
        Factory.name.label("factory_name"),
        resolved_by_user.c.name.label("resolved_by_name"),
    ]
    if group_stats is not None:
        columns.extend(
            [
                group_stats.c.group_occurrences.label("group_occurrences"),
                group_stats.c.latest_similar_at.label("latest_similar_at"),
            ]
        )

    query = (
        db.query(*columns)
        .join(User, Feedback.user_id == User.id)
        .outerjoin(Factory, Feedback.factory_id == Factory.factory_id)
        .outerjoin(resolved_by_user, Feedback.resolved_by_user_id == resolved_by_user.c.id)
        .filter(Feedback.org_id == org_id)
    )
    if group_stats is not None:
        query = query.outerjoin(group_stats, Feedback.dedupe_hash == group_stats.c.group_key)
    return query


def _feedback_by_id(db: Session, *, org_id: str, feedback_id: int, group_stats=None):
    return _feedback_query(db, org_id=org_id, group_stats=group_stats).filter(Feedback.id == feedback_id).first()


def _throttle_feedback(request: Request, current_user: User) -> None:
    ip_address = extract_client_ip(request)
    try:
        check_rate_limit(key=f"feedback:user:{current_user.id}", max_requests=5, window_seconds=300)
        check_rate_limit(key=f"feedback:ip:{ip_address}", max_requests=20, window_seconds=300)
    except RateLimitError as error:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=error.detail) from error


def _serialize_feedback_item(
    feedback: Feedback,
    *,
    user_name: str,
    user_role: str,
    factory_name: str | None,
    resolved_by_name: str | None,
    group_occurrences: int | None = None,
    latest_similar_at: datetime | None = None,
) -> FeedbackAdminItem:
    if isinstance(user_role, Enum):
        normalized_user_role = str(user_role.value)
    else:
        normalized_user_role = str(user_role)
        if normalized_user_role.startswith("UserRole."):
            normalized_user_role = normalized_user_role.split(".", 1)[1].lower()
    return FeedbackAdminItem(
        id=feedback.id,
        org_id=feedback.org_id,
        factory_id=feedback.factory_id,
        factory_name=factory_name,
        user_id=feedback.user_id,
        user_name=user_name,
        user_role=normalized_user_role,
        type=feedback.type,
        source=feedback.source,
        channel=feedback.channel,
        mood=feedback.mood,
        rating=feedback.rating,
        status=feedback.status,
        message_original=feedback.message_original,
        message_translated=feedback.message_translated,
        detected_language=feedback.detected_language,
        translation_status=feedback.translation_status,
        context=feedback.context,
        resolution_note=feedback.resolution_note,
        resolved_at=feedback.resolved_at,
        resolved_by_user_id=feedback.resolved_by_user_id,
        resolved_by_name=resolved_by_name,
        created_at=feedback.created_at,
        group_key=str(feedback.dedupe_hash),
        group_occurrences=max(1, int(group_occurrences or 1)),
        latest_similar_at=latest_similar_at or feedback.created_at,
    )


def _build_feedback_csv(rows: list[FeedbackAdminItem]) -> str:
    buffer = StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "id",
            "type",
            "status",
            "source",
            "channel",
            "rating",
            "mood",
            "user_name",
            "user_role",
            "factory_name",
            "created_at",
            "resolved_at",
            "group_occurrences",
            "route",
            "last_action",
            "detected_language",
            "translation_status",
            "message_original",
            "message_translated",
            "resolution_note",
        ]
    )
    for row in rows:
        context = row.context or {}
        writer.writerow(
            [
                row.id,
                row.type.value,
                row.status.value,
                row.source.value,
                row.channel.value,
                row.rating.value if row.rating else "",
                row.mood.value if row.mood else "",
                row.user_name,
                row.user_role,
                row.factory_name or "",
                row.created_at.isoformat(),
                row.resolved_at.isoformat() if row.resolved_at else "",
                row.group_occurrences,
                str(context.get("route") or ""),
                str(context.get("last_action") or ""),
                row.detected_language or "",
                row.translation_status,
                row.message_original,
                row.message_translated or "",
                row.resolution_note or "",
            ]
        )
    return buffer.getvalue()


@router.post("", response_model=FeedbackSubmitResponse)
def submit_feedback(
    payload: FeedbackSubmitRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FeedbackSubmitResponse:
    _throttle_feedback(request, current_user)
    org_id = resolve_org_id(current_user)
    if not org_id:
        raise HTTPException(status_code=400, detail="Organization could not be resolved.")

    existing_by_request_id = None
    if payload.client_request_id:
        existing_by_request_id = (
            db.query(Feedback)
            .filter(
                Feedback.org_id == org_id,
                Feedback.user_id == current_user.id,
                Feedback.client_request_id == payload.client_request_id,
            )
            .first()
        )
    if existing_by_request_id:
        return FeedbackSubmitResponse(
            id=existing_by_request_id.id,
            type=existing_by_request_id.type,
            status=existing_by_request_id.status,
            deduplicated=True,
            created_at=existing_by_request_id.created_at,
        )

    sanitized_context = _sanitize_json(payload.context)
    route = None
    if isinstance(sanitized_context, dict):
        route_value = sanitized_context.get("route")
        route = route_value if isinstance(route_value, str) else None

    message_original = sanitize_text(payload.message_original, max_length=4000)
    if not message_original:
        raise HTTPException(status_code=400, detail="Feedback message cannot be empty.")

    dedupe_hash = _dedupe_hash(
        feedback_type=payload.type,
        message_original=message_original,
        route=route,
    )
    duplicate_window_start = datetime.now(timezone.utc) - timedelta(minutes=2)
    recent_duplicate = (
        db.query(Feedback)
        .filter(
            Feedback.org_id == org_id,
            Feedback.user_id == current_user.id,
            Feedback.dedupe_hash == dedupe_hash,
            Feedback.created_at >= duplicate_window_start,
        )
        .order_by(Feedback.created_at.desc())
        .first()
    )
    if recent_duplicate:
        return FeedbackSubmitResponse(
            id=recent_duplicate.id,
            type=recent_duplicate.type,
            status=recent_duplicate.status,
            deduplicated=True,
            created_at=recent_duplicate.created_at,
        )

    translation = enrich_feedback_message(
        message_original=message_original,
        detected_language=payload.detected_language,
        translated_text=payload.message_translated,
        translation_status=payload.translation_status,
    )
    feedback = Feedback(
        org_id=org_id,
        factory_id=resolve_factory_id(db, current_user),
        user_id=current_user.id,
        type=payload.type,
        source=payload.source,
        channel=payload.channel,
        mood=payload.mood,
        rating=payload.rating,
        message_original=message_original,
        message_translated=translation.translated_text,
        detected_language=translation.detected_language,
        translation_status=translation.translation_status,
        context=sanitized_context,
        dedupe_hash=dedupe_hash,
        client_request_id=payload.client_request_id,
        status=FeedbackStatus.OPEN,
    )
    db.add(feedback)
    db.commit()
    db.refresh(feedback)
    return FeedbackSubmitResponse(
        id=feedback.id,
        type=feedback.type,
        status=feedback.status,
        deduplicated=False,
        created_at=feedback.created_at,
    )


@router.get("", response_model=FeedbackListResponse)
def list_feedback(
    status_value: FeedbackStatus | None = Query(default=None, alias="status"),
    feedback_type: FeedbackType | None = Query(default=None, alias="type"),
    sort_value: FeedbackSort = Query(default=FeedbackSort.RECENCY, alias="sort"),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FeedbackListResponse:
    _require_feedback_admin(current_user)
    org_id = resolve_org_id(current_user)
    if not org_id:
        raise HTTPException(status_code=400, detail="Organization could not be resolved.")

    group_stats = _feedback_group_stats(
        db,
        org_id=org_id,
        status_value=status_value,
        feedback_type=feedback_type,
    )
    query = _feedback_query(db, org_id=org_id, group_stats=group_stats)
    if status_value:
        query = query.filter(Feedback.status == status_value)
    if feedback_type:
        query = query.filter(Feedback.type == feedback_type)

    total = query.count()
    if sort_value == FeedbackSort.FREQUENCY:
        query = query.order_by(
            group_stats.c.group_occurrences.desc(),
            group_stats.c.latest_similar_at.desc(),
            Feedback.created_at.desc(),
            Feedback.id.desc(),
        )
    else:
        query = query.order_by(Feedback.created_at.desc(), Feedback.id.desc())

    rows = query.offset(offset).limit(limit).all()
    items = [
        _serialize_feedback_item(
            feedback,
            user_name=str(user_name),
            user_role=str(user_role),
            factory_name=factory_name,
            resolved_by_name=resolved_by_name,
            group_occurrences=group_occurrences,
            latest_similar_at=latest_similar_at,
        )
        for feedback, user_name, user_role, factory_name, resolved_by_name, group_occurrences, latest_similar_at in rows
    ]
    return FeedbackListResponse(items=items, total=total, limit=limit, offset=offset)


@router.get("/mine/updates", response_model=FeedbackReporterUpdatesResponse)
def list_my_feedback_updates(
    since: datetime | None = Query(default=None),
    limit: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FeedbackReporterUpdatesResponse:
    org_id = resolve_org_id(current_user)
    if not org_id:
        raise HTTPException(status_code=400, detail="Organization could not be resolved.")

    query = (
        db.query(Feedback)
        .filter(
            Feedback.org_id == org_id,
            Feedback.user_id == current_user.id,
            Feedback.status == FeedbackStatus.RESOLVED,
            Feedback.resolved_at.is_not(None),
        )
    )
    if since:
        query = query.filter(Feedback.resolved_at > since)

    total = query.count()
    rows = query.order_by(Feedback.resolved_at.desc(), Feedback.id.desc()).limit(limit).all()
    return FeedbackReporterUpdatesResponse(
        items=[
            FeedbackReporterUpdateItem(
                id=row.id,
                type=row.type,
                message_original=row.message_original,
                resolution_note=row.resolution_note,
                resolved_at=row.resolved_at or row.created_at,
            )
            for row in rows
        ],
        total=total,
        limit=limit,
    )


@router.get("/export.csv")
def export_feedback_csv(
    status_value: FeedbackStatus | None = Query(default=None, alias="status"),
    feedback_type: FeedbackType | None = Query(default=None, alias="type"),
    sort_value: FeedbackSort = Query(default=FeedbackSort.RECENCY, alias="sort"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    payload = list_feedback(
        status_value=status_value,
        feedback_type=feedback_type,
        sort_value=sort_value,
        limit=5000,
        offset=0,
        db=db,
        current_user=current_user,
    )
    csv_body = _build_feedback_csv(payload.items)
    return Response(
        content=csv_body,
        media_type="text/csv",
        headers={
            "Content-Disposition": 'attachment; filename="feedback-export.csv"',
        },
    )


@router.get("/{feedback_id}", response_model=FeedbackAdminItem)
def get_feedback(
    feedback_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FeedbackAdminItem:
    _require_feedback_admin(current_user)
    org_id = resolve_org_id(current_user)
    if not org_id:
        raise HTTPException(status_code=400, detail="Organization could not be resolved.")

    group_stats = _feedback_group_stats(db, org_id=org_id)
    row = _feedback_by_id(db, org_id=org_id, feedback_id=feedback_id, group_stats=group_stats)
    if not row:
        raise HTTPException(status_code=404, detail="Feedback not found.")
    feedback, user_name, user_role, factory_name, resolved_by_name, group_occurrences, latest_similar_at = row
    return _serialize_feedback_item(
        feedback,
        user_name=str(user_name),
        user_role=str(user_role),
        factory_name=factory_name,
        resolved_by_name=resolved_by_name,
        group_occurrences=group_occurrences,
        latest_similar_at=latest_similar_at,
    )


@router.patch("/{feedback_id}", response_model=FeedbackAdminItem)
def update_feedback(
    feedback_id: int,
    payload: FeedbackUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FeedbackAdminItem:
    _require_feedback_admin(current_user)
    org_id = resolve_org_id(current_user)
    if not org_id:
        raise HTTPException(status_code=400, detail="Organization could not be resolved.")

    row = _feedback_by_id(db, org_id=org_id, feedback_id=feedback_id)
    if not row:
        raise HTTPException(status_code=404, detail="Feedback not found.")
    feedback, _, _, _, _ = row

    feedback.status = payload.status
    feedback.resolution_note = payload.resolution_note
    if payload.status == FeedbackStatus.RESOLVED:
        feedback.resolved_at = datetime.now(timezone.utc)
        feedback.resolved_by_user_id = current_user.id
    else:
        feedback.resolved_at = None
        feedback.resolved_by_user_id = None
    db.commit()

    group_stats = _feedback_group_stats(db, org_id=org_id)
    refreshed_row = _feedback_by_id(db, org_id=org_id, feedback_id=feedback_id, group_stats=group_stats)
    assert refreshed_row is not None
    refreshed_feedback, user_name, user_role, factory_name, resolved_by_name, group_occurrences, latest_similar_at = refreshed_row
    return _serialize_feedback_item(
        refreshed_feedback,
        user_name=str(user_name),
        user_role=str(user_role),
        factory_name=factory_name,
        resolved_by_name=resolved_by_name,
        group_occurrences=group_occurrences,
        latest_similar_at=latest_similar_at,
    )
