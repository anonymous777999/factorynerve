"""Authenticated endpoints for UI telemetry, preferences, and recommendation cycles."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.ui_autonomy import UiRecommendation
from backend.models.user import User
from backend.security import get_current_user
from backend.services.ui_autonomy_service import (
    build_overview,
    list_preferences,
    record_signal,
    refresh_recommendations_for_user,
    update_recommendation_status,
    upsert_preference,
)


router = APIRouter(tags=["UI Autonomy"])


class UiSignalRequest(BaseModel):
    route: str | None = Field(default=None, max_length=300)
    signal_type: str = Field(min_length=1, max_length=40)
    signal_key: str = Field(min_length=1, max_length=80)
    severity: str | None = Field(default=None, max_length=16)
    duration_ms: int | None = Field(default=None, ge=0, le=600_000)
    value: float | None = None
    payload: dict[str, Any] | list[Any] | None = None


class UiSignalAcceptedResponse(BaseModel):
    status: str
    signal_id: int


class UiPreferenceValueRequest(BaseModel):
    value: Any
    source: str = Field(default="manual", max_length=24)


class UiPreferenceResponse(BaseModel):
    id: int
    key: str
    value: Any
    source: str
    created_at: datetime
    updated_at: datetime


class UiRecommendationResponse(BaseModel):
    id: int
    route: str | None = None
    category: str
    priority: str
    title: str
    summary: str
    suggested_action: str | None = None
    evidence: Any = None
    source: str
    status: str
    created_at: datetime
    updated_at: datetime


class UiRecommendationStatusRequest(BaseModel):
    status: str = Field(min_length=1, max_length=24)


class UiRouteSummaryResponse(BaseModel):
    route: str
    visits: int
    interactions: int
    issue_count: int
    avg_duration_ms: int | None = None
    long_tasks: int = 0


class UiBehaviorSummaryResponse(BaseModel):
    window_days: int
    total_signals: int
    signal_breakdown: dict[str, int]
    top_routes: list[UiRouteSummaryResponse]
    slow_routes: list[UiRouteSummaryResponse]
    drop_off_routes: list[UiRouteSummaryResponse]
    open_recommendations: int
    recent_signals: list[dict[str, Any]]


class UiAutonomyOverviewResponse(BaseModel):
    status: str
    window_days: int
    summary: UiBehaviorSummaryResponse
    preferences: list[UiPreferenceResponse]
    recommendations: list[UiRecommendationResponse]
    automation_contract: dict[str, Any]


class UiRecommendationRunResponse(BaseModel):
    window_days: int
    signals_considered: int
    created: int
    updated: int
    reopened: int
    resolved: int
    preference_changed: bool
    recommendations: list[UiRecommendationResponse]


def _serialize_recommendation(record: UiRecommendation) -> UiRecommendationResponse:
    return UiRecommendationResponse(
        id=record.id,
        route=record.route,
        category=record.category,
        priority=record.priority,
        title=record.title,
        summary=record.summary,
        suggested_action=record.suggested_action,
        evidence=record.evidence_json,
        source=record.source,
        status=record.status,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


@router.post("/signals", response_model=UiSignalAcceptedResponse, status_code=status.HTTP_202_ACCEPTED)
def capture_ui_signal(
    payload: UiSignalRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UiSignalAcceptedResponse:
    signal = record_signal(
        db,
        current_user=current_user,
        route=payload.route,
        signal_type=payload.signal_type,
        signal_key=payload.signal_key,
        severity=payload.severity,
        duration_ms=payload.duration_ms,
        value=payload.value,
        payload=payload.payload,
    )
    return UiSignalAcceptedResponse(status="accepted", signal_id=signal.id)


@router.get("/overview", response_model=UiAutonomyOverviewResponse)
def get_ui_autonomy_overview(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UiAutonomyOverviewResponse:
    return UiAutonomyOverviewResponse(**build_overview(db, current_user=current_user))


@router.get("/preferences", response_model=list[UiPreferenceResponse])
def get_ui_preferences(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[UiPreferenceResponse]:
    return [UiPreferenceResponse(**item) for item in list_preferences(db, current_user=current_user)]


@router.put("/preferences/{preference_key}", response_model=UiPreferenceResponse)
def put_ui_preference(
    preference_key: str,
    payload: UiPreferenceValueRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UiPreferenceResponse:
    preference, _ = upsert_preference(
        db,
        current_user=current_user,
        preference_key=preference_key,
        preference_value=payload.value,
        source=payload.source,
    )
    return UiPreferenceResponse(
        id=preference.id,
        key=preference.preference_key,
        value=preference.preference_value,
        source=preference.source,
        created_at=preference.created_at,
        updated_at=preference.updated_at,
    )


@router.get("/recommendations", response_model=list[UiRecommendationResponse])
def get_ui_recommendations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[UiRecommendationResponse]:
    records = (
        db.query(UiRecommendation)
        .filter(UiRecommendation.user_id == int(current_user.id))
        .all()
    )
    records.sort(key=lambda item: (item.status == "open", item.priority == "high", item.updated_at), reverse=True)
    return [_serialize_recommendation(record) for record in records]


@router.post("/recommendations/run", response_model=UiRecommendationRunResponse)
def run_ui_recommendation_cycle(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UiRecommendationRunResponse:
    return UiRecommendationRunResponse(**refresh_recommendations_for_user(db, current_user=current_user))


@router.put("/recommendations/{recommendation_id}/status", response_model=UiRecommendationResponse)
def put_ui_recommendation_status(
    recommendation_id: int,
    payload: UiRecommendationStatusRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UiRecommendationResponse:
    recommendation = update_recommendation_status(
        db,
        current_user=current_user,
        recommendation_id=recommendation_id,
        status=payload.status,
    )
    if recommendation is None:
        raise HTTPException(status_code=404, detail="Recommendation not found.")
    return _serialize_recommendation(recommendation)
