"""Recipient management helpers for operational alert delivery."""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from backend.models.admin_alert_recipient import AdminAlertRecipient
from backend.models.user import User, UserRole
from backend.phone_utils import normalize_phone_e164
from backend.services.otp_service import UnverifiedPhoneError, get_verified_phone_for_recipient
from backend.services.ops_alerts.types import AlertCandidate, AlertEventType, AlertSeverity
from backend.plans import get_org_plan, ops_alert_recipient_limit


@dataclass(frozen=True)
class RecipientPreferenceState:
    values: tuple[str, ...]
    mode: str


@dataclass(frozen=True)
class AlertDeliveryTarget:
    recipient_id: int
    phone_number: str
    receive_daily_summary: bool


def normalize_alert_phone_number(value: str | None) -> str:
    return normalize_phone_e164(value)


def format_whatsapp_target(phone_number: str) -> str:
    cleaned = str(phone_number or "").strip()
    if not cleaned:
        raise ValueError("Phone number is required.")
    return cleaned if cleaned.startswith("whatsapp:") else f"whatsapp:{cleaned}"


def _normalize_string_preferences(values: list[str] | None, *, allowed: set[str], field_name: str) -> list[str] | None:
    if values is None:
        return None
    cleaned: list[str] = []
    seen: set[str] = set()
    for raw in values:
        value = str(raw or "").strip().lower()
        if not value:
            continue
        if value not in allowed:
            raise ValueError(f"Unknown {field_name} value: {value}")
        if value in seen:
            continue
        seen.add(value)
        cleaned.append(value)
    return cleaned


def normalize_event_type_preferences(values: list[str] | None) -> list[str] | None:
    return _normalize_string_preferences(
        values,
        allowed={event.value for event in AlertEventType},
        field_name="event_types",
    )


def normalize_severity_level_preferences(values: list[str] | None) -> list[str] | None:
    return _normalize_string_preferences(
        values,
        allowed={severity.value for severity in AlertSeverity},
        field_name="severity_levels",
    )


def preference_state(values: list[str] | None) -> RecipientPreferenceState:
    if values is None:
        return RecipientPreferenceState(values=(), mode="all")
    if len(values) == 0:
        return RecipientPreferenceState(values=(), mode="none")
    return RecipientPreferenceState(values=tuple(values), mode="custom")


def list_alert_recipients(db: Session, *, org_id: str, active_only: bool = False) -> list[AdminAlertRecipient]:
    query = db.query(AdminAlertRecipient).filter(AdminAlertRecipient.org_id == org_id)
    if active_only:
        query = query.filter(AdminAlertRecipient.is_active.is_(True))
    return query.order_by(AdminAlertRecipient.created_at.asc(), AdminAlertRecipient.id.asc()).all()


def count_active_alert_recipients(db: Session, *, org_id: str) -> int:
    return (
        db.query(AdminAlertRecipient)
        .filter(
            AdminAlertRecipient.org_id == org_id,
            AdminAlertRecipient.is_active.is_(True),
        )
        .count()
    )


def get_alert_recipient_limit(db: Session, *, org_id: str | None, fallback_user_id: int | None) -> tuple[str, int]:
    plan = get_org_plan(db, org_id=org_id, fallback_user_id=fallback_user_id)
    return plan, ops_alert_recipient_limit(plan)


def validate_alert_recipient_user(db: Session, *, org_id: str, user_id: int) -> User:
    user = (
        db.query(User)
        .filter(
            User.id == user_id,
            User.org_id == org_id,
            User.is_active.is_(True),
        )
        .first()
    )
    if not user:
        raise ValueError("Linked user was not found in this account.")
    if user.role not in {UserRole.ADMIN, UserRole.OWNER}:
        raise ValueError("Linked recipient user must be an admin or owner.")
    return user


def recipient_allows_candidate(recipient: AdminAlertRecipient, candidate: AlertCandidate) -> bool:
    event_types = preference_state(recipient.event_types)
    severities = preference_state(recipient.severity_levels)
    if candidate.is_summary and not recipient.receive_daily_summary:
        return False
    if event_types.mode == "none":
        return False
    if severities.mode == "none":
        return False
    if event_types.mode == "custom" and candidate.event_type.value not in set(event_types.values):
        return False
    if severities.mode == "custom" and candidate.severity.value not in set(severities.values):
        return False
    return True


def resolve_alert_delivery_targets(db: Session, *, org_id: str | None, candidate: AlertCandidate) -> list[AlertDeliveryTarget]:
    query = db.query(AdminAlertRecipient).filter(AdminAlertRecipient.is_active.is_(True))
    if org_id:
        query = query.filter(AdminAlertRecipient.org_id == org_id)
    rows = query.order_by(AdminAlertRecipient.created_at.asc(), AdminAlertRecipient.id.asc()).all()
    targets: list[AlertDeliveryTarget] = []
    seen: set[str] = set()
    for row in rows:
        if not recipient_allows_candidate(row, candidate):
            continue
        try:
            linked_user = None
            if row.user_id is not None:
                linked_user = db.query(User).filter(User.id == row.user_id, User.is_active.is_(True)).first()
            verified_phone = get_verified_phone_for_recipient(row, user=linked_user)
            target = format_whatsapp_target(verified_phone)
        except (ValueError, UnverifiedPhoneError):
            continue
        if target in seen:
            continue
        seen.add(target)
        targets.append(
            AlertDeliveryTarget(
                recipient_id=row.id,
                phone_number=target,
                receive_daily_summary=row.receive_daily_summary,
            )
        )
    return targets
